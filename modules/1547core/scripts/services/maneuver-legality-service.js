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

const ACTIVE_ATTACK_PROFILE_KEYS = ["Attack", "AttackB", "AttackC"];

function hasUsableRangeBands(rangeBands = {}) {
    return [rangeBands.shortRange, rangeBands.longRange, rangeBands.maxRange]
        .some((value) => Number.isFinite(Number(value)) && Number(value) > 0);
}

function inferWeaponAttackType(source = {}, props = {}, sourceProfile = null) {
    const explicitType = String(sourceProfile?.attackType ?? "").trim().toLowerCase();
    if (explicitType) return explicitType;

    const groups = Array.isArray(source?.groups) ? source.groups.map((entry) => String(entry ?? "").trim().toLowerCase()) : [];
    const category = String(source?.category ?? props?.WeaponType ?? "").trim().toLowerCase();
    const usesAmmo = isTruthyLike(props?.UsesAmmo) || source?.usesAmmo === true;

    if (category === "thrown" || groups.includes("thrownweapon")) return "thrown";
    if (usesAmmo || groups.includes("rangedweapon") || ["bow", "crossbow", "firearm"].includes(category)) return "ranged";
    return "melee";
}

function buildAttackProfilesFromWeaponProps(source = {}, props = {}) {
    const sourceProfiles = Array.isArray(source?.attackProfiles) ? source.attackProfiles : [];
    return ACTIVE_ATTACK_PROFILE_KEYS.map((key, index) => {
        const formula = String(props?.[key] ?? "").trim();
        if (!formula) return null;
        const sourceProfile = sourceProfiles[index] ?? null;
        const allowedAmmoText = String(props?.[key + "Ammo"] ?? "").trim();
        return {
            id: sourceProfile?.id ?? (index === 0 ? "default" : key.toLowerCase()),
            name: sourceProfile?.name ?? (index === 0 ? "Default" : "Alternative " + index),
            attackType: inferWeaponAttackType(source, props, sourceProfile),
            dice: Array.isArray(sourceProfile?.dice) ? [...sourceProfile.dice] : [],
            tags: Array.isArray(sourceProfile?.tags) ? [...sourceProfile.tags] : [],
            allowedAmmoTypes: Array.isArray(sourceProfile?.allowedAmmoTypes)
                ? [...sourceProfile.allowedAmmoTypes]
                : (allowedAmmoText ? allowedAmmoText.split(",").map((entry) => entry.trim()).filter(Boolean) : []),
            targetCount: Number(sourceProfile?.targetCount ?? 1) || 1,
        };
    }).filter(Boolean);
}

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

    const defenseStateReason = getDefenseFollowUpBlockReason(maneuver, context);
    if (defenseStateReason) {
        reasons.push(defenseStateReason);
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

function parseJsonString(value, fallback = null) {
    if (typeof value !== "string" || value.trim() === "") return fallback;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function isTruthyLike(value) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value > 0;
    const normalized = String(value ?? "").trim().toLowerCase();
    return ["true", "yes", "y", "1", "override"].includes(normalized);
}

function resolveAmmoRangeSpec(source = {}, props = {}) {
    const sourceRange = source?.range;
    const propRange = parseJsonString(props?.Range, null);
    const explicitRange = (
        props?.RangeShort !== undefined
        || props?.RangeMedium !== undefined
        || props?.RangeLong !== undefined
    )
        ? {
            mode: isTruthyLike(props?.RangeModeOverride) ? "override" : "modify",
            shortRange: Number(props?.RangeShort),
            longRange: Number(props?.RangeMedium),
            maxRange: Number(props?.RangeLong),
        }
        : null;
    const legacyOverride = source?.rangeOverride ?? parseJsonString(props?.RangeOverride, null);
    const legacyModifier = source?.rangeModifier ?? parseJsonString(props?.RangeModifier, null);

    const range = sourceRange ?? explicitRange ?? propRange;
    if (range && typeof range === "object") {
        const mode = String(range.mode ?? "modify").trim().toLowerCase();
        return {
            mode: mode === "override" ? "override" : "modify",
            shortRange: Number(range.shortRange),
            longRange: Number(range.longRange),
            maxRange: Number(range.maxRange),
        };
    }

    if (legacyOverride && typeof legacyOverride === "object") {
        return {
            mode: "override",
            shortRange: Number(legacyOverride.shortRange),
            longRange: Number(legacyOverride.longRange),
            maxRange: Number(legacyOverride.maxRange),
        };
    }

    if (legacyModifier && typeof legacyModifier === "object") {
        return {
            mode: "modify",
            shortRange: Number(legacyModifier.shortRange),
            longRange: Number(legacyModifier.longRange),
            maxRange: Number(legacyModifier.maxRange),
        };
    }

    return null;
}

function parseManeuverDocumentJson(value, fallback = null) {
    if (typeof value !== "string" || value.trim() === "") return fallback;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function normalizeManeuver(maneuver) {
    if (!maneuver) return null;
    const source = maneuver.flags?.[SOURCE_FLAG_SCOPE]?.sourceData ?? maneuver.flags?.[MODULE_ID]?.sourceData ?? maneuver ?? {};
    const props = maneuver.system?.props ?? {};
    const rawTiming = source.type ?? source.timing ?? props.Type ?? props.Timing ?? source.usage ?? props.Usage ?? "";
    const rawTrigger = source.triggerType ?? props.TriggerType ?? props.Trigger ?? "";
    const sourceRequirements = source.requirements ?? {};
    const parsedEffectData = parseManeuverDocumentJson(props.EffectData, null);
    const parsedUsageLimit = parseManeuverDocumentJson(props.UsageLimitData, null);
    const maxUses = Number(props.UsageLimit);
    return {
        ...source,
        _id: source._id ?? source.id ?? maneuver.id ?? maneuver._id ?? null,
        id: source.id ?? source._id ?? maneuver.id ?? maneuver._id ?? null,
        name: source.name ?? maneuver.name ?? "",
        folder: source.folder ?? maneuver.folder?.name ?? maneuver.folder ?? "Maneuvers",
        type: String(rawTiming ?? "").trim().toLowerCase(),
        triggerType: String(rawTrigger ?? "").trim().toLowerCase(),
        CostType: source.CostType ?? props.CostType ?? null,
        CostAmount: source.CostAmount ?? (Number.isFinite(Number(props.CostAmount)) ? Number(props.CostAmount) : 0),
        requirements: {
            ...sourceRequirements,
            skill: sourceRequirements.skill ?? (String(props.SkillRequirement ?? "").trim() || undefined),
            text: sourceRequirements.text ?? (String(props.RequirementText ?? "").trim() || ""),
            targetText: sourceRequirements.targetText ?? (String(props.TargetRequirement ?? "").trim() || undefined),
            requiredWeaponTags: Array.isArray(sourceRequirements.requiredWeaponTags)
                ? sourceRequirements.requiredWeaponTags
                : String(props.RequiredWeaponTags ?? "").split(",").map((entry) => entry.trim()).filter(Boolean),
            excludedWeaponTags: Array.isArray(sourceRequirements.excludedWeaponTags)
                ? sourceRequirements.excludedWeaponTags
                : String(props.ExcludedWeaponTags ?? "").split(",").map((entry) => entry.trim()).filter(Boolean),
        },
        effectData: source.effectData ?? parsedEffectData ?? {},
        usageLimit: source.usageLimit ?? parsedUsageLimit ?? (Number.isFinite(maxUses) ? { maxUses } : {}),
        tags: Array.isArray(source.tags) ? source.tags : String(props.Tags ?? "").split(",").map((entry) => entry.trim()).filter(Boolean),
    };
}

function normalizeRangeBands(rangeBands) {
    let shortRange = firstFiniteNumber([rangeBands.shortRange]);
    let longRange = firstFiniteNumber([rangeBands.longRange]);
    let maxRange = firstFiniteNumber([rangeBands.maxRange]);
    shortRange = shortRange == null ? null : Math.max(0, shortRange);
    longRange = longRange == null ? null : Math.max(0, longRange);
    maxRange = maxRange == null ? null : Math.max(0, maxRange);
    if (shortRange != null && longRange != null && longRange < shortRange) longRange = shortRange;
    if (longRange != null && maxRange != null && maxRange < longRange) maxRange = longRange;
    if (longRange == null && shortRange != null) longRange = shortRange;
    if (maxRange == null && longRange != null) maxRange = longRange;
    return { shortRange, longRange, maxRange };
}

function applyAmmoRangeEffects(rangeBands, ammo) {
    const range = ammo?.range ?? null;
    if (range && typeof range === "object") {
        if (range.mode === "override") {
            return normalizeRangeBands({
                shortRange: range.shortRange,
                longRange: range.longRange,
                maxRange: range.maxRange,
            });
        }

        return normalizeRangeBands({
            shortRange: (rangeBands.shortRange ?? 0) + (Number(range.shortRange) || 0),
            longRange: (rangeBands.longRange ?? rangeBands.shortRange ?? 0) + (Number(range.longRange) || 0),
            maxRange: (rangeBands.maxRange ?? rangeBands.longRange ?? 0) + (Number(range.maxRange) || 0),
        });
    }

    return normalizeRangeBands(rangeBands);
}

function normalizeAmmoItem(ammo) {
    if (!ammo) return null;
    const source = ammo.flags?.[SOURCE_FLAG_SCOPE]?.sourceData ?? ammo.flags?.[MODULE_ID]?.sourceData ?? ammo;
    const props = ammo.system?.props ?? {};
    return {
        ...source,
        _id: ammo.id ?? ammo._id ?? source._id ?? null,
        name: source.name ?? ammo.name ?? "",
        ammoType:
            props.AmmoType ??
            ammo.ammoType ??
            source.ammoType ??
            "",
        quantity:
            firstFiniteNumber([
                props.Quantity,
                ammo.quantity,
                source.quantity,
            ]) ?? 0,
        range: resolveAmmoRangeSpec(source, props),
    };
}

function normalizeWeapon(weapon, actor = null) {
    if (!weapon) return null;
    const source = weapon.flags?.[SOURCE_FLAG_SCOPE]?.sourceData ?? weapon.flags?.[MODULE_ID]?.sourceData ?? weapon;
    const props = weapon.system?.props ?? {};
    const loadedAmmoId = String(
        props.LoadedAmmoId ??
        weapon.loadedAmmoId ??
        source.loadedAmmoId ??
        ""
    ).trim() || null;
    const loadedAmmoItem = loadedAmmoId
        ? (actor?.items?.get?.(loadedAmmoId) ?? weapon.parent?.items?.get?.(loadedAmmoId) ?? null)
        : null;
    const loadedAmmo = normalizeAmmoItem(loadedAmmoItem);
    const propRangeBands = {
        shortRange: firstFiniteNumber([props.ShortRange]),
        longRange: firstFiniteNumber([props.LongRange]),
        maxRange: firstFiniteNumber([props.MaxRange]),
    };
    const sourceRangeBands = {
        shortRange: firstFiniteNumber([weapon.shortRange, source.shortRange]),
        longRange: firstFiniteNumber([weapon.longRange, source.longRange]),
        maxRange: firstFiniteNumber([weapon.maxRange, source.maxRange]),
    };
    const baseRangeBands = hasUsableRangeBands(propRangeBands)
        ? propRangeBands
        : (hasUsableRangeBands(sourceRangeBands) ? sourceRangeBands : {
            shortRange: null,
            longRange: null,
            maxRange: null,
        });
    const effectiveRangeBands = applyAmmoRangeEffects(baseRangeBands, loadedAmmo);
    const attackProfiles = Array.isArray(source.attackProfiles) && source.attackProfiles.length
        ? source.attackProfiles
        : buildAttackProfilesFromWeaponProps(source, props);
    return {
        ...source,
        _id: weapon.id ?? weapon._id ?? source._id ?? null,
        name: source.name ?? weapon.name ?? "",
        traits: Array.isArray(source.traits) ? source.traits : [],
        groups: Array.isArray(source.groups) ? source.groups : [],
        attackProfiles,
        loadedAmmoId,
        loadedAmmo,
        shortRange: effectiveRangeBands.shortRange,
        longRange: effectiveRangeBands.longRange,
        maxRange: effectiveRangeBands.maxRange,
        equipped:
            props.Equipped ??
            weapon.equipped ??
            source.equipped ??
            false,
        ready:
            props.Ready ??
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
    if (!profile) return false;

    if (appliesTo === "melee-attack") {
        return profile.attackType === "melee";
    }

    if (appliesTo === "ranged-attack") {
        return isRangedAttackType(profile.attackType);
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





