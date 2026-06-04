/**
 * Build compendium packs from source JSON.
 *
 * Phase 1 — proof of concept: just the Maneuvers pack.
 * Reads `foundry/Templates/maneuvers.json`, wraps each entry as a CSB-style
 * Foundry Item document, writes one JSON file per entry into
 * `pack-source/maneuvers/`, then invokes Foundry CLI's compilePack to emit
 * a LevelDB pack under `packs/maneuvers/`.
 *
 * Maneuver-specific helpers below mirror the runtime seeder's logic in
 * `scripts/settings/module-settings.js` — duplicated here for now to avoid
 * the larger refactor needed to share pure helpers between runtime and
 * build-time. Will de-duplicate when pack #2 lands.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compilePack } from "@foundryvtt/foundryvtt-cli";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODULE_ROOT = path.resolve(__dirname, "../..");
const TEMPLATES_DIR = path.join(MODULE_ROOT, "foundry", "Templates");
const PACK_SOURCE_ROOT = path.join(MODULE_ROOT, "pack-source");
const PACKS_ROOT = path.join(MODULE_ROOT, "packs");

const MANEUVER_TEMPLATE_FILE = "fvtt-Item-maneuvertemplate-4owc4YQBlp94GbGs.json";
const MANEUVER_TEMPLATE_ID = "4owc4YQBlp94GbGs";
const SOURCE_FLAG_SCOPE = "1547Core";

function loadJson(filePath) {
    let raw = fs.readFileSync(filePath, "utf-8");
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
    return JSON.parse(raw);
}

function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
}

// --- Maneuver-specific helpers (mirrors module-settings.js 901-991) -------

function inferManeuverEffectFamily(maneuver) {
    if (maneuver.name === "Overwatch") return "prepared-effect";
    if (maneuver.name === "Suppressing Fire") return "battlefield-effect";
    return "instantaneous";
}

function inferManeuverPersistentEffectType(maneuver) {
    if (maneuver.name === "Aim") return "aimed";
    if (maneuver.name === "Brace" || maneuver.name === "Brace Firearm") return "braced";
    if (maneuver.name === "Overwatch") return "overwatch";
    if (maneuver.name === "Lock") return "locked";
    if (maneuver.name === "Choke") return "choking-hold";
    return null;
}

function inferManeuverBattlefieldEffectType(maneuver) {
    if (maneuver.name === "Suppressing Fire") return "suppressing-fire";
    return null;
}

function inferManeuverTargetType(maneuver) {
    const effectData = maneuver.effectData ?? {};
    if (effectData.areaAttack) return "area";
    if (maneuver.tags?.includes("support")) return "ally";
    return "enemy";
}

function inferManeuverRollType(maneuver) {
    if (maneuver.triggerType === "move-declared" || maneuver.tags?.includes("movement")) return "movement";
    if (maneuver.tags?.includes("defense") || maneuver.triggerType === "damage-taken") return "defense";
    if (maneuver.name === "Grapple Break") return "escape";
    return "attack";
}

function buildManeuverProps(maneuver) {
    const requirements = maneuver.requirements ?? {};
    const usageLimit = maneuver.usageLimit?.maxUses ?? 1;
    const effectFamily = inferManeuverEffectFamily(maneuver);
    const persistentEffectType = inferManeuverPersistentEffectType(maneuver);
    const battlefieldEffectType = inferManeuverBattlefieldEffectType(maneuver);
    const requiredTagParts = [];
    if (Array.isArray(requirements.requiredWeaponTraits)) requiredTagParts.push(...requirements.requiredWeaponTraits);
    if (Array.isArray(requirements.requiredWeaponGroups)) requiredTagParts.push(...requirements.requiredWeaponGroups);
    if (Array.isArray(requirements.requiredWeaponTags)) requiredTagParts.push(...requirements.requiredWeaponTags);
    else if (requirements.requiredWeaponTags) requiredTagParts.push(requirements.requiredWeaponTags);
    const requiredWeaponTags = requiredTagParts.join(", ");
    const excludedWeaponTags = Array.isArray(requirements.excludedWeaponTags)
        ? requirements.excludedWeaponTags.join(", ")
        : (requirements.excludedWeaponTags ?? "");
    return {
        SkillRequirement: requirements.skill ?? "",
        RequirementText: requirements.text ?? "",
        TargetRequirement: requirements.target ?? "",
        RequiredWeaponTags: requiredWeaponTags,
        ExcludedWeaponTags: excludedWeaponTags,
        UsageLimit: usageLimit,
        EffectFamily: effectFamily,
        CreatesPersistentEffect: Boolean(persistentEffectType),
        PersistentEffectType: persistentEffectType,
        CreatesBattlefieldEffect: Boolean(battlefieldEffectType),
        BattlefieldEffectType: battlefieldEffectType,
        EffectData: JSON.stringify(maneuver.effectData ?? {}, null, 2),
        Automated: Boolean(maneuver.automated),
        HandlerId: maneuver.handlerId ?? "",
        Description: "",
        Usage: maneuver.type ?? "pre",
        Trigger: maneuver.triggerType ?? "attack-declared",
        CostType: maneuver.CostType ?? "null",
        CostAmount: maneuver.CostAmount ?? 0,
        TargetType: inferManeuverTargetType(maneuver),
        RollType: inferManeuverRollType(maneuver)
    };
}

// --- Foundry Item document shape -----------------------------------------

function makeManeuverItemDoc(source, template) {
    const img = source.img ?? template.img ?? "icons/svg/combat.svg";
    const templateSystem = deepClone(template.system ?? {});
    return {
        _id: source._id,
        _key: `!items!${source._id}`,
        name: source.name,
        type: "equippableItem",
        img,
        system: {
            ...templateSystem,
            template: MANEUVER_TEMPLATE_ID,
            props: buildManeuverProps(source)
        },
        effects: [],
        folder: null,
        sort: 0,
        flags: {
            "custom-system-builder": {
                version: template.flags?.["custom-system-builder"]?.version ?? "5.2.0"
            },
            [SOURCE_FLAG_SCOPE]: {
                folderHint: source.folder ?? "Maneuvers",
                sourceData: source
            }
        },
        ownership: { default: 0 }
    };
}

// --- Main ----------------------------------------------------------------

async function buildManeuversPack() {
    const sourceDir = path.join(PACK_SOURCE_ROOT, "maneuvers");
    const packDir = path.join(PACKS_ROOT, "maneuvers");

    fs.rmSync(sourceDir, { recursive: true, force: true });
    fs.rmSync(packDir, { recursive: true, force: true });
    fs.mkdirSync(sourceDir, { recursive: true });

    const maneuvers = loadJson(path.join(TEMPLATES_DIR, "maneuvers.json"));
    const template = loadJson(path.join(TEMPLATES_DIR, MANEUVER_TEMPLATE_FILE));

    for (const maneuver of maneuvers) {
        const doc = makeManeuverItemDoc(maneuver, template);
        const fileName = `${doc.name.replace(/[^A-Za-z0-9_-]/g, "_")}_${doc._id}.json`;
        fs.writeFileSync(path.join(sourceDir, fileName), JSON.stringify(doc, null, 2));
    }
    console.log(`  prepared ${maneuvers.length} maneuver source docs in ${sourceDir}`);

    await compilePack(sourceDir, packDir, { log: false });
    console.log(`  compiled to ${packDir}`);
}

async function main() {
    console.log("Building compendium packs…");
    fs.mkdirSync(PACKS_ROOT, { recursive: true });
    await buildManeuversPack();
    console.log("Done.");
}

main().catch((err) => {
    console.error("build-packs failed:", err);
    process.exit(1);
});
