import assert from "assert";

/**
 * Behavioural test for the chargen template-parsing logic extracted from
 * chargen.js into chargen-template-parse.js + chargen-utils.js. Locks in the
 * parse output shapes so the extraction (and future edits) preserve behaviour —
 * coverage the 5,600-line chargen.js could never carry.
 */

// interface-registry.js (imported transitively) may touch foundry at import.
if (typeof globalThis.foundry === "undefined") {
    globalThis.foundry = { utils: { getProperty: (o, p) => p.split(".").reduce((a, k) => a?.[k], o) } };
}

const utils = await import("../chargen/chargen-utils.js");
const parse = await import("../chargen/chargen-template-parse.js");

console.log("chargen-utils: micro-helpers...");
{
    assert.strictEqual(utils.toBoolean("yes"), true);
    assert.strictEqual(utils.toBoolean("0"), false);
    assert.strictEqual(utils.toBoolean(2), true);
    assert.strictEqual(utils.numberOrNull("3"), 3);
    assert.strictEqual(utils.numberOrNull("x"), null);
    assert.strictEqual(utils.normalizeTemplateType("Skill"), "skill");
    assert.deepStrictEqual(utils.stringListFromCSV("a, b ,,c"), ["a", "b", "c"]);
    assert.strictEqual(utils.resultRawJSON({ description: "d", name: "n" }), "d");
    assert.strictEqual(utils.resultRawJSON({ name: "n" }), "n");
    console.log("  ✓ toBoolean / numberOrNull / normalizeTemplateType / stringListFromCSV / resultRawJSON");
}

console.log("\nchargen-template-parse: change builders...");
{
    const stat = parse.buildChangeFromTemplateReward(
        { R1Type: "stat", R1Characteristic: "Strength", R1Steps: "2" }, "R1");
    assert.deepStrictEqual(stat, { type: "stat", characteristic: "Strength", steps: 2 });

    const skill = parse.buildChangeFromTemplateReward(
        { R1Type: "skill", R1TargetKey: "perform", R1TargetLevel: "1" }, "R1");
    assert.deepStrictEqual(skill, { type: "skill", targetKey: "perform", targetLevel: 1 });

    const item = parse.buildChangeFromTemplateReward(
        { R1Type: "item", R1ItemName: "Dagger", R1Qty: "2", R1Stack: "true" }, "R1");
    assert.deepStrictEqual(item, { type: "item", name: "Dagger", qty: 2, stack: true });

    assert.strictEqual(
        parse.buildChangeFromTemplateReward({ R1Type: "nothing" }, "R1"), null);

    console.log("  ✓ buildChangeFromTemplateReward: stat / skill / item / nothing");
}

console.log("\nchargen-template-parse: effect rows + tables...");
{
    const drive = parse.buildChangeFromEffectRow({ Type: "drive", TargetKey: "add", Amount: "Greed" });
    assert.deepStrictEqual(drive, { type: "drive", action: "add", category: "Greed" });

    const table = parse.buildEffectTableFromProps(
        { Fx: { 0: { Type: "stat", TargetKey: "Faith", Amount: "1", Weight: "2" },
                1: { Type: "stat", Weight: "0" } } }, "Fx");
    assert.strictEqual(table.key, "Fx");
    assert.strictEqual(table.rows.length, 1, "weight-0 rows are filtered out");
    assert.strictEqual(table.rows[0].weight, 2);
    assert.deepStrictEqual(table.rows[0].change, { type: "stat", characteristic: "Faith", steps: 1 });

    assert.strictEqual(parse.buildEffectTableFromProps({ Fx: {} }, "Fx"), null);
    console.log("  ✓ buildChangeFromEffectRow + buildEffectTableFromProps (weight filtering)");
}

