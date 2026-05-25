import assert from "assert";

/**
 * Tests for combat/attack-lifecycle.mjs and combat/maneuver-state.mjs.
 *
 * Both modules ship in pass A of the attack-lifecycle carve-up:
 *  - attack-lifecycle.mjs holds the self-contained pure helpers
 *    (modifier summary/merging, reserved-cost gathering, roll-summary
 *    normalisation, pending-attack tagging, equipped-armor probe).
 *  - maneuver-state.mjs holds the two patch-returners for maneuver
 *    resource spending + committed-maneuver flag updates, plus the
 *    pure buildCommittedManeuverRecord.
 *
 * Pass B (next round) will move the imperative lifecycle functions
 * (resolveAttackOutcome, declareAttack, executeResolvedReaction, ...)
 * into attack-lifecycle.mjs and they'll start returning
 * `{ events, patches }`. These tests grow then.
 */

const al = await import("../combat/attack-lifecycle.mjs");
const ms = await import("../combat/maneuver-state.mjs");

// ────────────────────────────────────────── modifier summarisation ──

console.log("attack-lifecycle.summarizeEffectData...");

assert.deepStrictEqual(
    al.summarizeEffectData({}),
    {
        addMainDice: 0, addDisadvantage: 0, addMultiplierDice: 0,
        addRiskDice: 0, addMoveSquares: 0, safeAttack: false,
    },
    "zero defaults across the board"
);
assert.strictEqual(
    al.summarizeEffectData({ createFreeSafeAttack: true }).safeAttack,
    true,
    "any safe-attack flavour flips safeAttack to true"
);
assert.strictEqual(
    al.summarizeEffectData({ ifEscapeSucceedsCreateFreeSafeAttack: true }).safeAttack,
    true
);
console.log("  ✓ zero defaults + safeAttack triggers");

console.log("\nattack-lifecycle.mergeModifierSummaries...");
{
    const out = al.mergeModifierSummaries(
        { addMainDice: 2, safeAttack: false },
        { addMainDice: 3, addRiskDice: 1, safeAttack: true }
    );
    assert.strictEqual(out.addMainDice, 5);
    assert.strictEqual(out.addRiskDice, 1);
    assert.strictEqual(out.safeAttack, true);
    console.log("  ✓ sums numerics; safeAttack OR'd");
}

console.log("\nattack-lifecycle.mergeManeuverEffects...");
{
    const m1 = { effectData: { addMainDice: 1, addRiskDice: 2, createFreeSafeAttack: true } };
    const m2 = { effectData: { addMainDice: 3 } };
    const out = al.mergeManeuverEffects([m1, m2]);
    assert.strictEqual(out.addMainDice, 4);
    assert.strictEqual(out.addRiskDice, 2);
    assert.strictEqual(out.safeAttack, true);
    console.log("  ✓ folds many maneuvers; createsSafeAttack rule propagates");
}

console.log("\nattack-lifecycle.normalizeDefenseModifiers...");
{
    const out = al.normalizeDefenseModifiers({
        defenseReaction: { effectData: { addArmorDice: 1, reduceDamageTaken: 2 } },
        damageTakenReaction: { effectData: { lockParryingWeaponUntil: "endOfTurn", createFreeSafeCounterattack: true } },
    });
    assert.strictEqual(out.addArmorDice, 1);
    assert.strictEqual(out.reduceDamageTaken, 2);
    assert.strictEqual(out.lockParryingWeaponUntil, "endOfTurn");
    assert.strictEqual(out.safeCounterattack, true);
    console.log("  ✓ collects both reactions; nulls collapse cleanly");
}

console.log("\nattack-lifecycle.normalizeAppliedAttackModifiers...");
assert.deepStrictEqual(
    al.normalizeAppliedAttackModifiers({ addMainDice: 2, addMoveSquares: 3 }),
    { addMainDice: 2, addDisadvantage: 0, addMultiplierDice: 0, addRiskDice: 0, addMoveSquares: 3, safeAttack: false }
);
console.log("  ✓ fills missing keys with 0/false");

// ────────────────────────────────────────── reserved costs ──

console.log("\nattack-lifecycle.collectReservedCosts...");
{
    const maneuvers = [
        { _id: "m1", CostType: "StaminaPoints", CostAmount: 2 },
        { _id: "m2", CostType: "null", CostAmount: 0 },        // skipped
        { _id: "m3", CostAmount: 5 },                          // skipped (no CostType)
        { _id: "m4", CostType: "CriticalPoints", CostAmount: 1 },
    ];
    const out = al.collectReservedCosts(maneuvers);
    assert.strictEqual(out.length, 2);
    assert.deepStrictEqual(out[0], { maneuverId: "m1", costType: "StaminaPoints", costAmount: 2 });
    assert.deepStrictEqual(out[1], { maneuverId: "m4", costType: "CriticalPoints", costAmount: 1 });
    console.log("  ✓ filters out 'null' and missing CostType");
}

// ────────────────────────────────────────── roll summary ──

console.log("\nattack-lifecycle.normalizeRollSummary...");
assert.deepStrictEqual(
    al.normalizeRollSummary(null),
    { damage: 0, protection: 0, crit: 0, fumble: 0, multiplier: 1 }
);
assert.deepStrictEqual(
    al.normalizeRollSummary({ damage: 4, multiplier: 2 }),
    { damage: 4, protection: 0, crit: 0, fumble: 0, multiplier: 2 }
);
console.log("  ✓ defaults missing fields, preserves multiplier");

