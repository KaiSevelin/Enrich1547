import assert from "assert";

/**
 * Test suite for item-grant-service.js
 *
 * Covers the pure diff function computeGrantedItemReconciliation:
 *   - Creates items for new ItemGrant Changes
 *   - Deletes items whose source Change/ChangeSet was removed
 *   - Stable when target matches existing (no churn)
 *   - Skips RollTable mode and grants with no ItemGrantRef
 */

if (typeof globalThis.game === "undefined") globalThis.game = { modules: { get: () => ({ api: {} }) } };
if (typeof globalThis.Hooks === "undefined") globalThis.Hooks = { on: () => {}, off: () => {} };

const { computeGrantedItemReconciliation } = await import("../services/item-grant-service.js");

const CHANGESET_ID = "b7A1z6cSZO4dYTKT";
const CHANGE_ID = "WsrkfjBmudnIhvEK";

function change({ id, kind = "ItemGrant", mode = "Direct", itemRef, cachedSourceItemId }) {
    return {
        id,
        system: {
            template: CHANGE_ID,
            props: {
                Kind: kind,
                ItemGrantMode: mode,
                ItemGrantRef: itemRef ? [itemRef] : []
            }
        },
        flags: cachedSourceItemId
            ? { "1547core": { rolledResult: { tableUuid: "T", rolledAt: 1, sourceItemId: cachedSourceItemId } } }
            : {}
    };
}

function changeSet({ id, changes = [] }) {
    return {
        id,
        system: { template: CHANGESET_ID, props: { Group: "Loadout", ForTypeAny: true } },
        items: changes
    };
}

function grantedItem({ id, changeSetId, changeId, name = "Granted" }) {
    return {
        id,
        name,
        flags: { "1547core": { grantedBy: { changeSetId, changeId } } }
    };
}

function actor({ items = [] } = {}) {
    return { documentName: "Actor", items };
}

const sourceLibrary = {
    "source-claws": { name: "Claws", system: { props: { damage: "1d6" } } },
    "source-bite": { name: "Bite", system: { props: { damage: "1d8" } } }
};
const resolve = (id) => sourceLibrary[id] ? { ...sourceLibrary[id] } : null;

console.log("computeGrantedItemReconciliation...");

{
    const a = actor({
        items: [
            changeSet({
                id: "cs-1",
                changes: [change({ id: "ch-1", itemRef: "source-claws" })]
            })
        ]
    });
    const { toCreate, toDelete } = computeGrantedItemReconciliation(a, resolve);
    assert.strictEqual(toDelete.length, 0);
    assert.strictEqual(toCreate.length, 1);
    assert.strictEqual(toCreate[0].name, "Claws");
    assert.deepStrictEqual(toCreate[0].flags["1547core"].grantedBy, {
        changeSetId: "cs-1",
        changeId: "ch-1"
    });
    assert.strictEqual(toCreate[0]._id, undefined);
    console.log("  ✓ Creates missing granted item, stamps grantedBy flag, strips _id");
}

{
    const a = actor({
        items: [
            changeSet({
                id: "cs-1",
                changes: [change({ id: "ch-1", itemRef: "source-claws" })]
            }),
            grantedItem({ id: "claws-instance", changeSetId: "cs-1", changeId: "ch-1", name: "Claws" })
        ]
    });
    const { toCreate, toDelete } = computeGrantedItemReconciliation(a, resolve);
    assert.deepStrictEqual(toCreate, []);
    assert.deepStrictEqual(toDelete, []);
    console.log("  ✓ Stable when target matches existing");
}

{
    const a = actor({
        items: [
            grantedItem({ id: "claws-instance", changeSetId: "cs-1", changeId: "ch-1", name: "Claws" })
        ]
    });
    const { toCreate, toDelete } = computeGrantedItemReconciliation(a, resolve);
    assert.deepStrictEqual(toCreate, []);
    assert.deepStrictEqual(toDelete, ["claws-instance"]);
    console.log("  ✓ Deletes orphaned granted item when source ChangeSet is gone");
}

