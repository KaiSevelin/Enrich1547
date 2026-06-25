/**
 * combat/lifecycle-flow.mjs
 *
 * Phased functions per ADR-0003. Each function is async and takes
 * `(opts, run)`. The function looks imperative — it awaits, branches,
 * throws — but never touches Foundry. Every cancellable-event
 * boundary delegates to `run({phase, patches?, event?}) → {response?}`.
 *
 * Composition: phased functions call other phased functions by
 * passing the same `run` through. The orchestrator's `runPhases` is
 * the only thing that knows about `applyPatch` and `emitCombatEvent`.
 *
 * Deps passed via `opts` (Foundry-glue helpers the orchestrator wraps
 * around `game.settings` / `CONFIG`):
 *
 *   normalizeWeapon              (weapon, actor) -> normalized weapon (with unarmed default)
 *   buildAttackReactionCandidates ({ attacker, defender, pendingWeapon, pendingProfile, context }) -> candidate[]
 *   buildThreatReactionCandidates (threatPayload) -> candidate[]
 *   getActorReactionWeapon       (actor) -> normalized reaction weapon
 *
 * `run` contract (also documented in ADR-0003):
 *   run({phase: string, patches?: Patch[], event?: {type, payload}})
 *     -> {response?}   // response present iff event was emitted
 */

import {
    buildPendingAttack as buildPendingAttackPure,
    buildPendingMove as buildPendingMovePure,
    findReactionResolution,
    normalizeAppliedAttackModifiers,
    normalizeDefenseModifiers,
    normalizeRollSummary,
    applyMultiplier,
    actorHasEquippedArmor,
    isPendingAttack,
    planApplyDefenseFollowUpState,
    planSpendReservedCosts,
    planStoreFumbleRiskPoints,
    PENDING_ATTACK_KIND,
} from "./attack-lifecycle.mjs";
import { resolveSelectedWeaponProfile, normalizeManeuver } from "./normalisation.mjs";
import { planConsumePersistentEffect } from "./persistent-effects.mjs";
import { planConsumeLoadedAmmo } from "./ammo-state.mjs";
import { planApplyDamage, getActorCurrentHitPoints } from "./hp-state.mjs";
import { resolveThreatReactionActor } from "./reaction-candidates.mjs";
import { getLegalManeuvers } from "./maneuver-legality.mjs";
import { COMBAT_EVENTS } from "../services/combat-events.js";
import { MODULE_ID, SOURCE_FLAG_SCOPE } from "../lib/constants.mjs";
import { statDice, statMod } from "../lib/foundry-utils.mjs";


function normalizeAttachedModifierIdList(value) {
    if (Array.isArray(value)) {
        return value.map((entry) => String(entry ?? "").trim()).filter(Boolean);
    }
    const trimmed = String(value ?? "").trim();
    if (!trimmed) return [];
    try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
            return parsed.map((entry) => String(entry ?? "").trim()).filter(Boolean);
        }
    } catch {
        // Fall through to comma-split parsing.
    }
    return trimmed.split(",").map((entry) => entry.trim()).filter(Boolean);
}

function getActorStatCheckValue(actor, statName) {
    const normalized = String(statName ?? "").trim();
    if (!normalized) return 0;
    return statDice(actor, normalized) + statMod(actor, normalized);
}

// Accepts either "source X" / "target X" (legacy/freeform) or a bare stat
// name "X" (new stat-only dropdowns). When the value is bare, the caller's
// `defaultSide` picks the side from the field's natural meaning
// (sourceCheck → source, targetCheck → target).
function parseCheckDescriptor(descriptor = "", defaultSide = null) {
    const trimmed = String(descriptor ?? "").trim();
    if (!trimmed) return null;
    const parts = trimmed.split(/\s+/);
    if (parts.length === 1) {
        if (!defaultSide) return null;
        return { side: defaultSide, stat: parts[0] };
    }
    const side = parts[0].toLowerCase();
    const stat = parts.slice(1).join(" ").trim();
    if (!["source", "target"].includes(side) || !stat) return null;
    return { side, stat };
}

