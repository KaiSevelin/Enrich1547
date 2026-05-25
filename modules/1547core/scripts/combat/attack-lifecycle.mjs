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
    resolveSelectedWeaponProfile,
} from "./normalisation.mjs";
import { resolveLoadedAmmoForAttack } from "./ammo-state.mjs";
import { getLegalManeuvers, evaluateManeuverLegality } from "./maneuver-legality.mjs";

const MODULE_ID = "1547core";
const SOURCE_FLAG_SCOPE = "1547Core";

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
