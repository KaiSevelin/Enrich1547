import { MODULE_ID, SOURCE_FLAG_SCOPE } from "../lib/constants.mjs";
﻿import {
    normalizeManeuver,
    normalizeWeapon,
    normalizeAmmoItem,
    normalizeArmor,
    isTruthyLike,
} from "./normalisation.mjs";

// firstFiniteNumber stays local here because it filters negative values
// (Number.isFinite && >= 0); combat/normalisation.mjs exports a variant
// without the non-negativity filter. Keep both to avoid a silent
// behaviour change in legality range checks.

const MANEUVER_DATA_SETTING = "maneuverData";

const WINDOW_TO_TIMING = {
    pre: "pre",
    reaction: "reaction",
    post: "post",
    "full-turn": "full-turn",
    move: "pre",
    attack: "pre",
};

const COST_RESOURCE_NAMES = {
    CorePoints: "Core",
    CriticalPoints: "Critical",
};

export function registerManeuverLegalityService() {
    const module = game.modules.get(MODULE_ID);
    if (!module) return;

    module.api = {
        ...(module.api ?? {}),
        combat: {
            ...(module.api?.combat ?? {}),
            evaluateManeuverLegality,
            getLegalManeuvers,
            getLearnedManeuvers,
            getStoredManeuverData,
        },
    };
}

export function getStoredManeuverData() {
    const stored = game.settings?.get?.(MODULE_ID, MANEUVER_DATA_SETTING);
    return Array.isArray(stored) ? stored : [];
}

export function getLearnedManeuvers(actor, { fallbackToStored = false } = {}) {
    if (actor?.items?.size) {
        const learned = actor.items.contents
            .map(normalizeManeuver)
            .filter((maneuver) => maneuver?.folder === "Maneuvers");

        if (learned.length || !fallbackToStored) {
            return learned;
        }
    }

    return fallbackToStored ? getStoredManeuverData() : [];
}

export function getLegalManeuvers({
    actor = null,
    maneuvers = null,
    includeReasons = false,
    ...context
} = {}) {
    const learned = Array.isArray(maneuvers)
        ? maneuvers.map(normalizeManeuver).filter(Boolean)
        : getLearnedManeuvers(actor, { fallbackToStored: !actor });

    const evaluations = learned.map((maneuver) =>
        evaluateManeuverLegality(maneuver, { actor, ...context })
    );

    if (includeReasons) return evaluations;
    return evaluations.filter((entry) => entry.legal).map((entry) => entry.maneuver);
}

// The legality gate set, in evaluation order, declared in one place. Each gate is
// `(maneuver, context) => reason | null` — return a reason string to block, or
// null to pass. To add or reorder a gate, edit this table; the runner below is
// generic. Philosophy: gates GUIDE rather than FORCE — when an input needed to
// evaluate a gate is absent/unknown (a "grey area"), the gate PASSES and leaves
// the call to the table; it only blocks on a positively-known violation. (Rules
// are not an exact science — the GM may always allow an edge case.)
const LEGALITY_GATES = [
    (m, c) => { const t = normalizeTimingContext(c); return (t && m.type !== t) ? `Timing mismatch: expected ${m.type}, got ${t}.` : null; },
    (m, c) => matchesTrigger(m, c.triggerType) ? null : `Trigger mismatch: ${c.triggerType ?? "none"}.`,
    (m, c) => passesUsageLimit(m, c) ? null : "Usage limit reached.",
    (m, c) => passesActionEconomyGate(m, c) ? null : "Action economy does not allow this maneuver.",
    (m, c) => passesActorStateGate(m, c) ? null : "Actor state does not allow this maneuver.",
    (m, c) => getDefenseFollowUpBlockReason(m, c) || null,
    (m, c) => passesWeaponGate(m, c) ? null : "Current weapon does not allow this maneuver.",
    (m, c) => passesProfileGate(m, c) ? null : "Current weapon profile does not satisfy maneuver requirements.",
    (m, c) => passesRangeGate(m, c) ? null : "Current range does not satisfy maneuver requirements.",
    (m, c) => passesTargetStateGate(m, c) ? null : "Target state does not satisfy maneuver requirements.",
    (m, c) => passesResourceGate(m, c) ? null : "Required resources are not available.",
];

