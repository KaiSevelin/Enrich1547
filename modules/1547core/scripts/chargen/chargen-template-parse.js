// Pure parsing of CSB chargen-template items into the internal "choice data"
// shape consumed by SkillTreeChargenApp. Extracted from chargen.js so the
// parsing logic is isolated and unit-testable with literal fixtures.
//
// `parseTemplateItemToChoiceData` takes a `validate(parsed, tableName)` callback
// so it stays free of the validation cluster; the class injects its
// `_validateParsedResultSchema`.

import { SPECIAL_BIO_TABLES, SPECIAL_ITEM_TABLES } from "./interface-registry.js";
import {
    toBoolean,
    stringListFromCSV,
    numberOrNull,
    normalizeTemplateType,
    getTemplateProps,
} from "./chargen-utils.js";

/** Reward indexes present in a props map (Reward1*, Reward2*, …), sorted. */
export function rewardIndexesFromProps(props) {
    const idx = new Set();
    for (const k of Object.keys(props ?? {})) {
        const m = /^Reward(\d+)([A-Za-z].*)?$/.exec(k);
        if (m) idx.add(Number(m[1]));
    }
    return Array.from(idx).sort((a, b) => a - b);
}

/** Effect indexes for a given reward (Reward{n}Effect{i}Type), sorted. */
export function effectIndexesForReward(props, rewardIndex) {
    const idx = new Set();
    const rx = new RegExp(`^Reward${rewardIndex}Effect(\\d+)Type$`);
    for (const k of Object.keys(props ?? {})) {
        const m = rx.exec(k);
        if (m) idx.add(Number(m[1]));
    }
    return Array.from(idx).sort((a, b) => a - b);
}

/** Legacy single-reward effect indexes (Effect{i}Type), sorted. */
export function effectIndexesForLegacySingle(props) {
    const idx = new Set();
    const rx = /^Effect(\d+)Type$/;
    for (const k of Object.keys(props ?? {})) {
        const m = rx.exec(k);
        if (m) idx.add(Number(m[1]));
    }
    return Array.from(idx).sort((a, b) => a - b);
}

/** All changes for a reward, falling back to the single-change field layout. */
export function collectRewardChangesFromProps(props, rewardIndex) {
    const out = [];
    const effectIndexes = effectIndexesForReward(props, rewardIndex);
    if (effectIndexes.length) {
        for (const i of effectIndexes) {
            const prefix = `Reward${rewardIndex}Effect${i}`;
            const ch = buildChangeFromTemplateReward(props, prefix);
            if (ch) out.push(ch);
        }
        return out;
    }

    // Backward compatibility: single change fields like Reward1Type/Reward1Amount/...
    const fallback = buildChangeFromTemplateReward(props, `Reward${rewardIndex}`);
    if (fallback) out.push(fallback);
    return out;
}

/** Build one change object from prefixed template props (e.g. "Reward1Effect2"). */
export function buildChangeFromTemplateReward(props, prefix) {
    const type = normalizeTemplateType(props[`${prefix}Type`]);
    if (!type || type === "nothing") return null;

    const ch = { type };

    const characteristic = String(props[`${prefix}Characteristic`] ?? "").trim();
    const steps = numberOrNull(props[`${prefix}Steps`]);
    const targetKey = String(props[`${prefix}TargetKey`] ?? "").trim();
    const targetLevel = numberOrNull(props[`${prefix}TargetLevel`]);
    const amount = numberOrNull(props[`${prefix}Amount`]);
    const formula = String(props[`${prefix}Formula`] ?? "").trim();
    const on = toBoolean(props[`${prefix}On`]);
    const action = String(props[`${prefix}Action`] ?? "").trim();
    const category = String(props[`${prefix}Category`] ?? "").trim();
    const text = String(props[`${prefix}Text`] ?? "").trim();
    const tableUuid = String(props[`${prefix}TableUuid`] ?? "").trim();
    const itemUuid = String(props[`${prefix}ItemUuid`] ?? "").trim();
    const name = String(props[`${prefix}ItemName`] ?? "").trim();
    const qty = numberOrNull(props[`${prefix}Qty`]);
    const stack = toBoolean(props[`${prefix}Stack`]);
    const languageTableKey = String(props[`${prefix}LanguageTableKey`] ?? "").trim();

    if (SPECIAL_BIO_TABLES[type]) {
        return { type: "bio", roll: { tableUuid: SPECIAL_BIO_TABLES[type] } };
    }
    if (SPECIAL_ITEM_TABLES[type]) {
        const out = { type: "item", tableUuid: SPECIAL_ITEM_TABLES[type] };
        if (qty != null) out.qty = qty;
        return out;
    }

    if (type === "stat") {
        if (characteristic) ch.characteristic = characteristic;
        if (steps != null) ch.steps = steps;
        return ch;
    }
    if (type === "skill" || type === "maneuver") {
        if (targetKey) ch.targetKey = targetKey;
        if (targetLevel != null) ch.targetLevel = targetLevel;
        return ch;
    }
    if (type === "money") {
        if (amount != null) ch.amount = amount;
        if (formula) ch.formula = formula;
        return ch;
    }
    if (type === "luck") {
        ch.on = on;
        return ch;
    }
    if (type === "social") {
        if (amount != null) ch.amount = amount;
        return ch;
    }
    if (type === "drive") {
        if (action) ch.action = action;
        if (category) ch.category = category;
        return ch;
    }
    if (type === "bio") {
        if (text) ch.text = text;
        if (tableUuid) ch.roll = { tableUuid };
        return ch;
    }
    if (type === "item") {
        if (tableUuid) ch.tableUuid = tableUuid;
        if (itemUuid) ch.itemUuid = itemUuid;
        if (name) ch.name = name;
        if (qty != null) ch.qty = qty;
        ch.stack = stack;
        return ch;
    }
    if (type === "language") {
        if (languageTableKey) ch.tableKey = languageTableKey;
        return ch;
    }

    if (type === "contact") {
        if (text) ch.text = text;
        return ch;
    }

    // body currently carries no additional fields
    return ch;
}

