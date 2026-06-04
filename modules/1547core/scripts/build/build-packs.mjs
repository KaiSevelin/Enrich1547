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
    weaponModifier: "fvtt-Item-weaponmodifiertemplate-WmP9Ld3Qs7Nk2FvR.json",
    pact: "fvtt-Item-pacttemplate-HPYYc2P0Ouagicmr.json",
    supernaturalMark: "fvtt-Item-supernaturalmarktemplate-w9ky0ZTDvXDs5Ce7.json",
    requirement: "fvtt-Item-requirementtemplate-L4ujYgqhGBGcoo2P.json",
    changeSet: "fvtt-Item-changesettemplate-b7A1z6cSZO4dYTKT.json",
    change: "fvtt-Item-changetemplate-WsrkfjBmudnIhvEK.json"
};

const ACTOR_TYPES = ["Player", "HiddenFolk", "TheUnseen", "Beast", "Undead", "Colossal", "Unnatural", "Construct", "Zone", "People"];
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

const VALID_FOUNDRY_ID = /^[A-Za-z0-9]{16}$/;

function isValidFoundryId(value) {
    return VALID_FOUNDRY_ID.test(String(value ?? ""));
}

function deriveFoundryIdFromText(text) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let hashA = 2166136261;
    let hashB = 16777619;
    const source = String(text ?? "1547CoreItem");
    for (const ch of source) {
        const code = ch.charCodeAt(0);
        hashA ^= code;
        hashA = Math.imul(hashA, 16777619) >>> 0;
        hashB = (Math.imul(hashB ^ code, 2246822519) + 3266489917) >>> 0;
    }
    let output = "";
    for (let i = 0; i < 16; i += 1) {
        hashA = (Math.imul(hashA ^ (hashB >>> (i % 8)), 1664525) + 1013904223) >>> 0;
        output += alphabet[hashA % alphabet.length];
    }
    return output;
}

