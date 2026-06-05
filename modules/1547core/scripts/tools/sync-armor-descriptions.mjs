import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODULE_ROOT = path.resolve(__dirname, "../..");
const TEMPLATES_DIR = path.join(MODULE_ROOT, "foundry", "Templates");

const ARMORS_PATH = path.join(TEMPLATES_DIR, "armors.json");
const FVTT_ARMORS_PATH = path.join(TEMPLATES_DIR, "fvtt-Items-armors.json");

const DIE_TERM = {
    Armor: "a",
    Evade: "e",
};

const ARMOR_TEXT = new Map([
    ["Unprotected", [
        "Unprotected means relying on clothing, movement, and luck alone rather than any true armor.",
        "It offers freedom of motion but no dedicated physical defense beyond what the body can avoid."
    ]],
    ["Brigandine", [
        "A brigandine is a cloth or leather coat lined with small internal plates, giving solid protection without the full presence of plate harness.",
        "It suits practical battlefield use where protection matters more than silence."
    ]],
    ["Cuir Boilii", [
        "Cuir boilii is hardened leather shaped to resist cuts and hard contact while staying lighter than metal armor.",
        "It favors practical wear and moderate protection without the full burden of iron."
    ]],
    ["Cuirass", [
        "A cuirass is a rigid metal defense for the torso, built to meet force directly rather than yield to it.",
        "It favors firm protection and battlefield assurance over quiet movement."
    ]],
    ["Full Plate", [
        "Full plate is a complete articulated harness of metal defenses, built for the highest level of personal battlefield protection.",
        "It favors survival, authority, and resistance at the cost of burden and noise."
    ]],
    ["Hauberk", [
        "A hauberk is a long mail shirt of interlinked iron rings, valued for broad coverage and flexible wear.",
        "It favors reliable defense that still allows movement, though never in silence."
    ]],
    ["Infantry Plate", [
        "Infantry plate is a heavy soldier's harness built for hard campaigning and direct battlefield use rather than noble display.",
        "It favors strong protection and disciplined endurance over comfort."
    ]],
    ["Leather Jerkin", [
        "A leather jerkin is a light fitted defense worn over ordinary clothing, common where modest protection and easy wear are preferred.",
        "It favors movement, concealability, and practical use over hard resistance."
    ]],
    ["Munition Plate", [
        "Munition plate is mass-made armor built for war in quantity, giving substantial protection without the finish of bespoke harness.",
        "It favors battlefield durability and institutional use over grace or comfort."
    ]],
    ["Padded Jack", [
        "A padded jack is a quilted defensive coat worn alone or beneath harder armor, common among soldiers, guards, and travelers.",
        "It favors practical protection and ease of wear over prestige or heavy resistance."
    ]],
    ["Tournament Armor", [
        "Tournament armor is an extremely heavy specialized harness built for controlled martial display and punishing impact.",
        "It favors maximum resistance in formal combat at the cost of great burden."
    ]],
]);

function loadJson(filePath) {
    let raw = fs.readFileSync(filePath, "utf8");
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
    return JSON.parse(raw);
}