{
    const a = actor({
        items: [
            changeSet({ id: "cs-1", changes: [change({ id: "ch-1", itemRef: "source-claws" })] }),
            grantedItem({ id: "claws-instance", changeSetId: "cs-1", changeId: "ch-1", name: "Claws" }),
            grantedItem({ id: "stale-bite", changeSetId: "cs-1", changeId: "ch-removed", name: "Bite" })
        ]
    });
    const { toCreate, toDelete } = computeGrantedItemReconciliation(a, resolve);
    assert.deepStrictEqual(toCreate, []);
    assert.deepStrictEqual(toDelete, ["stale-bite"]);
    console.log("  ✓ Deletes per-Change-id when only one Change of a set was removed");
}

{
    const a = actor({
        items: [
            changeSet({
                id: "cs-1",
                changes: [
                    change({ id: "ch-1", itemRef: "source-claws" }),
                    change({ id: "ch-2", mode: "RollTable", itemRef: "source-bite" }),
                    change({ id: "ch-3", itemRef: undefined }),
                    change({ id: "ch-4", kind: "Stat", itemRef: "source-bite" })
                ]
            })
        ]
    });
    const { toCreate, toDelete } = computeGrantedItemReconciliation(a, resolve);
    assert.strictEqual(toCreate.length, 1);
    assert.strictEqual(toCreate[0].name, "Claws");
    assert.deepStrictEqual(toDelete, []);
    console.log("  ✓ Skips uncached RollTable mode, blank refs, and non-ItemGrant kinds");
}

{
    const a = actor({
        items: [
            changeSet({ id: "cs-1", changes: [change({ id: "ch-1", itemRef: "source-missing" })] })
        ]
    });
    const { toCreate, toDelete } = computeGrantedItemReconciliation(a, resolve);
    assert.deepStrictEqual(toCreate, []);
    assert.deepStrictEqual(toDelete, []);
    console.log("  ✓ Silently skips when source item is unresolvable");
}

{
    const a = actor({
        items: [
            changeSet({ id: "cs-1", changes: [change({ id: "ch-1", itemRef: "source-claws" })] }),
            changeSet({ id: "cs-2", changes: [change({ id: "ch-1", itemRef: "source-claws" })] })
        ]
    });
    const { toCreate } = computeGrantedItemReconciliation(a, resolve);
    assert.strictEqual(toCreate.length, 2);
    const grantSources = toCreate.map((d) => d.flags["1547core"].grantedBy.changeSetId).sort();
    assert.deepStrictEqual(grantSources, ["cs-1", "cs-2"]);
    console.log("  ✓ Two ChangeSets granting the same source item produce two independent grants");
}

{
    const a = actor({
        items: [
            changeSet({
                id: "cs-1",
                changes: [change({ id: "ch-1", mode: "RollTable", cachedSourceItemId: "source-bite" })]
            })
        ]
    });
    const { toCreate, toDelete } = computeGrantedItemReconciliation(a, resolve);
    assert.deepStrictEqual(toDelete, []);
    assert.strictEqual(toCreate.length, 1);
    assert.strictEqual(toCreate[0].name, "Bite");
    assert.deepStrictEqual(toCreate[0].flags["1547core"].grantedBy, { changeSetId: "cs-1", changeId: "ch-1" });
    console.log("  ✓ RollTable mode with cached sourceItemId creates the granted item");
}

{
    const a = actor({
        items: [
            changeSet({
                id: "cs-1",
                changes: [change({ id: "ch-1", mode: "RollTable" /* no cached result yet */ })]
            })
        ]
    });
    const { toCreate, toDelete } = computeGrantedItemReconciliation(a, resolve);
    assert.deepStrictEqual(toCreate, []);
    assert.deepStrictEqual(toDelete, []);
    console.log("  ✓ RollTable mode without cache is a no-op (waits for resolution)");
}

console.log("\nAll item-grant-service tests passed.");
