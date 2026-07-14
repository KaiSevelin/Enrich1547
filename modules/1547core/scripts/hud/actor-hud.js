import { COMBAT_EVENTS, onCombatEvent } from "../services/combat-events.js";
import {
    DICE_TAB_ATTACK_OPTIONS,
    DICE_TAB_DEFENSE_OPTIONS,
    isUnarmedWeapon,
    getWeaponReach,
    getWeaponRangeBands,
    getChebyshevDistanceSquares,
    hasReach,
    hasRangeBands,
    getWeaponAttackProfiles,
    getWeaponActiveAttackProfile,
    buildFoundryAttackRollFormula,
    getAmmoQuantity,
    getAmmoType,
    getAmmoSummary,
    getWeaponAttackState,
} from "../combat/weapon-state.mjs";
import { relayPostManeuverWindow } from "../combat/post-maneuver-relay.js";
import { escapeHtml } from "../lib/foundry-utils.mjs";
import {
    HUD_STATE,
    getReactionWindowState,
    setReactionWindowState,
    clearReactionWindowState,
    syncManeuverFilterContext,
    getSelectedPreManeuverIds,
    setSelectedPreManeuverIds,
    clearSelectedPreManeuvers,
    toggleSelectedPreManeuver,
    getCoreStackCount,
    adjustCoreStackCount,
    getSelectedFullTurnManeuverId,
    clearSelectedFullTurnManeuver,
    toggleSelectedFullTurnManeuver,
    clearActorManeuverSelections,
    getSelectedReactionChoiceId,
    toggleSelectedReactionChoiceId,
    normalizePostManeuverChoiceId,
    getActivePostManeuverWindow,
    queuePostManeuverWindow,
    advancePostManeuverWindow,
    releaseDeferredPostManeuverWindows,
    getSelectedPostManeuverId,
    toggleSelectedPostManeuver,
    getActiveDamageTakenWindow,
    setHudDamageTakenWindow,
    clearHudDamageTakenWindow,
    getDiceTabAttackSelection,
    setDiceTabAttackSelectionCount,
    clearDiceTabAttackSelection,
    getDiceTabDefenseSelection,
    setDiceTabDefenseSelectionCount,
    clearDiceTabDefenseSelection,
    getPendingNextAttackDice,
    setPendingNextAttackDice,
    clearPendingNextAttackDice,
    getDiceTabSkillDice,
    setDiceTabSkillDice,
    clearDiceTabSkillDice,
    getPendingNextSkillDice,
    setPendingNextSkillDice,
    clearPendingNextSkillDice,
    clearIgnoredCostManeuver,
    clearIgnoredCostManeuvers,
    getIgnoredCostManeuverIds,
    setIgnoredCostManeuver,
} from "./hud-state.js";
import {
    summarizeActor as summarizeActorFromModule,
    summarizeManeuverEffects,
    buildWeaponRollContext,
} from "./hud-summary.js";
import {
    buildReactionPrompt as buildReactionPromptFromModule,
    buildDamageTakenPrompt as buildDamageTakenPromptFromModule,
    buildPostManeuverPrompt as buildPostManeuverPromptFromModule,
} from "./hud-prompts.js";
import {
    executeSelectedFullTurnManeuver as executeSelectedFullTurnManeuverFromModule,
    executeWeaponReloadAction as executeWeaponReloadActionFromModule,
    executeWeaponReadyAction as executeWeaponReadyActionFromModule,
    executeItemUnequipAction as executeItemUnequipActionFromModule,
    runHudAction as runHudActionFromModule,
} from "./hud-actions.js";
import {
    buildHudActionContext as buildHudActionContextFromModule,
    createStatActionDescriptor as createStatActionDescriptorFromModule,
    createSkillActionDescriptor as createSkillActionDescriptorFromModule,
    createWeaponAttackActionDescriptor as createWeaponAttackActionDescriptorFromModule,
    evaluateHudAction as evaluateHudActionFromModule,
} from "./hud-evaluation.js";
import {
    buildHudHtml as buildHudHtmlFromModule,
    buildEmptyHtml as buildEmptyHtmlFromModule,
} from "./hud-render.js";
import { bindHudInteractions as bindHudInteractionsFromModule } from "./hud-bindings.js";
import { MODULE_ID, SOURCE_FLAG_SCOPE } from "../lib/constants.mjs";
import { announceSideReady, bindSideAdvanceSocket } from "../combat-tracker/side-turn-flow.js";
import { renderThreatOverlay, clearThreatOverlay } from "./threat-overlay.js";
import { rollToChat } from "../lib/roll-chat.mjs";

