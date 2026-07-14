import { buildAdvanceStatUpdateFromProps } from "./primary-stats.js";
import { isManualSpellItem } from "./spell-manual-support.js";
import { getItemById } from "./content-registry.js";
import { MODULE_ID, SOURCE_FLAG_SCOPE, USAGE_EFFECT_TEMPLATE_ID, UNEQUIPPABLE_TEMPLATE_ID } from "../lib/constants.mjs";
import { readSourceData, getProps as getCarrierProps, escapeHtml, slugify } from "../lib/foundry-utils.mjs";
import { deepClone, cloneTemplateSystem } from "../lib/build-helpers.mjs";
import { normalizeTokenDocument, getDefaultSourceTokenForActor } from "./token-utils.mjs";
const SUPPORTED_CARRIER_TEMPLATE_IDS = new Set([
    "2kiWw3Cv5Zk1lZxn", // Spell
    "w9ky0ZTDvXDs5Ce7", // Supernatural Mark
    "M0nMgk7Yp2RsT5Vu", // Monster Magic
    "HkiFlUWUkUycJdBZ", // Magic Item / equippable charm (e.g. Nazar) — Effects container holds usage-effect children
    "uLlgZXz3GlXPFtsj", // Armor — can carry equipped-while-worn effects
    "eCIZRFXbcQVZKqEr", // Equippable
]);

const EFFECT_ARRAY_KEYS = [
    "SuccessEffects",
    "MarkEffects",
    "MagicEffects",
    "EquippedEffects",
    "successEffects",
    "markEffects",
    "magicEffects",
    "equippedEffects",
];

const STAT_KEY_MAP = {
    Strength: { dice: "Stats_StrengthDice", mod: "Stats_StrengthMod" },
    Stamina: { dice: "Stats_StaminaDice", mod: "Stats_StaminaMod" },
    Dexterity: { dice: "Stats_DexterityDice", mod: "Stats_DexterityMod" },
    Intelligence: { dice: "Stats_IntelligenceDice", mod: "Stats_IntelligenceMod" },
    Faith: { dice: "Stats_FaithDice", mod: "Stats_FaithMod" },
    Charisma: { dice: "Stats_CharismaDice", mod: "Stats_CharismaMod" },
    Power: { dice: "Stats_PowerDice", mod: "Stats_PowerMod" },
};


function getText(source, keys, fallback = "") {
    for (const key of keys) {
        const value = source?.[key];
        if (typeof value === "string" && value.trim()) return value.trim();
    }
    return fallback;
}

function getBoolean(source, keys, fallback = false) {
    for (const key of keys) {
        const value = source?.[key];
        if (typeof value === "boolean") return value;
    }
    return fallback;
}

function isSupportedCarrierItem(item) {
    return SUPPORTED_CARRIER_TEMPLATE_IDS.has(String(item?.system?.template ?? ""));
}