console.log("\nchargen-template-parse: parseTemplateItemToChoiceData...");
{
    let validatedWith = null;
    const validate = (parsed, name) => { validatedWith = { parsed, name }; };

    const rewardItem = {
        name: "A Gift",
        system: { props: {
            ChoiceTitle: "Gift", ChoiceTags: "boon,minor",
            Reward1Type: "money", Reward1Amount: "5", Reward1Weight: "1",
        } },
    };
    const parsed = parse.parseTemplateItemToChoiceData(rewardItem, "GiftTable", validate);
    assert.strictEqual(parsed.choice.title, "Gift");
    assert.deepStrictEqual(parsed.choice.tags, ["boon", "minor"]);
    assert.strictEqual(parsed.rewards.length, 1);
    assert.deepStrictEqual(parsed.rewards[0].changes, [{ type: "money", amount: 5 }]);
    assert.ok(validatedWith && validatedWith.name === "GiftTable", "validate callback is invoked");

    const fxItem = {
        name: "Fork",
        system: { props: {
            Effects1: { 0: { Type: "stat", TargetKey: "Luck", Amount: "1", Weight: "1" } },
        } },
    };
    const fxParsed = parse.parseTemplateItemToChoiceData(fxItem, "ForkTable");
    assert.strictEqual(fxParsed.effectTables.length, 1);
    assert.strictEqual(fxParsed.effectTables[0].rows[0].change.characteristic, "Luck");
    console.log("  ✓ reward-based + effect-table items parse; validate callback invoked");
}

console.log("\nchargen-template-parse: legacy single-reward backstop...");
{
    // No Reward{n} fields and no effect tables → exercises the single-reward
    // backstop. This branch previously threw a ReferenceError (out-of-scope
    // `prefix`); it must now parse and read top-level transition props.
    const legacy = {
        name: "Old Card",
        system: { props: {
            ChoiceTitle: "Old Card",
            Effect1Type: "money", Effect1Amount: "7",
            NextTableUuid: "RollTable.abc",
            TransitionMode: "Optional",
            TransitionPrompt: "Continue down this path?",
        } },
    };
    const parsed = parse.parseTemplateItemToChoiceData(legacy, "LegacyTable");
    assert.strictEqual(parsed.rewards.length, 1, "backstop produced one reward");
    assert.deepStrictEqual(parsed.rewards[0].changes, [{ type: "money", amount: 7 }]);
    assert.deepStrictEqual(parsed.rewards[0].next, { tableUuid: "RollTable.abc" });
    assert.strictEqual(parsed.rewards[0].transitionMode, "optional", "top-level TransitionMode read + lowercased");
    assert.strictEqual(parsed.rewards[0].transitionPrompt, "Continue down this path?");

    // Same shape without the transition props → must still parse (defaults to "").
    const noTransition = {
        name: "Old Card 2",
        system: { props: { ChoiceTitle: "Old Card 2", Effect1Type: "luck", Effect1On: "true" } },
    };
    const parsed2 = parse.parseTemplateItemToChoiceData(noTransition, "LegacyTable2");
    assert.strictEqual(parsed2.rewards[0].transitionMode, "");
    assert.deepStrictEqual(parsed2.rewards[0].changes, [{ type: "luck", on: true }]);
    console.log("  ✓ legacy single-reward item parses (no ReferenceError); reads top-level transitions");
}

console.log("\nchargen: stat-name change type tolerance...");
{
    // A stat name used directly as a change Type (the "Type: Faith" authoring
    // shorthand in some career templates) normalizes to a stat change instead
    // of crashing schema validation with `Unknown change type "faith"`.
    assert.strictEqual(utils.normalizeTemplateType("Faith"), "stat");
    assert.strictEqual(utils.normalizeTemplateType("Strength"), "stat");
    assert.strictEqual(utils.normalizeTemplateType("Stat"), "stat");
    assert.strictEqual(utils.normalizeTemplateType("skill"), "skill");

    // The full effect-row parse yields a valid stat change (TargetKey → characteristic).
    const ch = parse.buildChangeFromEffectRow({ Type: "Faith", TargetKey: "Faith", Amount: "1" });
    assert.deepStrictEqual(ch, { type: "stat", characteristic: "Faith", steps: 1 });
    console.log("  ✓ stat-name Type parses to a valid stat change");
}

console.log("\nAll chargen-template-parse tests passed.");
