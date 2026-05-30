/**
 * combat/attack-lifecycle.mjs
 *
 * Pure helpers that drive the attack-lifecycle compute paths in
 * combat-resolver-service. The orchestrator imports these to assemble
 * PendingAttack / PendingMove descriptors and to interpret roll
 * summaries.
 *
 * Pass A (this round): the self-contained pure helpers — modifier
 * summarisation/merging, reaction-resolution detection, roll-summary
 * normalisation, post-maneuver window payload construction.
 *
 * Pass B (planned): the lifecycle functions themselves
 * (buildPendingAttack, resolveAttackOutcome, executeResolvedReaction,
 * commitFullTurnManeuver, ...) will move here and return
 * `{ events, patches, descriptor/result }` so the orchestrator shrinks
 * to a patch dispatcher + event emitter.
 *
 * No game.*, no Hooks, no async. Imports from sibling pure modules
 * only.
 */

import {
    isTruthyLike,
    normalizeManeuver,
    normalizeWeaponModifier,
    resolveSelectedWeaponProfile,
} from "./normalisation.mjs";
import { resolveLoadedAmmoForAttack } from "./ammo-state.mjs";
import { getLegalManeuvers, evaluateManeuverLegality } from "./maneuver-legality.mjs";
import {
    buildCommittedManeuverRecord,
    planSpendActorManeuverCost,
    planAppendCommittedManeuverState,
} from "./maneuver-state.mjs";
// COMBAT_EVENTS is a pure enum — importing it doesn't drag in any
// Foundry deps. The orchestrator does the actual emitCombatEvent call.
import { COMBAT_EVENTS } from "../services/combat-events.js";

const MODULE_ID_LOWER = "1547core";

const MODULE_ID = "1547core";
const SOURCE_FLAG_SCOPE = "1547Core";

function resolveAttachedWeaponModifiers({ actor, parentItem, attachedModifierIds = [] } = {}) {
    const parentId = parentItem?.id ?? parentItem?._id ?? null;
    const actorItems = actor?.items;
    const parentItems = parentItem?.parent?.items;

    // Two sources of truth (this round): the legacy `attachedModifierIds`
    // flag AND modifiers whose `system.container` points at this weapon/ammo
    // (CSB sets that when a modifier is dropped into the itemContainer
    // component on the parent's sheet). Union + dedupe so combat sees a
    // modifier attached via either path.
    const ids = new Set();
    if (Array.isArray(attachedModifierIds)) {
        for (const id of attachedModifierIds) {
            const trimmed = String(id ?? "").trim();
            if (trimmed) ids.add(trimmed);
        }
    }
    if (parentId) {
        const itemsList = actorItems?.contents ?? Array.from(actorItems ?? []);
        for (const candidate of itemsList) {
            if (String(candidate?.system?.container ?? "").trim() !== parentId) continue;
            const id = String(candidate.id ?? candidate._id ?? "").trim();
            if (id) ids.add(id);
        }
    }
    if (!ids.size) return [];

    return Array.from(ids)
        .map((modifierId) => {
            const modifierDoc = actorItems?.get?.(modifierId)
                ?? parentItems?.get?.(modifierId)
                ?? null;
            const normalized = normalizeWeaponModifier(modifierDoc);
            if (!normalized) return null;
            return {
                ...normalized,
                attachedToItemId: parentId,
            };
        })
        .filter(Boolean);
}

// ────────────────────────────────────────────────── Modifier summarisation ──

export function createsSafeAttack(maneuver) {
    const effect = maneuver?.effectData ?? {};
    return Boolean(
        effect.createFreeSafeAttack ||
        effect.createSecondSafeAttack ||
        effect.createFreeSafeCounterattack ||
        effect.ifEscapeSucceedsCreateFreeSafeAttack
    );
}

export function summarizeEffectData(effect = {}) {
    return {
        addMainDice: Number(effect?.addMainDice ?? 0) || 0,
        addDisadvantage: Number(effect?.addDisadvantage ?? 0) || 0,
        addMultiplierDice: Number(effect?.addMultiplierDice ?? 0) || 0,
        addRiskDice: Number(effect?.addRiskDice ?? 0) || 0,
        addMoveSquares: Number(effect?.addMoveSquares ?? 0) || 0,
        safeAttack: Boolean(
            effect?.createFreeSafeAttack ||
            effect?.createSecondSafeAttack ||
            effect?.createFreeSafeCounterattack ||
            effect?.ifEscapeSucceedsCreateFreeSafeAttack
        ),
    };
}

