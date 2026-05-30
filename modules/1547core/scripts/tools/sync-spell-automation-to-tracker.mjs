import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SPELLS_PATH = path.join(ROOT, "foundry", "Templates", "spells.json");

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
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

function createEmptyEffect({
    spellName,
    effectType = "Status",
    effectSubtype,
    targetType = "Actor",
    targetRange = "",
    targetDescription = "",
    durationType = "Scene",
    durationValue = "",
    payloadTarget = "Status",
    payloadValue = "",
    payloadNotes = ""
}) {
    return effectBase({
        description: `${spellName}: ${effectType}/${effectSubtype}`,
        applicationMode: "CreateActiveEffect",
        effectType,
        effectSubtype,
        visible: true,
        targetType,
        targetRange,
        targetDescription,
        payloadTarget,
        payloadValue: payloadValue || effectSubtype,
        payloadNotes: payloadNotes || `Empty editable shell for '${effectSubtype}'. Detailed changes will be authored later.`,
        durationType,
        durationValue
    });
}

function createStepChangeEffect({
    spellName,
    stat,
    steps,
    targetType = "Self",
    targetRange = "",
    durationType = "Scene",
    durationValue = "",
    effectType = "Stat",
    effectSubtype = "PrimaryStat"
}) {
    return effectBase({
        description: `${spellName}: ${effectType}/${effectSubtype}`,
        applicationMode: "DirectDataChange",
        effectType,
        effectSubtype,
        visible: true,
        targetType,
        targetRange,
        payloadTarget: `PrimaryStat:${stat}:steps`,
        payloadOperation: steps >= 0 ? "Increase" : "Decrease",
        payloadValue: String(Math.abs(steps)),
        payloadNotes: `${steps >= 0 ? "Increase" : "Decrease"} ${stat} by ${Math.abs(steps)} step(s).`,
        durationType,
        durationValue
    });
}

function createHpChangeEffect({
    spellName,
    targetPath,
    amount,
    targetType = "Self",
    targetRange = "",
    durationType = "Instant",
    durationValue = "",
    effectSubtype = "ActorStat"
}) {
    return effectBase({
        description: `${spellName}: Stat/${effectSubtype}`,
        applicationMode: "DirectDataChange",
        effectType: "Stat",
        effectSubtype,
        visible: true,
        targetType,
        targetRange,
        payloadTarget: `system.props.${targetPath}`,
        payloadOperation: amount >= 0 ? "Increase" : "Decrease",
        payloadValue: String(Math.abs(amount)),
        payloadNotes: `${amount >= 0 ? "Increase" : "Decrease"} ${targetPath} by ${Math.abs(amount)}.`,
        durationType,
        durationValue
    });
}

function createModifierGrantEffect({
    spellName,
    grantedItemTemplate,
    grantedItemName,
    payloadNotes
}) {
    return effectBase({
        description: `${spellName}: Grant/Item`,
        applicationMode: "GrantItem",
        effectType: "Grant",
        effectSubtype: "Item",
        visible: true,
        targetType: "Item",
        targetRange: "Touch",
        targetDescription: "Chosen weapon or item.",
        payloadTarget: "Item",
        payloadOperation: "Grant",
        payloadValue: grantedItemName,
        grantedItemTemplate,
        grantedItemName,
        payloadNotes,
        durationType: "UntilBroken"
    });
}

const MANUAL_SPELLS = new Set([
    "Angelic Boon",
    "Auspicious Timing",
    "Banish",
    "Bind",
    "Black Sleep",
    "Command",
    "Curse of Withering",
    "Death Knots",
    "Evil Eye",
    "Exorcism",
    "Faith Manipulation",
    "Humoral Rebalancing",
    "Limbsnare",
    "Night Riding",
    "Nigredo",
    "Possess",
    "Refusal Rite",
    "Witch's Ladder",
]);

