import { buildOnHitEffectItemDoc } from "../services/weapon-modifier-attachment-service.js";

const MODULE_ID = "1547core";
const SOURCE_FLAG_SCOPE = "1547Core";
const TEMPLATE_FILES = {
    actorTemplate: "fvtt-Actor-1547-Tgs09eTiTp63Cp7u.json",
    maneuver: "fvtt-Item-maneuvertemplate-4owc4YQBlp94GbGs.json",
    weapon: "fvtt-Item-weapontemplate-qZCfLEYQ7egbm1B9.json",
    armor: "fvtt-Item-armortemplate-uLlgZXz3GlXPFtsj.json",
    ammo: "fvtt-Item-ammunitiontemplate-389uqkKKn8M1SKux.json",
    weaponModifier: "fvtt-Item-weaponmodifiertemplate-WmP9Ld3Qs7Nk2FvR.json",
    onHitEffect: "fvtt-Item-onhiteffecttemplate-OnH1tEffectTmpl0.json",
    supernaturalMark: "fvtt-Item-supernaturalmarktemplate-w9ky0ZTDvXDs5Ce7.json",
    monsterMagic: "fvtt-Item-monstermagictemplate-M0nMgk7Yp2RsT5Vu.json",
    disease: "fvtt-Item-diseasetemplate-DZ7sK2mLp9Qx4TvR.json",
    spell: "fvtt-Item-spelltemplate-2kiWw3Cv5Zk1lZxn.json",
    pact: "fvtt-Item-pacttemplate-HPYYc2P0Ouagicmr.json",
    ritual: "fvtt-Item-ritualtemplate-Qv6pN2Lm8R4tY1Ks.json",
    ritualStep: "fvtt-Item-ritualsteptemplate-R7sTu4Qn2Lp8Vx5K.json",
    usageEffect: "fvtt-Item-usageeffecttemplate-mwPqEYUoOfzXpyT9.json",
    changeSet: "fvtt-Item-changesettemplate-b7A1z6cSZO4dYTKT.json",
    change: "fvtt-Item-changetemplate-WsrkfjBmudnIhvEK.json",
    requirement: "fvtt-Item-requirementtemplate-L4ujYgqhGBGcoo2P.json"
};
const VALID_FOUNDRY_ID = /^[A-Za-z0-9]{16}$/;
const ACTOR_TYPES = [
    "Player",
    "HiddenFolk",
    "TheUnseen",
    "Beast",
    "Undead",
    "Colossal",
    "Unnatural",
    "Construct",
    "Zone",
    "People"
];
const CHANGE_SET_GROUPS = ["Base", "Domain", "Role", "Motivation", "Loadout", "Quirk", "Boost"];
const CHANGE_FOLDER_LABELS = {
    Stat: "Stat (Numeric)",
    PrimaryStat: "Primary Stat",
    Skill: "Skill",
    Text: "Text",
    ItemGrant: "Item Grant",
    Tag: "Tag",
    Trait: "Trait"
};
const REQUIREMENT_FOLDER_LABELS = {
    GroupPresent: "Group",
    HasTag: "Tag",
    StatAtLeast: "Stat",
    PrimaryStatAtLeast: "Primary Stat",
    HasSkill: "Skill"
};

function getModuleBasePath() {
    const modulePath = game.modules.get(MODULE_ID)?.path ?? game.modules.get(SOURCE_FLAG_SCOPE)?.path ?? "";
    const normalizedPath = String(modulePath).replace(/\\/g, "/");
    const folderName = normalizedPath.split("/").filter(Boolean).pop();
    return folderName ? `modules/${folderName}` : `modules/${MODULE_ID}`;
}

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
    const normalized = foundry.utils.deepClone(source);
    let nextId = normalized._id;
    const uuidSuffix = typeof normalized.uuid === "string" ? normalized.uuid.split(".").pop() : "";

    if (!isValidFoundryId(nextId)) {
        if (isValidFoundryId(normalized.id)) {
            nextId = normalized.id;
        } else if (isValidFoundryId(uuidSuffix)) {
            nextId = uuidSuffix;
        } else {
            nextId = deriveFoundryIdFromText(`${kind}:${normalized.name}:${normalized.uuid ?? ""}`);
        }
    }

    normalized._id = nextId;
    normalized.id = nextId;
    normalized.uuid = `${documentType}.${nextId}`;
    return normalized;
}

function mergeDefinedProps(baseProps, overrideProps) {
    const merged = { ...(baseProps ?? {}) };
    for (const [key, value] of Object.entries(overrideProps ?? {})) {
        if (value !== undefined) {
            merged[key] = value;
        }
    }
    return merged;
}

// Pure helpers exported for unit testing (no behavioural change to the runtime).
export {
    isValidFoundryId,
    deriveFoundryIdFromText,
    normalizeSourceEntry,
    mergeDefinedProps,
    buildRitualStepRollTableDoc,
    buildSpellFailureRollTableDoc,
    buildSpellSupportRollTableDoc,
    pruneDuplicateTemplates,
    OBSOLETE_TEMPLATE_NAMES,
    refreshActorItemBodiesFromTemplates,
};

function normalizeTypeList(values) {
    if (Array.isArray(values)) return values.map((entry) => String(entry ?? "").trim()).filter(Boolean);
    if (typeof values === "string" && values.trim()) return [values.trim()];
    return [];
}

function cloneTemplateSystem(template) {
    return {
        body: foundry.utils.deepClone(template.system.body),
        display: foundry.utils.deepClone(template.system.display),
        header: foundry.utils.deepClone(template.system.header),
        hidden: foundry.utils.deepClone(template.system.hidden ?? []),
        modifiers: [],
        template: template._id,
        templateSystemUniqueVersion: template.system.templateSystemUniqueVersion,
        props: {}
    };
}

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
        return profile.name && profile.name !== "Default"
            ? `${profile.name}: ${diceText}`
            : diceText;
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
        ? profile.damageQualifiers.join(", ")
        : "";

    const availableProfiles = [a, b, c]
        .map((profile, index) => profile ? ["Attack", "AttackB", "AttackC"][index] : null)
        .filter(Boolean);
    const sourceActiveProfile = String(weapon.activeAttackProfile ?? "").trim();
    const activeAttackProfile = availableProfiles.includes(sourceActiveProfile)
        ? sourceActiveProfile
        : (availableProfiles[0] ?? "Attack");

    const props = {
        Description: weapon.description ?? "",
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

    for (const key of traitKeys) {
        props[`Traits_${key}`] = normalizedTraits.has(key);
    }

    return props;
}

function buildArmorProps(armor) {
    const traitKeys = ["Concealable", "Encumbering", "Flexible", "Noisy", "Soft", "Resistance", "VerySoft"];
    const normalizedTraits = new Set((armor.traits ?? []).map(normalizeTraitKey));
    const props = {
        Description: armor.description ?? "",
        Weight: armor.weight ?? 0,
        Value: armor.value ?? 0,
        Equipped: Boolean(armor.equipped),
        ArmorType: armor.armorClass ?? "Light",
        Defense: Array.isArray(armor.defenseDice) ? armor.defenseDice.join(", ") : ""
    };

    for (const key of traitKeys) {
        props[`Traits_${key}`] = normalizedTraits.has(key);
    }

    return props;
}

