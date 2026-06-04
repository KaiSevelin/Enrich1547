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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODULE_ROOT = path.resolve(__dirname, "../..");
const TEMPLATES_DIR = path.join(MODULE_ROOT, "foundry", "Templates");
const PACK_SOURCE_ROOT = path.join(MODULE_ROOT, "pack-source");
const PACKS_ROOT = path.join(MODULE_ROOT, "packs");

const SOURCE_FLAG_SCOPE = "1547Core";
const TEMPLATE_FILES = {
    maneuver: "fvtt-Item-maneuvertemplate-4owc4YQBlp94GbGs.json",
    spell: "fvtt-Item-spelltemplate-2kiWw3Cv5Zk1lZxn.json",
    monsterMagic: "fvtt-Item-monstermagictemplate-M0nMgk7Yp2RsT5Vu.json",
    weapon: "fvtt-Item-weapontemplate-qZCfLEYQ7egbm1B9.json",
    armor: "fvtt-Item-armortemplate-uLlgZXz3GlXPFtsj.json",
    ammo: "fvtt-Item-ammunitiontemplate-389uqkKKn8M1SKux.json",
    weaponModifier: "fvtt-Item-weaponmodifiertemplate-WmP9Ld3Qs7Nk2FvR.json"
};

// --- Shared helpers ------------------------------------------------------

function loadJson(filePath) {
    let raw = fs.readFileSync(filePath, "utf-8");
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
    return JSON.parse(raw);
}

function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
}

function prepareDir(dir) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
}

function cloneTemplateSystem(template) {
    return {
        body: deepClone(template.system?.body),
        display: deepClone(template.system?.display),
        header: deepClone(template.system?.header),
        hidden: deepClone(template.system?.hidden ?? []),
        modifiers: [],
        template: template._id,
        templateSystemUniqueVersion: template.system?.templateSystemUniqueVersion,
        props: {}
    };
}

