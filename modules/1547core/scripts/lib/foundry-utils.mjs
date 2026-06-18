// Small, pure helpers shared across 1547core services. No Foundry globals are
// touched at import time, so this is safe to import from Node tests/build too.

import { MODULE_ID, SOURCE_FLAG_SCOPE, SPELL_TEMPLATE_ID } from "./constants.mjs";

/**
 * The module's authored source payload, baked into a doc's flags by build-packs.
 * CSB empties some `system.props` at runtime, but the authored data survives in
 * the flag — so read-paths fall back to it. Returns the doc itself for documents
 * that aren't source-backed.
 */
export function readSourceData(doc) {
    return doc?.flags?.[SOURCE_FLAG_SCOPE]?.sourceData ?? doc?.flags?.[MODULE_ID]?.sourceData ?? doc ?? {};
}

/** A carrier item's live props, falling back to its authored source data. */
export function getProps(item) {
    return item?.system?.props ?? readSourceData(item) ?? {};
}

/**
 * A creature's die count for a stat. Reads the canonical `Stats_<Stat>Dice`
 * prop, falling back to the un-prefixed `<Stat>Dice` key some authored data
 * uses — so monsters built either way resolve consistently everywhere.
 */
export function statDice(actor, stat) {
    const props = actor?.system?.props ?? {};
    return Number(props[`Stats_${stat}Dice`] ?? props[`${stat}Dice`] ?? 0) || 0;
}

/** A creature's flat modifier for a stat. See {@link statDice}. */
export function statMod(actor, stat) {
    const props = actor?.system?.props ?? {};
    return Number(props[`Stats_${stat}Mod`] ?? props[`${stat}Mod`] ?? 0) || 0;
}

/** True for items built on the spell CSB template. */
export function isSpellItem(item) {
    return item?.system?.template === SPELL_TEMPLATE_ID;
}

/** Escape a string for safe interpolation into chat/sheet HTML. */
export function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/** Lowercase kebab slug (trim → lowercase → non-alphanumerics to dashes). */
export function slugify(value) {
    return String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}