const HUD_ROOT_ID = "1547core-actor-hud-root";
const HUD_GAP = 16;
const HUD_TOP_MARGIN = 16;
const HUD_MIN_WIDTH = 280;
const HUD_MAX_WIDTH = 420;
const HUD_Z_INDEX = 90;
const CSB_TEMPLATE_IDS = {
    armor: "uLlgZXz3GlXPFtsj",
    container: "l4j1zT3kpdkZmACQ",
    consumable: "PDxRO5ObvLaThpez",
    equippable: "eCIZRFXbcQVZKqEr",
    lightSource: "CmGj09PEdHfklGsT",
    maneuver: "4owc4YQBlp94GbGs",
    magicItem: "HkiFlUWUkUycJdBZ",
    pact: "HPYYc2P0Ouagicmr",
    supernaturalMark: "w9ky0ZTDvXDs5Ce7",
    monsterMagic: "M0nMgk7Yp2RsT5Vu",
    skill: "BbwVnEJobtCR5oOf",
    spell: "2kiWw3Cv5Zk1lZxn",
    ammunition: "389uqkKKn8M1SKux",
    weaponModifier: "WmP9Ld3Qs7Nk2FvR",
    unequippable: "woHyeHPKKdo4JDJd",
    usageEffect: "mwPqEYUoOfzXpyT9",
    weapon: "qZCfLEYQ7egbm1B9"
};
const MANEUVER_FILTER_OPTIONS = [
    { value: "all", label: "All" },
    { value: "pre", label: "Preparations" },
    { value: "full-turn", label: "Full turn actions" },
    { value: "post", label: "Criticals" },
    { value: "reaction", label: "Reactions" },
];
const MANEUVER_COST_SHORT_LABELS = {
    CorePoints: "CORE",
    CriticalPoints: "CRIT"
};
function getAttackDiceTabOptions() {
    return DICE_TAB_ATTACK_OPTIONS.map((option) => ({ ...option }));
}

function getDefenseDiceTabOptions() {
    return DICE_TAB_DEFENSE_OPTIONS.map((option) => ({ ...option }));
}

// Format a selection map ({key: count}) as "2de + 1da" over the given options.
function formatDiceSelectionLabel(diceMap = {}, options = []) {
    const parts = options.flatMap((option) => {
        const count = Math.max(0, Number(diceMap?.[option.key] ?? 0) || 0);
        return count > 0 ? [String(count) + "d" + option.code] : [];
    });
    return parts.join(" + ") || "0 dice";
}

function formatAttackDiceSelectionLabel(diceMap = {}) {
    return formatDiceSelectionLabel(diceMap, DICE_TAB_ATTACK_OPTIONS);
}

function formatDefenseDiceSelectionLabel(diceMap = {}) {
    return formatDiceSelectionLabel(diceMap, DICE_TAB_DEFENSE_OPTIONS);
}

function formatSkillD6SelectionLabel(count = 0) {
    const safeCount = Math.max(0, Number(count) || 0);
    return safeCount > 0 ? String(safeCount) + "d6" : "0d6";
}
function buildReservedResourceTotals(maneuvers) {
    return (Array.isArray(maneuvers) ? maneuvers : []).reduce((totals, maneuver) => {
        const costType = String(maneuver?.CostType ?? "").trim();
        const costAmount = Math.max(0, Number(maneuver?.CostAmount ?? 0) || 0);
        if (!costType || costType === "null" || costAmount <= 0) return totals;
        totals[costType] = (totals[costType] ?? 0) + costAmount;
        return totals;
    }, {});
}

function getManeuverCostSummary(maneuver) {
    const costType = String(maneuver?.CostType ?? "").trim();
    const costAmount = Math.max(0, Number(maneuver?.CostAmount ?? 0) || 0);
    if (!costType || costType === "null" || costAmount <= 0) return "No cost";
    const label = MANEUVER_COST_SHORT_LABELS[costType] ?? costType;
    return `${label} ${costAmount}`;
}

function getManeuverTimingSummary(maneuver) {
    const timing = String(maneuver?.TimingType ?? maneuver?.timing ?? maneuver?.timingKey ?? "").trim().toLowerCase();
    switch (timing) {
        case "pre": return "Pre maneuver";
        case "full-turn": return "Full-turn maneuver";
        case "post": return "Post maneuver";
        case "reaction": return "Reaction maneuver";
        default: return timing ? `${timing} maneuver` : "Maneuver";
    }
}

function getManeuverDurationSummary(maneuver) {
    const duration = String(maneuver?.Duration ?? maneuver?.duration ?? maneuver?.effectData?.duration ?? "").trim();
    switch (duration) {
        case "until-side-active-again": return "Lasts until your side is active again";
        case "until-side-active-again-or-consumed": return "Lasts until used or your side is active again";
        case "scene": return "Lasts for the scene";
        case "round": return "Lasts for the round";
        default: return duration ? `Duration: ${duration}` : "";
    }
}

function getManeuverRequirementSummary(maneuver) {
    const text = String(maneuver?.requirements?.text ?? "").trim();
    if (!text) return "";
    return `Needs: ${text}`;
}

