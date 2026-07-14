/**
 * combat/weapon-state.mjs (ADR-0004, extracted from hud/actor-hud.js)
 *
 * Pure weapon/ammo/attack-profile parsing + getWeaponAttackState — the
 * attack-legality surface the HUD merely displays (range bands, reach,
 * ammo readiness, profile selection, attack-formula building). Reads only
 * actor/item/CSB data; the one Foundry touch is the canvas grid-size
 * fallback inside getChebyshevDistanceSquares (the primary path is the
 * pure footprint distance from lib/positioning).
 */
import { buildAttackPool, toFoundryFormula } from "./pool-builder.mjs";
import { isTruthyLike } from "./normalisation.mjs";
import { tokenDescriptor, footprintDistanceSquares } from "../lib/positioning.mjs";
import { MODULE_ID, SOURCE_FLAG_SCOPE } from "../lib/constants.mjs";

function getNumericProp(props, keys) {
    for (const key of keys) {
        const value = props?.[key];
        if (typeof value === "number" && Number.isFinite(value)) return value;
        if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
            return Number(value);
        }
    }
    return null;
}

function getStringProp(props, keys) {
    for (const key of keys) {
        const value = props?.[key];
        if (typeof value === "string" && value.trim() !== "") return value.trim();
    }
    return "";
}

export const DICE_TAB_ATTACK_OPTIONS = [
    { key: "balanced", label: "Balanced", dieName: "Balanced", code: "b", tooltip: "Flexible attack die with steady damage.\n1: Fumble\n2: Blank\n3: Damage 1\n4: Damage 1\n5: Damage 2\n6: Critical" },
    { key: "control", label: "Control", dieName: "Control", code: "c", tooltip: "Control die with safer pressure and crit chance.\n1: Fumble\n2: Blank\n3: Blank\n4: Damage 1\n5: Critical\n6: Critical" },
    { key: "grace", label: "Grace", dieName: "Grace", code: "g", tooltip: "Clean precision die with low risk.\n1: Blank\n2: Blank\n3: Damage 1\n4: Damage 1\n5: Critical\n6: Critical" },
    { key: "heavy", label: "Heavy", dieName: "Heavy", code: "h", tooltip: "High-impact die with swingier damage.\n1: Fumble\n2: Fumble\n3: Damage 1\n4: Damage 2\n5: Damage 4\n6: Critical" },
    { key: "lethality", label: "Lethality", dieName: "Lethality", code: "l", tooltip: "Explosive damage die with sharp upside.\n1: Fumble\n2: Fumble\n3: Damage 2\n4: Damage 3\n5: Damage 5\n6: Critical" },
    { key: "multiplier", label: "Multiplier", dieName: "Multiplier", code: "x", tooltip: "Adds multiplier potential to a hit.\n1: 0x\n2: Blank\n3: Blank\n4: 2x\n5: 2x\n6: 3x" },
    { key: "penetration", label: "Penetration", dieName: "Penetration", code: "p", tooltip: "Punches through protection more reliably.\n1: Fumble\n2: Blank\n3: Damage 1\n4: Damage 1\n5: Damage 3\n6: Critical" },
    { key: "risk", label: "Risk", dieName: "Risk", code: "r", tooltip: "Volatile die with danger and payoff.\n1: 0x\n2: Fumble\n3: Fumble\n4: Blank\n5: Damage 2\n6: Critical" },
];

// Defensive dice for the HUD's manual defense-dice roller (Evade / Armor).
// Both roll protection; Evade crits earlier, Armor soaks harder.
export const DICE_TAB_DEFENSE_OPTIONS = [
    { key: "evade", label: "Evade", dieName: "Evade", code: "e", tooltip: "Nimble defense die.\n1: Fumble\n2: Blank\n3: Protection 1\n4: Protection 2\n5: Critical\n6: Critical" },
    { key: "armor", label: "Armor", dieName: "Armor", code: "a", tooltip: "Heavy soak die.\n1: Fumble\n2: Blank\n3: Protection 1\n4: Protection 2\n5: Protection 4\n6: Critical" },
];

export function isUnarmedWeapon(item) {
    const itemProps = item?.system?.props ?? {};
    const sourceData = item?.flags?.[SOURCE_FLAG_SCOPE]?.sourceData ?? item?.flags?.[MODULE_ID]?.sourceData ?? {};
    const weaponType = itemProps.WeaponType ?? sourceData.category ?? "";
    return String(weaponType).toLowerCase() === "unarmed";
}

