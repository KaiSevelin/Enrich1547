import { COMBAT_EVENTS, onCombatEvent } from "../services/combat-events.js";

const MODULE_ID = "1547core";
const SOURCE_FLAG_SCOPE = "1547Core";
const HUD_ROOT_ID = "1547core-actor-hud-root";
const HUD_GAP = 16;
const HUD_TOP_MARGIN = 16;
const HUD_MIN_WIDTH = 280;
const HUD_MAX_WIDTH = 420;
const HUD_Z_INDEX = 90;
const THREAT_OVERLAY_LAYER_NAME = "1547core-threat-overlay";
const THREAT_FILL_COLOR = 0x6FAF72;
const THREAT_FILL_ALPHA = 0.14;
const THREAT_STROKE_ALPHA = 0.22;
const VULNERABILITY_FILL_COLOR = 0xB85A5A;
const VULNERABILITY_FILL_ALPHA = 0.14;
const VULNERABILITY_STROKE_ALPHA = 0.22;
const RANGE_SHORT_FILL_COLOR = 0x4B86C5;
const RANGE_SHORT_FILL_ALPHA = 0.16;
const RANGE_SHORT_STROKE_ALPHA = 0.28;
const RANGE_LONG_FILL_COLOR = 0xC9A14A;
const RANGE_LONG_FILL_ALPHA = 0.13;
const RANGE_LONG_STROKE_ALPHA = 0.24;
const RANGE_MAX_FILL_COLOR = 0x7C8894;
const RANGE_MAX_FILL_ALPHA = 0.1;
const RANGE_MAX_STROKE_ALPHA = 0.2;
const CSB_TEMPLATE_IDS = {
    armor: "uLlgZXz3GlXPFtsj",
    container: "l4j1zT3kpdkZmACQ",
    consumable: "PDxRO5ObvLaThpez",
    equippable: "eCIZRFXbcQVZKqEr",
    lightSource: "CmGj09PEdHfklGsT",
    maneuver: "4owc4YQBlp94GbGs",
    magicItem: "HkiFlUWUkUycJdBZ",
    pact: "HPYYc2P0Ouagicmr",
    power: "w9ky0ZTDvXDs5Ce7",
    skill: "BbwVnEJobtCR5oOf",
    spell: "2kiWw3Cv5Zk1lZxn",
    unequippable: "389uqkKKn8M1SKux",
    usageEffect: "mwPqEYUoOfzXpyT9",
    weapon: "qZCfLEYQ7egbm1B9"
};
const HUD_STATE = {
    activeCategory: "overview",
    activeManeuverGroup: "",
    activeStatPreview: "",
    counterRollEnabled: false,
    counterRollDice: 1,
    collapsed: false,
    reactionWindow: null,
    selectedAmmoByWeapon: {},
    inventoryFilter: "all"
};

const INVENTORY_FILTER_OPTIONS = [
    { value: "all", label: "All" },
    { value: "Item.389uqkKKn8M1SKux", label: "Ammunitions" },
    { value: "Item.uLlgZXz3GlXPFtsj", label: "Armors" },
    { value: "Item.PDxRO5ObvLaThpez", label: "Consumables" },
    { value: "Item.l4j1zT3kpdkZmACQ", label: "Containers" },
    { value: "Item.eCIZRFXbcQVZKqEr", label: "Equippable items" },
    { value: "Item.CmGj09PEdHfklGsT", label: "Light sources" },
    { value: "Item.HkiFlUWUkUycJdBZ", label: "Magic items" },
    { value: "Item.qZCfLEYQ7egbm1B9", label: "Weapons" },
    { value: "Item.woHyeHPKKdo4JDJd", label: "Unequippable items" }
];

let reactionHudTicker = null;

function isHudTargetModeActive() {
    return Boolean(
        document.querySelector("#controls .scene-control.active[data-control='token'], #controls .scene-control.active[data-control='tokens']") &&
        document.querySelector("#controls .control-tool.active[data-tool='target']")
    );
}

function toggleHudTargetMode() {
    const targetTool = document.querySelector("#controls .control-tool[data-tool='target']");
    if (!targetTool) return;

    if (isHudTargetModeActive()) {
        const selectTool = document.querySelector("#controls .control-tool[data-tool='select']");
        selectTool?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        return;
    }

    const tokenControl = document.querySelector("#controls .scene-control[data-control='token'], #controls .scene-control[data-control='tokens']");
    tokenControl?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    targetTool.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

function getActorProps(actor) {
    return actor?.system?.props ?? {};
}

function getActorItems(actor) {
    return actor?.items?.contents ?? actor?.items ?? [];
}

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

function isTruthyLike(value) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value > 0;
    const normalized = String(value ?? "").trim().toLowerCase();
    if (!normalized) return false;
    return ["true", "yes", "y", "1", "available", "ready"].includes(normalized);
}
function normalizeTemplateId(value) {
    const text = String(value ?? "").trim();
    if (!text) return "";
    return text.startsWith("Item.") ? text.slice(5) : text;
}

function getItemTemplateId(item) {
    return normalizeTemplateId(item?.system?.template);
}

function normalizeInventoryFilterValue(value) {
    const normalized = String(value ?? "all").trim();
    if (!normalized || normalized.toLowerCase() === "all") return "all";
    return normalizeTemplateId(normalized);
}

function getInventoryFilterOptions() {
    return INVENTORY_FILTER_OPTIONS.map((option) => ({
        ...option,
        normalizedValue: normalizeInventoryFilterValue(option.value)
    }));
}

function matchesInventoryFilter(item, filterValue) {
    const normalizedFilter = normalizeInventoryFilterValue(filterValue);
    if (normalizedFilter === "all") return true;
    return normalizeTemplateId(item?.templateId) === normalizedFilter;
}

function getCsbItemKind(item) {
    const templateId = getItemTemplateId(item);
    switch (templateId) {
        case CSB_TEMPLATE_IDS.weapon:
            return "weapon";
        case CSB_TEMPLATE_IDS.armor:
            return "armor";
        case CSB_TEMPLATE_IDS.consumable:
            return "consumable";
        case CSB_TEMPLATE_IDS.container:
            return "container";
        case CSB_TEMPLATE_IDS.equippable:
            return "equippable";
        case CSB_TEMPLATE_IDS.lightSource:
            return "light-source";
        case CSB_TEMPLATE_IDS.maneuver:
            return "maneuver";
        case CSB_TEMPLATE_IDS.magicItem:
            return "magic-item";
        case CSB_TEMPLATE_IDS.pact:
            return "pact";
        case CSB_TEMPLATE_IDS.power:
            return "power";
        case CSB_TEMPLATE_IDS.skill:
            return "skill";
        case CSB_TEMPLATE_IDS.spell:
            return "spell";
        case CSB_TEMPLATE_IDS.unequippable:
            return "unequippable";
        case CSB_TEMPLATE_IDS.usageEffect:
            return "usage-effect";
        default:
            return "unknown";
    }
}

function isWeaponItem(item) {
    const itemKind = getCsbItemKind(item);
    return itemKind === "weapon";
}

function isArmorItem(item) {
    const itemKind = getCsbItemKind(item);
    return itemKind === "armor";
}

function isConsumableItem(item) {
    return getCsbItemKind(item) === "consumable";
}

function isAmmoItem(item) {
    const itemProps = item?.system?.props ?? {};
    const sourceData = item?.flags?.[SOURCE_FLAG_SCOPE]?.sourceData ?? item?.flags?.[MODULE_ID]?.sourceData ?? {};
    return sourceData?.itemType === "ammo"
        || (getCsbItemKind(item) === "unequippable" && Boolean(itemProps.AmmoType || sourceData.ammoType));
}

function isInternalHudFolderName(folderName) {
    const normalized = String(folderName ?? "").trim().toLowerCase();
    if (!normalized) return false;
    return normalized.includes("embedded items folder")
        || normalized.startsWith("csb -")
        || normalized.includes("do not rename")
        || normalized.includes("do not remove");
}

function normalizeManeuverTimingKey(value) {
    const normalized = String(value ?? "").trim().toLowerCase();
    if (!normalized) return "other";
    if (normalized === "full-turn" || normalized === "full turn") return "full-turn";
    if (["pre", "reaction", "post", "move", "attack"].includes(normalized)) return normalized;
    return normalized;
}

function formatManeuverTimingLabel(value) {
    switch (normalizeManeuverTimingKey(value)) {
        case "pre":
            return "Pre";
        case "reaction":
            return "Reaction";
        case "post":
            return "Post";
        case "full-turn":
            return "Full Turn";
        case "move":
            return "Move";
        case "attack":
            return "Attack";
        default: {
            const text = String(value ?? "").trim();
            if (!text) return "Other";
            return text.charAt(0).toUpperCase() + text.slice(1);
        }
    }
}

function getPlayerFacingItemGroup(item) {
    const itemKind = getCsbItemKind(item);

    if (itemKind === "consumable") return "Usable Items";
    if (itemKind === "weapon") return "Weapons";
    if (itemKind === "armor") return "Armor";
    if (itemKind === "light-source") return "Light Sources";
    if (itemKind === "magic-item") return "Magic Items";
    if (itemKind === "container") return "Containers";
    if (itemKind === "equippable") return "Gear";
    if (itemKind === "unequippable") return "Other Gear";
    return "Unknown";
}

function isUnarmedWeapon(item) {
    const itemProps = item?.system?.props ?? {};
    const sourceData = item?.flags?.[SOURCE_FLAG_SCOPE]?.sourceData ?? item?.flags?.[MODULE_ID]?.sourceData ?? {};
    const weaponType = itemProps.WeaponType ?? sourceData.category ?? "";
    return String(weaponType).toLowerCase() === "unarmed";
}

function getWeaponReach(item) {
    const itemProps = item?.system?.props ?? {};
    const sourceData = item?.flags?.[SOURCE_FLAG_SCOPE]?.sourceData ?? item?.flags?.[MODULE_ID]?.sourceData ?? {};
    const minReach = getNumericProp(itemProps, ["MinReach"])
        ?? getNumericProp(sourceData, ["minReach"])
        ?? null;
    const maxReach = getNumericProp(itemProps, ["MaxReach"])
        ?? getNumericProp(sourceData, ["maxReach"])
        ?? null;
    return {
        minReach,
        maxReach
    };
}

