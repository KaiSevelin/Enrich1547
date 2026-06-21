import assert from "assert";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/**
 * Content lint + regression test for the authored "Your Nature" tables and
 * items. Walks every your-nature-* folder under foundry/Templates/chargen and
 * validates each item/table against the *real* chargen parser, so an authoring
 * mistake (weight 0, empty amount, unknown drive, broken table→item link, a gap
 * in the 3-18 coverage) fails CI instead of silently no-op'ing during a run.
 *
 * Spec: docs/specs/chargen-spec-v1.md (Part 3 - Your Nature).
 */

// interface-registry.js (imported transitively by the parser) may touch foundry.
if (typeof globalThis.foundry === "undefined") {
    globalThis.foundry = { utils: { getProperty: (o, p) => p.split(".").reduce((a, k) => a?.[k], o) } };
}

const parse = await import("../chargen/chargen-template-parse.js");
const { normalizeTemplateType } = await import("../chargen/chargen-utils.js");
const { PRIMARY_STATS } = await import("../../foundry/Templates/chargen/foundry-primary-stats/stats.js");
const yn = await import("../chargen/your-nature.js");

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHARGEN_DIR = path.resolve(HERE, "../../foundry/Templates/chargen");

// Canonical drive catalogue: top-level keys of DRIVE_HINTS in drive-prompts.js.
// Read by regex so this test does not depend on the catalogue being exported.
const DRIVE_SRC = fs.readFileSync(path.join(HERE, "../chargen/drive-prompts.js"), "utf8");
const DRIVE_CATEGORIES = new Set(
    [...DRIVE_SRC.matchAll(/^ {4}([A-Z][A-Za-z]+): \{$/gm)].map(m => m[1])
);

const KNOWN_TYPES = new Set([
    "stat", "skill", "maneuver", "money", "luck", "contact",
    "body", "social", "drive", "bio", "item", "language", "nothing"
]);

const problems = [];
const fail = (where, msg) => problems.push(`${where}: ${msg}`);

// Drive categories are free-form: getDriveHintData() falls back to a generic
// prompt for any category, and existing chargen content already uses several
// categories outside the hint catalogue. So a missing hint is a cosmetic gap
// (no curated prompt), not a correctness bug — collected and reported, not failed.
const drivesWithoutHints = new Map();
const noteMissingDriveHint = (cat) => drivesWithoutHints.set(cat, (drivesWithoutHints.get(cat) ?? 0) + 1);

function readJSON(file) {
    return JSON.parse(fs.readFileSync(file, "utf8"));
}

function ynFolders() {
    return fs.readdirSync(CHARGEN_DIR)
        .filter(d => d.startsWith("your-nature-"))
        .filter(d => fs.statSync(path.join(CHARGEN_DIR, d)).isDirectory())
        .sort();
}

// ---- Row-level validation (mirrors what the parser will actually apply) ----
function lintEffectRow(where, row) {
    if (!row || typeof row !== "object" || row.$deleted) return;

    const rawType = String(row.Type ?? "").trim();
    const type = normalizeTemplateType(rawType);
    if (!rawType) { fail(where, "row has empty Type"); return; }
    if (!KNOWN_TYPES.has(type)) { fail(where, `unknown effect Type "${rawType}"`); return; }

    // Weight 0 / non-numeric rows are silently filtered by the parser — almost
    // always an authoring slip in these hand-written tables.
    const weight = Number(row.Weight);
    if (!Number.isFinite(weight)) fail(where, `Weight "${row.Weight}" is not numeric`);
    else if (weight <= 0) fail(where, `Weight ${weight} <= 0 (row would be dropped)`);

    const amountRaw = String(row.Amount ?? "").trim();
    const amountNum = Number(amountRaw);
    const targetKey = String(row.TargetKey ?? "").trim();
    const targetText = String(row.TargetText ?? "").trim();

    switch (type) {
        case "stat":
            if (!PRIMARY_STATS.includes(targetKey)) fail(where, `stat TargetKey "${targetKey}" not a primary stat`);
            if (!amountRaw || !Number.isFinite(amountNum) || amountNum === 0)
                fail(where, `stat Amount "${amountRaw}" must be a non-zero number`);
            break;
        case "social":
            if (!amountRaw || !Number.isFinite(amountNum) || amountNum === 0)
                fail(where, `social Amount "${amountRaw}" must be a non-zero number`);
            break;
        case "money":
            // Amount may be an integer or a dice formula; empty would no-op.
            if (!amountRaw) fail(where, "money row has empty Amount");
            break;
        case "drive": {
            const action = targetKey.toLowerCase();
            if (action !== "add" && action !== "remove")
                fail(where, `drive TargetKey "${targetKey}" must be "add" or "remove"`);
            if (action === "add" && !amountRaw)
                fail(where, "drive add row has empty category (Amount)");
            else if (action === "add" && !DRIVE_CATEGORIES.has(amountRaw))
                noteMissingDriveHint(amountRaw); // cosmetic: no curated hint, still functional
            break;
        }
        case "contact":
            if (!targetText) fail(where, "contact row has empty TargetText");
            break;
        case "bio":
            if (!amountRaw) fail(where, "bio row has empty Amount (no text)");
            break;
        // luck / body / nothing carry no required fields.
        default:
            break;
    }
}

function lintItem(folder, file) {
    const where = `${folder}/${path.basename(file)}`;
    const data = readJSON(file);

    const props = data?.system?.props ?? {};
    for (const f of ["ChoiceTitle", "ChoiceText", "ChoiceBio"]) {
        if (!String(props[f] ?? "").trim()) fail(where, `missing ${f}`);
    }

    // Every present Effects group must row-validate; at least one must yield a
    // usable (weight>0) table, else the item grants nothing at all.
    let usableTables = 0;
    for (const key of ["Effects1", "Effects2", "Effects3"]) {
        const group = props[key];
        if (group === undefined) continue;
        if (!group || typeof group !== "object") { fail(where, `${key} is not a dynamic table`); continue; }
        for (const row of Object.values(group)) lintEffectRow(`${where} ${key}`, row);
        if (parse.buildEffectTableFromProps(props, key)) usableTables += 1;
    }
    if (!usableTables) fail(where, "no Effects group yields a usable (weight>0) row");

    // The whole item must parse without the parser throwing.
    try {
        parse.parseTemplateItemToChoiceData(data, `Your Nature - ${folder}`);
    } catch (err) {
        fail(where, `parseTemplateItemToChoiceData threw: ${err.message}`);
    }

    return String(data._id ?? "").trim();
}

function lintDestinationTable(folder, file, itemIds) {
    const where = `${folder}/${path.basename(file)}`;
    const data = readJSON(file);

    if (String(data.formula ?? "") !== "3d6") fail(where, `formula "${data.formula}" expected 3d6`);

    const results = Array.isArray(data.results) ? data.results : [];
    const covered = new Set();
    for (const r of results) {
        const [lo, hi] = Array.isArray(r.range) ? r.range : [];
        if (!Number.isInteger(lo) || !Number.isInteger(hi)) { fail(where, `result "${r.name}" has bad range`); continue; }
        for (let n = lo; n <= hi; n += 1) {
            if (covered.has(n)) fail(where, `range overlap at ${n}`);
            covered.add(n);
        }
        const uuid = String(r.documentUuid ?? "").trim();
        const m = /^Item\.([A-Za-z0-9]{16})$/.exec(uuid);
        if (!m) fail(where, `result "${r.name}" documentUuid "${uuid}" is not Item.<16-char-id>`);
        else if (!itemIds.has(m[1])) fail(where, `result "${r.name}" links to missing item id ${m[1]}`);
    }
    for (let n = 3; n <= 18; n += 1) {
        if (!covered.has(n)) fail(where, `roll value ${n} is not covered`);
    }

    return String(data._id ?? "").trim();
}

function lintSelectorTable(folder, file) {
    const where = `${folder}/${path.basename(file)}`;
    const data = readJSON(file);
    if (String(data.formula ?? "") !== "3d6") fail(where, `formula "${data.formula}" expected 3d6`);

    const keys = new Set(yn.YOUR_NATURE_SELECTOR_KEYS);
    const counts = {};
    const covered = new Set();
    for (const r of Array.isArray(data.results) ? data.results : []) {
        const label = String(r.description ?? r.text ?? "").trim();
        if (!keys.has(label)) fail(where, `selector result "${label}" is not a known destination key`);
        const [lo, hi] = Array.isArray(r.range) ? r.range : [];
        if (Number.isInteger(lo) && Number.isInteger(hi)) {
            for (let n = lo; n <= hi; n += 1) covered.add(n);
            counts[label] = (counts[label] ?? 0) + (hi - lo + 1);
        }
    }
    for (let n = 3; n <= 18; n += 1) if (!covered.has(n)) fail(where, `selector roll ${n} not covered`);

    // Each key should appear and stay roughly balanced (216/11 ≈ 19.6).
    for (const key of yn.YOUR_NATURE_SELECTOR_KEYS) {
        const n = counts[key] ?? 0;
        if (n === 0) fail(where, `selector never points to "${key}"`);
        else if (n < 16 || n > 24) fail(where, `selector points to "${key}" ${n} times (unbalanced)`);
    }
    return String(data._id ?? "").trim();
}

console.log("your-nature content: scanning authored tables + items...");

const folders = ynFolders();
assert.ok(folders.length >= 12, `expected >= 12 your-nature folders, found ${folders.length}`);

const seenTableIds = new Set();
let itemCount = 0;

for (const folder of folders) {
    const dir = path.join(CHARGEN_DIR, folder);
    const files = fs.readdirSync(dir);
    const tableFiles = files.filter(f => /fvtt-RollTable-.*\.json$/i.test(f));
    const itemFiles = files.filter(f => /fvtt-Item-.*\.json$/i.test(f));

    if (tableFiles.length !== 1) fail(folder, `expected exactly 1 RollTable file, found ${tableFiles.length}`);

    // Items first so destination tables can verify their links resolve.
    const itemIds = new Set();
    for (const f of itemFiles) {
        const id = lintItem(folder, path.join(dir, f));
        if (id) itemIds.add(id);
        itemCount += 1;
    }

    const isSelector = folder === "your-nature-selector";
    for (const tf of tableFiles) {
        const id = isSelector
            ? lintSelectorTable(folder, path.join(dir, tf))
            : lintDestinationTable(folder, path.join(dir, tf), itemIds);
        if (id) seenTableIds.add(id);
        if (!isSelector && itemFiles.length !== 16)
            fail(folder, `expected 16 item files for a 3-18 table, found ${itemFiles.length}`);
    }
}

console.log(`  scanned ${folders.length} folders, ${itemCount} items`);

// Cross-check: every hardcoded ref in your-nature.js resolves to a seeded table.
console.log("your-nature content: hardcoded refs resolve to seeded tables...");
for (const [key, ref] of Object.entries(yn.YOUR_NATURE_TABLE_REFS)) {
    const id = ref.replace(/^RollTable\./, "");
    if (!seenTableIds.has(id)) fail("refs", `${key} ref ${ref} has no matching seeded table _id`);
}
const selectorId = yn.YOUR_NATURE_SELECTOR_TABLE_REF.replace(/^RollTable\./, "");
if (!seenTableIds.has(selectorId)) fail("refs", `selector ref has no matching seeded table _id`);

if (drivesWithoutHints.size) {
    const list = [...drivesWithoutHints.entries()].sort((a, b) => b[1] - a[1])
        .map(([c, n]) => `${c} (${n})`).join(", ");
    console.log(`  ℹ ${drivesWithoutHints.size} drive categor(ies) used without a curated hint (generic prompt is used): ${list}`);
}

if (problems.length) {
    console.error(`\n${problems.length} content problem(s):`);
    for (const p of problems) console.error("  - " + p);
}
assert.strictEqual(problems.length, 0, `${problems.length} Your Nature content problem(s) (see above)`);

console.log("  ✓ all refs resolve");
console.log("\nAll your-nature content checks passed.");