function shouldTriggerOnHitEffect(effect, context) {
    const triggerMode = String(effect?.triggerMode ?? "").trim().toLowerCase() || "onanyhit";
    if (triggerMode === "onmanualchoice") return false;
    if (triggerMode === "ondamageapplied") return context.baseDamageApplied > 0;
    if (triggerMode === "oncritical") return context.attackRollCrit > 0;
    if (triggerMode === "onexposure") return context.baseDamageApplied > 0;
    return true;
}

function passesArmorInteraction(effect, context) {
    const armorInteraction = String(effect?.armorInteraction ?? "").trim().toLowerCase() || "normal";
    if (armorInteraction === "onlyifbasedamagepassed") return context.baseDamageApplied > 0;
    return true;
}

// A save's difficulty is expressed as 1-5, read as "[difficulty]d6". In this
// deterministic model an Nd6 pool has a nominal value of N (its dice count),
// directly comparable to a stat check value (statDice + statMod).
const DEFAULT_SAVE_DIFFICULTY = 3;

function parseDifficultyValue(value) {
    if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
    const match = /^(\d+)\s*(?:d6)?$/i.exec(String(value ?? "").trim());
    if (!match) return null;
    const parsed = Number.parseInt(match[1], 10);
    return parsed > 0 ? parsed : null;
}

function resolveSaveDifficulty(effect) {
    return parseDifficultyValue(effect?.difficulty)
        ?? parseDifficultyValue(effect?.sourceCheck)
        ?? DEFAULT_SAVE_DIFFICULTY;
}

function resolveOnHitEffectSuccess(effect, context) {
    const resolution = String(effect?.resolution ?? "").trim().toLowerCase() || "automatic";
    if (resolution === "automatic") return true;

    const sourceDescriptor = parseCheckDescriptor(effect?.sourceCheck, "source");
    const targetDescriptor = parseCheckDescriptor(effect?.targetCheck, "target");
    const sourceActor = sourceDescriptor?.side === "target" ? context.targetActor : context.sourceActor;
    const targetActor = targetDescriptor?.side === "source" ? context.sourceActor : context.targetActor;
    const targetValue = targetDescriptor ? getActorStatCheckValue(targetActor, targetDescriptor.stat) : 0;

    if (resolution === "save") {
        // A save pits an attacker stat — or a flat difficulty when no attacker
        // stat is given — against the defender's resistance. The rider lands
        // unless the defender's check strictly exceeds the attacker side.
        const attackerValue = sourceDescriptor
            ? getActorStatCheckValue(sourceActor, sourceDescriptor.stat)
            : resolveSaveDifficulty(effect);
        return attackerValue >= targetValue;
    }

    if (resolution === "contest") {
        if (!sourceDescriptor && !targetDescriptor) return true;
        const sourceValue = sourceDescriptor ? getActorStatCheckValue(sourceActor, sourceDescriptor.stat) : 0;
        return sourceValue >= targetValue;
    }

    return true;
}

function cloneActorWithHitPoints(actor, currentHitPoints) {
    // Foundry Actors expose `id` as a prototype getter; the spread below
    // would drop it, and downstream planApplyDamage bails on missing id
    // and returns a null hitPointUpdate. Copy `id` (and `name`, for chat
    // attribution) explicitly so the secondary-damage pass keeps working.
    return {
        ...actor,
        id: actor?.id,
        name: actor?.name,
        system: {
            ...(actor?.system ?? {}),
            props: {
                ...(actor?.system?.props ?? {}),
                CurrentHitPoints: currentHitPoints,
            },
        },
    };
}