const READY_EFFECTS = {
    "Albedo": [
        createStepChangeEffect({ spellName: "Albedo", stat: "Power", steps: 3, targetType: "Self", targetRange: "Self", durationType: "Permanent" })
    ],
    "Bless Weapon": [
        createModifierGrantEffect({
            spellName: "Bless Weapon",
            grantedItemTemplate: "Item.YEmH08i9vPl49ZNu",
            grantedItemName: "Blessed",
            payloadNotes: "Attach the Blessed weapon modifier to the chosen weapon."
        })
    ],
    "Borrowed Pulse": [
        createEmptyEffect({
            spellName: "Borrowed Pulse",
            effectSubtype: "Borrowed Pulse",
            targetType: "Self",
            targetRange: "Self",
            durationType: "Scene",
            payloadNotes: "Empty shell for Borrowed Pulse while Stamina and HP changes are active."
        }),
        createStepChangeEffect({ spellName: "Borrowed Pulse", stat: "Stamina", steps: 1, targetType: "Self", targetRange: "Self", durationType: "Scene" }),
        createHpChangeEffect({ spellName: "Borrowed Pulse", targetPath: "CurrentHitPoints", amount: 2, targetType: "Self", targetRange: "Self", durationType: "Scene" })
    ],
    "Citrinitas": [
        createEmptyEffect({
            spellName: "Citrinitas",
            effectSubtype: "Citrinitas",
            targetType: "Self",
            targetRange: "Self",
            durationType: "Scene",
            payloadNotes: "Empty shell for Citrinitas while stat changes are active."
        }),
        createStepChangeEffect({ spellName: "Citrinitas", stat: "Intelligence", steps: 2, targetType: "Self", targetRange: "Self", durationType: "Scene" }),
        createStepChangeEffect({ spellName: "Citrinitas", stat: "Power", steps: 2, targetType: "Self", targetRange: "Self", durationType: "Scene" })
    ],
    "Cold Knot": [
        createEmptyEffect({
            spellName: "Cold Knot",
            effectSubtype: "Cold Knot",
            targetType: "Actor",
            durationType: "Scene",
            payloadNotes: "Empty shell for Cold Knot while stat penalties are active."
        }),
        createStepChangeEffect({ spellName: "Cold Knot", stat: "Stamina", steps: -2, targetType: "Actor", durationType: "Scene" }),
        createStepChangeEffect({ spellName: "Cold Knot", stat: "Strength", steps: -2, targetType: "Actor", durationType: "Scene" })
    ],
    "Consumption Oath": [
        createEmptyEffect({ spellName: "Consumption Oath", effectSubtype: "Consumption Oath", targetType: "Actor", durationType: "UntilBroken" })
    ],
    "Disease Knot": [
        createEmptyEffect({ spellName: "Disease Knot", effectSubtype: "Diseased", targetType: "Actor", durationType: "Days", durationValue: "1d6" })
    ],
    "Dream Warding": [
        createEmptyEffect({ spellName: "Dream Warding", effectSubtype: "Dream Warded", targetType: "Actor", durationType: "Days", durationValue: "1" })
    ],
    "Dread": [
        createEmptyEffect({ spellName: "Dread", effectSubtype: "Fear", targetType: "Actor", durationType: "Scene" })
    ],
    "Favor Knot": [
        createEmptyEffect({ spellName: "Favor Knot", effectSubtype: "Friendly", targetType: "Actor", durationType: "Days", durationValue: "1d6" })
    ],
    "Heart Twine": [
        createEmptyEffect({ spellName: "Heart Twine", effectSubtype: "Love Bound", targetType: "Actor", durationType: "Days", durationValue: "1d6" })
    ],
    "Ill Luck Knot": [
        createEmptyEffect({ spellName: "Ill Luck Knot", effectSubtype: "Bad Luck", targetType: "Actor", durationType: "Days", durationValue: "1d6" })
    ],
    "Ill Turning Loop": [
        createEmptyEffect({ spellName: "Ill Turning Loop", effectSubtype: "Curse Protection", targetType: "Actor", durationType: "Days", durationValue: "1d6" })
    ],
    "Lovebinding": [
        createEmptyEffect({ spellName: "Lovebinding", effectSubtype: "Deep Love Bound", targetType: "Actor", durationType: "Days", durationValue: "1d6" })
    ],
    "Oath Knot": [
        createEmptyEffect({ spellName: "Oath Knot", effectSubtype: "Oath Bound", targetType: "Actor", durationType: "UntilBroken" })
    ],
    "Prayer Against the Evil Eye": [
        createEmptyEffect({ spellName: "Prayer Against the Evil Eye", effectSubtype: "Evil Eye Protection", targetType: "Actor", durationType: "Days", durationValue: "1" })
    ],
    "Protection Rhyme": [
        createEmptyEffect({ spellName: "Protection Rhyme", effectSubtype: "Spirit Protection", targetType: "Actor", durationType: "Days", durationValue: "1" })
    ],
    "Protective Border": [
        createEmptyEffect({ spellName: "Protective Border", effectSubtype: "Spirit Protection", targetType: "Actor", durationType: "Days", durationValue: "1" })
    ],
    "Protective Circle": [
        createEmptyEffect({ spellName: "Protective Circle", effectSubtype: "Ritual Protection", targetType: "Actor", durationType: "Days", durationValue: "1" })
    ],
    "Rubedo": [
        createStepChangeEffect({ spellName: "Rubedo", stat: "Strength", steps: 1, targetType: "Self", targetRange: "Self", durationType: "Scene" }),
        createStepChangeEffect({ spellName: "Rubedo", stat: "Dexterity", steps: 1, targetType: "Self", targetRange: "Self", durationType: "Scene" }),
        createStepChangeEffect({ spellName: "Rubedo", stat: "Intelligence", steps: 1, targetType: "Self", targetRange: "Self", durationType: "Scene" }),
        createStepChangeEffect({ spellName: "Rubedo", stat: "Stamina", steps: 1, targetType: "Self", targetRange: "Self", durationType: "Scene" }),
        createStepChangeEffect({ spellName: "Rubedo", stat: "Charisma", steps: 1, targetType: "Self", targetRange: "Self", durationType: "Scene" })
    ],
    "Sanctify": [
        createEmptyEffect({ spellName: "Sanctify", effectSubtype: "Sanctified", targetType: "Actor", durationType: "Days", durationValue: "1" })
    ],
    "Shadow Attachment": [
        createEmptyEffect({ spellName: "Shadow Attachment", effectSubtype: "Shadowed", targetType: "Actor", durationType: "Days", durationValue: "1d6" })
    ],
    "Shapeshifting": [
        createEmptyEffect({ spellName: "Shapeshifting", effectSubtype: "Shape Changed", targetType: "Self", targetRange: "Self", durationType: "Scene" })
    ],
    "Spirit Sight": [
        createEmptyEffect({ spellName: "Spirit Sight", effectSubtype: "Spirit Sight", targetType: "Self", targetRange: "Self", durationType: "Scene" })
    ],
    "Still Tongue": [
        createEmptyEffect({ spellName: "Still Tongue", effectSubtype: "Silenced", targetType: "Actor", durationType: "Days", durationValue: "1d6" })
    ],
    "Tongue-Tying Knot": [
        createEmptyEffect({ spellName: "Tongue-Tying Knot", effectSubtype: "Silenced", targetType: "Actor", durationType: "Days", durationValue: "1d6" })
    ],
    "Transform Self": [
        createStepChangeEffect({ spellName: "Transform Self", stat: "Strength", steps: 1, targetType: "Self", targetRange: "Self", durationType: "Scene" }),
        createStepChangeEffect({ spellName: "Transform Self", stat: "Stamina", steps: 1, targetType: "Self", targetRange: "Self", durationType: "Scene" }),
        createStepChangeEffect({ spellName: "Transform Self", stat: "Dexterity", steps: 1, targetType: "Self", targetRange: "Self", durationType: "Scene" })
    ],
    "Truth Pressure": [
        createEmptyEffect({ spellName: "Truth Pressure", effectSubtype: "Truthful", targetType: "Actor", durationType: "Scene" })
    ],
    "Uncertain Knot": [
        createEmptyEffect({ spellName: "Uncertain Knot", effectSubtype: "Confused", targetType: "Actor", durationType: "Scene" })
    ],
    "Withering Knot": [
        createEmptyEffect({ spellName: "Withering Knot", effectSubtype: "Withering", targetType: "Actor", durationType: "UntilBroken" })
    ]
};

