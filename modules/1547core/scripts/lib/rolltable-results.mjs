// Shared RollTable result-builders — the single source of truth for the
// `results` array (and the ritual formula/description) of each generated
// RollTable. Imported by build-packs.mjs (compile) and module-settings.js
// (world seeding). Only the *result rows* + ritual formula/description are
// shared here; each caller keeps its own document envelope (the CLI compile
// form adds `_key`, the runtime seed form sets `folder`/`folderHint`).

import { deepClone, deriveFoundryIdFromText } from "./build-helpers.mjs";
import { SOURCE_FLAG_SCOPE } from "./constants.mjs";

// Foundry CONST in the runtime; absent in the Node build (falls back to the
// same numeric values Foundry uses).
const TEXT_RESULT = () => globalThis.CONST?.TABLE_RESULT_TYPES?.TEXT ?? 0;
const DOCUMENT_RESULT = () => globalThis.CONST?.TABLE_RESULT_TYPES?.DOCUMENT ?? 1;

/** Boost table: one DOCUMENT result per boost item, keyed by its roll value. */
export function buildBoostResults(normalized) {
    const entries = Array.isArray(normalized.entries) ? normalized.entries : [];
    return entries.map((entry, index) => ({
        _id: deriveFoundryIdFromText(`${normalized._id}:${entry.roll ?? index}:result`),
        type: DOCUMENT_RESULT(),
        documentCollection: "Item",
        documentId: entry.boostId,
        text: entry.label ?? `Boost ${index + 1}`,
        img: "icons/svg/upgrade.svg",
        weight: 1,
        range: [entry.roll ?? (index + 1), entry.roll ?? (index + 1)],
        drawn: false,
        flags: { [SOURCE_FLAG_SCOPE]: { boostEntry: deepClone(entry) } }
    }));
}

/** Ritual step Xd6 "big pool" formula: authored pickFormula, else flat 1dN. */
export function ritualStepFormula(normalized) {
    const n = Array.isArray(normalized.entries) ? normalized.entries.length : 0;
    return String(normalized.pickFormula ?? "").trim() || `1d${Math.max(n, 1)}`;
}

/** Ritual step table description (carries the Xd6 step-pick formula). */
export function ritualStepDescription(normalized, formula) {
    const n = Array.isArray(normalized.entries) ? normalized.entries.length : 0;
    return [
        `<p><strong>Complexity:</strong> ${normalized.complexity ?? "Medium"}</p>`,
        normalized.drawFormula ? `<p><strong>Random ritual step draws:</strong> ${normalized.drawFormula}</p>` : "",
        `<p><strong>Step pick roll:</strong> ${formula}</p>`,
        `<p><strong>Available entries:</strong> ${n}</p>`,
        "<p>Roll the step-pick formula and read the matching band; common steps sit on the heavy central rolls, rare steps on the tails.</p>"
    ].filter(Boolean).join("");
}

/** Ritual step results: each entry occupies its authored pickRange band. */
export function buildRitualStepResults(normalized) {
    const entries = Array.isArray(normalized.entries) ? normalized.entries : [];
    return entries.map((entry, index) => {
        const range = Array.isArray(entry.pickRange) && entry.pickRange.length === 2
            ? [Number(entry.pickRange[0]), Number(entry.pickRange[1])]
            : [index + 1, index + 1];
        return {
            _id: deriveFoundryIdFromText(`${normalized._id}:${entry.id ?? index}:result`),
            type: TEXT_RESULT(),
            text: entry.stepText ?? `Ritual step ${index + 1}`,
            img: "icons/svg/d20-grey.svg",
            weight: range[1] - range[0] + 1,
            range,
            drawn: false,
            flags: { [SOURCE_FLAG_SCOPE]: { ritualStepEntry: deepClone(entry) } }
        };
    });
}

/** 3d6 bell-curve text table: N entries spread across the 16 totals (3..18). */
export function buildBellCurveResults(normalized, { entryKey, defaultText, img }) {
    const entries = Array.isArray(normalized.entries) ? normalized.entries : [];
    const total = Math.max(entries.length, 1);
    const rangeWidth = Math.max(1, Math.floor(16 / total));
    return entries.map((entry, index) => {
        let min = 3 + index * rangeWidth;
        let max = (index === entries.length - 1) ? 18 : (min + rangeWidth - 1);
        if (min > 18) min = 18;
        if (max > 18) max = 18;
        return {
            _id: deriveFoundryIdFromText(`${normalized._id}:${entry.id ?? index}:result`),
            type: TEXT_RESULT(),
            text: entry.resultText ?? `${defaultText} ${index + 1}`,
            img,
            weight: 1,
            range: [min, max],
            drawn: false,
            flags: { [SOURCE_FLAG_SCOPE]: { [entryKey]: deepClone(entry) } }
        };
    });
}

/**
 * Pact table: a flat 1dN over the authored rollTable strings. Returns the
 * derived id/name/formula plus the results, or null if the pact has no table.
 */
export function buildPactResults(pact) {
    const entries = Array.isArray(pact.rollTable) ? pact.rollTable : [];
    if (!entries.length) return null;
    const formula = String(pact.rollTableFormula ?? `1d${entries.length}`);
    const formulaMatch = formula.match(/^(\d+)d\d+/i);
    const startValue = formulaMatch ? Number(formulaMatch[1]) : 1;
    const tableId = deriveFoundryIdFromText(`${pact._id}:rolltable`);
    const tableName = `${pact.name} — ${pact.rollTableTitle ?? "Table"}`;
    const results = entries.map((entry, index) => {
        const rollValue = startValue + index;
        return {
            _id: deriveFoundryIdFromText(`${tableId}:${rollValue}:result`),
            type: TEXT_RESULT(),
            text: String(entry),
            img: "icons/svg/d20-grey.svg",
            weight: 1,
            range: [rollValue, rollValue],
            drawn: false,
            flags: { [SOURCE_FLAG_SCOPE]: { pactRollEntry: { index, rollValue, text: String(entry) } } }
        };
    });
    return { tableId, tableName, formula, results };
}