function collectTriggeredModifierEffects(pendingAttack, context) {
    const modifiers = Array.isArray(pendingAttack?.attackModifiers)
        ? pendingAttack.attackModifiers
        : [
            ...(Array.isArray(pendingAttack?.weaponModifiers) ? pendingAttack.weaponModifiers : []),
            ...(Array.isArray(pendingAttack?.ammoModifiers) ? pendingAttack.ammoModifiers : []),
        ];
    return modifiers.flatMap((modifier) => {
        const effects = Array.isArray(modifier?.onHitEffects) ? modifier.onHitEffects : [];
        return effects
            .filter((effect) => shouldTriggerOnHitEffect(effect, context))
            .filter((effect) => passesArmorInteraction(effect, context))
            .filter((effect) => resolveOnHitEffectSuccess(effect, context))
            .map((effect) => ({ modifier, effect }));
    });
}

function planConsumeTriggeredModifier(parentActor, modifier) {
    if (!parentActor?.id || !modifier?.attachedToItemId || !modifier?._id) return [];
    const durationType = String(modifier.durationType ?? "").trim().toLowerCase();
    if (durationType !== "uses") return [];
    const currentRemaining = Number(modifier.durationValue ?? 0) || 0;
    if (currentRemaining <= 0) return [];
    const nextRemaining = currentRemaining - 1;

    if (nextRemaining > 0) {
        // Multi-use modifier with charges left: just decrement. Write both
        // the legacy `usesRemaining` flag (combat reads from here) and the
        // `system.props.UsesRemaining` prop (CSB itemContainer surfaces it
        // as a column on the parent weapon's sheet).
        return [{
            kind: "item.update",
            actorId: parentActor.id,
            itemId: modifier._id,
            data: {
                [`flags.${SOURCE_FLAG_SCOPE}.usesRemaining`]: nextRemaining,
                "system.props.UsesRemaining": nextRemaining,
            },
        }];
    }

    // Last charge consumed: detach from the parent AND delete the modifier item.
    const patches = [];
    const parentItem = parentActor?.items?.get?.(modifier.attachedToItemId) ?? null;
    if (parentItem?.id) {
        const currentAttached = parentItem?.flags?.[SOURCE_FLAG_SCOPE]?.attachedModifierIds
            ?? parentItem?.flags?.[MODULE_ID]?.attachedModifierIds
            ?? parentItem?.system?.props?.AttachedModifierIds
            ?? parentItem?.flags?.[SOURCE_FLAG_SCOPE]?.sourceData?.attachedModifierIds
            ?? [];
        const nextAttached = normalizeAttachedModifierIdList(currentAttached)
            .filter((entry) => entry && entry !== modifier._id);
        patches.push({
            kind: "item.update",
            actorId: parentActor.id,
            itemId: parentItem.id,
            data: { [`flags.${SOURCE_FLAG_SCOPE}.attachedModifierIds`]: nextAttached },
        });
    }
    patches.push({
        kind: "item.delete",
        actorId: parentActor.id,
        itemId: modifier._id,
    });
    return patches;
}

// ─────────────────────────────────────────────────── declareAttackPhased ──

export async function declareAttackPhased(opts = {}, run) {
    const pendingAttack = buildPendingAttackPure(opts);

    const declarePatches = pendingAttack.target
        ? planConsumePersistentEffect(pendingAttack.target, "overwatch").patches
        : [];

    const { response: event } = await run({
        phase: "declare",
        patches: declarePatches,
        event: { type: COMBAT_EVENTS.ATTACK_DECLARED, payload: pendingAttack },
    });

    const declarationCommitted = !event.cancelled || event.reason === "reaction-triggered";
    if (declarationCommitted && !pendingAttack.committed) {
        const { patches: ammoPatches } = planConsumeLoadedAmmo({
            actor: pendingAttack.actor,
            weapon: pendingAttack.weapon,
            loadedAmmo: pendingAttack.loadedAmmo,
        });
        await run({ phase: "consumeAmmo", patches: ammoPatches });
        pendingAttack.committed = true;
    }

    return {
        pendingAttack,
        event,
        cancelled: event.cancelled,
        reactionResolution: findReactionResolution(event),
    };
}

// ─────────────────────────────────────────────────── declareMovementPhased ──

