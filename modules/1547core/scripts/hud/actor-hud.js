import { COMBAT_EVENTS, onCombatEvent } from "../services/combat-events.js";
import { buildAttackPool, toFoundryFormula } from "../combat/pool-builder.mjs";
import { relayPostManeuverWindow } from "../combat/post-maneuver-relay.js";
import {
    HUD_STATE,
    getSelectedPreManeuverIds,
    setSelectedPreManeuverIds,
    clearSelectedPreManeuvers,
    toggleSelectedPreManeuver,
    getSelectedFullTurnManeuverId,
    setSelectedFullTurnManeuverId,
    clearSelectedFullTurnManeuver,
    toggleSelectedFullTurnManeuver,
    clearActorManeuverSelections,
    getSelectedReactionChoiceId,
    setSelectedReactionChoiceId,
    toggleSelectedReactionChoiceId,
    normalizePostManeuverChoiceId,
    getActivePostManeuverWindow,
    queuePostManeuverWindow,
    advancePostManeuverWindow,
    clearPostManeuverWindows,
    setDeferredPostManeuverWindows,
    releaseDeferredPostManeuverWindows,
    clearDeferredPostManeuverWindows,
    getSelectedPostManeuverId,
    toggleSelectedPostManeuver,
    getActiveDamageTakenWindow,
    setHudDamageTakenWindow,
    clearHudDamageTakenWindow,
    getDiceTabAttackSelection,
    setDiceTabAttackSelectionCount,
    clearDiceTabAttackSelection,
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
import { summarizeActor as summarizeActorFromModule } from "./hud-summary.js";
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
import {
    getOrderedCombatants,
    resolveCombatantSideId,
    getSideLabel,
    getActiveSideId,
    getResolvedSideOrder,
    persistCombatSideState,
} from "../combat-tracker/side-tracker.js";

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
    StrengthPoints: "STR",
    StaminaPoints: "STA",
    DexterityPoints: "DEX",
    IntelligencePoints: "INT",
    FaithPoints: "FTH",
    CharismaPoints: "CHA",
    PowerPoints: "POW",
    CriticalPoints: "CRIT"
};
const DICE_TAB_ATTACK_OPTIONS = [
    { key: "balanced", label: "Balanced", dieName: "Balanced", code: "b", tooltip: "Flexible attack die with steady damage.\n1: Fumble\n2: Blank\n3: Damage 1\n4: Damage 1\n5: Damage 2\n6: Critical" },
    { key: "control", label: "Control", dieName: "Control", code: "c", tooltip: "Control die with safer pressure and crit chance.\n1: Fumble\n2: Blank\n3: Blank\n4: Damage 1\n5: Critical\n6: Critical" },
    { key: "grace", label: "Grace", dieName: "Grace", code: "g", tooltip: "Clean precision die with low risk.\n1: Blank\n2: Blank\n3: Damage 1\n4: Damage 1\n5: Critical\n6: Critical" },
    { key: "heavy", label: "Heavy", dieName: "Heavy", code: "h", tooltip: "High-impact die with swingier damage.\n1: Fumble\n2: Fumble\n3: Damage 1\n4: Damage 2\n5: Damage 4\n6: Critical" },
    { key: "lethality", label: "Lethality", dieName: "Lethality", code: "l", tooltip: "Explosive damage die with sharp upside.\n1: Fumble\n2: Fumble\n3: Damage 2\n4: Damage 3\n5: Damage 5\n6: Critical" },
    { key: "multiplier", label: "Multiplier", dieName: "Multiplier", code: "x", tooltip: "Adds multiplier potential to a hit.\n1: 0x\n2: Blank\n3: Blank\n4: 2x\n5: 2x\n6: 3x" },
    { key: "penetration", label: "Penetration", dieName: "Penetration", code: "p", tooltip: "Punches through protection more reliably.\n1: Fumble\n2: Blank\n3: Damage 1\n4: Damage 1\n5: Damage 3\n6: Critical" },
    { key: "risk", label: "Risk", dieName: "Risk", code: "r", tooltip: "Volatile die with danger and payoff.\n1: 0x\n2: Fumble\n3: Fumble\n4: Blank\n5: Damage 2\n6: Critical" },
];

function getAttackDiceTabOptions() {
    return DICE_TAB_ATTACK_OPTIONS.map((option) => ({ ...option }));
}