function getManeuverEffectSummary(maneuver) {
    const effect = maneuver?.effectData ?? {};
    const parts = [];
    if (Number(effect.addMainDice ?? 0) > 0) parts.push(`+${effect.addMainDice} main die`);
    if (Number(effect.addMultiplierDice ?? 0) > 0) parts.push(`+${effect.addMultiplierDice} multiplier die`);
    if (Number(effect.addRiskDice ?? 0) > 0) parts.push(`+${effect.addRiskDice} risk die`);
    if (Number(effect.addMoveSquares ?? 0) > 0) parts.push(`+${effect.addMoveSquares} move`);
    if (effect.doubleMove === true) parts.push("Double move");
    if (Number(effect.reduceDamageTaken ?? 0) > 0) parts.push(`Reduce damage by ${effect.reduceDamageTaken}`);
    if (effect.ignoreHighestArmorDie === true) parts.push("Ignore highest armor die");
    if (effect.safeAttack === true || effect.createsSafeAttack === true) parts.push("Makes the attack safe");
    if (String(effect.createsPersistentEffect ?? "").trim()) {
        parts.push(`Creates ${getPersistentEffectLabel(effect.createsPersistentEffect)}`);
    }
    return parts.join("; ") || "No immediate effect";
}

function buildManeuverSummaryLine(maneuver) {
    return [
        getManeuverTimingSummary(maneuver),
        getManeuverCostSummary(maneuver),
        getManeuverEffectSummary(maneuver)
    ].filter(Boolean).join(" | ");
}

function buildManeuverDetailLine(maneuver) {
    return [
        getManeuverRequirementSummary(maneuver),
        getManeuverDurationSummary(maneuver)
    ].filter(Boolean).join(" | ");
}

function buildManeuverTooltip(maneuver, blockingReason = "") {
    return [
        String(blockingReason ?? "").trim(),
        buildManeuverSummaryLine(maneuver),
        buildManeuverDetailLine(maneuver)
    ].filter(Boolean).join(" | ");
}

