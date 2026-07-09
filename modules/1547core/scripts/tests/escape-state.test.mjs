import assert from "assert";
import { planEscapeConditions, statCheckFormula, escapeSucceeds } from "../combat/escape-state.mjs";

console.log("escape-state.planEscapeConditions...");
{
    const held = new Set(["Grappled", "Locked"]);
    const holds = (name) => held.has(name);

    // Core Escape: clears every listed condition the actor currently holds.
    const core = { removesCondition: ["Grappled", "Locked", "Choking Hold"], removesAllHeld: true };
    assert.deepStrictEqual(planEscapeConditions(core, holds), ["Grappled", "Locked"],
        "removesAllHeld → only the held ones");

    // Single-condition escape (Stand Up) is returned as-is, regardless of held check.
    assert.deepStrictEqual(planEscapeConditions({ removesCondition: "Prone" }, () => false), ["Prone"]);

    // Nothing to remove.
    assert.deepStrictEqual(planEscapeConditions({}, holds), []);
    console.log("  ✓ removesAllHeld filters to held; single passes through; empty is []");
}

console.log("\nescape-state.statCheckFormula...");
{
    const props = { Stats_DexterityDice: 2, Stats_DexterityMod: 3, Stats_StrengthDice: 1, Stats_StrengthMod: 0 };
    assert.strictEqual(statCheckFormula(props, "Dexterity"), "2d6 + 3");
    assert.strictEqual(statCheckFormula(props, "Strength"), "1d6", "zero mod omitted");
    assert.strictEqual(statCheckFormula({}, "Strength"), "1d6", "missing dice → at least 1d6");
    console.log("  ✓ builds <dice>d6 (+ mod); floors to 1 die; omits zero mod");
}

console.log("\nescape-state.escapeSucceeds...");
{
    assert.strictEqual(escapeSucceeds(7, 5), true, "higher wins");
    assert.strictEqual(escapeSucceeds(5, 5), true, "tie breaks free");
    assert.strictEqual(escapeSucceeds(4, 5), false, "lower fails");
    assert.strictEqual(escapeSucceeds(1, null), true, "uncontested → succeeds");
    console.log("  ✓ escaper breaks free on a tie or better; uncontested succeeds");
}

console.log("\nescape-state.test.mjs — all assertions passed.");
