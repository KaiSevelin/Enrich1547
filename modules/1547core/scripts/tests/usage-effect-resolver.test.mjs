// Usage-effect action resolver — pure helpers (the spell/ritual effect
// engine's testable core; ADR-0004 sweep coverage).
import assert from "node:assert/strict";
import {
    getText,
    getBoolean,
    getNumericProp,
    buildRollFormula,
    normalizeEffectProps,
    isRangeSatisfied,
    buildStatFormulaFromActor,
    isSupportedCarrierItem,
} from "../services/usage-effect-action-resolver.js";

console.log("usage-effect.getText/getBoolean/getNumericProp...");
{
    assert.equal(getText({ A: " x " }, ["A"]), "x", "trims");
    assert.equal(getText({ A: "  " }, ["A", "B"], "fb"), "fb", "blank falls through to fallback");
    assert.equal(getText({ B: "y" }, ["A", "B"]), "y", "key order");
    assert.equal(getBoolean({ A: false }, ["A"], true), false, "explicit false wins over fallback");
    assert.equal(getBoolean({ A: "true" }, ["A"], false), false, "strings are NOT booleans here");
    assert.equal(getNumericProp({ A: "3" }, ["A"]), 3);
    assert.equal(getNumericProp({ A: "" }, ["A"]), null);
    console.log("  ✓ prop probes behave");
}

console.log("usage-effect.buildRollFormula...");
{
    assert.equal(buildRollFormula(3, 2), "3d6 + 2");
    assert.equal(buildRollFormula(3, 0), "3d6");
    assert.equal(buildRollFormula(-1, -5), "0d6", "negatives clamp to 0");
    console.log("  ✓ formula shape + clamping");
}

console.log("usage-effect.normalizeEffectProps...");
{
    const defaults = normalizeEffectProps({});
    assert.equal(defaults.ApplicationMode, "NarrativeOnly");
    assert.equal(defaults.EffectType, "Descriptive");
    assert.equal(defaults.TargetType, "Actor");
    assert.equal(defaults.TargetCount, "1");
    assert.equal(defaults.CheckType, "None");
    assert.equal(defaults.PayloadOperation, "Apply");
    assert.equal(defaults.DurationType, "Instant");
    assert.equal(defaults.Visible, true);

    // Reads both CSB item shape (system.props) and flat objects, and both
    // PascalCase and camelCase keys.
    const fromItem = normalizeEffectProps({ system: { props: { EffectType: "Mechanical", targetRange: "Touch" } } });
    assert.equal(fromItem.EffectType, "Mechanical");
    assert.equal(fromItem.TargetRange, "Touch");
    console.log("  ✓ defaults + CSB/flat + case-insensitive keys");
}

console.log("usage-effect.isRangeSatisfied (range-word branches)...");
{
    // These branches are pure (no canvas): empty / sight / voice / self /
    // placed / unparseable text are all treated as satisfied.
    for (const range of ["", "Sight", "voice", "Self", "Placed", "as the GM wills"]) {
        assert.equal(isRangeSatisfied(null, null, range), true, `range "${range}" passes without geometry`);
    }
    console.log("  ✓ non-geometric ranges always pass");
}

console.log("usage-effect.buildStatFormulaFromActor...");
{
    const actor = { system: { props: { StrengthDice: 3, StrengthMod: 2 } } };
    assert.equal(buildStatFormulaFromActor(actor, "Strength"), "3d6 + 2");
    assert.equal(buildStatFormulaFromActor(actor, "strength"), "3d6 + 2", "label is case-insensitive");
    assert.equal(buildStatFormulaFromActor(null, "Strength"), "", "no actor → empty");
    assert.equal(buildStatFormulaFromActor({ system: { props: {} } }, "NotAStat"), "", "unknown stat → empty");
    console.log("  ✓ stat formula from actor props");
}

console.log("usage-effect.isSupportedCarrierItem...");
{
    assert.equal(isSupportedCarrierItem({ system: { template: "definitely-not-a-carrier" } }), false);
    assert.equal(isSupportedCarrierItem(null), false);
    console.log("  ✓ rejects unknown/absent templates");
}

console.log("\nAll usage-effect resolver tests passed.");
