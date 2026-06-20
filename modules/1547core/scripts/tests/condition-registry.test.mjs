import assert from "assert";

/**
 * Tests for condition-registry slug matching + the combat-grapple conditions.
 * Conditions are applied as ActiveEffects whose NAME is the condition; the
 * maneuvers emit lowercase/kebab names ("locked", "choking-hold") while the
 * registry keys are TitleCase ("Locked", "Choking Hold"). getActiveConditions
 * must resolve them by slug, and the combat grapples must impose disadvantage.
 */

const { getActiveConditions, conditionCombatDisadvantage, CONDITIONS } =
    await import("../services/condition-registry.js");

const actorWith = (...names) => ({ effects: { contents: names.map((name) => ({ name })) } });

console.log("condition slug matching...");
// Maneuver-emitted casing resolves to the canonical registry name.
assert.deepStrictEqual(getActiveConditions(actorWith("locked")), ["Locked"]);
assert.deepStrictEqual(getActiveConditions(actorWith("prone")), ["Prone"]);
assert.deepStrictEqual(getActiveConditions(actorWith("grappled")), ["Grappled"]);
assert.deepStrictEqual(getActiveConditions(actorWith("choking-hold")), ["Choking Hold"]);
console.log("  ✓ lowercase/kebab condition names resolve to canonical registry keys");

console.log("disabled + unknown effects...");
assert.deepStrictEqual(getActiveConditions({ effects: { contents: [{ name: "locked", disabled: true }] } }), []);
assert.deepStrictEqual(getActiveConditions(actorWith("not-a-condition")), []);
console.log("  ✓ disabled effects and non-conditions are ignored");

console.log("combat disadvantage...");
// Each of the four grapples is a combat condition (one disadvantage die).
assert.strictEqual(conditionCombatDisadvantage(actorWith("locked")), 1);
assert.strictEqual(conditionCombatDisadvantage(actorWith("prone")), 1);
assert.strictEqual(conditionCombatDisadvantage(actorWith("grappled")), 1);
assert.strictEqual(conditionCombatDisadvantage(actorWith("Choking Hold")), 1);
assert.strictEqual(conditionCombatDisadvantage(actorWith("prone", "grappled")), 2);
assert.strictEqual(conditionCombatDisadvantage(actorWith()), 0);
console.log("  ✓ combat grapples each impose one disadvantage die");

console.log("registry shape...");
for (const name of ["Locked", "Prone", "Grappled", "Choking Hold"]) {
    assert.strictEqual(CONDITIONS[name]?.combat, true, `${name} is a combat condition`);
}
console.log("  ✓ Locked/Prone/Grappled/Choking Hold are registered combat conditions");

console.log("condition-registry: all assertions passed");