export function mergeModifierSummaries(baseSummary = {}, extraSummary = {}) {
    return {
        addMainDice: Number(baseSummary.addMainDice ?? 0) + Number(extraSummary.addMainDice ?? 0),
        addDisadvantage: Number(baseSummary.addDisadvantage ?? 0) + Number(extraSummary.addDisadvantage ?? 0),
        addMultiplierDice: Number(baseSummary.addMultiplierDice ?? 0) + Number(extraSummary.addMultiplierDice ?? 0),
        addRiskDice: Number(baseSummary.addRiskDice ?? 0) + Number(extraSummary.addRiskDice ?? 0),
        addMoveSquares: Number(baseSummary.addMoveSquares ?? 0) + Number(extraSummary.addMoveSquares ?? 0),
        safeAttack: Boolean(baseSummary.safeAttack || extraSummary.safeAttack),
    };
}

export function mergeManeuverEffects(maneuvers) {
    return maneuvers.reduce(
        (summary, maneuver) => {
            const effect = maneuver?.effectData ?? {};
            summary.addMainDice += Number(effect.addMainDice ?? 0);
            summary.addDisadvantage += Number(effect.addDisadvantage ?? 0);
            summary.addMultiplierDice += Number(effect.addMultiplierDice ?? 0);
            summary.addRiskDice += Number(effect.addRiskDice ?? 0);
            summary.addMoveSquares += Number(effect.addMoveSquares ?? 0);
            summary.safeAttack = summary.safeAttack || createsSafeAttack(maneuver);
            return summary;
        },
        {
            addMainDice: 0,
            addDisadvantage: 0,
            addMultiplierDice: 0,
            addRiskDice: 0,
            addMoveSquares: 0,
            safeAttack: false,
        }
    );
}

export function normalizeDefenseModifiers({ defenseReaction = null, damageTakenReaction = null } = {}) {
    const sources = [defenseReaction, damageTakenReaction].filter(Boolean);
    return sources.reduce((summary, source) => {
        const effect = source?.effectData ?? {};
        summary.addArmorDice += Number(effect.addArmorDice ?? 0) || 0;
        summary.reduceDamageTaken += Number(effect.reduceDamageTaken ?? 0) || 0;
        summary.lockParryingWeaponUntil = summary.lockParryingWeaponUntil
            || String(effect.lockParryingWeaponUntil ?? "").trim()
            || null;
        summary.safeCounterattack = summary.safeCounterattack || Boolean(effect.createFreeSafeCounterattack);
        return summary;
    }, {
        addArmorDice: 0,
        reduceDamageTaken: 0,
        lockParryingWeaponUntil: null,
        safeCounterattack: false,
    });
}

export function normalizeAppliedAttackModifiers(modifiers = {}) {
    return {
        addMainDice: Number(modifiers?.addMainDice ?? 0) || 0,
        addDisadvantage: Number(modifiers?.addDisadvantage ?? 0) || 0,
        addMultiplierDice: Number(modifiers?.addMultiplierDice ?? 0) || 0,
        addRiskDice: Number(modifiers?.addRiskDice ?? 0) || 0,
        addMoveSquares: Number(modifiers?.addMoveSquares ?? 0) || 0,
        safeAttack: Boolean(modifiers?.safeAttack),
    };
}

// ─────────────────────────────────────────────────── Reserved-cost gathering ──

export function collectReservedCosts(maneuvers) {
    return maneuvers
        .filter((maneuver) => maneuver?.CostType && maneuver.CostType !== "null")
        .map((maneuver) => ({
            maneuverId: maneuver._id ?? maneuver.id ?? maneuver.name,
            costType: maneuver.CostType,
            costAmount: Number(maneuver.CostAmount ?? 0),
        }));
}

// ───────────────────────────────────────────────────── Roll-summary helpers ──

export function normalizeRollSummary(roll) {
    const summary = roll ?? {};
    return {
        damage: Number(summary.damage ?? 0),
        protection: Number(summary.protection ?? 0),
        crit: Number(summary.crit ?? 0),
        fumble: Number(summary.fumble ?? 0),
        multiplier: Number(summary.multiplier ?? 1),
    };
}

/**
 * Apply the roll's multiplier to damage / protection / crit. Returns
 * the input unchanged when multiplier is missing or non-positive.
 * (Note: differs from a naïve `damage *= multiplier` — protection and
 * crit also scale.)
 */
export function applyMultiplier(roll) {
    const multiplier = Number.isFinite(roll?.multiplier) && roll.multiplier > 0
        ? roll.multiplier
        : 1;
    return {
        ...roll,
        damage: (roll?.damage ?? 0) * multiplier,
        protection: (roll?.protection ?? 0) * multiplier,
        crit: (roll?.crit ?? 0) * multiplier,
    };
}