function buildAmmoProps(ammo) {
    const addDice = Array.isArray(ammo.addDice) ? ammo.addDice.join(", ") : "";
    const addDamageQualifiers = Array.isArray(ammo.addDamageQualifiers)
        ? ammo.addDamageQualifiers.join(", ")
        : "";
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

// Pre-seeds an OnHitEffect ITEM in the world for every onHitEffects entry on
// each modifier source. With these in the world, the modifier item's CSB
// itemContainer renders the effects from the Items panel without needing the
// attach-time createItem hook to fire on an actor. Reuses the actor-side
// buildOnHitEffectItemDoc so the world and actor shapes stay in lockstep.
function buildWorldOnHitEffectDocs(modifierSources, modifierDocs, onHitEffectTemplate, folderId) {
    if (!onHitEffectTemplate) return [];
    const docsByModifierId = new Map(modifierDocs.map((doc) => [doc._id, doc]));
    const out = [];
    for (const modifier of modifierSources) {
        const modifierDoc = docsByModifierId.get(modifier._id);
        if (!modifierDoc) continue;
        const effects = Array.isArray(modifier.onHitEffects) ? modifier.onHitEffects : [];
        effects.forEach((effectSource, index) => {
            const base = buildOnHitEffectItemDoc(effectSource, modifierDoc._id, onHitEffectTemplate);
            if (!base) return;
            const _id = deriveFoundryIdFromText(`onhit:${modifierDoc._id}:${index}`);
            const damageOrStatus = String(effectSource.damageType ?? effectSource.applyStatus ?? "Effect").trim() || "Effect";
            out.push({
                ...base,
                _id,
                name: `${modifierDoc.name} — ${damageOrStatus}`,
                folder: folderId ?? null,
                effects: [],
                items: [],
                ownership: { default: 0 },
                flags: {
                    ...(base.flags ?? {}),
                    [SOURCE_FLAG_SCOPE]: {
                        ...(base.flags?.[SOURCE_FLAG_SCOPE] ?? {}),
                        folderHint: "On-Hit Effects",
                    },
                },
            });
        });
    }
    return out;
}

// Generic world-item doc builder using an item template + already-shaped
// props. Mirrors the actor-side buildOnHitEffectItemDoc structure so all
// pre-seeded child items have the same shape (system.body/header/display
// cloned from the template, container points at the parent, props passed
// through verbatim).
function buildChildItemDoc({ id, name, parentId, templateDoc, props, folderId, folderHint, sourceData, img }) {
    return {
        _id: id,
        name,
        type: "equippableItem",
        img: img ?? templateDoc.img ?? "icons/svg/item-bag.svg",
        system: {
            body: foundry.utils.deepClone(templateDoc.system?.body),
            display: foundry.utils.deepClone(templateDoc.system?.display) ?? {},
            header: foundry.utils.deepClone(templateDoc.system?.header),
            hidden: foundry.utils.deepClone(templateDoc.system?.hidden ?? []),
            modifiers: [],
            template: templateDoc._id,
            templateSystemUniqueVersion: templateDoc.system?.templateSystemUniqueVersion,
            container: parentId,
            props: props ?? {},
        },
        effects: [],
        folder: folderId ?? null,
        flags: {
            "custom-system-builder": {
                version: templateDoc.flags?.["custom-system-builder"]?.version ?? "5.2.0",
            },
            [SOURCE_FLAG_SCOPE]: {
                folderHint: folderHint ?? null,
                sourceData: sourceData ?? null,
            },
        },
        items: [],
        ownership: { default: 0 },
    };
}

// Pre-seeds a UsageEffectTemplate child item per spell.successEffects entry,
// so the SpellTemplate's SuccessEffects itemContainer is populated from the
// Items panel. Source data already uses PascalCase keys matching the template
// props, so the entry is passed through verbatim.
function buildWorldSpellUsageEffectDocs(spellSources, spellDocs, usageEffectTemplate, folderId) {
    if (!usageEffectTemplate) return [];
    const docsBySpellId = new Map(spellDocs.map((doc) => [doc._id, doc]));
    const out = [];
    for (const spell of spellSources) {
        const spellDoc = docsBySpellId.get(spell._id);
        if (!spellDoc) continue;
        const effects = Array.isArray(spell.successEffects) ? spell.successEffects : [];
        effects.forEach((effectSource, index) => {
            const props = foundry.utils.deepClone(effectSource ?? {});
            const baseName = String(effectSource?.Description ?? effectSource?.EffectType ?? "Effect").trim() || "Effect";
            out.push(buildChildItemDoc({
                id: deriveFoundryIdFromText(`spellusage:${spellDoc._id}:${index}`),
                name: `${spellDoc.name} — ${baseName}`,
                parentId: spellDoc._id,
                templateDoc: usageEffectTemplate,
                props,
                folderId,
                folderHint: "Usage Effects",
                sourceData: effectSource,
            }));
        });
    }
    return out;
}

// Map legacy step types (StaticSkill, Naming, Preparation, Witness, Purity)
// down to the new {Material, Skill} domain. None of the legacy spells encode
// material requirements via StepType — the StepText/SkillCheck signal a skill
// check. Default to Skill so the difficulty + skill-container surfaces; users
// can flip the type on a step-by-step basis post-seed.
function mapLegacyRitualStepType(legacy) {
    const v = String(legacy ?? "").trim();
    if (v === "Material") return "Material";
    return "Skill";
}

function buildRitualStepProps(stepSource) {
    return {
        Description: String(stepSource?.StepText ?? "").trim(),
        StepType: mapLegacyRitualStepType(stepSource?.StepType),
        StepScope: String(stepSource?.StepScope ?? "Mandatory").trim() || "Mandatory",
        StepText: String(stepSource?.StepText ?? "").trim(),
        Difficulty: String(stepSource?.Difficulty ?? "").trim(),
        StepNotes: String(stepSource?.StepNotes ?? "").trim(),
    };
}

// Pre-seeds a RitualStepTemplate child item per spell.staticRitualSteps entry.
// Legacy step types collapse to {Material, Skill}; existing SkillCheck / step
// text content is preserved as props for now. Users author MaterialComponents
// and Skills via the step sheet's itemContainers post-seed.
function buildWorldSpellRitualStepDocs(spellSources, spellDocs, ritualStepTemplate, folderId) {
    if (!ritualStepTemplate) return [];
    const docsBySpellId = new Map(spellDocs.map((doc) => [doc._id, doc]));
    const out = [];
    for (const spell of spellSources) {
        const spellDoc = docsBySpellId.get(spell._id);
        if (!spellDoc) continue;
        const steps = Array.isArray(spell.staticRitualSteps) ? spell.staticRitualSteps : [];
        steps.forEach((stepSource, index) => {
            const baseName = String(stepSource?.StepText ?? "").slice(0, 60).trim() || `Step ${index + 1}`;
            out.push(buildChildItemDoc({
                id: deriveFoundryIdFromText(`spellstep:${spellDoc._id}:${index}`),
                name: `${spellDoc.name} — ${baseName}`,
                parentId: spellDoc._id,
                templateDoc: ritualStepTemplate,
                props: buildRitualStepProps(stepSource),
                folderId,
                folderHint: "Ritual Steps",
                sourceData: stepSource,
            }));
        });
    }
    return out;
}

function buildMonsterMagicProps(magic) {
    return {
        Description: magic.description ?? "",
        MagicKind: magic.magicKind ?? "Aura",
        UseMode: magic.useMode ?? "Activated",
        TriggerText: magic.triggerText ?? "",
        RangeText: magic.rangeText ?? "",
        CostText: magic.costText ?? "",
        FamilyNotes: magic.familyNotes ?? "",
        MagicNotes: magic.magicNotes ?? "",
    };
}

// Per-power UsageEffectTemplate child docs, one per `magicEffects` entry.
// Same pattern as spell SuccessEffects: source data is already in PascalCase
// matching the template's prop keys, so it's passed through verbatim.
function buildWorldMonsterMagicEffectDocs(monsterMagicSources, monsterMagicDocs, usageEffectTemplate, folderId) {
    if (!usageEffectTemplate) return [];
    const docsById = new Map(monsterMagicDocs.map((doc) => [doc._id, doc]));
    const out = [];
    for (const magic of monsterMagicSources) {
        const carrierDoc = docsById.get(magic._id);
        if (!carrierDoc) continue;
        const effects = Array.isArray(magic.magicEffects) ? magic.magicEffects : [];
        effects.forEach((effectSource, index) => {
            const props = foundry.utils.deepClone(effectSource ?? {});
            const baseName = String(effectSource?.Description ?? effectSource?.EffectType ?? "Effect").trim() || "Effect";
            out.push(buildChildItemDoc({
                id: deriveFoundryIdFromText(`mmusage:${carrierDoc._id}:${index}`),
                name: `${carrierDoc.name} — ${baseName}`,
                parentId: carrierDoc._id,
                templateDoc: usageEffectTemplate,
                props,
                folderId,
                folderHint: "Usage Effects",
                sourceData: effectSource,
            }));
        });
    }
    return out;
}

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
        SchoolRequirementsTable: Array.isArray(spell.schoolRequirements) ? foundry.utils.deepClone(spell.schoolRequirements) : [],
        PrerequisitesTable: Array.isArray(spell.prerequisitesTable) ? foundry.utils.deepClone(spell.prerequisitesTable) : [],
        StaticRitualSteps: Array.isArray(spell.staticRitualSteps) ? foundry.utils.deepClone(spell.staticRitualSteps) : [],
        SuccessEffects: Array.isArray(spell.successEffects) ? foundry.utils.deepClone(spell.successEffects) : [],
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

function buildRitualStepRollTableDescription(table) {
    const complexity = table.complexity ?? "Medium";
    const drawFormula = table.drawFormula ?? "";
    const count = Array.isArray(table.entries) ? table.entries.length : 0;
    return [
        `<p><strong>Complexity:</strong> ${complexity}</p>`,
        drawFormula ? `<p><strong>Random ritual step draws:</strong> ${drawFormula}</p>` : "",
        `<p><strong>Available entries:</strong> ${count}</p>`,
        "<p>This table is rolled to add variable ritual requirements after a spell's static ritual steps have been applied.</p>"
    ].filter(Boolean).join("");
}

function buildSpellFailureRollTableDescription(table) {
    const severity = table.severity ?? "Minor";
    const count = Array.isArray(table.entries) ? table.entries.length : 0;
    return [
        `<p><strong>Severity:</strong> ${severity}</p>`,
        `<p><strong>Available entries:</strong> ${count}</p>`,
        "<p>This table is rolled when a spell cast fails and no more specific authored exception overrides the spell's default failure profile.</p>"
    ].join("");
}

function buildSpellSupportRollTableDescription(table) {
    const family = String(table.family ?? "General").trim() || "General";
    const count = Array.isArray(table.entries) ? table.entries.length : 0;
    return [
        `<p><strong>Family:</strong> ${family}</p>`,
        `<p><strong>Available entries:</strong> ${count}</p>`,
        "<p>This table supports authored spell outcomes that are best chosen through one flavorful roll instead of a fixed single payload.</p>"
    ].join("");
}

function buildRitualStepRollTableDoc(table, folderId, folderHint = null) {
    const normalized = normalizeSourceEntry(table, "ritualStepRollTable", "RollTable");
    const entries = Array.isArray(normalized.entries) ? normalized.entries : [];
    const tableFormula = `1d${Math.max(entries.length, 1)}`;
    const textResultType = globalThis.CONST?.TABLE_RESULT_TYPES?.TEXT ?? 0;

    const results = entries.map((entry, index) => ({
        _id: deriveFoundryIdFromText(`${normalized._id}:${entry.id ?? index}:result`),
        type: textResultType,
        text: entry.stepText ?? `Ritual step ${index + 1}`,
        img: "icons/svg/d20-grey.svg",
        weight: 1,
        range: [index + 1, index + 1],
        drawn: false,
        flags: {
            [SOURCE_FLAG_SCOPE]: {
                ritualStepEntry: foundry.utils.deepClone(entry)
            }
        }
    }));

    return {
        _id: normalized._id,
        name: normalized.name,
        description: buildRitualStepRollTableDescription(normalized),
        results,
        formula: tableFormula,
        replacement: false,
        displayRoll: true,
        folder: folderId ?? null,
        flags: {
            [SOURCE_FLAG_SCOPE]: {
                sourceKey: String(table?.id ?? table?.name ?? "").trim(),
                folderHint: folderHint ?? normalized.folder ?? null,
                sourceData: normalized,
                complexity: normalized.complexity ?? "",
                drawFormula: normalized.drawFormula ?? "",
                drawMode: normalized.drawMode ?? "distinct"
            }
        },
        ownership: { default: 0 }
    };
}

function buildSpellFailureRollTableDoc(table, folderId, folderHint = null) {
    const normalized = normalizeSourceEntry(table, "spellFailureRollTable", "RollTable");
    const entries = Array.isArray(normalized.entries) ? normalized.entries : [];
    // 3d6 bell-curve: 16 outcomes (3-18), distributed equally across entries.
    // For N entries, each gets ceil(16/N) values (last may overflow; clamped below).
    const tableFormula = "3d6";
    const textResultType = globalThis.CONST?.TABLE_RESULT_TYPES?.TEXT ?? 0;
    const total = Math.max(entries.length, 1);
    const rangeWidth = Math.max(1, Math.floor(16 / total));

    const results = entries.map((entry, index) => {
        let min = 3 + index * rangeWidth;
        let max = (index === entries.length - 1) ? 18 : (min + rangeWidth - 1);
        if (min > 18) min = 18;
        if (max > 18) max = 18;
        return {
            _id: deriveFoundryIdFromText(`${normalized._id}:${entry.id ?? index}:result`),
            type: textResultType,
            text: entry.resultText ?? `Failure result ${index + 1}`,
            img: "icons/svg/skull.svg",
            weight: 1,
            range: [min, max],
            drawn: false,
            flags: {
                [SOURCE_FLAG_SCOPE]: {
                    spellFailureEntry: foundry.utils.deepClone(entry)
                }
            }
        };
    });

    return {
        _id: normalized._id,
        name: normalized.name,
        description: buildSpellFailureRollTableDescription(normalized),
        results,
        formula: tableFormula,
        replacement: true,
        displayRoll: true,
        folder: folderId ?? null,
        flags: {
            [SOURCE_FLAG_SCOPE]: {
                sourceKey: String(table?.id ?? table?.name ?? "").trim(),
                folderHint: folderHint ?? normalized.folder ?? null,
                sourceData: normalized,
                severity: normalized.severity ?? ""
            }
        },
        ownership: { default: 0 }
    };
}

function buildSpellSupportRollTableDoc(table, folderId, folderHint = null) {
    const normalized = normalizeSourceEntry(table, "spellSupportRollTable", "RollTable");
    const entries = Array.isArray(normalized.entries) ? normalized.entries : [];
    // 3d6 bell-curve: 16 outcomes (3-18), distributed equally across entries.
    const tableFormula = "3d6";
    const textResultType = globalThis.CONST?.TABLE_RESULT_TYPES?.TEXT ?? 0;
    const total = Math.max(entries.length, 1);
    const rangeWidth = Math.max(1, Math.floor(16 / total));

    const results = entries.map((entry, index) => {
        let min = 3 + index * rangeWidth;
        let max = (index === entries.length - 1) ? 18 : (min + rangeWidth - 1);
        if (min > 18) min = 18;
        if (max > 18) max = 18;
        return {
            _id: deriveFoundryIdFromText(`${normalized._id}:${entry.id ?? index}:result`),
            type: textResultType,
            text: entry.resultText ?? `Support result ${index + 1}`,
            img: "icons/magic/holy/angel-winged-humanoid-blue.webp",
            weight: 1,
            range: [min, max],
            drawn: false,
            flags: {
                [SOURCE_FLAG_SCOPE]: {
                    spellSupportEntry: foundry.utils.deepClone(entry)
                }
            }
        };
    });

    return {
        _id: normalized._id,
        name: normalized.name,
        description: buildSpellSupportRollTableDescription(normalized),
        results,
        formula: tableFormula,
        replacement: true,
        displayRoll: true,
        folder: folderId ?? null,
        flags: {
            [SOURCE_FLAG_SCOPE]: {
                sourceKey: String(table?.id ?? table?.name ?? "").trim(),
                folderHint: folderHint ?? normalized.folder ?? null,
                sourceData: normalized,
                family: normalized.family ?? ""
            }
        },
        ownership: { default: 0 }
    };
}

function buildPactRollTableDoc(pact, folderId, folderHint = null) {
    const entries = Array.isArray(pact.rollTable) ? pact.rollTable : [];
    if (!entries.length) return null;
    const formula = String(pact.rollTableFormula ?? `1d${entries.length}`);
    const formulaMatch = formula.match(/^(\d+)d\d+/i);
    const startValue = formulaMatch ? Number(formulaMatch[1]) : 1;
    const textResultType = globalThis.CONST?.TABLE_RESULT_TYPES?.TEXT ?? 0;
    const tableId = deriveFoundryIdFromText(`${pact._id}:rolltable`);
    const tableName = `${pact.name} — ${pact.rollTableTitle ?? "Table"}`;

    const results = entries.map((entry, index) => {
        const rollValue = startValue + index;
        return {
            _id: deriveFoundryIdFromText(`${tableId}:${rollValue}:result`),
            type: textResultType,
            text: String(entry),
            img: "icons/svg/d20-grey.svg",
            weight: 1,
            range: [rollValue, rollValue],
            drawn: false,
            flags: {
                [SOURCE_FLAG_SCOPE]: {
                    pactRollEntry: { index, rollValue, text: String(entry) }
                }
            }
        };
    });

    return {
        _id: tableId,
        name: tableName,
        description: `${pact.rollTableTitle ?? "Roll table"} for ${pact.name}. Roll ${formula}.`,
        results,
        formula,
        replacement: true,
        displayRoll: true,
        folder: folderId ?? null,
        flags: {
            [SOURCE_FLAG_SCOPE]: {
                sourceKey: pact._id,
                folderHint: folderHint ?? "Pact Tables",
                sourcePactId: pact._id,
                sourcePactName: pact.name,
                drawFormula: formula
            }
        },
        ownership: { default: 0 }
    };
}

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
        MarkEffects: Array.isArray(mark.markEffects) ? foundry.utils.deepClone(mark.markEffects) : [],
        GrantedSpells: Array.isArray(mark.grantedSpells) ? foundry.utils.deepClone(mark.grantedSpells) : []
    };
}

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
        BoonEffects: Array.isArray(pact.boonEffects) ? foundry.utils.deepClone(pact.boonEffects) : [],
        PriceEffects: Array.isArray(pact.priceEffects) ? foundry.utils.deepClone(pact.priceEffects) : [],
        StrainEffects: Array.isArray(pact.strainEffects) ? foundry.utils.deepClone(pact.strainEffects) : [],
        BrokenEffects: Array.isArray(pact.brokenEffects) ? foundry.utils.deepClone(pact.brokenEffects) : []
    };
}