function normalizeSourceEntry(source, kind, documentType = "Item") {
    const normalized = deepClone(source);
    let nextId = normalized._id;
    const uuidSuffix = typeof normalized.uuid === "string" ? normalized.uuid.split(".").pop() : "";
    if (!isValidFoundryId(nextId)) {
        if (isValidFoundryId(normalized.id)) nextId = normalized.id;
        else if (isValidFoundryId(uuidSuffix)) nextId = uuidSuffix;
        else nextId = deriveFoundryIdFromText(`${kind}:${normalized.name}:${normalized.uuid ?? ""}`);
    }
    normalized._id = nextId;
    normalized.id = nextId;
    normalized.uuid = `${documentType}.${nextId}`;
    return normalized;
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

// --- Pacts ---------------------------------------------------------------

function buildPactProps(pact) {
    return {
        Description: pact.description ?? "",
        PactType: pact.pactType ?? "Other",
        Patron: pact.patron ?? "",
        BoonText: pact.boonText ?? "",
        PriceText: pact.priceText ?? "",
        ObligationText: pact.obligationText ?? "",
        Tension: pact.tension ?? "",
        DormantState: pact.dormantState ?? "",
        ActiveState: pact.activeState ?? "",
        StrainedState: pact.strainedState ?? "",
        BrokenState: pact.brokenState ?? "",
        FulfilledState: pact.fulfilledState ?? "",
        CurrentStatus: pact.currentStatus ?? "Dormant",
        Dormant: pact.currentStatus === "Dormant",
        Active: pact.currentStatus === "Active",
        Strained: pact.currentStatus === "Strained",
        Broken: pact.currentStatus === "Broken",
        Fulfilled: pact.currentStatus === "Fulfilled",
        BreakText: pact.breakText ?? "",
        FulfillmentText: pact.fulfillmentText ?? "",
        ActiveObligations: pact.activeObligations ?? "",
        ObligationLog: pact.obligationLog ?? "",
        EventLog: pact.eventLog ?? "",
        BoonEffects: Array.isArray(pact.boonEffects) ? deepClone(pact.boonEffects) : [],
        PriceEffects: Array.isArray(pact.priceEffects) ? deepClone(pact.priceEffects) : [],
        StrainEffects: Array.isArray(pact.strainEffects) ? deepClone(pact.strainEffects) : [],
        BrokenEffects: Array.isArray(pact.brokenEffects) ? deepClone(pact.brokenEffects) : []
    };
}

async function buildPactsPack() {
    const pacts = loadJson(path.join(TEMPLATES_DIR, "pacts.json"));
    const template = loadJson(path.join(TEMPLATES_DIR, TEMPLATE_FILES.pact));
    const docs = pacts.map((src) =>
        makeItemDoc(src, template, src.img ?? template.img ?? "icons/svg/oath.svg", buildPactProps, "Pacts")
    );
    await compilePackFromDocs("pacts", docs);
}

// --- Supernatural Marks --------------------------------------------------

function buildSupernaturalMarkProps(mark) {
    const sources = Array.isArray(mark.markSource) ? mark.markSource : (mark.markSource ? [mark.markSource] : []);
    const isBlessing = (mark.markNature ?? "") === "Blessing";
    const isCurse = (mark.markNature ?? "") === "Curse";
    const isMixed = (mark.markNature ?? "") === "Mixed";
    return {
        Description: mark.description ?? "",
        MarkNature: mark.markNature ?? "Blessing",
        Blessing: isBlessing,
        Curse: isCurse,
        Mixed: isMixed,
        MarkScope: mark.markScope ?? "Minor",
        Major: (mark.markScope ?? "Minor") === "Major",
        Minor: (mark.markScope ?? "Minor") === "Minor",
        MarkSource: sources.join(", "),
        Bloodline: sources.includes("Bloodline"),
        Faith: sources.includes("Faith"),
        Pagan: sources.includes("Pagan"),
        Ritual: sources.includes("Ritual"),
        Zone: sources.includes("Zone"),
        Mark: sources.includes("Mark"),
        Pact: sources.includes("Pact"),
        Visibility: mark.visibility ?? "Hidden",
        Hidden: (mark.visibility ?? "Hidden") === "Hidden",
        Visible: (mark.visibility ?? "Hidden") === "Visible",
        VisibleTell: (mark.visibility ?? "Hidden") === "VisibleTell",
        SocialStanding: mark.socialStanding ?? "Suspect",
        Potency: mark.potency ?? "Manifest",
        TriggerType: mark.triggerType ?? "Passive",
        TriggerCondition: mark.triggerCondition ?? "",
        TriggerResponse: mark.triggerResponse ?? "",
        BearerNotes: mark.bearerNotes ?? "",
        RemovalConditions: mark.removalConditions ?? "",
        TransmissionNotes: mark.transmissionNotes ?? "",
        SocialConsequences: mark.socialConsequences ?? "",
        MarkEffects: Array.isArray(mark.markEffects) ? deepClone(mark.markEffects) : [],
        GrantedSpells: Array.isArray(mark.grantedSpells) ? deepClone(mark.grantedSpells) : []
    };
}

async function buildSupernaturalMarksPack() {
    const marks = loadJson(path.join(TEMPLATES_DIR, "supernatural-marks.json"));
    const template = loadJson(path.join(TEMPLATES_DIR, TEMPLATE_FILES.supernaturalMark));
    const docs = marks.map((src) =>
        makeItemDoc(src, template, src.img ?? template.img ?? "icons/svg/holy-shield.svg", buildSupernaturalMarkProps, "Supernatural Marks")
    );
    await compilePackFromDocs("supernatural-marks", docs);
}

// --- Requirements --------------------------------------------------------

function mergeDefinedProps(baseProps, overrideProps) {
    const merged = { ...(baseProps ?? {}) };
    for (const [key, value] of Object.entries(overrideProps ?? {})) {
        if (value !== undefined) merged[key] = value;
    }
    return merged;
}

function buildRequirementProps(requirement) {
    const props = {
        PredicateType: requirement.predicateType ?? requirement.system?.props?.PredicateType ?? "",
        Negate: requirement.negate ?? false,
        Notes: requirement.notes ?? "",
        GroupTarget: requirement.groupTarget ?? "",
        TagName: requirement.tagName ?? "",
        StatTarget: requirement.statTarget ?? "",
        StatThreshold: requirement.statThreshold ?? 0,
        PrimaryStatRequirementTarget: requirement.primaryStatRequirementTarget ?? "",
        PrimaryStatRequirementDice: requirement.primaryStatRequirementDice ?? 1,
        PrimaryStatRequirementMod: requirement.primaryStatRequirementMod ?? 0,
        RequirementSkillRef: requirement.requirementSkillRef ?? [],
        SkillMinLevel: requirement.skillMinLevel ?? 0
    };
    return mergeDefinedProps(props, requirement.props ?? requirement.system?.props);
}

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

const TEXT_RESULT_TYPE = 0;
const DOCUMENT_RESULT_TYPE = 1;

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
    const entries = Array.isArray(normalized.entries) ? normalized.entries : [];
    const results = entries.map((entry, index) => ({
        _id: deriveFoundryIdFromText(`${normalized._id}:${entry.roll ?? index}:result`),
        type: DOCUMENT_RESULT_TYPE,
        documentCollection: "Item",
        documentId: entry.boostId,
        text: entry.label ?? `Boost ${index + 1}`,
        img: "icons/svg/upgrade.svg",
        weight: 1,
        range: [entry.roll ?? (index + 1), entry.roll ?? (index + 1)],
        drawn: false,
        flags: { [SOURCE_FLAG_SCOPE]: { boostEntry: deepClone(entry) } }
    }));
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
    const entries = Array.isArray(normalized.entries) ? normalized.entries : [];
    const formula = `1d${Math.max(entries.length, 1)}`;
    const results = entries.map((entry, index) => ({
        _id: deriveFoundryIdFromText(`${normalized._id}:${entry.id ?? index}:result`),
        type: TEXT_RESULT_TYPE,
        text: entry.stepText ?? `Ritual step ${index + 1}`,
        img: "icons/svg/d20-grey.svg",
        weight: 1,
        range: [index + 1, index + 1],
        drawn: false,
        flags: { [SOURCE_FLAG_SCOPE]: { ritualStepEntry: deepClone(entry) } }
    }));
    const desc = [
        `<p><strong>Complexity:</strong> ${normalized.complexity ?? "Medium"}</p>`,
        normalized.drawFormula ? `<p><strong>Random ritual step draws:</strong> ${normalized.drawFormula}</p>` : "",
        `<p><strong>Available entries:</strong> ${entries.length}</p>`,
        "<p>This table is rolled to add variable ritual requirements after a spell's static ritual steps have been applied.</p>"
    ].filter(Boolean).join("");
    return rollTableDoc({
        _id: normalized._id, name: normalized.name, description: desc, results, formula,
        replacement: false,
        flags: { [SOURCE_FLAG_SCOPE]: { sourceKey: String(table?.id ?? table?.name ?? "").trim(), sourceData: normalized, complexity: normalized.complexity ?? "", drawFormula: normalized.drawFormula ?? "", drawMode: normalized.drawMode ?? "distinct" } }
    });
}

