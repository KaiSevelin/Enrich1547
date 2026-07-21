import assert from "assert";

/**
 * Test suite for encumbrance-service.js
 *
 * CurrentWeight = Σ Weight (× Quantity where present) over embedded items
 * whose template is one of the inventory templates. syncCurrentWeight writes
 * only on drift (loop safety for the renderActorSheet backfill).
 */

if (typeof globalThis.game === "undefined") globalThis.game = { modules: { get: () => ({ api: {} }) }, user: { id: "u1" } };
if (typeof globalThis.Hooks === "undefined") globalThis.Hooks = { on: () => {}, off: () => {} };

const { computeCurrentWeight, syncCurrentWeight } = await import("../services/encumbrance-service.js");

const WEAPON = "qZCfLEYQ7egbm1B9";
const AMMO = "389uqkKKn8M1SKux";
const CHANGESET = "b7A1z6cSZO4dYTKT"; // NOT inventory

function item(template, props) {
    return { system: { template, props } };
}
function actor(items, props = {}) {
    const calls = [];
    return {
        a: {
            documentName: "Actor", type: "character",
            system: { props }, items,
            async update(data) { calls.push(data); }
        },
        calls
    };
}

console.log("computeCurrentWeight...");

{
    const { a } = actor([
        item(WEAPON, { Weight: 3 }),
        item(WEAPON, { Weight: "1.5" }),
        item(AMMO, { Weight: 0.1, Quantity: 20 }),
        item(CHANGESET, { Weight: 999 }),           // non-inventory: ignored
        item(WEAPON, { Weight: "not-a-number" }),   // garbage: 0
        item(WEAPON, {})                            // no weight: 0
    ]);
    assert.strictEqual(computeCurrentWeight(a), 6.5); // 3 + 1.5 + 2
    console.log("  ✓ Sums Weight×Quantity over inventory templates only, tolerates garbage");
}

{
    assert.strictEqual(computeCurrentWeight({ items: [] }), 0);
    assert.strictEqual(computeCurrentWeight(null), 0);
    console.log("  ✓ Empty/missing actor → 0");
}

console.log("syncCurrentWeight...");

{
    const { a, calls } = actor([item(WEAPON, { Weight: 2 })], { CurrentWeight: 0 });
    await syncCurrentWeight(a);
    assert.deepStrictEqual(calls, [{ "system.props.CurrentWeight": 2 }]);
    console.log("  ✓ Writes the prop when it drifted");
}

{
    const { a, calls } = actor([item(WEAPON, { Weight: 2 })], { CurrentWeight: 2 });
    await syncCurrentWeight(a);
    assert.strictEqual(calls.length, 0);
    console.log("  ✓ No write when already correct (render-hook loop safety)");
}

{
    const { a, calls } = actor([item(WEAPON, { Weight: 2 })], { CurrentWeight: 2 });
    a.type = "_template";
    await syncCurrentWeight({ ...a, type: "_template" });
    assert.strictEqual(calls.length, 0);
    console.log("  ✓ Skips _template actors");
}

console.log("\nAll encumbrance-service tests passed.");