const INVENTORY_FILTER_OPTIONS = [
    { value: "all", label: "All" },
    { value: "Item.389uqkKKn8M1SKux", label: "Ammunition" },
    { value: "Item.WmP9Ld3Qs7Nk2FvR", label: "Weapon Modifiers" },
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

function getManeuverFilterOptions() {
    return MANEUVER_FILTER_OPTIONS.map((option) => ({ ...option }));
}

function matchesManeuverFilter(maneuver, filterValue) {
    const normalized = String(filterValue ?? "all").trim().toLowerCase() || "all";
    if (normalized === "all") return true;
    return String(maneuver?.timingKey ?? "").trim().toLowerCase() === normalized;
}

function applyIgnoredCostOverride(maneuver, ignored = false) {
    if (!maneuver || !ignored) return maneuver;
    return {
        ...maneuver,
        CostType: "null",
        CostAmount: 0,
        ignoreCost: true,
    };
}

async function confirmManeuverCostSelection(maneuver) {
    const costType = String(maneuver?.CostType ?? "").trim();
    const costAmount = Math.max(0, Number(maneuver?.CostAmount ?? 0) || 0);
    if (!costType || costType === "null" || costAmount <= 0) {
        return { confirmed: true, ignoreCost: false };
    }

    return await new Promise((resolve) => {
        let settled = false;
        const content = "<form class=\"dialog-1547 dialog-1547-maneuver-confirm\">"
            + "<div class=\"dialog-1547-maneuver-confirm__eyebrow\">Maneuver Cost</div>"
            + "<div class=\"dialog-1547-maneuver-confirm__title\">" + escapeHtml(maneuver?.name ?? "Maneuver") + "</div>"
            + "<div class=\"dialog-1547-maneuver-confirm__body\">Selecting this maneuver normally reserves <strong>" + escapeHtml(getManeuverCostSummary(maneuver)) + "</strong>.</div>"
            + "<label class=\"dialog-1547-maneuver-confirm__toggle\">"
            + "<input type=\"checkbox\" name=\"ignoreCost\" />"
            + "<span>Ignore cost</span>"
            + "</label>"
            + "</form>";
        const dialog = new Dialog({
            title: "Select Maneuver",
            content,
            buttons: {
                ok: {
                    icon: '<i class="fas fa-check"></i>',
                    label: "OK",
                    callback: (html) => {
                        settled = true;
                        resolve({
                            confirmed: true,
                            ignoreCost: html.find('[name="ignoreCost"]')[0]?.checked === true,
                        });
                    },
                },
                cancel: {
                    label: "Cancel",
                    callback: () => {
                        settled = true;
                        resolve({ confirmed: false, ignoreCost: false });
                    },
                },
            },
            default: "ok",
            classes: ["dialog-1547"],
            close: () => {
                if (!settled) resolve({ confirmed: false, ignoreCost: false });
            },
        });
        dialog.render(true);
    });
}
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


function isDefenseStateStillActive(actor, defenseState = {}) {
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

function getPersistentEffectLabel(effectType) {
    switch (String(effectType ?? "").trim()) {
        case "aimed": return "Aimed";
        case "braced": return "Braced";
        case "overwatch": return "Overwatch";
        case "grapple-break-advantage": return "Grapple Break (advantage next attack)";
        default: return String(effectType ?? "").trim() || "Persistent Effect";
    }
}

function getActivePersistentEffectsForActor(actor, {
    isCombatActive = false,
    fullTurnAvailable = false,
} = {}) {
    const getter = game.modules.get(MODULE_ID)?.api?.combat?.getActivePersistentEffects;
    const entries = typeof getter === "function"
        ? getter(actor, { isCombatActive, fullTurnAvailable })
        : (Array.isArray(actor?.flags?.[MODULE_ID]?.activeFullTurnManeuvers) ? actor.flags[MODULE_ID].activeFullTurnManeuvers : []);

    return (Array.isArray(entries) ? entries : []).map((entry) => ({
        id: entry?.id ?? null,
        name: entry?.name ?? getPersistentEffectLabel(entry?.createsPersistentEffect),
        effectType: String(entry?.createsPersistentEffect ?? "").trim(),
        duration: String(entry?.duration ?? "").trim(),
        effectData: entry?.effectData ?? {},
        label: getPersistentEffectLabel(entry?.createsPersistentEffect),
    })).filter((entry) => entry.effectType);
}
function getActiveDefenseStateForActor(actor) {
    const defenseState = actor?.flags?.[MODULE_ID]?.defenseState ?? {};
    if (!isDefenseStateStillActive(actor, defenseState)) return [];
    const lockedUntil = String(defenseState?.lockedParryingWeaponUntil ?? "").trim();
    return [{
        id: `defense-lock:${actor?.id ?? "actor"}`,
        label: "Parrying Weapon Locked",
        duration: lockedUntil,
        effectType: "parry-lock",
    }];
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
        case CSB_TEMPLATE_IDS.supernaturalMark:
            return "supernatural-mark";
        case CSB_TEMPLATE_IDS.monsterMagic:
            return "monster-magic";
        case CSB_TEMPLATE_IDS.skill:
            return "skill";
        case CSB_TEMPLATE_IDS.spell:
            return "spell";
        case CSB_TEMPLATE_IDS.ammunition:
            return "ammunition";
        case CSB_TEMPLATE_IDS.weaponModifier:
            return "weapon-modifier";
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
        || (getCsbItemKind(item) === "ammunition" && Boolean(itemProps.AmmoType || sourceData.ammoType));
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
    if (itemKind === "ammunition") return "Ammunition";
    if (itemKind === "weapon-modifier") return "Weapon Modifiers";
    return "Unknown";
}

function getThreatSource(actor) {
    const weapons = getActorItems(actor).filter(isWeaponItem);
    const nonUnarmed = weapons.filter((item) => !isUnarmedWeapon(item));
    const unarmed = weapons.filter(isUnarmedWeapon);
    const equippedReachWeapon = nonUnarmed.find((item) => Boolean(item?.system?.props?.Equipped) && hasReach(item));
    if (equippedReachWeapon) return equippedReachWeapon;

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

// Overlay wrapper: binds this file's weapon selectors into the extracted
// threat-overlay renderer (hud/threat-overlay.js, ADR-0004).
function showThreatOverlay(token) {
    renderThreatOverlay(token, { getThreatSource, getRangedSource, getPrimaryTargetToken });
}

function getRangedSource(actor) {
    const weapons = getActorItems(actor).filter(isWeaponItem);
    const equippedRangedWeapon = weapons.find((item) => Boolean(item?.system?.props?.Equipped) && hasRangeBands(item));
    if (equippedRangedWeapon) return equippedRangedWeapon;

    return weapons.find(hasRangeBands) ?? null;
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

// Window STATE transitions live in hud-state.js (set/clearReactionWindowState,
// ADR-0004 — one mutation point); this file adds the UI side effects (ticker).
function getActiveReactionWindow() {
    const reactionWindow = getReactionWindowState();
    if (!reactionWindow) return null;
    if (Number.isFinite(reactionWindow.expiresAt) && Date.now() > reactionWindow.expiresAt) {
        clearHudReactionWindow();
        return null;
    }
    return reactionWindow;
}

function setHudReactionWindow(reactionWindow) {
    setReactionWindowState(reactionWindow);
    startReactionHudTicker();
}

function clearHudReactionWindow() {
    clearReactionWindowState();
    stopReactionHudTicker();
}

/**
 * Schedule a single re-render at the reaction window's expiry — when
 * the timer hits zero, the HUD re-renders so the prompt clears.
 *
 * NOTE: previously this ticked every 250ms to animate the countdown
 * text, but the periodic re-render replaced the DOM (and its event
 * listeners) between mousedown and mouseup of real mouse clicks, so
 * the browser never synthesised a `click` event. Programmatic
 * `.click()` worked because it fires synchronously, but a user
 * clicking with a real mouse hit nothing.
 *
 * Trade-off: the countdown text in the prompt is no longer live —
 * it shows the time-remaining at render time and doesn't update
 * until the user interacts. The reaction-service still enforces the
 * real timeout independently.
 */
function startReactionHudTicker() {
    if (reactionHudTicker) return;
    const window_ = getReactionWindowState();
    const expiresAt = Number(window_?.expiresAt);
    if (!Number.isFinite(expiresAt)) return;
    const delay = Math.max(0, expiresAt - Date.now());
    reactionHudTicker = window.setTimeout(() => {
        reactionHudTicker = null;
        if (!getActiveReactionWindow()) {
            // already cleared (e.g. by passReaction click)
            void renderHudForSelection();
            return;
        }
        // expiry: clear HUD state and re-render to remove the stale prompt
        clearHudReactionWindow();
        void renderHudForSelection();
    }, delay);
}

function stopReactionHudTicker() {
    if (!reactionHudTicker) return;
    window.clearTimeout(reactionHudTicker);
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
    return buildReactionPromptFromModule({
        getActiveReactionWindow,
        getReactionCountdownText,
        getSelectedReactionChoiceId,
        normalizeReactionChoiceId,
        getManeuverCostSummary,
        getManeuverEffectSummary,
        getManeuverTimingSummary,
        buildManeuverDetailLine,
        getCoreStackCount,
        // The REACTOR is the actor whose HUD is showing — reactionWindow.actor
        // is the ATTACKER for attack windows, so keying Core staging off it
        // read the wrong pool (and clamped the gem stepper to 0).
        getReactorActor: () => getSelectedToken()?.actor ?? null,
        escapeHtml,
    });
}

function buildDamageTakenPrompt() {
    return buildDamageTakenPromptFromModule({
        getActiveDamageTakenWindow,
        escapeHtml,
    });
}

function buildPostManeuverPrompt() {
    return buildPostManeuverPromptFromModule({
        getActivePostManeuverWindow,
        getSelectedPostManeuverId,
        normalizePostManeuverChoiceId,
        buildManeuverSummaryLine,
        buildManeuverDetailLine,
        escapeHtml,
    });
}
function getStatPreview(data) {
    return data.stats.find((stat) => stat.label === HUD_STATE.view.activeStatPreview) ?? data.stats[0] ?? null;
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

function buildSkillRollData(baseStat, diceShift, advantageDice = 0, extraDice = 0) {
    const baseDice = Math.max(0, baseStat?.dice ?? 0);
    const baseMod = Math.max(0, baseStat?.mod ?? 0);
    const shiftedDice = baseDice + (Number(diceShift) || 0);
    const totalDice = shiftedDice + Math.max(0, Number(advantageDice) || 0) + Math.max(0, Number(extraDice) || 0);

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
    return buildHudActionContextFromModule(actor, token, {
        summarizeActor,
        game,
        getSelectedToken,
        canvas,
        HUD_STATE,
        sanitizeCounterRollDice,
    });
}

function createStatActionDescriptor(context, statLabel) {
    return createStatActionDescriptorFromModule(context, statLabel);
}

function createSkillActionDescriptor(context, skillName) {
    return createSkillActionDescriptorFromModule(context, skillName);
}

function createWeaponAttackActionDescriptor(context, weaponId) {
    return createWeaponAttackActionDescriptorFromModule(context, weaponId);
}

function evaluateHudAction(descriptor, context) {
    return evaluateHudActionFromModule(descriptor, context, {
        buildRollFormula,
        buildSkillRollData,
        summarizeManeuverEffects,
        buildWeaponRollContext,
        getWeaponAttackState,
        buildFoundryAttackRollFormula,
    });
}

async function executeSelectedFullTurnManeuver(actor, summary) {
    return executeSelectedFullTurnManeuverFromModule(actor, summary, {
        MODULE_ID,
        game,
        ui,
        getSelectedFullTurnManeuverId,
        clearSelectedFullTurnManeuver,
        clearActorManeuverSelections,
        getPrimaryTargetToken,
        isTruthyLike,
    });
}
async function executeWeaponReloadAction(weaponId, actor, summary) {
    return executeWeaponReloadActionFromModule(weaponId, actor, summary, {
        MODULE_ID,
        HUD_STATE,
        game,
        ui,
        isTruthyLike,
    });
}
async function executeWeaponReadyAction(weaponId, actor, summary) {
    return executeWeaponReadyActionFromModule(weaponId, actor, summary, {
        ui,
        isTruthyLike,
    });
}
async function executeItemUnequipAction(itemId, actor, summary) {
    return executeItemUnequipActionFromModule(itemId, actor, summary, {
        ui,
        isTruthyLike,
    });
}
async function runHudAction(descriptor, context) {
    const evaluation = evaluateHudAction(descriptor, context);
    return runHudActionFromModule(descriptor, context, evaluation, {
        MODULE_ID,
        HUD_STATE,
        game,
        ui,
        ChatMessage,
        escapeHtml,
        maybeRollCounter,
        summarizeActor,
        buildFoundryAttackRollFormula,
        getWeaponAttackState,
        clearActorManeuverSelections,
        getChebyshevDistanceSquares,
        getSelectedFullTurnManeuverId,
        clearSelectedFullTurnManeuver,
        getPrimaryTargetToken,
        isTruthyLike,
        getPendingNextAttackDice,
        clearPendingNextAttackDice,
        getPendingNextSkillDice,
        clearPendingNextSkillDice,
    });
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
    return summarizeActorFromModule(actor, token, {
        MODULE_ID,
        SOURCE_FLAG_SCOPE,
        HUD_STATE,
        canvas,
        game,
        getActorProps,
        getNumericProp,
        getStringProp,
        isWeaponItem,
        isArmorItem,
        isAmmoItem,
        getCsbItemKind,
        getWeaponAttackProfiles,
        getWeaponActiveAttackProfile,
        getWeaponRangeBands,
        getWeaponReach,
        formatRangeSummary,
        getAmmoType,
        getAmmoQuantity,
        getAmmoSummary,
        getWeaponAttackState,
        getSelectedPreManeuverIds,
        setSelectedPreManeuverIds,
        getCoreStackCount,
        getSelectedFullTurnManeuverId,
        clearSelectedFullTurnManeuver,
        getIgnoredCostManeuverIds,
        applyIgnoredCostOverride,
        buildReservedResourceTotals,
        getChebyshevDistanceSquares,
        isTruthyLike,
        normalizeManeuverTimingKey,
        formatManeuverTimingLabel,
        buildManeuverTooltip,
        getManeuverCostSummary,
        getManeuverEffectSummary,
        buildManeuverSummaryLine,
        buildManeuverDetailLine,
        getPlayerFacingItemGroup,
        isConsumableItem,
        getResourceSummary,
        formatCurrentMax,
        buildRollFormula,
        getSkillDiceShift,
        buildSkillRollData,
        getActivePersistentEffectsForActor,
        getActiveDefenseStateForActor,
        getDiceTabAttackSelection,
        getDiceTabDefenseSelection,
        getPendingNextAttackDice,
        getDiceTabSkillDice,
        getPendingNextSkillDice,
        getAttackDiceTabOptions,
        getDefenseDiceTabOptions,
        formatAttackDiceSelectionLabel,
        formatDefenseDiceSelectionLabel,
        formatSkillD6SelectionLabel,
    });
}
function buildHudHtml(data) {
    return buildHudHtmlFromModule(data, {
        HUD_STATE,
        escapeHtml,
        buildReactionPrompt,
        buildDamageTakenPrompt,
        buildPostManeuverPrompt,
        getActiveReactionWindow,
        getActivePostManeuverWindow,
        getStatPreview,
        formatCurrentMax,
        buildStatPreview,
        sanitizeCounterRollDice,
        getInventoryFilterOptions,
        normalizeInventoryFilterValue,
        matchesInventoryFilter,
        getManeuverFilterOptions,
        matchesManeuverFilter,
        getAttackDiceTabOptions,
        formatAttackDiceSelectionLabel,
        formatSkillD6SelectionLabel,
    });
}
function buildEmptyHtml(message = "No token selected") {
    return buildEmptyHtmlFromModule(message, {
        escapeHtml,
    });
}

function getSelectedToken() {
    return canvas?.tokens?.controlled?.[0] ?? null;
}

function getPrimaryTargetToken() {
    return Array.from(game.user?.targets ?? [])[0] ?? null;
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

    if (!getActiveReactionWindow() && !getActiveDamageTakenWindow() && !getActivePostManeuverWindow()) {
        releaseDeferredPostWindowsIntoHud();
    }

    root.dataset.actorId = token.actor.id;
    try {
        const summary = summarizeActor(token.actor, token);
        // Context-follow happens here, BEFORE render — render is a pure read
        // of HUD_STATE (ADR-0004).
        syncManeuverFilterContext(getActiveReactionWindow()
            ? "reaction"
            : (Number(summary.criticalPoints ?? 0) > 0 ? "post" : "all"));
        root.innerHTML = buildHudHtml(summary);
    } catch (err) {
        // TEMP DIAGNOSTIC (0.3.119) — see register1547ActorHud.
        console.error("1547core DIAG | HUD render failed for", {
            actor: token?.actor?.name, actorId: token?.actor?.id, token: token?.name,
            reactionWindow: getActiveReactionWindow() ? "open" : "none",
        }, err);
        throw err;
    }
    applyHudPlacement(root);
    // Persist the canvas range overlay (with at-risk cover markers) while a
    // weapon's "show range" toggle is on; otherwise clear it.
    if (Object.values(HUD_STATE.view.weaponRangeShownIds ?? {}).some(Boolean)) {
        showThreatOverlay(token);
    } else {
        clearThreatOverlay();
    }
    bindHudInteractionsFromModule(root, token, {
        HUD_STATE,
        ui,
        renderHudForSelection: scheduleHudRerender,
        announceSideReady,
        getActiveReactionWindow,
        getSelectedReactionChoiceId,
        toggleSelectedReactionChoiceId,
        clearHudReactionWindow,
        clearHudDamageTakenWindow,
        releaseDeferredPostWindowsIntoHud,
        getDiceTabAttackSelection,
        setDiceTabAttackSelectionCount,
        clearDiceTabAttackSelection,
        getDiceTabDefenseSelection,
        setDiceTabDefenseSelectionCount,
        clearDiceTabDefenseSelection,
        getDefenseDiceTabOptions,
        setPendingNextAttackDice,
        clearPendingNextAttackDice,
        getDiceTabSkillDice,
        setDiceTabSkillDice,
        clearDiceTabSkillDice,
        setPendingNextSkillDice,
        clearPendingNextSkillDice,
        clearIgnoredCostManeuver,
        clearIgnoredCostManeuvers,
        setIgnoredCostManeuver,
        confirmManeuverCostSelection,
        getActivePostManeuverWindow,
        toggleSelectedPostManeuver,
        getSelectedPostManeuverId,
        normalizePostManeuverChoiceId,
        advancePostManeuverWindow,
        clearSelectedFullTurnManeuver,
        toggleSelectedPreManeuver,
        clearSelectedPreManeuvers,
        adjustCoreStackCount,
        toggleSelectedFullTurnManeuver,
        summarizeActor,
        executeSelectedFullTurnManeuver,
        buildHudActionContext,
        createStatActionDescriptor,
        createSkillActionDescriptor,
        createWeaponAttackActionDescriptor,
        runHudAction,
        executeWeaponReloadAction,
        executeWeaponReadyAction,
        executeItemUnequipAction,
        sanitizeCounterRollDice,
        ChatMessage,
        getAttackDiceTabOptions,
    });
}

async function maybeRollCounter(context, label, playerTotal) {
    // Skills tab "Checks" header — pick the counter formula from the mode.
    // Manual = no counter. Falls through to the legacy counter-roll toggle
    // path for non-skills callers that still flip counterRollEnabled.
    const mode = String(context.checkMode ?? "manual");
    let counterFormula = null;
    let counterContext = "";
    if (mode === "stat" && context.checkTarget?.count > 0 && context.checkStatTarget) {
        const stat = (context.checkTarget?.stats ?? []).find((s) => s.label === context.checkStatTarget);
        if (stat?.formula) {
            counterFormula = stat.formula;
            counterContext = `${context.checkTarget.name ?? "Target"} ${stat.label}`;
        }
    } else if (mode === "skill" && context.checkTarget?.count === 1 && context.checkSkillTarget) {
        const skill = (context.checkTarget?.skills ?? []).find((s) => s.name === context.checkSkillTarget);
        if (skill?.formula) {
            counterFormula = skill.formula;
            counterContext = `${context.checkTarget.name ?? "Target"} ${skill.name}`;
        }
    } else if (mode === "general") {
        const dice = sanitizeCounterRollDice(context.checkGeneralDice ?? 3);
        counterFormula = `${dice}d6`;
        counterContext = `${context.checkGeneralDifficulty ?? "General"} (${counterFormula})`;
    } else if (mode === "manual") {
        // Manual mode explicitly skips a counter even if the legacy toggle
        // was left on from a prior session.
        return;
    } else if (context.counterRollEnabled) {
        const counterDice = sanitizeCounterRollDice(context.counterRollDice);
        counterFormula = `${counterDice}d6`;
        counterContext = counterFormula;
    }
    if (!counterFormula) return;

    await rollToChat({
        formula: counterFormula,
        speaker: ChatMessage.getSpeaker({ actor: context.actor, token: context.token?.document }),
        // Flavor needs the evaluated roll (success vs the player total).
        flavor: (counterRoll) => {
            const resultText = Number(playerTotal) >= Number(counterRoll.total) ? "Success" : "Failure";
            return `${label} Counter Roll<br>Difficulty: ${escapeHtml(counterContext)}<br>Player Total: ${escapeHtml(playerTotal)}<br>Outcome: ${resultText}`;
        },
        rollMode: "default",
        waitForTotals: false,
    });

    HUD_STATE.view.counterRollEnabled = false;
}

function rerenderHudIfViewingActor(actorId) {
    const token = getSelectedToken();
    if (!token?.actor || token.actor.id !== actorId) return;
    void renderHudForSelection();
}

let hudRerenderScheduled = false;

function scheduleHudRerender() {
    if (hudRerenderScheduled) return;
    hudRerenderScheduled = true;
    window.requestAnimationFrame(() => {
        hudRerenderScheduled = false;
        void renderHudForSelection();
    });
}

function releaseDeferredPostWindowsIntoHud() {
    const released = releaseDeferredPostManeuverWindows();
    if (released.length) {
        clearHudDamageTakenWindow();
    }
    return released;
}

// Guards against re-running the one-time hook/listener registration (a second
// init pass, hot reload, or world reload without a page refresh would otherwise
// double every hook and re-render twice per event).
let hudRegistered = false;

export function register1547ActorHud() {
    if (hudRegistered) return;
    hudRegistered = true;

    // TEMP DIAGNOSTIC (0.3.119): capture the "reading 'name' of undefined" thrown
    // inside Foundry's #fetch when a player attacks a GM token, with the FULL stack
    // (the console default only shows the top frame). Remove once root-caused.
    try {
        const logNameError = (reason, source) => {
            const message = String(reason?.message ?? reason ?? "");
            if (!/reading '?name'?/.test(message)) return;
            console.error(
                `1547core DIAG | '${source}' captured a 'name' error\n`
                + `selectedToken=${getSelectedToken()?.name ?? "(none)"} `
                + `reactionWindow=${getActiveReactionWindow() ? "open" : "none"}\n`
                + `FULL STACK:\n${reason?.stack ?? String(reason)}`
            );
        };
        window.addEventListener("unhandledrejection", (ev) => logNameError(ev?.reason, "unhandledrejection"));
        window.addEventListener("error", (ev) => logNameError(ev?.error ?? ev, "error"));
    } catch { /* noop */ }

    ensureHudRoot().innerHTML = buildEmptyHtml("Waiting for selection");
    bindSideAdvanceSocket();

    const moduleApi = game.modules.get(MODULE_ID);
    if (moduleApi) {
        moduleApi.api = moduleApi.api ?? {};
        // Exposed so the diagnostics service can reuse the real, deps-bound summary path.
        moduleApi.api.summarizeActor = summarizeActor;
    }

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
    onCombatEvent(COMBAT_EVENTS.DAMAGE_TAKEN_WINDOW_OPENED, (event) => {
        setHudDamageTakenWindow(event.payload ?? null);
        void renderHudForSelection();
        return null;
    });

    Hooks.on("controlToken", () => void renderHudForSelection());
    Hooks.on("hoverToken", (token, hovered) => {
        if (hovered) {
            showThreatOverlay(token);
            return;
        }
        clearThreatOverlay();
    });
    onCombatEvent(COMBAT_EVENTS.POST_MANEUVER_WINDOW_OPENED, (event) => {
        clearHudDamageTakenWindow();
        // If the window's actor is owned by a remote player (e.g. a defender on
        // their own client), relay the choice there instead of queuing it here.
        if (relayPostManeuverWindow(event.payload)) return null;
        queuePostManeuverWindow(event.payload);
        void renderHudForSelection();
        return null;
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
    Hooks.on("targetToken", () => {
        void renderHudForSelection();
        // Refresh the overlay so the ranged-shot lane / cover badges / rear marker
        // track the new target (the lane is anchored on the selected shooter).
        const selectedToken = getSelectedToken();
        if (selectedToken) showThreatOverlay(selectedToken);
    });
    Hooks.on("updateToken", (document) => {
        const selectedToken = getSelectedToken();
        const targetedTokenIds = new Set(Array.from(game.user?.targets ?? []).map((token) => token.document?.id));
        if (selectedToken?.document?.id === document.id || targetedTokenIds.has(document.id)) {
            void renderHudForSelection();
        }
        if (selectedToken?.document?.id === document.id) {
            showThreatOverlay(selectedToken);
            return;
        }
        if (canvas?.tokens?.hover?.document?.id === document.id) {
            showThreatOverlay(canvas.tokens.hover);
        }
    });
    Hooks.on("refreshToken", (token) => {
        const selectedToken = getSelectedToken();
        const targetedTokenIds = new Set(Array.from(game.user?.targets ?? []).map((entry) => entry.document?.id));
        if (selectedToken?.id === token?.id || targetedTokenIds.has(token?.document?.id)) {
            void renderHudForSelection();
        }
        if (selectedToken?.id === token?.id || canvas?.tokens?.hover?.id === token?.id) {
            showThreatOverlay(token);
        }
    });
    Hooks.on("renderSceneNavigation", scheduleHudRerender);
    Hooks.on("renderSceneControls", scheduleHudRerender);
    Hooks.on("collapseSidebar", scheduleHudRerender);

    window.addEventListener("resize", scheduleHudRerender, { passive: true });
    void renderHudForSelection();
}














































































