// Mirrors the disease mapping in scripts/build/build-packs.mjs so seeded world
// diseases match the compendium docs. Select fields store the sanitized option
// key (no spaces/punctuation); text fields store as-is.
function buildDiseaseProps(d) {
    const k = (v) => String(v ?? "").replace(/[^A-Za-z0-9]/g, "");
    return {
        Description: d.description ?? "",
        DiseaseCause: k(d.cause ?? "Humour"),
        AssociatedHumour: k(d.associatedHumour ?? "None"),
        ContagionStat: k(d.contagionStat ?? "Stamina"),
        ContagionDifficulty: d.contagionDifficulty ?? "3d6",
        ImmunityRule: k(d.immunityRule ?? "None"),
        ResistanceRule: k(d.resistanceRule ?? "None"),
        ResistanceValue: d.resistanceValue ?? "",
        Phases: Array.isArray(d.phases) ? d.phases.map((p) => ({
            Phase: k(p.phase),
            Duration: p.duration ?? "",
            Condition: k(p.condition ?? "None"),
            Effect: p.effect ?? ""
        })) : [],
        CureBoard: Array.isArray(d.cureBoard) ? d.cureBoard.map((c) => ({
            Phase: k(c.phase),
            Role: k(c.role),
            Action: c.action ?? "",
            Skill: k(c.skill),
            Difficulty: c.difficulty ?? "",
            Icon: c.icon ?? "",
            Tooltip: c.tooltip ?? ""
        })) : [],
        ResolutionText: d.resolutionText ?? "",
        Prevention: d.prevention ?? "",
        Diagnosis: d.diagnosis ?? "",
        Cure: d.cure ?? "",
        ConvalescenceNotes: d.convalescence ?? "",
        CurrentPhase: k(d.currentPhase ?? "Incubation"),
        PhaseDaysElapsed: Number(d.phaseDaysElapsed ?? 0),
        CureBoxesFilled: d.cureBoxesFilled ?? ""
    };
}

function buildBoostRollTableDoc(table, folderId, folderHint = null) {
    const normalized = normalizeSourceEntry(table, "boostRollTable", "RollTable");
    const entries = Array.isArray(normalized.entries) ? normalized.entries : [];
    // Treat entry.roll as the d-result range (3d6 → roll in 3..18). Use entry.roll for both min and max.
    const documentResultType = globalThis.CONST?.TABLE_RESULT_TYPES?.DOCUMENT ?? 1;

    const results = entries.map((entry, index) => ({
        _id: deriveFoundryIdFromText(`${normalized._id}:${entry.roll ?? index}:result`),
        type: documentResultType,
        documentCollection: "Item",
        documentId: entry.boostId,
        text: entry.label ?? `Boost ${index + 1}`,
        img: "icons/svg/upgrade.svg",
        weight: 1,
        range: [entry.roll ?? (index + 1), entry.roll ?? (index + 1)],
        drawn: false,
        flags: {
            [SOURCE_FLAG_SCOPE]: {
                boostEntry: foundry.utils.deepClone(entry)
            }
        }
    }));

    return {
        _id: normalized._id,
        name: normalized.name,
        description: `Roll ${normalized.drawFormula ?? "3d6"} on the standard boost table.`,
        results,
        formula: normalized.drawFormula ?? "3d6",
        replacement: true,
        displayRoll: true,
        folder: folderId ?? null,
        flags: {
            [SOURCE_FLAG_SCOPE]: {
                sourceKey: String(table?.id ?? table?.name ?? "").trim(),
                folderHint: folderHint ?? normalized.folder ?? null,
                sourceData: normalized,
                drawFormula: normalized.drawFormula ?? "3d6"
            }
        },
        ownership: { default: 0 }
    };
}

function inferManeuverEffectFamily(maneuver) {
    const tags = new Set(maneuver.tags ?? []);
    if (maneuver.name === "Overwatch") return "prepared-effect";
    if (maneuver.name === "Suppressing Fire") return "battlefield-effect";
    if (tags.has("persistent")) return "prepared-effect";
    if (tags.has("safe-attack")) return "safe-attack";
    if (tags.has("movement")) return "movement";
    if (tags.has("control")) return "control";
    if (tags.has("condition")) return "condition";
    if (tags.has("utility")) return "utility";
    return tags.has("attack-modifier") ? "attack-modifier" : "utility";
}

function inferManeuverPersistentEffectType(maneuver) {
    if (maneuver.name === "Aim") return "aimed";
    if (maneuver.name === "Brace" || maneuver.name === "Brace Firearm") return "braced";
    if (maneuver.name === "Overwatch") return "overwatch";
    if (maneuver.name === "Lock") return "locked";
    if (maneuver.name === "Choke") return "choking-hold";
    return "";
}

function inferManeuverBattlefieldEffectType(maneuver) {
    if (maneuver.name === "Suppressing Fire") return "suppressing-fire";
    return "";
}

function inferManeuverTargetType(maneuver) {
    const effectData = maneuver.effectData ?? {};
    if (effectData.area) return "area";
    if (effectData.target === "visible-ally") return "ally";
    if (effectData.target === "self") return "self";
    if (effectData.target && String(effectData.target).includes("ally")) return "ally";
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
    if (Array.isArray(requirements.requiredWeaponTraits) && requirements.requiredWeaponTraits.length > 0) {
        requiredTagParts.push(...requirements.requiredWeaponTraits);
    }
    if (Array.isArray(requirements.requiredWeaponGroups) && requirements.requiredWeaponGroups.length > 0) {
        requiredTagParts.push(...requirements.requiredWeaponGroups);
    }
    if (Array.isArray(requirements.requiredWeaponTags) && requirements.requiredWeaponTags.length > 0) {
        requiredTagParts.push(...requirements.requiredWeaponTags);
    } else if (requirements.requiredWeaponTags) {
        requiredTagParts.push(requirements.requiredWeaponTags);
    }
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
        Description: maneuver.description ?? "",
        Usage: maneuver.type ?? "pre",
        Trigger: maneuver.triggerType ?? "attack-declared",
        CostType: maneuver.CostType ?? "null",
        CostAmount: maneuver.CostAmount ?? 0,
        TargetType: inferManeuverTargetType(maneuver),
        RollType: inferManeuverRollType(maneuver)
    };
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

function makeItemDoc(source, template, img, propsBuilder, folderId, folderHint = null) {
    return {
        _id: source._id,
        name: source.name,
        // Instance items always use CSB's single user-facing item type
        // "equippableItem", NOT the template's own document type
        // ("_equippableItemTemplate", the schema marker). The CSB
        // template choice is carried by system.template, not by
        // Foundry's `type` field.
        //
        // Cannot fall back to `source.type` here because some source
        // datasets (notably maneuvers) overload `type` to mean timing
        // ("pre" / "reaction" / "post" / "full-turn") rather than a
        // Foundry document type. That meaning is preserved inside
        // system.props by the per-kind propsBuilder.
        type: "equippableItem",
        img,
        system: {
            ...cloneTemplateSystem(template),
            props: propsBuilder(source)
        },
        effects: [],
        folder: folderId ?? null,
        flags: {
            "custom-system-builder": {
                version: template.flags?.["custom-system-builder"]?.version ?? "5.2.0"
            },
            [SOURCE_FLAG_SCOPE]: {
                folderHint: folderHint ?? source.folder ?? null,
                sourceData: source
            }
        },
        items: [],
        ownership: { default: 0 }
    };
}

function makeActorDoc(source, folderId, folderHint = null, actorTemplate = null) {
    const mergedSystem = actorTemplate?.system
        ? foundry.utils.mergeObject(
            foundry.utils.deepClone(actorTemplate.system),
            foundry.utils.deepClone(source.system ?? {}),
            { inplace: false, recursive: true }
        )
        : foundry.utils.deepClone(source.system ?? {});
    const mergedPrototypeToken = actorTemplate?.prototypeToken
        ? foundry.utils.mergeObject(
            foundry.utils.deepClone(actorTemplate.prototypeToken ?? {}),
            foundry.utils.deepClone(source.prototypeToken ?? {}),
            { inplace: false, recursive: true }
        )
        : foundry.utils.deepClone(source.prototypeToken ?? {});

    return {
        _id: source._id,
        name: source.name,
        type: source.type ?? "character",
        img: source.img ?? "icons/svg/mystery-man.svg",
        system: mergedSystem,
        prototypeToken: mergedPrototypeToken,
        effects: foundry.utils.deepClone(source.effects ?? []),
        folder: folderId ?? null,
        flags: {
            ...(foundry.utils.deepClone(source.flags ?? {})),
            [SOURCE_FLAG_SCOPE]: {
                folderHint: folderHint ?? source.folder ?? null,
                sourceData: source
            }
        },
        items: foundry.utils.deepClone(source.items ?? []),
        ownership: foundry.utils.deepClone(source.ownership ?? { default: 0 })
    };
}

