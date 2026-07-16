/**
 * Build compendium packs from source JSON.
 *
 * Reads `foundry/Templates/*.json` source data, wraps each entry as a
 * CSB-style Foundry Item document using the matching CSB template, and
 * invokes Foundry CLI's `compilePack` to emit LevelDB packs under
 * `packs/<name>/`.
 *
 * Per-content-type `buildXxxProps` functions mirror the runtime seeder in
 * `scripts/settings/module-settings.js`. Duplicated here intentionally to
 * avoid the substantial refactor needed to share pure helpers between
 * runtime (Foundry-dependent) and build-time (Node).
 *
 * To add a new pack:
 *   1. Add a `buildXxxProps(source)` function below.
 *   2. Add a `buildXxxPack()` entry function.
 *   3. Call it from `main()`.
 *   4. Declare the pack in module.json under `packs:`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compilePack } from "@foundryvtt/foundryvtt-cli";
import { annotateRitualStepTables } from "./reorder-ritual-tables.mjs";
import { deepClone, ACTOR_TYPES, isValidFoundryId, deriveFoundryIdFromText, normalizeTraitKey, normalizeTypeList, normalizeSourceEntry, mergeDefinedProps } from "../lib/build-helpers.mjs";
import { buildAmmoProps, buildArmorProps, buildChangeProps, buildChangeSetProps, buildDiseaseProps, buildMonsterMagicProps, buildPactProps, buildRequirementProps, buildSpellProps, buildSupernaturalMarkProps, buildWeaponModifierProps, buildWeaponProps, buildManeuverProps } from "../lib/prop-builders.mjs";
import { buildBoostResults, ritualStepFormula, ritualStepDescription, buildRitualStepResults, buildBellCurveResults, buildUniformResults, buildPactResults } from "../lib/rolltable-results.mjs";
import { csbItemBody, mergeActorParts } from "../lib/doc-builders.mjs";
import { STAT_INFO } from "../hud/stat-info.js";
import { HUMOUR_INFO } from "../services/humour-info.js";
import { CONDITIONS } from "../services/condition-registry.js";


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODULE_ROOT = path.resolve(__dirname, "../..");
const TEMPLATES_DIR = path.join(MODULE_ROOT, "foundry", "Templates");
const PACK_SOURCE_ROOT = path.join(MODULE_ROOT, "pack-source");
const PACKS_ROOT = path.join(MODULE_ROOT, "packs");

const SOURCE_FLAG_SCOPE = "1547Core";
const TEMPLATE_FILES = {
    maneuver: "fvtt-Item-maneuvertemplate-4owc4YQBlp94GbGs.json",
    spell: "fvtt-Item-spelltemplate-2kiWw3Cv5Zk1lZxn.json",
    disease: "fvtt-Item-diseasetemplate-DZ7sK2mLp9Qx4TvR.json",
    monsterMagic: "fvtt-Item-monstermagictemplate-M0nMgk7Yp2RsT5Vu.json",
    weapon: "fvtt-Item-weapontemplate-qZCfLEYQ7egbm1B9.json",
    armor: "fvtt-Item-armortemplate-uLlgZXz3GlXPFtsj.json",
    ammo: "fvtt-Item-ammunitiontemplate-389uqkKKn8M1SKux.json",
    weaponModifier: "fvtt-Item-weaponmodifiertemplate-WmP9Ld3Qs7Nk2FvR.json",
    pact: "fvtt-Item-pacttemplate-HPYYc2P0Ouagicmr.json",
    supernaturalMark: "fvtt-Item-supernaturalmarktemplate-w9ky0ZTDvXDs5Ce7.json",
    requirement: "fvtt-Item-requirementtemplate-L4ujYgqhGBGcoo2P.json",
    changeSet: "fvtt-Item-changesettemplate-b7A1z6cSZO4dYTKT.json",
    change: "fvtt-Item-changetemplate-WsrkfjBmudnIhvEK.json",
    skill: "fvtt-Item-skilltemplate-BbwVnEJobtCR5oOf.json",
    actor: "fvtt-Actor-1547-Tgs09eTiTp63Cp7u.json"
};

// Skills are reference items keyed by name; the skill-tree graph drives the
// mechanics, so the pack just carries the authored description + grouping.
function buildSkillProps(source) {
    return {
        Description: String(source.description ?? ""),
        Group: String(source.group ?? ""),
        MinLevel: String(source.minLevel ?? ""),
        MaxLevel: String(source.maxLevel ?? "")
    };
}


const CHANGE_FOLDER_LABELS = {
    Stat: "Stat (Numeric)", PrimaryStat: "Primary Stat", Skill: "Skill", Text: "Text",
    ItemGrant: "Item Grant", Tag: "Tag", Trait: "Trait"
};

// --- Shared helpers ------------------------------------------------------

function loadJson(filePath) {
    let raw = fs.readFileSync(filePath, "utf-8");
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
    return JSON.parse(raw);
}



function prepareDir(dir) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
}



function makeItemDoc(source, template, img, propsBuilder, folderHint) {
    const { system, flags } = csbItemBody(template, source, propsBuilder, folderHint);
    return {
        _id: source._id,
        _key: `!items!${source._id}`,
        name: source.name,
        type: "equippableItem",
        img,
        system,
        effects: [],
        folder: null,
        sort: 0,
        flags,
        ownership: { default: 0 }
    };
}

function safeFileName(doc) {
    return `${String(doc.name).replace(/[^A-Za-z0-9_-]/g, "_")}_${doc._id}.json`;
}





async function compilePackFromDocs(packName, docs) {
    const sourceDir = path.join(PACK_SOURCE_ROOT, packName);
    const packDir = path.join(PACKS_ROOT, packName);
    prepareDir(sourceDir);
    fs.rmSync(packDir, { recursive: true, force: true });

    for (const doc of docs) {
        fs.writeFileSync(path.join(sourceDir, safeFileName(doc)), JSON.stringify(doc, null, 2));
    }
    console.log(`  prepared ${docs.length} ${packName} source docs`);

    await compilePack(sourceDir, packDir, { log: false });
    console.log(`  compiled to ${packDir}`);
}

// --- Maneuvers -----------------------------------------------------------













async function buildManeuversPack() {
    const maneuvers = loadJson(path.join(TEMPLATES_DIR, "maneuvers.json"));
    const template = loadJson(path.join(TEMPLATES_DIR, TEMPLATE_FILES.maneuver));
    const docs = maneuvers.map((src) =>
        makeItemDoc(src, template, src.img ?? template.img ?? "icons/svg/combat.svg", buildManeuverProps, "Maneuvers")
    );
    await compilePackFromDocs("maneuvers", docs);
}

// --- Spells --------------------------------------------------------------



async function buildSkillsPack() {
    const skills = loadJson(path.join(TEMPLATES_DIR, "skills.json"));
    const template = loadJson(path.join(TEMPLATES_DIR, TEMPLATE_FILES.skill));
    const docs = skills.map((src) =>
        makeItemDoc(src, template, src.img ?? template.img ?? "icons/svg/upgrade.svg", buildSkillProps, src.group ?? "Skills")
    );
    await compilePackFromDocs("skills", docs);
}

async function buildSpellsPack() {
    const spells = loadJson(path.join(TEMPLATES_DIR, "spells.json"));
    const template = loadJson(path.join(TEMPLATES_DIR, TEMPLATE_FILES.spell));
    const docs = spells.map((src) =>
        makeItemDoc(src, template, src.img ?? template.img ?? "icons/svg/book.svg", buildSpellProps, "Spells")
    );
    await compilePackFromDocs("spells", docs);
}

// --- Diseases ------------------------------------------------------------



async function buildDiseasesPack() {
    const diseases = loadJson(path.join(TEMPLATES_DIR, "diseases.json"));
    const template = loadJson(path.join(TEMPLATES_DIR, TEMPLATE_FILES.disease));
    const docs = diseases.map((src) =>
        makeItemDoc(src, template, src.img ?? template.img ?? "icons/svg/biohazard.svg", buildDiseaseProps, "Diseases")
    );
    await compilePackFromDocs("diseases", docs);
}

// --- Monster Magic (Powers) ----------------------------------------------



async function buildMonsterMagicPack() {
    const magics = loadJson(path.join(TEMPLATES_DIR, "monster-magic.json"));
    const template = loadJson(path.join(TEMPLATES_DIR, TEMPLATE_FILES.monsterMagic));
    const docs = magics.map((src) =>
        makeItemDoc(src, template, src.img ?? template.img ?? "icons/svg/aura.svg", buildMonsterMagicProps, "Monster Magic")
    );
    await compilePackFromDocs("monster-magic", docs);
}

// --- Weapons -------------------------------------------------------------





async function buildWeaponsPack() {
    const weapons = loadJson(path.join(TEMPLATES_DIR, "weapons.json"));
    const template = loadJson(path.join(TEMPLATES_DIR, TEMPLATE_FILES.weapon));
    const docs = weapons.map((src) =>
        makeItemDoc(src, template, src.img ?? template.img ?? "icons/svg/sword.svg", buildWeaponProps, src.folder ?? "Weapons")
    );
    await compilePackFromDocs("weapons", docs);
}

// --- Armors --------------------------------------------------------------



async function buildArmorsPack() {
    const armors = loadJson(path.join(TEMPLATES_DIR, "armors.json"));
    const template = loadJson(path.join(TEMPLATES_DIR, TEMPLATE_FILES.armor));
    const docs = armors.map((src) =>
        makeItemDoc(src, template, src.img ?? template.img ?? "icons/svg/shield.svg", buildArmorProps, src.folder ?? "Armors")
    );
    await compilePackFromDocs("armors", docs);
}

// --- Ammunition ----------------------------------------------------------



async function buildAmmunitionPack() {
    const ammo = loadJson(path.join(TEMPLATES_DIR, "ammunition.json"));
    const template = loadJson(path.join(TEMPLATES_DIR, TEMPLATE_FILES.ammo));
    const docs = ammo.map((src) =>
        makeItemDoc(src, template, src.img ?? template.img ?? "icons/svg/target.svg", buildAmmoProps, "Ammunition")
    );
    await compilePackFromDocs("ammunition", docs);
}

// --- Weapon Modifiers ----------------------------------------------------



// --- Rule Book (JournalEntry with chapter pages) -------------------------
// Source is a small JSON file with one or more JournalEntry-shaped objects,
// each carrying a `pages: [{ title, content }]` array. The builder fills in
// Foundry shape (type:"text", title display, sort order) and the embedded
// _key fields the Foundry CLI needs for compendium compilation.

async function buildRulebookPack() {
    const entries = loadJson(path.join(TEMPLATES_DIR, "rulebook.json"));
    const generatedPages = buildReferenceChapters();
    const docs = (Array.isArray(entries) ? entries : []).map((entry, entryIndex) => {
        const entryId = isValidFoundryId(entry._id)
            ? entry._id
            : deriveFoundryIdFromText(`rulebook:${entry.name}`);
        const narrativeSources = Array.isArray(entry.pages) ? entry.pages : [];
        // Generated pages append after narrative ones, but only on the first
        // JournalEntry (the canonical "1547 Rule Book").
        const pageSources = entryIndex === 0
            ? [...narrativeSources, ...generatedPages]
            : narrativeSources;
        const pages = pageSources.map((page, index) => {
            const pageId = isValidFoundryId(page._id)
                ? page._id
                : deriveFoundryIdFromText(`rulebook:${entryId}:${page.title ?? index}`);
            const flags = page.generated
                ? { [SOURCE_FLAG_SCOPE]: { generated: true } }
                : {};
            return {
                _id: pageId,
                _key: `!journal.pages!${entryId}.${pageId}`,
                name: page.title ?? `Chapter ${index + 1}`,
                type: "text",
                title: { show: true, level: 1 },
                text: { content: page.content ?? "", format: 1, markdown: "" },
                video: { controls: true, volume: 0.5 },
                src: null,
                system: {},
                sort: (index + 1) * 100000,
                ownership: { default: -1 },
                flags
            };
        });
        return {
            _id: entryId,
            _key: `!journal!${entryId}`,
            name: entry.name ?? "Rule Book",
            pages,
            folder: null,
            sort: 0,
            flags: {
                [SOURCE_FLAG_SCOPE]: { sourceData: entry }
            },
            ownership: { default: 0 }
        };
    });
    await compilePackFromDocs("rulebook", docs);
}

// --- Reference-chapter generators ----------------------------------------
// Each returns { title, content, generated: true }. They read the same
// source JSON used by the data packs, so reference chapters stay in lockstep
// with the actual content with zero hand-editing.

function htmlEscape(s) {
    return String(s ?? "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function descBlock(raw) {
    const s = String(raw ?? "").trim();
    if (!s) return "";
    // Already-HTML descriptions pass through; plain text gets wrapped.
    if (s.startsWith("<")) return s;
    return `<p>${htmlEscape(s)}</p>`;
}

function statLine(parts) {
    const items = parts.filter(([_, v]) => v !== undefined && v !== null && v !== "" && v !== 0);
    if (!items.length) return "";
    return `<p>${items.map(([k, v]) => `<strong>${htmlEscape(k)}:</strong> ${htmlEscape(v)}`).join(" &middot; ")}</p>`;
}

function tableBlock(headers, rows) {
    if (!rows.length) return "";
    const thead = `<thead><tr>${headers.map((h) => `<th>${htmlEscape(h)}</th>`).join("")}</tr></thead>`;
    const tbody = `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${htmlEscape(c ?? "")}</td>`).join("")}</tr>`).join("")}</tbody>`;
    return `<table>${thead}${tbody}</table>`;
}

function generatedIntro(label) {
    return `<p><em>Auto-generated from ${label}. Edit the underlying source file and re-release to update — manual edits to this page are overwritten on rebuild.</em></p>`;
}

function generateSpellChapter() {
    const spells = loadJson(path.join(TEMPLATES_DIR, "spells.json"));
    const sorted = [...spells].sort((a, b) => String(a.name).localeCompare(String(b.name)));
    const body = sorted.map((spell) => {
        const schools = Array.isArray(spell.schools) ? spell.schools.join(", ") : "";
        return [
            `<h2>${htmlEscape(spell.name)}</h2>`,
            statLine([
                ["Kind", spell.spellKind],
                ["Complexity", spell.complexity],
                ["Schools", schools],
                ["School mode", spell.schoolRequirementMode],
                ["Failure", spell.failureProfile]
            ]),
            descBlock(spell.description)
        ].filter(Boolean).join("\n");
    }).join("\n");
    return {
        title: "Spell Reference",
        content: generatedIntro("spells.json") + body,
        generated: true
    };
}

function generateManeuverChapter() {
    const maneuvers = loadJson(path.join(TEMPLATES_DIR, "maneuvers.json"));
    // Bucket by primary tag (offense / defense / control / movement / monster / other)
    const buckets = { Offense: [], Defense: [], Control: [], Movement: [], Monster: [], Other: [] };
    for (const m of maneuvers) {
        const tags = new Set(m.tags ?? []);
        let key = "Other";
        if (tags.has("monster")) key = "Monster";
        else if (tags.has("offense")) key = "Offense";
        else if (tags.has("defense") || tags.has("counter")) key = "Defense";
        else if (tags.has("control") || tags.has("grapple")) key = "Control";
        else if (tags.has("movement")) key = "Movement";
        buckets[key].push(m);
    }
    const sections = Object.entries(buckets).map(([group, items]) => {
        if (!items.length) return "";
        items.sort((a, b) => String(a.name).localeCompare(String(b.name)));
        const list = items.map((m) => {
            const cost = m.CostType && m.CostAmount
                ? `${m.CostAmount} ${String(m.CostType).replace("Points", " pts")}`
                : "Free";
            return [
                `<h3>${htmlEscape(m.name)}</h3>`,
                statLine([
                    ["Type", m.type],
                    ["Trigger", m.triggerType],
                    ["Cost", cost],
                    ["Usage", m.usageLimit?.scope ? `${m.usageLimit?.maxUses ?? 1}× per ${m.usageLimit.scope}` : ""]
                ]),
                descBlock(m.requirements?.text)
            ].filter(Boolean).join("\n");
        }).join("\n");
        return `<h2>${htmlEscape(group)}</h2>${list}`;
    }).filter(Boolean).join("\n");
    return {
        title: "Maneuver Reference",
        content: generatedIntro("maneuvers.json") + sections,
        generated: true
    };
}

function generateMonsterPowerChapter() {
    const powers = loadJson(path.join(TEMPLATES_DIR, "monster-magic.json"));
    const byKind = new Map();
    for (const p of powers) {
        const k = p.magicKind ?? "Other";
        if (!byKind.has(k)) byKind.set(k, []);
        byKind.get(k).push(p);
    }
    const sortedKinds = [...byKind.keys()].sort();
    const sections = sortedKinds.map((kind) => {
        const items = byKind.get(kind).sort((a, b) => String(a.name).localeCompare(String(b.name)));
        const list = items.map((p) => [
            `<h3>${htmlEscape(p.name)}</h3>`,
            statLine([
                ["Use", p.useMode],
                ["Trigger", p.triggerText],
                ["Range", p.rangeText],
                ["Cost", p.costText]
            ]),
            descBlock(p.description)
        ].filter(Boolean).join("\n")).join("\n");
        return `<h2>${htmlEscape(kind)}</h2>${list}`;
    }).join("\n");
    return {
        title: "Monster Powers Reference",
        content: generatedIntro("monster-magic.json") + sections,
        generated: true
    };
}

function generateWeaponChapter() {
    const weapons = loadJson(path.join(TEMPLATES_DIR, "weapons.json"));
    const sorted = [...weapons].sort((a, b) => String(a.name).localeCompare(String(b.name)));
    const rows = sorted.map((w) => {
        const a = w.attackProfiles?.[0];
        const dice = Array.isArray(a?.dice) ? a.dice.join(", ") : "";
        const range = w.maxRange ? `${w.shortRange ?? "-"}/${w.longRange ?? "-"}/${w.maxRange}` : "";
        const traits = Array.isArray(w.traits) ? w.traits.join(", ") : "";
        return [w.name, w.category ?? "", w.weight ?? "", w.value ?? "", dice, range, traits];
    });
    const table = tableBlock(
        ["Name", "Type", "Weight", "Value", "Attack Dice", "Range (S/L/M)", "Traits"],
        rows
    );
    return {
        title: "Weapons Reference",
        content: generatedIntro("weapons.json") + table,
        generated: true
    };
}

function generateArmorChapter() {
    const armors = loadJson(path.join(TEMPLATES_DIR, "armors.json"));
    const sorted = [...armors].sort((a, b) => String(a.name).localeCompare(String(b.name)));
    const rows = sorted.map((a) => {
        const defense = Array.isArray(a.defenseDice) ? a.defenseDice.join(", ") : "";
        const traits = Array.isArray(a.traits) ? a.traits.join(", ") : "";
        return [a.name, a.armorClass ?? "", a.weight ?? "", a.value ?? "", defense, traits];
    });
    return {
        title: "Armor Reference",
        content: generatedIntro("armors.json") + tableBlock(
            ["Name", "Class", "Weight", "Value", "Defense Dice", "Traits"], rows
        ),
        generated: true
    };
}

function generateEquipmentChapter() {
    const items = loadJson(path.join(TEMPLATES_DIR, "equipment.json"));
    const byCategory = new Map();
    for (const it of items) {
        const cat = it._exportFolderName ?? it.system?.props?.Category ?? "Equipment";
        if (!byCategory.has(cat)) byCategory.set(cat, []);
        byCategory.get(cat).push(it);
    }
    const sortedCats = [...byCategory.keys()].sort();
    const sections = sortedCats.map((cat) => {
        const list = byCategory.get(cat).sort((a, b) => String(a.name).localeCompare(String(b.name)));
        const rows = list.map((it) => {
            const p = it.system?.props ?? {};
            return [it.name, p.Weight ?? "", p.Value ?? "", String(p.Description ?? "").slice(0, 80)];
        });
        return `<h2>${htmlEscape(cat)}</h2>${tableBlock(["Name", "Weight", "Value", "Description"], rows)}`;
    }).join("\n");
    return {
        title: "Equipment Reference",
        content: generatedIntro("equipment.json") + sections,
        generated: true
    };
}

function generatePactChapter() {
    const pacts = loadJson(path.join(TEMPLATES_DIR, "pacts.json"));
    const sorted = [...pacts].sort((a, b) => String(a.name).localeCompare(String(b.name)));
    const body = sorted.map((p) => [
        `<h2>${htmlEscape(p.name)}</h2>`,
        statLine([["Type", p.pactType], ["Patron", p.patron]]),
        p.boonText ? `<h4>Boon</h4>${descBlock(p.boonText)}` : "",
        p.priceText ? `<h4>Price</h4>${descBlock(p.priceText)}` : "",
        p.obligationText ? `<h4>Obligation</h4>${descBlock(p.obligationText)}` : "",
        p.tension ? `<p><em>${htmlEscape(p.tension)}</em></p>` : ""
    ].filter(Boolean).join("\n")).join("\n");
    return {
        title: "Pact Reference",
        content: generatedIntro("pacts.json") + body,
        generated: true
    };
}

function generateMarkChapter() {
    const marks = loadJson(path.join(TEMPLATES_DIR, "supernatural-marks.json"));
    const blessings = marks.filter((m) => m.markNature === "Blessing");
    const curses = marks.filter((m) => m.markNature === "Curse");
    const mixed = marks.filter((m) => m.markNature === "Mixed");
    const renderGroup = (name, list) => {
        if (!list.length) return "";
        list.sort((a, b) => String(a.name).localeCompare(String(b.name)));
        const body = list.map((m) => {
            const sources = Array.isArray(m.markSource) ? m.markSource.join(", ") : (m.markSource ?? "");
            return [
                `<h3>${htmlEscape(m.name)}</h3>`,
                statLine([["Scope", m.markScope], ["Sources", sources], ["Visibility", m.visibility]]),
                descBlock(m.description)
            ].filter(Boolean).join("\n");
        }).join("\n");
        return `<h2>${htmlEscape(name)}</h2>${body}`;
    };
    return {
        title: "Supernatural Marks Reference",
        content: generatedIntro("supernatural-marks.json")
            + renderGroup("Blessings", blessings)
            + renderGroup("Curses", curses)
            + renderGroup("Mixed", mixed),
        generated: true
    };
}

function generateChangeSetCatalog() {
    const sets = loadJson(path.join(TEMPLATES_DIR, "changesets.json"));
    const changes = loadJson(path.join(TEMPLATES_DIR, "changes.json"));
    const childrenByParent = new Map();
    for (const c of changes) {
        const k = c.parentChangeSetId;
        if (!k) continue;
        if (!childrenByParent.has(k)) childrenByParent.set(k, []);
        childrenByParent.get(k).push(c);
    }
    const byGroup = new Map();
    for (const s of sets) {
        const g = s.group ?? "Other";
        if (!byGroup.has(g)) byGroup.set(g, []);
        byGroup.get(g).push(s);
    }
    const groupOrder = ["Base", "Role", "Domain", "Loadout", "Motivation", "Quirk", "Boost"];
    const groups = [...new Set([...groupOrder, ...byGroup.keys()])].filter((g) => byGroup.has(g));
    const sections = groups.map((g) => {
        const list = byGroup.get(g).sort((a, b) => String(a.name).localeCompare(String(b.name)));
        const body = list.map((s) => {
            const kids = childrenByParent.get(s._id) ?? [];
            const kindCounts = {};
            for (const k of kids) kindCounts[k.kind] = (kindCounts[k.kind] ?? 0) + 1;
            const composition = Object.entries(kindCounts).map(([k, n]) => `${n}× ${k}`).join(", ");
            return [
                `<h3>${htmlEscape(s.name)}</h3>`,
                composition ? `<p><em>Adds: ${htmlEscape(composition)}</em></p>` : "",
                descBlock(s.description ?? s.notes)
            ].filter(Boolean).join("\n");
        }).join("\n");
        return `<h2>${htmlEscape(g)}</h2>${body}`;
    }).join("\n");
    return {
        title: "ChangeSet Catalog",
        content: generatedIntro("changesets.json + changes.json") + sections,
        generated: true
    };
}

function generateBoostRollTableChapter() {
    const tables = loadJson(path.join(TEMPLATES_DIR, "boost-roll-tables.json"));
    const standard = tables.find((t) => t.id === "BoostStandard" || t.name === "Standard Boost") ?? tables[0];
    if (!standard) return null;
    const entries = (Array.isArray(standard.entries) ? standard.entries : [])
        .sort((a, b) => (a.roll ?? 0) - (b.roll ?? 0));
    const rows = entries.map((e) => [String(e.roll ?? ""), e.label ?? ""]);
    // The pack-compiled RollTable has an _id derived from the source `id` by the seeder.
    // We link by name through the Compendium UUID so users can click to roll.
    const linkAttempt = `@Compendium[1547core.roll-tables.${htmlEscape(standard.name)}]{Roll on the Standard Boost Table}`;
    return {
        title: "Boost Roll Table",
        content: generatedIntro("boost-roll-tables.json")
            + `<p>Roll formula: <strong>${htmlEscape(standard.drawFormula ?? "4d6")}</strong>. ${entries.length} outcome${entries.length === 1 ? "" : "s"}.</p>`
            + `<p>${linkAttempt} (this link opens the actual rollable table in the Roll Tables compendium).</p>`
            + tableBlock(["Roll", "Outcome"], rows),
        generated: true
    };
}

function generateSkillTreeChapter() {
    const skills = loadJson(path.join(MODULE_ROOT, "data", "skill-graph-default.json"));
    const idToName = new Map();
    for (const [id, s] of Object.entries(skills)) idToName.set(id, s.name);

    // Group by first word of skill name (Art, Combat, Crafts, Knowledge, Lore, etc.)
    const groups = new Map();
    for (const [id, s] of Object.entries(skills)) {
        if (s.kind !== "skill") continue;
        const cat = String(s.name).split(/\s+/)[0] || "Other";
        if (!groups.has(cat)) groups.set(cat, []);
        groups.get(cat).push({ id, ...s });
    }
    const sorted = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
    const sections = sorted.map(([cat, list]) => {
        list.sort((a, b) => String(a.name).localeCompare(String(b.name)));
        const rows = list.map((s) => {
            const prereqs = (s.requirements ?? [])
                .map((r) => `${idToName.get(r.nodeId) ?? r.nodeId} ${r.minLevel}+`)
                .join(", ");
            const anyOf = (s.anyOf ?? [])
                .map((r) => `${idToName.get(r.nodeId) ?? r.nodeId} ${r.minLevel}+`)
                .join(" OR ");
            const reqs = [prereqs, anyOf].filter(Boolean).join("; ");
            return [s.name, `${s.minLevel}–${s.maxLevel}`, reqs];
        });
        return `<h2>${htmlEscape(cat)}</h2>${tableBlock(["Skill", "Levels", "Prerequisites"], rows)}`;
    }).join("\n");
    return {
        title: "Skill Tree",
        content: generatedIntro("data/skill-graph-default.json")
            + `<p>Skills are organised below by category (first word of the skill name). Each entry shows its level range and its prerequisites — what you must already have to take the first level. Use the SkillTree Graph Editor (Configure Module Settings → 1547 Core → SkillTree Graph Editor) for the interactive node graph.</p>`
            + sections,
        generated: true
    };
}

// Hardcoded mappings — these mirror the per-die `getResultLabel` chat icons
// in scripts/dice/*.js plus the `getFaceTotals` outcome logic in dice1547.js.
const DICE_GLOSSARY = [
    { key: "balanced",    term: "db", name: "Balanced",    faces: [["fumble", "Fumble"], ["blank", "—"], ["d1", "1 damage"], ["d1", "1 damage"], ["d2", "2 damage"], ["crit", "Crit"]] },
    { key: "heavy",       term: "dh", name: "Heavy",       faces: [["fumble", "Fumble"], ["fumble", "Fumble"], ["d1", "1 damage"], ["d2", "2 damage"], ["d4", "4 damage"], ["crit", "Crit"]] },
    { key: "lethal",      term: "dl", name: "Lethality",   faces: [["fumble", "Fumble"], ["fumble", "Fumble"], ["d2", "2 damage"], ["d3", "3 damage"], ["d5", "5 damage"], ["crit", "Crit"]] },
    { key: "penetration", term: "dp", name: "Penetration", faces: [["fumble", "Fumble"], ["blank", "—"], ["d1", "1 damage"], ["d1", "1 damage"], ["d3", "3 damage"], ["crit", "Crit"]] },
    { key: "control",     term: "dc", name: "Control",     faces: [["fumble", "Fumble"], ["blank", "—"], ["blank", "—"], ["d1", "1 damage"], ["crit", "Crit"], ["crit", "Crit"]] },
    { key: "finesse",     term: "dg", name: "Grace",       faces: [["blank", "—"], ["blank", "—"], ["d1", "1 damage"], ["d1", "1 damage"], ["crit", "Crit"], ["crit", "Crit"]] },
    { key: "armor",       term: "da", name: "Armor",       faces: [["fumble", "Fumble"], ["blank", "—"], ["p1", "1 protection"], ["p2", "2 protection"], ["p4", "4 protection"], ["crit", "Crit"]] },
    { key: "evade",       term: "de", name: "Evade",       faces: [["fumble", "Fumble"], ["blank", "—"], ["p1", "1 protection"], ["p2", "2 protection"], ["crit", "Crit"], ["crit", "Crit"]] },
    { key: "multiply",    term: "dx", name: "Multiplier",  faces: [["0x", "×0 (whiff)"], ["blank", "×1"], ["blank", "×1"], ["2x", "×2"], ["2x", "×2"], ["3x", "×3"]] },
    { key: "risk",        term: "dr", name: "Risk",        faces: [["0x", "×0 mult"], ["fumble", "Fumble"], ["fumble", "Fumble"], ["blank", "—"], ["d2", "2 damage"], ["crit", "Crit"]] }
];

function generateDiceGlossaryChapter() {
    const sections = DICE_GLOSSARY.map((die) => {
        const faceCells = die.faces.map(([face, label], i) => {
            const img = `modules/1547core/images/dice/${face}_${die.key}_bg.png`;
            return `<td style="text-align:center;vertical-align:top;padding:0.3rem;">`
                + `<img src="${img}" alt="${htmlEscape(label)}" style="width:42px;height:42px;display:block;margin:0 auto 0.25rem;" />`
                + `<div style="font-size:0.78rem;"><strong>${i + 1}</strong> · ${htmlEscape(label)}</div>`
                + `</td>`;
        }).join("");
        return [
            `<h2>${htmlEscape(die.name)} <span style="font-weight:normal;color:#5e4f38;">(<code>${die.term}</code>)</span></h2>`,
            `<table><tbody><tr>${faceCells}</tr></tbody></table>`
        ].join("\n");
    }).join("\n");
    return {
        title: "Dice Glossary",
        content: generatedIntro("scripts/dice/ + scripts/dice/dice1547.js")
            + `<p>1547 uses ten typed d6 in addition to the standard polyhedrals. Each die's six faces are shown below with the chat-icon used in rolls and what the face yields. Enricher syntax: <code>@1547[1db|2dh|1dx]{Bastard Sword}</code>.</p>`
            + sections,
        generated: true
    };
}

function generateMonsterReferenceChapter() {
    const monsters = loadJson(path.join(TEMPLATES_DIR, "monsters.json"));
    const sorted = [...monsters].sort((a, b) => String(a.name).localeCompare(String(b.name)));
    const body = sorted.map((m) => {
        const p = m.system?.props ?? {};
        const stats = [
            ["Type", p.TypeDropdown],
            ["HP", p.HP || p.HPMax],
            ["Move", p.MoveGround ? `${p.MoveGround}` : ""],
            ["Str", p.Stats_StrengthDice ? `${p.Stats_StrengthDice}d / ${p.Stats_StrengthMod ?? 0}+` : ""],
            ["Dex", p.Stats_DexterityDice ? `${p.Stats_DexterityDice}d / ${p.Stats_DexterityMod ?? 0}+` : ""],
            ["Sta", p.Stats_StaminaDice ? `${p.Stats_StaminaDice}d / ${p.Stats_StaminaMod ?? 0}+` : ""],
            ["Pow", p.Stats_PowerDice ? `${p.Stats_PowerDice}d / ${p.Stats_PowerMod ?? 0}+` : ""],
        ];
        return [
            `<h2>${htmlEscape(m.name)}</h2>`,
            statLine(stats),
            descBlock(p.Description || p.Notes || "")
        ].filter(Boolean).join("\n");
    }).join("\n");
    return {
        title: "Monster Reference",
        content: generatedIntro("monsters.json") + body,
        generated: true
    };
}

function generateStatReferenceChapter() {
    const order = ["Strength", "Stamina", "Dexterity", "Intelligence", "Faith", "Charisma", "Power"];
    const body = order.filter((s) => STAT_INFO[s])
        .map((s) => `<h2>${htmlEscape(s)}</h2>${descBlock(STAT_INFO[s])}`).join("\n");
    return {
        title: "Primary Stats",
        content: generatedIntro("scripts/hud/stat-info.js")
            + "<p>The seven primary stats, each rolled as Xd6 + modifier on a ladder (1d6, 1d6+1, … 2d6 …).</p>"
            + body,
        generated: true
    };
}

function generateHumourReferenceChapter() {
    const order = ["Blood", "Yellow Bile", "Black Bile", "Phlegm"];
    const body = order.filter((h) => HUMOUR_INFO[h])
        .map((h) => `<h2>${htmlEscape(h)}</h2>${descBlock(HUMOUR_INFO[h])}`).join("\n");
    return {
        title: "The Humours",
        content: generatedIntro("scripts/services/humour-info.js")
            + "<p>The four humours of temperament, set at birth and shifted by life. They drive disease, Your Nature, and how a character meets the world.</p>"
            + body,
        generated: true
    };
}

function generateConditionReferenceChapter() {
    const body = Object.entries(CONDITIONS)
        .filter(([, rule]) => rule?.description)
        .map(([name, rule]) => `<h3>${htmlEscape(name)}</h3>${descBlock(rule.description)}`).join("\n");
    return {
        title: "Conditions",
        content: generatedIntro("scripts/services/condition-registry.js") + body,
        generated: true
    };
}

function buildReferenceChapters() {
    return [
        generateStatReferenceChapter(),
        generateHumourReferenceChapter(),
        generateConditionReferenceChapter(),
        generateSpellChapter(),
        generateManeuverChapter(),
        generateMonsterPowerChapter(),
        generatePactChapter(),
        generateMarkChapter(),
        generateWeaponChapter(),
        generateArmorChapter(),
        generateEquipmentChapter(),
        generateChangeSetCatalog(),
        generateBoostRollTableChapter(),
        generateSkillTreeChapter(),
        generateDiceGlossaryChapter(),
        generateMonsterReferenceChapter()
    ].filter(Boolean);
}

// --- Equipment (generic items: amulets, clothing, containers, etc.) -----
// Source items are exported from a world via docs/export-equipment-macro.js;
// they arrive already in Foundry doc shape. This builder normalises the IDs,
// adds the `_exportFolderName` value to `system.props.Category` so the
// compendium displays grouped, then ships them as-is.

async function buildEquipmentPack() {
    const items = loadJson(path.join(TEMPLATES_DIR, "equipment.json"));
    const docs = (Array.isArray(items) ? items : []).map((src) => {
        const id = isValidFoundryId(src._id) ? src._id : deriveFoundryIdFromText(`equipment:${src.name}`);
        const category = String(src._exportFolderName ?? src.system?.props?.Category ?? "Equipment").trim();
        const cleaned = deepClone(src);
        delete cleaned._exportFolderName;
        cleaned._id = id;
        cleaned._key = `!items!${id}`;
        cleaned.folder = null;
        cleaned.system = cleaned.system ?? {};
        cleaned.system.props = cleaned.system.props ?? {};
        cleaned.system.props.Category = category;
        cleaned.flags = cleaned.flags ?? {};
        cleaned.flags[SOURCE_FLAG_SCOPE] = {
            ...(cleaned.flags[SOURCE_FLAG_SCOPE] ?? {}),
            folderHint: category,
            sourceData: src
        };
        cleaned.ownership = cleaned.ownership ?? { default: 0 };
        return cleaned;
    });
    await compilePackFromDocs("equipment", docs);
}

async function buildWeaponModifiersPack() {
    const modifiers = loadJson(path.join(TEMPLATES_DIR, "weapon-modifiers.json"));
    const template = loadJson(path.join(TEMPLATES_DIR, TEMPLATE_FILES.weaponModifier));
    const docs = modifiers.map((src) =>
        makeItemDoc(src, template, src.img ?? template.img ?? "icons/svg/upgrade.svg", buildWeaponModifierProps, "Weapon Modifiers")
    );
    await compilePackFromDocs("weapon-modifiers", docs);
}

// --- Pacts ---------------------------------------------------------------



async function buildPactsPack() {
    const pacts = loadJson(path.join(TEMPLATES_DIR, "pacts.json"));
    const template = loadJson(path.join(TEMPLATES_DIR, TEMPLATE_FILES.pact));
    const docs = pacts.map((src) =>
        makeItemDoc(src, template, src.img ?? template.img ?? "icons/svg/oath.svg", buildPactProps, "Pacts")
    );
    await compilePackFromDocs("pacts", docs);
}

// --- Supernatural Marks --------------------------------------------------



async function buildSupernaturalMarksPack() {
    const marks = loadJson(path.join(TEMPLATES_DIR, "supernatural-marks.json"));
    const template = loadJson(path.join(TEMPLATES_DIR, TEMPLATE_FILES.supernaturalMark));
    const docs = marks.map((src) =>
        makeItemDoc(src, template, src.img ?? template.img ?? "icons/svg/holy-shield.svg", buildSupernaturalMarkProps, "Supernatural Marks")
    );
    await compilePackFromDocs("supernatural-marks", docs);
}

// --- Requirements --------------------------------------------------------





async function buildRequirementsPack() {
    const requirements = loadJson(path.join(TEMPLATES_DIR, "requirements.json"));
    const template = loadJson(path.join(TEMPLATES_DIR, TEMPLATE_FILES.requirement));
    const docs = requirements.map((src) =>
        makeItemDoc(src, template, src.img ?? template.img ?? "icons/svg/lock.svg", buildRequirementProps, "Requirements")
    );
    await compilePackFromDocs("requirements", docs);
}

// --- Roll Tables ---------------------------------------------------------
// Five flavors all going into one "roll-tables" pack:
//   Boost (3d6 / 4d6 → Item document results)
//   Ritual Step (1dN → text)
//   Spell Failure (3d6 bell curve → text)
//   Spell Support (3d6 bell curve → text)
//   Pact-derived (per-pact 1dN → text, generated from pacts.json)
//
// In compendium packs, RollTable result keys use the `!tables.results!` prefix.
// Each result's `_key` must be set explicitly because the official Foundry CLI
// expects per-entry _key for embedded collections (results live inside the
// parent RollTable, not as separate documents — Foundry CLI handles this).

function rollTableDoc({ _id, name, description, results, formula, replacement = true, displayRoll = true, flags }) {
    // Decorate each result with the embedded `_key` Foundry expects.
    const decoratedResults = results.map((r) => ({
        ...r,
        _key: `!tables.results!${_id}.${r._id}`
    }));
    return {
        _id,
        _key: `!tables!${_id}`,
        name,
        description,
        results: decoratedResults,
        formula,
        replacement,
        displayRoll,
        folder: null,
        flags: flags ?? {},
        ownership: { default: 0 }
    };
}

function buildBoostRollTableDoc(table) {
    const normalized = normalizeSourceEntry(table, "boostRollTable", "RollTable");
    const results = buildBoostResults(normalized);
    return rollTableDoc({
        _id: normalized._id,
        name: normalized.name,
        description: `Roll ${normalized.drawFormula ?? "3d6"} on the standard boost table.`,
        results,
        formula: normalized.drawFormula ?? "3d6",
        flags: {
            [SOURCE_FLAG_SCOPE]: {
                sourceKey: String(table?.id ?? table?.name ?? "").trim(),
                folderHint: normalized.folder ?? null,
                sourceData: normalized,
                drawFormula: normalized.drawFormula ?? "3d6"
            }
        }
    });
}

function buildRitualStepRollTableDoc(table) {
    const normalized = normalizeSourceEntry(table, "ritualStepRollTable", "RollTable");
    const formula = ritualStepFormula(normalized);
    const results = buildRitualStepResults(normalized);
    const desc = ritualStepDescription(normalized, formula);
    return rollTableDoc({
        _id: normalized._id, name: normalized.name, description: desc, results, formula,
        replacement: false,
        flags: { [SOURCE_FLAG_SCOPE]: { sourceKey: String(table?.id ?? table?.name ?? "").trim(), sourceData: normalized, complexity: normalized.complexity ?? "", drawFormula: normalized.drawFormula ?? "", drawMode: normalized.drawMode ?? "distinct" } }
    });
}

function buildSpellFailureRollTableDoc(table) {
    const normalized = normalizeSourceEntry(table, "spellFailureRollTable", "RollTable");
    const results = buildBellCurveResults(normalized, { entryKey: "spellFailureEntry", defaultText: "Failure result", img: "icons/svg/skull.svg" });
    const desc = [
        `<p><strong>Severity:</strong> ${normalized.severity ?? "Minor"}</p>`,
        `<p><strong>Available entries:</strong> ${(normalized.entries ?? []).length}</p>`,
        "<p>This table is rolled when a spell cast fails and no more specific authored exception overrides the spell's default failure profile.</p>"
    ].join("");
    return rollTableDoc({
        _id: normalized._id, name: normalized.name, description: desc, results, formula: "3d6",
        flags: { [SOURCE_FLAG_SCOPE]: { sourceKey: String(table?.id ?? table?.name ?? "").trim(), sourceData: normalized, severity: normalized.severity ?? "" } }
    });
}

function buildSpellSupportRollTableDoc(table) {
    const normalized = normalizeSourceEntry(table, "spellSupportRollTable", "RollTable");
    const results = buildBellCurveResults(normalized, { entryKey: "spellSupportEntry", defaultText: "Support result", img: "icons/magic/holy/angel-winged-humanoid-blue.webp" });
    const desc = [
        `<p><strong>Family:</strong> ${String(normalized.family ?? "General").trim() || "General"}</p>`,
        `<p><strong>Available entries:</strong> ${(normalized.entries ?? []).length}</p>`,
        "<p>This table supports authored spell outcomes that are best chosen through one flavorful roll instead of a fixed single payload.</p>"
    ].join("");
    return rollTableDoc({
        _id: normalized._id, name: normalized.name, description: desc, results, formula: "3d6",
        flags: { [SOURCE_FLAG_SCOPE]: { sourceKey: String(table?.id ?? table?.name ?? "").trim(), sourceData: normalized, family: normalized.family ?? "" } }
    });
}

function buildPactRollTableDoc(pact) {
    const built = buildPactResults(pact);
    if (!built) return null;
    const { tableId, tableName, formula, results } = built;
    return rollTableDoc({
        _id: tableId, name: tableName,
        description: `${pact.rollTableTitle ?? "Roll table"} for ${pact.name}. Roll ${formula}.`,
        results, formula,
        flags: { [SOURCE_FLAG_SCOPE]: { sourceKey: pact._id, folderHint: "Pact Tables", sourcePactId: pact._id, sourcePactName: pact.name, drawFormula: formula } }
    });
}

// --- ChangeSets + Changes ------------------------------------------------
// ChangeSets and their child Changes are SEPARATE top-level CSB items linked
// via `system.container` on each Change (pointing to the parent ChangeSet's
// _id). The parent ChangeSet additionally carries a `system.props.ChangeDisplayer`
// map populated with refs to each child — that's what CSB's UI uses to render
// the children inside the ChangeSet sheet.
//
// Both go into one "changesets" pack so they ship together; users should use
// "Import All Content" rather than dragging individual ChangeSets to avoid
// orphaned ChangeDisplayer refs.







async function buildChangeSetsPack() {
    const changeSets = loadJson(path.join(TEMPLATES_DIR, "changesets.json"));
    const changes = loadJson(path.join(TEMPLATES_DIR, "changes.json"));
    const csTemplate = loadJson(path.join(TEMPLATES_DIR, TEMPLATE_FILES.changeSet));
    const chTemplate = loadJson(path.join(TEMPLATES_DIR, TEMPLATE_FILES.change));

    // 1. Build Change docs first, stamping system.container with parent ChangeSet ID.
    const changeDocs = changes.map((change) => {
        const doc = makeItemDoc(
            change,
            chTemplate,
            change.img ?? chTemplate.img ?? "icons/svg/item-bag.svg",
            buildChangeProps,
            CHANGE_FOLDER_LABELS[change.kind] ?? "Changes"
        );
        const parentId = change.parentChangeSetId ?? null;
        if (parentId) doc.system.container = parentId;
        return doc;
    });

    // 2. Build ChangeSet docs. Use the upgrade icon as the ChangeSet image — skip
    // csTemplate.img (the CSB template logo) so ChangeSets get a meaningful icon.
    const changeSetDocs = changeSets.map((cs) =>
        makeItemDoc(cs, csTemplate, cs.img ?? "icons/svg/upgrade.svg", buildChangeSetProps, "Change Sets")
    );

    // 3. Wire each ChangeSet's ChangeDisplayer with refs to its children.
    const changeSetById = new Map(changeSetDocs.map((d) => [d._id, d]));
    for (const changeDoc of changeDocs) {
        const parentId = String(changeDoc.system?.container ?? "").trim();
        if (!parentId) continue;
        const parent = changeSetById.get(parentId);
        if (!parent) continue;
        parent.system.props.ChangeDisplayer = parent.system.props.ChangeDisplayer ?? {};
        parent.system.props.ChangeDisplayer[changeDoc._id] = {
            name: changeDoc.name,
            id: changeDoc._id,
            uuid: `Item.${changeDoc._id}`
        };
    }

    await compilePackFromDocs("changesets", [...changeSetDocs, ...changeDocs]);
}

// --- Monsters ------------------------------------------------------------

function makeActorDoc(source, actorTemplate) {
    const { system: mergedSystem, prototypeToken: mergedPrototypeToken } = mergeActorParts(source, actorTemplate);
    return {
        _id: source._id,
        _key: `!actors!${source._id}`,
        name: source.name,
        type: source.type ?? "character",
        img: source.img ?? "icons/svg/mystery-man.svg",
        system: mergedSystem,
        prototypeToken: mergedPrototypeToken,
        effects: deepClone(source.effects ?? []),
        folder: null,
        flags: {
            ...deepClone(source.flags ?? {}),
            [SOURCE_FLAG_SCOPE]: {
                folderHint: source.folder ?? "Monsters",
                sourceData: source
            }
        },
        items: deepClone(source.items ?? []),
        ownership: deepClone(source.ownership ?? { default: 0 })
    };
}

async function buildMonstersPack() {
    const monsters = loadJson(path.join(TEMPLATES_DIR, "monsters.json"));
    const actorTemplate = loadJson(path.join(TEMPLATES_DIR, TEMPLATE_FILES.actor));
    const docs = monsters.map((src) => makeActorDoc(src, actorTemplate));
    await compilePackFromDocs("monsters", docs);
}

function buildDriveRollTableDoc(table) {
    const normalized = normalizeSourceEntry(table, "driveRollTable", "RollTable");
    // A blank entry (resultText: "") yields an empty result — the drive-roll
    // service treats that as "no drive this roll".
    // `distribution: "uniform"` = a flat 1dN where every entry is equally likely
    // (the Random Drive meta-table); otherwise a 3d6 bell curve.
    const uniform = table?.distribution === "uniform";
    const results = uniform
        ? buildUniformResults(normalized, { defaultText: "", img: "icons/svg/aura.svg" })
        : buildBellCurveResults(normalized, { entryKey: "driveEntry", defaultText: "", img: "icons/svg/aura.svg" });
    const formula = uniform ? `1d${Math.max(results.length, 1)}` : (normalized.drawFormula ?? "3d6");
    return rollTableDoc({
        _id: normalized._id,
        name: normalized.name,
        description: `Roll ${formula} for a monster drive. A blank result adds no drive.`,
        results,
        formula,
        flags: {
            [SOURCE_FLAG_SCOPE]: {
                sourceKey: String(table?.id ?? table?.name ?? "").trim(),
                folderHint: normalized.folder ?? null,
                sourceData: normalized,
                drawFormula: formula
            }
        }
    });
}

async function buildRollTablesPack() {
    const boostTables = loadJson(path.join(TEMPLATES_DIR, "boost-roll-tables.json"));
    const ritualStepTables = loadJson(path.join(TEMPLATES_DIR, "ritual-step-roll-tables.json"));
    const failureTables = loadJson(path.join(TEMPLATES_DIR, "spell-failure-roll-tables.json"));
    const supportTables = loadJson(path.join(TEMPLATES_DIR, "spell-support-roll-tables.json"));
    const driveTables = loadJson(path.join(TEMPLATES_DIR, "drive-roll-tables.json"));
    const pacts = loadJson(path.join(TEMPLATES_DIR, "pacts.json"));

    const docs = [
        ...boostTables.map(buildBoostRollTableDoc),
        ...ritualStepTables.map(buildRitualStepRollTableDoc),
        ...failureTables.map(buildSpellFailureRollTableDoc),
        ...supportTables.map(buildSpellSupportRollTableDoc),
        ...driveTables.map(buildDriveRollTableDoc),
        ...pacts.map(buildPactRollTableDoc).filter(Boolean)
    ];
    await compilePackFromDocs("roll-tables", docs);
}

// --- Main ----------------------------------------------------------------

async function main() {
    console.log("Building compendium packs…");
    fs.mkdirSync(PACKS_ROOT, { recursive: true });
    // Keep ritual step tables' Xd6 pickFormula/pickRange in sync with their
    // current entries before compiling (closes the stale-bake footgun).
    annotateRitualStepTables({ write: true, quiet: true });
    console.log("  refreshed ritual step table pick ranges");
    await buildRulebookPack();
    await buildManeuversPack();
    await buildSkillsPack();
    await buildSpellsPack();
    await buildDiseasesPack();
    await buildMonsterMagicPack();
    await buildWeaponsPack();
    await buildArmorsPack();
    await buildAmmunitionPack();
    await buildWeaponModifiersPack();
    await buildEquipmentPack();
    await buildPactsPack();
    await buildSupernaturalMarksPack();
    await buildRequirementsPack();
    await buildChangeSetsPack();
    await buildMonstersPack();
    await buildRollTablesPack();
    console.log("Done.");
}

main().catch((err) => {
    console.error("build-packs failed:", err);
    process.exit(1);
});