/** Live rows of a CSB dynamic table (object-of-rows), excluding deletions. */
export function rowsFromDynamicTable(tableData) {
    const rawRows = tableData && typeof tableData === "object" ? Object.values(tableData) : [];
    return rawRows.filter(r => r && typeof r === "object" && !Array.isArray(r) && !r.$deleted);
}

/** Build one change object from a dynamic effect-table row. */
export function buildChangeFromEffectRow(row) {
    const type = normalizeTemplateType(row?.Type);
    if (!type || type === "nothing") return null;

    const targetKey = String(row?.TargetKey ?? "").trim();
    const amountRaw = String(row?.Amount ?? "").trim();
    const targetText = String(row?.TargetText ?? "").trim();
    const amountNum = numberOrNull(amountRaw);
    const ch = { type };

    if (SPECIAL_BIO_TABLES[type]) {
        return { type: "bio", roll: { tableUuid: SPECIAL_BIO_TABLES[type] } };
    }
    if (SPECIAL_ITEM_TABLES[type]) {
        const out = { type: "item", tableUuid: SPECIAL_ITEM_TABLES[type] };
        if (amountNum != null) out.qty = amountNum;
        return out;
    }

    if (type === "stat") {
        if (targetKey) ch.characteristic = targetKey;
        if (amountNum != null) ch.steps = amountNum;
        return ch;
    }
    if (type === "skill" || type === "maneuver") {
        if (targetKey) ch.targetKey = targetKey;
        if (amountNum != null) ch.targetLevel = amountNum;
        return ch;
    }
    if (type === "money") {
        if (amountRaw && amountNum == null) ch.formula = amountRaw;
        else if (amountNum != null) ch.amount = amountNum;
        return ch;
    }
    if (type === "luck") {
        ch.on = toBoolean(amountRaw || true);
        return ch;
    }
    if (type === "contact") {
        if (targetText) ch.text = targetText;
        return ch;
    }
    if (type === "body") return ch;
    if (type === "social") {
        if (amountNum != null) ch.amount = amountNum;
        return ch;
    }
    if (type === "drive") {
        const action = targetKey.toLowerCase();
        if (action === "add" || action === "remove") ch.action = action;
        if (action === "add" && amountRaw) ch.category = amountRaw;
        return ch;
    }
    if (type === "bio") {
        if (amountRaw) ch.text = amountRaw;
        if (targetKey) ch.roll = { tableUuid: targetKey };
        return ch;
    }
    if (type === "item") {
        if (targetKey.startsWith("RollTable.")) ch.tableUuid = targetKey;
        else if (targetKey.includes(".")) ch.itemUuid = targetKey;
        else if (targetKey) ch.name = targetKey;
        if (amountNum != null) ch.qty = amountNum;
        return ch;
    }
    if (type === "language") {
        if (targetKey) ch.tableKey = targetKey;
        return ch;
    }
    return ch;
}

/** Build a weighted effect-table descriptor from a dynamic-table prop. */
export function buildEffectTableFromProps(props, tableKey) {
    const rows = rowsFromDynamicTable(props?.[tableKey]).map((row, idx) => {
        const weight = numberOrNull(row?.Weight) ?? 0;
        const nextTableUuid = String(row?.NextTable ?? "").trim();
        const transitionText = String(row?.TransitionText ?? "").trim();
        const transitionMode = String(row?.TransitionMode ?? "").trim().toLowerCase();
        const transitionPrompt = String(row?.TransitionPrompt ?? "").trim();
        return {
            rowIndex: idx,
            weight,
            change: buildChangeFromEffectRow(row),
            next: nextTableUuid ? { tableUuid: nextTableUuid } : null,
            transitionText,
            transitionMode,
            transitionPrompt,
            raw: row
        };
    }).filter(r => r.weight > 0);

    if (!rows.length) return null;
    return { key: tableKey, rows };
}

