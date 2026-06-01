import assert from "assert";

/**
 * Test suite for tier-display-service.js
 *
 * Covers the pure computeBoostTier — counts attached Boost-group
 * ChangeSets, ignores other groups, ignores non-ChangeSet items.
 */

if (typeof globalThis.game === "undefined") globalThis.game = { modules: { get: () => ({ api: {} }) } };
if (typeof globalThis.Hooks === "undefined") globalThis.Hooks = { on: () => {}, off: () => {} };

const { computeBoostTier, computeBoostSummary } = await import("../services/tier-display-service.js");

const CHANGESET_ID = "b7A1z6cSZO4dYTKT";

function set(group, { template = CHANGESET_ID, name = group } = {}) {
    return { name, system: { template, props: { Group: group } } };
}

function boost(name) {
    return { name, system: { template: CHANGESET_ID, props: { Group: "Boost" } } };
}

console.log("computeBoostTier...");

assert.strictEqual(computeBoostTier(null), 0);
assert.strictEqual(computeBoostTier({}), 0);
console.log("  ✓ Defensive: null / empty actor → 0");

assert.strictEqual(computeBoostTier({ items: [] }), 0);
console.log("  ✓ Empty items → 0");

{
    const actor = {
        items: [
            set("Role"),
            set("Domain"),
            set("Motivation"),
            set("Loadout"),
            set("Quirk")
        ]
    };
    assert.strictEqual(computeBoostTier(actor), 0);
    console.log("  ✓ Non-Boost groups don't contribute");
}

{
    const actor = {
        items: [
            set("Boost"),
            set("Boost"),
            set("Boost")
        ]
    };
    assert.strictEqual(computeBoostTier(actor), 3);
    console.log("  ✓ Counts attached Boosts");
}

{
    const actor = {
        items: [
            set("Boost"),
            set("Domain"),
            set("Boost"),
            set("Role"),
            set("Boost")
        ]
    };
    assert.strictEqual(computeBoostTier(actor), 3);
    console.log("  ✓ Mixed groups: counts only Boosts");
}

{
    const actor = {
        items: [
            set("Boost"),
            set("Boost", { template: "some-other-template" }),
            { system: { props: { Group: "Boost" } } }
        ]
    };
    assert.strictEqual(computeBoostTier(actor), 1);
    console.log("  ✓ Ignores items whose template isn't a ChangeSet");
}

{
    const actor = {
        items: [
            { system: { template: CHANGESET_ID, props: { Group: " Boost " } } },
            { system: { template: CHANGESET_ID, props: { Group: "Boost" } } }
        ]
    };
    assert.strictEqual(computeBoostTier(actor), 2);
    console.log("  ✓ Trims whitespace on Group");
}

console.log("\ncomputeBoostSummary...");

assert.deepStrictEqual(computeBoostSummary(null), []);
assert.deepStrictEqual(computeBoostSummary({}), []);
assert.deepStrictEqual(computeBoostSummary({ items: [] }), []);
console.log("  ✓ Defensive: null / empty → []");

{
    const actor = { items: [boost("Boost: Strength"), boost("Boost: Dexterity")] };
    assert.deepStrictEqual(computeBoostSummary(actor), [
        { name: "Strength", count: 1 },
        { name: "Dexterity", count: 1 }
    ]);
    console.log("  ✓ Strips 'Boost:' prefix and preserves order");
}

{
    const actor = {
        items: [
            boost("Boost: Strength"),
            boost("Boost: Strength"),
            boost("Boost: Dexterity"),
            boost("Boost: Weapon Die"),
            boost("Boost: Weapon Die"),
            boost("Boost: Strength")
        ]
    };
    assert.deepStrictEqual(computeBoostSummary(actor), [
        { name: "Strength", count: 3 },
        { name: "Dexterity", count: 1 },
        { name: "Weapon Die", count: 2 }
    ]);
    console.log("  ✓ Groups by name and counts");
}

{
    const actor = { items: [boost("Boost: Strength"), set("Role", { name: "Wolf" }), boost("Boost: Dexterity")] };
    assert.deepStrictEqual(computeBoostSummary(actor), [
        { name: "Strength", count: 1 },
        { name: "Dexterity", count: 1 }
    ]);
    console.log("  ✓ Ignores non-Boost items in summary");
}

console.log("\nAll tier-display-service tests passed.");