function buildBellCurveTextTableDoc(table, kind, entryKey, defaultText, img) {
    const normalized = normalizeSourceEntry(table, kind, "RollTable");
    const entries = Array.isArray(normalized.entries) ? normalized.entries : [];
    const total = Math.max(entries.length, 1);
    const rangeWidth = Math.max(1, Math.floor(16 / total));
    const results = entries.map((entry, index) => {
        let min = 3 + index * rangeWidth;
        let max = (index === entries.length - 1) ? 18 : (min + rangeWidth - 1);
        if (min > 18) min = 18;
        if (max > 18) max = 18;
        return {
            _id: deriveFoundryIdFromText(`${normalized._id}:${entry.id ?? index}:result`),
            type: TEXT_RESULT_TYPE,
            text: entry.resultText ?? `${defaultText} ${index + 1}`,
            img,
            weight: 1,
            range: [min, max],
            drawn: false,
            flags: { [SOURCE_FLAG_SCOPE]: { [entryKey]: deepClone(entry) } }
        };
    });
    return { normalized, results };
}

function buildSpellFailureRollTableDoc(table) {
    const { normalized, results } = buildBellCurveTextTableDoc(table, "spellFailureRollTable", "spellFailureEntry", "Failure result", "icons/svg/skull.svg");
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
    const { normalized, results } = buildBellCurveTextTableDoc(table, "spellSupportRollTable", "spellSupportEntry", "Support result", "icons/magic/holy/angel-winged-humanoid-blue.webp");
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
            type: TEXT_RESULT_TYPE,
            text: String(entry),
            img: "icons/svg/d20-grey.svg",
            weight: 1,
            range: [rollValue, rollValue],
            drawn: false,
            flags: { [SOURCE_FLAG_SCOPE]: { pactRollEntry: { index, rollValue, text: String(entry) } } }
        };
    });
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