export function evaluateManeuverLegality(maneuverInput, context = {}) {
    const maneuver = normalizeManeuver(maneuverInput);
    if (!maneuver) {
        return { legal: false, maneuver: null, reasons: ["Missing maneuver."] };
    }

    const reasons = [];
    for (const gate of LEGALITY_GATES) {
        const reason = gate(maneuver, context);
        if (reason) reasons.push(reason);
    }

    return {
        legal: reasons.length === 0,
        maneuver,
        reasons,
    };
}

function normalizeTimingContext(context) {
    const explicit = context.timingType ?? context.windowType ?? null;
    if (!explicit) return null;
    return WINDOW_TO_TIMING[explicit] ?? explicit;
}

function matchesTrigger(maneuver, triggerType) {
    if (!triggerType) return true;
    const acceptedTriggers = new Set([
        maneuver.triggerType,
        ...(Array.isArray(maneuver.requirements?.alternateTriggers)
            ? maneuver.requirements.alternateTriggers
            : []),
        ...(Array.isArray(maneuver.effectData?.alternateTriggers)
            ? maneuver.effectData.alternateTriggers
            : []),
    ].filter(Boolean));

    return acceptedTriggers.has(triggerType);
}

function passesUsageLimit(maneuver, context) {
    const used = new Set(
        (context.usedManeuvers ?? []).map((entry) =>
            typeof entry === "string" ? entry : entry?._id ?? entry?.id ?? entry?.name
        )
    );

    return !used.has(maneuver._id) && !used.has(maneuver.id) && !used.has(maneuver.name);
}

function passesActionEconomyGate(maneuver, context) {
    const movementBudgetRemaining = context.movementBudgetRemaining;
    const attacksRemaining = context.attacksRemaining;
    if (maneuver.type === "full-turn" && context.fullTurnAvailable === false) {
        return false;
    }

    if (
        maneuver.triggerType === "move-declared" &&
        movementBudgetRemaining !== null &&
        movementBudgetRemaining !== undefined &&
        movementBudgetRemaining !== "" &&
        Number.isFinite(Number(movementBudgetRemaining)) &&
        Number(movementBudgetRemaining) <= 0
    ) {
        return false;
    }

    if (
        maneuver.triggerType === "attack-declared" &&
        attacksRemaining !== null &&
        attacksRemaining !== undefined &&
        attacksRemaining !== "" &&
        Number.isFinite(Number(attacksRemaining)) &&
        Number(attacksRemaining) <= 0
    ) {
        return false;
    }

    return true;
}

// All actor-state requirements are read from STRUCTURED fields (schema-spec:
// structured fields are canonical; `requirements.text` is display-only). Geometry
// flags (hasVisibleAlly, …) block only when the caller positively computed them
// false — an absent flag is a grey area and passes (guide, don't force).
function passesActorStateGate(maneuver, context) {
    const actorConditions = toNameSet(context.actorConditions);
    const req = maneuver.requirements ?? {};
    const requiredActorConditions = toNameSet(req.requiredActorConditions);
    const prohibitedActorConditions = toNameSet(req.prohibitedActorConditions);

    if (requiredActorConditions.size && ![...requiredActorConditions].every((condition) => actorConditions.has(condition))) {
        return false;
    }

    if (prohibitedActorConditions.size && [...prohibitedActorConditions].some((condition) => actorConditions.has(condition))) {
        return false;
    }

    if (req.requiresHidden && !actorConditions.has("hidden")) return false;
    if (req.requiresMounted && !actorConditions.has("mounted")) return false;
    if (req.requiresUnmounted && actorConditions.has("mounted")) return false;
    if (req.requiresVisibleAlly && context.hasVisibleAlly === false) return false;

    // Armor-class exclusion (e.g. Evade is barred in medium+ armour).
    const prohibitedArmorClasses = toNameSet(req.prohibitedArmorClasses);
    if (prohibitedArmorClasses.size) {
        const armorClass = getEquippedArmorState(context).armorClass;
        if (armorClass && prohibitedArmorClasses.has(normalizeName(armorClass))) return false;
    }

    return true;
}

function getActorDefenseState(actor) {
    return actor?.flags?.[MODULE_ID]?.defenseState ?? {};
}

