import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { SOURCE_FLAG_SCOPE } from "../lib/constants.mjs";

const ROOT = path.resolve("modules/1547core");
const TEMPLATE_PATH = path.join(ROOT, "foundry", "Templates", "fvtt-Item-spelltemplate-2kiWw3Cv5Zk1lZxn.json");
const SOURCE_PATH = path.join(ROOT, "foundry", "Templates", "spells.json");
const BUNDLE_PATH = path.join(ROOT, "foundry", "Templates", "fvtt-Items-spells.json");
const SPELLS_DIR = path.join(ROOT, "foundry", "Spells");

function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
}

export function buildSpellProps(spell) {
    const schoolSet = new Set((spell.schools ?? []).map((entry) => String(entry ?? "").trim()));
    const complexity = spell.complexity ?? "Medium";
    const failureProfile = spell.failureProfile ?? "Minor";
    const failureTable = String(spell.failureTable ?? "").trim() || `SpellFailure_${failureProfile}`;
    const supportRollTable = String(spell.supportRollTable ?? "").trim()
        || (spell.name === "Angelic Boon" ? "AngelicBoons" : "");
    const supportRollNotes = String(spell.supportRollNotes ?? "").trim()
        || (spell.name === "Angelic Boon"
            ? "Roll once on the authored Angelic Boons table and present the result in chat or apply it manually."
            : "");
    const randomStepRollFormula = spell.randomStepRollFormula
        ?? (complexity === "Easy" ? "1d2" : complexity === "Hard" ? "1d6" : "1d3");
    return {
        Description: spell.description ?? "",
        SpellKind: spell.spellKind ?? "Protection",
        Strength: spell.strength ?? 1,
        Complexity: complexity,
        RitualProfile: spell.ritualProfile ?? "",
        SchoolRequirementMode: spell.schoolRequirementMode ?? "Any",
        FailureProfile: failureProfile,
        RandomOutcome: Boolean(spell.randomOutcome),
        SpellNotes: spell.spellNotes ?? "",
        SchoolRequirementsTable: Array.isArray(spell.schoolRequirements) ? deepClone(spell.schoolRequirements) : [],
        PrerequisitesTable: Array.isArray(spell.prerequisitesTable) ? deepClone(spell.prerequisitesTable) : [],
        StaticRitualSteps: Array.isArray(spell.staticRitualSteps) ? deepClone(spell.staticRitualSteps) : [],
        SuccessEffects: Array.isArray(spell.successEffects) ? deepClone(spell.successEffects) : [],
        RitualStrengthTable: spell.ritualStrengthTable ?? "",
        RandomStepRollFormula: randomStepRollFormula,
        RitualStepTable: spell.ritualStepTable ?? "",
        RitualModifierTable: spell.ritualModifierTable ?? "",
        RitualAssemblyNotes: spell.ritualAssemblyNotes ?? "",
        FailureTable: failureTable,
        FailureEscalationTable: spell.failureEscalationTable ?? "",
        FailureNotes: spell.failureNotes ?? "",
        SupportRollTable: supportRollTable,
        SupportRollNotes: supportRollNotes,
        School_Alchemy: schoolSet.has("Alchemy"),
        School_Astrology: schoolSet.has("Astrology"),
        School_Divination: schoolSet.has("Divination"),
        School_Grimoire: schoolSet.has("Grimoire"),
        School_Knot: schoolSet.has("Knot"),
        School_Necromancy: schoolSet.has("Necromancy"),
        School_Religion: schoolSet.has("Religion"),
        School_Wards: schoolSet.has("Wards")
    };
}

function cloneTemplateSystem(template) {
    return {
        body: deepClone(template.system.body),
        display: deepClone(template.system.display),
        header: deepClone(template.system.header),
        hidden: deepClone(template.system.hidden ?? []),
        modifiers: [],
        template: template._id,
        templateSystemUniqueVersion: template.system.templateSystemUniqueVersion,
        props: {}
    };
}

export function makeItemDoc(source, template) {
    return {
        _id: source._id,
        name: source.name,
        type: "equippableItem",
        img: source.img ?? template.img ?? "icons/svg/daze.svg",
        system: {
            ...cloneTemplateSystem(template),
            props: buildSpellProps(source)
        },
        effects: [],
        folder: null,
        flags: {
            "custom-system-builder": {
                version: template.flags?.["custom-system-builder"]?.version ?? "5.2.0"
            },
            [SOURCE_FLAG_SCOPE]: {
                folderHint: source.folder ?? "Spells",
                sourceData: source
            }
        },
        items: [],
        ownership: { default: 0 }
    };
}

function slugify(value) {
    return String(value ?? "")
        .normalize("NFKD")
        .replace(/[^\w\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .toLowerCase();
}

async function main() {
    const [template, source] = await Promise.all([
        fs.readFile(TEMPLATE_PATH, "utf8").then((text) => JSON.parse(text.replace(/^\uFEFF/, ""))),
        fs.readFile(SOURCE_PATH, "utf8").then((text) => JSON.parse(text.replace(/^\uFEFF/, "")))
    ]);

    const docs = source.map((spell) => makeItemDoc(spell, template));

    await fs.mkdir(SPELLS_DIR, { recursive: true });
    const existingEntries = await fs.readdir(SPELLS_DIR, { withFileTypes: true });
    await Promise.all(existingEntries
        .filter((entry) => entry.isFile() && /^fvtt-Item-.*\.json$/i.test(entry.name))
        .map((entry) => fs.unlink(path.join(SPELLS_DIR, entry.name))));
    await fs.writeFile(BUNDLE_PATH, JSON.stringify(docs, null, 4) + "\n", "utf8");

    await Promise.all(docs.map(async (doc) => {
        const fileName = `fvtt-Item-${slugify(doc.name)}-${doc._id}.json`;
        const filePath = path.join(SPELLS_DIR, fileName);
        await fs.writeFile(filePath, JSON.stringify(doc, null, 4) + "\n", "utf8");
    }));

    console.log(`Generated ${docs.length} spell exports.`);
}

const isDirectRun = import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
if (isDirectRun) {
    main().catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
}