function normalizeTypeList(values) {
    if (Array.isArray(values)) return values.map((e) => String(e ?? "").trim()).filter(Boolean);
    if (typeof values === "string" && values.trim()) return [values.trim()];
    return [];
}

function buildChangeSetProps(changeSet) {
    const allowedTypes = new Set(normalizeTypeList(changeSet.appliesTo ?? changeSet.forTypes));
    const props = {
        Notes: changeSet.notes ?? "",
        Description: changeSet.description ?? "",
        Group: changeSet.group ?? changeSet.system?.props?.Group ?? "",
        ForTypeAny: changeSet.forTypeAny ?? allowedTypes.size === 0,
        RequirementsDisplayer: changeSet.requirementsDisplayer ?? changeSet.system?.props?.RequirementsDisplayer ?? {},
        ChangeDisplayer: changeSet.changeDisplayer ?? changeSet.system?.props?.ChangeDisplayer ?? {}
    };
    for (const actorType of ACTOR_TYPES) {
        props[`ForType_${actorType}`] = allowedTypes.has(actorType) || changeSet[`ForType_${actorType}`] === true;
    }
    return mergeDefinedProps(props, changeSet.props ?? changeSet.system?.props);
}

function buildChangeProps(change) {
    const props = {
        Kind: change.kind ?? change.system?.props?.Kind ?? "",
        Notes: change.notes ?? "",
        StatTarget: change.statTarget ?? "",
        StatOp: change.statOp ?? "Add",
        StatValue: change.statValue ?? 0,
        PrimaryStatTarget: change.primaryStatTarget ?? "",
        PrimaryStatOp: change.primaryStatOp ?? "Step",
        PrimaryStatSteps: change.primaryStatSteps ?? 0,
        PrimaryStatSetDice: change.primaryStatSetDice ?? 1,
        PrimaryStatSetMod: change.primaryStatSetMod ?? 0,
        SkillRef: change.skillRef ?? [],
        SkillDelta: change.skillDelta ?? 0,
        TextTarget: change.textTarget ?? "",
        TextOp: change.textOp ?? "Append",
        TextValue: change.textValue ?? "",
        ItemGrantMode: change.itemGrantMode ?? "Direct",
        ItemGrantRef: change.itemGrantRef ?? [],
        ItemGrantRollTable: change.itemGrantRollTable ?? "",
        TagName: change.tagName ?? "",
        TraitName: change.traitName ?? "",
        TraitDescription: change.traitDescription ?? "",
        DurationValue: change.durationValue ?? 0,
        DurationUnit: change.durationUnit ?? "Permanent"
    };
    return mergeDefinedProps(props, change.props ?? change.system?.props);
}

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

    // 2. Build ChangeSet docs.
    const changeSetDocs = changeSets.map((cs) =>
        makeItemDoc(cs, csTemplate, cs.img ?? csTemplate.img ?? "icons/svg/upgrade.svg", buildChangeSetProps, "Change Sets")
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

async function buildRollTablesPack() {
    const boostTables = loadJson(path.join(TEMPLATES_DIR, "boost-roll-tables.json"));
    const ritualStepTables = loadJson(path.join(TEMPLATES_DIR, "ritual-step-roll-tables.json"));
    const failureTables = loadJson(path.join(TEMPLATES_DIR, "spell-failure-roll-tables.json"));
    const supportTables = loadJson(path.join(TEMPLATES_DIR, "spell-support-roll-tables.json"));
    const pacts = loadJson(path.join(TEMPLATES_DIR, "pacts.json"));

    const docs = [
        ...boostTables.map(buildBoostRollTableDoc),
        ...ritualStepTables.map(buildRitualStepRollTableDoc),
        ...failureTables.map(buildSpellFailureRollTableDoc),
        ...supportTables.map(buildSpellSupportRollTableDoc),
        ...pacts.map(buildPactRollTableDoc).filter(Boolean)
    ];
    await compilePackFromDocs("roll-tables", docs);
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
    await buildPactsPack();
    await buildSupernaturalMarksPack();
    await buildRequirementsPack();
    await buildChangeSetsPack();
    await buildRollTablesPack();
    console.log("Done.");
}

main().catch((err) => {
    console.error("build-packs failed:", err);
    process.exit(1);
});