function makeTemplateDoc(template) {
    return {
        _id: template._id,
        name: template.name,
        type: template.type,
        img: template.img,
        system: foundry.utils.deepClone(template.system),
        effects: foundry.utils.deepClone(template.effects ?? []),
        folder: template.folder ?? null,
        flags: foundry.utils.deepClone(template.flags ?? {}),
        items: foundry.utils.deepClone(template.items ?? []),
        ownership: foundry.utils.deepClone(template.ownership ?? { default: 0 })
    };
}

async function upsertWorldItems(docs) {
    const sourceIds = new Set(docs.map((doc) => doc._id));
    const existingById = new Map(
        game.items.filter((item) => sourceIds.has(item.id)).map((item) => [item.id, item])
    );

    const toCreate = [];
    const toUpdate = [];

    for (const doc of docs) {
        const existing = existingById.get(doc._id);
        if (existing) {
            toUpdate.push({
                ...doc,
                _id: existing.id
            });
        } else {
            toCreate.push(doc);
        }
    }

    if (toCreate.length > 0) {
        // keepId:true → honour the explicit `_id` from source data. Without it
        // Foundry drops the _id and assigns a random one, so each Setup Data
        // run creates a duplicate instead of matching/updating the prior doc.
        await Item.createDocuments(toCreate, { keepId: true });
    }

    if (toUpdate.length > 0) {
        // recursive:false → Foundry force-replaces `system` instead of
        // recursive-merging it. Required when an item's CSB template
        // differs between the source data and the existing world item
        // (Foundry sees that as a type change and refuses a merge).
        await Item.updateDocuments(toUpdate, { recursive: false });
    }

    return {
        created: toCreate.length,
        updated: toUpdate.length
    };
}

async function upsertWorldActors(docs) {
    const sourceIds = new Set(docs.map((doc) => doc._id));
    const existingById = new Map(
        game.actors.filter((actor) => sourceIds.has(actor.id)).map((actor) => [actor.id, actor])
    );

    const toCreate = [];
    const toUpdate = [];

    for (const doc of docs) {
        const existing = existingById.get(doc._id);
        if (existing) {
            toUpdate.push({
                ...doc,
                _id: existing.id
            });
        } else {
            toCreate.push(doc);
        }
    }

    if (toCreate.length > 0) {
        await Actor.createDocuments(toCreate, { keepId: true });
    }

    if (toUpdate.length > 0) {
        // recursive:false — see comment in upsertWorldItems above.
        await Actor.updateDocuments(toUpdate, { recursive: false });
    }

    return {
        created: toCreate.length,
        updated: toUpdate.length
    };
}

async function upsertWorldRollTables(docs) {
    const sourceIds = new Set(docs.map((doc) => doc._id));
    const existingById = new Map(
        game.tables.filter((table) => sourceIds.has(table.id)).map((table) => [table.id, table])
    );

    const toCreate = [];
    const toUpdate = [];

    for (const doc of docs) {
        const existing = existingById.get(doc._id);
        if (existing) {
            toUpdate.push({
                ...doc,
                _id: existing.id
            });
        } else {
            toCreate.push(doc);
        }
    }

    if (toCreate.length > 0) {
        await RollTable.createDocuments(toCreate, { keepId: true });
    }

    if (toUpdate.length > 0) {
        await RollTable.updateDocuments(toUpdate, { recursive: false });
    }

    return {
        created: toCreate.length,
        updated: toUpdate.length
    };
}

// Names of CSB templates this module used to ship but no longer does. Orphan
// docs left over in upgraded worlds are deleted by pruneDuplicateTemplates.
const OBSOLETE_TEMPLATE_NAMES = new Set([
    "RecipeTemplate",
    "PowerTemplate",
]);

// Delete CSB template items that aren't the canonical doc: duplicates from
// pre-{keepId:true} runs (same name, random _id) and orphans for templates
// removed from source (e.g. RecipeTemplate). Conservative — only matches on
// known template names so unrelated user content is untouched.
async function pruneDuplicateTemplates(canonicalDocs) {
    const canonicalIds = new Set(canonicalDocs.map((doc) => doc._id));
    const canonicalNames = new Set(canonicalDocs.map((doc) => doc.name));
    const staleIds = game.items
        .filter((item) => String(item.type ?? "").endsWith("Template"))
        .filter((item) => {
            const name = String(item.name ?? "");
            if (OBSOLETE_TEMPLATE_NAMES.has(name)) return true;
            return canonicalNames.has(name) && !canonicalIds.has(item.id);
        })
        .map((item) => item.id);

    if (staleIds.length > 0) {
        await Item.deleteDocuments(staleIds);
    }

    return { removed: staleIds.length };
}

// CSB stores `system.body`/header/display/hidden on each instance item, cloned
// from the template at creation. Updating the template doc on Setup Data does
// NOT propagate to actor-owned items, so existing actors keep the old sheet
// shape forever. Walk all actors and refresh those parts of system from the
// canonical templates, preserving props/modifiers/flags/template-id.
async function refreshActorItemBodiesFromTemplates(templateDocs, actors = game.actors) {
    const templatesById = new Map(templateDocs.map((doc) => [doc._id, doc]));
    let refreshedItems = 0;
    let touchedActors = 0;

    for (const actor of actors ?? []) {
        const items = actor?.items?.contents ?? Array.from(actor?.items ?? []);
        const updates = [];
        for (const item of items) {
            const tpl = templatesById.get(item?.system?.template);
            if (!tpl?.system) continue;

            const sameBody = JSON.stringify(item.system?.body) === JSON.stringify(tpl.system.body);
            const sameHeader = JSON.stringify(item.system?.header) === JSON.stringify(tpl.system.header);
            const sameDisplay = JSON.stringify(item.system?.display) === JSON.stringify(tpl.system.display);
            const sameHidden = JSON.stringify(item.system?.hidden ?? []) === JSON.stringify(tpl.system.hidden ?? []);
            const sameVersion = item.system?.templateSystemUniqueVersion === tpl.system.templateSystemUniqueVersion;
            if (sameBody && sameHeader && sameDisplay && sameHidden && sameVersion) continue;

            const data = item.toObject();
            data.system.body = foundry.utils.deepClone(tpl.system.body);
            data.system.header = foundry.utils.deepClone(tpl.system.header);
            data.system.display = foundry.utils.deepClone(tpl.system.display);
            data.system.hidden = foundry.utils.deepClone(tpl.system.hidden ?? []);
            data.system.templateSystemUniqueVersion = tpl.system.templateSystemUniqueVersion;
            updates.push(data);
        }
        if (updates.length && actor?.updateEmbeddedDocuments) {
            await actor.updateEmbeddedDocuments("Item", updates, { recursive: false });
            refreshedItems += updates.length;
            touchedActors += 1;
        }
    }

    return { refreshedItems, touchedActors };
}

async function pruneManagedFolderItems({ folderId, validIds, templateId, folderHint }) {
    if (!folderId || !(validIds instanceof Set)) {
        return { removed: 0 };
    }

    const staleIds = game.items
        .filter((item) => item.folder?.id === folderId)
        .filter((item) => {
            const sourceFlag = item.flags?.[SOURCE_FLAG_SCOPE] ?? {};
            const itemFolderHint = sourceFlag.folderHint ?? sourceFlag.sourceData?.folder ?? null;
            const usesManagedTemplate = item.system?.template === templateId;
            const isManaged = itemFolderHint === folderHint || usesManagedTemplate;
            return isManaged && !validIds.has(item.id);
        })
        .map((item) => item.id);

    if (staleIds.length > 0) {
        await Item.deleteDocuments(staleIds);
    }

    return { removed: staleIds.length };
}

async function pruneManagedFolderActors({ folderId, validIds, folderHint }) {
    if (!folderId || !(validIds instanceof Set)) {
        return { removed: 0 };
    }

    const staleIds = game.actors
        .filter((actor) => actor.folder?.id === folderId)
        .filter((actor) => {
            const sourceFlag = actor.flags?.[SOURCE_FLAG_SCOPE] ?? {};
            const actorFolderHint = sourceFlag.folderHint ?? sourceFlag.sourceData?.folder ?? null;
            return actorFolderHint === folderHint && !validIds.has(actor.id);
        })
        .map((actor) => actor.id);

    if (staleIds.length > 0) {
        await Actor.deleteDocuments(staleIds);
    }

    return { removed: staleIds.length };
}

async function pruneManagedFolderRollTables({ folderId, validIds, folderHint }) {
    if (!folderId || !(validIds instanceof Set)) {
        return { removed: 0 };
    }

    const staleIds = game.tables
        .filter((table) => table.folder?.id === folderId)
        .filter((table) => {
            const sourceFlag = table.flags?.[SOURCE_FLAG_SCOPE] ?? {};
            const tableFolderHint = sourceFlag.folderHint ?? sourceFlag.sourceData?.folder ?? null;
            return tableFolderHint === folderHint && !validIds.has(table.id);
        })
        .map((table) => table.id);

    if (staleIds.length > 0) {
        await RollTable.deleteDocuments(staleIds);
    }

    return { removed: staleIds.length };
}

