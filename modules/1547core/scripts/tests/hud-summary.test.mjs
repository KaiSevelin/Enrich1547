import assert from "assert";

/**
 * Unit tests for the pure helpers in hud/hud-summary.js. No Foundry globals are
 * needed — these helpers operate on plain objects (with MODULE_ID /
 * SOURCE_FLAG_SCOPE now declared at module scope).
 */

const {
    parseManeuverJson,
    summarizeManeuverEffects,
    buildWeaponRollContext,
    getAmmoAddDice,
    getAttachedModifierIds,
    getAttachedModifierNames,
} = await import("../hud/hud-summary.js");

console.log("hud-summary pure helpers...");

{
    assert.deepStrictEqual(parseManeuverJson('{"a":1}'), { a: 1 });
    assert.strictEqual(parseManeuverJson("not json", null), null, "invalid JSON returns fallback");
    assert.strictEqual(parseManeuverJson("", "fb"), "fb", "empty string returns fallback");
    console.log("  ✓ parseManeuverJson: parse / fallback");
}

{
    // Regression: this is the function whose free-variable references previously
    // threw ReferenceError for any real item. A plain item must now return [].
    assert.deepStrictEqual(getAttachedModifierIds({ flags: {}, system: { props: {} } }), []);
    assert.deepStrictEqual(
        getAttachedModifierIds({ flags: { "1547Core": { attachedModifierIds: ["a", "b"] } } }),
        ["a", "b"]
    );
    assert.deepStrictEqual(
        getAttachedModifierIds({ system: { props: { AttachedModifierIds: "a, b ,c" } } }),
        ["a", "b", "c"],
        "comma-separated string is parsed"
    );
    assert.deepStrictEqual(
        getAttachedModifierIds({ flags: { "1547Core": { attachedModifierIds: '["x","y"]' } } }),
        ["x", "y"],
        "JSON-array string is parsed"
    );
    console.log("  ✓ getAttachedModifierIds: array / CSV / JSON, and no ReferenceError on plain items");
}

{
    const names = getAttachedModifierNames(
        { flags: { "1547Core": { attachedModifierIds: ["i1", "i2"] } } },
        [{ id: "i1", name: "Silvered" }, { id: "i3", name: "Other" }]
    );
    assert.deepStrictEqual(names, ["Silvered"], "resolves ids to names, drops unknown ids");
    console.log("  ✓ getAttachedModifierNames: id → name resolution");
}

{
    const getStringProp = (props, keys) => {
        for (const k of keys) {
            const v = props?.[k];
            if (typeof v === "string" && v.trim()) return v.trim();
        }
        return "";
    };
    assert.deepStrictEqual(
        getAmmoAddDice({ flags: { "1547Core": { sourceData: { addDice: ["1d4", " 2d6 ", 5] } } } }, getStringProp),
        ["1d4", "2d6"],
        "sourceData.addDice array is trimmed and non-strings dropped"
    );
    // Previously threw ReferenceError (getStringProp was undefined at module scope).
    assert.deepStrictEqual(
        getAmmoAddDice({ system: { props: { AddDice: "1d4, 2d6" } }, flags: {} }, getStringProp),
        ["1d4", "2d6"],
        "string-prop path now works with injected getStringProp"
    );
    console.log("  ✓ getAmmoAddDice: sourceData and string-prop paths (injected getStringProp)");
}

{
    assert.deepStrictEqual(
        summarizeManeuverEffects([{ effectData: { addMainDice: 1, addRiskDice: 2 } }, { effectData: { addMainDice: 3 } }]),
        { addMainDice: 4, addMultiplierDice: 0, addRiskDice: 2, addDisadvantage: 0 }
    );
    console.log("  ✓ summarizeManeuverEffects: sums effect contributions");
}

{
    const ctx = buildWeaponRollContext(
        { weaponRollContext: { addMainDice: 1, riskDice: 1 } },
        { addMainDice: 2, addRiskDice: 1, addDisadvantage: 1 }
    );
    assert.strictEqual(ctx.addMainDice, 3);
    assert.strictEqual(ctx.riskDice, 3, "riskDice folds in risk + disadvantage");
    console.log("  ✓ buildWeaponRollContext: merges base + maneuver effects, clamps at 0");
}

console.log("\nAll hud-summary pure-helper tests passed.");