export async function declareMovementPhased({
    threatEvents = [],
    buildThreatReactionCandidates,
    ...options
} = {}, run) {
    if (typeof buildThreatReactionCandidates !== "function") {
        throw new Error("declareMovementPhased: missing buildThreatReactionCandidates dep.");
    }
    const pendingMove = buildPendingMovePure(options);

    const { response: movementEvent } = await run({
        phase: "movementStarted",
        event: { type: COMBAT_EVENTS.MOVEMENT_STARTED, payload: pendingMove },
    });

    const reactionResolutions = [];
    for (let i = 0; i < threatEvents.length; i++) {
        const threatPayload = {
            ...pendingMove,
            ...threatEvents[i],
            mover: pendingMove.actor,
            path: pendingMove.path,
        };
        if (!threatPayload.reactor) {
            threatPayload.reactor = resolveThreatReactionActor(threatPayload);
        }
        if (!Array.isArray(threatPayload.reactionCandidates) || !threatPayload.reactionCandidates.length) {
            threatPayload.reactionCandidates = buildThreatReactionCandidates(threatPayload);
        }

        const { response: threatEvent } = await run({
            phase: `threatZone[${i}]`,
            event: { type: COMBAT_EVENTS.THREAT_ZONE_ENTERED, payload: threatPayload },
        });

        const resolution = findReactionResolution(threatEvent);
        if (resolution) reactionResolutions.push(resolution);
    }

    return {
        pendingMove,
        event: movementEvent,
        reactionResolutions,
    };
}

// Shared declaration path for the two reaction-generated free attacks (the safe
// attack from a resolved reaction, and the safe counterattack). Both force a safe
// attack, carry the reaction's effect data, name the source via
// `generatedByReaction` (so the reaction service suppresses a nested window), and
// swap the source attack's conditions onto the new attacker/target. Centralising
// it keeps that generated-attack contract in one place.
function declareGeneratedAttack({
    actor,
    target,
    weapon,
    profile,
    effect = {},
    generatedByReaction,
    distanceSquares = null,
    actorConditions,
    targetConditions,
    deps = {},
}, run) {
    return declareAttackPhased({
        actor,
        target,
        targets: [target],
        weapon: weapon?.itemDocument ?? weapon,
        profile,
        forceSafeAttack: true,
        extraEffectData: effect,
        generatedByReaction,
        distanceSquares: Number.isFinite(distanceSquares) ? distanceSquares : null,
        actorConditions,
        targetConditions,
        normalizeWeapon: deps.normalizeWeapon,
        buildAttackReactionCandidates: deps.buildAttackReactionCandidates,
    }, run);
}

// ───────────────────────────────────────── executeResolvedReactionPhased ──

export async function executeResolvedReactionPhased(resolution, run, deps = {}) {
    const reaction = resolution?.reaction ?? null;
    const effect = reaction?.effectData ?? {};
    if (!effect.createFreeSafeAttack && !effect.createFreeSafeCounterattack) return null;

    const actor = reaction?.actor ?? resolution?.actor ?? null;
    const target = reaction?.target ?? resolution?.target ?? null;
    const weapon = reaction?.weapon ?? null;
    const profile = reaction?.profile ?? null;
    if (!actor || !target || !weapon || !profile) return null;

    const sourcePayload = resolution?.sourceEvent?.payload ?? {};
    const distanceSquares = Number(sourcePayload.distanceSquares ?? sourcePayload.rangeSquares);

    return declareGeneratedAttack({
        actor,
        target,
        weapon,
        profile,
        effect,
        generatedByReaction:
            reaction.generatedByPersistentEffect
            ?? reaction.sourceManeuverName
            ?? reaction.name
            ?? "reaction",
        distanceSquares,
        actorConditions: sourcePayload.actorConditions,
        targetConditions: sourcePayload.targetConditions,
        deps,
    }, run);
}

// ──────────────────────────────────────── executeSafeCounterattackPhased ──