/**
 * Walk an emitted event's `results` array and return the first entry
 * whose value carries a `reaction` or `trigger` flag. Used to detect
 * that a reaction-service handler claimed the event.
 */
export function findReactionResolution(event) {
    return event?.results?.find(
        (entry) => entry?.value?.reaction || entry?.value?.trigger
    )?.value ?? null;
}

// ──────────────────────────────────────────────────────── Pending-attack tag ──

export const PENDING_ATTACK_KIND = "1547core.pendingAttack";

export function isPendingAttack(value) {
    return value?.kind === PENDING_ATTACK_KIND;
}

// ─────────────────────────────────────────────── Pending-attack / move builders ──
//
// Both are pure: no async, no mutation, no event emission. They DO accept
// two injected dependencies (per Fork 1A live-doc descriptors + the
// orchestrator owning the unarmed-weapon fallback):
//
//   normalizeWeapon(weapon, actor)              -> normalized weapon (with
//                                                  unarmed default when needed)
//   buildAttackReactionCandidates({ attacker, defender, pendingWeapon,
//                                   pendingProfile, context })
//                                              -> reaction candidate list
//
// The orchestrator's combat-resolver-service.js wraps these and injects
// its own normalize-with-fallback + reaction-candidate resolver.

export function buildPendingAttack({
    actor,
    target = null,
    targets = null,
    weapon,
    profileId = null,
    profile = null,
    selectedPreManeuvers = [],
    forceSafeAttack = false,
    extraEffectData = null,
    generatedByReaction = null,
    normalizeWeapon,
    buildAttackReactionCandidates,
    ...context
} = {}) {
    if (!actor) throw new Error("Missing actor.");
    if (typeof normalizeWeapon !== "function") throw new Error("buildPendingAttack: missing normalizeWeapon dep.");
    if (typeof buildAttackReactionCandidates !== "function") throw new Error("buildPendingAttack: missing buildAttackReactionCandidates dep.");

    const normalizedWeapon = normalizeWeapon(weapon, actor);
    if (!normalizedWeapon) throw new Error("Missing weapon.");

    const selectedProfile = resolveSelectedWeaponProfile(normalizedWeapon, { profile, profileId });
    if (!selectedProfile) {
        throw new Error(`${normalizedWeapon.name} does not have a legal attack profile.`);
    }

    const ammoState = resolveLoadedAmmoForAttack({
        actor,
        weapon: normalizedWeapon,
        profile: selectedProfile,
    });
    const weaponModifiers = resolveAttachedWeaponModifiers({
        actor,
        parentItem: normalizedWeapon.itemDocument ?? weapon ?? null,
        attachedModifierIds: normalizedWeapon.attachedModifierIds,
    });
    const ammoModifiers = resolveAttachedWeaponModifiers({
        actor,
        parentItem: ammoState.loadedAmmo?.itemDocument ?? null,
        attachedModifierIds: ammoState.loadedAmmo?.attachedModifierIds,
    });

    const legalPreManeuvers = getLegalManeuvers({
        actor,
        weapon: normalizedWeapon,
        profile: selectedProfile,
        target,
        targets,
        timingType: "pre",
        triggerType: "attack-declared",
        ...context,
    });

    const selected = selectedPreManeuvers
        .map(normalizeManeuver)
        .filter(Boolean);
    const extraModifiers = summarizeEffectData(extraEffectData);

    const selectedEvaluations = selected.map((maneuver) =>
        evaluateManeuverLegality(maneuver, {
            actor,
            weapon: normalizedWeapon,
            profile: selectedProfile,
            target,
            targets,
            timingType: "pre",
            triggerType: "attack-declared",
            ...context,
        })
    );

    const illegalSelections = selectedEvaluations.filter((entry) => !entry.legal);
    if (illegalSelections.length) {
        const summary = illegalSelections
            .map((entry) => `${entry.maneuver?.name}: ${entry.reasons.join(" ")}`)
            .join("; ");
        throw new Error(`Illegal pre-maneuver selection. ${summary}`);
    }

    return {
        kind: PENDING_ATTACK_KIND,
        actor,
        target,
        targets: Array.isArray(targets) && targets.length ? targets : [target].filter(Boolean),
        weapon: normalizedWeapon,
        profile: selectedProfile,
        loadedAmmo: ammoState.loadedAmmo,
        weaponModifiers,
        ammoModifiers,
        attackModifiers: [...weaponModifiers, ...ammoModifiers],
        triggerType: "attack-declared",
        safeAttack:
            selected.some((maneuver) => createsSafeAttack(maneuver))
            || forceSafeAttack
            || extraModifiers.safeAttack,
        selectedPreManeuvers: selected,
        legalPreManeuvers,
        reactionCandidates: buildAttackReactionCandidates({
            attacker: actor,
            defender: target,
            pendingWeapon: normalizedWeapon,
            pendingProfile: selectedProfile,
            context,
        }),
        reservedCosts: collectReservedCosts(selected),
        mergedModifiers: mergeModifierSummaries(mergeManeuverEffects(selected), extraModifiers),
        metadata: {
            ...context,
            generatedByReaction,
        },
        committed: false,
    };
}

