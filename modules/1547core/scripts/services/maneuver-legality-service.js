const MODULE_ID = "1547core";
const SOURCE_FLAG_SCOPE = "1547Core";
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
    StrengthPoints: "Strength",
    StaminaPoints: "Stamina",
    DexterityPoints: "Dexterity",
    CharismaPoints: "Charisma",
    IntelligencePoints: "Intelligence",
    FaithPoints: "Faith",
    PowerPoints: "Power",
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

export function evaluateManeuverLegality(maneuverInput, context = {}) {
    const maneuver = normalizeManeuver(maneuverInput);
    const reasons = [];

    if (!maneuver) {
        return { legal: false, maneuver: null, reasons: ["Missing maneuver."] };
    }

    const timing = normalizeTimingContext(context);
    if (timing && maneuver.type !== timing) {
        reasons.push(`Timing mismatch: expected ${maneuver.type}, got ${timing}.`);
    }

    if (!matchesTrigger(maneuver, context.triggerType)) {
        reasons.push(`Trigger mismatch: ${context.triggerType ?? "none"}.`);
    }

    if (!passesUsageLimit(maneuver, context)) {
        reasons.push("Usage limit reached.");
    }

    if (!passesActionEconomyGate(maneuver, context)) {
        reasons.push("Action economy does not allow this maneuver.");
    }

    if (!passesActorStateGate(maneuver, context)) {
        reasons.push("Actor state does not allow this maneuver.");
    }

    if (!passesWeaponGate(maneuver, context)) {
        reasons.push("Current weapon does not satisfy maneuver requirements.");
    }

    if (!passesProfileGate(maneuver, context)) {
        reasons.push("Current weapon profile does not satisfy maneuver requirements.");
    }

    if (!passesRangeGate(maneuver, context)) {
        reasons.push("Current range does not satisfy maneuver requirements.");
    }

    if (!passesTargetStateGate(maneuver, context)) {
        reasons.push("Target state does not satisfy maneuver requirements.");
    }

    if (!passesResourceGate(maneuver, context)) {
        reasons.push("Required resources are not available.");
    }

    return {
        legal: reasons.length === 0,
        maneuver,
        reasons,
    };
}

function normalizeManeuver(maneuver) {
    if (!maneuver) return null;
    return maneuver.flags?.[SOURCE_FLAG_SCOPE]?.sourceData ?? maneuver.flags?.[MODULE_ID]?.sourceData ?? maneuver;
}

function normalizeWeapon(weapon) {
    if (!weapon) return null;
    const source = weapon.flags?.[SOURCE_FLAG_SCOPE]?.sourceData ?? weapon.flags?.[MODULE_ID]?.sourceData ?? weapon;
    return {
        ...source,
        _id: source._id ?? weapon.id ?? weapon._id ?? null,
        name: source.name ?? weapon.name ?? "",
        traits: Array.isArray(source.traits) ? source.traits : [],
        groups: Array.isArray(source.groups) ? source.groups : [],
        attackProfiles: Array.isArray(source.attackProfiles) ? source.attackProfiles : [],
        shortRange:
            weapon.system?.props?.ShortRange ??
            weapon.shortRange ??
            source.shortRange ??
            null,
        longRange:
            weapon.system?.props?.LongRange ??
            weapon.longRange ??
            source.longRange ??
            null,
        maxRange:
            weapon.system?.props?.MaxRange ??
            weapon.maxRange ??
            source.maxRange ??
            null,
        equipped:
            weapon.system?.props?.Equipped ??
            weapon.equipped ??
            source.equipped ??
            false,
        ready:
            weapon.system?.props?.Ready ??
            weapon.ready ??
            source.ready ??
            false,
    };
}

