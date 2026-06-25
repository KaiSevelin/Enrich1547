// Shared, pure micro-helpers used across the chargen subsystem (template
// parsing, validation, language, simulation). No Foundry globals are required
// at import time, so this module is unit-testable with literal fixtures.
//
// The SkillTreeChargenApp class keeps thin static delegators to these (e.g.
// `static _toBoolean(v) { return toBoolean(v); }`) so existing call sites —
// including external `app.constructor._resultRawJSON(...)` — keep working.

/** Best-available raw text for a RollTable result: description → text → name. */
export function resultRawJSON(result) {
    const d = (result?.description ?? "").trim();
    if (d) return d;

    const t = (result?.text ?? "").trim(); // deprecated fallback
    if (t) return t;

    const n = (result?.name ?? "").trim();
    return n;
}

/** Coerce assorted truthy encodings (boolean/number/"true"/"1"/"yes"/"on"). */
export function toBoolean(v) {
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v !== 0;
    const s = String(v ?? "").trim().toLowerCase();
    return s === "true" || s === "1" || s === "yes" || s === "on";
}

/** Split a CSV string into trimmed, non-empty entries. */
export function stringListFromCSV(v) {
    return String(v ?? "")
        .split(",")
        .map(s => s.trim())
        .filter(Boolean);
}

/** Finite number or null. */
export function numberOrNull(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

/** Canonicalise a template change/effect type token to its lowercase key. */
export function normalizeTemplateType(v) {
    const raw = String(v ?? "").trim();
    if (!raw) return "";
    const map = {
        stat: "stat",
        skill: "skill",
        maneuver: "maneuver",
        money: "money",
        luck: "luck",
        contact: "contact",
        body: "body",
        social: "social",
        drive: "drive",
        bio: "bio",
        item: "item",
        language: "language",
        move: "move",
        movement: "move",
        nothing: "nothing"
    };
    return map[raw.toLowerCase()] ?? raw.toLowerCase();
}

/** True for a Foundry Item document (works without the Item global in Node). */
export function isItemDocument(doc) {
    if (!doc || typeof doc !== "object") return false;
    if (doc.documentName === "Item") return true;
    if (doc.collectionName === "items") return true;
    if (typeof Item !== "undefined" && doc instanceof Item) return true;
    return false;
}

/** A CSB item's props map. */
export function getTemplateProps(item) {
    return item?.system?.props ?? {};
}

/** Lowercase kebab key for a table name (ported verbatim from chargen.js). */
export function normalizeTableKey(name) {
    return String(name ?? "")
        .toLowerCase()
        .replace(/[â€“â€”]/g, "-")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
}
