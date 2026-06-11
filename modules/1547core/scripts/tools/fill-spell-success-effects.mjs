import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SPELLS_PATH = path.join(ROOT, "foundry", "Templates", "spells.json");

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, 4)}\n`, "utf8");
}

function effectBase({
    description = "",
    applicationMode = "NarrativeOnly",
    effectType = "Descriptive",
    effectSubtype = "Omen",
    visible = true,
    targetType = "Actor",
    targetCount = "1",
    targetRange = "",
    targetFilter = "",
    targetDescription = "",
    checkType = "None",
    checkFormula = "",
    resistanceType = "",
    resistanceFormula = "",
    onPartial = "",
    onFailure = "",
    detectionCheck = "",
    payloadTarget = "",
    payloadOperation = "Apply",
    payloadValue = "",
    payloadDice = "",
    payloadTag = "",
    payloadTraitName = "",
    payloadTraitText = "",
    grantedItemTemplate = "",
    grantedItemName = "",
    payloadNotes = "",
    durationType = "Instant",
    durationValue = "",
    expiryTrigger = "",
    removalMethod = "",
    suppressedBy = ""
} = {}) {
    return {
        Description: description,
        ApplicationMode: applicationMode,
        EffectType: effectType,
        EffectSubtype: effectSubtype,
        Visible: visible,
        TargetType: targetType,
        TargetCount: targetCount,
        TargetRange: targetRange,
        TargetFilter: targetFilter,
        TargetDescription: targetDescription,
        CheckType: checkType,
        CheckFormula: checkFormula,
        ResistanceType: resistanceType,
        ResistanceFormula: resistanceFormula,
        OnPartial: onPartial,
        OnFailure: onFailure,
        DetectionCheck: detectionCheck,
        PayloadTarget: payloadTarget,
        PayloadOperation: payloadOperation,
        PayloadValue: payloadValue,
        PayloadDice: payloadDice,
        PayloadTag: payloadTag,
        PayloadTraitName: payloadTraitName,
        PayloadTraitText: payloadTraitText,
        GrantedItemTemplate: grantedItemTemplate,
        GrantedItemName: grantedItemName,
        PayloadNotes: payloadNotes,
        DurationType: durationType,
        DurationValue: durationValue,
        ExpiryTrigger: expiryTrigger,
        RemovalMethod: removalMethod,
        SuppressedBy: suppressedBy
    };
}

const EFFECTS = {
    "Transformation/Self": effectBase({
        applicationMode: "Hybrid",
        effectType: "Transformation",
        effectSubtype: "Self",
        targetType: "Self",
        targetRange: "Self",
        payloadTarget: "Form / body / occult state",
        payloadValue: "Self transformed",
        payloadNotes: "Use for bodily alteration, shapeshifting, alchemical refinement, or occult self-remaking.",
        durationType: "Permanent"
    }),
    "Transformation/Object": effectBase({
        applicationMode: "Hybrid",
        effectType: "Transformation",
        effectSubtype: "Object",
        targetType: "Item",
        targetRange: "Touch",
        targetDescription: "A prepared vessel, object, medium, or crafted thing.",
        payloadTarget: "Object / vessel / magical function",
        payloadValue: "Object transformed",
        payloadNotes: "Use for alchemical transmutation, enchantment, sealing media, and changed crafted function.",
        durationType: "Permanent"
    }),
    "Transformation/Other": effectBase({
        applicationMode: "Hybrid",
        effectType: "Transformation",
        effectSubtype: "Other",
        targetType: "Actor",
        targetRange: "Touch or ritual sympathy",
        checkType: "Contest",
        checkFormula: "caster Power",
        resistanceType: "Stamina",
        resistanceFormula: "target Stamina",
        payloadTarget: "Body / form / nature",
        payloadValue: "Target transformed",
        payloadNotes: "Use when a ritual changes another being rather than the caster.",
        durationType: "Permanent"
    }),
    "Stat/ActorStat": effectBase({
        applicationMode: "DirectDataChange",
        effectType: "Stat",
        effectSubtype: "ActorStat",
        targetType: "Actor",
        payloadTarget: "PrimaryStat:Power:mod",
        payloadOperation: "Increase",
        payloadValue: "1",
        payloadNotes: "Use for lasting explicit shifts to a named primary stat modifier.",
        durationType: "Permanent"
    }),
    "Stat/PrimaryStat": effectBase({
        applicationMode: "DirectDataChange",
        effectType: "Stat",
        effectSubtype: "PrimaryStat",
        targetType: "Actor",
        payloadTarget: "PrimaryStat:Power:mod",
        payloadOperation: "Increase",
        payloadValue: "1",
        payloadNotes: "Override the target path per spell when a different primary stat should change.",
        durationType: "Permanent"
    }),
    "Status/Blessed": effectBase({
        applicationMode: "CreateActiveEffect",
        effectType: "Status",
        effectSubtype: "Blessed",
        targetType: "Actor",
        payloadTarget: "Status",
        payloadValue: "Blessed",
        payloadNotes: "A favorable supernatural condition.",
        durationType: "Days",
        durationValue: "1"
    }),
    "Status/Cursed": effectBase({
        applicationMode: "CreateActiveEffect",
        effectType: "Status",
        effectSubtype: "Cursed",
        visible: false,
        targetType: "Actor",
        checkType: "Contest",
        checkFormula: "caster Power",
        resistanceType: "Power",
        resistanceFormula: "target Power",
        payloadTarget: "Status",
        payloadValue: "Cursed",
        payloadNotes: "A persistent harmful magical condition.",
        durationType: "UntilBroken",
        removalMethod: "Counter-rite, confession, sanctification, or other suitable curse-lifting."
    }),
    "Status/Inspired": effectBase({
        applicationMode: "CreateActiveEffect",
        effectType: "Status",
        effectSubtype: "Inspired",
        targetType: "Actor",
        payloadTarget: "Status",
        payloadValue: "Inspired",
        payloadNotes: "Confidence, force, or auspicious spiritual momentum.",
        durationType: "Days",
        durationValue: "1"
    }),
    "Status/Marked": effectBase({
        applicationMode: "CreateActiveEffect",
        effectType: "Status",
        effectSubtype: "Marked",
        targetType: "Actor",
        payloadTarget: "Status",
        payloadValue: "Marked",
        payloadNotes: "The target bears an occult sign or trace.",
        durationType: "UntilBroken"
    }),
    "Status/Hidden": effectBase({
        applicationMode: "CreateActiveEffect",
        effectType: "Status",
        effectSubtype: "Hidden",
        targetType: "Actor",
        payloadTarget: "Status",
        payloadValue: "Hidden",
        payloadNotes: "The target's true nature or presence is obscured behind glamour or concealment.",
        durationType: "Scene"
    }),
    "Status/Protected": effectBase({
        applicationMode: "CreateActiveEffect",
        effectType: "Status",
        effectSubtype: "Protected",
        targetType: "Actor",
        payloadTarget: "Status",
        payloadValue: "Protected",
        payloadNotes: "Short-lived supernatural protection.",
        durationType: "Days",
        durationValue: "1"
    }),
    "Status/Weakened": effectBase({
        applicationMode: "CreateActiveEffect",
        effectType: "Status",
        effectSubtype: "Weakened",
        targetType: "Actor",
        checkType: "Contest",
        checkFormula: "caster Power",
        resistanceType: "Stamina",
        resistanceFormula: "target Stamina",
        payloadTarget: "Status",
        payloadValue: "Weakened",
        payloadNotes: "Broad physical or supernatural impairment.",
        durationType: "Days",
        durationValue: "1d6"
    }),
    "Status/IllLuck": effectBase({
        applicationMode: "CreateActiveEffect",
        effectType: "Status",
        effectSubtype: "IllLuck",
        visible: false,
        targetType: "Actor",
        checkType: "Contest",
        checkFormula: "caster Power",
        resistanceType: "Power",
        resistanceFormula: "target Power",
        payloadTarget: "Status",
        payloadValue: "Ill Luck",
        payloadNotes: "Misfortune, bad turns, and risky failures gather around the victim.",
        durationType: "Days",
        durationValue: "1d6"
    }),
    "Grant/Disease": effectBase({
        applicationMode: "GrantItem",
        effectType: "Grant",
        effectSubtype: "ConditionItem",
        targetType: "Actor",
        checkType: "Contest",
        checkFormula: "caster Power",
        resistanceType: "Stamina",
        resistanceFormula: "target Stamina",
        payloadTarget: "Disease",
        payloadOperation: "Grant",
        payloadValue: "Disease contracted",
        grantedItemTemplate: "Disease",
        payloadNotes: "Target contracts a disease (granted at Incubation via the disease system); the GM/caster picks the specific disease.",
        durationType: "UntilBroken",
        removalMethod: "Cure the disease (medical treatment / disease-service)."
    }),
    "Status/Doomed": effectBase({
        applicationMode: "CreateActiveEffect",
        effectType: "Status",
        effectSubtype: "Doomed",
        targetType: "Actor",
        checkType: "Contest",
        checkFormula: "caster Power",
        resistanceType: "Faith",
        resistanceFormula: "target Faith",
        payloadTarget: "Status",
        payloadValue: "Doomed",
        payloadNotes: "A worsening fate, death-mark, or ruinous oath outcome hangs over the target.",
        durationType: "UntilBroken"
    }),
    "Status/SleepTouched": effectBase({
        applicationMode: "CreateActiveEffect",
        effectType: "Status",
        effectSubtype: "SleepTouched",
        visible: false,
        targetType: "Actor",
        payloadTarget: "Status",
        payloadValue: "Sleep-Touched",
        payloadNotes: "The target is reachable or burdened through sleep.",
        durationType: "Days",
        durationValue: "1"
    }),
    "Status/Charmed": effectBase({
        applicationMode: "CreateActiveEffect",
        effectType: "Status",
        effectSubtype: "Charmed",
        targetType: "Actor",
        checkType: "Contest",
        checkFormula: "caster Power",
        resistanceType: "Charisma",
        resistanceFormula: "target Charisma",
        payloadTarget: "Status",
        payloadValue: "Charmed",
        payloadNotes: "Affection, favor, or soft control.",
        durationType: "Days",
        durationValue: "1d6"
    }),
    "Status/LostFaith": effectBase({
        applicationMode: "CreateActiveEffect",
        effectType: "Status",
        effectSubtype: "LostFaith",
        visible: false,
        targetType: "Actor",
        checkType: "Contest",
        checkFormula: "caster Power",
        resistanceType: "Faith",
        resistanceFormula: "target Faith",
        payloadTarget: "Status",
        payloadValue: "Lost Faith",
        payloadNotes: "The target's confidence in prayer, rite, or belief is shaken.",
        durationType: "Days",
        durationValue: "1d6"
    }),
    "Status/Possessed": effectBase({
        applicationMode: "Hybrid",
        effectType: "Status",
        effectSubtype: "Possessed",
        targetType: "Actor",
        checkType: "Contest",
        checkFormula: "caster Power",
        resistanceType: "Faith",
        resistanceFormula: "target Faith",
        payloadTarget: "Status",
        payloadValue: "Possessed",
        payloadNotes: "A foreign force inhabits or overrides the host.",
        durationType: "UntilBroken"
    }),
    "Status/Revealed": effectBase({
        applicationMode: "CreateActiveEffect",
        effectType: "Status",
        effectSubtype: "Revealed",
        targetType: "Actor",
        payloadTarget: "Status",
        payloadValue: "Revealed",
        payloadNotes: "Concealment, glamour, or hidden nature is broken.",
        durationType: "Scene"
    }),
    "Status/Silenced": effectBase({
        applicationMode: "CreateActiveEffect",
        effectType: "Status",
        effectSubtype: "Silenced",
        targetType: "Actor",
        checkType: "Contest",
        checkFormula: "caster Power",
        resistanceType: "Faith",
        resistanceFormula: "target Faith",
        payloadTarget: "Status",
        payloadValue: "Silenced",
        payloadNotes: "Speech, naming, prayer, or spoken working is blocked.",
        durationType: "Scene"
    }),
    "Status/TruthBound": effectBase({
        applicationMode: "CreateActiveEffect",
        effectType: "Status",
        effectSubtype: "TruthBound",
        targetType: "Actor",
        checkType: "Contest",
        checkFormula: "caster Power",
        resistanceType: "Faith",
        resistanceFormula: "target Faith",
        payloadTarget: "Status",
        payloadValue: "Truth-Bound",
        payloadNotes: "Lying, dissembling, or oath-breaking becomes difficult.",
        durationType: "Days",
        durationValue: "1d6"
    }),
    "Ward/Threshold": effectBase({
        applicationMode: "GrantItem",
        effectType: "Ward",
        effectSubtype: "Threshold",
        targetType: "Area",
        targetCount: "1 threshold",
        targetRange: "Placed",
        payloadTarget: "Threshold",
        payloadValue: "Protected crossing",
        grantedItemTemplate: "WardAnchor",
        grantedItemName: "Threshold Ward",
        payloadNotes: "Creates or strengthens a warded crossing.",
        durationType: "UntilBroken"
    }),
    "Ward/Alarm": effectBase({
        applicationMode: "GrantItem",
        effectType: "Ward",
        effectSubtype: "Alarm",
        targetType: "Area",
        targetCount: "1 warded place",
        targetRange: "Placed",
        payloadTarget: "Warded boundary",
        payloadValue: "Alarm",
        grantedItemTemplate: "WardAnchor",
        grantedItemName: "Alarm Ward",
        payloadNotes: "Warns when disturbed or crossed.",
        durationType: "UntilBroken"
    }),
    "Ward/Barrier": effectBase({
        applicationMode: "GrantItem",
        effectType: "Ward",
        effectSubtype: "Barrier",
        targetType: "Area",
        targetCount: "1 border or circle",
        targetRange: "Placed",
        payloadTarget: "Barrier",
        payloadValue: "Protected line",
        grantedItemTemplate: "WardAnchor",
        grantedItemName: "Barrier Ward",
        payloadNotes: "Creates a magical line, circle, or shell that resists crossing.",
        durationType: "UntilBroken"
    }),
    "Ward/AntiSpirit": effectBase({
        applicationMode: "CreateActiveEffect",
        effectType: "Ward",
        effectSubtype: "AntiSpirit",
        targetType: "Area",
        targetCount: "1 warded place",
        targetRange: "Placed",
        payloadTarget: "Spirit crossing",
        payloadValue: "Anti-Spirit Ward",
        payloadNotes: "Hinders spirits and similar beings.",
        durationType: "UntilBroken"
    }),
    "Ward/AntiPossession": effectBase({
        applicationMode: "CreateActiveEffect",
        effectType: "Ward",
        effectSubtype: "AntiPossession",
        targetType: "Actor",
        payloadTarget: "Possession defense",
        payloadValue: "Anti-Possession Ward",
        payloadNotes: "Prevents or hinders inhabitation by hostile forces.",
        durationType: "Days",
        durationValue: "1"
    }),
    "Ward/Seal": effectBase({
        applicationMode: "GrantItem",
        effectType: "Ward",
        effectSubtype: "Seal",
        targetType: "Item",
        targetRange: "Touch",
        payloadTarget: "Seal",
        payloadValue: "Sealed",
        grantedItemTemplate: "WardAnchor",
        grantedItemName: "Seal",
        payloadNotes: "Holds something shut, contained, or inaccessible.",
        durationType: "UntilBroken"
    }),
    "Ward/Sanctuary": effectBase({
        applicationMode: "CreateActiveEffect",
        effectType: "Ward",
        effectSubtype: "Sanctuary",
        targetType: "Area",
        targetCount: "1 sanctified place",
        targetRange: "Placed",
        payloadTarget: "Sanctuary",
        payloadValue: "Sanctified ground",
        payloadNotes: "Makes a place harder to touch with hostile magic.",
        durationType: "UntilBroken"
    }),
    "Ward/AntiDemon": effectBase({
        applicationMode: "CreateActiveEffect",
        effectType: "Ward",
        effectSubtype: "AntiDemon",
        targetType: "Area",
        payloadTarget: "Demonic crossing",
        payloadValue: "Anti-Demon Ward",
        payloadNotes: "Protects against demonic approach or entry.",
        durationType: "UntilBroken"
    }),
    "Ward/Proof": effectBase({
        applicationMode: "GrantItem",
        effectType: "Ward",
        effectSubtype: "Proof",
        targetType: "Area",
        targetRange: "Placed",
        payloadTarget: "Proof ward",
        payloadValue: "Proof of disturbance",
        grantedItemTemplate: "WardAnchor",
        grantedItemName: "Proof Ward",
        payloadNotes: "Marks whether a boundary, oath-setting, or protected thing has been disturbed.",
        durationType: "UntilBroken"
    }),
    "Ward/Proof": effectBase({
        applicationMode: "GrantItem",
        effectType: "Ward",
        effectSubtype: "Proof",
        targetType: "Area",
        payloadTarget: "Integrity proof",
        payloadValue: "Proof ward",
        grantedItemTemplate: "WardAnchor",
        grantedItemName: "Proof Ward",
        payloadNotes: "Marks if a boundary, document, or place has been disturbed.",
        durationType: "UntilBroken"
    }),
    "Binding/BindByName": effectBase({
        applicationMode: "Hybrid",
        effectType: "Binding",
        effectSubtype: "BindByName",
        targetType: "Actor",
        checkType: "Contest",
        checkFormula: "caster Power",
        resistanceType: "Power",
        resistanceFormula: "target Power",
        payloadTarget: "Binding",
        payloadValue: "Bound by true name",
        payloadNotes: "Compels or anchors through true naming.",
        durationType: "UntilBroken"
    }),
    "Binding/ContainEntity": effectBase({
        applicationMode: "Hybrid",
        effectType: "Binding",
        effectSubtype: "ContainEntity",
        targetType: "BoundEntity",
        checkType: "Contest",
        checkFormula: "caster Power",
        resistanceType: "Power",
        resistanceFormula: "target Power",
        payloadTarget: "Containment",
        payloadValue: "Contained entity",
        payloadNotes: "Keeps an entity from escaping a circle, vessel, or seal.",
        durationType: "UntilBroken"
    }),
    "Binding/CompelService": effectBase({
        applicationMode: "CreateActiveEffect",
        effectType: "Binding",
        effectSubtype: "CompelService",
        targetType: "BoundEntity",
        checkType: "Contest",
        checkFormula: "caster Power",
        resistanceType: "Power",
        resistanceFormula: "target Power",
        payloadTarget: "Service",
        payloadValue: "Compelled service",
        payloadNotes: "Obliges the bound subject to act or serve.",
        durationType: "UntilBroken"
    }),
    "Binding/BindToItem": effectBase({
        applicationMode: "Hybrid",
        effectType: "Binding",
        effectSubtype: "BindToItem",
        targetType: "Item",
        targetRange: "Touch",
        payloadTarget: "Item binding",
        payloadValue: "Bound to item",
        payloadNotes: "Anchors a force, spirit, or effect to an object.",
        durationType: "UntilBroken"
    }),
    "Binding/BindToActor": effectBase({
        applicationMode: "Hybrid",
        effectType: "Binding",
        effectSubtype: "BindToActor",
        targetType: "Actor",
        checkType: "Contest",
        checkFormula: "caster Power",
        resistanceType: "Stamina",
        resistanceFormula: "target Stamina",
        payloadTarget: "Actor binding",
        payloadValue: "Bound to actor",
        payloadNotes: "Attaches force, hindrance, or ritual delay to a person.",
        durationType: "UntilBroken"
    }),
    "Binding/BindByOath": effectBase({
        applicationMode: "Hybrid",
        effectType: "Binding",
        effectSubtype: "BindByOath",
        targetType: "Actor",
        payloadTarget: "Oath binding",
        payloadValue: "Bound by oath",
        payloadNotes: "Compels through sworn witness, vow, or ritual promise.",
        durationType: "UntilBroken"
    }),
    "Possession/DriveOut": effectBase({
        applicationMode: "Hybrid",
        effectType: "Possession",
        effectSubtype: "DriveOut",
        targetType: "Actor",
        checkType: "Contest",
        checkFormula: "caster Power",
        resistanceType: "Power",
        resistanceFormula: "target Power",
        payloadTarget: "Possession",
        payloadOperation: "Remove",
        payloadValue: "Possessor expelled",
        payloadNotes: "Expels or breaks an active possession.",
        durationType: "Instant"
    }),
    "Possession/ShieldFromPossession": effectBase({
        applicationMode: "CreateActiveEffect",
        effectType: "Possession",
        effectSubtype: "ShieldFromPossession",
        targetType: "Actor",
        payloadTarget: "Possession defense",
        payloadValue: "Shielded from possession",
        payloadNotes: "The target becomes harder to possess through sleep or spirit pressure.",
        durationType: "Days",
        durationValue: "1"
    }),
    "Possession/AttachSpirit": effectBase({
        applicationMode: "Hybrid",
        effectType: "Possession",
        effectSubtype: "AttachSpirit",
        targetType: "Actor",
        checkType: "Contest",
        checkFormula: "caster Power",
        resistanceType: "Faith",
        resistanceFormula: "target Faith",
        payloadTarget: "Spirit attachment",
        payloadValue: "Attached spirit",
        payloadNotes: "A spirit or shade begins inhabiting or clinging to the target.",
        durationType: "UntilBroken"
    }),
    "Possession/FullControl": effectBase({
        applicationMode: "Hybrid",
        effectType: "Possession",
        effectSubtype: "FullControl",
        targetType: "Actor",
        checkType: "Contest",
        checkFormula: "caster Power",
        resistanceType: "Faith",
        resistanceFormula: "target Faith",
        payloadTarget: "Possession",
        payloadValue: "Full control",
        payloadNotes: "The possessor gains strong or total command of the host.",
        durationType: "UntilBroken"
    }),
    "Possession/DreamRiding": effectBase({
        applicationMode: "Hybrid",
        effectType: "Possession",
        effectSubtype: "DreamRiding",
        targetType: "Actor",
        checkType: "Contest",
        checkFormula: "caster Power",
        resistanceType: "Faith",
        resistanceFormula: "target Faith",
        payloadTarget: "Dream contact / invasion",
        payloadValue: "Dream-ridden",
        payloadNotes: "Reaches the target through dreams or sleep-state vulnerability.",
        durationType: "Night"
    }),
    "Influence/Calm": effectBase({
        applicationMode: "CreateActiveEffect",
        effectType: "Influence",
        effectSubtype: "Calm",
        targetType: "Actor",
        payloadTarget: "Emotion / panic / turmoil",
        payloadValue: "Calm",
        payloadNotes: "Reduces panic, agitation, or harmful emotional momentum.",
        durationType: "Scene"
    }),
    "Influence/Fear": effectBase({
        applicationMode: "CreateActiveEffect",
        effectType: "Influence",
        effectSubtype: "Fear",
        targetType: "Actor",
        checkType: "Contest",
        checkFormula: "caster Power",
        resistanceType: "Faith",
        resistanceFormula: "target Faith",
        payloadTarget: "Status",
        payloadValue: "Afraid",
        payloadNotes: "Dread, horror, or fear pressure.",
        durationType: "Scene"
    }),
    "Influence/Obedience": effectBase({
        applicationMode: "CreateActiveEffect",
        effectType: "Influence",
        effectSubtype: "Obedience",
        targetType: "Actor",
        checkType: "Contest",
        checkFormula: "caster Power",
        resistanceType: "Charisma",
        resistanceFormula: "target Charisma",
        payloadTarget: "Will / obedience",
        payloadValue: "Obedience",
        payloadNotes: "Pushes the target toward compliance and command-following.",
        durationType: "Scene"
    }),
    "Influence/Love": effectBase({
        applicationMode: "CreateActiveEffect",
        effectType: "Influence",
        effectSubtype: "Love",
        targetType: "Actor",
        checkType: "Contest",
        checkFormula: "caster Power",
        resistanceType: "Charisma",
        resistanceFormula: "target Charisma",
        payloadTarget: "Affection / desire",
        payloadValue: "Love",
        payloadNotes: "Attachment, longing, or compelled affection.",
        durationType: "Days",
        durationValue: "1d6"
    }),
    "Influence/SocialFavor": effectBase({
        applicationMode: "CreateActiveEffect",
        effectType: "Influence",
        effectSubtype: "SocialFavor",
        targetType: "Actor",
        payloadTarget: "Stance toward source",
        payloadValue: "Social Favor",
        payloadNotes: "The target views the source more favorably.",
        durationType: "Days",
        durationValue: "1d6"
    }),
    "Influence/Doubt": effectBase({
        applicationMode: "CreateActiveEffect",
        effectType: "Influence",
        effectSubtype: "Doubt",
        targetType: "Actor",
        checkType: "Contest",
        checkFormula: "caster Power",
        resistanceType: "Faith",
        resistanceFormula: "target Faith",
        payloadTarget: "Judgment / certainty",
        payloadValue: "Doubt",
        payloadNotes: "Weakens trust, conviction, or confidence.",
        durationType: "Scene"
    }),
    "Influence/Forgetfulness": effectBase({
        applicationMode: "CreateActiveEffect",
        effectType: "Influence",
        effectSubtype: "Forgetfulness",
        visible: false,
        targetType: "Actor",
        checkType: "Contest",
        checkFormula: "caster Power",
        resistanceType: "Intelligence",
        resistanceFormula: "target Intelligence",
        payloadTarget: "Memory / recall",
        payloadValue: "Forgetfulness",
        payloadNotes: "Makes recall, retention, or exact memory difficult.",
        durationType: "Days",
        durationValue: "1d6"
    }),
    "Influence/Sleep": effectBase({
        applicationMode: "CreateActiveEffect",
        effectType: "Influence",
        effectSubtype: "Sleep",
        targetType: "Actor",
        checkType: "Contest",
        checkFormula: "caster Power",
        resistanceType: "Stamina",
        resistanceFormula: "target Stamina",
        payloadTarget: "Sleep / lethargy",
        payloadValue: "Sleep",
        payloadNotes: "Pushes the target into slumber or deathlike sleep.",
        durationType: "Night"
    }),
    "Influence/Suggestion": effectBase({
        applicationMode: "CreateActiveEffect",
        effectType: "Influence",
        effectSubtype: "Suggestion",
        targetType: "Actor",
        checkType: "Contest",
        checkFormula: "caster Power",
        resistanceType: "Charisma",
        resistanceFormula: "target Charisma",
        payloadTarget: "Intent / accepted idea",
        payloadValue: "Suggestion",
        payloadNotes: "Plants an urge, direction, or accepted course of action.",
        durationType: "Days",
        durationValue: "1d6"
    }),
    "Influence/TruthPressure": effectBase({
        applicationMode: "CreateActiveEffect",
        effectType: "Influence",
        effectSubtype: "TruthPressure",
        targetType: "Actor",
        checkType: "Contest",
        checkFormula: "caster Power",
        resistanceType: "Faith",
        resistanceFormula: "target Faith",
        payloadTarget: "Honesty / confession",
        payloadValue: "Truth Pressure",
        payloadNotes: "Deception becomes harder and confession easier.",
        durationType: "Scene"
    }),
    "Revelation/Omen": effectBase({
        applicationMode: "NarrativeOnly",
        effectType: "Revelation",
        effectSubtype: "Omen",
        targetType: "Descriptive",
        targetDescription: "Question, decision, or near future.",
        payloadTarget: "Omen meaning",
        payloadOperation: "Reveal",
        payloadValue: "Omen",
        payloadNotes: "Reveals whether forces are favorable, dangerous, or ill-starred.",
        durationType: "Instant"
    }),
    "Revelation/Prophecy": effectBase({
        applicationMode: "NarrativeOnly",
        effectType: "Revelation",
        effectSubtype: "Prophecy",
        targetType: "Descriptive",
        payloadTarget: "Future knowledge",
        payloadOperation: "Reveal",
        payloadValue: "Prophecy",
        payloadNotes: "A stronger future insight than a simple omen.",
        durationType: "Instant"
    }),
    "Revelation/Location": effectBase({
        applicationMode: "NarrativeOnly",
        effectType: "Revelation",
        effectSubtype: "Location",
        targetType: "Actor",
        payloadTarget: "Location",
        payloadOperation: "Reveal",
        payloadValue: "Known location",
        payloadNotes: "Reveals where a person, object, or danger lies.",
        durationType: "Instant"
    }),
    "Revelation/Identity": effectBase({
        applicationMode: "NarrativeOnly",
        effectType: "Revelation",
        effectSubtype: "Identity",
        targetType: "Actor",
        payloadTarget: "Identity",
        payloadOperation: "Reveal",
        payloadValue: "True identity",
        payloadNotes: "Reveals culprit, disguise, or hidden nature.",
        durationType: "Instant"
    }),
    "Revelation/DreamMessage": effectBase({
        applicationMode: "NarrativeOnly",
        effectType: "Revelation",
        effectSubtype: "DreamMessage",
        targetType: "Actor",
        payloadTarget: "Dream",
        payloadOperation: "Reveal",
        payloadValue: "Dream message",
        payloadNotes: "Conveys or interprets knowledge through dreaming.",
        durationType: "Night"
    }),
    "Revelation/ObjectHistory": effectBase({
        applicationMode: "NarrativeOnly",
        effectType: "Revelation",
        effectSubtype: "ObjectHistory",
        targetType: "Item",
        targetRange: "Touch",
        payloadTarget: "Object memory",
        payloadOperation: "Reveal",
        payloadValue: "Past impressions",
        payloadNotes: "Reveals impressions or past events tied to an object.",
        durationType: "Instant"
    }),
    "Revelation/Memory": effectBase({
        applicationMode: "NarrativeOnly",
        effectType: "Revelation",
        effectSubtype: "Memory",
        targetType: "Actor",
        payloadTarget: "Memory",
        payloadOperation: "Reveal",
        payloadValue: "Recovered memory",
        payloadNotes: "Recovers or illuminates memory.",
        durationType: "Instant"
    }),
    "Revelation/SpiritSight": effectBase({
        applicationMode: "CreateActiveEffect",
        effectType: "Revelation",
        effectSubtype: "SpiritSight",
        targetType: "Actor",
        payloadTarget: "Spirit sight",
        payloadOperation: "Reveal",
        payloadValue: "Spirit sight",
        payloadNotes: "Reveals hidden spirits, presences, or occult crossings.",
        durationType: "Scene"
    }),
    "Revelation/TrueName": effectBase({
        applicationMode: "NarrativeOnly",
        effectType: "Revelation",
        effectSubtype: "TrueName",
        targetType: "Actor",
        payloadTarget: "Identity",
        payloadOperation: "Reveal",
        payloadValue: "True name",
        payloadNotes: "Reveals a binding or true name.",
        durationType: "Permanent"
    }),
    "Revelation/PastEvent": effectBase({
        applicationMode: "NarrativeOnly",
        effectType: "Revelation",
        effectSubtype: "PastEvent",
        targetType: "Descriptive",
        payloadTarget: "Earlier event",
        payloadOperation: "Reveal",
        payloadValue: "Past event",
        payloadNotes: "Reveals or ritually re-frames an earlier event, memory, or history.",
        durationType: "Instant"
    }),
    "Movement/Immobilize": effectBase({
        applicationMode: "CreateActiveEffect",
        effectType: "Movement",
        effectSubtype: "Immobilize",
        targetType: "Actor",
        checkType: "Contest",
        checkFormula: "caster Power",
        resistanceType: "Stamina",
        resistanceFormula: "target Stamina",
        payloadTarget: "Movement",
        payloadValue: "Immobilized",
        payloadNotes: "Pins, snares, or arrests movement.",
        durationType: "Scene"
    }),
    "Movement/LeadAstray": effectBase({
        applicationMode: "CreateActiveEffect",
        effectType: "Movement",
        effectSubtype: "LeadAstray",
        targetType: "Actor",
        checkType: "Contest",
        checkFormula: "caster Power",
        resistanceType: "Intelligence",
        resistanceFormula: "target Intelligence",
        payloadTarget: "Navigation / direction",
        payloadValue: "Led Astray",
        payloadNotes: "The target loses the right path, cohesion, or chosen direction.",
        durationType: "Scene"
    }),
    "Movement/PhaseTravel": effectBase({
        applicationMode: "NarrativeOnly",
        effectType: "Movement",
        effectSubtype: "PhaseTravel",
        targetType: "Self",
        targetRange: "Self",
        payloadTarget: "Projected or altered travel",
        payloadValue: "Phase travel",
        payloadNotes: "Projects or shifts the traveller through an altered state of movement or presence.",
        durationType: "Scene"
    }),
    "Protection/SafePassage": effectBase({
        applicationMode: "CreateActiveEffect",
        effectType: "Protection",
        effectSubtype: "SafePassage",
        targetType: "Actor",
        payloadTarget: "Travel / crossing safety",
        payloadValue: "Safe Passage",
        payloadNotes: "Crossings, thresholds, or hazardous paths become safer.",
        durationType: "Days",
        durationValue: "1"
    }),
    "Protection/DamageResistance": effectBase({
        applicationMode: "CreateActiveEffect",
        effectType: "Protection",
        effectSubtype: "DamageResistance",
        targetType: "Item",
        targetRange: "Touch",
        payloadTarget: "Protected weapon or bearer",
        payloadOperation: "Apply",
        payloadValue: "Damage resistance / sanctified harm",
        payloadNotes: "Use when a blessed or protected thing resists or better delivers harm against the supernatural.",
        durationType: "Days",
        durationValue: "1"
    }),
    "Protection/ConditionImmunity": effectBase({
        applicationMode: "CreateActiveEffect",
        effectType: "Protection",
        effectSubtype: "ConditionImmunity",
        targetType: "Actor",
        payloadTarget: "Blocked condition",
        payloadValue: "Condition immunity",
        payloadNotes: "The target is shielded from a specific hostile condition.",
        durationType: "Days",
        durationValue: "1"
    }),
    "Remove/Curse": effectBase({
        applicationMode: "Hybrid",
        effectType: "Remove",
        effectSubtype: "Curse",
        targetType: "Actor",
        payloadTarget: "Curse",
        payloadOperation: "Remove",
        payloadValue: "Removed curse",
        payloadNotes: "Lifts a curse or evil eye if the working succeeds.",
        durationType: "Instant"
    }),
    "Remove/Disease": effectBase({
        applicationMode: "Hybrid",
        effectType: "Remove",
        effectSubtype: "Disease",
        targetType: "Actor",
        payloadTarget: "Disease",
        payloadOperation: "Remove",
        payloadValue: "Removed disease",
        payloadNotes: "Clears sickness, taint, or imposed disease-state.",
        durationType: "Instant"
    }),
    "Remove/Binding": effectBase({
        applicationMode: "Hybrid",
        effectType: "Remove",
        effectSubtype: "Binding",
        targetType: "Actor",
        payloadTarget: "Binding",
        payloadOperation: "Remove",
        payloadValue: "Binding broken",
        payloadNotes: "Breaks or clears a binding relation or imposed hold.",
        durationType: "Instant"
    }),
    "Remove/Tag": effectBase({
        applicationMode: "DirectDataChange",
        effectType: "Remove",
        effectSubtype: "Tag",
        targetType: "Actor",
        payloadTarget: "Tag",
        payloadOperation: "Remove",
        payloadValue: "Tag removed",
        payloadNotes: "Removes a machine-readable rule fact attached by a spell.",
        durationType: "Instant"
    }),
    "Remove/Oath": effectBase({
        applicationMode: "Hybrid",
        effectType: "Remove",
        effectSubtype: "Oath",
        targetType: "Actor",
        payloadTarget: "Oath",
        payloadOperation: "Remove",
        payloadValue: "Oath broken",
        payloadNotes: "Breaks, severs, or undoes a bound oath.",
        durationType: "Instant"
    }),
    "Remove/PactStrain": effectBase({
        applicationMode: "Hybrid",
        effectType: "Remove",
        effectSubtype: "PactStrain",
        targetType: "PactBearer",
        payloadTarget: "Pact strain",
        payloadOperation: "Remove",
        payloadValue: "Strain eased",
        payloadNotes: "Clears current pact pressure without necessarily ending the pact.",
        durationType: "Instant"
    }),
    "Remove/Possession": effectBase({
        applicationMode: "Hybrid",
        effectType: "Remove",
        effectSubtype: "Possession",
        targetType: "Actor",
        payloadTarget: "Possession",
        payloadOperation: "Remove",
        payloadValue: "Possession broken",
        payloadNotes: "Expels or breaks an active possession.",
        durationType: "Instant"
    }),
    "Remove/Ward": effectBase({
        applicationMode: "Hybrid",
        effectType: "Remove",
        effectSubtype: "Ward",
        targetType: "Area",
        payloadTarget: "Ward",
        payloadOperation: "Remove",
        payloadValue: "Ward broken",
        payloadNotes: "Breaks or clears an active ward, seal, or ritual protection.",
        durationType: "Instant"
    }),
    "Remove/Status": effectBase({
        applicationMode: "DirectDataChange",
        effectType: "Remove",
        effectSubtype: "Status",
        targetType: "Actor",
        payloadTarget: "Status",
        payloadOperation: "Remove",
        payloadValue: "Status removed",
        payloadNotes: "Clears an active condition.",
        durationType: "Instant"
    }),
    "Grant/BoundEntity": effectBase({
        applicationMode: "GrantItem",
        effectType: "Grant",
        effectSubtype: "BoundEntity",
        targetType: "Self",
        targetRange: "Self",
        payloadTarget: "Bound entity",
        payloadOperation: "Grant",
        payloadValue: "Bound entity granted",
        grantedItemTemplate: "BoundEntity",
        grantedItemName: "Bound Entity",
        payloadNotes: "Creates a summoned, bound, or manifested entity record.",
        durationType: "UntilBroken"
    }),
    "Grant/Pact": effectBase({
        applicationMode: "GrantItem",
        effectType: "Grant",
        effectSubtype: "Pact",
        targetType: "Self",
        payloadTarget: "Pact",
        payloadOperation: "Grant",
        payloadValue: "Pact granted",
        grantedItemTemplate: "Pact",
        grantedItemName: "Pact",
        payloadNotes: "Creates or invokes a pact relationship item.",
        durationType: "UntilBroken"
    }),
    "Grant/Spell": effectBase({
        applicationMode: "GrantItem",
        effectType: "Grant",
        effectSubtype: "Spell",
        targetType: "Actor",
        payloadTarget: "Spell",
        payloadOperation: "Grant",
        payloadValue: "Spell granted",
        grantedItemTemplate: "Spell",
        grantedItemName: "Granted Spell",
        payloadNotes: "Grants a limited-use or contingent spell effect.",
        durationType: "WhileConditionHolds"
    }),
    "Trait/BlessingText": effectBase({
        applicationMode: "DirectDataChange",
        effectType: "Trait",
        effectSubtype: "BlessingText",
        targetType: "Item",
        payloadTarget: "FlagTrait:blessing-text",
        payloadTraitName: "Blessed",
        payloadTraitText: "This target bears a holy or favorable magical blessing.",
        payloadNotes: "Readable blessing text rather than a numeric status.",
        durationType: "Permanent"
    }),
    "Trait/PactTerm": effectBase({
        applicationMode: "DirectDataChange",
        effectType: "Trait",
        effectSubtype: "PactTerm",
        targetType: "Actor",
        payloadTarget: "FlagTrait:pact-term",
        payloadTraitName: "Pact Term",
        payloadTraitText: "A pact obligation, boon, or condition now applies.",
        payloadNotes: "Readable pact rule text.",
        durationType: "UntilBroken"
    }),
    "Trait/PassiveRule": effectBase({
        applicationMode: "DirectDataChange",
        effectType: "Trait",
        effectSubtype: "PassiveRule",
        targetType: "Item",
        payloadTarget: "FlagTrait:passive-rule",
        payloadTraitName: "Passive Rule",
        payloadTraitText: "This working adds a lasting non-numeric magical rule.",
        payloadNotes: "Use for alchemical object-state and other readable special rules.",
        durationType: "Permanent"
    }),
    "Trait/VisibleTell": effectBase({
        applicationMode: "DirectDataChange",
        effectType: "Trait",
        effectSubtype: "VisibleTell",
        targetType: "Actor",
        payloadTarget: "FlagTrait:visible-tell",
        payloadTraitName: "Visible Tell",
        payloadTraitText: "A visible magical sign, stain, or uncanny tell remains.",
        payloadNotes: "Readable visible magical feature.",
        durationType: "Permanent"
    }),
    "Descriptive/Omen": effectBase({
        applicationMode: "NarrativeOnly",
        effectType: "Descriptive",
        effectSubtype: "Omen",
        targetType: "Descriptive",
        payloadTarget: "Omen",
        payloadValue: "Omen sign",
        payloadNotes: "A portent manifests in the world or in the casting medium.",
        durationType: "Instant"
    }),
    "Descriptive/Dream": effectBase({
        applicationMode: "NarrativeOnly",
        effectType: "Descriptive",
        effectSubtype: "Dream",
        targetType: "Descriptive",
        payloadTarget: "Dream",
        payloadValue: "Dream vision",
        payloadNotes: "Dream imagery, contact, or oneiric sign.",
        durationType: "Night"
    }),
    "Descriptive/Manifestation": effectBase({
        applicationMode: "NarrativeOnly",
        effectType: "Descriptive",
        effectSubtype: "Manifestation",
        targetType: "Descriptive",
        payloadTarget: "Manifestation",
        payloadValue: "Supernatural manifestation",
        payloadNotes: "An uncanny presence, sign, or event without a strict mechanical outcome.",
        durationType: "Scene"
    }),
    "Descriptive/Weather": effectBase({
        applicationMode: "NarrativeOnly",
        effectType: "Descriptive",
        effectSubtype: "Weather",
        targetType: "Area",
        payloadTarget: "Weather",
        payloadValue: "Weather sign",
        payloadNotes: "Local atmospheric change or omen of wind and weather.",
        durationType: "Scene"
    })
};

const SPELL_MAP = {
    "Albedo": ["Transformation/Self", "Stat/ActorStat"],
    "Angelic Boon": ["Status/Blessed", "Grant/Spell"],
    "Astral Projection": ["Movement/PhaseTravel", "Grant/BoundEntity"],
    "Auspicious Prediction": ["Revelation/Omen", "Descriptive/Omen"],
    "Auspicious Timing": ["Revelation/Omen", "Status/Blessed"],
    "Banish": ["Remove/Possession", "Binding/ContainEntity"],
    "Beam Sigil": ["Ward/Threshold", "Ward/Alarm"],
    "Bind": ["Binding/BindByName", "Binding/ContainEntity"],
    "Black Sleep": ["Influence/Sleep", "Status/SleepTouched"],
    "Blood Border": ["Ward/Barrier", "Ward/AntiSpirit"],
    "Borrowed Pallor": ["Transformation/Self", "Status/Marked"],
    "Borrowed Pulse": ["Transformation/Self", "Status/Weakened"],
    "Break Binding": ["Remove/Binding", "Remove/Tag"],
    "Break Pact": ["Remove/Oath", "Remove/PactStrain"],
    "Break Seal": ["Remove/Ward", "Remove/Binding"],
    "Calcination": ["Transformation/Object", "Trait/PassiveRule"],
    "Calm Knot": ["Influence/Calm", "Status/Protected"],
    "Chalk Border": ["Ward/Barrier", "Ward/AntiSpirit"],
    "Citrinitas": ["Transformation/Self", "Status/Inspired"],
    "Coagulation": ["Transformation/Object", "Trait/PassiveRule"],
    "Cold Knot": ["Status/Weakened", "Influence/Fear"],
    "Command": ["Influence/Obedience", "Binding/CompelService"],
    "Conjunction": ["Transformation/Object", "Grant/BoundEntity"],
    "Consecrate Church": ["Ward/Sanctuary", "Ward/AntiDemon"],
    "Consumption Oath": ["Binding/BindByOath", "Status/Doomed"],
    "Create Funeral Wax Candle": ["Binding/BindToItem", "Trait/VisibleTell"],
    "Create Spirit Vessel": ["Binding/BindToItem", "Grant/BoundEntity"],
    "Curse of Withering": ["Status/Cursed", "Status/Weakened"],
    "Bless Weapon": ["Trait/BlessingText", "Protection/DamageResistance"],
    "Danger Sense": ["Revelation/Omen", "Status/Protected"],
    "Death Knots": ["Status/Doomed", "Status/Weakened"],
    "Delay": ["Binding/BindToActor", "Status/Weakened"],
    "Disease Knot": ["Grant/Disease", "Status/Cursed"],
    "Dissolution": ["Remove/Binding", "Transformation/Object"],
    "Distillation": ["Transformation/Object", "Trait/PassiveRule"],
    "Divine Guidance": ["Status/Blessed", "Revelation/Omen"],
    "Dread": ["Influence/Fear", "Status/Weakened"],
    "Dream Interpretation": ["Revelation/DreamMessage", "Descriptive/Dream"],
    "Dream Warding": ["Ward/AntiPossession", "Possession/ShieldFromPossession"],
    "Empty Mirror": ["Trait/VisibleTell", "Revelation/Identity"],
    "Enchant Object": ["Transformation/Object", "Grant/Spell"],
    "Evil Eye": ["Status/IllLuck", "Status/Cursed"],
    "Exorcism": ["Possession/DriveOut", "Remove/Possession"],
    "Faith Manipulation": ["Influence/Doubt", "Status/LostFaith"],
    "Favor Knot": ["Influence/SocialFavor", "Status/Charmed"],
    "Fermentation": ["Transformation/Object", "Status/Blessed"],
    "Find the Culprit": ["Revelation/Identity", "Revelation/Location"],
    "Find What Is Lost": ["Revelation/Location", "Revelation/Identity"],
    "Glamour": ["Status/Hidden", "Trait/VisibleTell"],
    "Golem": ["Grant/BoundEntity", "Binding/CompelService"],
    "Grave Dreaming": ["Revelation/DreamMessage", "Descriptive/Dream"],
    "Grave Soil and Salt Border": ["Ward/Barrier", "Ward/AntiSpirit"],
    "Heart Twine": ["Influence/Love", "Status/Charmed"],
    "Homunculus": ["Grant/BoundEntity", "Binding/BindToItem"],
    "Humoral Rebalancing": ["Status/Blessed", "Remove/Disease"],
    "Ill Luck Knot": ["Status/IllLuck", "Status/Cursed"],
    "Ill Turning Loop": ["Influence/Doubt", "Movement/LeadAstray"],
    "Invoke Pact": ["Grant/Pact", "Trait/PactTerm"],
    "Iron Seal": ["Ward/Seal", "Binding/ContainEntity"],
    "Limbsnare": ["Movement/Immobilize", "Binding/BindToActor"],
    "Lovebinding": ["Influence/Love", "Status/Charmed"],
    "Memory Tangle": ["Influence/Forgetfulness", "Revelation/Memory"],
    "Metallic Transposition": ["Transformation/Object", "Trait/PassiveRule"],
    "Name the Unnamed": ["Revelation/TrueName", "Binding/BindByName"],
    "Nigredo": ["Transformation/Self", "Status/Cursed"],
    "Night Riding": ["Possession/DreamRiding", "Status/SleepTouched"],
    "Oath Knot": ["Binding/BindByOath", "Status/TruthBound"],
    "Oath of Three Witnesses": ["Binding/BindByOath", "Ward/Proof"],
    "Object Memory": ["Revelation/ObjectHistory", "Revelation/Memory"],
    "Possess": ["Possession/FullControl", "Status/Possessed"],
    "Planetary Invocation": ["Status/Blessed", "Revelation/Prophecy"],
    "Prophecy": ["Revelation/Prophecy", "Descriptive/Omen"],
    "Prospect Reading": ["Revelation/Omen", "Revelation/Location"],
    "Protection Rhyme": ["Status/Protected", "Protection/SafePassage"],
    "Protective Border": ["Ward/Threshold", "Protection/SafePassage"],
    "Protective Circle": ["Ward/Barrier", "Ward/Sanctuary"],
    "Prayer Against the Evil Eye": ["Remove/Curse", "Protection/ConditionImmunity"],
    "Reading": ["Revelation/Omen", "Descriptive/Omen"],
    "Refusal Rite": ["Remove/Binding", "Remove/Possession"],
    "Rewrite the Past": ["Revelation/PastEvent", "Influence/Forgetfulness"],
    "Rubedo": ["Transformation/Self", "Stat/PrimaryStat"],
    "Sanctify": ["Status/Blessed", "Remove/Curse"],
    "Scrying": ["Revelation/Location", "Revelation/SpiritSight"],
    "Seal": ["Ward/Seal", "Binding/ContainEntity"],
    "Separation": ["Transformation/Object", "Remove/Status"],
    "Shadow Attachment": ["Possession/AttachSpirit", "Status/Possessed"],
    "Shapeshifting": ["Transformation/Self", "Trait/VisibleTell"],
    "Simulacrum": ["Grant/BoundEntity", "Transformation/Object"],
    "Speak with the Dead": ["Grant/BoundEntity", "Revelation/SpiritSight"],
    "Spirit Sight": ["Revelation/SpiritSight", "Status/Revealed"],
    "Still Tongue": ["Status/Silenced", "Influence/Fear"],
    "Summon Being": ["Grant/BoundEntity", "Binding/CompelService"],
    "Tongue Tying Knot": ["Status/Silenced", "Influence/Obedience"],
    "Transform Self": ["Transformation/Self", "Stat/PrimaryStat"],
    "Threshold Awareness": ["Revelation/SpiritSight", "Ward/Alarm"],
    "Truth Pressure": ["Influence/TruthPressure", "Status/TruthBound"],
    "Uncertain Knot": ["Movement/LeadAstray", "Influence/Doubt"],
    "Wax Seal": ["Ward/Seal", "Binding/BindToItem"],
    "Wind Knot": ["Descriptive/Weather", "Protection/SafePassage"],
    "Witch's Ladder": ["Binding/BindToItem", "Influence/Suggestion"],
    "Withering Knot": ["Status/Weakened", "Status/Cursed"],
    "Zone Travel": ["Movement/PhaseTravel", "Descriptive/Manifestation"]
};

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function buildEffect(pattern, spellName) {
    const base = EFFECTS[pattern];
    if (!base) {
        throw new Error(`Missing effect pattern '${pattern}' for spell '${spellName}'.`);
    }
    const effect = clone(base);
    if (!effect.Description) {
        effect.Description = `${spellName}: ${pattern}`;
    }
    return effect;
}

function applyOverrides(spellName, effects) {
    if (spellName === "Albedo") {
        effects[1].PayloadTarget = "PrimaryStat:Power:mod";
        effects[1].PayloadTraitText = "";
    }
    if (spellName === "Rubedo") {
        effects[1].PayloadTarget = "PrimaryStat:Charisma:mod";
        effects[1].PayloadNotes = "Rubedo culminates the alchemical work in a more perfected and outwardly potent form.";
    }
    if (spellName === "Transform Self") {
        effects[1].PayloadTarget = "PrimaryStat:Strength:mod";
        effects[1].PayloadNotes = "This version of the rite hardens or improves the body in a directly usable way.";
    }
    if (spellName === "Bless Weapon") {
        effects[0].TargetType = "Item";
        effects[0].TargetRange = "Touch";
        effects[0].TargetDescription = "A weapon to be blessed.";
        effects[0].PayloadTraitName = "Blessed Weapon";
        effects[0].PayloadTraitText = "This weapon is ritually blessed and counts as favored against unclean or hostile supernatural targets.";
        effects[1].TargetType = "Item";
        effects[1].TargetRange = "Touch";
        effects[1].PayloadTarget = "Blessed weapon";
        effects[1].PayloadValue = "Sanctified harm";
        effects[1].PayloadNotes = "The blessed weapon better harms or resists hostile supernatural force.";
    }
    if (spellName === "Golem" || spellName === "Homunculus" || spellName === "Simulacrum" || spellName === "Summon Being") {
        effects[0].GrantedItemName = spellName;
    }
    if (spellName === "Create Spirit Vessel" || spellName === "Create Funeral Wax Candle" || spellName === "Wax Seal" || spellName === "Iron Seal" || spellName === "Enchant Object") {
        effects[0].TargetType = "Item";
        effects[0].TargetRange = "Touch";
    }
    if (spellName === "Consecrate Church" || spellName === "Protective Circle" || spellName === "Protective Border" || spellName === "Blood Border" || spellName === "Grave Soil & Salt Border" || spellName === "Chalk Border") {
        effects[0].TargetType = "Area";
        effects[0].TargetRange = "Placed";
    }
    if (spellName === "Zone Travel" || spellName === "Astral Projection" || spellName === "Transform Self" || spellName === "Shapeshifting") {
        effects[0].TargetType = "Self";
        effects[0].TargetRange = "Self";
    }
    return effects;
}

function main() {
    const printOnly = process.argv.includes("--stdout");
    const spells = readJson(SPELLS_PATH);
    const missing = [];
    let changed = 0;

    for (const spell of spells) {
        const patterns = SPELL_MAP[spell.name];
        if (!patterns) {
            missing.push(spell.name);
            continue;
        }
        const effects = applyOverrides(spell.name, patterns.map((pattern) => buildEffect(pattern, spell.name)));
        spell.successEffects = effects;
        changed += 1;
    }

    if (missing.length > 0) {
        throw new Error(`Unmapped spells (${missing.length}): ${missing.join(", ")}`);
    }

    if (printOnly) {
        process.stdout.write(`${JSON.stringify(spells, null, 4)}\n`);
        return;
    }

    writeJson(SPELLS_PATH, spells);
    console.log(`Filled successEffects for ${changed} spells.`);
}

main();