export async function executeSafeCounterattackPhased({
    pendingAttack,
    defenseReaction = null,
    currentDamageTakenReaction = null,
    getActorReactionWeapon,
    normalizeWeapon,
    buildAttackReactionCandidates,
} = {}, run) {
    if (typeof getActorReactionWeapon !== "function") {
        throw new Error("executeSafeCounterattackPhased: missing getActorReactionWeapon dep.");
    }

    const defender = pendingAttack?.target ?? null;
    const attacker = pendingAttack?.actor ?? null;
    if (!defender || !attacker) {
        throw new Error("Safe counterattack is missing a defender or attacker.");
    }

    const defenseModifiers = normalizeDefenseModifiers({
        defenseReaction,
        damageTakenReaction: currentDamageTakenReaction,
    });
    if (!defenseModifiers.safeCounterattack) {
        throw new Error("No safe counterattack is available.");
    }

    const reactionWeapon = getActorReactionWeapon(defender);
    const reactionProfile = resolveSelectedWeaponProfile(reactionWeapon, {});
    if (!reactionWeapon || !reactionProfile) {
        throw new Error(`${defender.name ?? "Defender"} has no equipped weapon for a safe counterattack.`);
    }

    const distanceSquares = Number(
        pendingAttack?.metadata?.distanceSquares
        ?? pendingAttack?.metadata?.rangeSquares
    );

    return declareGeneratedAttack({
        actor: defender,
        target: attacker,
        weapon: reactionWeapon,
        profile: reactionProfile,
        effect: { createFreeSafeCounterattack: true },
        generatedByReaction:
            currentDamageTakenReaction?.name
            ?? defenseReaction?.name
            ?? "safe-counterattack",
        distanceSquares,
        actorConditions: pendingAttack?.metadata?.targetConditions,
        targetConditions: pendingAttack?.metadata?.actorConditions,
        deps: { normalizeWeapon, buildAttackReactionCandidates },
    }, run);
}

// ─────────────────────────────────────────── resolveAttackOutcomePhased ──
//
// Drives the longest combat flow: damage application → defense
// follow-up → DAMAGE_APPLIED emit → 0..2 POST_MANEUVER_WINDOW_OPENED
// emits → optional ammo consume → ACTION_COMMITTED emit. Each emit is
// its own phase.
//
// Returns plain-data `pendingPostManeuverWindows` (no closures); the
// orchestrator's wrapper decorates each window with
// commitPostManeuver / passPostManeuver callbacks.
//
// Returns `hitPointUpdate.isDead` so the orchestrator wrapper can
// sync `combatant.defeated` (a different doc collection, not part
// of the patch dispatcher's union).
//
// Deps:
//   buildDefaultDefenseRollSummary(pendingAttack) -> roll summary
//     The defenders-with-no-armor fallback. Foundry-side because it
//     reads game.settings via getStoredDatasetEntry.

