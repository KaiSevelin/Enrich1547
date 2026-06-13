// Shared item prop-builders — the single source of truth for turning authored
// template JSON into CSB system.props. Imported by both build-packs.mjs
// (compile) and module-settings.js (world seeding) so the two cannot drift.

import { deepClone, ACTOR_TYPES, normalizeSourceEntry, mergeDefinedProps, normalizeTypeList, normalizeTraitKey } from "./build-helpers.mjs";

export function buildAmmoProps(ammo) {
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

export function buildArmorProps(armor) {
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
    for (const key of traitKeys) props[`Traits_${key}`] = normalizedTraits.has(key);
    return props;
}

export function buildChangeProps(change) {
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

export function buildChangeSetProps(changeSet) {
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

export function buildDiseaseProps(d) {
    // Select fields store the sanitized option key (no spaces/punctuation),
    // matching the disease template's option keys; text fields store as-is.
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

export function buildMonsterMagicProps(magic) {
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

export function buildPactProps(pact) {
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

export function buildRequirementProps(requirement) {
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

export function buildSupernaturalMarkProps(mark) {
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

export function buildWeaponModifierProps(modifier) {
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

export function buildWeaponProps(weapon) {
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
    for (const key of traitKeys) props[`Traits_${key}`] = normalizedTraits.has(key);
    return props;
}


/* --- Maneuvers -----------------------------------------------------------
 * Unioned canonical builder: module-settings' richer EffectFamily / TargetType
 * inference (build-packs previously shipped a stale flat version) PLUS the full
 * requirement-prop set build-packs carried (module-settings previously emitted
 * only a subset). Single source of truth now, so compiled and seeded maneuvers
 * are identical.
 */
export function inferManeuverEffectFamily(maneuver) {
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

export function inferManeuverPersistentEffectType(maneuver) {
    if (maneuver.name === "Aim") return "aimed";
    if (maneuver.name === "Brace" || maneuver.name === "Brace Firearm") return "braced";
    if (maneuver.name === "Overwatch") return "overwatch";
    if (maneuver.name === "Lock") return "locked";
    if (maneuver.name === "Choke") return "choking-hold";
    return "";
}

export function inferManeuverBattlefieldEffectType(maneuver) {
    if (maneuver.name === "Suppressing Fire") return "suppressing-fire";
    return "";
}

export function inferManeuverTargetType(maneuver) {
    const effectData = maneuver.effectData ?? {};
    if (effectData.area) return "area";
    if (effectData.target === "visible-ally") return "ally";
    if (effectData.target === "self") return "self";
    if (effectData.target && String(effectData.target).includes("ally")) return "ally";
    if (maneuver.tags?.includes("support")) return "ally";
    return "enemy";
}

export function inferManeuverRollType(maneuver) {
    if (maneuver.triggerType === "move-declared" || maneuver.tags?.includes("movement")) return "movement";
    if (maneuver.tags?.includes("defense") || maneuver.triggerType === "damage-taken") return "defense";
    if (maneuver.name === "Grapple Break") return "escape";
    return "attack";
}

export function buildManeuverProps(maneuver) {
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
    const csv = (v) => Array.isArray(v) ? v.join(", ") : (v ?? "");
    return {
        SkillRequirement: requirements.skill ?? "",
        RequirementText: requirements.text ?? "",
        TargetRequirement: requirements.target ?? "",
        RequiredWeaponTags: requiredTagParts.join(", "),
        RequiredWeaponTraits: csv(requirements.requiredWeaponTraits),
        RequiredWeaponGroups: csv(requirements.requiredWeaponGroups),
        RequiredActorConditions: csv(requirements.requiredActorConditions),
        ProhibitedActorConditions: csv(requirements.prohibitedActorConditions),
        RequiredTargetConditions: csv(requirements.requiredTargetConditions),
        RequiresHidden: requirements.requiresHidden ? "true" : "",
        RequiresMounted: requirements.requiresMounted ? "true" : "",
        RequiresUnmounted: requirements.requiresUnmounted ? "true" : "",
        RequiresVisibleAlly: requirements.requiresVisibleAlly ? "true" : "",
        RequiresAdjacentAllyTarget: requirements.requiresAdjacentAllyTarget ? "true" : "",
        RequiresFormationPartner: requirements.requiresFormationPartner ? "true" : "",
        RequiresFlankingAlly: requirements.requiresFlankingAlly ? "true" : "",
        RequiresPolearmAlly: requirements.requiresPolearmAlly ? "true" : "",
        RequiresTargetLocked: requirements.requiresTargetLocked ? "true" : "",
        ExcludedWeaponTags: csv(requirements.excludedWeaponTags),
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