function makeItemDoc(source, template, img, propsBuilder, folderHint) {
    return {
        _id: source._id,
        _key: `!items!${source._id}`,
        name: source.name,
        type: "equippableItem",
        img,
        system: {
            ...cloneTemplateSystem(template),
            props: propsBuilder(source)
        },
        effects: [],
        folder: null,
        sort: 0,
        flags: {
            "custom-system-builder": {
                version: template.flags?.["custom-system-builder"]?.version ?? "5.2.0"
            },
            [SOURCE_FLAG_SCOPE]: {
                folderHint: folderHint ?? source.folder ?? null,
                sourceData: source
            }
        },
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
    return {
        SkillRequirement: requirements.skill ?? "",
        RequirementText: requirements.text ?? "",
        TargetRequirement: requirements.target ?? "",
        RequiredWeaponTags: requiredTagParts.join(", "),
        ExcludedWeaponTags: Array.isArray(requirements.excludedWeaponTags)
            ? requirements.excludedWeaponTags.join(", ")
            : (requirements.excludedWeaponTags ?? ""),
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

async function buildManeuversPack() {
    const maneuvers = loadJson(path.join(TEMPLATES_DIR, "maneuvers.json"));
    const template = loadJson(path.join(TEMPLATES_DIR, TEMPLATE_FILES.maneuver));
    const docs = maneuvers.map((src) =>
        makeItemDoc(src, template, src.img ?? template.img ?? "icons/svg/combat.svg", buildManeuverProps, "Maneuvers")
    );
    await compilePackFromDocs("maneuvers", docs);
}

// --- Spells --------------------------------------------------------------

function buildSpellProps(spell) {
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

async function buildSpellsPack() {
    const spells = loadJson(path.join(TEMPLATES_DIR, "spells.json"));
    const template = loadJson(path.join(TEMPLATES_DIR, TEMPLATE_FILES.spell));
    const docs = spells.map((src) =>
        makeItemDoc(src, template, src.img ?? template.img ?? "icons/svg/book.svg", buildSpellProps, "Spells")
    );
    await compilePackFromDocs("spells", docs);
}

// --- Monster Magic (Powers) ----------------------------------------------

function buildMonsterMagicProps(magic) {
    return {
        Description: magic.description ?? "",
        MagicKind: magic.magicKind ?? "Aura",
        UseMode: magic.useMode ?? "Activated",
        TriggerText: magic.triggerText ?? "",
        RangeText: magic.rangeText ?? "",
        CostText: magic.costText ?? "",
        FamilyNotes: magic.familyNotes ?? "",
        MagicNotes: magic.magicNotes ?? ""
    };
}

async function buildMonsterMagicPack() {
    const magics = loadJson(path.join(TEMPLATES_DIR, "monster-magic.json"));
    const template = loadJson(path.join(TEMPLATES_DIR, TEMPLATE_FILES.monsterMagic));
    const docs = magics.map((src) =>
        makeItemDoc(src, template, src.img ?? template.img ?? "icons/svg/aura.svg", buildMonsterMagicProps, "Monster Magic")
    );
    await compilePackFromDocs("monster-magic", docs);
}

// --- Weapons -------------------------------------------------------------

function normalizeTraitKey(value) {
    return String(value ?? "").replace(/[^A-Za-z0-9]/g, "");
}

function buildWeaponProps(weapon) {
    const traitKeys = [
        "Aiming", "ArmorBreaking", "Bracing", "Charging", "Control",
        "Disarming", "Fast", "Fragile", "Heavy", "Hooking",
        "Narrow", "Parrying", "PointBlank", "RigidBlade",
        "Receiving", "Reloading", "Shield", "SmallShield", "Tactical"
    ];
    const normalizedTraits = new Set((weapon.traits ?? []).map(normalizeTraitKey));
    const [a, b, c] = weapon.attackProfiles ?? [];

    const profileText = (profile) => {
        if (!profile) return "";
        const diceText = Array.isArray(profile.dice) ? profile.dice.join(", ") : "";
        return profile.name && profile.name !== "Default" ? `${profile.name}: ${diceText}` : diceText;
    };
    const profileAmmoText = (profile) => {
        if (!profile || !weapon.usesAmmo) return "";
        const allowedAmmoTypes = Array.isArray(profile.allowedAmmoTypes) && profile.allowedAmmoTypes.length > 0
            ? profile.allowedAmmoTypes
            : (weapon.ammoType ? [weapon.ammoType] : []);
        return allowedAmmoTypes.join(", ");
    };
    const profileDamageType = (profile) => profile?.damageType ?? "";
    const profileDamageQualifiers = (profile) => Array.isArray(profile?.damageQualifiers)
        ? profile.damageQualifiers.join(", ") : "";

    const availableProfiles = [a, b, c]
        .map((profile, index) => profile ? ["Attack", "AttackB", "AttackC"][index] : null)
        .filter(Boolean);
    const sourceActiveProfile = String(weapon.activeAttackProfile ?? "").trim();
    const activeAttackProfile = availableProfiles.includes(sourceActiveProfile)
        ? sourceActiveProfile
        : (availableProfiles[0] ?? "Attack");

    const props = {
        Description: "",
        Weight: weapon.weight ?? 0,
        Value: weapon.value ?? 0,
        Equipped: Boolean(weapon.equipped),
        WeaponType: weapon.category ?? "Blade",
        MinReach: weapon.minReach ?? "",
        MaxReach: weapon.maxReach ?? "",
        ShortRange: weapon.shortRange ?? "",
        LongRange: weapon.longRange ?? "",
        MaxRange: weapon.maxRange ?? "",
        UsesAmmo: Boolean(weapon.usesAmmo),
        AmmoType: weapon.ammoType ?? "",
        AmmoCapacity: weapon.ammoCapacity ?? 0,
        AmmoLoaded: weapon.ammoLoaded ?? 0,
        LoadedAmmoId: weapon.loadedAmmoId ?? "",
        ReloadTime: weapon.reloadTime ?? 0,
        ReloadProgress: weapon.reloadProgress ?? 0,
        Attack: profileText(a),
        AttackDamageType: profileDamageType(a),
        AttackAmmo: profileAmmoText(a),
        AttackDamageQualifiers: profileDamageQualifiers(a),
        AttackB: profileText(b),
        AttackBDamageType: profileDamageType(b),
        AttackBAmmo: profileAmmoText(b),
        AttackBDamageQualifiers: profileDamageQualifiers(b),
        AttackC: profileText(c),
        AttackCDamageType: profileDamageType(c),
        AttackCAmmo: profileAmmoText(c),
        AttackCDamageQualifiers: profileDamageQualifiers(c),
        ActiveAttackProfile: activeAttackProfile
    };
    for (const key of traitKeys) props[`Traits_${key}`] = normalizedTraits.has(key);
    return props;
}

async function buildWeaponsPack() {
    const weapons = loadJson(path.join(TEMPLATES_DIR, "weapons.json"));
    const template = loadJson(path.join(TEMPLATES_DIR, TEMPLATE_FILES.weapon));
    const docs = weapons.map((src) =>
        makeItemDoc(src, template, src.img ?? template.img ?? "icons/svg/sword.svg", buildWeaponProps, src.folder ?? "Weapons")
    );
    await compilePackFromDocs("weapons", docs);
}

// --- Armors --------------------------------------------------------------

function buildArmorProps(armor) {
    const traitKeys = ["Concealable", "Encumbering", "Flexible", "Noisy", "Soft", "Resistance", "VerySoft"];
    const normalizedTraits = new Set((armor.traits ?? []).map(normalizeTraitKey));
    const props = {
        Description: "",
        Weight: armor.weight ?? 0,
        Value: armor.value ?? 0,
        Equipped: Boolean(armor.equipped),
        ArmorType: armor.armorClass ?? "Light",
        Defense: Array.isArray(armor.defenseDice) ? armor.defenseDice.join(", ") : ""
    };
    for (const key of traitKeys) props[`Traits_${key}`] = normalizedTraits.has(key);
    return props;
}

async function buildArmorsPack() {
    const armors = loadJson(path.join(TEMPLATES_DIR, "armors.json"));
    const template = loadJson(path.join(TEMPLATES_DIR, TEMPLATE_FILES.armor));
    const docs = armors.map((src) =>
        makeItemDoc(src, template, src.img ?? template.img ?? "icons/svg/shield.svg", buildArmorProps, src.folder ?? "Armors")
    );
    await compilePackFromDocs("armors", docs);
}

// --- Ammunition ----------------------------------------------------------

function buildAmmoProps(ammo) {
    const addDice = Array.isArray(ammo.addDice) ? ammo.addDice.join(", ") : "";
    const addDamageQualifiers = Array.isArray(ammo.addDamageQualifiers) ? ammo.addDamageQualifiers.join(", ") : "";
    const tags = Array.isArray(ammo.tags) ? ammo.tags.join(", ") : "";
    const range = ammo.range
        ?? (ammo.rangeOverride ? { mode: "override", ...ammo.rangeOverride } : null)
        ?? (ammo.rangeModifier ? { mode: "modify", ...ammo.rangeModifier } : null)
        ?? null;
    return {
        Description: ammo.description ?? "",
        Weight: ammo.weight ?? 0,
        Value: ammo.value ?? 0,
        Quantity: ammo.quantity ?? 1,
        AmmoType: ammo.ammoType ?? ammo.name ?? "",
        AddDice: addDice,
        AddDiceSummary: addDice,
        AddDamageQualifiers: addDamageQualifiers,
        OverrideDamageType: ammo.overrideDamageType ?? "",
        Tags: tags,
        TagsSummary: tags,
        RangeModeOverride: String(range?.mode ?? "modify").trim().toLowerCase() === "override",
        RangeShort: range?.shortRange ?? 0,
        RangeMedium: range?.longRange ?? 0,
        RangeLong: range?.maxRange ?? 0,
        Range: range ? JSON.stringify(range, null, 2) : "",
        ResultModifiers: JSON.stringify(ammo.resultModifiers ?? [], null, 2)
    };
}

async function buildAmmunitionPack() {
    const ammo = loadJson(path.join(TEMPLATES_DIR, "ammunition.json"));
    const template = loadJson(path.join(TEMPLATES_DIR, TEMPLATE_FILES.ammo));
    const docs = ammo.map((src) =>
        makeItemDoc(src, template, src.img ?? template.img ?? "icons/svg/target.svg", buildAmmoProps, "Ammunition")
    );
    await compilePackFromDocs("ammunition", docs);
}

// --- Weapon Modifiers ----------------------------------------------------

function buildWeaponModifierProps(modifier) {
    const toCsv = (value) => Array.isArray(value) ? value.join(", ") : "";
    return {
        Description: modifier.description ?? "",
        Weight: modifier.weight ?? 0,
        Value: modifier.value ?? 0,
        ModifierType: modifier.modifierType ?? "",
        TargetKinds: toCsv(modifier.targetKinds),
        AddDamageQualifiers: toCsv(modifier.addDamageQualifiers),
        RemoveDamageQualifiers: toCsv(modifier.removeDamageQualifiers),
        OverrideDamageType: modifier.overrideDamageType ?? "",
        AddDice: toCsv(modifier.addDice),
        RemoveDice: toCsv(modifier.removeDice),
        ResultModifiers: JSON.stringify(modifier.resultModifiers ?? [], null, 2),
        Tags: toCsv(modifier.tags),
        OnHitEffects: JSON.stringify(modifier.onHitEffects ?? [], null, 2),
        AppliesToProfiles: toCsv(modifier.appliesToProfiles),
        DurationType: modifier.durationType ?? "",
        DurationValue: modifier.durationValue ?? "",
        StackKey: modifier.stackKey ?? "",
        StackMode: modifier.stackMode ?? "",
        Requirements: JSON.stringify(modifier.requirements ?? {}, null, 2)
    };
}

async function buildWeaponModifiersPack() {
    const modifiers = loadJson(path.join(TEMPLATES_DIR, "weapon-modifiers.json"));
    const template = loadJson(path.join(TEMPLATES_DIR, TEMPLATE_FILES.weaponModifier));
    const docs = modifiers.map((src) =>
        makeItemDoc(src, template, src.img ?? template.img ?? "icons/svg/upgrade.svg", buildWeaponModifierProps, "Weapon Modifiers")
    );
    await compilePackFromDocs("weapon-modifiers", docs);
}

// --- Main ----------------------------------------------------------------

async function main() {
    console.log("Building compendium packs…");
    fs.mkdirSync(PACKS_ROOT, { recursive: true });
    await buildManeuversPack();
    await buildSpellsPack();
    await buildMonsterMagicPack();
    await buildWeaponsPack();
    await buildArmorsPack();
    await buildAmmunitionPack();
    await buildWeaponModifiersPack();
    console.log("Done.");
}

main().catch((err) => {
    console.error("build-packs failed:", err);
    process.exit(1);
});
