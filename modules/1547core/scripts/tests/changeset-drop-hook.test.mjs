import assert from "assert";

/**
 * Test suite for changeset-drop-hook.js
 *
 * Tests:
 *   - validateChangeSetDrop: ForType, cardinality, requirement gating; _template exemption
 *   - validateMonster: cardinality, ForType, requirement audits across attached sets
 */

const notifications = [];
if (typeof globalThis.game === "undefined") {
    globalThis.game = {
        modules: { get: () => ({ api: {} }) }
    };
}
if (typeof globalThis.Hooks === "undefined") {
    globalThis.Hooks = { on: () => {}, off: () => {} };
}
globalThis.ui = {
    notifications: {
        warn: (msg) => notifications.push(msg)
    }
};

const { validateChangeSetDrop, validateMonster } = await import("../services/changeset-drop-hook.js");

const CHANGESET_ID = "b7A1z6cSZO4dYTKT";
const REQUIREMENT_ID = "L4ujYgqhGBGcoo2P";

function actor(overrides = {}) {
    return {
        id: "actor-1",
        name: "Test Actor",
        documentName: "Actor",
        type: "character",
        system: {
            props: {
                TypeDropdown: "Beast",
                ...overrides.props
            }
        },
        items: overrides.items ?? [],
        _stats: { modifiedTime: 1 },
        ...overrides
    };
}

function changeSet({ id = "set-1", name = "Set", group = "Quirk", forTypeAny = true, forTypes = {}, items = [] } = {}) {
    const props = { Group: group, ForTypeAny: forTypeAny, ...forTypes };
    return {
        id,
        name,
        documentName: "Item",
        system: { template: CHANGESET_ID, props },
        items
    };
}

function requirementItem({ predicateType, negate = false, ...rest } = {}) {
    return {
        id: `req-${Math.random()}`,
        system: {
            template: REQUIREMENT_ID,
            props: { PredicateType: predicateType, Negate: negate, ...rest }
        }
    };
}

function dropDoc(set, parent) {
    return {
        ...set,
        parent
    };
}

function resetNotifications() {
    notifications.length = 0;
}

// ============================================================================
// validateChangeSetDrop — ForType
// ============================================================================

console.log("validateChangeSetDrop: ForType...");
{
    resetNotifications();
    const set = changeSet({ forTypeAny: true });
    const a = actor();
    assert.strictEqual(validateChangeSetDrop(dropDoc(set, a), set), true);
    assert.strictEqual(notifications.length, 0);
    console.log("  ✓ ForTypeAny accepts");
}
{
    resetNotifications();
    const set = changeSet({ forTypeAny: false, forTypes: { ForType_Beast: true } });
    const a = actor({ props: { TypeDropdown: "Beast" } });
    assert.strictEqual(validateChangeSetDrop(dropDoc(set, a), set), true);
    console.log("  ✓ Matching ForType accepts");
}
{
    resetNotifications();
    const set = changeSet({ forTypeAny: false, forTypes: { ForType_Beast: true } });
    const a = actor({ props: { TypeDropdown: "Player" } });
    assert.strictEqual(validateChangeSetDrop(dropDoc(set, a), set), false);
    assert.ok(notifications[0].includes('not valid for actor type "Player"'));
    console.log("  ✓ Mismatched ForType rejects");
}
{
    resetNotifications();
    const set = changeSet({ forTypeAny: false });
    const a = actor({ props: { TypeDropdown: "" } });
    assert.strictEqual(validateChangeSetDrop(dropDoc(set, a), set), false);
    console.log("  ✓ Restricted set + actor missing TypeDropdown rejects");
}

// ============================================================================
// validateChangeSetDrop — Cardinality
// ============================================================================

console.log("validateChangeSetDrop: cardinality...");
for (const group of ["Size", "Role", "Domain"]) {
    resetNotifications();
    const existing = changeSet({ id: "existing", name: "Old", group });
    const incoming = changeSet({ id: "new", name: "New", group });
    const a = actor({ items: [existing] });
    assert.strictEqual(validateChangeSetDrop(dropDoc(incoming, a), incoming), false);
    assert.ok(notifications[0].includes(`Actor already has a ${group} ChangeSet`));
    console.log(`  ✓ ${group} rejects second drop`);
}
for (const group of ["Motivation", "Loadout", "Quirk", "Boost"]) {
    resetNotifications();
    const existing = changeSet({ id: "existing", name: "Old", group });
    const incoming = changeSet({ id: "new", name: "New", group });
    const a = actor({ items: [existing] });
    assert.strictEqual(validateChangeSetDrop(dropDoc(incoming, a), incoming), true);
    console.log(`  ✓ ${group} allows multiple`);
}

// ============================================================================
// validateChangeSetDrop — Requirements
// ============================================================================

