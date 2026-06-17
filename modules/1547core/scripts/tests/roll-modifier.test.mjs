import assert from "assert";
import { applyRollClickModifier } from "../lib/roll-modifier.mjs";

console.log("roll-modifier.applyRollClickModifier...");

// No modifier / no formula → returned unchanged.
assert.strictEqual(applyRollClickModifier("2d6 + 3", null), "2d6 + 3");
assert.strictEqual(applyRollClickModifier("2d6", undefined), "2d6");
assert.strictEqual(applyRollClickModifier("", "advantage"), "");
console.log("  ✓ null modifier / empty formula passes through");

// Advantage → +1 die on the first dice term; a flat bonus is kept.
assert.strictEqual(applyRollClickModifier("2d6", "advantage"), "3d6");
assert.strictEqual(applyRollClickModifier("1d6 + 3", "advantage"), "2d6 + 3");
assert.strictEqual(applyRollClickModifier("1da", "advantage"), "2da");
console.log("  ✓ advantage adds a die and keeps the flat bonus");

// Disadvantage → -1 die (floor at 1) AND strip a trailing flat "+N".
assert.strictEqual(applyRollClickModifier("2d6", "disadvantage"), "1d6");
assert.strictEqual(applyRollClickModifier("1d6", "disadvantage"), "1d6"); // floor
assert.strictEqual(applyRollClickModifier("1d6 + 3", "disadvantage"), "1d6"); // strips flat bonus
assert.strictEqual(applyRollClickModifier("3d6 + 2", "disadvantage"), "2d6"); // strips flat bonus
console.log("  ✓ disadvantage removes a die (min 1) and strips the trailing flat bonus");

// Disadvantage keeps a pure-dice term (only a flat numeric +N is stripped).
assert.strictEqual(applyRollClickModifier("2d6 + 1dr", "disadvantage"), "1d6 + 1dr");
console.log("  ✓ disadvantage keeps pure-dice terms");

// No dice term at all → unchanged.
assert.strictEqual(applyRollClickModifier("5", "advantage"), "5");
assert.strictEqual(applyRollClickModifier("5", "disadvantage"), "5");
console.log("  ✓ formula with no dice term is left alone");

console.log("\nroll-modifier.test.mjs — all assertions passed.");