export function getWeaponReach(item) {
    const itemProps = item?.system?.props ?? {};
    const sourceData = item?.flags?.[SOURCE_FLAG_SCOPE]?.sourceData ?? item?.flags?.[MODULE_ID]?.sourceData ?? {};
    const propReach = {
        minReach: getNumericProp(itemProps, ["MinReach"]),
        maxReach: getNumericProp(itemProps, ["MaxReach"])
    };
    const sourceReach = {
        minReach: getNumericProp(sourceData, ["minReach"]),
        maxReach: getNumericProp(sourceData, ["maxReach"])
    };
    const propHasReach = Number.isFinite(propReach.minReach) && Number.isFinite(propReach.maxReach) && propReach.maxReach > 0;
    const sourceHasReach = Number.isFinite(sourceReach.minReach) && Number.isFinite(sourceReach.maxReach) && sourceReach.maxReach > 0;
    const propLooksLikeTemplateDefault = propReach.minReach === 1 && propReach.maxReach === 1;
    const shouldPreferSource = sourceHasReach && (!propHasReach || (propLooksLikeTemplateDefault && (sourceReach.minReach !== 1 || sourceReach.maxReach !== 1)));
    const minReach = shouldPreferSource ? sourceReach.minReach : (propReach.minReach ?? sourceReach.minReach ?? null);
    const maxReach = shouldPreferSource ? sourceReach.maxReach : (propReach.maxReach ?? sourceReach.maxReach ?? null);
    return {
        minReach,
        maxReach
    };
}