console.log("validateChangeSetDrop: requirements...");
{
    resetNotifications();
    const set = changeSet({
        items: [requirementItem({ predicateType: "StatAtLeast", StatTarget: "HP", StatThreshold: 5 })]
    });
    const a = actor({ props: { HP: 10 } });
    assert.strictEqual(validateChangeSetDrop(dropDoc(set, a), set), true);
    console.log("  ✓ Satisfied requirement passes");
}
{
    resetNotifications();
    const set = changeSet({
        items: [requirementItem({ predicateType: "StatAtLeast", StatTarget: "HP", StatThreshold: 100 })]
    });
    const a = actor({ props: { HP: 10 } });
    assert.strictEqual(validateChangeSetDrop(dropDoc(set, a), set), false);
    assert.ok(notifications[0].includes('Requirement "StatAtLeast" not satisfied'));
    console.log("  ✓ Failed requirement rejects");
}

// ============================================================================
// validateChangeSetDrop — _template exemption and non-ChangeSet bypass
// ============================================================================

console.log("validateChangeSetDrop: exemptions...");
{
    resetNotifications();
    const set = changeSet({
        forTypeAny: false,
        forTypes: { ForType_Player: true },
        items: [requirementItem({ predicateType: "StatAtLeast", StatTarget: "HP", StatThreshold: 99999 })]
    });
    const a = actor({ type: "_template", props: { TypeDropdown: "Beast", HP: 0 } });
    assert.strictEqual(validateChangeSetDrop(dropDoc(set, a), set), true);
    console.log("  ✓ _template actor skips all validation");
}
{
    resetNotifications();
    const nonChangeSet = {
        documentName: "Item",
        system: { template: "some-other-template", props: {} },
        parent: actor()
    };
    assert.strictEqual(validateChangeSetDrop(nonChangeSet, nonChangeSet), true);
    console.log("  ✓ Non-ChangeSet items bypass");
}
{
    resetNotifications();
    const set = changeSet();
    assert.strictEqual(validateChangeSetDrop({ ...set, parent: null }, set), true);
    console.log("  ✓ World items (no actor parent) bypass");
}

// ============================================================================
// validateMonster — audit existing sets
// ============================================================================

console.log("validateMonster: audits...");
{
    const a = actor({
        items: [
            changeSet({ id: "s1", name: "Big", group: "Size" }),
            changeSet({ id: "s2", name: "Huge", group: "Size" })
        ]
    });
    const violations = validateMonster(a);
    const cardinalityV = violations.filter((v) => v.kind === "cardinality");
    assert.strictEqual(cardinalityV.length, 1);
    assert.strictEqual(cardinalityV[0].group, "Size");
    assert.strictEqual(cardinalityV[0].count, 2);
    console.log("  ✓ Detects duplicate singleton groups");
}
{
    const a = actor({
        props: { TypeDropdown: "Beast" },
        items: [
            changeSet({ id: "s1", name: "PlayerOnly", group: "Quirk", forTypeAny: false, forTypes: { ForType_Player: true } })
        ]
    });
    const violations = validateMonster(a);
    const forTypeV = violations.filter((v) => v.kind === "forType");
    assert.strictEqual(forTypeV.length, 1);
    assert.strictEqual(forTypeV[0].changeSetName, "PlayerOnly");
    console.log("  ✓ Detects ForType mismatches");
}
{
    const a = actor({ type: "_template", items: [changeSet({ group: "Size" }), changeSet({ group: "Size" })] });
    assert.deepStrictEqual(validateMonster(a), []);
    console.log("  ✓ _template actor returns no violations");
}
{
    const a = actor({ props: { TypeDropdown: "Beast" }, items: [] });
    const violations = validateMonster(a);
    const missingBase = violations.filter((v) => v.kind === "missing-base");
    assert.strictEqual(missingBase.length, 1);
    assert.strictEqual(missingBase[0].group, "Base");
    console.log("  ✓ Flags monster with no Base ChangeSet");
}
{
    const a = actor({
        props: { TypeDropdown: "Beast" },
        items: [changeSet({ id: "base-1", name: "Beast Base", group: "Base" })]
    });
    const violations = validateMonster(a);
    assert.strictEqual(violations.filter((v) => v.kind === "missing-base").length, 0);
    console.log("  ✓ No missing-base when chassis is attached");
}
{
    const a = actor({ props: { TypeDropdown: "Player" }, items: [] });
    const violations = validateMonster(a);
    assert.strictEqual(violations.filter((v) => v.kind === "missing-base").length, 0);
    console.log("  ✓ Player actors are skipped");
}
{
    const a = actor({ props: { TypeDropdown: "" }, items: [] });
    const violations = validateMonster(a);
    assert.strictEqual(violations.filter((v) => v.kind === "missing-base").length, 0);
    console.log("  ✓ Untyped actors are skipped");
}

console.log("\nAll changeset-drop-hook tests passed.");