export async function resolveAttackOutcomePhased({
    pendingAttack,
    attackRoll,
    defenseRoll,
    defenseReaction = null,
    defenderPostChoice = null,
    attackerPostChoice = null,
    currentDamageTakenReaction = null,
    buildDefaultDefenseRollSummary,
} = {}, run) {
    if (!pendingAttack) throw new Error("Missing pending attack.");
    if (!isPendingAttack(pendingAttack)) {
        throw new Error("Pending attack must be created through buildPendingAttack.");
    }
    if (typeof buildDefaultDefenseRollSummary !== "function") {
        throw new Error("resolveAttackOutcomePhased: missing buildDefaultDefenseRollSummary dep.");
    }

    // ── Pure compute: rolls, damage, critical points ──
    const appliedModifiers = normalizeAppliedAttackModifiers(pendingAttack?.mergedModifiers ?? {});
    const defenseModifiers = normalizeDefenseModifiers({
        defenseReaction,
        damageTakenReaction: currentDamageTakenReaction,
    });
    const normalizedAttackRoll = {
        ...applyMultiplier(normalizeRollSummary(attackRoll)),
        appliedModifiers,
    };
    const fallbackDefenseRoll = defenseRoll
        ?? (!actorHasEquippedArmor(pendingAttack?.target) ? buildDefaultDefenseRollSummary(pendingAttack) : null);
    const baseDefenseRoll = applyMultiplier(normalizeRollSummary(fallbackDefenseRoll));
    const normalizedDefenseRoll = {
        ...baseDefenseRoll,
        protection: baseDefenseRoll.protection + defenseModifiers.addArmorDice,
        appliedModifiers: defenseModifiers,
    };
    const baseDamageApplied = Math.max(
        0,
        normalizedAttackRoll.damage - normalizedDefenseRoll.protection - defenseModifiers.reduceDamageTaken
    );

    // ── Phase 1: HP + status patches (when there's damage) ──
    let hitPointUpdate;
    if (baseDamageApplied > 0) {
        const { patches: hpPatches, result: hpResult } = planApplyDamage(pendingAttack.target, baseDamageApplied);
        await run({ phase: "applyDamage", patches: hpPatches });
        hitPointUpdate = {
            previousHitPoints: hpResult.previousHitPoints,
            currentHitPoints: hpResult.currentHitPoints,
            // Exposed so the orchestrator wrapper can sync combatant.defeated
            // (a doc collection outside the patch dispatcher's union).
            isDead: hpResult.isDead,
            isUnconscious: hpResult.isUnconscious,
        };
    } else {
        const hp = getActorCurrentHitPoints(pendingAttack.target);
        hitPointUpdate = { previousHitPoints: hp, currentHitPoints: hp, isDead: false, isUnconscious: false };
    }

    const triggeredModifierEffects = collectTriggeredModifierEffects(pendingAttack, {
        baseDamageApplied,
        attackRollCrit: normalizedAttackRoll.crit,
        sourceActor: pendingAttack.actor,
        targetActor: pendingAttack.target,
    });
    const secondaryDamageApplied = triggeredModifierEffects.reduce(
        (sum, entry) => sum + Math.max(0, Number(entry.effect?.damageAmount ?? 0) || 0),
        0
    );
    // Any rider that passed shouldTrigger/armorInteraction/resolveSuccess counts
    // as fired even with an empty payload (e.g. a save rider authored only as a
    // gating check, no damage/status). Firing must still consume the modifier's
    // charge and surface in DAMAGE_APPLIED; otherwise zero-payload riders are
    // silently ignored.
    if (triggeredModifierEffects.length > 0) {
        const targetAfterBaseDamage = cloneActorWithHitPoints(pendingAttack.target, hitPointUpdate.currentHitPoints);
        const secondaryDamagePlan = secondaryDamageApplied > 0
            ? planApplyDamage(targetAfterBaseDamage, secondaryDamageApplied)
            : { patches: [], result: null };
        const statusPatches = triggeredModifierEffects
            .map((entry) => String(entry.effect?.applyStatus ?? "").trim())
            .filter(Boolean)
            .map((keyword) => ({
                kind: "actor.statusEffect",
                actorId: pendingAttack.target?.id,
                keyword,
                active: true,
            }));
        const consumePatches = triggeredModifierEffects.flatMap((entry) =>
            planConsumeTriggeredModifier(pendingAttack.actor, entry.modifier)
        );
        await run({
            phase: "applySecondaryEffects",
            patches: [
                ...secondaryDamagePlan.patches,
                ...statusPatches,
                ...consumePatches,
            ],
        });
        if (secondaryDamagePlan.result) {
            hitPointUpdate = {
                previousHitPoints: hitPointUpdate.previousHitPoints,
                currentHitPoints: secondaryDamagePlan.result.currentHitPoints,
                isDead: secondaryDamagePlan.result.isDead,
                isUnconscious: secondaryDamagePlan.result.isUnconscious,
            };
        }
    }
    const damageApplied = baseDamageApplied + secondaryDamageApplied;

    // Crits are PER-TOKEN (battle-flow-spec §10): each side spends only the crits
    // IT rolled — the defender its defense crits, the attacker its attack crits.
    // They are NOT pooled. `criticalPoints` (the sum) is retained only for the
    // informational Attack Result card; the post-windows use the per-side values.
    const attackerCriticalPoints = Math.max(0, normalizedAttackRoll.crit);
    const defenderCriticalPoints = Math.max(0, normalizedDefenseRoll.crit);
    const criticalPoints = attackerCriticalPoints + defenderCriticalPoints;

    // ── Phase 2: defense follow-up patches (locked parrying weapon) ──
    const { patches: defensePatches, result: defenseResult } = planApplyDefenseFollowUpState(pendingAttack, defenseModifiers);
    const defenseFollowUpState = defensePatches.length
        ? (await run({ phase: "applyDefenseFollowUp", patches: defensePatches }), { lockedParryingWeaponUntil: defenseResult.lockedParryingWeaponUntil ?? null })
        : {};

    // ── Phase 3: DAMAGE_APPLIED ──
    const { response: damageWindow } = await run({
        phase: "damageApplied",
        event: {
            type: COMBAT_EVENTS.DAMAGE_APPLIED,
            payload: {
                pendingAttack,
                attackRoll: normalizedAttackRoll,
                defenseRoll: normalizedDefenseRoll,
                damageApplied,
                baseDamageApplied,
                secondaryDamageApplied,
                secondaryEffects: triggeredModifierEffects,
                hitPointUpdate,
                appliedModifiers,
                defenseModifiers,
                defenseFollowUpState,
            },
        },
    });

    // ── Pure compute: post-attack legal maneuvers per side ──
    const defenderPostOptions = getLegalManeuvers({
        actor: pendingAttack.target,
        maneuvers: pendingAttack.target ? undefined : [],
        weapon: pendingAttack.weapon,
        profile: pendingAttack.profile,
        target: pendingAttack.actor,
        timingType: "post",
        triggerType: "post-attack",
        currentCriticalPoints: defenderCriticalPoints,
        actorConditions: pendingAttack.metadata?.targetConditions,
        targetConditions: pendingAttack.metadata?.actorConditions,
    });
    const attackerPostOptions = getLegalManeuvers({
        actor: pendingAttack.actor,
        weapon: pendingAttack.weapon,
        profile: pendingAttack.profile,
        target: pendingAttack.target,
        timingType: "post",
        triggerType: "post-attack",
        currentCriticalPoints: attackerCriticalPoints,
        actorConditions: pendingAttack.metadata?.actorConditions,
        targetConditions: pendingAttack.metadata?.targetConditions,
    });

    // ── Build data-only post-window payloads (orchestrator decorates with closures) ──
    const pendingPostManeuverWindows = [
        buildPostManeuverWindowData({
            side: "defender",
            actor: pendingAttack.target,
            target: pendingAttack.actor,
            pendingAttack,
            currentCriticalPoints: defenderCriticalPoints,
            legalPostManeuvers: defenderPostOptions,
            selectedPostManeuver: defenderPostChoice,
            actorConditions: pendingAttack.metadata?.targetConditions,
            targetConditions: pendingAttack.metadata?.actorConditions,
        }),
        buildPostManeuverWindowData({
            side: "attacker",
            actor: pendingAttack.actor,
            target: pendingAttack.target,
            pendingAttack,
            currentCriticalPoints: attackerCriticalPoints,
            legalPostManeuvers: attackerPostOptions,
            selectedPostManeuver: attackerPostChoice,
            actorConditions: pendingAttack.metadata?.actorConditions,
            targetConditions: pendingAttack.metadata?.targetConditions,
        }),
    ].filter((w) => w?.actor && w.legalPostManeuvers.length > 0);
    // A side with zero legal post-maneuvers has nothing to choose, so
    // its window is suppressed entirely — no POST_MANEUVER_WINDOW_OPENED
    // event, no UI prompt, no closure on the result.

    // ── Phases 4..N: POST_MANEUVER_WINDOW_OPENED per window ──
    const postManeuverWindowEvents = [];
    for (let i = 0; i < pendingPostManeuverWindows.length; i++) {
        const { response } = await run({
            phase: `postManeuverWindow[${i}:${pendingPostManeuverWindows[i].side}]`,
            event: { type: COMBAT_EVENTS.POST_MANEUVER_WINDOW_OPENED, payload: pendingPostManeuverWindows[i] },
        });
        postManeuverWindowEvents.push(response);
    }

    // ── Phase N+1 (conditional): consume ammo when uncommitted ──
    if (!pendingAttack.committed) {
        const { patches: ammoPatches } = planConsumeLoadedAmmo({
            actor: pendingAttack.actor,
            weapon: pendingAttack.weapon,
            loadedAmmo: pendingAttack.loadedAmmo,
        });
        await run({ phase: "consumeAmmo", patches: ammoPatches });
        pendingAttack.committed = true;
    }

    // ── Phase N+1b: spend reserved pre-maneuver costs (spec step 13) ──
    // Used reservations become spent on commit; nothing was deducted at
    // reservation time, so a cancelled attack simply never reaches here
    // (the points release by never being spent).
    const { patches: reservedSpendPatches } = planSpendReservedCosts(
        pendingAttack.actor,
        pendingAttack.reservedCosts
    );
    if (reservedSpendPatches.length) {
        await run({ phase: "spendReservations", patches: reservedSpendPatches });
    }

    // ── Phase N+1c: store fumble-generated RiskPoints (spec §Crit and Fumble) ──
    // Each side's RiskPoints is set to the fumbles IT rolled this time. Any
    // RiskPoints carried in were already turned into risk dice when this
    // roll's pool was built, so this single write both clears the consumed
    // points and stores the new ones for the next single roll.
    const { patches: riskPointPatches } = planStoreFumbleRiskPoints({
        attacker: pendingAttack.actor,
        attackFumble: normalizedAttackRoll.fumble,
        defender: pendingAttack.target,
        defenseFumble: normalizedDefenseRoll.fumble,
    });
    if (riskPointPatches.length) {
        await run({ phase: "storeRiskPoints", patches: riskPointPatches });
    }

    // ── Phase N+2: ACTION_COMMITTED ──
    const { response: commitEvent } = await run({
        phase: "actionCommitted",
        event: {
            type: COMBAT_EVENTS.ACTION_COMMITTED,
            payload: {
                type: "attack",
                pendingAttack,
                damageApplied,
                baseDamageApplied,
                secondaryDamageApplied,
                secondaryEffects: triggeredModifierEffects,
                hitPointUpdate,
                appliedModifiers,
                defenseModifiers,
                defenseFollowUpState,
            },
        },
    });

    return {
        pendingAttack,
        attackRoll: normalizedAttackRoll,
        defenseRoll: normalizedDefenseRoll,
        damageApplied,
        baseDamageApplied,
        secondaryDamageApplied,
        secondaryEffects: triggeredModifierEffects,
        hitPointUpdate,
        currentCriticalPoints: criticalPoints, // sum, for the informational result card
        attackerCriticalPoints,
        defenderCriticalPoints,
        appliedModifiers,
        defenseModifiers,
        defenseFollowUpState,
        defenderPostOptions,
        attackerPostOptions,
        events: {
            damageWindow,
            commitEvent,
            postManeuverWindowEvents,
        },
        pendingPostManeuverWindows,
    };
}

// Pure data half of the post-maneuver window. The orchestrator wraps
// each entry with closure callbacks (commitPostManeuver / passPostManeuver)
// that reference the orchestrator's own commitPostManeuver wrapper.
function buildPostManeuverWindowData({
    side,
    actor,
    target,
    pendingAttack,
    currentCriticalPoints,
    legalPostManeuvers,
    selectedPostManeuver = null,
    actorConditions = [],
    targetConditions = [],
} = {}) {
    return {
        id: `post-${side}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        side,
        actor,
        target,
        pendingAttack,
        currentCriticalPoints,
        legalPostManeuvers: Array.isArray(legalPostManeuvers) ? legalPostManeuvers : [],
        selectedPostManeuver: normalizeManeuver(selectedPostManeuver),
        actorConditions,
        targetConditions,
    };
}
