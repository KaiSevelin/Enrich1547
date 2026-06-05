import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODULE_ROOT = path.resolve(__dirname, "../..");
const TEMPLATES_DIR = path.join(MODULE_ROOT, "foundry", "Templates");

const WEAPONS_PATH = path.join(TEMPLATES_DIR, "weapons.json");
const FVTT_WEAPONS_PATH = path.join(TEMPLATES_DIR, "fvtt-Items-weapons.json");

const DIE_TERM = {
    Grace: "g",
    Balanced: "b",
    Control: "c",
    Heavy: "h",
    Penetration: "p",
    Multiplier: "m",
    Risk: "r",
    Lethality: "l",
};

const MANUFACTURED_WEAPON_TEXT = new Map([
    ["Arming Sword", [
        "An arming sword is a straight, single-handed sidearm suited to both cut and thrust.",
        "It is dependable in close fencing and battlefield work without specializing too narrowly."
    ]],
    ["Arquebus", [
        "An arquebus is a shoulder-fired matchlock firearm, slow to reload but deadly when it lands well.",
        "It favors prepared shooting, battlefield nerve, and one strong hit over speed."
    ]],
    ["Bill", [
        "A bill is a polearm built from an agricultural hook and adapted for war, useful for catching, dragging, and controlling foes at reach.",
        "It excels when used to manage distance, receive an approach, and turn an enemy's movement against them."
    ]],
    ["Buckler", [
        "A buckler is a small hand shield used for quick deflection, pressure, and close support in a fight.",
        "It favors fast defensive work and sudden answers at arm's length."
    ]],
    ["Crossbow", [
        "A crossbow is a spanning bow fixed to a stock, slower to reload but powerful and direct in use.",
        "It rewards prepared aim and punishes exposed targets with a hard, disciplined shot."
    ]],
    ["Dagger", [
        "A dagger is a compact sidearm meant for close work, sudden violence, and a quick defensive answer.",
        "It thrives in tight measure, fast exchanges, and opportunistic thrusts."
    ]],
    ["Dart", [
        "A dart is a light thrown weapon meant for quick, accurate casts rather than heavy impact.",
        "It favors speed, nerve, and clean timing at short range."
    ]],
    ["Falchion", [
        "A falchion is a broad, forward-weighted sword built to deliver forceful cuts while still allowing a serviceable thrust.",
        "It leans toward committed offense and punishing edge work rather than delicate fencing."
    ]],
    ["Flail", [
        "A flail is a striking weapon that delivers force through a hinged head, awkward to judge but hard to stop cleanly.",
        "It rewards pressure and disruption more than tidy defensive structure."
    ]],
    ["Glaive", [
        "A glaive is a polearm built around a long cutting blade, combining reach with committed offensive pressure.",
        "It favors line control, receiving an advance, and decisive follow-through."
    ]],
    ["Halberd", [
        "A halberd is a battlefield polearm built to cut, thrust, and hook with authority.",
        "It is at its best when holding space, breaking order, and answering armor with leverage."
    ]],
    ["Handgonne", [
        "A handgonne is an early firearm, crude and demanding but capable of frightening impact.",
        "It favors resolve, preparation, and the willingness to trust one heavy shot."
    ]],
    ["Heavy Musket", [
        "A heavy musket is a large shoulder firearm built for reach and punishing shot rather than quick handling.",
        "It excels when fired from a prepared position and trusted to hit hard at distance."
    ]],
    ["Knuckledusters", [
        "Knuckledusters are close-fighting metal grips made to harden a punch without changing the range of the hand.",
        "They belong to brutal, immediate fighting where speed matters more than reach."
    ]],
    ["Lance", [
        "A lance is a long mounted thrusting weapon built for the charge and the first decisive impact.",
        "It favors commitment, timing, and momentum over prolonged exchange."
    ]],
    ["Long Sword", [
        "A long sword is a hand-and-a-half blade suited to both strong cuts and commanding thrusts.",
        "It offers a broad martial role, balancing offense, defense, and control."
    ]],
    ["Longbow", [
        "A longbow is a tall self bow built for drawn power, range, and disciplined shooting.",
        "It rewards steady aim and repeated strong shots from clear distance."
    ]],
    ["Mace", [
        "A mace is a compact crushing weapon built to deliver blunt force through armor and bone.",
        "It favors direct pressure and hard contact over finesse."
    ]],
    ["Maul", [
        "A maul is a two-handed crushing weapon built for committed blows and punishing impact.",
        "It is best used when raw force matters more than speed or subtlety."
    ]],
    ["Messer", [
        "A messer is a broad single-edged sidearm that cuts hard but still permits a direct thrust.",
        "It favors aggressive fencing and fast transitional pressure."
    ]],
    ["Morning Star", [
        "A morning star is a spiked striking weapon that mixes crushing force with piercing threat.",
        "It presses hard in close measure and punishes poor defense."
    ]],
    ["Parrying Dagger", [
        "A parrying dagger is a defensive off-hand blade meant to catch, check, and answer another weapon.",
        "It supports reactive fencing, close interruption, and sharp counters."
    ]],
    ["Partisan", [
        "A partisan is a broad-headed thrusting polearm that holds a line while threatening disciplined reach.",
        "It favors measured thrusting and careful control of approach."
    ]],
    ["Pike", [
        "A pike is a very long battlefield spear built to hold cavalry and close space with massed reach.",
        "It is a weapon of formation, denial, and uncompromising distance."
    ]],
    ["Poleaxe", [
        "A poleaxe is a heavily built fighting polearm meant to crush, hook, and thrust through armor.",
        "It excels in armored combat and in exchanges where leverage matters more than speed."
    ]],
    ["Quarterstaff", [
        "A quarterstaff is a long stave used for leverage, timing, and broad defensive control rather than edged killing power.",
        "It favors distance management, interruption, and disciplined structure."
    ]],
    ["Rapier", [
        "A long, narrow thrusting sword worn at the side, favored in towns, courts, and duels.",
        "It is made for reach, timing, and precise point work rather than heavy cutting."
    ]],
    ["Rondel", [
        "A rondel dagger is a stiff thrusting blade made to seek gaps in armor and layered clothing.",
        "It favors narrow entry, close control, and committed finishing thrusts."
    ]],
    ["Shield", [
        "A shield is a larger defensive board used to cover the body, shove space, and break the enemy's line.",
        "It supports forceful defense and close control more than elegant fencing."
    ]],
    ["Short Bow", [
        "A short bow is a lighter self bow suited to quicker shooting and easier movement than heavier war bows.",
        "It favors mobility, readiness, and fast ranged pressure."
    ]],
    ["Spear", [
        "A spear is a straightforward thrusting weapon valued for reach, order, and dependable battlefield use.",
        "It favors disciplined measure, receiving an advance, and simple lethal efficiency."
    ]],
    ["Throwing Knife", [
        "A throwing knife is a light blade balanced for a quick cast at short range.",
        "It favors immediacy, timing, and a fast ranged answer."
    ]],
    ["Unarmed", [
        "The empty hand is the simplest weapon, relying on timing, leverage, and raw nerve rather than steel.",
        "It favors close control, sudden commitment, and whatever skill the body itself can bring."
    ]],
    ["Warbow", [
        "A warbow is a powerful heavy bow built for drawn strength, discipline, and punishing flight.",
        "It favors strong shooting, battlefield confidence, and punishing reach."
    ]],
    ["Warhammer", [
        "A warhammer is a compact military hammer built to batter armor and deliver decisive blunt force.",
        "It favors committed contact and hard answers against defended foes."
    ]],
    ["Wheellock Pistol", [
        "A wheellock pistol is a compact firearm suited to close carried use, sudden threat, and one decisive shot.",
        "It favors immediacy and intimidation over sustained ranged exchange."
    ]],
    ["Zweihander", [
        "A zweihander is a great two-handed sword built for sweeping control, committed offense, and battlefield presence.",
        "It favors reach, force, and dominating space through momentum."
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
        ["RigidBlade", "rigid blade"],
        ["ArmorBreaking", "armor breaking"],
        ["PointBlank", "point-blank use"],
        ["SmallShield", "small-shield utility"],
    ]);
    if (directMap.has(raw)) return directMap.get(raw);

    const spaced = raw
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/_/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

    if (spaced === "point blank") return "point-blank use";
    if (spaced === "small shield") return "small-shield utility";
    return spaced;
}

function buildRollExpression(profile) {
    const orderedTerms = [];
    for (const die of profile?.dice ?? []) {
        const term = DIE_TERM[die] ?? String(die ?? "").trim().toLowerCase();
        if (!term) continue;
        const existing = orderedTerms.find((entry) => entry.term === term);
        if (existing) existing.count += 1;
        else orderedTerms.push({ term, count: 1 });
    }
    return orderedTerms.map(({ term, count }) => `${count}d${term}`).join("|");
}

function buildProfileLabel(weapon, profile, multipleProfiles) {
    if (!profile) return weapon.name;
    if (multipleProfiles && profile.name && profile.name !== "Default") {
        return `${weapon.name} ${profile.name}`;
    }
    const attackType = String(profile.attackType ?? "").trim().toLowerCase();
    if (attackType === "ranged") return `${weapon.name} Shot`;
    if (attackType === "thrown") return `${weapon.name} Throw`;
    return weapon.name;
}

function buildMechanicalSentence(weapon) {
    const profiles = Array.isArray(weapon.attackProfiles) ? weapon.attackProfiles.filter(Boolean) : [];
    const multipleProfiles = profiles.length > 1;
    const profileRefs = profiles.map((profile) => `@1547[${buildRollExpression(profile)}]{${buildProfileLabel(weapon, profile, multipleProfiles)}}`);
    const traitsText = toSentenceList(weapon.traits ?? []);
    const uniqueDamageTypes = [...new Set(profiles.map((profile) => String(profile.damageType ?? "").trim().toLowerCase()).filter(Boolean))];

    let damageClause = "dealing damage";
    if (uniqueDamageTypes.length === 1) damageClause = `dealing ${uniqueDamageTypes[0]} damage`;
    else if (uniqueDamageTypes.length > 1) damageClause = `shifting between ${toSentenceList(uniqueDamageTypes)} damage`;

    let profilesText = "";
    if (profileRefs.length === 1) {
        const attackType = String(profiles[0]?.attackType ?? "").trim().toLowerCase();
        const verb = attackType === "ranged"
            ? "fires with"
            : attackType === "thrown"
                ? "flies with"
                : "strikes with";
        profilesText = `it ${verb} ${profileRefs[0]}`;
    }
    else if (profileRefs.length === 2) profilesText = `it can answer with ${profileRefs[0]} or ${profileRefs[1]}`;
    else profilesText = `it can answer with ${profileRefs.slice(0, -1).join(", ")}, or ${profileRefs.at(-1)}`;

    const traitClause = traitsText ? ` while its traits emphasize ${traitsText}` : "";
    return `In play, ${profilesText}, ${damageClause}${traitClause}.`;
}

function buildNaturalWeaponIntro(weapon) {
    const match = /^(Claws|Bite|Tusks|Horn|Tentacle) \((Small|Medium|Large|Huge|Massive)\)$/.exec(weapon.name);
    if (!match) return "";
    const [, kind, size] = match;
    const sizeText = size.toLowerCase();
    switch (kind) {
        case "Claws":
            return `These ${sizeText} claws are natural slashing weapons used to rake and seize at close range.`;
        case "Bite":
            return `This ${sizeText} bite is a natural weapon built for snapping force and close killing pressure.`;
        case "Tusks":
            return `These ${sizeText} tusks are natural gore weapons built for driving impact and committed charges.`;
        case "Horn":
            return `This ${sizeText} horn is a natural gore weapon built to thrust body weight through the point.`;
        case "Tentacle":
            return `This ${sizeText} tentacle is a natural striking limb used to grasp, batter, and control space.`;
        default:
            return "";
    }
}

function buildDescription(weapon) {
    if (MANUFACTURED_WEAPON_TEXT.has(weapon.name)) {
        const [intro, handling] = MANUFACTURED_WEAPON_TEXT.get(weapon.name);
        return `${intro} ${handling} ${buildMechanicalSentence(weapon)}`.trim();
    }

    const naturalIntro = buildNaturalWeaponIntro(weapon);
    if (naturalIntro) {
        return `${naturalIntro} ${buildMechanicalSentence(weapon)}`.trim();
    }

    throw new Error(`No description strategy found for weapon: ${weapon.name}`);
}

function syncSourceDescriptions(weapons) {
    let updated = 0;
    for (const weapon of weapons) {
        const nextDescription = buildDescription(weapon);
        if (weapon.description !== nextDescription) {
            weapon.description = nextDescription;
            updated += 1;
        }
    }
    return updated;
}

function syncFvttDescriptions(sourceWeapons, fvttDocs) {
    const descriptionsById = new Map(sourceWeapons.map((weapon) => [weapon._id ?? weapon.id, weapon.description ?? ""]));
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
    const weapons = loadJson(WEAPONS_PATH);
    const weaponUpdates = syncSourceDescriptions(weapons);

    if (mode === "--stdout-weapons") {
        process.stdout.write(`${JSON.stringify(weapons, null, 2)}\n`);
        return;
    }

    let fvttDocs = [];
    let fvttUpdates = 0;
    if (fs.existsSync(FVTT_WEAPONS_PATH)) {
        fvttDocs = loadJson(FVTT_WEAPONS_PATH);
        fvttUpdates = syncFvttDescriptions(weapons, fvttDocs);
    }

    if (mode === "--stdout-fvtt") {
        process.stdout.write(`${JSON.stringify(fvttDocs, null, 2)}\n`);
        return;
    }

    saveJson(WEAPONS_PATH, weapons);
    if (fs.existsSync(FVTT_WEAPONS_PATH)) saveJson(FVTT_WEAPONS_PATH, fvttDocs);

    console.log(`Updated descriptions for ${weaponUpdates} weapons in weapons.json.`);
    console.log(`Updated descriptions for ${fvttUpdates} exported weapon docs in fvtt-Items-weapons.json.`);
}

main();