// ────────────────────────────────────────── pending-attack tag ──

console.log("\nattack-lifecycle.isPendingAttack / PENDING_ATTACK_KIND...");
assert.strictEqual(al.PENDING_ATTACK_KIND, "1547core.pendingAttack");
assert.strictEqual(al.isPendingAttack({ kind: al.PENDING_ATTACK_KIND }), true);
assert.strictEqual(al.isPendingAttack({ kind: "something-else" }), false);
assert.strictEqual(al.isPendingAttack(null), false);
console.log("  ✓ tag constant + predicate");

// ────────────────────────────────────────── actorHasEquippedArmor ──

console.log("\nattack-lifecycle.actorHasEquippedArmor...");
{
    const actorWithArmor = {
        items: { contents: [{
            type: "armor",
            system: { props: { Equipped: true } },
            flags: {},
        }] },
    };
    assert.strictEqual(al.actorHasEquippedArmor(actorWithArmor), true);

    const actorNoArmor = { items: { contents: [{ system: { props: {} } }] } };
    assert.strictEqual(al.actorHasEquippedArmor(actorNoArmor), false);

    const actorUnequippedArmor = {
        items: { contents: [{
            type: "armor",
            system: { props: { ArmorType: "Medium", Equipped: false } },
            flags: {},
        }] },
    };
    assert.strictEqual(al.actorHasEquippedArmor(actorUnequippedArmor), false,
        "armor on the actor but not equipped → false");
    console.log("  ✓ recognises armor and respects Equipped flag");
}

// ────────────────────────────────────────── maneuver-state ──

console.log("\nmaneuver-state.buildCommittedManeuverRecord...");
{
    const rec = ms.buildCommittedManeuverRecord({
        _id: "m1",
        name: "Overwatch",
        type: "full-turn",
        effectData: { duration: "until-consumed", createsPersistentEffect: "overwatch" },
    });
    assert.strictEqual(rec.id, "m1");
    assert.strictEqual(rec.duration, "until-consumed");
    assert.strictEqual(rec.createsPersistentEffect, "overwatch");
    assert.ok(typeof rec.committedAt === "number");
    console.log("  ✓ snapshots id / duration / persistent-effect from effectData");
}

console.log("\nmaneuver-state.planSpendActorManeuverCost...");
{
    const actor = { id: "a", system: { props: { StaminaPoints: 5 } } };
    const m = { CostType: "StaminaPoints", CostAmount: 2 };
    const { patches, result } = ms.planSpendActorManeuverCost(actor, m);
    assert.strictEqual(patches.length, 1);
    assert.strictEqual(patches[0].kind, "actor.update");
    assert.strictEqual(patches[0].data["system.props.StaminaPoints"], 3);
    assert.strictEqual(result.previousValue, 5);
    assert.strictEqual(result.nextValue, 3);
    console.log("  ✓ produces an actor.update patch decrementing the resource");
}

{
    const out = ms.planSpendActorManeuverCost(
        { id: "a" },
        { CostType: "null", CostAmount: 5 }
    );
    assert.deepStrictEqual(out, { patches: [], result: null },
        "CostType 'null' → no patches");
    console.log("  ✓ CostType 'null': no patches");
}

{
    const out = ms.planSpendActorManeuverCost(
        { id: "a", system: { props: { StaminaPoints: 1 } } },
        { CostType: "StaminaPoints", CostAmount: 5 }
    );
    assert.strictEqual(out.patches[0].data["system.props.StaminaPoints"], 0,
        "clamped to 0 when cost > available");
    console.log("  ✓ clamped at 0 when cost exceeds available");
}

console.log("\nmaneuver-state.planAppendCommittedManeuverState...");
{
    const actor = {
        id: "a",
        flags: { "1547core": { activeFullTurnManeuvers: [{ id: "m1", name: "Old" }] } },
    };
    const record = { id: "m2", name: "New", effectData: {} };
    const { patches, result } = ms.planAppendCommittedManeuverState(actor, record);
    assert.strictEqual(patches.length, 1);
    const updateKey = "flags.1547core.activeFullTurnManeuvers";
    assert.strictEqual(patches[0].data[updateKey].length, 2);
    assert.strictEqual(patches[0].data[updateKey][1].id, "m2");
    assert.strictEqual(result.appended, true);
    console.log("  ✓ appends new record; preserves prior entries");
}

{
    // Replacing the same id should NOT duplicate
    const actor = {
        id: "a",
        flags: { "1547core": { activeFullTurnManeuvers: [{ id: "m1", name: "Old" }] } },
    };
    const record = { id: "m1", name: "Updated" };
    const { patches } = ms.planAppendCommittedManeuverState(actor, record);
    const list = patches[0].data["flags.1547core.activeFullTurnManeuvers"];
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].name, "Updated");
    console.log("  ✓ replaces existing entry with the same id (no duplicates)");
}

{
    const out = ms.planAppendCommittedManeuverState({ id: "a" }, { id: null });
    assert.deepStrictEqual(out, { patches: [], result: { appended: false } });
    console.log("  ✓ no patches when record has no id");
}

console.log("\nAll attack-lifecycle + maneuver-state tests passed.");
