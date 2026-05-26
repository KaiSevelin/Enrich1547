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
    PENDING_ATTACK_KIND,
} from "./attack-lifecycle.mjs";
import { resolveSelectedWeaponProfile, normalizeManeuver } from "./normalisation.mjs";
import { planConsumePersistentEffect } from "./persistent-effects.mjs";
import { planConsumeLoadedAmmo } from "./ammo-state.mjs";
import { planApplyDamage, getActorCurrentHitPoints } from "./hp-state.mjs";
import { resolveThreatReactionActor } from "./reaction-candidates.mjs";
import { getLegalManeuvers } from "./maneuver-legality.mjs";
import { COMBAT_EVENTS } from "../services/combat-events.js";

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

    return declareAttackPhased({
        actor,
        target,
        targets: [target],
        weapon: weapon.itemDocument ?? weapon,
        profile,
        forceSafeAttack: true,
        extraEffectData: effect,
        generatedByReaction:
            reaction.generatedByPersistentEffect
            ?? reaction.sourceManeuverName
            ?? reaction.name
            ?? "reaction",
        distanceSquares: Number.isFinite(distanceSquares) ? distanceSquares : null,
        actorConditions: sourcePayload.actorConditions,
        targetConditions: sourcePayload.targetConditions,
        normalizeWeapon: deps.normalizeWeapon,
        buildAttackReactionCandidates: deps.buildAttackReactionCandidates,
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

    return declareAttackPhased({
        actor: defender,
        target: attacker,
        targets: [attacker],
        weapon: reactionWeapon.itemDocument ?? reactionWeapon,
        profile: reactionProfile,
        forceSafeAttack: true,
        extraEffectData: { createFreeSafeCounterattack: true },
        generatedByReaction:
            currentDamageTakenReaction?.name
            ?? defenseReaction?.name
            ?? "safe-counterattack",
        distanceSquares: Number.isFinite(distanceSquares) ? distanceSquares : null,
        actorConditions: pendingAttack?.metadata?.targetConditions,
        targetConditions: pendingAttack?.metadata?.actorConditions,
        normalizeWeapon,
        buildAttackReactionCandidates,
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
    currentCriticalPoints = null,
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
    const damageApplied = Math.max(
        0,
        normalizedAttackRoll.damage - normalizedDefenseRoll.protection - defenseModifiers.reduceDamageTaken
    );

    // ── Phase 1: HP + status patches (when there's damage) ──
    let hitPointUpdate;
    if (damageApplied > 0) {
        const { patches: hpPatches, result: hpResult } = planApplyDamage(pendingAttack.target, damageApplied);
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

    const criticalPoints =
        currentCriticalPoints
        ?? Math.max(0, normalizedAttackRoll.crit) + Math.max(0, normalizedDefenseRoll.crit);

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
        currentCriticalPoints: criticalPoints,
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
        currentCriticalPoints: criticalPoints,
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
            currentCriticalPoints: criticalPoints,
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
            currentCriticalPoints: criticalPoints,
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

    // ── Phase N+2: ACTION_COMMITTED ──
    const { response: commitEvent } = await run({
        phase: "actionCommitted",
        event: {
            type: COMBAT_EVENTS.ACTION_COMMITTED,
            payload: {
                type: "attack",
                pendingAttack,
                damageApplied,
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
        hitPointUpdate,
        currentCriticalPoints: criticalPoints,
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