export function buildPendingMove({
    actor,
    path = [],
    selectedPreManeuvers = [],
    forceSafeAttack = false,
    extraEffectData = null,
    generatedByReaction = null,
    ...context
} = {}) {
    if (!actor) throw new Error("Missing actor.");

    const selected = selectedPreManeuvers
        .map(normalizeManeuver)
        .filter(Boolean);
    const extraModifiers = summarizeEffectData(extraEffectData);

    const selectedEvaluations = selected.map((maneuver) =>
        evaluateManeuverLegality(maneuver, {
            actor,
            timingType: "pre",
            triggerType: "move-declared",
            ...context,
        })
    );

    const illegalSelections = selectedEvaluations.filter((entry) => !entry.legal);
    if (illegalSelections.length) {
        const summary = illegalSelections
            .map((entry) => `${entry.maneuver?.name}: ${entry.reasons.join(" ")}`)
            .join("; ");
        throw new Error(`Illegal movement pre-maneuver selection. ${summary}`);
    }

    return {
        actor,
        path: Array.isArray(path) ? path : [],
        triggerType: "move-declared",
        selectedPreManeuvers: selected,
        reservedCosts: collectReservedCosts(selected),
        mergedModifiers: mergeModifierSummaries(mergeManeuverEffects(selected), extraModifiers),
        metadata: {
            ...context,
            generatedByReaction,
        },
        committed: false,
    };
}

// ─────────────────────────────────────────────────────────── Misc actor probes ──

/**
 * Pure check: does this actor have any equipped armor item?
 * Walks `actor.items` and matches via either CSB sourceData itemType,
 * the armor template id, item.type, or known prop keys (ArmorType /
 * Defense). Used by defense-resolution to decide whether to substitute
 * the unprotected-armor fallback.
 */
export function actorHasEquippedArmor(actor) {
    const items = actor?.items?.contents ?? actor?.items ?? [];
    return Array.from(items).some((item) => {
        const props = item?.system?.props ?? {};
        const sourceData =
            item?.flags?.[SOURCE_FLAG_SCOPE]?.sourceData
            ?? item?.flags?.[MODULE_ID]?.sourceData
            ?? {};
        const isArmor =
            sourceData?.itemType === "armor"
            || item?.system?.template === "uLlgZXz3GlXPFtsj"
            || item?.type === "armor"
            || Object.prototype.hasOwnProperty.call(props, "ArmorType")
            || Object.prototype.hasOwnProperty.call(props, "Defense");
        const equipped = isTruthyLike(props?.Equipped) || sourceData?.equipped === true;
        return isArmor && equipped;
    });
}

// ─────────────────────────────────────────── Defense follow-up state ──

/**
 * Compute the actor.update patch needed to record any defense-reaction
 * follow-up state (currently: parrying-weapon lock). Returns
 * `{ patches: [], result: {} }` when there's nothing to record.
 */
export function planApplyDefenseFollowUpState(pendingAttack, defenseModifiers) {
    const defender = pendingAttack?.target ?? null;
    if (!defender?.id) return { patches: [], result: {} };

    const lockedUntil = String(defenseModifiers?.lockParryingWeaponUntil ?? "").trim();
    if (!lockedUntil) return { patches: [], result: {} };

    return {
        patches: [
            {
                kind: "actor.update",
                actorId: defender.id,
                data: {
                    [`flags.${MODULE_ID_LOWER}.defenseState`]: {
                        lockedParryingWeaponUntil: lockedUntil,
                        updatedAt: Date.now(),
                    },
                },
            },
        ],
        result: { lockedParryingWeaponUntil: lockedUntil },
    };
}

// ──────────────────────────────────────────── Maneuver commits ──
//
// The two commit* planners return `{ patches, events, result }`. Each
// emits a single ACTION_COMMITTED event at the end of the patches;
// the orchestrator wrapper applies patches first, then emits and
// attaches the response to `result.commitEvent`.

