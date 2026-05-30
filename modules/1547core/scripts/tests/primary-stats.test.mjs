import assert from "assert";

const {
    getDefaultMaxHitPointsFromProps,
    getStoredOrDefaultMaxHitPoints,
    buildAdvanceStatUpdateFromProps,
    buildSetStatUpdateFromProps,
} = await import("../services/primary-stats.js");

console.log("primary-stats helpers...");

{
    const props = {
        Stats_StrengthDice: 2,
        Stats_StaminaDice: 3,
        Stats_DexterityDice: 1,
    };
    assert.strictEqual(getDefaultMaxHitPointsFromProps(props), 6);
    assert.strictEqual(getStoredOrDefaultMaxHitPoints({ ...props, MaxHitPoints: 8 }), 8);
    assert.strictEqual(getStoredOrDefaultMaxHitPoints(props), 6);
    console.log("  ✓ max HP resolves from stored value or derived dice total");
}

{
    const props = {
        Stats_StrengthDice: 1,
        Stats_StrengthMod: 3,
        Stats_StaminaDice: 1,
        Stats_DexterityDice: 1,
        MaxHitPoints: 3,
    };
    const result = buildAdvanceStatUpdateFromProps(props, "Strength", 1);
    assert.deepStrictEqual(result.update, {
        "system.props.Stats_StrengthDice": 2,
        "system.props.Stats_StrengthMod": 0,
        "system.props.MaxHitPoints": 4,
    });
    console.log("  ✓ advancing a body stat across a dice boundary increases max HP by 1");
}

{
    const props = {
        Stats_StrengthDice: 2,
        Stats_StrengthMod: 0,
        Stats_StaminaDice: 1,
        Stats_DexterityDice: 1,
        MaxHitPoints: 4,
    };
    const result = buildAdvanceStatUpdateFromProps(props, "Strength", -1);
    assert.deepStrictEqual(result.update, {
        "system.props.Stats_StrengthDice": 1,
        "system.props.Stats_StrengthMod": 3,
        "system.props.MaxHitPoints": 3,
    });
    console.log("  ✓ reducing a body stat across a dice boundary decreases max HP by 1");
}

{
    const props = {
        Stats_StrengthDice: 1,
        Stats_StrengthMod: 1,
        Stats_StaminaDice: 2,
        Stats_DexterityDice: 2,
        MaxHitPoints: 5,
    };
    const result = buildAdvanceStatUpdateFromProps(props, "Strength", 1);
    assert.deepStrictEqual(result.update, {
        "system.props.Stats_StrengthDice": 1,
        "system.props.Stats_StrengthMod": 2,
        "system.props.MaxHitPoints": 5,
    });
    console.log("  ✓ changing only steps within the same die count leaves max HP unchanged");
}

{
    const props = {
        Stats_PowerDice: 1,
        Stats_PowerMod: 3,
        Stats_StrengthDice: 1,
        Stats_StaminaDice: 1,
        Stats_DexterityDice: 1,
        MaxHitPoints: 3,
    };
    const result = buildAdvanceStatUpdateFromProps(props, "Power", 1);
    assert.deepStrictEqual(result.update, {
        "system.props.Stats_PowerDice": 2,
        "system.props.Stats_PowerMod": 0,
    });
    console.log("  ✓ non-body stats do not change max HP");
}

{
    const props = {
        Stats_DexterityDice: 1,
        Stats_DexterityMod: 2,
        Stats_StrengthDice: 1,
        Stats_StaminaDice: 1,
        MaxHitPoints: 3,
    };
    const result = buildSetStatUpdateFromProps(props, "Dexterity", 3, 0);
    assert.deepStrictEqual(result.update, {
        "system.props.Stats_DexterityDice": 3,
        "system.props.Stats_DexterityMod": 0,
        "system.props.MaxHitPoints": 5,
    });
    console.log("  ✓ setting a body stat adjusts max HP by the dice delta");
}

console.log("\nAll primary-stats helper tests passed.");