export function register1547ModuleSettings() {
    game.settings.register(MODULE_ID, "maneuverData", {
        name: "Maneuver Data",
        scope: "world",
        config: false,
        type: Object,
        default: []
    });

    game.settings.register(MODULE_ID, "weaponData", {
        name: "Weapon Data",
        scope: "world",
        config: false,
        type: Object,
        default: []
    });

    game.settings.register(MODULE_ID, "armorData", {
        name: "Armor Data",
        scope: "world",
        config: false,
        type: Object,
        default: []
    });

    game.settings.register(MODULE_ID, "ammoData", {
        name: "Ammunition Data",
        scope: "world",
        config: false,
        type: Object,
        default: []
    });

    game.settings.register(MODULE_ID, "weaponModifierData", {
        name: "Weapon Modifier Data",
        scope: "world",
        config: false,
        type: Object,
        default: []
    });

    game.settings.register(MODULE_ID, "spellData", {
        name: "Spell Data",
        scope: "world",
        config: false,
        type: Object,
        default: []
    });

    game.settings.register(MODULE_ID, "ritualStepRollTableData", {
        name: "Ritual Step Roll Table Data",
        scope: "world",
        config: false,
        type: Object,
        default: []
    });

    game.settings.register(MODULE_ID, "spellFailureRollTableData", {
        name: "Spell Failure Roll Table Data",
        scope: "world",
        config: false,
        type: Object,
        default: []
    });

    game.settings.register(MODULE_ID, "spellSupportRollTableData", {
        name: "Spell Support Roll Table Data",
        scope: "world",
        config: false,
        type: Object,
        default: []
    });

    game.settings.register(MODULE_ID, "boostRollTableData", {
        name: "Boost Roll Table Data",
        scope: "world",
        config: false,
        type: Object,
        default: []
    });

    game.settings.register(MODULE_ID, "pactData", {
        name: "Pact Data",
        scope: "world",
        config: false,
        type: Object,
        default: []
    });

    game.settings.register(MODULE_ID, "portraitRegistry", {
        name: "Portrait Registry",
        scope: "world",
        config: false,
        type: Object,
        default: {}
    });

    game.settings.register(MODULE_ID, "supernaturalMarkData", {
        name: "Supernatural Mark Data",
        scope: "world",
        config: false,
        type: Object,
        default: []
    });

    game.settings.register(MODULE_ID, "monsterData", {
        name: "Monster Data",
        scope: "world",
        config: false,
        type: Object,
        default: []
    });

    game.settings.register(MODULE_ID, "monsterMagicData", {
        name: "Monster Magic Data",
        scope: "world",
        config: false,
        type: Object,
        default: []
    });

    game.settings.register(MODULE_ID, "changeSetData", {
        name: "Change Set Data",
        scope: "world",
        config: false,
        type: Object,
        default: []
    });

    game.settings.register(MODULE_ID, "changeData", {
        name: "Change Data",
        scope: "world",
        config: false,
        type: Object,
        default: []
    });

    game.settings.register(MODULE_ID, "requirementData", {
        name: "Requirement Data",
        scope: "world",
        config: false,
        type: Object,
        default: []
    });

    game.settings.register(MODULE_ID, "lastDataSetupAt", {
        name: "Last Data Setup",
        scope: "world",
        config: false,
        type: String,
        default: ""
    });

    game.settings.register(MODULE_ID, "reachMigrationVersion", {
        name: "Reach Migration Version",
        scope: "world",
        config: false,
        type: Number,
        default: 0
    });

    game.settings.register(MODULE_ID, "reactionWindowSeconds", {
        name: "Reaction Window Seconds",
        hint: "How many seconds a reaction window stays open before it automatically passes.",
        scope: "world",
        config: true,
        type: Number,
        range: {
            min: 0,
            max: 30,
            step: 1
        },
        default: 10
    });

    game.settings.register(MODULE_ID, "showSideReadyConfirmation", {
        name: "Show Side Ready Confirmation",
        hint: "Show a confirmation dialog before Side Ready ends the turn for the whole active side.",
        scope: "client",
        config: true,
        type: Boolean,
        default: true
    });

    game.settings.register(MODULE_ID, "boostRollTableUuid", {
        name: "Boost Roll Table UUID",
        hint: "Foundry UUID of the Roll Table used to randomly pick boost ChangeSets when a monster's Boost button is pressed. Example: RollTable.abc1234567890def or worlds/<world>/<id>.",
        scope: "world",
        config: true,
        type: String,
        default: ""
    });

    const moduleSetupFormType = createModuleSetupFormApplicationClass();
    if (moduleSetupFormType) {
        game.settings.registerMenu(MODULE_ID, "moduleSetup", {
            name: "1547 Core Setup",
            label: "Open Setup",
            hint: "Open the 1547 Core setup dialog and load module data into this world.",
            icon: "fas fa-gears",
            type: moduleSetupFormType,
            restricted: true
        });
    } else {
        console.warn(`${MODULE_ID} | Module setup menu unavailable because FormApplication is not defined on this Foundry runtime.`);
    }
}