/**
 * Plan the patches + ACTION_COMMITTED event for a post-attack maneuver.
 * Throws on missing actor/maneuver/pendingAttack, or on legality
 * failure (preserves the original strict behaviour).
 */
export function planCommitPostManeuver({
    actor,
    maneuver,
    pendingAttack,
    side = "attacker",
    target = null,
    currentCriticalPoints = null,
    actorConditions = [],
    targetConditions = [],
} = {}) {
    const selectedManeuver = normalizeManeuver(maneuver);
    if (!actor) throw new Error("Missing actor.");
    if (!selectedManeuver) throw new Error("Missing maneuver.");
    if (!pendingAttack) throw new Error("Missing pending attack.");

    const evaluation = evaluateManeuverLegality(selectedManeuver, {
        actor,
        weapon: pendingAttack.weapon,
        profile: pendingAttack.profile,
        target,
        timingType: "post",
        triggerType: "post-attack",
        currentCriticalPoints,
        actorConditions,
        targetConditions,
    });

    if (!evaluation.legal) {
        throw new Error(evaluation.reasons?.[0] || "This post maneuver is not currently legal.");
    }

    const { patches: costPatches } = planSpendActorManeuverCost(actor, selectedManeuver);

    return {
        patches: costPatches,
        events: [
            {
                type: COMBAT_EVENTS.ACTION_COMMITTED,
                payload: {
                    type: "post-maneuver",
                    side,
                    actor,
                    target,
                    pendingAttack,
                    maneuver: selectedManeuver,
                    currentCriticalPoints,
                },
            },
        ],
        result: { maneuver: selectedManeuver },
    };
}

/**
 * Plan the patches + ACTION_COMMITTED event for a full-turn maneuver
 * commit. The DI'd normalizeWeapon dep is the orchestrator's
 * unarmed-fallback wrapper.
 */
export function planCommitFullTurnManeuver({
    actor,
    maneuver,
    weapon = null,
    profile = null,
    profileId = null,
    target = null,
    targets = null,
    reservedResources = {},
    usedManeuvers = [],
    hasVisibleAlly = false,
    actorConditions = [],
    targetConditions = [],
    distanceSquares = null,
    rangeSquares = null,
    currentCriticalPoints = null,
    metadata = {},
    normalizeWeapon,
} = {}) {
    const selectedManeuver = normalizeManeuver(maneuver);
    if (!actor) throw new Error("Missing actor.");
    if (!selectedManeuver) throw new Error("Missing maneuver.");
    if (typeof normalizeWeapon !== "function") {
        throw new Error("planCommitFullTurnManeuver: missing normalizeWeapon dep.");
    }

    const normalizedWeapon = normalizeWeapon(weapon, actor);
    const selectedProfile = resolveSelectedWeaponProfile(normalizedWeapon, {
        profile,
        profileId,
    });

    const evaluation = evaluateManeuverLegality(selectedManeuver, {
        actor,
        weapon: normalizedWeapon,
        profile: selectedProfile,
        target,
        targets,
        timingType: "full-turn",
        triggerType: "full-turn-activation",
        fullTurnAvailable: metadata.fullTurnAvailable,
        reservedResources,
        usedManeuvers,
        hasVisibleAlly,
        actorConditions,
        targetConditions,
        distanceSquares,
        rangeSquares,
        currentCriticalPoints,
    });

    if (!evaluation.legal) {
        throw new Error(evaluation.reasons?.[0] || "This full-turn maneuver is not currently legal.");
    }

    const { patches: costPatches } = planSpendActorManeuverCost(actor, selectedManeuver);
    const record = buildCommittedManeuverRecord(selectedManeuver);
    const { patches: appendPatches } = planAppendCommittedManeuverState(actor, record);

    const patches = [...costPatches];
    if (metadata.isCombatActive === true && actor?.id) {
        patches.push({
            kind: "actor.update",
            actorId: actor.id,
            data: { "system.props.FullTurnAvailable": false },
        });
    }
    patches.push(...appendPatches);

    return {
        patches,
        events: [
            {
                type: COMBAT_EVENTS.ACTION_COMMITTED,
                payload: {
                    type: "full-turn",
                    actor,
                    maneuver: selectedManeuver,
                    weapon: normalizedWeapon,
                    profile: selectedProfile,
                    target,
                    targets,
                    metadata,
                    record,
                },
            },
        ],
        result: { maneuver: selectedManeuver, record },
    };
}