function formatAttackDiceSelectionLabel(diceMap = {}) {
    const parts = DICE_TAB_ATTACK_OPTIONS.flatMap((option) => {
        const count = Math.max(0, Number(diceMap?.[option.key] ?? 0) || 0);
        return count > 0 ? [String(count) + "d" + option.code] : [];
    });
    return parts.join(" + ") || "0 dice";
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

function summarizeManeuverEffects(maneuvers) {
    return (Array.isArray(maneuvers) ? maneuvers : []).reduce((summary, maneuver) => {
        const effect = maneuver?.effectData ?? {};
        summary.addMainDice += Number(effect.addMainDice ?? 0) || 0;
        summary.addMultiplierDice += Number(effect.addMultiplierDice ?? 0) || 0;
        summary.addRiskDice += Number(effect.addRiskDice ?? 0) || 0;
        summary.addDisadvantage += Number(effect.addDisadvantage ?? 0) || 0;
        return summary;
    }, {
        addMainDice: 0,
        addMultiplierDice: 0,
        addRiskDice: 0,
        addDisadvantage: 0,
    });
}

function buildWeaponRollContext(summary, maneuverEffects = {}) {
    const base = summary?.weaponRollContext ?? summary?.rollContext ?? { advantageDice: 0, riskDice: 0 };
    return {
        ...base,
        addMainDice: Math.max(0, Number(base.addMainDice ?? 0) + Number(maneuverEffects.addMainDice ?? 0)),
        addMultiplierDice: Math.max(0, Number(base.addMultiplierDice ?? 0) + Number(maneuverEffects.addMultiplierDice ?? 0)),
        riskDice: Math.max(0, Number(base.riskDice ?? 0) + Number(maneuverEffects.addRiskDice ?? 0) + Number(maneuverEffects.addDisadvantage ?? 0)),
        extraDiceCounts: {
            ...(base.extraDiceCounts ?? {}),
        },
    };
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

function isUnarmedWeapon(item) {
    const itemProps = item?.system?.props ?? {};
    const sourceData = item?.flags?.[SOURCE_FLAG_SCOPE]?.sourceData ?? item?.flags?.[MODULE_ID]?.sourceData ?? {};
    const weaponType = itemProps.WeaponType ?? sourceData.category ?? "";
    return String(weaponType).toLowerCase() === "unarmed";
}

function getWeaponReach(item) {
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

function getChebyshevDistanceSquares(sourceToken, targetToken) {
    const source = sourceToken?.center ?? null;
    const target = targetToken?.center ?? null;
    const size = Number(canvas?.dimensions?.size) || 0;
    if (!source || !target || size <= 0) return null;
    const dx = Math.abs(Number(target.x) - Number(source.x));
    const dy = Math.abs(Number(target.y) - Number(source.y));
    return Math.round(Math.max(dx, dy) / size);
}
function hasUsableRangeBands(rangeBands = {}) {
    return [rangeBands.shortRange, rangeBands.longRange, rangeBands.maxRange]
        .some((value) => Number.isFinite(value) && value > 0);
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

function buildFoundryAttackRollFormula(profile, rollContext = {}) {
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

function getAmmoAddDice(item) {
    const itemProps = item?.system?.props ?? {};
    const sourceData = item?.flags?.[SOURCE_FLAG_SCOPE]?.sourceData ?? item?.flags?.[MODULE_ID]?.sourceData ?? {};
    if (Array.isArray(sourceData?.addDice)) {
        return sourceData.addDice.filter((die) => typeof die === "string" && die.trim()).map((die) => die.trim());
    }
    const addDiceString = getStringProp(itemProps, ["AddDice", "AddDiceSummary"]);
    if (!addDiceString) return [];
    return addDiceString.split(",").map((entry) => String(entry ?? "").trim()).filter(Boolean);
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

function getRangedSource(actor) {
    const weapons = getActorItems(actor).filter(isWeaponItem);
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
    HUD_STATE.selectedReactionChoiceId = null;
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
    const window_ = HUD_STATE.reactionWindow;
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
        Roll,
        ChatMessage,
        escapeHtml,
        maybeRollCounter,
        summarizeActor,
        summarizeManeuverEffects,
        buildWeaponRollContext,
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
        getPendingNextAttackDice,
        getDiceTabSkillDice,
        getPendingNextSkillDice,
        getAttackDiceTabOptions,
        formatAttackDiceSelectionLabel,
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
    root.innerHTML = buildHudHtml(summarizeActor(token.actor, token));
    applyHudPlacement(root);
    clearThreatOverlay();
    bindHudInteractionsFromModule(root, token, {
        HUD_STATE,
        ui,
        renderHudForSelection: scheduleHudRerender,
        announceSideReady,
        getActiveReactionWindow,
        getSelectedReactionChoiceId,
        toggleSelectedReactionChoiceId,
        clearHudReactionWindow,
        getActiveDamageTakenWindow,
        clearHudDamageTakenWindow,
        releaseDeferredPostWindowsIntoHud,
        getDiceTabAttackSelection,
        setDiceTabAttackSelectionCount,
        clearDiceTabAttackSelection,
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
        Roll,
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

    const counterRoll = await new Roll(counterFormula).evaluate({ async: true });
    const speaker = ChatMessage.getSpeaker({ actor: context.actor, token: context.token?.document });
    const success = Number(playerTotal) >= Number(counterRoll.total);
    const resultText = success ? "Success" : "Failure";

    await counterRoll.toMessage({
        speaker,
        flavor: `${label} Counter Roll<br>Difficulty: ${escapeHtml(counterContext)}<br>Player Total: ${escapeHtml(playerTotal)}<br>Outcome: ${resultText}`
    });

    HUD_STATE.counterRollEnabled = false;
}

const SIDE_READY_CONFIRM_SETTING = "showSideReadyConfirmation";

function getFirstCombatantIndexForSide(combat, sideId) {
    const turns = Array.isArray(combat?.turns) ? combat.turns : [];
    return turns.findIndex((combatant) => !combatant?.defeated && resolveCombatantSideId(combatant) === sideId);
}

function getNextStoredSideTurnState(combat) {
    const orderedCombatants = getOrderedCombatants(combat).filter((combatant) => !combatant?.defeated);
    if (!orderedCombatants.length) return null;

    const sideOrder = getResolvedSideOrder(combat, orderedCombatants);
    if (!sideOrder.length) return null;

    const currentSideId = getActiveSideId(combat, orderedCombatants) || sideOrder[0] || "";
    const currentIndex = Math.max(0, sideOrder.indexOf(currentSideId));

    for (let offset = 1; offset <= sideOrder.length; offset += 1) {
        const sideIndex = (currentIndex + offset) % sideOrder.length;
        const nextSideId = sideOrder[sideIndex];
        const nextCombatant = orderedCombatants.find((combatant) => resolveCombatantSideId(combatant) === nextSideId) ?? null;
        const nextTurnIndex = getFirstCombatantIndexForSide(combat, nextSideId);
        if (!nextCombatant || nextTurnIndex < 0) continue;
        return {
            activeSideId: nextSideId,
            sideLabel: getSideLabel(nextSideId),
            combatant: nextCombatant,
            turn: nextTurnIndex,
            round: sideIndex <= currentIndex ? (Number(combat.round) || 1) + 1 : (Number(combat.round) || 1),
            wrapped: sideIndex <= currentIndex,
        };
    }

    return null;
}

async function advanceCombatToNextSide(combat) {
    if (!combat?.update) return null;
    const nextState = getNextStoredSideTurnState(combat);
    if (!nextState) return null;
    await combat.update({
        round: nextState.round,
        turn: nextState.turn,
    });
    await combat.setFlag(MODULE_ID, "activeSideId", nextState.activeSideId);
    await combat.setFlag(MODULE_ID, "roundNumber", nextState.round);
    await persistCombatSideState(combat);
    return nextState;
}

async function confirmSideReady(nextState) {
    const showConfirmation = game.settings.get(MODULE_ID, SIDE_READY_CONFIRM_SETTING) !== false;
    if (!showConfirmation) return true;

    return await new Promise((resolve) => {
        let settled = false;
        const content = "<form class=\"combat-side-ready-confirm\">"
            + "<div class=\"combat-side-ready-confirm__eyebrow\">Side Transition</div>"
            + "<div class=\"combat-side-ready-confirm__title\">This ends the turn for the whole side.</div>"
            + "<div class=\"combat-side-ready-confirm__body\">Any actor on the currently active side will lose the rest of this side activation.</div>"
            + "<div class=\"combat-side-ready-confirm__next\"><span class=\"combat-side-ready-confirm__next-label\">Next active side</span><strong>" + escapeHtml(nextState?.sideLabel || nextState?.combatant?.name || "Next side") + "</strong></div>"
            + "<label class=\"combat-side-ready-confirm__toggle\">"
            + "<input type=\"checkbox\" name=\"hideAgain\" />"
            + "<span>Do not show again</span>"
            + "</label>"
            + "</form>";
        const dialog = new Dialog({
            title: "End Whole Side Turn?",
            content,
            buttons: {
                confirm: {
                    icon: '<i class="fas fa-check"></i>',
                    label: "End Side Turn",
                    callback: async (html) => {
                        const hideAgain = html.find('[name="hideAgain"]')[0]?.checked === true;
                        if (hideAgain) {
                            await game.settings.set(MODULE_ID, SIDE_READY_CONFIRM_SETTING, false);
                        }
                        settled = true;
                        resolve(true);
                    },
                },
                cancel: {
                    label: "Cancel",
                    callback: () => {
                        settled = true;
                        resolve(false);
                    },
                },
            },
            default: "cancel",
            close: () => {
                if (!settled) resolve(false);
            },
        });
        dialog.render(true);
    });
}

async function announceSideReady(actor, token) {
    if (!game.combat?.started) {
        ui.notifications?.warn?.("Combat is not active.");
        return;
    }

    const nextPreview = getNextStoredSideTurnState(game.combat);
    if (!nextPreview) {
        ui.notifications?.warn?.("No next side could be resolved.");
        return;
    }

    const confirmed = await confirmSideReady(nextPreview);
    if (!confirmed) return;

    const speaker = ChatMessage.getSpeaker({ actor, token: token?.document });
    const callerName = game.user?.name || "A player";
    const actorName = token?.name || actor?.name || "Selected actor";
    const targetCount = Array.from(game.user?.targets ?? []).length;
    const targetText = targetCount > 0
        ? "<br>Current targets marked in Foundry: " + escapeHtml(targetCount)
        : "";

    const nextName = nextPreview?.sideLabel || nextPreview?.combatant?.name || nextPreview?.combatant?.actor?.name || "next side";
    const roundText = nextPreview?.wrapped ? "<br>Combat advances to a new round." : "";
    const sideText = "<br><strong>Next active side:</strong> " + escapeHtml(nextName);

    await ChatMessage.create({
        speaker,
        content: "<strong>" + escapeHtml(callerName) + "</strong> calls <strong>Side Ready</strong> for " + escapeHtml(actorName) + "." + targetText + sideText + roundText
    });

    // Advancing the combat writes to the Combat doc, which only the GM may do.
    // The GM does it directly; a player asks the GM over the socket.
    if (game.user?.isGM) {
        await advanceCombatToNextSide(game.combat);
    } else {
        game.socket?.emit(`module.${MODULE_ID}`, { type: "side-advance-request", userId: game.user?.id });
    }
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

// GM-side listener: a player asked to advance the side (they can't write the
// Combat doc themselves). Only the GM acts on it.
let sideAdvanceSocketBound = false;
function bindSideAdvanceSocket() {
    if (sideAdvanceSocketBound || !game?.socket) return;
    sideAdvanceSocketBound = true;
    game.socket.on(`module.${MODULE_ID}`, (msg) => {
        if (msg?.type !== "side-advance-request" || !game.user?.isGM) return;
        if (!game.combat?.started) return;
        void advanceCombatToNextSide(game.combat);
    });
}

export function register1547ActorHud() {
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
            renderThreatOverlay(token);
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
    Hooks.on("targetToken", () => void renderHudForSelection());
    Hooks.on("updateToken", (document) => {
        const selectedToken = getSelectedToken();
        const targetedTokenIds = new Set(Array.from(game.user?.targets ?? []).map((token) => token.document?.id));
        if (selectedToken?.document?.id === document.id || targetedTokenIds.has(document.id)) {
            void renderHudForSelection();
        }
        if (selectedToken?.document?.id === document.id) {
            renderThreatOverlay(selectedToken);
            return;
        }
        if (canvas?.tokens?.hover?.document?.id === document.id) {
            renderThreatOverlay(canvas.tokens.hover);
        }
    });
    Hooks.on("refreshToken", (token) => {
        const selectedToken = getSelectedToken();
        const targetedTokenIds = new Set(Array.from(game.user?.targets ?? []).map((entry) => entry.document?.id));
        if (selectedToken?.id === token?.id || targetedTokenIds.has(token?.document?.id)) {
            void renderHudForSelection();
        }
        if (selectedToken?.id === token?.id || canvas?.tokens?.hover?.id === token?.id) {
            renderThreatOverlay(token);
        }
    });
    Hooks.on("renderSceneNavigation", scheduleHudRerender);
    Hooks.on("renderSceneControls", scheduleHudRerender);
    Hooks.on("collapseSidebar", scheduleHudRerender);

    window.addEventListener("resize", scheduleHudRerender, { passive: true });
    void renderHudForSelection();
}














































































