function createModuleSetupFormApplicationClass() {
    const BaseFormApplication = globalThis.FormApplication;
    if (typeof BaseFormApplication !== "function") {
        return null;
    }

    return class ModuleSetupFormApplication extends BaseFormApplication {
        static get defaultOptions() {
            return foundry.utils.mergeObject(super.defaultOptions, {
                id: `${MODULE_ID}-module-setup`,
                title: "1547 Core Setup",
                template: `${getModuleBasePath()}/templates/module-setup.hbs`,
                width: 520,
                height: "auto",
                closeOnSubmit: false,
                submitOnChange: false,
                submitOnClose: false
            });
        }

        async getData() {
            const storedManeuvers = game.settings.get(MODULE_ID, "maneuverData") ?? [];
            const storedWeapons = game.settings.get(MODULE_ID, "weaponData") ?? [];
            const storedArmors = game.settings.get(MODULE_ID, "armorData") ?? [];
            const storedAmmunition = game.settings.get(MODULE_ID, "ammoData") ?? [];
            const storedWeaponModifiers = game.settings.get(MODULE_ID, "weaponModifierData") ?? [];
            const storedSpells = game.settings.get(MODULE_ID, "spellData") ?? [];
            const storedRitualStepRollTables = game.settings.get(MODULE_ID, "ritualStepRollTableData") ?? [];
            const storedSpellFailureRollTables = game.settings.get(MODULE_ID, "spellFailureRollTableData") ?? [];
            const storedSpellSupportRollTables = game.settings.get(MODULE_ID, "spellSupportRollTableData") ?? [];
            const storedBoostRollTables = game.settings.get(MODULE_ID, "boostRollTableData") ?? [];
            const storedPacts = game.settings.get(MODULE_ID, "pactData") ?? [];
            const storedSupernaturalMarks = game.settings.get(MODULE_ID, "supernaturalMarkData") ?? [];
            const storedMonsters = game.settings.get(MODULE_ID, "monsterData") ?? [];
            const storedChangeSets = game.settings.get(MODULE_ID, "changeSetData") ?? [];
            const storedChanges = game.settings.get(MODULE_ID, "changeData") ?? [];
            const storedRequirements = game.settings.get(MODULE_ID, "requirementData") ?? [];
            const lastDataSetupAt = game.settings.get(MODULE_ID, "lastDataSetupAt") || "";

            return {
                moduleVersion: game.modules.get(MODULE_ID)?.version ?? "unknown",
                storedManeuverCount: Array.isArray(storedManeuvers) ? storedManeuvers.length : 0,
                storedWeaponCount: Array.isArray(storedWeapons) ? storedWeapons.length : 0,
                storedArmorCount: Array.isArray(storedArmors) ? storedArmors.length : 0,
                storedAmmoCount: Array.isArray(storedAmmunition) ? storedAmmunition.length : 0,
                storedWeaponModifierCount: Array.isArray(storedWeaponModifiers) ? storedWeaponModifiers.length : 0,
                storedSpellCount: Array.isArray(storedSpells) ? storedSpells.length : 0,
                storedRitualStepRollTableCount: Array.isArray(storedRitualStepRollTables) ? storedRitualStepRollTables.length : 0,
                storedSpellFailureRollTableCount: Array.isArray(storedSpellFailureRollTables) ? storedSpellFailureRollTables.length : 0,
                storedSpellSupportRollTableCount: Array.isArray(storedSpellSupportRollTables) ? storedSpellSupportRollTables.length : 0,
                storedBoostRollTableCount: Array.isArray(storedBoostRollTables) ? storedBoostRollTables.length : 0,
                storedPactCount: Array.isArray(storedPacts) ? storedPacts.length : 0,
                storedSupernaturalMarkCount: Array.isArray(storedSupernaturalMarks) ? storedSupernaturalMarks.length : 0,
                storedMonsterCount: Array.isArray(storedMonsters) ? storedMonsters.length : 0,
                storedChangeSetCount: Array.isArray(storedChangeSets) ? storedChangeSets.length : 0,
                storedChangeCount: Array.isArray(storedChanges) ? storedChanges.length : 0,
                storedRequirementCount: Array.isArray(storedRequirements) ? storedRequirements.length : 0,
                lastDataSetupAt
            };
        }

        activateListeners(html) {
            super.activateListeners(html);

            html.find("[data-action='setup-data']").on("click", async (event) => {
                event.preventDefault();
                const button = event.currentTarget;
                const originalText = button?.textContent ?? "";
                if (button) {
                    button.disabled = true;
                    button.textContent = "Setting up… (this can take a minute)";
                    button.style.opacity = "0.7";
                    button.style.cursor = "wait";
                }
                ui.notifications.info("1547 Core: setup started — loading datasets, building items, upserting documents…");
                try {
                    await this.#setupData();
                } finally {
                    if (button) {
                        button.disabled = false;
                        button.textContent = originalText;
                        button.style.opacity = "";
                        button.style.cursor = "";
                    }
                }
            });

            html.find("[data-action='run-diagnostics']").on("click", async (event) => {
                event.preventDefault();
                await this.#runDiagnostics();
            });
        }

        async _updateObject() {
            return;
        }

        async #setupData() {
            try {
                const {
                    maneuvers,
                    weapons,
                    armors,
                    ammunition,
                    weaponModifiers,
                    spells,
                    ritualStepRollTables,
                    spellFailureRollTables,
                    spellSupportRollTables,
                    boostRollTables,
                    monsters,
                    monsterMagic,
                    changeSets,
                    changes,
                    requirements,
                    pacts,
                    supernaturalMarks,
                    diseases
                } = await this.#loadSourceBackedData();

                await this.#importItemsFromData({
                    maneuvers,
                    weapons,
                    armors,
                    ammunition,
                    weaponModifiers,
                    spells,
                    ritualStepRollTables,
                    spellFailureRollTables,
                    spellSupportRollTables,
                    boostRollTables,
                    monsters,
                    monsterMagic,
                    changeSets,
                    changes,
                    requirements,
                    pacts,
                    supernaturalMarks,
                    diseases
                });

                ui.notifications.info(
                `1547 Core: stored and synced ${maneuvers.length} maneuvers, ${weapons.length} weapons, ${armors.length} armors, ${ammunition.length} ammunition items, ${weaponModifiers.length} weapon modifiers, ${spells.length} spells, ${ritualStepRollTables.length} ritual step roll tables, ${spellFailureRollTables.length} spell failure roll tables, ${spellSupportRollTables.length} spell support roll tables, ${boostRollTables.length} boost roll tables, ${pacts.length} pacts, ${(supernaturalMarks ?? []).length} supernatural marks, ${(diseases ?? []).length} diseases, ${monsters.length} monsters, ${changeSets.length} change sets, ${changes.length} changes, and ${requirements.length} requirements from source data.`
                );
                this.render(false);
            } catch (error) {
                console.error(`${MODULE_ID} | Failed to setup data`, error);
                ui.notifications.error(`1547 Core: failed to setup data. ${error.message}`);
            }
        }

        async #runDiagnostics() {
            try {
                const api = game.modules.get(MODULE_ID)?.api;
                const report = typeof api?.diagnostics === "function"
                    ? api.diagnostics()
                    : { error: "Diagnostics API is unavailable; is the module fully initialised?" };
                const json = JSON.stringify(report, null, 2);
                console.log(`${MODULE_ID} | diagnostics`, report);

                let copied = false;
                try {
                    if (game.clipboard?.copyPlainText) {
                        await game.clipboard.copyPlainText(json);
                        copied = true;
                    } else if (navigator.clipboard?.writeText) {
                        await navigator.clipboard.writeText(json);
                        copied = true;
                    }
                } catch (_) {
                    copied = false;
                }

                const escaped = json.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                const content = `<p>${copied ? "Copied to clipboard and logged" : "Logged"} to the console. Select all in the box below to copy, then paste it for analysis.</p>`
                    + `<textarea readonly rows="22" style="width:100%; font-family:monospace; white-space:pre; resize:vertical;">${escaped}</textarea>`;
                new Dialog({
                    title: "1547 Core Diagnostics",
                    content,
                    buttons: { close: { icon: '<i class="fas fa-check"></i>', label: "Close" } },
                    default: "close"
                }, { width: 720 }).render(true);
            } catch (error) {
                console.error(`${MODULE_ID} | Failed to run diagnostics`, error);
                ui.notifications.error(`1547 Core: diagnostics failed. ${error.message}`);
            }
        }

        async #loadDataset(fileName) {
            const versionTag = encodeURIComponent(game.modules.get(MODULE_ID)?.version ?? Date.now());
            const response = await fetch(`${getModuleBasePath()}/foundry/Templates/${fileName}?v=${versionTag}`, { cache: "no-store" });
            if (!response.ok) {
                throw new Error(`Failed to load ${fileName} (${response.status})`);
            }

            const data = await response.json();
            if (!Array.isArray(data)) {
                throw new Error(`${fileName} did not contain an array.`);
            }

            return data;
        }

        async #loadTemplate(fileName) {
            const versionTag = encodeURIComponent(game.modules.get(MODULE_ID)?.version ?? Date.now());
            const response = await fetch(`${getModuleBasePath()}/foundry/Templates/${fileName}?v=${versionTag}`, { cache: "no-store" });
            if (!response.ok) {
                throw new Error(`Failed to load ${fileName} (${response.status})`);
            }

            return await response.json();
        }

        async #loadSourceBackedData() {
            const [maneuvers, weapons, armors, ammunition, weaponModifiers, spells, ritualStepRollTables, spellFailureRollTables, spellSupportRollTables, boostRollTables, monsters, monsterMagic, changeSets, changes, requirements, pacts, portraitRegistryFile, supernaturalMarks, diseases] = await Promise.all([
                this.#loadDataset("maneuvers.json"),
                this.#loadDataset("weapons.json"),
                this.#loadDataset("armors.json"),
                this.#loadDataset("ammunition.json"),
                this.#loadDataset("weapon-modifiers.json"),
                this.#loadDataset("spells.json"),
                this.#loadDataset("ritual-step-roll-tables.json"),
                this.#loadDataset("spell-failure-roll-tables.json"),
                this.#loadDataset("spell-support-roll-tables.json"),
                this.#loadDataset("boost-roll-tables.json"),
                this.#loadDataset("monsters.json"),
                this.#loadDataset("monster-magic.json"),
                this.#loadDataset("changesets.json"),
                this.#loadDataset("changes.json"),
                this.#loadDataset("requirements.json"),
                this.#loadDataset("pacts.json"),
                this.#loadDataset("portrait-registry.json").catch(() => ({ registry: {} })),
                this.#loadDataset("supernatural-marks.json").catch(() => []),
                this.#loadDataset("diseases.json").catch(() => [])
            ]);

            await Promise.all([
                game.settings.set(MODULE_ID, "maneuverData", maneuvers),
                game.settings.set(MODULE_ID, "weaponData", weapons),
                game.settings.set(MODULE_ID, "armorData", armors),
                game.settings.set(MODULE_ID, "ammoData", ammunition),
                game.settings.set(MODULE_ID, "weaponModifierData", weaponModifiers),
                game.settings.set(MODULE_ID, "spellData", spells),
                game.settings.set(MODULE_ID, "ritualStepRollTableData", ritualStepRollTables),
                game.settings.set(MODULE_ID, "spellFailureRollTableData", spellFailureRollTables),
                game.settings.set(MODULE_ID, "spellSupportRollTableData", spellSupportRollTables),
                game.settings.set(MODULE_ID, "boostRollTableData", boostRollTables),
                game.settings.set(MODULE_ID, "monsterData", monsters),
                game.settings.set(MODULE_ID, "monsterMagicData", monsterMagic),
                game.settings.set(MODULE_ID, "changeSetData", changeSets),
                game.settings.set(MODULE_ID, "changeData", changes),
                game.settings.set(MODULE_ID, "requirementData", requirements),
                game.settings.set(MODULE_ID, "pactData", pacts),
                game.settings.set(MODULE_ID, "portraitRegistry", (portraitRegistryFile && portraitRegistryFile.registry) || {}),
                game.settings.set(MODULE_ID, "supernaturalMarkData", supernaturalMarks ?? []),
                game.settings.set(MODULE_ID, "lastDataSetupAt", new Date().toISOString())
            ]);

            return { maneuvers, weapons, armors, ammunition, weaponModifiers, spells, ritualStepRollTables, spellFailureRollTables, spellSupportRollTables, boostRollTables, monsters, monsterMagic, changeSets, changes, requirements, pacts, supernaturalMarks: supernaturalMarks ?? [], diseases: diseases ?? [] };
        }

        /**
         * Move a root-level folder under a new parent. No-op when the
         * folder doesn't exist or is already correctly parented. Used
         * to migrate pre-0.2.4 setups whose kind folders were created
         * at the world root.
         */
        async #reparentRootFolder(folderName, type, newParentId) {
            const folder = game.folders?.find((entry) =>
                entry.type === type
                && entry.name === folderName
                && (entry.folder?.id ?? entry.folder ?? null) === null
            );
            if (!folder || !newParentId || folder.id === newParentId) return;
            await folder.update({ folder: newParentId });
        }

        async #getOrCreateFolder({ folderName, type, parentId = null, color = "#7a7a7a" }) {
            let folder = game.folders?.find((entry) =>
                entry.type === type
                && entry.name === folderName
                && (entry.folder?.id ?? entry.folder ?? null) === parentId
            );
            if (!folder) {
                folder = await Folder.create({
                    name: folderName,
                    type,
                    color,
                    folder: parentId
                });
            }

            return folder;
        }

        async #buildManagedFolderTree() {
            // Top-level namespace folders (one per document collection
            // — Foundry folders are typed and can't cross-parent).
            // Every kind-specific folder below lives inside one of these.
            const coreItemFolder = await this.#getOrCreateFolder({
                folderName: "1547 Core",
                type: "Item",
                color: "#445566"
            });
            const coreActorFolder = await this.#getOrCreateFolder({
                folderName: "1547 Core",
                type: "Actor",
                color: "#445566"
            });
            const coreRollTableFolder = await this.#getOrCreateFolder({
                folderName: "1547 Core",
                type: "RollTable",
                color: "#445566"
            });

            // Migrate any pre-0.2.4 root-level kind folders into the
            // new core namespace. Idempotent: skips folders already
            // under the right parent or missing entirely.
            await this.#reparentRootFolder("Maneuvers", "Item", coreItemFolder.id);
            await this.#reparentRootFolder("Weapons", "Item", coreItemFolder.id);
            await this.#reparentRootFolder("Armor", "Item", coreItemFolder.id);
            await this.#reparentRootFolder("Ammunition", "Item", coreItemFolder.id);
            await this.#reparentRootFolder("Weapon Modifiers", "Item", coreItemFolder.id);
            await this.#reparentRootFolder("Spells", "Item", coreItemFolder.id);
            await this.#reparentRootFolder("Ritual Step Tables", "RollTable", coreRollTableFolder.id);
            await this.#reparentRootFolder("Spell Failure Tables", "RollTable", coreRollTableFolder.id);
            await this.#reparentRootFolder("Spell Support Tables", "RollTable", coreRollTableFolder.id);
            await this.#reparentRootFolder("Change Sets", "Item", coreItemFolder.id);
            await this.#reparentRootFolder("Changes", "Item", coreItemFolder.id);
            await this.#reparentRootFolder("Requirements", "Item", coreItemFolder.id);
            await this.#reparentRootFolder("Monsters", "Actor", coreActorFolder.id);

            const monstersFolder = await this.#getOrCreateFolder({ folderName: "Monsters", type: "Actor", parentId: coreActorFolder.id, color: "#516d5b" });
            const maneuverFolder = await this.#getOrCreateFolder({ folderName: "Maneuvers", type: "Item", parentId: coreItemFolder.id });
            const weaponFolder = await this.#getOrCreateFolder({ folderName: "Weapons", type: "Item", parentId: coreItemFolder.id });
            const naturalWeaponFolder = await this.#getOrCreateFolder({ folderName: "Natural Weapons", type: "Item", parentId: weaponFolder.id });
            const armorFolder = await this.#getOrCreateFolder({ folderName: "Armor", type: "Item", parentId: coreItemFolder.id });
            const naturalArmorFolder = await this.#getOrCreateFolder({ folderName: "Natural Armor", type: "Item", parentId: armorFolder.id });
            const ammoFolder = await this.#getOrCreateFolder({ folderName: "Ammunition", type: "Item", parentId: coreItemFolder.id });
            const weaponModifierFolder = await this.#getOrCreateFolder({ folderName: "Weapon Modifiers", type: "Item", parentId: coreItemFolder.id });
            const onHitEffectsFolder = await this.#getOrCreateFolder({ folderName: "On-Hit Effects", type: "Item", parentId: weaponModifierFolder.id });
            const spellsFolder = await this.#getOrCreateFolder({ folderName: "Spells", type: "Item", parentId: coreItemFolder.id });
            const ritualStepsFolder = await this.#getOrCreateFolder({ folderName: "Ritual Steps", type: "Item", parentId: spellsFolder.id });
            const pactsFolder = await this.#getOrCreateFolder({ folderName: "Pacts", type: "Item", parentId: coreItemFolder.id });
            const diseasesFolder = await this.#getOrCreateFolder({ folderName: "Diseases", type: "Item", parentId: coreItemFolder.id });
            const supernaturalMarksFolder = await this.#getOrCreateFolder({ folderName: "Supernatural Marks", type: "Item", parentId: coreItemFolder.id });
            const blessingsFolder = await this.#getOrCreateFolder({ folderName: "Blessings", type: "Item", parentId: supernaturalMarksFolder.id });
            const cursesFolder = await this.#getOrCreateFolder({ folderName: "Curses", type: "Item", parentId: supernaturalMarksFolder.id });
            const usageEffectsFolder = await this.#getOrCreateFolder({ folderName: "Usage Effects", type: "Item", parentId: coreItemFolder.id });
            const monsterMagicFolder = await this.#getOrCreateFolder({ folderName: "Monster Magic", type: "Item", parentId: coreItemFolder.id });
            const ritualStepRollTablesFolder = await this.#getOrCreateFolder({ folderName: "Ritual Step Tables", type: "RollTable", parentId: coreRollTableFolder.id, color: "#5b6276" });
            const spellFailureRollTablesFolder = await this.#getOrCreateFolder({ folderName: "Spell Failure Tables", type: "RollTable", parentId: coreRollTableFolder.id, color: "#6d5b5b" });
            const spellSupportRollTablesFolder = await this.#getOrCreateFolder({ folderName: "Spell Support Tables", type: "RollTable", parentId: coreRollTableFolder.id, color: "#5b6d63" });
            const boostRollTablesFolder = await this.#getOrCreateFolder({ folderName: "Boost Tables", type: "RollTable", parentId: coreRollTableFolder.id, color: "#6d635b" });
            const pactRollTablesFolder = await this.#getOrCreateFolder({ folderName: "Pact Tables", type: "RollTable", parentId: coreRollTableFolder.id, color: "#5b6d6d" });
            const changeSetsFolder = await this.#getOrCreateFolder({ folderName: "Change Sets", type: "Item", parentId: coreItemFolder.id, color: "#6d5b51" });
            const changesFolder = await this.#getOrCreateFolder({ folderName: "Changes", type: "Item", parentId: coreItemFolder.id, color: "#6d6551" });
            const requirementsFolder = await this.#getOrCreateFolder({ folderName: "Requirements", type: "Item", parentId: coreItemFolder.id, color: "#5b5b6d" });

            const changeSetGroupFolders = {};
            for (const groupName of CHANGE_SET_GROUPS) {
                changeSetGroupFolders[groupName] = await this.#getOrCreateFolder({
                    folderName: groupName,
                    type: "Item",
                    parentId: changeSetsFolder.id,
                    color: "#6d5b51"
                });
            }

            const changeTypeFolders = {};
            for (const [kind, label] of Object.entries(CHANGE_FOLDER_LABELS)) {
                changeTypeFolders[kind] = await this.#getOrCreateFolder({
                    folderName: label,
                    type: "Item",
                    parentId: changesFolder.id,
                    color: "#6d6551"
                });
            }

            const requirementTypeFolders = {};
            for (const [predicate, label] of Object.entries(REQUIREMENT_FOLDER_LABELS)) {
                requirementTypeFolders[predicate] = await this.#getOrCreateFolder({
                    folderName: label,
                    type: "Item",
                    parentId: requirementsFolder.id,
                    color: "#5b5b6d"
                });
            }

            return {
                coreItemFolder,
                coreActorFolder,
                coreRollTableFolder,
                monstersFolder,
                maneuverFolder,
                weaponFolder,
                naturalWeaponFolder,
                armorFolder,
                naturalArmorFolder,
                ammoFolder,
                weaponModifierFolder,
                onHitEffectsFolder,
                diseasesFolder,
                spellsFolder,
                ritualStepsFolder,
                pactsFolder,
                supernaturalMarksFolder,
                blessingsFolder,
                cursesFolder,
                usageEffectsFolder,
                monsterMagicFolder,
                ritualStepRollTablesFolder,
                spellFailureRollTablesFolder,
                spellSupportRollTablesFolder,
                boostRollTablesFolder,
                pactRollTablesFolder,
                changeSetsFolder,
                changesFolder,
                requirementsFolder,
                changeSetGroupFolders,
                changeTypeFolders,
                requirementTypeFolders
            };
        }

        async #importItemsFromData({ maneuvers, weapons, armors, ammunition, weaponModifiers, spells, ritualStepRollTables, spellFailureRollTables, spellSupportRollTables, boostRollTables, monsters, monsterMagic, changeSets, changes, requirements, pacts, supernaturalMarks, diseases }) {
            const [actorTemplate, maneuverTemplate, weaponTemplate, armorTemplate, ammoTemplate, weaponModifierTemplate, onHitEffectTemplate, supernaturalMarkTemplate, monsterMagicTemplate, spellTemplate, pactTemplate, ritualTemplate, ritualStepTemplate, usageEffectTemplate, changeSetTemplate, changeTemplate, requirementTemplate, diseaseTemplate] = await Promise.all([
                this.#loadTemplate(TEMPLATE_FILES.actorTemplate),
                this.#loadTemplate(TEMPLATE_FILES.maneuver),
                this.#loadTemplate(TEMPLATE_FILES.weapon),
                this.#loadTemplate(TEMPLATE_FILES.armor),
                this.#loadTemplate(TEMPLATE_FILES.ammo),
                this.#loadTemplate(TEMPLATE_FILES.weaponModifier),
                this.#loadTemplate(TEMPLATE_FILES.onHitEffect),
                this.#loadTemplate(TEMPLATE_FILES.supernaturalMark),
                this.#loadTemplate(TEMPLATE_FILES.monsterMagic),
                this.#loadTemplate(TEMPLATE_FILES.spell),
                this.#loadTemplate(TEMPLATE_FILES.pact),
                this.#loadTemplate(TEMPLATE_FILES.ritual),
                this.#loadTemplate(TEMPLATE_FILES.ritualStep),
                this.#loadTemplate(TEMPLATE_FILES.usageEffect),
                this.#loadTemplate(TEMPLATE_FILES.changeSet),
                this.#loadTemplate(TEMPLATE_FILES.change),
                this.#loadTemplate(TEMPLATE_FILES.requirement),
                this.#loadTemplate(TEMPLATE_FILES.disease)
            ]);

            const templateDocs = [
                makeTemplateDoc(weaponTemplate),
                makeTemplateDoc(armorTemplate),
                makeTemplateDoc(maneuverTemplate),
                makeTemplateDoc(ammoTemplate),
                makeTemplateDoc(weaponModifierTemplate),
                makeTemplateDoc(onHitEffectTemplate),
                makeTemplateDoc(supernaturalMarkTemplate),
                makeTemplateDoc(monsterMagicTemplate),
                makeTemplateDoc(spellTemplate),
                makeTemplateDoc(pactTemplate),
                makeTemplateDoc(ritualTemplate),
                makeTemplateDoc(ritualStepTemplate),
                makeTemplateDoc(usageEffectTemplate),
                makeTemplateDoc(changeSetTemplate),
                makeTemplateDoc(changeTemplate),
                makeTemplateDoc(requirementTemplate),
                makeTemplateDoc(diseaseTemplate)
            ];
            await upsertWorldItems(templateDocs);
            await pruneDuplicateTemplates(templateDocs);
            // CSB stores body/header/display on each instance; templates alone
            // don't propagate updates to existing actor-owned items.
            const bodyRefresh = await refreshActorItemBodiesFromTemplates(templateDocs);
            if (bodyRefresh.refreshedItems > 0) {
                console.log(`${MODULE_ID} | Setup Data: refreshed ${bodyRefresh.refreshedItems} actor item body/bodies across ${bodyRefresh.touchedActors} actor(s)`);
            }

            const folders = await this.#buildManagedFolderTree();

            const maneuverDocs = maneuvers.map((maneuver) =>
                makeItemDoc(normalizeSourceEntry(maneuver, "maneuver"), maneuverTemplate, maneuver.img ?? maneuverTemplate.img ?? "icons/svg/combat.svg", buildManeuverProps, folders.maneuverFolder.id, "Maneuvers")
            );
            const weaponDocs = weapons.map((weapon) => {
                const normalized = normalizeSourceEntry(weapon, "weapon");
                const isNatural = normalized.folder === "Natural Weapons";
                const folderId = isNatural ? folders.naturalWeaponFolder.id : folders.weaponFolder.id;
                const folderHint = isNatural ? "Natural Weapons" : "Weapons";
                return makeItemDoc(normalized, weaponTemplate, weapon.img ?? weaponTemplate.img ?? "icons/svg/sword.svg", buildWeaponProps, folderId, folderHint);
            });
            const armorDocs = armors.map((armor) => {
                const normalized = normalizeSourceEntry(armor, "armor");
                const isNatural = normalized.folder === "Natural Armor";
                const folderId = isNatural ? folders.naturalArmorFolder.id : folders.armorFolder.id;
                const folderHint = isNatural ? "Natural Armor" : "Armor";
                return makeItemDoc(normalized, armorTemplate, armor.img ?? armorTemplate.img ?? "icons/svg/holy-shield.svg", buildArmorProps, folderId, folderHint);
            });
            const ammoDocs = ammunition.map((ammo) =>
                makeItemDoc(normalizeSourceEntry(ammo, "ammo"), ammoTemplate, ammo.img ?? ammoTemplate.img ?? "icons/svg/item-bag.svg", buildAmmoProps, folders.ammoFolder.id, "Ammunition")
            );
            const normalizedWeaponModifiers = weaponModifiers.map((modifier) => normalizeSourceEntry(modifier, "weaponModifier"));
            const weaponModifierDocs = normalizedWeaponModifiers.map((modifier) =>
                makeItemDoc(modifier, weaponModifierTemplate, modifier.img ?? weaponModifierTemplate.img ?? "icons/svg/item-bag.svg", buildWeaponModifierProps, folders.weaponModifierFolder.id, "Weapon Modifiers")
            );
            const onHitEffectDocs = buildWorldOnHitEffectDocs(
                normalizedWeaponModifiers,
                weaponModifierDocs,
                onHitEffectTemplate,
                folders.onHitEffectsFolder.id
            );
            const normalizedSpells = spells.map((spell) => normalizeSourceEntry(spell, "spell"));
            const spellDocs = normalizedSpells.map((spell) =>
                makeItemDoc(spell, spellTemplate, spell.img ?? spellTemplate.img ?? "icons/svg/daze.svg", buildSpellProps, folders.spellsFolder.id, "Spells")
            );
            const diseaseDocs = (diseases ?? []).map((disease) => {
                const normalized = normalizeSourceEntry(disease, "disease");
                return makeItemDoc(normalized, diseaseTemplate, normalized.img ?? diseaseTemplate.img ?? "icons/svg/biohazard.svg", buildDiseaseProps, folders.diseasesFolder.id, "Diseases");
            });
            const pactDocs = (pacts ?? []).map((pact) => {
                const normalized = normalizeSourceEntry(pact, "pact");
                return makeItemDoc(normalized, pactTemplate, normalized.img ?? pactTemplate.img ?? "icons/svg/mystery-man.svg", buildPactProps, folders.pactsFolder.id, "Pacts");
            });
            const pactRollTableDocs = (pacts ?? [])
                .map((pact) => buildPactRollTableDoc(pact, folders.pactRollTablesFolder.id, "Pact Tables"))
                .filter(Boolean);
            const supernaturalMarkDocs = (supernaturalMarks ?? []).map((mark) => {
                const normalized = normalizeSourceEntry(mark, "supernaturalMark");
                const folderId = normalized.folder === "Curses" ? folders.cursesFolder.id : folders.blessingsFolder.id;
                const folderHint = normalized.folder === "Curses" ? "Curses" : "Blessings";
                return makeItemDoc(normalized, supernaturalMarkTemplate, normalized.img ?? supernaturalMarkTemplate.img ?? "icons/svg/holy-shield.svg", buildSupernaturalMarkProps, folderId, folderHint);
            });
            const spellUsageEffectDocs = buildWorldSpellUsageEffectDocs(
                normalizedSpells,
                spellDocs,
                usageEffectTemplate,
                folders.usageEffectsFolder.id
            );
            const spellRitualStepDocs = buildWorldSpellRitualStepDocs(
                normalizedSpells,
                spellDocs,
                ritualStepTemplate,
                folders.ritualStepsFolder.id
            );
            const normalizedMonsterMagic = (monsterMagic ?? []).map((m) => normalizeSourceEntry(m, "monsterMagic"));
            const monsterMagicDocs = normalizedMonsterMagic.map((magic) =>
                makeItemDoc(magic, monsterMagicTemplate, magic.img ?? monsterMagicTemplate.img ?? "icons/svg/explosion.svg", buildMonsterMagicProps, folders.monsterMagicFolder.id, "Monster Magic")
            );
            const monsterMagicEffectDocs = buildWorldMonsterMagicEffectDocs(
                normalizedMonsterMagic,
                monsterMagicDocs,
                usageEffectTemplate,
                folders.usageEffectsFolder.id
            );
            const ritualStepRollTableDocs = ritualStepRollTables.map((table) =>
                buildRitualStepRollTableDoc(table, folders.ritualStepRollTablesFolder.id, "Ritual Step Tables")
            );
            const spellFailureRollTableDocs = spellFailureRollTables.map((table) =>
                buildSpellFailureRollTableDoc(table, folders.spellFailureRollTablesFolder.id, "Spell Failure Tables")
            );
            const spellSupportRollTableDocs = spellSupportRollTables.map((table) =>
                buildSpellSupportRollTableDoc(table, folders.spellSupportRollTablesFolder.id, "Spell Support Tables")
            );
            const boostRollTableDocs = (boostRollTables ?? []).map((table) =>
                buildBoostRollTableDoc(table, folders.boostRollTablesFolder.id, "Boost Tables")
            );
            const changeSetDocs = changeSets.map((changeSet) => {
                const normalized = normalizeSourceEntry(changeSet, "changeset");
                const group = normalized.group ?? normalized.system?.props?.Group ?? "";
                const folder = folders.changeSetGroupFolders[group] ?? folders.changeSetsFolder;
                return makeItemDoc(
                    normalized,
                    changeSetTemplate,
                    normalized.img ?? changeSetTemplate.img ?? "icons/svg/item-bag.svg",
                    buildChangeSetProps,
                    folder.id,
                    group || "Change Sets"
                );
            });
            const changeDocs = changes.map((change) => {
                const normalized = normalizeSourceEntry(change, "change");
                const kind = normalized.kind ?? normalized.system?.props?.Kind ?? "";
                const folder = folders.changeTypeFolders[kind] ?? folders.changesFolder;
                const doc = makeItemDoc(
                    normalized,
                    changeTemplate,
                    normalized.img ?? changeTemplate.img ?? "icons/svg/item-bag.svg",
                    buildChangeProps,
                    folder.id,
                    CHANGE_FOLDER_LABELS[kind] ?? "Changes"
                );
                // Mark the Change as a CSB itemContainer child of its parent
                // ChangeSet. CSB hides items with `system.container` from the
                // main inventory panels; the parent's ChangeDisplayer surfaces
                // them in its sheet.
                const parentChangeSetId = normalized.parentChangeSetId ?? change.parentChangeSetId ?? null;
                if (parentChangeSetId) {
                    doc.system.container = parentChangeSetId;
                }
                return doc;
            });
            // Wire each parent ChangeSet's ChangeDisplayer to its Changes by
            // id. CSB itemContainer reads from props.<containerKey> = { [childId]:
            // { name, id, uuid } }; the composition pipeline walks this map.
            const changeSetById = new Map(changeSetDocs.map((doc) => [doc._id, doc]));
            for (const changeDoc of changeDocs) {
                const parentChangeSetId = String(changeDoc.system?.container ?? "").trim();
                if (!parentChangeSetId) continue;
                const parent = changeSetById.get(parentChangeSetId);
                if (!parent) continue;
                parent.system.props.ChangeDisplayer = parent.system.props.ChangeDisplayer ?? {};
                parent.system.props.ChangeDisplayer[changeDoc._id] = {
                    name: changeDoc.name,
                    id: changeDoc._id,
                    uuid: `Item.${changeDoc._id}`,
                };
            }
            const requirementDocs = requirements.map((requirement) => {
                const normalized = normalizeSourceEntry(requirement, "requirement");
                const predicate = normalized.predicateType ?? normalized.system?.props?.PredicateType ?? "";
                const folder = folders.requirementTypeFolders[predicate] ?? folders.requirementsFolder;
                return makeItemDoc(
                    normalized,
                    requirementTemplate,
                    normalized.img ?? requirementTemplate.img ?? "icons/svg/item-bag.svg",
                    buildRequirementProps,
                    folder.id,
                    REQUIREMENT_FOLDER_LABELS[predicate] ?? "Requirements"
                );
            });
            const monsterDocs = monsters.map((monster) =>
                makeActorDoc(normalizeSourceEntry(monster, "monster", "Actor"), folders.monstersFolder.id, "Monsters", actorTemplate)
            );

            await pruneManagedFolderItems({
                folderId: folders.maneuverFolder.id,
                validIds: new Set(maneuverDocs.map((doc) => doc._id)),
                templateId: maneuverTemplate._id,
                folderHint: "Maneuvers"
            });
            await pruneManagedFolderItems({
                folderId: folders.weaponFolder.id,
                validIds: new Set(weaponDocs.map((doc) => doc._id)),
                templateId: weaponTemplate._id,
                folderHint: "Weapons"
            });
            await pruneManagedFolderItems({
                folderId: folders.armorFolder.id,
                validIds: new Set(armorDocs.map((doc) => doc._id)),
                templateId: armorTemplate._id,
                folderHint: "Armor"
            });
            await pruneManagedFolderItems({
                folderId: folders.ammoFolder.id,
                validIds: new Set(ammoDocs.map((doc) => doc._id)),
                templateId: ammoTemplate._id,
                folderHint: "Ammunition"
            });
            await pruneManagedFolderItems({
                folderId: folders.weaponModifierFolder.id,
                validIds: new Set(weaponModifierDocs.map((doc) => doc._id)),
                templateId: weaponModifierTemplate._id,
                folderHint: "Weapon Modifiers"
            });
            await pruneManagedFolderItems({
                folderId: folders.onHitEffectsFolder.id,
                validIds: new Set(onHitEffectDocs.map((doc) => doc._id)),
                templateId: onHitEffectTemplate._id,
                folderHint: "On-Hit Effects"
            });
            await pruneManagedFolderItems({
                folderId: folders.spellsFolder.id,
                validIds: new Set(spellDocs.map((doc) => doc._id)),
                templateId: spellTemplate._id,
                folderHint: "Spells"
            });
            await pruneManagedFolderItems({
                folderId: folders.ritualStepsFolder.id,
                validIds: new Set(spellRitualStepDocs.map((doc) => doc._id)),
                templateId: ritualStepTemplate._id,
                folderHint: "Ritual Steps"
            });
            await pruneManagedFolderItems({
                folderId: folders.diseasesFolder.id,
                validIds: new Set(diseaseDocs.map((doc) => doc._id)),
                templateId: diseaseTemplate._id,
                folderHint: "Diseases"
            });
            await pruneManagedFolderItems({
                folderId: folders.pactsFolder.id,
                validIds: new Set(pactDocs.map((doc) => doc._id)),
                templateId: pactTemplate._id,
                folderHint: "Pacts"
            });
            const blessingIds = new Set(supernaturalMarkDocs.filter(d => d.folder === folders.blessingsFolder.id).map(d => d._id));
            const curseIds = new Set(supernaturalMarkDocs.filter(d => d.folder === folders.cursesFolder.id).map(d => d._id));
            await pruneManagedFolderItems({
                folderId: folders.blessingsFolder.id,
                validIds: blessingIds,
                templateId: supernaturalMarkTemplate._id,
                folderHint: "Blessings"
            });
            await pruneManagedFolderItems({
                folderId: folders.cursesFolder.id,
                validIds: curseIds,
                templateId: supernaturalMarkTemplate._id,
                folderHint: "Curses"
            });
            await pruneManagedFolderItems({
                folderId: folders.usageEffectsFolder.id,
                validIds: new Set([
                    ...spellUsageEffectDocs.map((doc) => doc._id),
                    ...monsterMagicEffectDocs.map((doc) => doc._id),
                ]),
                templateId: usageEffectTemplate._id,
                folderHint: "Usage Effects"
            });
            await pruneManagedFolderItems({
                folderId: folders.monsterMagicFolder.id,
                validIds: new Set(monsterMagicDocs.map((doc) => doc._id)),
                templateId: monsterMagicTemplate._id,
                folderHint: "Monster Magic"
            });
            await pruneManagedFolderRollTables({
                folderId: folders.ritualStepRollTablesFolder.id,
                validIds: new Set(ritualStepRollTableDocs.map((doc) => doc._id)),
                folderHint: "Ritual Step Tables"
            });
            await pruneManagedFolderRollTables({
                folderId: folders.spellFailureRollTablesFolder.id,
                validIds: new Set(spellFailureRollTableDocs.map((doc) => doc._id)),
                folderHint: "Spell Failure Tables"
            });
            await pruneManagedFolderRollTables({
                folderId: folders.spellSupportRollTablesFolder.id,
                validIds: new Set(spellSupportRollTableDocs.map((doc) => doc._id)),
                folderHint: "Spell Support Tables"
            });
            await pruneManagedFolderRollTables({
                folderId: folders.boostRollTablesFolder.id,
                validIds: new Set(boostRollTableDocs.map((doc) => doc._id)),
                folderHint: "Boost Tables"
            });
            await pruneManagedFolderRollTables({
                folderId: folders.pactRollTablesFolder.id,
                validIds: new Set(pactRollTableDocs.map((doc) => doc._id)),
                folderHint: "Pact Tables"
            });
            for (const groupName of CHANGE_SET_GROUPS) {
                const folder = folders.changeSetGroupFolders[groupName];
                await pruneManagedFolderItems({
                    folderId: folder.id,
                    validIds: new Set(changeSetDocs.filter((doc) => doc.folder === folder.id).map((doc) => doc._id)),
                    templateId: changeSetTemplate._id,
                    folderHint: groupName
                });
            }
            await pruneManagedFolderItems({
                folderId: folders.changeSetsFolder.id,
                validIds: new Set(changeSetDocs.filter((doc) => doc.folder === folders.changeSetsFolder.id).map((doc) => doc._id)),
                templateId: changeSetTemplate._id,
                folderHint: "Change Sets"
            });
            for (const [kind, label] of Object.entries(CHANGE_FOLDER_LABELS)) {
                const folder = folders.changeTypeFolders[kind];
                await pruneManagedFolderItems({
                    folderId: folder.id,
                    validIds: new Set(changeDocs.filter((doc) => doc.folder === folder.id).map((doc) => doc._id)),
                    templateId: changeTemplate._id,
                    folderHint: label
                });
            }
            await pruneManagedFolderItems({
                folderId: folders.changesFolder.id,
                validIds: new Set(changeDocs.filter((doc) => doc.folder === folders.changesFolder.id).map((doc) => doc._id)),
                templateId: changeTemplate._id,
                folderHint: "Changes"
            });
            for (const [predicate, label] of Object.entries(REQUIREMENT_FOLDER_LABELS)) {
                const folder = folders.requirementTypeFolders[predicate];
                await pruneManagedFolderItems({
                    folderId: folder.id,
                    validIds: new Set(requirementDocs.filter((doc) => doc.folder === folder.id).map((doc) => doc._id)),
                    templateId: requirementTemplate._id,
                    folderHint: label
                });
            }
            await pruneManagedFolderItems({
                folderId: folders.requirementsFolder.id,
                validIds: new Set(requirementDocs.filter((doc) => doc.folder === folders.requirementsFolder.id).map((doc) => doc._id)),
                templateId: requirementTemplate._id,
                folderHint: "Requirements"
            });
            await pruneManagedFolderActors({
                folderId: folders.monstersFolder.id,
                validIds: new Set(monsterDocs.map((doc) => doc._id)),
                folderHint: "Monsters"
            });

            const docs = [
                ...maneuverDocs,
                ...weaponDocs,
                ...armorDocs,
                ...ammoDocs,
                ...weaponModifierDocs,
                ...onHitEffectDocs,
                ...spellDocs,
                ...spellUsageEffectDocs,
                ...spellRitualStepDocs,
                ...diseaseDocs,
                ...pactDocs,
                ...supernaturalMarkDocs,
                ...monsterMagicDocs,
                ...monsterMagicEffectDocs,
                ...changeSetDocs,
                ...changeDocs,
                ...requirementDocs
            ];
            const [itemResult, ritualRollTableResult, spellFailureRollTableResult, spellSupportRollTableResult, boostRollTableResult, pactRollTableResult, actorResult] = await Promise.all([
                upsertWorldItems(docs),
                upsertWorldRollTables(ritualStepRollTableDocs),
                upsertWorldRollTables(spellFailureRollTableDocs),
                upsertWorldRollTables(spellSupportRollTableDocs),
                upsertWorldRollTables(boostRollTableDocs),
                upsertWorldRollTables(pactRollTableDocs),
                upsertWorldActors([
                    makeActorDoc(actorTemplate, null, "Actor Template"),
                    ...monsterDocs
                ])
            ]);

            return {
                totalItems: docs.length,
                totalActors: monsterDocs.length,
                totalRollTables: ritualStepRollTableDocs.length + spellFailureRollTableDocs.length + spellSupportRollTableDocs.length + boostRollTableDocs.length + pactRollTableDocs.length,
                createdItems: itemResult.created,
                updatedItems: itemResult.updated,
                createdRollTables: ritualRollTableResult.created + spellFailureRollTableResult.created + spellSupportRollTableResult.created,
                updatedRollTables: ritualRollTableResult.updated + spellFailureRollTableResult.updated + spellSupportRollTableResult.updated,
                createdActors: actorResult.created,
                updatedActors: actorResult.updated
            };
        }
    };
}