function normalizeArmor(armor) {
    if (!armor) return null;
    const source = armor.flags?.[SOURCE_FLAG_SCOPE]?.sourceData ?? armor.flags?.[MODULE_ID]?.sourceData ?? armor;
    return {
        ...source,
        _id: source._id ?? armor.id ?? armor._id ?? null,
        name: source.name ?? armor.name ?? "",
        traits: Array.isArray(source.traits) ? source.traits : [],
        armorClass:
            armor.system?.props?.ArmorType ??
            source.armorClass ??
            null,
        equipped:
            armor.system?.props?.Equipped ??
            armor.equipped ??
            source.equipped ??
            false,
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
    if (maneuver.type === "full-turn" && context.fullTurnAvailable === false) {
        return false;
    }

    if (
        maneuver.triggerType === "move-declared" &&
        Number.isFinite(Number(context.movementBudgetRemaining)) &&
        Number(context.movementBudgetRemaining) <= 0
    ) {
        return false;
    }

    if (
        maneuver.triggerType === "attack-declared" &&
        Number.isFinite(Number(context.attacksRemaining)) &&
        Number(context.attacksRemaining) <= 0
    ) {
        return false;
    }

    return true;
}

function passesActorStateGate(maneuver, context) {
    const actorConditions = toNameSet(context.actorConditions);
    const armorState = getEquippedArmorState(context);
    const skillText = String(maneuver.requirements?.skill ?? "");
    const requirementText = String(maneuver.requirements?.text ?? "");

    if (skillText.includes("Subterfuge") && armorState.traits.has("Noisy")) {
        return false;
    }

    if (maneuver.name === "Evade") {
        if (["Medium", "Heavy", "Very Heavy", "VeryHeavy"].includes(armorState.armorClass)) {
            return false;
        }
        if (actorConditions.has("locked") || actorConditions.has("prone")) {
            return false;
        }
    }

    if (/\bhidden\b/i.test(requirementText) && !actorConditions.has("hidden")) {
        return false;
    }

    if (/\bmounted\b/i.test(requirementText) && !/\bunmounted\b/i.test(requirementText) && !actorConditions.has("mounted")) {
        return false;
    }

    if (/\bunmounted\b/i.test(requirementText) && actorConditions.has("mounted")) {
        return false;
    }

    if (/visible ally/i.test(requirementText) && context.hasVisibleAlly !== true) {
        return false;
    }

    return true;
}

function passesWeaponGate(maneuver, context) {
    const weapon = normalizeWeapon(context.weapon);
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

function passesProfileGate(maneuver, context) {
    const profile = context.profile ?? null;
    const appliesTo = maneuver.effectData?.appliesTo ?? null;
    if (!appliesTo) return true;
    if (!profile) return false;

    if (appliesTo === "melee-attack") {
        return profile.attackType === "melee";
    }

    if (appliesTo === "ranged-attack") {
        return profile.attackType === "ranged";
    }

    return true;
}

function passesTargetStateGate(maneuver, context) {
    const targetConditions = toNameSet(context.targetConditions);
    const requirementText = String(maneuver.requirements?.text ?? "");

    if (
        (maneuver.name === "Choke" || /target already locked/i.test(requirementText)) &&
        !targetConditions.has("locked")
    ) {
        return false;
    }

    if (/adjacent ally is the target/i.test(requirementText) && context.hasAdjacentAllyTarget !== true) {
        return false;
    }

    if (/adjacent ally also has access to formation/i.test(requirementText) && context.hasFormationPartner !== true) {
        return false;
    }

    if (/one ally also threatens the target from another side/i.test(requirementText) && context.hasFlankingAlly !== true) {
        return false;
    }

    if (/adjacent ally also wields a polearm or spear/i.test(requirementText) && context.hasPolearmAlly !== true) {
        return false;
    }

    return true;
}

function passesRangeGate(maneuver, context) {
    const profile = context.profile ?? null;
    if (!profile || profile.attackType !== "ranged") return true;

    const distanceSquares = Number(context.distanceSquares ?? context.rangeSquares);
    if (!Number.isFinite(distanceSquares) || distanceSquares < 0) return true;

    const weapon = normalizeWeapon(context.weapon);
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
        props[`${resourceName}Points`],
        props[`${resourceName}PointsMax`],
        props[`${resourceName}MaxPoints`],
        props[`${resourceName}Pool`],
        props[`${resourceName}PoolMax`],
    ];

    const spentCandidates = [
        props[`${resourceName}PointsSpent`],
        props[`${resourceName}PointsReserved`],
    ];

    const total = firstFiniteNumber(totalCandidates);
    if (total == null) return true;

    const committed = spentCandidates.reduce(
        (sum, value) => sum + (Number.isFinite(Number(value)) ? Number(value) : 0),
        0
    );

    return Math.max(0, total - committed) >= costAmount;
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