function saveJson(filePath, value) {
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function toSentenceList(values) {
    if (!Array.isArray(values) || values.length === 0) return "";
    const lowered = values.map(humanizeTraitText).filter(Boolean);
    if (lowered.length === 1) return lowered[0];
    if (lowered.length === 2) return `${lowered[0]} and ${lowered[1]}`;
    return `${lowered.slice(0, -1).join(", ")}, and ${lowered.at(-1)}`;
}

function humanizeTraitText(value) {
    const raw = String(value ?? "").trim();
    if (!raw) return "";

    const directMap = new Map([
        ["NaturalArmor", "natural armor"],
        ["VerySoft", "very soft protection"],
    ]);
    if (directMap.has(raw)) return directMap.get(raw);

    return raw
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/_/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

function buildDefenseExpression(armor) {
    const orderedTerms = [];
    for (const die of armor?.defenseDice ?? []) {
        const term = DIE_TERM[die] ?? String(die ?? "").trim().toLowerCase();
        if (!term) continue;
        const existing = orderedTerms.find((entry) => entry.term === term);
        if (existing) existing.count += 1;
        else orderedTerms.push({ term, count: 1 });
    }
    return orderedTerms.map(({ term, count }) => `${count}d${term}`).join("|");
}

function buildArmorLabel(armor) {
    if (armor.name === "Unprotected") return "Unprotected Defense";
    return `${armor.name} Defense`;
}

function buildMechanicalSentence(armor) {
    const defenseRef = `@1547[${buildDefenseExpression(armor)}]{${buildArmorLabel(armor)}}`;
    const traitsText = toSentenceList(armor.traits ?? []);
    const traitClause = traitsText ? ` while its traits emphasize ${traitsText}` : "";
    return `In play, it offers ${defenseRef}${traitClause}.`;
}

function buildNaturalArmorDescription(armor) {
    const match = /^Natural Armor \((Small|Medium|Large|Huge|Massive)\)$/.exec(armor.name);
    if (!match) return "";
    const size = match[1].toLowerCase();
    return `This ${size} natural armor is an inherent bodily defense of hide, scale, shell, thick skin, or occult resilience rather than crafted harness. ${buildMechanicalSentence(armor)}`.trim();
}

function buildDescription(armor) {
    if (ARMOR_TEXT.has(armor.name)) {
        const [intro, handling] = ARMOR_TEXT.get(armor.name);
        return `${intro} ${handling} ${buildMechanicalSentence(armor)}`.trim();
    }

    const naturalDescription = buildNaturalArmorDescription(armor);
    if (naturalDescription) return naturalDescription;

    throw new Error(`No description strategy found for armor: ${armor.name}`);
}

function syncSourceDescriptions(armors) {
    let updated = 0;
    for (const armor of armors) {
        const nextDescription = buildDescription(armor);
        if (armor.description !== nextDescription) {
            armor.description = nextDescription;
            updated += 1;
        }
    }
    return updated;
}

function syncFvttDescriptions(sourceArmors, fvttDocs) {
    const descriptionsById = new Map(sourceArmors.map((armor) => [armor._id ?? armor.id, armor.description ?? ""]));
    let updated = 0;
    for (const doc of fvttDocs) {
        const nextDescription = descriptionsById.get(doc?._id) ?? "";
        if (doc?.system?.props && doc.system.props.Description !== nextDescription) {
            doc.system.props.Description = nextDescription;
            updated += 1;
        }
        const sourceData = doc?.flags?.["1547Core"]?.sourceData;
        if (sourceData && sourceData.description !== nextDescription) {
            sourceData.description = nextDescription;
        }
    }
    return updated;
}

function main() {
    const mode = process.argv[2] ?? "";
    const armors = loadJson(ARMORS_PATH);
    const armorUpdates = syncSourceDescriptions(armors);

    if (mode === "--stdout-armors") {
        process.stdout.write(`${JSON.stringify(armors, null, 2)}\n`);
        return;
    }

    let fvttDocs = [];
    let fvttUpdates = 0;
    if (fs.existsSync(FVTT_ARMORS_PATH)) {
        fvttDocs = loadJson(FVTT_ARMORS_PATH);
        fvttUpdates = syncFvttDescriptions(armors, fvttDocs);
    }

    if (mode === "--stdout-fvtt") {
        process.stdout.write(`${JSON.stringify(fvttDocs, null, 2)}\n`);
        return;
    }

    saveJson(ARMORS_PATH, armors);
    if (fs.existsSync(FVTT_ARMORS_PATH)) saveJson(FVTT_ARMORS_PATH, fvttDocs);

    console.log(`Updated descriptions for ${armorUpdates} armors in armors.json.`);
    console.log(`Updated descriptions for ${fvttUpdates} exported armor docs in fvtt-Items-armors.json.`);
}

main();