function isDefenseStateActive(actor, defenseState = {}) {
    const lockUntil = String(defenseState?.lockedParryingWeaponUntil ?? "").trim();
    if (!lockUntil) return false;

    if (lockUntil === "current-side-activation-end" || lockUntil === "until-side-active-again") {
        const fullTurnAvailable = actor?.system?.props?.FullTurnAvailable;
        if (isTruthyLike(fullTurnAvailable)) {
            return false;
        }
    }

    return true;
}

function maneuverUsesParryingWeapon(maneuver, context) {
    const requiredTraits = asArray(maneuver?.requirements?.requiredWeaponTraits);
    const requiredGroups = asArray(maneuver?.requirements?.requiredWeaponGroups);
    const maneuverTags = asArray(maneuver?.tags);
    const maneuverTraits = asArray(maneuver?.requirements?.traits);

    return [requiredTraits, requiredGroups, maneuverTags, maneuverTraits]
        .flat()
        .some((entry) => normalizeName(entry) === "parrying");
}

function getDefenseFollowUpBlockReason(maneuver, context) {
    const defenseState = getActorDefenseState(context.actor);
    if (!isDefenseStateActive(context.actor, defenseState)) return "";
    if (!maneuverUsesParryingWeapon(maneuver, context)) return "";

    const lockUntil = String(defenseState?.lockedParryingWeaponUntil ?? "").trim();
    if (lockUntil === "current-side-activation-end" || lockUntil === "until-side-active-again") {
        return "Parrying weapon is locked until your side is active again.";
    }

    return "Parrying weapon is currently locked.";
}
function passesWeaponGate(maneuver, context) {
    const weapon = normalizeWeapon(context.weapon, context.actor);
    const requiredTraits = asArray(maneuver.requirements?.requiredWeaponTraits);
    const requiredGroups = asArray(maneuver.requirements?.requiredWeaponGroups);
    const excludedTags = asArray(maneuver.requirements?.excludedWeaponTags);

    if ((requiredTraits.length || requiredGroups.length) && !weapon) {
        return false;
    }

    const weaponTraits = toNameSet(weapon?.traits);
    const weaponGroups = toNameSet(weapon?.groups);

    if (requiredTraits.length && !requiredTraits.some((trait) => weaponTraits.has(normalizeName(trait)))) {
        return false;
    }

    if (requiredGroups.length && !requiredGroups.some((group) => weaponGroups.has(normalizeName(group)))) {
        return false;
    }

    if (
        excludedTags.length &&
        excludedTags.some(
            (tag) => weaponTraits.has(normalizeName(tag)) || weaponGroups.has(normalizeName(tag))
        )
    ) {
        return false;
    }

    return true;
}

function isRangedAttackType(attackType) {
    return attackType === "ranged";
}

function isDistanceAttackType(attackType) {
    return attackType === "ranged" || attackType === "thrown";
}

function passesProfileGate(maneuver, context) {
    const profile = context.profile ?? null;
    const appliesTo = maneuver.effectData?.appliesTo ?? null;
    if (!appliesTo) return true;
    // No profile to check against is a grey area — guide, don't force. (Matches the
    // weapon/range gates, which also pass when their input is absent.)
    if (!profile) return true;

    if (appliesTo === "melee-attack") {
        return profile.attackType === "melee";
    }

    if (appliesTo === "ranged-attack") {
        return isRangedAttackType(profile.attackType);
    }

    return true;
}

// Target-state requirements from STRUCTURED fields only. Conditions (locked, …)
// block when positively absent; ally-geometry flags block only when the caller
// computed them false (an absent flag is a grey area → pass and let the GM
// adjudicate the positioning).
function passesTargetStateGate(maneuver, context) {
    const targetConditions = toNameSet(context.targetConditions);
    const req = maneuver.requirements ?? {};
    const requiredTargetConditions = toNameSet(req.requiredTargetConditions);

    if (requiredTargetConditions.size && ![...requiredTargetConditions].every((condition) => targetConditions.has(condition))) {
        return false;
    }

    if (req.requiresTargetLocked && !targetConditions.has("locked")) return false;
    if (req.requiresAdjacentAllyTarget && context.hasAdjacentAllyTarget === false) return false;
    if (req.requiresFormationPartner && context.hasFormationPartner === false) return false;
    if (req.requiresFlankingAlly && context.hasFlankingAlly === false) return false;
    if (req.requiresPolearmAlly && context.hasPolearmAlly === false) return false;

    return true;
}

