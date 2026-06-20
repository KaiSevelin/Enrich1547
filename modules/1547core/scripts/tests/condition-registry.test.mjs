import assert from "assert";

/**
 * Tests for condition-registry slug matching + the combat-grapple conditions.
 * Conditions are applied as ActiveEffects whose NAME is the condition; the
 * maneuvers emit lowercase/kebab names ("locked", "choking-hold") while the
 * registry keys are TitleCase ("Locked", "Choking Hold"). getActiveConditions
 * must resolve them by slug, and the combat grapples must impose disadvantage.
 */

const { getActiveConditions, conditionCombatDisadvantage, conditionAttackersAdvantage, registerConditionStatusEffects, CONDITIONS } =
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

console.log("Prone scoping + attackers advantage...");
// Prone disadvantages ATTACKS only; Locked/Grappled hit both attack and defence.
assert.strictEqual(conditionCombatDisadvantage(actorWith("prone"), "attack"), 1);
assert.strictEqual(conditionCombatDisadvantage(actorWith("prone"), "defense"), 0);
assert.strictEqual(conditionCombatDisadvantage(actorWith("locked"), "defense"), 1);
assert.strictEqual(conditionCombatDisadvantage(actorWith("locked"), "attack"), 1);
// A general affliction (Cursed) still hits both.
assert.strictEqual(conditionCombatDisadvantage(actorWith("cursed"), "defense"), 1);
// Attackers gain advantage against a prone target only.
assert.strictEqual(conditionAttackersAdvantage(actorWith("prone")), 1);
assert.strictEqual(conditionAttackersAdvantage(actorWith("grappled")), 0);
console.log("  ✓ Prone = attack-only disadvantage + grants attackers advantage");

console.log("itemised modifier sources...");
const { conditionDisadvantageSources, conditionAttackersAdvantageSources } =
    await import("../services/condition-registry.js");
assert.deepStrictEqual(conditionDisadvantageSources(actorWith("prone"), "attack"), [{ name: "Prone", dice: 1 }]);
assert.deepStrictEqual(conditionDisadvantageSources(actorWith("prone"), "defense"), []);
assert.deepStrictEqual(conditionAttackersAdvantageSources(actorWith("prone")), [{ name: "Prone", dice: 1 }]);
assert.deepStrictEqual(conditionAttackersAdvantageSources(actorWith("locked")), []);
console.log("  ✓ source helpers name each modifier for the chat breakdown");

console.log("registry shape...");
for (const name of ["Locked", "Prone", "Grappled", "Choking Hold"]) {
    assert.strictEqual(CONDITIONS[name]?.combat, true, `${name} is a combat condition`);
}
console.log("  ✓ Locked/Prone/Grappled/Choking Hold are registered combat conditions");

console.log("condition flags...");
assert.strictEqual(CONDITIONS.Prone.attackersAdvantage, 1);
assert.strictEqual(CONDITIONS["Choking Hold"].inflictorAttackEachRound, "unarmed");
for (const name of ["Locked", "Prone", "Grappled", "Choking Hold"]) {
    assert.strictEqual(typeof CONDITIONS[name].img, "string", `${name} has a status icon`);
}
console.log("  ✓ combat conditions carry attacker/round flags + an icon");

console.log("status-effect registration...");
// registerConditionStatusEffects appends each registry condition to CONFIG.statusEffects
// (by slug id), idempotently, with an icon.
const fakeConfig = { statusEffects: [{ id: "dead" }] };
globalThis.CONFIG = fakeConfig;
registerConditionStatusEffects();
registerConditionStatusEffects(); // idempotent
const grappledStatus = fakeConfig.statusEffects.filter((s) => s.id === "grappled");
assert.strictEqual(grappledStatus.length, 1, "registered once (idempotent)");
assert.strictEqual(grappledStatus[0].name, "Grappled");
assert.strictEqual(typeof grappledStatus[0].img, "string");
assert.ok(fakeConfig.statusEffects.some((s) => s.id === "choking-hold"), "kebab id for multi-word name");
delete globalThis.CONFIG;
console.log("  ✓ registerConditionStatusEffects adds conditions idempotently");

console.log("condition-registry: all assertions passed");