function main() {
    if (process.argv.includes("--stdout")) {
        const spells = readJson(SPELLS_PATH);
        let readyCount = 0;
        let manualCount = 0;
        for (const spell of spells) {
            if (MANUAL_SPELLS.has(spell.name)) {
                spell.successEffects = [];
                manualCount += 1;
                continue;
            }
            if (READY_EFFECTS[spell.name]) {
                spell.successEffects = READY_EFFECTS[spell.name];
                readyCount += 1;
            }
        }
        process.stderr.write(`Updated ${readyCount} ready spells and cleared successEffects for ${manualCount} manual spells.\n`);
        process.stdout.write(`${JSON.stringify(spells, null, 4)}\n`);
        return;
    }

    const outArgIndex = process.argv.indexOf("--out");
    const outPath = outArgIndex >= 0 && process.argv[outArgIndex + 1]
        ? path.resolve(process.argv[outArgIndex + 1])
        : SPELLS_PATH;
    const spells = readJson(SPELLS_PATH);
    let readyCount = 0;
    let manualCount = 0;

    for (const spell of spells) {
        if (MANUAL_SPELLS.has(spell.name)) {
            spell.successEffects = [];
            manualCount += 1;
            continue;
        }
        if (READY_EFFECTS[spell.name]) {
            spell.successEffects = READY_EFFECTS[spell.name];
            readyCount += 1;
        }
    }

    writeJson(outPath, spells);
    console.log(`Updated ${readyCount} ready spells and cleared successEffects for ${manualCount} manual spells -> ${outPath}`);
}

main();