function buildRollFormula(dice, mod) {
    const safeDice = Math.max(0, Number(dice) || 0);
    const safeMod = Math.max(0, Number(mod) || 0);
    return safeMod > 0 ? `${safeDice}d6 + ${safeMod}` : `${safeDice}d6`;
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

function normalizeEffectProps(rawEffect) {
    const props = rawEffect?.system?.props ?? rawEffect ?? {};
    return {
        Description: getText(props, ["Description", "description"]),
        ApplicationMode: getText(props, ["ApplicationMode", "applicationMode"], "NarrativeOnly"),
        EffectType: getText(props, ["EffectType", "effectType"], "Descriptive"),
        EffectSubtype: getText(props, ["EffectSubtype", "effectSubtype"], "Omen"),
        Visible: getBoolean(props, ["Visible", "visible"], true),
        TargetType: getText(props, ["TargetType", "targetType"], "Actor"),
        TargetCount: getText(props, ["TargetCount", "targetCount"], "1"),
        TargetRange: getText(props, ["TargetRange", "targetRange"]),
        TargetFilter: getText(props, ["TargetFilter", "targetFilter"]),
        TargetDescription: getText(props, ["TargetDescription", "targetDescription"]),
        CheckType: getText(props, ["CheckType", "checkType"], "None"),
        CheckFormula: getText(props, ["CheckFormula", "checkFormula"]),
        ResistanceType: getText(props, ["ResistanceType", "resistanceType"]),
        ResistanceFormula: getText(props, ["ResistanceFormula", "resistanceFormula"]),
        OnPartial: getText(props, ["OnPartial", "onPartial"]),
        OnFailure: getText(props, ["OnFailure", "onFailure"]),
        DetectionCheck: getText(props, ["DetectionCheck", "detectionCheck"]),
        PayloadTarget: getText(props, ["PayloadTarget", "payloadTarget"]),
        PayloadOperation: getText(props, ["PayloadOperation", "payloadOperation"], "Apply"),
        PayloadValue: getText(props, ["PayloadValue", "payloadValue"]),
        PayloadDice: getText(props, ["PayloadDice", "payloadDice"]),
        PayloadTag: getText(props, ["PayloadTag", "payloadTag"]),
        PayloadTraitName: getText(props, ["PayloadTraitName", "payloadTraitName"]),
        PayloadTraitText: getText(props, ["PayloadTraitText", "payloadTraitText"]),
        GrantedItemTemplate: getText(props, ["GrantedItemTemplate", "grantedItemTemplate"]),
        GrantedItemName: getText(props, ["GrantedItemName", "grantedItemName"]),
        PayloadNotes: getText(props, ["PayloadNotes", "payloadNotes"]),
        DurationType: getText(props, ["DurationType", "durationType"], "Instant"),
        DurationValue: getText(props, ["DurationValue", "durationValue"]),
        ExpiryTrigger: getText(props, ["ExpiryTrigger", "expiryTrigger"]),
        RemovalMethod: getText(props, ["RemovalMethod", "removalMethod"]),
        SuppressedBy: getText(props, ["SuppressedBy", "suppressedBy"]),
    };
}

export function collectUsageEffectsFromCarrier(item) {
    const props = getCarrierProps(item);
    const effects = [];

    const pushArraysFrom = (bag) => {
        for (const key of EFFECT_ARRAY_KEYS) {
            if (Array.isArray(bag?.[key])) {
                for (const entry of bag[key]) effects.push(normalizeEffectProps(entry));
            }
        }
    };

    pushArraysFrom(props);
    // CSB drops props whose key the item's template doesn't declare (the
    // equippable/magic-item template has no "EquippedEffects" field). If the
    // live item exposed no effect arrays, read the seed copy from
    // flags.sourceData — flags survive both pruning and import. Gated on "found
    // nothing" so carriers that DO keep their props (spells, monster magic) are
    // never double-counted from both live props and sourceData.
    if (effects.length === 0) {
        const sourceData = readSourceData(item);
        pushArraysFrom(sourceData?.system?.props ?? {});
        if (effects.length === 0) pushArraysFrom(sourceData ?? {});
    }

    // Truly-nested child items (rare; e.g. a compendium item before import).
    const childItems = item?.items?.contents ?? item?.items ?? [];
    for (const child of childItems) {
        if (String(child?.system?.template ?? "") === USAGE_EFFECT_TEMPLATE_ID) {
            effects.push(normalizeEffectProps(child));
        }
    }

    // CSB "item-in-item" is really a sibling item on the same actor that points
    // back at this carrier via `system.container` (see changeset-cascade /
    // weapon-modifier attachment). So an effect authored in an equippable's
    // "Effects" container lives here, not in `item.items`.
    const siblingItems = item?.parent?.items?.contents ?? item?.parent?.items ?? [];
    for (const sibling of siblingItems) {
        if (sibling === item || sibling?.id === item?.id) continue;
        if (String(sibling?.system?.container ?? "") !== String(item?.id ?? "")) continue;
        if (String(sibling?.system?.template ?? "") === USAGE_EFFECT_TEMPLATE_ID) {
            effects.push(normalizeEffectProps(sibling));
        }
    }

    return effects.filter((effect) => effect.EffectType && effect.EffectSubtype);
}

function resolveSourceTokenForItem(item, explicitSourceToken = null) {
    const normalizedExplicit = normalizeTokenDocument(explicitSourceToken);
    if (normalizedExplicit) return normalizedExplicit;

    const actor = item?.parent?.documentName === "Actor" ? item.parent : null;
    if (actor) {
        const actorToken = getDefaultSourceTokenForActor(actor);
        if (actorToken) return actorToken;
    }

    const controlled = canvas?.tokens?.controlled ?? [];
    if (controlled.length === 1) {
        return normalizeTokenDocument(controlled[0]);
    }

    return null;
}

function parseTargetCount(value) {
    const text = String(value ?? "").trim();
    if (!text) return 1;
    if (text.toLowerCase() === "all") return Number.POSITIVE_INFINITY;
    const number = Number.parseInt(text, 10);
    return Number.isFinite(number) && number > 0 ? number : 1;
}

function getTokenCenter(tokenDoc) {
    const size = canvas?.grid?.size ?? 100;
    if (tokenDoc?.object?.center) return tokenDoc.object.center;
    return {
        x: Number(tokenDoc?.x ?? 0) + ((Number(tokenDoc?.width ?? 1) * size) / 2),
        y: Number(tokenDoc?.y ?? 0) + ((Number(tokenDoc?.height ?? 1) * size) / 2),
    };
}

function getChebyshevDistanceSquares(sourceToken, targetToken) {
    const sourceCenter = getTokenCenter(sourceToken);
    const targetCenter = getTokenCenter(targetToken);
    const size = canvas?.grid?.size ?? 100;
    const deltaX = Math.abs((targetCenter.x - sourceCenter.x) / size);
    const deltaY = Math.abs((targetCenter.y - sourceCenter.y) / size);
    return Math.max(deltaX, deltaY);
}

function isRangeSatisfied(sourceToken, targetToken, targetRange) {
    const range = String(targetRange ?? "").trim();
    if (!range || /^sight$/i.test(range) || /^voice$/i.test(range) || /^placed$/i.test(range) || /^self$/i.test(range)) {
        return true;
    }
    if (/^touch$/i.test(range)) {
        return getChebyshevDistanceSquares(sourceToken, targetToken) <= 1;
    }
    const numericMatch = /^(\d+)(?:\s*squares?)?$/i.exec(range);
    if (numericMatch) {
        return getChebyshevDistanceSquares(sourceToken, targetToken) <= Number.parseInt(numericMatch[1], 10);
    }
    return true;
}

function resolveTargetTokens(effect, sourceToken, explicitTargets = []) {
    const targetType = String(effect.TargetType ?? "Actor").trim();
    if (targetType === "Self") return [sourceToken];
    if (!["Actor", "BoundEntity", "PactBearer"].includes(targetType)) return [];
    const normalizedTargets = explicitTargets.map(normalizeTokenDocument).filter(Boolean);
    const targetCount = parseTargetCount(effect.TargetCount);
    if (!normalizedTargets.length) return [];
    if (!Number.isFinite(targetCount)) return normalizedTargets;
    return normalizedTargets.slice(0, targetCount);
}

function normalizeItemDocument(itemLike) {
    if (!itemLike) return null;
    if (itemLike.documentName === "Item") return itemLike;
    if (itemLike.document?.documentName === "Item") return itemLike.document;
    return null;
}

function getEligibleItemTargets(actor, carrierItem) {
    const items = actor?.items?.contents ?? actor?.items ?? [];
    return Array.from(items)
        .map(normalizeItemDocument)
        .filter(Boolean)
        .filter((candidate) => candidate.id !== carrierItem?.id);
}

async function promptForItemTargets(carrierItem, effect, candidates, targetCount) {
    if (!candidates.length) return [];
    if (candidates.length === 1) return [candidates[0]];
    const finiteTargetCount = Number.isFinite(targetCount) ? Math.max(1, targetCount) : 1;

    return await new Promise((resolve) => {
        let settled = false;
        const checkboxMarkup = candidates.map((candidate) => {
            const meta = candidate.type ? ` <span style="opacity:0.7">(${escapeHtml(candidate.type)})</span>` : "";
            return "<label style=\"display:flex; gap:0.5rem; align-items:flex-start; margin:0.3rem 0;\">"
                + `<input type="${finiteTargetCount === 1 ? "radio" : "checkbox"}" name="targetItem" value="${escapeHtml(candidate.id)}" />`
                + `<span>${escapeHtml(candidate.name)}${meta}</span>`
                + "</label>";
        }).join("");
        const guidance = finiteTargetCount === 1
            ? "Choose one item to receive the spell."
            : `Choose up to ${finiteTargetCount} item targets for the spell.`;
        const content = "<form class=\"dialog-1547 dialog-1547-item-target\">"
            + `<div style="margin-bottom:0.6rem;"><strong>${escapeHtml(carrierItem?.name ?? "Spell")}</strong></div>`
            + `<div style="margin-bottom:0.6rem;">${escapeHtml(effect?.Description || guidance)}</div>`
            + `<div style="margin-bottom:0.6rem; opacity:0.8;">${escapeHtml(guidance)}</div>`
            + `<div style="max-height:18rem; overflow:auto;">${checkboxMarkup}</div>`
            + "</form>";
        const dialog = new Dialog({
            title: "Choose Item Target",
            content,
            buttons: {
                ok: {
                    icon: '<i class="fas fa-check"></i>',
                    label: "OK",
                    callback: (html) => {
                        settled = true;
                        const selectedIds = html.find('[name="targetItem"]:checked').toArray().map((input) => String(input.value ?? ""));
                        const picked = candidates.filter((candidate) => selectedIds.includes(String(candidate.id ?? "")));
                        resolve(finiteTargetCount === 1 ? picked.slice(0, 1) : picked.slice(0, finiteTargetCount));
                    }
                },
                cancel: {
                    label: "Cancel",
                    callback: () => {
                        settled = true;
                        resolve([]);
                    }
                }
            },
            default: "ok",
            close: () => {
                if (!settled) resolve([]);
            }
        });
        dialog.render(true);
    });
}

async function resolveSharedItemTargets(item, effects, sourceActor, options = {}) {
    const itemTargetEffects = effects.filter((effect) => String(effect.TargetType ?? "").trim() === "Item");
    if (!itemTargetEffects.length) return [];

    const explicitItemsRaw = Array.isArray(options.targetItems)
        ? options.targetItems
        : (options.targetItem ? [options.targetItem] : []);
    const explicitItems = explicitItemsRaw.map(normalizeItemDocument).filter(Boolean);
    if (explicitItems.length) return explicitItems;

    const candidates = getEligibleItemTargets(sourceActor, item);
    if (!candidates.length) return [];

    const maxTargetCount = itemTargetEffects.reduce((currentMax, effect) => {
        const count = parseTargetCount(effect.TargetCount);
        if (!Number.isFinite(count)) return Math.max(currentMax, candidates.length);
        return Math.max(currentMax, count);
    }, 1);

    return promptForItemTargets(item, itemTargetEffects[0], candidates, maxTargetCount);
}

function normalizeStatLabel(label) {
    const normalized = String(label ?? "").trim().toLowerCase();
    return Object.keys(STAT_KEY_MAP).find((key) => key.toLowerCase() === normalized) ?? null;
}

function buildStatFormulaFromActor(actor, statLabel) {
    const normalized = normalizeStatLabel(statLabel);
    if (!normalized || !actor) return "";
    const props = actor.system?.props ?? {};
    const keys = STAT_KEY_MAP[normalized];
    const dice = getNumericProp(props, [keys.dice, normalized + "Dice", statLabel + "Dice"]);
    const mod = getNumericProp(props, [keys.mod, normalized + "Mod", statLabel + "Mod"]) ?? 0;
    if (dice === null && mod === null) return "";
    return buildRollFormula(dice ?? 0, mod ?? 0);
}

function resolveFormulaText(formulaText, sourceActor, targetActor, fallbackStat = "") {
    const raw = String(formulaText ?? "").trim();
    const match = /^(source|caster|target)\s+(.+)$/i.exec(raw);
    if (match) {
        const role = match[1].toLowerCase();
        const statLabel = match[2].trim();
        return buildStatFormulaFromActor(role === "target" ? targetActor : sourceActor, statLabel);
    }
    if (raw && /\dd\d/i.test(raw)) return raw;
    if (raw) {
        return buildStatFormulaFromActor(sourceActor, raw) || buildStatFormulaFromActor(targetActor, raw);
    }
    if (fallbackStat) {
        return buildStatFormulaFromActor(targetActor, fallbackStat);
    }
    return "";
}

async function evaluateFormula(formulaText) {
    const text = String(formulaText ?? "").trim();
    if (!text) return { formula: "", total: 0, roll: null };
    const roll = await new Roll(text).evaluate();
    return { formula: text, total: Number(roll.total ?? 0) || 0, roll };
}

async function resolveOutcome(effect, sourceActor, targetActor) {
    const checkType = String(effect.CheckType ?? "None").trim();
    if (!checkType || checkType === "None") {
        return { outcome: "success", sourceRoll: null, targetRoll: null };
    }

    const sourceFormula = resolveFormulaText(effect.CheckFormula, sourceActor, targetActor);
    const targetFormula = resolveFormulaText(effect.ResistanceFormula, sourceActor, targetActor, effect.ResistanceType);
    const sourceRoll = await evaluateFormula(sourceFormula || "1d6");
    const targetRoll = await evaluateFormula(targetFormula || "0");

    if (sourceRoll.total > targetRoll.total) {
        return { outcome: "success", sourceRoll, targetRoll };
    }
    if (sourceRoll.total === targetRoll.total) {
        return { outcome: "partial", sourceRoll, targetRoll };
    }
    return { outcome: "failure", sourceRoll, targetRoll };
}

function buildEffectName(carrierItem, effect) {
    const description = String(effect.Description ?? "").trim();
    if (description) return `${carrierItem.name}: ${description}`;
    return `${carrierItem.name}: ${effect.EffectType}/${effect.EffectSubtype}`;
}

function buildEffectDuration(effect) {
    const type = String(effect.DurationType ?? "").trim();
    const value = String(effect.DurationValue ?? "").trim();
    if (!type || /^instant$/i.test(type)) return {};
    const label = value ? `${type} ${value}` : type;
    return { startTime: game?.time?.worldTime ?? 0, label };
}

export function buildManagedActiveEffectData(carrierItem, effect, targetDoc, outcome) {
    const subtype = String(effect.EffectSubtype ?? "").trim();
    return {
        name: buildEffectName(carrierItem, effect),
        img: carrierItem.img ?? "icons/svg/aura.svg",
        origin: carrierItem.uuid ?? null,
        disabled: false,
        duration: buildEffectDuration(effect),
        statuses: subtype ? [slugify(subtype)] : [],
        flags: {
            [MODULE_ID]: {
                usageEffect: deepClone(effect),
                sourceItemId: carrierItem.id ?? null,
                sourceItemName: carrierItem.name ?? "",
                sourceActorId: carrierItem.parent?.id ?? null,
                targetActorId: targetDoc?.documentName === "Actor" ? (targetDoc.id ?? null) : null,
                targetItemId: targetDoc?.documentName === "Item" ? (targetDoc.id ?? null) : null,
                targetDocumentType: targetDoc?.documentName ?? null,
                appliedOutcome: outcome,
                effectType: String(effect.EffectType ?? "").trim(),
                effectSubtype: subtype,
            }
        },
        changes: [],
    };
}

function resolveDirectTargetPath(effect) {
    const target = String(effect.PayloadTarget ?? "").trim();
    if (!target) return { kind: "invalid", reason: "No PayloadTarget was provided for the direct data change." };
    if (target.startsWith("system.props.")) return { kind: "property", path: target };

    const primaryStatMatch = /^PrimaryStat:([A-Za-z]+):(dice|mod)$/i.exec(target);
    if (primaryStatMatch) {
        const statLabel = normalizeStatLabel(primaryStatMatch[1]);
        if (!statLabel) return { kind: "invalid", reason: `Unknown primary stat '${primaryStatMatch[1]}'.` };
        const propKey = primaryStatMatch[2].toLowerCase() === "dice" ? STAT_KEY_MAP[statLabel].dice : STAT_KEY_MAP[statLabel].mod;
        return { kind: "property", path: `system.props.${propKey}` };
    }

    const primaryStatStepsMatch = /^PrimaryStat:([A-Za-z]+):steps$/i.exec(target);
    if (primaryStatStepsMatch) {
        const statLabel = normalizeStatLabel(primaryStatStepsMatch[1]);
        if (!statLabel) return { kind: "invalid", reason: `Unknown primary stat '${primaryStatStepsMatch[1]}'.` };
        return { kind: "primary-stat-steps", statLabel };
    }

    const resourceMatch = /^Resource:([A-Za-z0-9_]+)$/i.exec(target);
    if (resourceMatch) return { kind: "property", path: `system.props.${resourceMatch[1]}` };

    const traitMatch = /^FlagTrait:([A-Za-z0-9_-]+)$/i.exec(target);
    if (traitMatch) {
        const slug = slugify(traitMatch[1]);
        return {
            kind: "trait-record",
            namePath: `flags.${MODULE_ID}.directTraits.${slug}.name`,
            textPath: `flags.${MODULE_ID}.directTraits.${slug}.text`,
            visiblePath: `flags.${MODULE_ID}.directTraits.${slug}.visible`,
            subtypePath: `flags.${MODULE_ID}.directTraits.${slug}.subtype`,
        };
    }

    const tagMatch = /^FlagTag:([A-Za-z0-9_-]+)$/i.exec(target);
    if (tagMatch) {
        return { kind: "flag-tag", path: `flags.${MODULE_ID}.ruleTags.${slugify(tagMatch[1])}` };
    }

    return { kind: "invalid", reason: `Unsupported direct data target '${target}'.` };
}

function buildPrimaryStatStepUpdate(targetDoc, statLabel, operation, amount) {
    const props = targetDoc?.system?.props ?? {};
    if (!STAT_KEY_MAP[statLabel]) {
        return { update: null, reason: `Unknown primary stat '${statLabel}'.` };
    }
    if (!Number.isFinite(amount)) {
        return { update: null, reason: `Primary-stat step changes require a numeric PayloadValue for '${statLabel}'.` };
    }

    const signedSteps = ["decrease", "subtract"].includes(operation)
        ? -Math.abs(amount)
        : Math.trunc(amount);
    const { update } = buildAdvanceStatUpdateFromProps(props, statLabel, signedSteps);
    return { update, reason: "" };
}

function buildDirectDocumentUpdate(effect, targetDoc) {
    const target = String(effect.PayloadTarget ?? "").trim();
    const operation = String(effect.PayloadOperation ?? "Apply").trim().toLowerCase();
    const amount = Number(effect.PayloadValue ?? 0);
    if (!target || !targetDoc?.update) return { update: null, reason: "The target document could not be updated directly." };

    const resolvedTarget = resolveDirectTargetPath(effect);
    if (resolvedTarget.kind === "invalid") return { update: null, reason: resolvedTarget.reason };

    if (resolvedTarget.kind === "primary-stat-steps") {
        return buildPrimaryStatStepUpdate(targetDoc, resolvedTarget.statLabel, operation, amount);
    }

    if (resolvedTarget.kind === "property") {
        if (!Number.isFinite(amount)) {
            return { update: null, reason: `Direct numeric changes require a numeric PayloadValue for '${target}'.` };
        }
        const current = foundry.utils.getProperty(targetDoc, resolvedTarget.path) ?? 0;
        let next = current;
        switch (operation) {
            case "set":
                next = amount;
                break;
            case "decrease":
            case "subtract":
                next = Number(current) - amount;
                break;
            case "increase":
            case "add":
            case "apply":
            default:
                next = Number(current) + amount;
                break;
        }
        return { update: { [resolvedTarget.path]: next }, reason: "" };
    }

    if (resolvedTarget.kind === "trait-record") {
        const traitName = String(effect.PayloadTraitName ?? "").trim();
        const traitText = String(effect.PayloadTraitText ?? "").trim();
        if (!traitName && !traitText) {
            return { update: null, reason: `Trait records require PayloadTraitName or PayloadTraitText for '${target}'.` };
        }
        return {
            update: {
                [resolvedTarget.namePath]: traitName || String(effect.EffectSubtype ?? "").trim(),
                [resolvedTarget.textPath]: traitText || String(effect.PayloadNotes ?? effect.Description ?? "").trim(),
                [resolvedTarget.visiblePath]: Boolean(effect.Visible),
                [resolvedTarget.subtypePath]: String(effect.EffectSubtype ?? "").trim(),
            },
            reason: ""
        };
    }

    if (resolvedTarget.kind === "flag-tag") {
        const nextValue = !["remove", "clear"].includes(operation);
        return { update: { [resolvedTarget.path]: nextValue }, reason: "" };
    }

    return { update: null, reason: `Unsupported direct data target '${target}'.` };
}

function removalMatchesEffect(activeEffect, effect) {
    const stored = activeEffect?.flags?.[MODULE_ID]?.usageEffect ?? {};
    const storedType = String(stored.EffectType ?? activeEffect?.flags?.[MODULE_ID]?.effectType ?? "").trim();
    const storedSubtype = String(stored.EffectSubtype ?? activeEffect?.flags?.[MODULE_ID]?.effectSubtype ?? "").trim();
    const removeSubtype = String(effect.EffectSubtype ?? "").trim();

    switch (removeSubtype) {
        case "Binding":
            return storedType === "Binding";
        case "Possession":
            return storedType === "Possession" || storedSubtype === "Possessed";
        case "Ward":
            return storedType === "Ward" || storedType === "Protection";
        case "Curse":
            return storedType === "Status" && ["Cursed", "IllLuck", "Doomed", "LostFaith", "Weakened"].includes(storedSubtype);
        case "Tag":
            return String(stored.PayloadTag ?? "").trim() && String(stored.PayloadTag ?? "").trim() === String(effect.PayloadTag ?? "").trim();
        case "Status":
            if (effect.PayloadValue) return storedSubtype === String(effect.PayloadValue).trim();
            return storedType === "Status";
        default:
            return false;
    }
}

// CSB disease-affliction items carry this template id (they are Items on the
// actor, not ActiveEffects) — a Remove/Disease effect deletes them outright.
const DISEASE_TEMPLATE_ID = "DZ7sK2mLp9Qx4TvR";

async function applyRemovalEffect(carrierItem, effect, targetDoc) {
    if (!targetDoc?.deleteEmbeddedDocuments) {
        return { applied: false, note: "Target document cannot remove embedded effects." };
    }

    // Remove/Disease cures an affliction: delete the disease ITEM(s) on the
    // target. PayloadValue names the disease (e.g. "Plague"); empty cures every
    // disease the target carries. Used by the Herbalism cure line.
    if (String(effect.EffectSubtype ?? "").trim() === "Disease") {
        const wanted = String(effect.PayloadValue ?? "").trim().toLowerCase();
        const diseaseItems = Array.from(targetDoc.items ?? [])
            .filter((item) => String(item?.system?.template ?? "") === DISEASE_TEMPLATE_ID
                && (!wanted || String(item?.name ?? "").trim().toLowerCase() === wanted));
        const ids = diseaseItems.map((item) => item.id).filter(Boolean);
        if (!ids.length) {
            return { applied: false, note: wanted ? `The target does not carry ${effect.PayloadValue}.` : "The target carries no disease to cure." };
        }
        const names = diseaseItems.map((item) => item.name).join(", ");
        await targetDoc.deleteEmbeddedDocuments("Item", ids);
        return { applied: true, note: `Cured: ${names}.` };
    }

    const matchingIds = Array.from(targetDoc.effects ?? [])
        .filter((activeEffect) => removalMatchesEffect(activeEffect, effect))
        .map((activeEffect) => activeEffect.id)
        .filter(Boolean);

    if (!matchingIds.length) {
        return { applied: false, note: "No matching managed effect was present to remove." };
    }

    await targetDoc.deleteEmbeddedDocuments("ActiveEffect", matchingIds);
    return { applied: true, note: `Removed ${matchingIds.length} effect(s).` };
}

async function applyGrantItemEffect(carrierItem, effect, targetDoc) {
    const ownerActor = targetDoc?.documentName === "Actor"
        ? targetDoc
        : (targetDoc?.documentName === "Item" && targetDoc?.parent?.documentName === "Actor" ? targetDoc.parent : null);
    if (!ownerActor?.createEmbeddedDocuments) {
        return { applied: false, note: "Granted items currently require an actor-owned target." };
    }

    const templateId = String(effect.GrantedItemTemplate ?? "").trim();
    const templateItem = templateId ? getItemById(templateId) : getItemById(UNEQUIPPABLE_TEMPLATE_ID);
    const name = String(effect.GrantedItemName ?? effect.PayloadTraitName ?? effect.EffectSubtype ?? carrierItem.name).trim();
    if (!templateItem) {
        return { applied: false, note: "No item template was available for this granted item." };
    }

    const itemData = {
        name,
        type: "equippableItem",
        img: carrierItem.img ?? templateItem.img,
        system: {
            ...cloneTemplateSystem(templateItem),
            props: {
                Description: String(effect.PayloadNotes ?? effect.Description ?? "").trim(),
            }
        },
        effects: [],
        folder: null,
        flags: {
            "custom-system-builder": {
                version: templateItem.flags?.["custom-system-builder"]?.version ?? "5.2.0"
            },
            [SOURCE_FLAG_SCOPE]: {
                grantedByEffect: true,
                sourceItemId: carrierItem.id ?? null,
                sourceItemName: carrierItem.name ?? "",
                attachedTargetItemId: targetDoc?.documentName === "Item" ? (targetDoc.id ?? null) : null,
                attachedTargetItemName: targetDoc?.documentName === "Item" ? (targetDoc.name ?? "") : "",
                usageEffect: deepClone(effect),
            }
        },
        items: [],
        ownership: { default: 0 }
    };

    await ownerActor.createEmbeddedDocuments("Item", [itemData]);
    return {
        applied: true,
        note: targetDoc?.documentName === "Item"
            ? `Granted item '${name}' and linked it to '${targetDoc.name}'.`
            : `Granted item '${name}'.`
    };
}

async function applyCreateActiveEffect(carrierItem, effect, targetDoc, outcome) {
    if (!targetDoc?.createEmbeddedDocuments) {
        return { applied: false, note: "Target document cannot receive active effects." };
    }
    const effectData = buildManagedActiveEffectData(carrierItem, effect, targetDoc, outcome);
    await targetDoc.createEmbeddedDocuments("ActiveEffect", [effectData]);
    return { applied: true, note: `Applied '${effect.EffectSubtype}'.` };
}

async function applyEffectByMode(carrierItem, effect, sourceActor, targetActor, targetItem, outcome) {
    const applicationMode = String(effect.ApplicationMode ?? "NarrativeOnly").trim();
    const targetType = String(effect.TargetType ?? "Actor").trim();
    const primaryTargetDoc = targetType === "Item"
        ? (targetItem ?? null)
        : targetType === "Area"
            ? (sourceActor ?? null)
        : (targetActor ?? sourceActor ?? null);

    if (String(effect.EffectType ?? "").trim() === "Remove") {
        return applyRemovalEffect(carrierItem, effect, primaryTargetDoc);
    }

    switch (applicationMode) {
        case "DirectDataChange": {
            const { update, reason } = buildDirectDocumentUpdate(effect, primaryTargetDoc);
            if (update && primaryTargetDoc?.update) {
                await primaryTargetDoc.update(update);
                return { applied: true, note: "Updated document data." };
            }
            return { applied: false, note: reason || "This direct data change was too ambiguous to apply safely." };
        }
        case "GrantItem":
            return applyGrantItemEffect(carrierItem, effect, primaryTargetDoc);
        case "CreateActiveEffect":
            return applyCreateActiveEffect(carrierItem, effect, primaryTargetDoc, outcome);
        case "Hybrid": {
            if (String(effect.EffectType ?? "").trim() === "Grant") {
                return applyGrantItemEffect(carrierItem, effect, primaryTargetDoc);
            }
            const { update, reason } = buildDirectDocumentUpdate(effect, primaryTargetDoc);
            if (update && primaryTargetDoc?.update) {
                await primaryTargetDoc.update(update);
                return { applied: true, note: "Applied hybrid data change." };
            }
            if (primaryTargetDoc?.createEmbeddedDocuments) {
                return applyCreateActiveEffect(carrierItem, effect, primaryTargetDoc, outcome);
            }
            return { applied: false, note: reason || "This hybrid effect could not be applied to the chosen target." };
        }
        case "NarrativeOnly":
        default:
            return { applied: true, note: effect.PayloadNotes || effect.Description || `${effect.EffectType}/${effect.EffectSubtype}` };
    }
}

function buildChatSummaryHtml(carrierItem, sourceToken, rows) {
    const items = rows.map((row) => {
        const targetLabel = row.targetName ? ` on <strong>${row.targetName}</strong>` : "";
        const rollText = row.sourceRoll != null || row.targetRoll != null
            ? ` <span>(${row.sourceRoll ?? "-"} vs ${row.targetRoll ?? "-"})</span>`
            : "";
        return `<li><strong>${row.effectLabel}</strong>${targetLabel}: ${row.outcome}${rollText}${row.note ? ` - ${row.note}` : ""}</li>`;
    }).join("");
    return `
        <div class="chat-card">
            <header class="card-header">
                <h3>${carrierItem.name}</h3>
            </header>
            <div class="card-content">
                <p><strong>Source:</strong> ${sourceToken?.name ?? carrierItem.parent?.name ?? "Unknown"}</p>
                <ul>${items}</ul>
            </div>
        </div>
    `;
}

async function postUsageEffectSummaryToChat(carrierItem, sourceToken, rows) {
    if (!rows.length) return;
    const speaker = ChatMessage.getSpeaker({ actor: sourceToken?.actor ?? carrierItem.parent ?? null, token: sourceToken ?? null });
    await ChatMessage.create({
        speaker,
        flavor: `${carrierItem.name} - Usage Effects`,
        content: buildChatSummaryHtml(carrierItem, sourceToken, rows),
    });
}

export async function resolveUsageEffectsFromCarrier(item, options = {}) {
    if (!isSupportedCarrierItem(item)) {
        throw new Error("This item does not support runtime usage-effect resolution.");
    }

    const effects = Array.isArray(options.effects) && options.effects.length
        ? options.effects.map(normalizeEffectProps)
        : collectUsageEffectsFromCarrier(item);
    if (!effects.length) {
        // Callers that resolve effects opportunistically (e.g. a ritual whose
        // spell has only a descriptive success) pass allowEmpty to get an empty
        // result instead of a hard error. Direct user invocation still throws.
        if (options.allowEmpty) {
            return { ok: false, sourceTokenId: null, targetsResolved: [], empty: true };
        }
        throw new Error(`${item.name} has no usage effects to resolve.`);
    }

    const sourceToken = resolveSourceTokenForItem(item, options.sourceToken);
    if (!sourceToken?.actor) {
        throw new Error("Select or control a source token before resolving this item's effects.");
    }

    const explicitTargets = Array.isArray(options.targetTokens)
        ? options.targetTokens.map(normalizeTokenDocument).filter(Boolean)
        : Array.from(game.user?.targets ?? []).map(normalizeTokenDocument).filter(Boolean);
    const sharedItemTargets = await resolveSharedItemTargets(item, effects, sourceToken.actor, options);

    const rows = [];
    for (const effect of effects) {
        const targetType = String(effect.TargetType ?? "Actor").trim();
        const effectLabel = `${effect.EffectType}/${effect.EffectSubtype}`;
        if (!["Self", "Actor", "Item", "Descriptive", "Area", "BoundEntity", "PactBearer"].includes(targetType)) {
            rows.push({
                effectLabel,
                targetName: "",
                outcome: "failure",
                sourceRoll: null,
                targetRoll: null,
                applied: false,
                note: `Target type '${targetType}' is not supported by the runtime resolver yet.`,
            });
            continue;
        }
        if (targetType === "Item" && !sharedItemTargets.length) {
            rows.push({
                effectLabel,
                targetName: "",
                outcome: "failure",
                sourceRoll: null,
                targetRoll: null,
                applied: false,
                note: "No item target was chosen for this spell.",
            });
            continue;
        }
        const targetTokens = resolveTargetTokens(effect, sourceToken, explicitTargets);

        if (["Actor", "BoundEntity", "PactBearer"].includes(targetType) && !targetTokens.length) {
            rows.push({
                effectLabel,
                targetName: "",
                outcome: "failure",
                sourceRoll: null,
                targetRoll: null,
                applied: false,
                note: "No valid targets were selected.",
            });
            continue;
        }

        const effectiveTargets = ["Actor", "BoundEntity", "PactBearer"].includes(targetType)
            ? targetTokens.map((targetToken) => ({ targetToken, targetItem: null }))
            : targetType === "Item"
                ? sharedItemTargets.slice(0, Number.isFinite(parseTargetCount(effect.TargetCount)) ? parseTargetCount(effect.TargetCount) : sharedItemTargets.length)
                    .map((targetItem) => ({ targetToken: null, targetItem }))
                : [{ targetToken: null, targetItem: null }];
        for (const { targetToken, targetItem } of effectiveTargets) {
            if (targetToken && !isRangeSatisfied(sourceToken, targetToken, effect.TargetRange)) {
                rows.push({
                    effectLabel,
                    targetName: targetToken.name ?? targetToken.actor?.name ?? "",
                    outcome: "failure",
                    sourceRoll: null,
                    targetRoll: null,
                    applied: false,
                    note: `Target is out of range (${effect.TargetRange}).`,
                });
                continue;
            }

            const targetActor = targetToken?.actor ?? null;
            const targetDoc = targetType === "Item" ? targetItem : targetActor;
            const check = await resolveOutcome(effect, sourceToken.actor, targetActor);
            let application = { applied: false, note: "" };

            if (check.outcome === "success" || check.outcome === "partial") {
                application = await applyEffectByMode(item, effect, sourceToken.actor, targetActor, targetItem, check.outcome);
                if (application.applied && targetType === "Area") {
                    application.note = application.note
                        ? `${application.note} Stored on the source actor as the current area-effect proxy.`
                        : "Stored on the source actor as the current area-effect proxy.";
                }
                if (check.outcome === "partial" && effect.OnPartial) {
                    application.note = application.note
                        ? `${application.note} ${effect.OnPartial}`.trim()
                        : effect.OnPartial;
                }
            } else {
                application.note = effect.OnFailure || "The effect did not take hold.";
            }

            rows.push({
                effectLabel,
                targetName: targetType === "Area"
                    ? "Area"
                    : (targetItem?.name ?? targetToken?.name ?? targetDoc?.name ?? ""),
                outcome: check.outcome,
                sourceRoll: check.sourceRoll?.total ?? null,
                targetRoll: check.targetRoll?.total ?? null,
                applied: application.applied,
                note: application.note,
            });
        }
    }

    await postUsageEffectSummaryToChat(item, sourceToken, rows);
    return {
        ok: rows.some((row) => row.applied),
        sourceTokenId: sourceToken.id ?? null,
        targetsResolved: rows,
    };
}

export function registerUsageEffectActionResolver() {
    const moduleApi = game.modules.get(MODULE_ID);
    if (!moduleApi) {
        console.warn(`${MODULE_ID} | registerUsageEffectActionResolver: module not found`);
        return;
    }
    moduleApi.api = moduleApi.api ?? {};
    moduleApi.api.collectUsageEffectsFromCarrier = collectUsageEffectsFromCarrier;
    moduleApi.api.resolveUsageEffectsFromCarrier = resolveUsageEffectsFromCarrier;
}

// Pure helpers exported for unit testing (no behavioural change to the runtime).
export {
    getText,
    getBoolean,
    getNumericProp,
    slugify,
    escapeHtml,
    buildRollFormula,
    parseTargetCount,
    normalizeEffectProps,
    isSupportedCarrierItem,
    resolveDirectTargetPath,
    buildDirectDocumentUpdate,
    removalMatchesEffect,
    isRangeSatisfied,
    normalizeStatLabel,
    buildStatFormulaFromActor,
    resolveFormulaText,
};