export function parseJsonProp(value, fallback = null) {
    if (typeof value !== "string" || value.trim() === "") return fallback;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function getAmmoRangeData(item) {
    const itemProps = item?.system?.props ?? {};
    const sourceData = item?.flags?.[SOURCE_FLAG_SCOPE]?.sourceData ?? item?.flags?.[MODULE_ID]?.sourceData ?? {};
    const loadedAmmoId = String(itemProps.LoadedAmmoId ?? sourceData.loadedAmmoId ?? "").trim();
    if (!loadedAmmoId) {
        return { range: null };
    }
    const ammoItem = item?.parent?.items?.get?.(loadedAmmoId) ?? null;
    const ammoProps = ammoItem?.system?.props ?? {};
    const ammoSource = ammoItem?.flags?.[SOURCE_FLAG_SCOPE]?.sourceData ?? ammoItem?.flags?.[MODULE_ID]?.sourceData ?? ammoItem ?? null;
    if (!ammoSource && !ammoItem) {
        return { range: null };
    }
    const sourceRange = ammoSource?.range ?? null;
    const explicitRange = (
        ammoProps.RangeShort !== undefined
        || ammoProps.RangeMedium !== undefined
        || ammoProps.RangeLong !== undefined
    )
        ? {
            mode: isTruthyLike(ammoProps.RangeModeOverride) ? "override" : "modify",
            shortRange: Number(ammoProps.RangeShort),
            longRange: Number(ammoProps.RangeMedium),
            maxRange: Number(ammoProps.RangeLong)
        }
        : null;
    const propRange = parseJsonProp(ammoProps.Range, null);
    const legacyOverride = ammoSource?.rangeOverride ?? parseJsonProp(ammoProps.RangeOverride, null);
    const legacyModifier = ammoSource?.rangeModifier ?? parseJsonProp(ammoProps.RangeModifier, null);
    const range = sourceRange ?? explicitRange ?? propRange
        ?? (legacyOverride ? { mode: "override", ...legacyOverride } : null)
        ?? (legacyModifier ? { mode: "modify", ...legacyModifier } : null);
    if (!range || typeof range !== "object") {
        return { range: null };
    }
    return {
        range: {
            mode: String(range.mode ?? "modify").trim().toLowerCase() === "override" ? "override" : "modify",
            shortRange: Number(range.shortRange),
            longRange: Number(range.longRange),
            maxRange: Number(range.maxRange)
        }
    };
}

function normalizeRangeBandOrder(rangeBands) {
    let shortRange = Number.isFinite(rangeBands.shortRange) ? Math.max(0, rangeBands.shortRange) : null;
    let longRange = Number.isFinite(rangeBands.longRange) ? Math.max(0, rangeBands.longRange) : null;
    let maxRange = Number.isFinite(rangeBands.maxRange) ? Math.max(0, rangeBands.maxRange) : null;
    if (Number.isFinite(shortRange) && Number.isFinite(longRange) && longRange < shortRange) longRange = shortRange;
    if (Number.isFinite(longRange) && Number.isFinite(maxRange) && maxRange < longRange) maxRange = longRange;
    if (!Number.isFinite(longRange) && Number.isFinite(shortRange)) longRange = shortRange;
    if (!Number.isFinite(maxRange) && Number.isFinite(longRange)) maxRange = longRange;
    return { shortRange, longRange, maxRange };
}

function applyAmmoRangeBands(rangeBands, ammoRangeData) {
    const range = ammoRangeData?.range ?? null;
    if (range && typeof range === "object") {
        if (range.mode === "override") {
            return normalizeRangeBandOrder({
                shortRange: range.shortRange,
                longRange: range.longRange,
                maxRange: range.maxRange
            });
        }
        return normalizeRangeBandOrder({
            shortRange: (Number.isFinite(rangeBands.shortRange) ? rangeBands.shortRange : 0) + (Number(range.shortRange) || 0),
            longRange: (Number.isFinite(rangeBands.longRange) ? rangeBands.longRange : (Number.isFinite(rangeBands.shortRange) ? rangeBands.shortRange : 0)) + (Number(range.longRange) || 0),
            maxRange: (Number.isFinite(rangeBands.maxRange) ? rangeBands.maxRange : (Number.isFinite(rangeBands.longRange) ? rangeBands.longRange : 0)) + (Number(range.maxRange) || 0)
        });
    }
    return normalizeRangeBandOrder(rangeBands);
}

export function getWeaponRangeBands(item) {
    const itemProps = item?.system?.props ?? {};
    const sourceData = item?.flags?.[SOURCE_FLAG_SCOPE]?.sourceData ?? item?.flags?.[MODULE_ID]?.sourceData ?? {};
    const propRangeBands = {
        shortRange: getNumericProp(itemProps, ["ShortRange"]),
        longRange: getNumericProp(itemProps, ["LongRange"]),
        maxRange: getNumericProp(itemProps, ["MaxRange"])
    };
    const sourceRangeBands = {
        shortRange: getNumericProp(sourceData, ["shortRange"]),
        longRange: getNumericProp(sourceData, ["longRange"]),
        maxRange: getNumericProp(sourceData, ["maxRange"])
    };
    const propHasUsableRange = [propRangeBands.shortRange, propRangeBands.longRange, propRangeBands.maxRange]
        .some((value) => Number.isFinite(value) && value > 0);
    const sourceHasUsableRange = [sourceRangeBands.shortRange, sourceRangeBands.longRange, sourceRangeBands.maxRange]
        .some((value) => Number.isFinite(value) && value > 0);
    const baseRangeBands = propHasUsableRange
        ? propRangeBands
        : (sourceHasUsableRange ? sourceRangeBands : {
            shortRange: null,
            longRange: null,
            maxRange: null
        });
    return applyAmmoRangeBands(baseRangeBands, getAmmoRangeData(item));
}

export function getChebyshevDistanceSquares(sourceToken, targetToken) {
    // Nearest-edge footprint distance (battle-flow-spec §12 #4): correct for large
    // tokens and diagonals, and identical to center-Chebyshev for 1×1 pairs.
    const a = tokenDescriptor(sourceToken);
    const b = tokenDescriptor(targetToken);
    if (a && b) return footprintDistanceSquares(a, b);
    // Fallback: center-to-center if descriptors are unavailable.
    const source = sourceToken?.center ?? null;
    const target = targetToken?.center ?? null;
    const size = Number(globalThis.canvas?.dimensions?.size) || 0;
    if (!source || !target || size <= 0) return null;
    const dx = Math.abs(Number(target.x) - Number(source.x));
    const dy = Math.abs(Number(target.y) - Number(source.y));
    return Math.round(Math.max(dx, dy) / size);
}
export function hasUsableRangeBands(rangeBands = {}) {
    return [rangeBands.shortRange, rangeBands.longRange, rangeBands.maxRange]
        .some((value) => Number.isFinite(value) && value > 0);
}

export function hasReach(item) {
    const { minReach, maxReach } = getWeaponReach(item);
    return Number.isFinite(minReach) && Number.isFinite(maxReach) && maxReach >= minReach && maxReach > 0;
}

export function hasRangeBands(item) {
    const { shortRange, longRange, maxRange } = getWeaponRangeBands(item);
    return Number.isFinite(shortRange)
        && Number.isFinite(longRange)
        && Number.isFinite(maxRange)
        && shortRange > 0
        && longRange >= shortRange
        && maxRange >= longRange;
}

export function getWeaponAttackProfiles(item) {
    const itemProps = item?.system?.props ?? {};
    const sourceProfiles = Array.isArray(item?.flags?.[SOURCE_FLAG_SCOPE]?.sourceData?.attackProfiles)
        ? item.flags[SOURCE_FLAG_SCOPE].sourceData.attackProfiles
        : [];
    const profileKeys = ["Attack", "AttackB", "AttackC"];

    return profileKeys.map((key, index) => {
        const formula = String(itemProps[key] ?? "").trim();
        if (!formula) return null;
        const sourceProfile = sourceProfiles[index] ?? null;
        const allowedAmmoText = String(itemProps[`${key}Ammo`] ?? "").trim();
        return {
            key,
            index,
            label: sourceProfile?.name ?? (index === 0 ? "Default" : `Alternative ${index}`),
            formula,
            dice: Array.isArray(sourceProfile?.dice) ? [...sourceProfile.dice] : [],
            attackType: sourceProfile?.attackType ?? null,
            profileId: sourceProfile?.id ?? null,
            allowedAmmoTypes: allowedAmmoText
                ? allowedAmmoText.split(",").map((entry) => entry.trim()).filter(Boolean)
                : [],
            allowedAmmoText
        };
    }).filter(Boolean);
}

export function getWeaponActiveAttackProfile(item) {
    const itemProps = item?.system?.props ?? {};
    const availableProfiles = getWeaponAttackProfiles(item);
    const selectedKey = String(itemProps.ActiveAttackProfile ?? "").trim();
    return availableProfiles.find((profile) => profile.key === selectedKey)
        ?? availableProfiles[0]
        ?? null;
}

export function buildFoundryAttackRollFormula(profile, rollContext = {}) {
    const baseDice = Array.isArray(profile?.dice) ? [...profile.dice] : [];
    if (!baseDice.length) return "";

    const advantageCount = Math.max(0, Number(rollContext?.advantageDice) || 0);
    const riskDice = Math.max(0, Number(rollContext?.riskDice) || 0);
    const addMainDice = Math.max(0, Number(rollContext?.addMainDice) || 0);
    const addMultiplierDice = Math.max(0, Number(rollContext?.addMultiplierDice) || 0);
    const extraDiceCounts = rollContext?.extraDiceCounts ?? {};
    const ammoAddDice = Array.isArray(rollContext?.ammoAddDice) ? rollContext.ammoAddDice : [];

    const extraDice = [];
    for (const option of DICE_TAB_ATTACK_OPTIONS) {
        const count = Math.max(0, Number(extraDiceCounts?.[option.key] ?? 0) || 0);
        for (let index = 0; index < count; index += 1) {
            extraDice.push(option.dieName);
        }
    }

    const pool = buildAttackPool(baseDice, {
        advantageCount,
        addMainDice,
        addMultiplierDice,
        addRiskDice: riskDice,
        extraDice,
        ammoAddDice
    });

    return toFoundryFormula(pool);
}

export function getAmmoQuantity(item) {
    const itemProps = item?.system?.props ?? {};
    const sourceData = item?.flags?.[SOURCE_FLAG_SCOPE]?.sourceData ?? item?.flags?.[MODULE_ID]?.sourceData ?? {};
    return getNumericProp(itemProps, ["Quantity"])
        ?? getNumericProp(sourceData, ["quantity"])
        ?? 0;
}

export function getAmmoType(item) {
    const itemProps = item?.system?.props ?? {};
    const sourceData = item?.flags?.[SOURCE_FLAG_SCOPE]?.sourceData ?? item?.flags?.[MODULE_ID]?.sourceData ?? {};
    return getStringProp(itemProps, ["AmmoType"])
        || getStringProp(sourceData, ["ammoType"])
        || "";
}

export function getAmmoSummary(item) {
    const itemProps = item?.system?.props ?? {};
    const sourceData = item?.flags?.[SOURCE_FLAG_SCOPE]?.sourceData ?? item?.flags?.[MODULE_ID]?.sourceData ?? {};
    const sourceAddDice = Array.isArray(sourceData?.addDice) ? sourceData.addDice.join(", ") : "";
    const sourceTags = Array.isArray(sourceData?.tags) ? sourceData.tags.join(", ") : "";
    const sourceModifiers = Array.isArray(sourceData?.resultModifiers) && sourceData.resultModifiers.length
        ? JSON.stringify(sourceData.resultModifiers)
        : "";
    const addDiceSummary = getStringProp(itemProps, ["AddDiceSummary", "AddDice"]) || sourceAddDice;
    const tagsSummary = getStringProp(itemProps, ["TagsSummary", "Tags"]) || sourceTags;
    const parsedModifiers = parseJsonProp(itemProps.ResultModifiers, null);
    const modifiersSummary = getStringProp(itemProps, ["ResultModifiersSummary"]) || (parsedModifiers ? JSON.stringify(parsedModifiers) : sourceModifiers);
    return [addDiceSummary, tagsSummary, modifiersSummary].filter(Boolean).join(" | ");
}

export function getWeaponAttackState(weapon, {
    token = null,
    primaryTarget = null,
    targetCount = 0,
    attacksRemaining = null
} = {}) {
    if (!weapon) {
        return {
            status: "invalid",
            label: "No weapon",
            reason: "Weapon is unavailable.",
            distanceSquares: null
        };
    }
    if (Number.isFinite(attacksRemaining) && attacksRemaining <= 0) {
        return {
            status: "invalid",
            label: "No attacks remaining",
            reason: "This actor has no attacks remaining this turn.",
            distanceSquares: null
        };
    }
    if (!weapon.equipped) {
        return {
            status: "invalid",
            label: "Not equipped",
            reason: "Weapon is not equipped.",
            distanceSquares: null
        };
    }
    if (weapon.usesAmmo) {
        if (!weapon.loadedAmmoId) {
            return {
                status: "invalid",
                label: "No ammo loaded",
                reason: "Load compatible ammunition first.",
                distanceSquares: null
            };
        }
        if (!Number.isFinite(weapon.loadedAmmoQuantity) || weapon.loadedAmmoQuantity <= 0) {
            return {
                status: "invalid",
                label: "Ammo depleted",
                reason: "The loaded ammunition stack is empty.",
                distanceSquares: null
            };
        }
        if (Array.isArray(weapon.activeAttackAllowedAmmoTypes) && weapon.activeAttackAllowedAmmoTypes.length) {
            if (!weapon.loadedAmmoType || !weapon.activeAttackAllowedAmmoTypes.includes(weapon.loadedAmmoType)) {
                return {
                    status: "invalid",
                    label: "Wrong ammo",
                    reason: "Loaded ammunition is not compatible with the active attack profile.",
                    distanceSquares: null
                };
            }
        }
    }
    if (targetCount > 1 && !weapon.canTargetMultiple) {
        return {
            status: "invalid",
            label: "Multiple targets marked",
            reason: "This weapon can only declare attacks against a single target.",
            distanceSquares: null
        };
    }
    if (!primaryTarget) {
        return {
            status: "valid",
            label: "No target",
            reason: "Click Attack to roll this weapon to chat without declaring a target.",
            distanceSquares: null,
            previewOnly: true
        };
    }

    const distanceSquares = getChebyshevDistanceSquares(token, primaryTarget);
    if (!Number.isFinite(distanceSquares)) {
        return {
            status: "valid",
            label: "Target selected",
            reason: "Could not measure target distance.",
            distanceSquares: null
        };
    }

    const usesDistanceBands = weapon.activeAttackType === "ranged"
        || weapon.activeAttackType === "thrown"
        || hasUsableRangeBands(weapon);

    if (usesDistanceBands) {
        if (Number.isFinite(weapon.shortRange) && distanceSquares <= weapon.shortRange) {
            return {
                status: "valid",
                label: `Short range (${distanceSquares})`,
                reason: "Attack is legal at normal range.",
                distanceSquares
            };
        }
        if (Number.isFinite(weapon.longRange) && distanceSquares <= weapon.longRange) {
            return {
                status: "valid",
                label: `Long range (${distanceSquares})`,
                reason: "Attack is legal but disadvantaged at long range.",
                distanceSquares
            };
        }
        if (Number.isFinite(weapon.maxRange) && distanceSquares <= weapon.maxRange) {
            return {
                status: "invalid",
                label: `Beyond long range (${distanceSquares})`,
                reason: "Direct attacks are not legal beyond long range.",
                distanceSquares
            };
        }
        return {
            status: "invalid",
            label: `Out of range (${distanceSquares})`,
            reason: "Target is beyond maximum range.",
            distanceSquares
        };
    }

    // Melee default: most weapon datasets don't specify MinReach /
    // MaxReach explicitly (buildWeaponProps writes "" when the source
    // omits them). For a melee weapon with no usable range bands and
    // no explicit reach, fall back to (1, 1) — the canonical melee
    // default, matching DEFAULT_UNARMED_WEAPON_SOURCE.
    const minReach = Number.isFinite(weapon.minReach) ? weapon.minReach : 1;
    const maxReach = Number.isFinite(weapon.maxReach) ? weapon.maxReach : 1;
    if (distanceSquares >= minReach && distanceSquares <= maxReach) {
        return {
            status: "valid",
            label: `In reach (${distanceSquares})`,
            reason: "Target is within melee reach.",
            distanceSquares
        };
    }
    return {
        status: "invalid",
        label: `Out of reach (${distanceSquares})`,
        reason: "Target is not within melee reach.",
        distanceSquares
    };
}