/**
 * Parse a CSB chargen-template item into the internal choice-data shape.
 * `validate(parsed, tableName)` is invoked (side-effecting) on the final shape;
 * pass SkillTreeChargenApp._validateParsedResultSchema to preserve behaviour.
 */
export function parseTemplateItemToChoiceData(item, tableName = "RollTable", validate = () => {}) {
    const props = getTemplateProps(item);
    const title = String(props.ChoiceTitle ?? item?.name ?? "").trim();
    const text = String(props.ChoiceText ?? "").trim();
    const icon = String(props.ChoiceCard ?? props.ChoiceIcon ?? item?.img ?? "").trim();
    const tags = stringListFromCSV(props.ChoiceTags);
    const bio = String(props.ChoiceBio ?? "").trim();
    const humourChange = parseHumourChange(props.HumourChange);
    const deferredType = String(props.DeferredType ?? "").trim().toLowerCase();
    const deferredOrigin = String(props.DeferredOrigin ?? "").trim();
    const deferredDelay = String(props.DeferredDelay ?? "").trim();
    const deferredImage = String(props.DeferredImage ?? "").trim();
    const deferredStage = numberOrNull(props.DeferredStage);
    const deferred = deferredType
        ? {
            type: deferredType,
            origin: deferredOrigin,
            delay: deferredDelay || "1d6",
            image: deferredImage || icon,
            stage: deferredStage == null ? 1 : deferredStage
        }
        : null;

    const effectTables = ["Effects1", "Effects2", "Effects3"]
        .map(key => buildEffectTableFromProps(props, key))
        .filter(Boolean);

    if (effectTables.length) {
        const parsed = {
            choice: { title, text, icon, tags },
            bio,
            humourChange,
            deferred,
            rewards: [{ weight: 1, changes: [] }],
            effectTables
        };
        validate(parsed, tableName);
        return parsed;
    }

    const rewards = [];
    const rewardIndexes = rewardIndexesFromProps(props);
    for (const n of rewardIndexes) {
        const prefix = `Reward${n}`;
        const changes = collectRewardChangesFromProps(props, n);
        const nextTableUuid = String(props[`${prefix}NextTableUuid`] ?? "").trim();
        const weightRaw = numberOrNull(props[`${prefix}Weight`]);

        if (!changes.length && !nextTableUuid) continue;
        const rw = {
            weight: weightRaw == null ? 1 : weightRaw,
            changes
        };
        if (nextTableUuid) rw.next = { tableUuid: nextTableUuid };
        rewards.push(rw);
    }

    // Backstop for the single-reward template variant.
    if (!rewards.length) {
        const weightRaw = numberOrNull(props.Weight);
        const nextTableUuid = String(props.NextTableUuid ?? "").trim();
        const changes = [];
        const legacyIdx = effectIndexesForLegacySingle(props);
        if (legacyIdx.length) {
            for (const i of legacyIdx) {
                const ch = buildChangeFromTemplateReward(props, `Effect${i}`);
                if (ch) changes.push(ch);
            }
        } else {
            const ch = buildChangeFromTemplateReward(props, "Effect1");
            if (ch) changes.push(ch);
        }
        if (changes.length || nextTableUuid) {
            // NOTE: faithful port of chargen.js. `prefix` here is out of scope
            // (it was block-scoped to the reward loop above), so these two reads
            // throw a ReferenceError if this backstop branch is ever reached —
            // a pre-existing latent bug, preserved verbatim rather than guessed
            // at during extraction. Fix separately once the intended prop names
            // are confirmed.
            const rw = {
                weight: weightRaw == null ? 1 : weightRaw,
                changes,
                transitionMode: String(props[`${prefix}TransitionMode`] ?? "").trim().toLowerCase(),
                transitionPrompt: String(props[`${prefix}TransitionPrompt`] ?? "").trim()
            };
            if (nextTableUuid) rw.next = { tableUuid: nextTableUuid };
            rewards.push(rw);
        }
    }

    const parsed = {
        choice: { title, text, icon, tags },
        bio,
        humourChange,
        deferred,
        rewards
    };
    validate(parsed, tableName);
    return parsed;
}

// Parse a HumourChange directive: a CSV of +Humour / -Humour tokens, e.g.
// "+YellowBile,-Phlegm". Valid humours: Blood, YellowBile, BlackBile, Phlegm.
export function parseHumourChange(raw) {
    const VALID = new Set(["Blood", "YellowBile", "BlackBile", "Phlegm"]);
    const add = [];
    const remove = [];
    for (const tokenRaw of String(raw ?? "").split(/[,\n;]+/)) {
        const token = tokenRaw.trim();
        if (token.length < 2) continue;
        const name = token.slice(1).trim();
        if (!VALID.has(name)) continue;
        if (token[0] === "+") add.push(name);
        else if (token[0] === "-") remove.push(name);
    }
    return { add, remove };
}