function passesRangeGate(maneuver, context) {
    const profile = context.profile ?? null;
    if (!profile || !isDistanceAttackType(profile.attackType)) return true;

    const distanceSquares = Number(context.distanceSquares ?? context.rangeSquares);
    if (!Number.isFinite(distanceSquares) || distanceSquares < 0) return true;

    const weapon = normalizeWeapon(context.weapon, context.actor);
    if (!weapon) return true;

    const shortRange = firstFiniteNumber([weapon.shortRange]);
    const longRange = firstFiniteNumber([weapon.longRange]);
    const maxRange = firstFiniteNumber([weapon.maxRange]);

    const useMaxRange = maneuver?.effectData?.useMaxRange === true || context.useMaxRange === true;
    const rangeBand = getRangeBand(distanceSquares, { shortRange, longRange, maxRange });

    if (rangeBand === "out") return false;
    if (rangeBand === "max") return useMaxRange;
    return true;
}

function getRangeBand(distanceSquares, { shortRange, longRange, maxRange }) {
    if (Number.isFinite(shortRange) && distanceSquares <= shortRange) return "short";
    if (Number.isFinite(longRange) && distanceSquares <= longRange) return "long";
    if (Number.isFinite(maxRange) && distanceSquares <= maxRange) return "max";
    return "out";
}

function passesResourceGate(maneuver, context) {
    const costType = maneuver.CostType ?? null;
    const costAmount = Number(maneuver.CostAmount ?? 0);
    if (!costType || costType === "null" || costAmount <= 0) return true;

    if (costType === "CriticalPoints") {
        const currentCriticalPoints = Number(context.currentCriticalPoints ?? 0);
        return currentCriticalPoints >= costAmount;
    }

    const actor = context.actor ?? null;
    if (!actor) return true;

    const resourceName = COST_RESOURCE_NAMES[costType];
    if (!resourceName) return true;

    const props = actor.system?.props ?? {};
    const totalCandidates = [
        props[`Max${resourceName}Points`],
        props[`${resourceName}Points`],
        props[`${resourceName}PointsMax`],
        props[`${resourceName}MaxPoints`],
        props[`${resourceName}Pool`],
        props[`${resourceName}PoolMax`],
    ];

    const spentCandidates = [
        props[`Spent${resourceName}Points`],
        props[`Reserved${resourceName}Points`],
    ];

    const total = firstFiniteNumber(totalCandidates);
    if (total == null) return true;

    const committed = spentCandidates.reduce(
        (sum, value) => sum + (Number.isFinite(Number(value)) ? Number(value) : 0),
        0
    );

    const reservedResources = context.reservedResources ?? {};
    const selectedIds = new Set(context.selectedManeuverIds ?? []);
    const maneuverId = maneuver._id ?? maneuver.id ?? maneuver.name;
    const reserved = Math.max(0, Number(reservedResources[costType] ?? 0) || 0);
    const ownReserved = selectedIds.has(maneuverId) ? costAmount : 0;
    const effectiveReserved = Math.max(0, reserved - ownReserved);

    return Math.max(0, total - committed - effectiveReserved) >= costAmount;
}

function getEquippedArmorState(context) {
    const armors = Array.isArray(context.armors)
        ? context.armors.map(normalizeArmor)
        : getActorArmors(context.actor);

    const equipped = armors.find((armor) => armor?.equipped) ?? null;
    return {
        armorClass: equipped?.armorClass ?? null,
        traits: toNameSet(equipped?.traits),
    };
}

function getActorArmors(actor) {
    if (!actor?.items?.size) return [];
    return actor.items.contents
        .filter((item) => {
            const source = item.flags?.[SOURCE_FLAG_SCOPE]?.sourceData ?? item.flags?.[MODULE_ID]?.sourceData;
            return source?.itemType === "armor" || source?.folder === "Armor";
        })
        .map(normalizeArmor);
}

function toNameSet(values) {
    return new Set(asArray(values).map(normalizeName));
}

function normalizeName(value) {
    return String(value ?? "").trim().toLowerCase();
}

function asArray(value) {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (value == null || value === "") return [];
    return [value];
}

function firstFiniteNumber(values) {
    for (const value of values) {
        const numeric = Number(value);
        if (Number.isFinite(numeric) && numeric >= 0) return numeric;
    }
    return null;
}