function parseJsonProp(value, fallback = null) {
    if (typeof value !== "string" || value.trim() === "") return fallback;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function parseListProp(value) {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value !== "string") return [];
    return value.split(",").map((entry) => entry.trim()).filter(Boolean);
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

function getWeaponRangeBands(item) {
    const itemProps = item?.system?.props ?? {};
    const sourceData = item?.flags?.[SOURCE_FLAG_SCOPE]?.sourceData ?? item?.flags?.[MODULE_ID]?.sourceData ?? {};
    const baseRangeBands = {
        shortRange: getNumericProp(itemProps, ["ShortRange"])
            ?? getNumericProp(sourceData, ["shortRange"])
            ?? null,
        longRange: getNumericProp(itemProps, ["LongRange"])
            ?? getNumericProp(sourceData, ["longRange"])
            ?? null,
        maxRange: getNumericProp(itemProps, ["MaxRange"])
            ?? getNumericProp(sourceData, ["maxRange"])
            ?? null
    };
    return applyAmmoRangeBands(baseRangeBands, getAmmoRangeData(item));
}

function getChebyshevDistanceSquares(sourceToken, targetToken) {
    const source = sourceToken?.center ?? null;
    const target = targetToken?.center ?? null;
    const size = Number(canvas?.dimensions?.size) || 0;
    if (!source || !target || size <= 0) return null;
    const dx = Math.abs(Number(target.x) - Number(source.x));
    const dy = Math.abs(Number(target.y) - Number(source.y));
    return Math.round(Math.max(dx, dy) / size);
}
function hasReach(item) {
    const { minReach, maxReach } = getWeaponReach(item);
    return Number.isFinite(minReach) && Number.isFinite(maxReach) && maxReach >= minReach && maxReach > 0;
}

function hasRangeBands(item) {
    const { shortRange, longRange, maxRange } = getWeaponRangeBands(item);
    return Number.isFinite(shortRange)
        && Number.isFinite(longRange)
        && Number.isFinite(maxRange)
        && shortRange > 0
        && longRange >= shortRange
        && maxRange >= longRange;
}

function getAvailableWeaponAttackProfiles(itemProps = {}) {
    return [
        { key: "Attack", label: "Default", formula: String(itemProps.Attack ?? "").trim() },
        { key: "AttackB", label: "Alternative 1", formula: String(itemProps.AttackB ?? "").trim() },
        { key: "AttackC", label: "Alternative 2", formula: String(itemProps.AttackC ?? "").trim() }
    ].filter((profile) => profile.formula !== "");
}

function getWeaponAttackProfiles(item) {
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

function getWeaponActiveAttackProfile(item) {
    const itemProps = item?.system?.props ?? {};
    const availableProfiles = getWeaponAttackProfiles(item);
    const selectedKey = String(itemProps.ActiveAttackProfile ?? "").trim();
    return availableProfiles.find((profile) => profile.key === selectedKey)
        ?? availableProfiles[0]
        ?? null;
}

function getDiceTermCode(dieName) {
    switch (String(dieName ?? "").trim()) {
        case "Armor": return "a";
        case "Balanced": return "b";
        case "Control": return "c";
        case "Evade": return "e";
        case "Finesse": return "f";
        case "Heavy": return "h";
        case "Lethality": return "l";
        case "Penetration": return "p";
        case "Risk": return "r";
        case "Multiplier": return "x";
        default: return "";
    }
}

function buildFoundryAttackRollFormula(profile, rollContext = {}) {
    const baseDice = Array.isArray(profile?.dice) ? [...profile.dice] : [];
    if (!baseDice.length) return "";
    const pool = [...baseDice];
    const advantageDice = Math.max(0, Number(rollContext?.advantageDice) || 0);
    const riskDice = Math.max(0, Number(rollContext?.riskDice) || 0);
    const firstDie = baseDice[0] ?? "";
    for (let index = 0; index < advantageDice; index += 1) {
        if (firstDie) pool.push(firstDie);
    }
    for (let index = 0; index < riskDice; index += 1) {
        pool.push("Risk");
    }
    const terms = pool.map((die) => getDiceTermCode(die)).filter(Boolean).map((code) => "1d" + code);
    return terms.join(" + ");
}

function getAmmoQuantity(item) {
    const itemProps = item?.system?.props ?? {};
    const sourceData = item?.flags?.[SOURCE_FLAG_SCOPE]?.sourceData ?? item?.flags?.[MODULE_ID]?.sourceData ?? {};
    return getNumericProp(itemProps, ["Quantity"])
        ?? getNumericProp(sourceData, ["quantity"])
        ?? 0;
}

function getAmmoType(item) {
    const itemProps = item?.system?.props ?? {};
    const sourceData = item?.flags?.[SOURCE_FLAG_SCOPE]?.sourceData ?? item?.flags?.[MODULE_ID]?.sourceData ?? {};
    return getStringProp(itemProps, ["AmmoType"])
        || getStringProp(sourceData, ["ammoType"])
        || "";
}

function getAmmoSummary(item) {
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

function getWeaponAttackState(weapon, {
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
    if (!weapon.equipped && !weapon.ready) {
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

    if (weapon.activeAttackType === "ranged" || weapon.activeAttackType === "thrown" || Number.isFinite(weapon.shortRange) || Number.isFinite(weapon.longRange) || Number.isFinite(weapon.maxRange)) {
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

    const minReach = Number.isFinite(weapon.minReach) ? weapon.minReach : 0;
    const maxReach = Number.isFinite(weapon.maxReach) ? weapon.maxReach : null;
    if (Number.isFinite(maxReach) && distanceSquares >= minReach && distanceSquares <= maxReach) {
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

function getThreatSource(actor) {
    const weapons = getActorItems(actor).filter(isWeaponItem);
    const nonUnarmed = weapons.filter((item) => !isUnarmedWeapon(item));
    const unarmed = weapons.filter(isUnarmedWeapon);
    const readyReachWeapon = nonUnarmed.find((item) => Boolean(item?.system?.props?.Ready) && hasReach(item));
    if (readyReachWeapon) return readyReachWeapon;

    const equippedReachWeapon = nonUnarmed.find((item) => Boolean(item?.system?.props?.Equipped) && hasReach(item));
    if (equippedReachWeapon) return equippedReachWeapon;

    const readyUnarmed = unarmed.find((item) => Boolean(item?.system?.props?.Ready) && hasReach(item));
    if (readyUnarmed) return readyUnarmed;

    const equippedUnarmed = unarmed.find((item) => Boolean(item?.system?.props?.Equipped) && hasReach(item));
    if (equippedUnarmed) return equippedUnarmed;

    const anyUnarmed = unarmed.find(hasReach);
    if (anyUnarmed) return anyUnarmed;

    return {
        name: "Unarmed",
        system: {
            props: {
                WeaponType: "Unarmed",
                MinReach: 1,
                MaxReach: 1
            }
        },
        flags: {
            [SOURCE_FLAG_SCOPE]: {
                sourceData: {
                    category: "Unarmed",
                    minReach: 1,
                    maxReach: 1
                }
            }
        }
    };
}

function getRangedSource(actor) {
    const weapons = getActorItems(actor).filter(isWeaponItem);
    const readyRangedWeapon = weapons.find((item) => Boolean(item?.system?.props?.Ready) && hasRangeBands(item));
    if (readyRangedWeapon) return readyRangedWeapon;

    const equippedRangedWeapon = weapons.find((item) => Boolean(item?.system?.props?.Equipped) && hasRangeBands(item));
    if (equippedRangedWeapon) return equippedRangedWeapon;

    return weapons.find(hasRangeBands) ?? null;
}

function getFacingDirection(token) {
    const rotation = ((Number(token?.document?.rotation) || 0) % 360 + 360) % 360;
    const snapped = Math.round(rotation / 45) * 45 % 360;
    switch (snapped) {
        case 45:
            return "SW";
        case 90:
            return "W";
        case 135:
            return "NW";
        case 180:
            return "N";
        case 225:
            return "NE";
        case 270:
            return "E";
        case 315:
            return "SE";
        case 0:
        default:
            return "S";
    }
}

function getOppositeFacingDirection(facing) {
    switch (facing) {
        case "N":
            return "S";
        case "NE":
            return "SW";
        case "E":
            return "W";
        case "SE":
            return "NW";
        case "S":
            return "N";
        case "SW":
            return "NE";
        case "W":
            return "E";
        case "NW":
            return "SE";
        default:
            return "S";
    }
}

function getThreatTiles(token, minReach, maxReach) {
    const gridSize = Number(canvas?.grid?.size) || Number(canvas?.dimensions?.size) || 100;
    const sceneWidth = Number(canvas?.dimensions?.width) || 0;
    const sceneHeight = Number(canvas?.dimensions?.height) || 0;
    const startCol = Math.round((Number(token?.document?.x) || 0) / gridSize);
    const startRow = Math.round((Number(token?.document?.y) || 0) / gridSize);
    const facing = getFacingDirection(token);
    const tiles = [];
    const inFacingMask = (dx, dy, distance) => {
        switch (facing) {
            case "N":
                return dy === -distance && Math.abs(dx) <= distance;
            case "S":
                return dy === distance && Math.abs(dx) <= distance;
            case "E":
                return dx === distance && Math.abs(dy) <= distance;
            case "W":
                return dx === -distance && Math.abs(dy) <= distance;
            case "NE":
                return dx >= 0 && dy <= 0 && Math.max(dx, -dy) === distance;
            case "NW":
                return dx <= 0 && dy <= 0 && Math.max(-dx, -dy) === distance;
            case "SE":
                return dx >= 0 && dy >= 0 && Math.max(dx, dy) === distance;
            case "SW":
                return dx <= 0 && dy >= 0 && Math.max(-dx, dy) === distance;
            default:
                return false;
        }
    };

    for (let distance = minReach; distance <= maxReach; distance += 1) {
        for (let dy = -distance; dy <= distance; dy += 1) {
            for (let dx = -distance; dx <= distance; dx += 1) {
                if (Math.max(Math.abs(dx), Math.abs(dy)) !== distance) continue;
                if (!inFacingMask(dx, dy, distance)) continue;
                tiles.push({ col: startCol + dx, row: startRow + dy });
            }
        }
    }

    const seen = new Set();
    return tiles.filter(({ col, row }) => {
        const x = col * gridSize;
        const y = row * gridSize;
        if (col < 0 || row < 0 || x >= sceneWidth || y >= sceneHeight) return false;
        const key = `${col}:${row}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    }).map(({ col, row }) => ({
        x: col * gridSize,
        y: row * gridSize,
        size: gridSize
    }));
}

function getDistanceTiles(token, minDistance, maxDistance) {
    const gridSize = Number(canvas?.grid?.size) || Number(canvas?.dimensions?.size) || 100;
    const sceneWidth = Number(canvas?.dimensions?.width) || 0;
    const sceneHeight = Number(canvas?.dimensions?.height) || 0;
    const startCol = Math.round((Number(token?.document?.x) || 0) / gridSize);
    const startRow = Math.round((Number(token?.document?.y) || 0) / gridSize);
    const tiles = [];

    for (let dy = -maxDistance; dy <= maxDistance; dy += 1) {
        for (let dx = -maxDistance; dx <= maxDistance; dx += 1) {
            const distance = Math.max(Math.abs(dx), Math.abs(dy));
            if (distance < minDistance || distance > maxDistance || distance === 0) continue;
            tiles.push({ col: startCol + dx, row: startRow + dy });
        }
    }

    const seen = new Set();
    return tiles.filter(({ col, row }) => {
        const x = col * gridSize;
        const y = row * gridSize;
        if (col < 0 || row < 0 || x >= sceneWidth || y >= sceneHeight) return false;
        const key = `${col}:${row}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    }).map(({ col, row }) => ({
        x: col * gridSize,
        y: row * gridSize,
        size: gridSize
    }));
}

function getRangeBandTiles(token, shortRange, longRange, maxRange) {
    return {
        shortTiles: getDistanceTiles(token, 1, shortRange),
        longTiles: longRange > shortRange ? getDistanceTiles(token, shortRange + 1, longRange) : [],
        maxTiles: maxRange > longRange ? getDistanceTiles(token, longRange + 1, maxRange) : []
    };
}

function getVulnerabilityTiles(token) {
    const facing = getFacingDirection(token);
    const oppositeFacing = getOppositeFacingDirection(facing);
    const originalRotation = token?.document?.rotation;
    const fakeToken = {
        ...token,
        document: {
            ...token.document,
            rotation: (() => {
                switch (oppositeFacing) {
                    case "N": return 180;
                    case "NE": return 225;
                    case "E": return 270;
                    case "SE": return 315;
                    case "S": return 0;
                    case "SW": return 45;
                    case "W": return 90;
                    case "NW": return 135;
                    default: return originalRotation ?? 0;
                }
            })()
        }
    };
    return getThreatTiles(fakeToken, 1, 1);
}

function drawOverlayTiles(graphics, tiles, color, fillAlpha, strokeAlpha) {
    for (const tile of tiles) {
        graphics
            .beginFill(color, fillAlpha)
            .lineStyle(1, color, strokeAlpha)
            .drawRect(tile.x, tile.y, tile.size, tile.size)
            .endFill();
    }
}

function ensureThreatOverlayLayer() {
    if (!canvas?.tokens) return null;
    let layer = canvas.tokens.getChildByName(THREAT_OVERLAY_LAYER_NAME);
    if (!layer) {
        layer = new PIXI.Container();
        layer.name = THREAT_OVERLAY_LAYER_NAME;
        layer.eventMode = "none";
        canvas.tokens.addChild(layer);
    }
    return layer;
}

function clearThreatOverlay() {
    const layer = canvas?.tokens?.getChildByName?.(THREAT_OVERLAY_LAYER_NAME);
    if (layer) {
        layer.removeChildren();
        layer.visible = false;
    }
}

function renderThreatOverlay(token) {
    const layer = ensureThreatOverlayLayer();
    if (!layer || !token?.actor) return;

    layer.removeChildren();

    const graphics = new PIXI.Graphics();
    let hasOverlay = false;

    const rangedSource = getRangedSource(token.actor);
    const { shortRange, longRange, maxRange } = getWeaponRangeBands(rangedSource);
    if (Number.isFinite(shortRange) && Number.isFinite(longRange) && Number.isFinite(maxRange)) {
        const { shortTiles, longTiles, maxTiles } = getRangeBandTiles(token, shortRange, longRange, maxRange);
        if (maxTiles.length) {
            drawOverlayTiles(graphics, maxTiles, RANGE_MAX_FILL_COLOR, RANGE_MAX_FILL_ALPHA, RANGE_MAX_STROKE_ALPHA);
            hasOverlay = true;
        }
        if (longTiles.length) {
            drawOverlayTiles(graphics, longTiles, RANGE_LONG_FILL_COLOR, RANGE_LONG_FILL_ALPHA, RANGE_LONG_STROKE_ALPHA);
            hasOverlay = true;
        }
        if (shortTiles.length) {
            drawOverlayTiles(graphics, shortTiles, RANGE_SHORT_FILL_COLOR, RANGE_SHORT_FILL_ALPHA, RANGE_SHORT_STROKE_ALPHA);
            hasOverlay = true;
        }
    }

    const threatSource = getThreatSource(token.actor);
    const { minReach, maxReach } = getWeaponReach(threatSource);
    if (Number.isFinite(minReach) && Number.isFinite(maxReach) && maxReach >= minReach && maxReach >= 1) {
        const tiles = getThreatTiles(token, minReach, maxReach);
        if (tiles.length) {
            drawOverlayTiles(graphics, tiles, THREAT_FILL_COLOR, THREAT_FILL_ALPHA, THREAT_STROKE_ALPHA);
            hasOverlay = true;
        }

        const vulnerabilityTiles = getVulnerabilityTiles(token);
        if (vulnerabilityTiles.length) {
            drawOverlayTiles(graphics, vulnerabilityTiles, VULNERABILITY_FILL_COLOR, VULNERABILITY_FILL_ALPHA, VULNERABILITY_STROKE_ALPHA);
            hasOverlay = true;
        }
    }

    if (!hasOverlay) {
        layer.visible = false;
        return;
    }

    layer.addChild(graphics);
    layer.visible = true;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;")
        .replaceAll("'", "&#39;");
}

function formatFormula(dice, mod) {
    const safeDice = Number.isFinite(dice) ? Math.max(0, dice) : 0;
    const safeMod = Number.isFinite(mod) ? Math.max(0, mod) : 0;
    return safeMod > 0 ? `${safeDice}d6 + ${safeMod}` : `${safeDice}d6`;
}

function formatCurrentMax(current, max) {
    if (current === null && max === null) return "";
    if (max === null) return `${current ?? "-"}`;
    return `${current ?? "-"} / ${max}`;
}

function formatRangeSummary({ shortRange, longRange, maxRange }) {
    if (!Number.isFinite(shortRange) || !Number.isFinite(longRange) || !Number.isFinite(maxRange)) return "";
    return `${shortRange} / ${longRange} / ${maxRange}`;
}

function getActiveReactionWindow() {
    const reactionWindow = HUD_STATE.reactionWindow;
    if (!reactionWindow) return null;
    if (Number.isFinite(reactionWindow.expiresAt) && Date.now() > reactionWindow.expiresAt) {
        clearHudReactionWindow();
        return null;
    }
    return reactionWindow;
}

function setHudReactionWindow(reactionWindow) {
    HUD_STATE.reactionWindow = reactionWindow;
    startReactionHudTicker();
}

function clearHudReactionWindow() {
    HUD_STATE.reactionWindow = null;
    stopReactionHudTicker();
}

function startReactionHudTicker() {
    if (reactionHudTicker) return;
    reactionHudTicker = window.setInterval(() => {
        const reactionWindow = getActiveReactionWindow();
        if (!reactionWindow) {
            stopReactionHudTicker();
            void renderHudForSelection();
            return;
        }
        void renderHudForSelection();
    }, 250);
}

function stopReactionHudTicker() {
    if (!reactionHudTicker) return;
    window.clearInterval(reactionHudTicker);
    reactionHudTicker = null;
}

function getReactionCountdownText(reactionWindow) {
    const remainingMs = Math.max(0, Number(reactionWindow?.expiresAt ?? 0) - Date.now());
    return `${(remainingMs / 1000).toFixed(1)}s`;
}

function normalizeReactionChoiceId(candidate) {
    return String(candidate?.id ?? candidate?.uuid ?? candidate?.name ?? "").trim();
}

function buildReactionPrompt() {
    const reactionWindow = getActiveReactionWindow();
    if (!reactionWindow) return "";

    const actorName = reactionWindow.actor?.name ?? "";
    const targetName = reactionWindow.target?.name ?? "";
    let actorTargetSummary = "";
    if (actorName && targetName) {
        actorTargetSummary = `${actorName} -> ${targetName}`;
    } else if (actorName) {
        actorTargetSummary = actorName;
    } else if (targetName) {
        actorTargetSummary = targetName;
    }

    const summaryParts = [
        reactionWindow.trigger === "attack" ? "Attack Reaction" : "Threat Reaction",
        actorTargetSummary,
        `Closes in ${getReactionCountdownText(reactionWindow)}`
    ].filter(Boolean);

    const candidateButtons = reactionWindow.candidates.map((candidate) => {
        const choiceId = normalizeReactionChoiceId(candidate);
        let label = "Reaction";
        if (candidate?.name) {
            label = candidate.name;
        } else if (choiceId) {
            label = choiceId;
        }
        const subtitle = [candidate?.usage, candidate?.type].filter(Boolean).join(" - ");
        return `
            <button
                type="button"
                class="hud-mini-button"
                data-hud-reaction-choice="${escapeHtml(choiceId)}"
            >
                ${escapeHtml(label)}
                ${subtitle ? `<span class="hud-mini-button-sub">${escapeHtml(subtitle)}</span>` : ""}
            </button>
        `;
    }).join("");

    return `
        <section class="hud-tree-block hud-reaction-banner">
            <div class="hud-section-title">Reaction Window</div>
            <div class="hud-row-main">${escapeHtml(summaryParts[0] ?? "Reaction")}</div>
            <div class="hud-row-sub">${escapeHtml(summaryParts.slice(1).join(" - "))}</div>
            <div class="hud-chip-row hud-reaction-actions">
                ${candidateButtons ? candidateButtons : '<span class="hud-empty-pill">No legal reactions</span>'}
                <button type="button" class="hud-mini-button" data-hud-reaction-pass>Pass</button>
            </div>
        </section>
    `;
}

function getStatPreview(data) {
    return data.stats.find((stat) => stat.label === HUD_STATE.activeStatPreview) ?? data.stats[0] ?? null;
}

function buildStatPreview(previewStat, rollContext) {
    if (!previewStat) return "";

    const finalFormula = `${previewStat.dice + rollContext.advantageDice}d6${previewStat.mod > 0 ? ` + ${previewStat.mod}` : ""}`;
    return `
        <div class="hud-tree-block hud-roll-preview">
            <div class="hud-section-title">Roll Preview</div>
            <div class="hud-roll-preview-title">${escapeHtml(previewStat.label)}</div>
            <ul class="hud-tree-children hud-tree-compact">
                <li><span class="hud-tree-key">Base</span><span class="hud-tree-value">${escapeHtml(previewStat.formula)}</span></li>
                <li><span class="hud-tree-key">Advantage Dice</span><span class="hud-tree-value">${escapeHtml(rollContext.advantageDice)}</span></li>
                <li><span class="hud-tree-key">Risk Dice</span><span class="hud-tree-value">${escapeHtml(rollContext.riskDice)}</span></li>
                <li><span class="hud-tree-key">Final</span><span class="hud-tree-value">${escapeHtml(finalFormula)}</span></li>
            </ul>
        </div>
    `;
}

function getSkillDiceShift(itemProps) {
    const explicitShift = getNumericProp(itemProps, ["DiceShift"]);
    if (explicitShift !== null) return explicitShift;

    const currentLevel = getNumericProp(itemProps, ["CurrentLevel"]) ?? 0;
    return getNumericProp(itemProps, [`Level${currentLevel}DiceShift`]) ?? 0;
}

function buildRollFormula(dice, mod) {
    const safeDice = Math.max(0, Number(dice) || 0);
    const safeMod = Math.max(0, Number(mod) || 0);
    return safeMod > 0 ? `${safeDice}d6 + ${safeMod}` : `${safeDice}d6`;
}

function buildSkillRollData(baseStat, diceShift, advantageDice = 0) {
    const baseDice = Math.max(0, baseStat?.dice ?? 0);
    const baseMod = Math.max(0, baseStat?.mod ?? 0);
    const shiftedDice = baseDice + (Number(diceShift) || 0);
    const totalDice = shiftedDice + Math.max(0, Number(advantageDice) || 0);

    if (totalDice < 1) {
        return {
            dice: 1,
            mod: 0,
            formula: "1d6",
            usedFallback: true
        };
    }

    return {
        dice: totalDice,
        mod: baseMod,
        formula: buildRollFormula(totalDice, baseMod),
        usedFallback: false
    };
}

function buildHudActionContext(actor, token) {
    const summary = summarizeActor(actor, token);
    const targetedTokens = Array.from(game.user?.targets ?? []);
    return {
        actor,
        token,
        selectedToken: getSelectedToken(),
        hoveredToken: canvas?.tokens?.hover,
        targetedTokens,
        primaryTarget: targetedTokens[0] ?? null,
        inCombat: Boolean(game.combat?.started),
        combatRound: game.combat?.round ?? null,
        counterRollEnabled: HUD_STATE.counterRollEnabled,
        counterRollDice: sanitizeCounterRollDice(HUD_STATE.counterRollDice),
        summary
    };
}

function createStatActionDescriptor(context, statLabel) {
    return {
        actionType: "roll-stat",
        sourceType: "stat",
        sourceId: statLabel,
        label: `${statLabel} Check`,
        actorId: context.actor?.id ?? "",
        tokenId: context.token?.id ?? "",
        handlerId: "roll-stat",
        targeting: "none",
        requirements: {},
        costs: {},
        rollData: {},
        metadata: {
            statLabel
        }
    };
}

function createSkillActionDescriptor(context, skillName) {
    const skill = context.summary.skills.find((entry) => entry.name === skillName);
    return {
        actionType: "roll-skill",
        sourceType: "skill",
        sourceId: skill?.id ?? skillName,
        label: `${skillName} Check`,
        actorId: context.actor?.id ?? "",
        tokenId: context.token?.id ?? "",
        handlerId: "roll-skill",
        targeting: "none",
        requirements: {},
        costs: {},
        rollData: {},
        metadata: {
            skillName
        }
    };
}
function createWeaponAttackActionDescriptor(context, weaponId) {
    const weapon = context.summary.equippedWeapons.find((entry) => entry.id === weaponId);
    return {
        actionType: "attack-with-weapon",
        sourceType: "weapon",
        sourceId: weaponId,
        label: weapon ? `Attack with ${weapon.name}` : "Attack",
        actorId: context.actor?.id ?? "",
        tokenId: context.token?.id ?? "",
        handlerId: "attack-with-weapon",
        targeting: "single-or-none",
        requirements: {},
        costs: {},
        rollData: {},
        metadata: {
            weaponId
        }
    };
}

function evaluateStatAction(descriptor, context) {
    const stat = context.summary.stats.find((entry) => entry.label === descriptor.metadata?.statLabel);
    if (!stat) {
        return {
            status: "invalid",
            reasons: ["Stat is not available on this actor"],
            resolvedTargets: [],
            resolvedCosts: {},
            rollPreview: null,
            followUp: null,
            resolvedSource: null
        };
    }

    const totalDice = stat.dice + context.summary.rollContext.advantageDice;
    const finalFormula = buildRollFormula(totalDice, stat.mod);
    return {
        status: "valid",
        reasons: [],
        resolvedTargets: [],
        resolvedCosts: {},
        rollPreview: {
            title: descriptor.label,
            actionType: descriptor.actionType,
            sourceLabel: stat.label,
            targetLabels: [],
            baseFormula: stat.formula,
            advantageDice: context.summary.rollContext.advantageDice,
            riskDice: context.summary.rollContext.riskDice,
            finalFormula,
            costs: {},
            notes: []
        },
        followUp: null,
        resolvedSource: stat
    };
}

function evaluateSkillAction(descriptor, context) {
    const skill = context.summary.skills.find((entry) => entry.name === descriptor.metadata?.skillName);
    if (!skill) {
        return {
            status: "invalid",
            reasons: ["Skill is not available on this actor"],
            resolvedTargets: [],
            resolvedCosts: {},
            rollPreview: null,
            followUp: null,
            resolvedSource: null
        };
    }
    if (!skill.canRoll) {
        return {
            status: "invalid",
            reasons: ["This skill cannot be rolled from the HUD"],
            resolvedTargets: [],
            resolvedCosts: {},
            rollPreview: null,
            followUp: null,
            resolvedSource: skill
        };
    }
    if (!skill.linkedStat) {
        return {
            status: "invalid",
            reasons: ["Skill is missing a linked stat"],
            resolvedTargets: [],
            resolvedCosts: {},
            rollPreview: null,
            followUp: null,
            resolvedSource: skill
        };
    }

    const baseStat = context.summary.stats.find((entry) => entry.label === skill.linkedStat) ?? null;
    if (!baseStat) {
        return {
            status: "invalid",
            reasons: [`Actor is missing ${skill.linkedStat}`],
            resolvedTargets: [],
            resolvedCosts: {},
            rollPreview: null,
            followUp: null,
            resolvedSource: skill
        };
    }

    const rollData = buildSkillRollData(baseStat, skill.diceShift, context.summary.rollContext.advantageDice);
    const notes = [];
    if (rollData.usedFallback) notes.push("Fallback: minimum skill roll is 1d6");

    return {
        status: "valid",
        reasons: [],
        resolvedTargets: [],
        resolvedCosts: {},
        rollPreview: {
            title: descriptor.label,
            actionType: descriptor.actionType,
            sourceLabel: skill.name,
            targetLabels: [],
            baseFormula: skill.baseFormula || "-",
            advantageDice: context.summary.rollContext.advantageDice,
            riskDice: context.summary.rollContext.riskDice,
            finalFormula: rollData.formula,
            costs: {},
            notes
        },
        followUp: null,
        resolvedSource: {
            ...skill,
            baseStat,
            rollData
        }
    };
}

function evaluateWeaponAttackAction(descriptor, context) {
    const weapon = context.summary.equippedWeapons.find((entry) => entry.id === descriptor.metadata?.weaponId);
    if (!weapon) {
        return {
            status: "invalid",
            reasons: ["Weapon is not available on this actor"],
            resolvedTargets: [],
            resolvedCosts: {},
            rollPreview: null,
            followUp: null,
            resolvedSource: null
        };
    }

    const attackState = getWeaponAttackState(weapon, {
        token: context.token,
        primaryTarget: context.primaryTarget,
        targetCount: context.targetedTokens.length,
        attacksRemaining: context.summary.attacksRemaining
    });

    if (attackState.status !== "valid") {
        return {
            status: "invalid",
            reasons: [attackState.reason || "This attack is not currently legal."],
            resolvedTargets: context.primaryTarget ? [context.primaryTarget] : [],
            resolvedCosts: {},
            rollPreview: null,
            followUp: null,
            resolvedSource: {
                weapon,
                attackState
            }
        };
    }

    return {
        status: "valid",
        reasons: [],
        resolvedTargets: context.primaryTarget ? [context.primaryTarget] : [],
        resolvedCosts: {},
        rollPreview: {
            title: descriptor.label,
            actionType: descriptor.actionType,
            sourceLabel: weapon.name,
            targetLabels: context.primaryTarget ? [context.primaryTarget.name ?? context.primaryTarget.actor?.name ?? "Target"] : [],
            baseFormula: weapon.activeAttackFormula || "-",
            advantageDice: context.summary.rollContext.advantageDice,
            riskDice: context.summary.rollContext.riskDice,
            finalFormula: buildFoundryAttackRollFormula(weapon.activeAttackProfileData, context.summary.rollContext) || weapon.activeAttackFormula || "-",
            costs: {},
            notes: [attackState.label, attackState.reason].filter(Boolean)
        },
        followUp: null,
        resolvedSource: {
            weapon,
            attackState
        }
    };
}
function evaluateHudAction(descriptor, context) {
    switch (descriptor.actionType) {
        case "roll-stat":
            return evaluateStatAction(descriptor, context);
        case "roll-skill":
            return evaluateSkillAction(descriptor, context);
        case "attack-with-weapon":
            return evaluateWeaponAttackAction(descriptor, context);
        default:
            return {
                status: "invalid",
                reasons: ["No HUD handler is defined for this action"],
                resolvedTargets: [],
                resolvedCosts: {},
                rollPreview: null,
                followUp: null,
                resolvedSource: null
            };
    }
}
async function executeStatAction(descriptor, context, evaluation) {
    const stat = evaluation.resolvedSource;
    const formula = evaluation.rollPreview?.finalFormula ?? stat?.formula;
    if (!formula || !stat) return;

    HUD_STATE.activeStatPreview = stat.label;
    const roll = await new Roll(formula).evaluate({ async: true });
    const speaker = ChatMessage.getSpeaker({ actor: context.actor, token: context.token?.document });
    const flavor = `${descriptor.label}<br>Base: ${escapeHtml(evaluation.rollPreview.baseFormula)}<br>Advantage Dice: ${escapeHtml(evaluation.rollPreview.advantageDice)}<br>Risk Dice: ${escapeHtml(evaluation.rollPreview.riskDice)}`;
    await roll.toMessage({
        speaker,
        flavor
    });
    await maybeRollCounter(context, descriptor.label, roll.total);
}

async function executeSkillAction(descriptor, context, evaluation) {
    const skill = evaluation.resolvedSource;
    const formula = evaluation.rollPreview?.finalFormula ?? skill?.formula;
    if (!formula || !skill) return;

    if (skill.linkedStat) {
        HUD_STATE.activeStatPreview = skill.linkedStat;
    }

    const roll = await new Roll(formula).evaluate({ async: true });
    const speaker = ChatMessage.getSpeaker({ actor: context.actor, token: context.token?.document });
    const fallbackNote = skill.rollData?.usedFallback ? "<br>Fallback: minimum skill roll is 1d6" : "";
    const flavor = `${descriptor.label}<br>Stat: ${escapeHtml(skill.linkedStat)}<br>Base Stat: ${escapeHtml(skill.baseFormula || "-")}<br>Level: ${escapeHtml(skill.currentLevel)}<br>Dice Shift: ${escapeHtml(skill.diceShift)}<br>Advantage Dice: ${escapeHtml(evaluation.rollPreview.advantageDice)}<br>Risk Dice: ${escapeHtml(evaluation.rollPreview.riskDice)}${fallbackNote}`;
    await roll.toMessage({
        speaker,
        flavor
    });
    await maybeRollCounter(context, descriptor.label, roll.total);
}

async function executeWeaponAttackAction(descriptor, context, evaluation) {
    const weaponId = descriptor.metadata?.weaponId;
    const weaponItem = context.actor?.items?.get?.(weaponId);
    if (!weaponItem) {
        ui.notifications?.warn?.("Weapon item could not be resolved.");
        return;
    }

    const currentSummary = summarizeActor(context.actor, context.token);
    const currentWeapon = currentSummary.equippedWeapons.find((entry) => entry.id === weaponId) ?? evaluation?.resolvedSource?.weapon ?? null;
    const attackFormula = buildFoundryAttackRollFormula(currentWeapon?.activeAttackProfileData, currentSummary.rollContext) || "";

    if (!context.primaryTarget) {
        if (!attackFormula) {
            const speaker = ChatMessage.getSpeaker({ actor: context.actor, token: context.token?.document });
            await ChatMessage.create({
                speaker,
                content: `<strong>${escapeHtml(descriptor.label)}</strong><br>No target selected.<br>Attack pool: ${escapeHtml(currentWeapon?.activeAttackFormula || "Unavailable")}`
            });
            return;
        }
        const roll = await new Roll(attackFormula).evaluate({ async: true });
        const speaker = ChatMessage.getSpeaker({ actor: context.actor, token: context.token?.document });
        const flavor = `${descriptor.label}<br>No target selected: rolled to chat only.`;
        await roll.toMessage({ speaker, flavor });
        return;
    }

    const refreshedAttackState = getWeaponAttackState(currentWeapon, {
        token: context.token,
        primaryTarget: context.primaryTarget,
        targetCount: context.targetedTokens.length,
        attacksRemaining: currentSummary.attacksRemaining
    });
    if (refreshedAttackState.status !== "valid") {
        ui.notifications?.warn?.(refreshedAttackState.reason || "This attack is not currently legal.");
        return;
    }

    const combatApi = game.modules.get(MODULE_ID)?.api?.combat;
    const declareAttack = combatApi?.declareAttack;
    if (typeof declareAttack !== "function") {
        ui.notifications?.warn?.("Combat resolver is not available.");
        return;
    }

    const targetActor = context.primaryTarget?.actor ?? null;
    const distanceSquares = refreshedAttackState.distanceSquares ?? getChebyshevDistanceSquares(context.token, context.primaryTarget);
    try {
        const result = await declareAttack({
            actor: context.actor,
            target: targetActor,
            targets: targetActor ? [targetActor] : [],
            weapon: weaponItem,
            profileId: currentWeapon?.activeAttackProfileId ?? null,
            distanceSquares
        });
        if (result?.cancelled) {
            ui.notifications?.info?.("Attack declaration was cancelled by a reaction.");
            return;
        }
        ui.notifications?.info?.(`Attack declared against ${targetActor?.name ?? "target"}.`);
    } catch (error) {
        ui.notifications?.warn?.(error?.message || "Could not declare the attack.");
    }
}

async function consumeHudFullTurn(actor) {
    if (!actor?.update) return;
    await actor.update({
        "system.props.FullTurnAvailable": false
    });
}

async function executeWeaponReloadAction(weaponId, actor, summary) {
    const requiresFullTurn = summary?.isCombatActive === true;
    if (requiresFullTurn && !isTruthyLike(summary?.fullTurnAvailable)) {
        ui.notifications?.warn?.("A full turn is required to reload.");
        return;
    }

    const weapon = summary?.equippedWeapons?.find((entry) => entry.id === weaponId) ?? null;
    const weaponItem = actor?.items?.get?.(weaponId) ?? null;
    if (!weapon || !weaponItem) {
        ui.notifications?.warn?.("Weapon item could not be resolved.");
        return;
    }
    if (!weapon.usesAmmo) {
        ui.notifications?.warn?.("This weapon does not use ammunition.");
        return;
    }

    const selectedAmmoId = HUD_STATE.selectedAmmoByWeapon?.[weaponId] ?? weapon.loadedAmmoId ?? null;
    const chosenAmmo = selectedAmmoId
        ? weapon.compatibleAmmo.find((ammo) => ammo.id === selectedAmmoId) ?? null
        : (weapon.compatibleAmmo.length === 1 ? weapon.compatibleAmmo[0] : null);

    if (!chosenAmmo) {
        ui.notifications?.warn?.("Choose a compatible ammo chip first, or keep only one compatible ammo stack.");
        return;
    }

    const loadWeaponAmmo = game.modules.get(MODULE_ID)?.api?.combat?.loadWeaponAmmo;
    if (typeof loadWeaponAmmo !== "function") {
        ui.notifications?.warn?.("Combat resolver is not available.");
        return;
    }

    await loadWeaponAmmo({
        actor,
        weapon: weaponItem,
        ammoItemId: chosenAmmo.id,
        profileId: weapon.activeAttackProfileId ?? null
    });

    if (summary?.isCombatActive === true) {
        await consumeHudFullTurn(actor);
    }
    ui.notifications?.info?.(`Reloaded ${weapon.name} with ${chosenAmmo.name}.`);
}

async function executeWeaponReadyAction(weaponId, actor, summary) {
    const requiresFullTurn = summary?.isCombatActive === true;
    if (requiresFullTurn && !isTruthyLike(summary?.fullTurnAvailable)) {
        ui.notifications?.warn?.("A full turn is required to ready a weapon.");
        return;
    }

    const weaponItem = actor?.items?.get?.(weaponId) ?? null;
    if (!weaponItem?.update) {
        ui.notifications?.warn?.("Weapon item could not be resolved.");
        return;
    }

    await weaponItem.update({
        "system.props.Equipped": true,
        "system.props.Ready": true
    });
    if (summary?.isCombatActive === true) {
        await consumeHudFullTurn(actor);
    }
    ui.notifications?.info?.(`Readied ${weaponItem.name}.`);
}

async function executeItemUnequipAction(itemId, actor, summary) {
    const requiresFullTurn = summary?.isCombatActive === true;
    if (requiresFullTurn && !isTruthyLike(summary?.fullTurnAvailable)) {
        ui.notifications?.warn?.("A full turn is required to unequip an item.");
        return;
    }

    const item = actor?.items?.get?.(itemId) ?? null;
    if (!item?.update) {
        ui.notifications?.warn?.("Item could not be resolved.");
        return;
    }

    await item.update({
        "system.props.Equipped": false,
        "system.props.Ready": false
    });
    if (summary?.isCombatActive === true) {
        await consumeHudFullTurn(actor);
    }
    ui.notifications?.info?.(`Unequipped ${item.name}.`);
}

const HUD_ACTION_HANDLERS = {
    "roll-stat": {
        execute: executeStatAction
    },
    "roll-skill": {
        execute: executeSkillAction
    },
    "attack-with-weapon": {
        execute: executeWeaponAttackAction
    }
};

async function runHudAction(descriptor, context) {
    const evaluation = evaluateHudAction(descriptor, context);
    if (evaluation.status !== "valid") {
        const message = evaluation.reasons?.[0] || "This action is not currently available.";
        ui.notifications?.warn?.(message);
        return evaluation;
    }

    const handler = HUD_ACTION_HANDLERS[descriptor.handlerId];
    if (!handler?.execute) {
        ui.notifications?.warn?.("No HUD action handler is defined for this action.");
        return {
            ...evaluation,
            status: "invalid",
            reasons: ["No HUD action handler is defined for this action"]
        };
    }

    await handler.execute(descriptor, context, evaluation);
    return evaluation;
}

function sanitizeCounterRollDice(value) {
    return clamp(Number(value) || 1, 1, 10);
}

function getResourceSummary(props, baseName) {
    const current = getNumericProp(props, [
        `Available${baseName}`,
        `Current${baseName}`,
        `${baseName}Current`,
        baseName
    ]);
    const max = getNumericProp(props, [`Max${baseName}`, `${baseName}Max`]);
    return {
        current,
        max,
        display: formatCurrentMax(current, max)
    };
}

function summarizeActor(actor, token) {
    const props = getActorProps(actor);
    const items = actor?.items?.contents ?? actor?.items ?? [];
    const effects = actor?.effects?.contents ?? actor?.effects ?? [];
    const targetedTokens = Array.from(game.user?.targets ?? []);
    const primaryTarget = targetedTokens[0] ?? null;
    const attacksRemaining = getNumericProp(props, ["AttacksRemaining", "AttackRemaining", "attacksRemaining"]);
    const weaponItems = items.filter(isWeaponItem);
    const armorItems = items.filter(isArmorItem);
    const ammoItems = items.filter(isAmmoItem);
    const maneuverItems = items.filter((item) => getCsbItemKind(item) === "maneuver");
    const skillItems = items.filter((item) => getCsbItemKind(item) === "skill");
    const inventoryItems = items.filter((item) => {
        const kind = getCsbItemKind(item);
        return !["maneuver", "skill", "pact", "power", "spell", "usage-effect"].includes(kind);
    });

    const equippedWeapons = weaponItems.map((item) => {
        const itemProps = item.system?.props ?? {};
        const attackProfiles = getWeaponAttackProfiles(item);
        const activeAttackProfile = getWeaponActiveAttackProfile(item);
        const rangeBands = getWeaponRangeBands(item);
        const reach = getWeaponReach(item);
        const usesAmmo = Boolean(itemProps.UsesAmmo);
        const loadedAmmoId = String(itemProps.LoadedAmmoId ?? "").trim();
        const loadedAmmo = ammoItems.find((ammo) => ammo.id === loadedAmmoId) ?? null;
        const compatibleAmmo = usesAmmo
            ? ammoItems.filter((ammo) => {
                const ammoType = getAmmoType(ammo);
                if (!ammoType || getAmmoQuantity(ammo) < 1) return false;
                if (activeAttackProfile?.allowedAmmoTypes?.length) {
                    return activeAttackProfile.allowedAmmoTypes.includes(ammoType);
                }
                const weaponAmmoType = String(itemProps.AmmoType ?? "").trim();
                return weaponAmmoType ? weaponAmmoType === ammoType : true;
            })
            : [];
        const selectedAmmoId = compatibleAmmo.some((ammo) => ammo.id === HUD_STATE.selectedAmmoByWeapon?.[item.id])
            ? HUD_STATE.selectedAmmoByWeapon[item.id]
            : (loadedAmmoId || null);
        if (usesAmmo && selectedAmmoId) {
            HUD_STATE.selectedAmmoByWeapon[item.id] = selectedAmmoId;
        }
        const weaponSummary = {
            id: item.id,
            name: item.name,
            ready: Boolean(itemProps.Ready),
            equipped: Boolean(itemProps.Equipped),
            type: itemProps.WeaponType ?? sourceData.category ?? sourceData.type ?? "",
            minReach: reach.minReach,
            maxReach: reach.maxReach,
            shortRange: rangeBands.shortRange,
            longRange: rangeBands.longRange,
            maxRange: rangeBands.maxRange,
            rangeSummary: formatRangeSummary(rangeBands),
            usesAmmo,
            ammoLoaded: getNumericProp(itemProps, ["AmmoLoaded"]) ?? 0,
            loadedAmmoId: loadedAmmoId || null,
            loadedAmmoName: loadedAmmo?.name ?? "",
            loadedAmmoType: loadedAmmo ? getAmmoType(loadedAmmo) : "",
            loadedAmmoSummary: loadedAmmo ? getAmmoSummary(loadedAmmo) : "",
            loadedAmmoQuantity: loadedAmmo ? getAmmoQuantity(loadedAmmo) : 0,
            selectedAmmoId,
            attackProfiles,
            activeAttackProfile: activeAttackProfile?.key ?? "Attack",
            activeAttackFormula: activeAttackProfile?.formula ?? "",
            activeAttackType: activeAttackProfile?.attackType ?? null,
            activeAttackProfileId: activeAttackProfile?.profileId ?? null,
            activeAttackAmmoText: activeAttackProfile?.allowedAmmoText ?? "",
            activeAttackAllowedAmmoTypes: Array.isArray(activeAttackProfile?.allowedAmmoTypes) ? [...activeAttackProfile.allowedAmmoTypes] : [],
            activeAttackProfileData: activeAttackProfile ? { ...activeAttackProfile } : null,
            canTargetMultiple: Number(activeAttackProfile?.targetCount ?? 1) > 1,
            compatibleAmmo: compatibleAmmo.map((ammo) => ({
                id: ammo.id,
                name: ammo.name,
                ammoType: getAmmoType(ammo),
                quantity: getAmmoQuantity(ammo),
                summary: getAmmoSummary(ammo)
            }))
        };
        weaponSummary.attackState = getWeaponAttackState(weaponSummary, {
            token,
            primaryTarget,
            targetCount: targetedTokens.length,
            attacksRemaining
        });
        return weaponSummary;
    }).filter((item) => item.equipped || item.ready);

    const equippedArmor = armorItems.map((item) => {
        const itemProps = item.system?.props ?? {};
        const sourceData = item.flags?.[SOURCE_FLAG_SCOPE]?.sourceData ?? item.flags?.[MODULE_ID]?.sourceData ?? {};
        return {
            id: item.id,
            name: item.name,
            equipped: Boolean(itemProps.Equipped),
            defense: itemProps.Defense ?? "",
            type: itemProps.ArmorType ?? sourceData.armorClass ?? sourceData.type ?? "armor"
        };
    }).filter((item) => item.equipped);

    const isCombatActive = Boolean(game.combat?.started);
    const fullTurnAvailable = getStringProp(props, ["FullTurnAvailable", "fullTurnAvailable"]) || "Unknown";
    const activeWeaponSummary = equippedWeapons.find((item) => item.ready) ?? equippedWeapons[0] ?? null;
    const activeWeaponItem = activeWeaponSummary ? actor.items?.get?.(activeWeaponSummary.id) ?? null : null;
    const getLegalManeuvers = game.modules.get(MODULE_ID)?.api?.combat?.getLegalManeuvers;
    const maneuverNameFilter = typeof getLegalManeuvers === "function"
        ? new Set(getLegalManeuvers({
            actor,
            weapon: activeWeaponItem,
            profile: activeWeaponSummary?.activeAttackProfileData ?? null,
            target: primaryTarget?.actor ?? null,
            distanceSquares: getChebyshevDistanceSquares(token, primaryTarget),
            rangeSquares: getChebyshevDistanceSquares(token, primaryTarget),
            attacksRemaining,
            fullTurnAvailable: isTruthyLike(fullTurnAvailable),
            includeReasons: false
        }).map((maneuver) => maneuver?.name).filter(Boolean))
        : null;

    const maneuvers = maneuverItems.map((item) => {
        const sourceData = item.flags?.[SOURCE_FLAG_SCOPE]?.sourceData ?? item.flags?.[MODULE_ID]?.sourceData ?? {};
        const itemProps = item.system?.props ?? {};
        const rawTiming = sourceData.type ?? sourceData.timing ?? itemProps.Type ?? itemProps.Timing ?? sourceData.usage ?? itemProps.Usage ?? "";
        const timingKey = normalizeManeuverTimingKey(rawTiming);
        return {
            name: item.name,
            timing: formatManeuverTimingLabel(timingKey),
            timingKey,
            groupLabel: formatManeuverTimingLabel(timingKey),
            usage: timingKey,
            type: timingKey
        };
    }).filter((maneuver) => !maneuverNameFilter || maneuverNameFilter.has(maneuver.name));

    const inventory = inventoryItems.map((item) => {
        const sourceData = item.flags?.[SOURCE_FLAG_SCOPE]?.sourceData ?? item.flags?.[MODULE_ID]?.sourceData ?? {};
        const itemProps = item.system?.props ?? {};
        return {
            id: item.id,
            name: item.name,
            group: getPlayerFacingItemGroup(item),
            equipped: Boolean(itemProps.Equipped),
            ready: Boolean(itemProps.Ready),
            consumable: isConsumableItem(item),
            itemKind: getCsbItemKind(item),
            templateId: item.system?.template ?? "",
            type: itemProps.WeaponType ?? itemProps.ArmorType ?? sourceData.category ?? sourceData.armorClass ?? sourceData.type ?? ""
        };
    });

    const equippedInventory = inventory.filter((item) => item.equipped || item.ready);
    const stowedInventory = inventory.filter((item) => !item.equipped && !item.ready);
    const pointPools = [
        { label: "STR", key: "StrengthPoints" },
        { label: "STA", key: "StaminaPoints" },
        { label: "DEX", key: "DexterityPoints" },
        { label: "INT", key: "IntelligencePoints" },
        { label: "FTH", key: "FaithPoints" },
        { label: "CHA", key: "CharismaPoints" },
        { label: "POW", key: "PowerPoints" }
    ].map((entry) => {
        const summary = getResourceSummary(props, entry.key);
        return {
            label: entry.label,
            key: entry.key,
            current: summary.current,
            max: summary.max,
            display: summary.display
        };
    }).filter((entry) => entry.current !== null || entry.max !== null);

    const riskAndCritical = [
        { label: "RISK", key: "RiskPoints" },
        { label: "CRIT", key: "CriticalPoints" }
    ].map((entry) => {
        const summary = getResourceSummary(props, entry.key);
        return {
            label: entry.label,
            key: entry.key,
            current: summary.current,
            max: summary.max,
            display: summary.display
        };
    }).filter((entry) => entry.current !== null || entry.max !== null);

    const statDefinitions = [
        "Strength",
        "Stamina",
        "Dexterity",
        "Charisma",
        "Intelligence",
        "Faith",
        "Power"
    ];

    const stats = statDefinitions.map((label) => {
        const dice = getNumericProp(props, [`Stats_${label}Dice`, `${label}Dice`]);
        const mod = getNumericProp(props, [`Stats_${label}Mod`, `${label}Mod`]) ?? 0;
        if (dice === null && mod === null) return null;
        return {
            label,
            dice: Math.max(0, dice ?? 0),
            mod: Math.max(0, mod ?? 0),
            formula: buildRollFormula(dice ?? 0, mod ?? 0)
        };
    }).filter(Boolean);

    const statMap = new Map(stats.map((stat) => [stat.label, stat]));

    const skills = skillItems.map((item) => {
        const sourceData = item.flags?.[SOURCE_FLAG_SCOPE]?.sourceData ?? item.flags?.[MODULE_ID]?.sourceData ?? {};
        const itemProps = item.system?.props ?? {};
        const statLabel = itemProps.Stat ?? sourceData.linkedStat ?? itemProps.LinkedStat ?? "";
        const baseStat = statMap.get(statLabel) ?? null;
        const currentLevel = getNumericProp(itemProps, ["CurrentLevel"]) ?? 0;
        const diceShift = getSkillDiceShift(itemProps);
        const rollData = buildSkillRollData(baseStat, diceShift, 0);
        return {
            id: item.id,
            name: item.name,
            group: sourceData.group ?? itemProps.Group ?? "",
            linkedStat: statLabel,
            currentLevel,
            diceShift,
            canRoll: Boolean(itemProps.CanRoll),
            formula: baseStat ? rollData.formula : "",
            baseFormula: baseStat?.formula ?? "",
            finalDice: rollData.dice,
            finalMod: rollData.mod,
            usedFallback: rollData.usedFallback
        };
    });

    const hitPointSummary = {
        current: getNumericProp(props, ["CurrentHitPoints", "HitPoints", "HP", "CurrentHP"]),
        max: getNumericProp(props, ["MaxHitPoints", "HitPointsMax", "HPMax", "MaximumHitPoints"])
    };

    const rollContext = {
        advantageDice: getNumericProp(props, ["AvailableAdvantageDice", "AdvantageDice", "Advantage"]) ?? 0,
        riskDice: getNumericProp(props, ["AvailableRiskDice", "RiskDice"]) ?? 0
    };

    return {
        actorId: actor.id,
        actorName: actor.name,
        tokenName: token?.name ?? actor.name,
        actorImg: token?.document?.texture?.src || actor.img || "icons/svg/mystery-man.svg",
        hitPoints: hitPointSummary.current,
        maxHitPoints: hitPointSummary.max,
        movement: getNumericProp(props, ["MovementRemaining", "MoveRemaining", "movementRemaining"]),
        attacks: attacksRemaining,
        attacksRemaining,
        fullTurnAvailable,
        readyState: getStringProp(props, ["Done", "done"]) || "Unknown",
        stats,
        pointPools,
        riskAndCritical,
        rollContext,
        conditions: effects.map((effect) => effect.name).filter(Boolean),
        equippedWeapons,
        equippedArmor,
        maneuvers,
        skills,
        inventory: stowedInventory,
        equippedInventory,
        maneuverCount: maneuverItems.length,
        isCombatActive,
        round: game.combat?.round ?? null
    };
}

function renderPills(entries) {
    if (!entries.length) return `<span class="hud-empty-pill">None</span>`;
    return entries.map((entry) => `
        <span class="hud-pill">
            <span class="hud-pill-label">${escapeHtml(entry.label)}</span>
            <span class="hud-pill-value">${escapeHtml(entry.value)}</span>
        </span>
    `).join("");
}

function renderSimpleList(entries, formatter) {
    if (!entries.length) return `<li class="hud-empty-row">None</li>`;
    return entries.map((entry) => `<li>${formatter(entry)}</li>`).join("");
}

function buildTreeList(items, formatter) {
    if (!items.length) return `<li class="hud-empty-row">None</li>`;
    return items.map((item) => formatter(item)).join("");
}

function groupEntries(entries, grouper) {
    const groups = new Map();
    for (const entry of entries) {
        const key = grouper(entry) || "Other";
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(entry);
    }
    return Array.from(groups.entries());
}

function buildGroupedTree(groups, formatter, options = {}) {
    const { scroll = false, openFirst = true } = options;
    if (!groups.length) return `<div class="hud-empty-row">None</div>`;
    return groups.map(([label, entries], index) => `
        <details class="hud-tree-group"${openFirst && index === 0 ? " open" : ""}>
            <summary class="hud-tree-summary">
                <span>${escapeHtml(label)}</span>
                <span class="hud-tree-badge">${escapeHtml(entries.length)}</span>
            </summary>
            <ul class="hud-list hud-tree-list${scroll ? " hud-list-scroll" : ""}">
                ${buildTreeList(entries, formatter)}
            </ul>
        </details>
    `).join("");
}

function getManeuverGroups(data) {
    return groupEntries(data.maneuvers, (maneuver) => maneuver.groupLabel || maneuver.timing || "Other");
}

function buildWeaponsTree(data) {
    return buildTreeList(data.equippedWeapons, (weapon) => {
        const state = weapon.ready ? "Ready" : (weapon.equipped ? "Equipped" : "Stowed");
        const summaryParts = [
            state,
            weapon.type,
            weapon.rangeSummary ? `Range ${weapon.rangeSummary}` : "",
            weapon.activeAttackFormula ? `Active ${weapon.activeAttackFormula}` : ""
        ].filter(Boolean);
        const children = weapon.attackProfiles.length
            ? weapon.attackProfiles.map((profile) => {
                const prefix = profile.key === weapon.activeAttackProfile ? "Active: " : "";
                const ammoText = profile.allowedAmmoText ? ` | Ammo ${profile.allowedAmmoText}` : "";
                return `<li>${escapeHtml(`${prefix}${profile.formula}${ammoText}`)}</li>`;
            }).join("")
            : `<li>No profiles</li>`;
        return `
            <li class="hud-tree-item">
                <div class="hud-row-main">${escapeHtml(weapon.name)}</div>
                <div class="hud-row-sub">${escapeHtml(summaryParts.join(" - "))}</div>
                <ul class="hud-tree-children">
                    ${weapon.rangeSummary ? `<li>Short / Long / Max: ${escapeHtml(weapon.rangeSummary)}</li>` : ""}
                    ${children}
                </ul>
            </li>
        `;
    });
}

function buildManeuverTree(data) {
    return buildTreeList(data.maneuvers, (maneuver) => `
        <li class="hud-tree-item">
            <div class="hud-row-main">${escapeHtml(maneuver.name)}</div>
            <ul class="hud-tree-children">
                ${maneuver.timing ? `<li>Timing: ${escapeHtml(maneuver.timing)}</li>` : ""}
                ${maneuver.usage ? `<li>Usage: ${escapeHtml(maneuver.usage)}</li>` : ""}
                ${maneuver.type ? `<li>Type: ${escapeHtml(maneuver.type)}</li>` : ""}
            </ul>
        </li>
    `);
}

function buildSkillTree(data) {
    return buildTreeList(data.skills, (skill) => `
        <li class="hud-tree-item">
            <div class="hud-row-main">${escapeHtml(skill.name)}</div>
            <ul class="hud-tree-children">
                ${skill.group ? `<li>Group: ${escapeHtml(skill.group)}</li>` : ""}
                ${skill.linkedStat ? `<li>Linked Stat: ${escapeHtml(skill.linkedStat)}</li>` : ""}
            </ul>
        </li>
    `);
}

function buildStatsTree(data) {
    const statRows = data.stats.map((stat) => `<li><span class="hud-tree-key">${escapeHtml(stat.label)}</span><span class="hud-tree-value">${escapeHtml(stat.formula)}</span></li>`).join("");
    const resourceRows = data.pointPools.map((resource) => `<li><span class="hud-tree-key">${escapeHtml(resource.label)}</span><span class="hud-tree-value">${escapeHtml(resource.display)}</span></li>`).join("");
    return `
        <div class="hud-tree-block">
            <div class="hud-section-title">Stats</div>
            <ul class="hud-tree-children hud-tree-compact">${statRows || '<li class="hud-empty-row">None</li>'}</ul>
        </div>
        <div class="hud-tree-block">
            <div class="hud-section-title">Resources</div>
            <ul class="hud-tree-children hud-tree-compact">${resourceRows || '<li class="hud-empty-row">None</li>'}</ul>
        </div>
    `;
}

function buildEquippedTree(data) {
    const equippedWeaponRows = data.equippedWeapons.length
        ? buildTreeList(data.equippedWeapons, (weapon) => {
            const profileButtons = weapon.attackProfiles.map((profile) => `
                <button
                    type="button"
                    class="hud-mini-button${profile.key === weapon.activeAttackProfile ? " is-active" : ""}"
                    data-hud-weapon-profile="${escapeHtml(weapon.id)}"
                    data-hud-profile-key="${escapeHtml(profile.key)}"
                >
                    ${escapeHtml(profile.label)}
                </button>
            `).join("");
            const ammoButtons = weapon.usesAmmo
                ? weapon.compatibleAmmo.length
                    ? weapon.compatibleAmmo.map((ammo) => `
                        <button
                            type="button"
                            class="hud-mini-button${ammo.id === (weapon.selectedAmmoId ?? weapon.loadedAmmoId) ? " is-active" : ""}"
                            data-hud-weapon-ammo="${escapeHtml(weapon.id)}"
                            data-hud-ammo-id="${escapeHtml(ammo.id)}"
                            data-hud-profile-id="${escapeHtml(weapon.activeAttackProfileId ?? "")}"
                        >
                            ${escapeHtml(`${ammo.name} x${ammo.quantity}`)}
                        </button>
                    `).join("")
                    : `<span class="hud-empty-pill">No compatible ammo</span>`
                : "";

            return `
                <li class="hud-tree-item hud-weapon-card">
                    <div class="hud-row-main">${escapeHtml(weapon.name)}</div>
                    <div class="hud-row-sub">${escapeHtml([weapon.ready ? "Ready" : (weapon.equipped ? "Equipped" : "Stowed"), weapon.type, weapon.rangeSummary ? `Range ${weapon.rangeSummary}` : ""].filter(Boolean).join(" - "))}</div>
                    <div class="hud-weapon-action-strip">
                        <button
                            type="button"
                            class="hud-mini-button hud-mini-button-primary"
                            data-hud-weapon-attack="${escapeHtml(weapon.id)}"
                        >
                            Attack
                        </button>
                        ${weapon.usesAmmo ? `
                            <button
                                type="button"
                                class="hud-mini-button"
                                data-hud-weapon-reload="${escapeHtml(weapon.id)}"
                            >
                                Reload
                            </button>
                        ` : ""}
                        ${weapon.type === "Unarmed" || weapon.name === "Unarmed" ? "" : `
                            <button
                                type="button"
                                class="hud-mini-button"
                                data-hud-item-unequip="${escapeHtml(weapon.id)}"
                            >
                                Unequip
                            </button>
                        `}
                    </div>
                    <div class="hud-weapon-action-status ${weapon.attackState?.status === "valid" ? "is-valid" : "is-invalid"}">${escapeHtml(weapon.attackState?.label || "Unavailable")}</div>
                    <div class="hud-row-sub">${escapeHtml(weapon.attackState?.reason || "")}</div>
                    <ul class="hud-tree-children hud-tree-compact">
                        <li><span class="hud-tree-key">Active</span><span class="hud-tree-value">${escapeHtml(weapon.activeAttackFormula || "-")}</span></li>
                        ${weapon.usesAmmo ? `<li><span class="hud-tree-key">Loaded Ammo</span><span class="hud-tree-value">${escapeHtml(weapon.loadedAmmoName ? `${weapon.loadedAmmoName} (${weapon.ammoLoaded})` : "None")}</span></li>` : ""}
                        ${weapon.usesAmmo && weapon.activeAttackAmmoText ? `<li><span class="hud-tree-key">Allowed Ammo</span><span class="hud-tree-value">${escapeHtml(weapon.activeAttackAmmoText)}</span></li>` : ""}
                    </ul>
                    <div class="hud-weapon-controls">
                        <div class="hud-weapon-control-group">
                            <div class="hud-weapon-control-label">Profiles</div>
                            <div class="hud-chip-row">${profileButtons}</div>
                        </div>
                        ${weapon.usesAmmo ? `
                            <div class="hud-weapon-control-group">
                                <div class="hud-weapon-control-label">Ammo</div>
                                <div class="hud-chip-row">${ammoButtons}</div>
                            </div>
                        ` : ""}
                    </div>
                </li>
            `;
        })
        : `<li class="hud-empty-row">No equipped weapons</li>`;

    const equippedArmorRows = data.equippedArmor.length
        ? buildTreeList(data.equippedArmor, (armor) => `
            <li class="hud-tree-item">
                <div class="hud-row-main">${escapeHtml(armor.name)}</div>
                <div class="hud-row-sub">${escapeHtml(armor.defense || armor.type || "Equipped")}</div>
                <div class="hud-weapon-action-strip">
                    <button
                        type="button"
                        class="hud-mini-button"
                        data-hud-item-unequip="${escapeHtml(armor.id)}"
                    >
                        Unequip
                    </button>
                </div>
            </li>
        `)
        : `<li class="hud-empty-row">No equipped armor</li>`;

    const equippedItemGroups = groupEntries(
        data.equippedInventory.filter((item) => item.itemKind !== "weapon" && item.itemKind !== "armor"),
        (item) => item.group || "Other Gear"
    );
    const equippedItemRows = buildGroupedTree(equippedItemGroups, (item) => {
        const status = [item.type, item.ready ? "Ready" : (item.equipped ? "Equipped" : ""), item.consumable ? "Usable" : ""].filter(Boolean);
        return `
            <li class="hud-tree-item">
                <div class="hud-row-main">${escapeHtml(item.name)}</div>
                ${status.length ? `<ul class="hud-tree-children"><li>${escapeHtml(status.join(" - "))}</li></ul>` : ""}
                <div class="hud-weapon-action-strip">
                    <button
                        type="button"
                        class="hud-mini-button"
                        data-hud-item-unequip="${escapeHtml(item.id)}"
                    >
                        Unequip
                    </button>
                </div>
            </li>
        `;
    }, { scroll: true });

    return `
        <div class="hud-tree-block">
            <div class="hud-section-title">Equipped Weapons</div>
            <ul class="hud-list hud-tree-list">${equippedWeaponRows}</ul>
        </div>
        <div class="hud-tree-block">
            <div class="hud-section-title">Equipped Armor</div>
            <ul class="hud-list hud-tree-list">${equippedArmorRows}</ul>
        </div>
        <div class="hud-tree-block">
            <div class="hud-section-title">Equipped Gear</div>
            <div class="hud-group-stack">${equippedItemRows}</div>
        </div>
    `;
}

function buildInventoryTree(data) {
    const filterOptions = getInventoryFilterOptions();
    const activeFilter = filterOptions.some((option) => option.normalizedValue === normalizeInventoryFilterValue(HUD_STATE.inventoryFilter))
        ? HUD_STATE.inventoryFilter
        : "all";
    const filteredItems = data.inventory.filter((item) => matchesInventoryFilter(item, activeFilter));
    const inventoryGroups = groupEntries(filteredItems, (item) => item.group || "Other Gear");

    const filterControl = `
        <div class="hud-tree-block hud-inventory-filter-bar">
            <label class="hud-counter-roll-config">
                <span>Filter</span>
                <select data-hud-inventory-filter>
                    ${filterOptions.map((option) => `
                        <option value="${escapeHtml(option.value)}"${option.value === activeFilter ? " selected" : ""}>${escapeHtml(option.label)}</option>
                    `).join("")}
                </select>
            </label>
        </div>
    `;

    const inventoryRows = buildGroupedTree(inventoryGroups, (item) => {
        const status = [
            item.type,
            item.consumable ? "Usable" : ""
        ].filter(Boolean);
        const readyButton = item.itemKind === "weapon"
            ? `
                <div class="hud-weapon-action-strip">
                    <button
                        type="button"
                        class="hud-mini-button"
                        data-hud-weapon-ready="${escapeHtml(item.id)}"
                    >
                        Ready
                    </button>
                </div>
            `
            : "";

        return `
            <li class="hud-tree-item">
                <div class="hud-row-main">${escapeHtml(item.name)}</div>
                ${status.length ? `<ul class="hud-tree-children"><li>${escapeHtml(status.join(" - "))}</li></ul>` : ""}
                ${readyButton}
            </li>
        `;
    }, { scroll: true });

    return `
        ${filterControl}
        <div class="hud-tree-block">
            <div class="hud-section-title">Inventory</div>
            <div class="hud-group-stack">${inventoryRows}</div>
        </div>
    `;
}
function buildConditionTree(data) {
    return buildTreeList(data.conditions, (condition) => `
        <li class="hud-tree-item">
            <div class="hud-row-main">${escapeHtml(condition)}</div>
        </li>
    `);
}

function buildOverviewTree(data) {
    const previewStat = getStatPreview(data);
    const equippedRows = [];
    for (const weapon of data.equippedWeapons) {
        const weaponValue = [
            weapon.ready ? "Ready" : "Equipped",
            weapon.rangeSummary ? `R ${weapon.rangeSummary}` : ""
        ].filter(Boolean).join(" - ");
        equippedRows.push(`<li><span class="hud-tree-key">${escapeHtml(weapon.name)}</span><span class="hud-tree-value">${escapeHtml(weaponValue)}</span></li>`);
    }
    for (const armor of data.equippedArmor) {
        equippedRows.push(`<li><span class="hud-tree-key">${escapeHtml(armor.name)}</span><span class="hud-tree-value">${escapeHtml(armor.defense || "Equipped")}</span></li>`);
    }

    const statusRows = data.conditions.map((condition) => `<li><span class="hud-tree-key">${escapeHtml(condition)}</span><span class="hud-tree-value">Active</span></li>`);

    const hpDisplay = formatCurrentMax(data.hitPoints, data.maxHitPoints);
    const pointRows = data.pointPools.map((resource) => `
        <li class="hud-point-cell">
            <span class="hud-tree-key">${escapeHtml(resource.label)}</span>
            <span class="hud-tree-value">${escapeHtml(resource.display)}</span>
        </li>
    `).join("");
    const riskRows = data.riskAndCritical.map((resource) => `
        <li><span class="hud-tree-key">${escapeHtml(resource.label)}</span><span class="hud-tree-value">${escapeHtml(resource.display)}</span></li>
    `).join("");
    const rangedWeapons = data.equippedWeapons.filter((weapon) => weapon.rangeSummary);
    const rangeLegend = rangedWeapons.length ? `
        <div class="hud-tree-block">
            <div class="hud-section-title">Range Bands</div>
            <div class="hud-pill-row">
                <span class="hud-pill"><span class="hud-pill-label">Short</span><span class="hud-pill-value">Normal</span></span>
                <span class="hud-pill"><span class="hud-pill-label">Long</span><span class="hud-pill-value">Disadvantage</span></span>
                <span class="hud-pill"><span class="hud-pill-label">Max</span><span class="hud-pill-value">Maneuvers</span></span>
            </div>
            <ul class="hud-tree-children hud-tree-compact">
                ${rangedWeapons.map((weapon) => `<li><span class="hud-tree-key">${escapeHtml(weapon.name)}</span><span class="hud-tree-value">${escapeHtml(weapon.rangeSummary)}</span></li>`).join("")}
            </ul>
        </div>
    ` : "";

    return `
        <div class="hud-overview-grid">
            <div class="hud-tree-block hud-overview-block hud-overview-block-hp">
                <div class="hud-section-title">HP</div>
                <div class="hud-overview-value">${escapeHtml(hpDisplay || "-")}</div>
            </div>
            <div class="hud-tree-block hud-overview-block">
                <div class="hud-section-title">Points</div>
                <ul class="hud-tree-children hud-tree-compact hud-points-grid">${pointRows || '<li class="hud-empty-row">None</li>'}</ul>
            </div>
            <div class="hud-tree-block hud-overview-block hud-overview-block-risk">
                <div class="hud-section-title">Risk & Crit</div>
                <ul class="hud-tree-children hud-tree-compact">${riskRows || '<li class="hud-empty-row">None</li>'}</ul>
            </div>
        </div>
        ${buildStatPreview(previewStat, data.rollContext)}
        ${rangeLegend}
        <div class="hud-tree-block">
            <div class="hud-section-title">Equipped</div>
            <ul class="hud-tree-children hud-tree-compact">${equippedRows.join("") || '<li class="hud-empty-row">None</li>'}</ul>
        </div>
        <div class="hud-tree-block">
            <div class="hud-section-title">Status</div>
            <ul class="hud-tree-children hud-tree-compact">${statusRows.join("") || '<li class="hud-empty-row">None</li>'}</ul>
        </div>
    `;
}

function buildCounterRollControls() {
    const checked = HUD_STATE.counterRollEnabled ? " checked" : "";
    return `
        <div class="hud-tree-block hud-counter-roll-bar">
            <label class="hud-counter-roll-toggle">
                <input type="checkbox" data-hud-counter-enabled${checked}>
                <span>Counter Roll</span>
            </label>
            <label class="hud-counter-roll-config">
                <span>Difficulty</span>
                <input
                    type="number"
                    min="1"
                    max="10"
                    step="1"
                    value="${escapeHtml(sanitizeCounterRollDice(HUD_STATE.counterRollDice))}"
                    data-hud-counter-dice
                >
                <span>d6</span>
            </label>
        </div>
    `;
}

function getCategoryDefinitions(data) {
    return [
        { key: "overview", label: "Overview", count: null },
        { key: "stats", label: "Stats", count: data.stats.length },
        {
            key: "equipped",
            label: "Equipped",
            count: data.equippedWeapons.length + data.equippedArmor.length + data.equippedInventory.filter((item) => item.itemKind !== "weapon" && item.itemKind !== "armor").length
        },
        { key: "inventory", label: "Inventory", count: data.inventory.length },
        { key: "maneuvers", label: "Maneuvers", count: data.maneuverCount },
        { key: "skills", label: "Skills", count: data.skills.length },
        { key: "conditions", label: "Conditions", count: data.conditions.length }
    ];
}

function buildCategoryContent(data, activeCategory) {
    switch (activeCategory) {
        case "overview":
            return buildOverviewTree(data);
        case "stats":
            return (() => {
                const previewStat = getStatPreview(data);
                return `${buildCounterRollControls()}<ul class="hud-list hud-tree-list hud-stat-grid">
                ${buildTreeList(data.stats, (stat) => `
                    <li class="hud-tree-item${stat.label === previewStat?.label ? " is-active" : ""}">
                        <button type="button" class="hud-action-row${stat.label === previewStat?.label ? " is-active" : ""}" data-hud-stat="${escapeHtml(stat.label)}">
                            <span class="hud-row-main">${escapeHtml(stat.label)}</span>
                            <span class="hud-tree-value">${escapeHtml(stat.formula)}</span>
                        </button>
                    </li>
                `)}
            </ul>`;
            })();
        case "equipped":
            return buildEquippedTree(data);
        case "inventory":
            return buildInventoryTree(data);
        case "maneuvers":
            return (() => {
                const maneuverGroups = getManeuverGroups(data);
                if (!maneuverGroups.length) {
                    return `<div class="hud-empty-row">None</div>`;
                }
                const activeGroup = maneuverGroups.some(([label]) => label === HUD_STATE.activeManeuverGroup)
                    ? HUD_STATE.activeManeuverGroup
                    : maneuverGroups[0][0];
                const [, activeEntries] = maneuverGroups.find(([label]) => label === activeGroup) ?? maneuverGroups[0];
                const groupTabs = maneuverGroups.map(([label, entries]) => `
                    <button
                        type="button"
                        class="hud-subgroup-tab${label === activeGroup ? " is-active" : ""}"
                        data-hud-maneuver-group="${escapeHtml(label)}"
                    >
                        <span>${escapeHtml(label)}</span>
                        <span class="hud-category-count">${escapeHtml(entries.length)}</span>
                    </button>
                `).join("");

                return `
                    <div class="hud-tree-block hud-sticky-subgroups">
                        <div class="hud-subgroup-row">${groupTabs}</div>
                    </div>
                    <div class="hud-tree-block">
                        <ul class="hud-list hud-tree-list hud-list-scroll hud-single-scroll">
                            ${buildTreeList(activeEntries, (maneuver) => `
                                <li class="hud-tree-item">
                                    <div class="hud-row-main">${escapeHtml(maneuver.name)}</div>
                                    <div class="hud-row-sub">${escapeHtml(maneuver.timing || "") }</div>
                                </li>
                            `)}
                        </ul>
                    </div>
                `;
            })();
        case "skills":
            return `${buildCounterRollControls()}<ul class="hud-list hud-tree-list hud-list-scroll hud-single-scroll">
                ${buildTreeList(data.skills, (skill) => `
                    <li class="hud-tree-item">
                        <button type="button" class="hud-action-row" data-hud-skill="${escapeHtml(skill.name)}">
                            <span class="hud-row-main">${escapeHtml(skill.name)}</span>
                            <span class="hud-row-sub">${escapeHtml([skill.group, skill.linkedStat, `L${skill.currentLevel}`].filter(Boolean).join(" - "))}</span>
                            ${skill.formula ? `<span class="hud-tree-value">${escapeHtml(skill.formula)}</span>` : ""}
                        </button>
                    </li>
                `)}
            </ul>`;
        case "conditions":
            return `<ul class="hud-list hud-tree-list">${buildConditionTree(data)}</ul>`;
        default:
            return buildStatsTree(data);
    }
}

function buildHudHtml(data) {
    const categories = getCategoryDefinitions(data);
    const activeCategory = categories.some((category) => category.key === HUD_STATE.activeCategory)
        ? HUD_STATE.activeCategory
        : categories[0].key;
    const targetToggle = "";
    const sideReadyButton = data.isCombatActive ? `
        <button
            type="button"
            class="hud-category-tab"
            data-hud-side-ready
            title="Announce that your side is ready"
            aria-label="Announce that your side is ready"
        >
            <span>Side Ready</span>
        </button>
    ` : "";
    const categoryTabs = categories.map((category) => `
        <button
            type="button"
            class="hud-category-tab${category.key === activeCategory ? " is-active" : ""}"
            data-hud-category="${escapeHtml(category.key)}"
        >
            <span>${escapeHtml(category.label)}</span>
            ${category.count === null ? "" : `<span class="hud-category-count">${escapeHtml(category.count)}</span>`}
        </button>
    `).join("");

    return `
        <section class="hud-shell${HUD_STATE.collapsed ? " is-collapsed" : ""}">
            <header class="hud-header">
                <img class="hud-portrait" src="${escapeHtml(data.actorImg)}" alt="${escapeHtml(data.tokenName)}">
                <div class="hud-header-text">
                    <div class="hud-title">${escapeHtml(data.tokenName)}</div>
                    <div class="hud-subtitle">
                        ${data.isCombatActive ? `Combat round ${escapeHtml(data.round ?? "-")}` : "No active combat"}
                    </div>
                </div>
                <button
                    type="button"
                    class="hud-collapse-button"
                    data-hud-collapse-toggle
                    title="${HUD_STATE.collapsed ? "Expand HUD" : "Collapse HUD"}"
                    aria-label="${HUD_STATE.collapsed ? "Expand HUD" : "Collapse HUD"}"
                >
                    <i class="fa-solid ${HUD_STATE.collapsed ? "fa-angles-right" : "fa-angles-left"}"></i>
                </button>
            </header>

            ${buildReactionPrompt()}

            ${HUD_STATE.collapsed ? "" : `
            <section class="hud-section">
                <div class="hud-category-row">${sideReadyButton}${categoryTabs}</div>
            </section>

            <section class="hud-section hud-tree-panel">
                ${buildCategoryContent(data, activeCategory)}
            </section>
            `}
        </section>
    `;
}

function buildEmptyHtml(message = "No token selected") {
    return `
        <section class="hud-shell hud-empty-state">
            <div class="hud-title">1547 HUD</div>
            <div class="hud-subtitle">${escapeHtml(message)}</div>
        </section>
    `;
}

function getSelectedToken() {
    return canvas?.tokens?.controlled?.[0] ?? null;
}

function ensureHudRoot() {
    let root = document.getElementById(HUD_ROOT_ID);
    if (!root) {
        root = document.createElement("section");
        root.id = HUD_ROOT_ID;
        root.className = "actor-hud-1547";
        document.body.appendChild(root);
    }
    window.__1547HudRoot = root;
    return root;
}

function getVisibleRect(selector) {
    const element = document.querySelector(selector);
    if (!element) return null;
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") return null;
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return rect;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function computeHudPlacement() {
    const controlsRect = getVisibleRect("#controls");
    const scenesRect = getVisibleRect("#scene-navigation");
    const blockerRects = [controlsRect, scenesRect].filter(Boolean);

    const viewportWidth = window.innerWidth;
    const preferredLeft = blockerRects.length
        ? Math.max(...blockerRects.map((rect) => rect.right)) + HUD_GAP
        : HUD_GAP;

    const preferredTop = scenesRect
        ? Math.max(HUD_TOP_MARGIN, scenesRect.top)
        : controlsRect
            ? Math.max(HUD_TOP_MARGIN, controlsRect.top)
            : HUD_TOP_MARGIN;

    const maxWidth = Math.min(HUD_MAX_WIDTH, viewportWidth - preferredLeft - HUD_GAP);
    const width = Math.max(HUD_MIN_WIDTH, maxWidth);
    const left = clamp(preferredLeft, HUD_GAP, Math.max(HUD_GAP, viewportWidth - width - HUD_GAP));

    return {
        left,
        top: preferredTop,
        width
    };
}

function applyHudPlacement(root) {
    const { left, top, width } = computeHudPlacement();
    Object.assign(root.style, {
        position: "fixed",
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        zIndex: String(HUD_Z_INDEX),
        pointerEvents: "auto",
        display: "block",
        visibility: "visible",
        opacity: "1"
    });
}

async function renderHudForSelection() {
    const token = getSelectedToken();
    const root = ensureHudRoot();

    if (!token?.actor) {
        root.innerHTML = buildEmptyHtml();
        applyHudPlacement(root);
        clearThreatOverlay();
        return;
    }

    root.dataset.actorId = token.actor.id;
    root.innerHTML = buildHudHtml(summarizeActor(token.actor, token));
    applyHudPlacement(root);
    clearThreatOverlay();
    for (const select of root.querySelectorAll("[data-hud-inventory-filter]")) {
        select.addEventListener("change", (event) => {
            HUD_STATE.inventoryFilter = event.currentTarget.value || "all";
            void renderHudForSelection();
        });
    }
    for (const button of root.querySelectorAll("[data-hud-category]")) {
        button.addEventListener("click", (event) => {
            const category = event.currentTarget.dataset.hudCategory;
            if (!category || category === HUD_STATE.activeCategory) return;
            HUD_STATE.activeCategory = category;
            void renderHudForSelection();
        });
    }
    for (const button of root.querySelectorAll("[data-hud-collapse-toggle]")) {
        button.addEventListener("click", () => {
            HUD_STATE.collapsed = !HUD_STATE.collapsed;
            void renderHudForSelection();
        });
    }
    for (const button of root.querySelectorAll("[data-hud-side-ready]")) {
        button.addEventListener("click", async () => {
            await announceSideReady(token?.actor, token);
        });
    }
    for (const button of root.querySelectorAll("[data-hud-reaction-choice]")) {
        button.addEventListener("click", (event) => {
            const choiceId = event.currentTarget.dataset.hudReactionChoice;
            const reactionWindow = getActiveReactionWindow();
            if (!reactionWindow || !choiceId) return;
            reactionWindow.selectReaction(choiceId);
            clearHudReactionWindow();
            void renderHudForSelection();
        });
    }
    for (const button of root.querySelectorAll("[data-hud-reaction-pass]")) {
        button.addEventListener("click", () => {
            const reactionWindow = getActiveReactionWindow();
            if (!reactionWindow) return;
            reactionWindow.passReaction();
            clearHudReactionWindow();
            void renderHudForSelection();
        });
    }
    for (const button of root.querySelectorAll("[data-hud-maneuver-group]")) {
        button.addEventListener("click", (event) => {
            const group = event.currentTarget.dataset.hudManeuverGroup;
            if (!group || group === HUD_STATE.activeManeuverGroup) return;
            HUD_STATE.activeManeuverGroup = group;
            void renderHudForSelection();
        });
    }
    for (const button of root.querySelectorAll("[data-hud-stat]")) {
        button.addEventListener("click", async (event) => {
            const stat = event.currentTarget.dataset.hudStat;
            if (!stat) return;
            const context = buildHudActionContext(token?.actor, token);
            const descriptor = createStatActionDescriptor(context, stat);
            await runHudAction(descriptor, context);
            void renderHudForSelection();
        });
    }
    for (const button of root.querySelectorAll("[data-hud-skill]")) {
        button.addEventListener("click", async (event) => {
            const skill = event.currentTarget.dataset.hudSkill;
            if (!skill) return;
            const context = buildHudActionContext(token?.actor, token);
            const descriptor = createSkillActionDescriptor(context, skill);
            await runHudAction(descriptor, context);
            void renderHudForSelection();
        });
    }
    for (const button of root.querySelectorAll("[data-hud-weapon-attack]")) {
        button.addEventListener("click", async (event) => {
            const weaponId = event.currentTarget.dataset.hudWeaponAttack;
            if (!weaponId || !token?.actor) return;
            const context = buildHudActionContext(token.actor, token);
            const descriptor = createWeaponAttackActionDescriptor(context, weaponId);
            await runHudAction(descriptor, context);
            void renderHudForSelection();
        });
    }
    for (const button of root.querySelectorAll("[data-hud-weapon-reload]")) {
        button.addEventListener("click", async (event) => {
            const weaponId = event.currentTarget.dataset.hudWeaponReload;
            if (!weaponId || !token?.actor) return;
            const context = buildHudActionContext(token.actor, token);
            await executeWeaponReloadAction(weaponId, token.actor, context.summary);
            void renderHudForSelection();
        });
    }
    for (const button of root.querySelectorAll("[data-hud-weapon-ready]")) {
        button.addEventListener("click", async (event) => {
            const weaponId = event.currentTarget.dataset.hudWeaponReady;
            if (!weaponId || !token?.actor) return;
            const context = buildHudActionContext(token.actor, token);
            await executeWeaponReadyAction(weaponId, token.actor, context.summary);
            void renderHudForSelection();
        });
    }
    for (const button of root.querySelectorAll("[data-hud-item-unequip]")) {
        button.addEventListener("click", async (event) => {
            const itemId = event.currentTarget.dataset.hudItemUnequip;
            if (!itemId || !token?.actor) return;
            const context = buildHudActionContext(token.actor, token);
            await executeItemUnequipAction(itemId, token.actor, context.summary);
            void renderHudForSelection();
        });
    }
    for (const button of root.querySelectorAll("[data-hud-weapon-profile]")) {
        button.addEventListener("click", async (event) => {
            const weaponId = event.currentTarget.dataset.hudWeaponProfile;
            const profileKey = event.currentTarget.dataset.hudProfileKey;
            if (!weaponId || !profileKey || !token?.actor) return;
            const weaponItem = token.actor.items?.get?.(weaponId);
            if (!weaponItem?.update) return;

            const context = buildHudActionContext(token.actor, token);
            const weaponSummary = context.summary.equippedWeapons.find((entry) => entry.id === weaponId) ?? null;
            const nextProfile = weaponSummary?.attackProfiles?.find((profile) => profile.key === profileKey) ?? null;
            const selectedAmmoId = HUD_STATE.selectedAmmoByWeapon?.[weaponId] ?? null;
            if (weaponSummary && nextProfile && selectedAmmoId) {
                const selectedAmmo = weaponSummary.compatibleAmmo.find((ammo) => ammo.id === selectedAmmoId) ?? null;
                const allowedAmmoTypes = Array.isArray(nextProfile.allowedAmmoTypes) ? nextProfile.allowedAmmoTypes : [];
                if (selectedAmmo && allowedAmmoTypes.length && !allowedAmmoTypes.includes(selectedAmmo.ammoType)) {
                    delete HUD_STATE.selectedAmmoByWeapon[weaponId];
                }
            }

            await weaponItem.update({
                "system.props.ActiveAttackProfile": profileKey
            });
            void renderHudForSelection();
        });
    }
    for (const button of root.querySelectorAll("[data-hud-weapon-ammo]")) {
        button.addEventListener("click", async (event) => {
            const weaponId = event.currentTarget.dataset.hudWeaponAmmo;
            const ammoId = event.currentTarget.dataset.hudAmmoId;
            if (!weaponId || !ammoId || !token?.actor) return;
            HUD_STATE.selectedAmmoByWeapon[weaponId] = ammoId;
            void renderHudForSelection();
        });
    }
    for (const input of root.querySelectorAll("[data-hud-counter-enabled]")) {
        input.addEventListener("change", (event) => {
            HUD_STATE.counterRollEnabled = Boolean(event.currentTarget.checked);
        });
    }
    for (const input of root.querySelectorAll("[data-hud-counter-dice]")) {
        input.addEventListener("change", (event) => {
            HUD_STATE.counterRollDice = sanitizeCounterRollDice(event.currentTarget.value);
            event.currentTarget.value = String(HUD_STATE.counterRollDice);
        });
    }
}

async function maybeRollCounter(context, label, playerTotal) {
    if (!context.counterRollEnabled) return;

    const counterDice = sanitizeCounterRollDice(context.counterRollDice);
    const counterFormula = `${counterDice}d6`;
    const counterRoll = await new Roll(counterFormula).evaluate({ async: true });
    const speaker = ChatMessage.getSpeaker({ actor: context.actor, token: context.token?.document });
    const success = Number(playerTotal) >= Number(counterRoll.total);
    const resultText = success ? "Success" : "Failure";

    await counterRoll.toMessage({
        speaker,
        flavor: `${label} Counter Roll<br>Difficulty: ${escapeHtml(counterFormula)}<br>Player Total: ${escapeHtml(playerTotal)}<br>Outcome: ${resultText}`
    });

    HUD_STATE.counterRollEnabled = false;
}

async function announceSideReady(actor, token) {
    if (!game.combat?.started) {
        ui.notifications?.warn?.("Combat is not active.");
        return;
    }

    const speaker = ChatMessage.getSpeaker({ actor, token: token?.document });
    const callerName = game.user?.name || "A player";
    const actorName = token?.name || actor?.name || "Selected actor";
    const targetCount = Array.from(game.user?.targets ?? []).length;
    const targetText = targetCount > 0
        ? `<br>Current targets marked in Foundry: ${escapeHtml(targetCount)}`
        : "";

    await ChatMessage.create({
        speaker,
        content: `<strong>${escapeHtml(callerName)}</strong> calls <strong>Side Ready</strong> for ${escapeHtml(actorName)}.${targetText}`
    });
}

function rerenderHudIfViewingActor(actorId) {
    const token = getSelectedToken();
    if (!token?.actor || token.actor.id !== actorId) return;
    void renderHudForSelection();
}

function scheduleHudRerender() {
    window.requestAnimationFrame(() => {
        void renderHudForSelection();
    });
}

export function register1547ActorHud() {
    ensureHudRoot().innerHTML = buildEmptyHtml("Waiting for selection");

    onCombatEvent(COMBAT_EVENTS.REACTION_WINDOW_OPENED, (event) => {
        setHudReactionWindow(event.payload);
        void renderHudForSelection();
        return null;
    });
    onCombatEvent(COMBAT_EVENTS.REACTION_RESOLVED, () => {
        clearHudReactionWindow();
        void renderHudForSelection();
        return null;
    });

    Hooks.on("controlToken", () => void renderHudForSelection());
    Hooks.on("hoverToken", (token, hovered) => {
        if (hovered) {
            renderThreatOverlay(token);
            return;
        }
        clearThreatOverlay();
    });
    Hooks.on("canvasReady", () => {
        clearThreatOverlay();
        void renderHudForSelection();
    });
    Hooks.on("deleteToken", () => {
        clearThreatOverlay();
        void renderHudForSelection();
    });
    Hooks.on("updateActor", (actor) => rerenderHudIfViewingActor(actor.id));
    Hooks.on("createItem", (item) => rerenderHudIfViewingActor(item.parent?.id));
    Hooks.on("updateItem", (item) => rerenderHudIfViewingActor(item.parent?.id));
    Hooks.on("deleteItem", (item) => rerenderHudIfViewingActor(item.parent?.id));
    Hooks.on("updateCombat", () => void renderHudForSelection());
    Hooks.on("renderSceneNavigation", scheduleHudRerender);
    Hooks.on("renderSceneControls", scheduleHudRerender);
    Hooks.on("collapseSidebar", scheduleHudRerender);

    window.addEventListener("resize", scheduleHudRerender, { passive: true });
    void renderHudForSelection();
}































