import assert from "assert";

/**
 * Test suite for item-grant-service.js
 *
 * Fixtures mirror real CSB data shape:
 *   - ChangeSets and Changes both live on actor.items (siblings)
 *   - ChangeSet references its child Changes via
 *     system.props.ChangeDisplayer: { "<changeId>": { name, id, uuid } }
 *   - Item refs (ItemGrantRef) use the same object-keyed shape:
 *     { "<sourceItemId>": { name, id, uuid } }
 *
 * Covers the pure diff computeGrantedItemReconciliation:
 *   - Creates items for new ItemGrant Changes
 *   - Deletes items whose source Change/ChangeSet was removed
 *   - Stable when target matches existing (no churn)
 *   - Skips RollTable mode without cache, blank refs, non-ItemGrant kinds
 *   - Reports unresolved sources separately
 */

if (typeof globalThis.game === "undefined") globalThis.game = { modules: { get: () => ({ api: {} }) } };
if (typeof globalThis.Hooks === "undefined") globalThis.Hooks = { on: () => {}, off: () => {} };

const { computeGrantedItemReconciliation } = await import("../services/item-grant-service.js");

const CHANGESET_ID = "b7A1z6cSZO4dYTKT";
const CHANGE_ID = "WsrkfjBmudnIhvEK";

// Build a CSB-shaped object-keyed ref: { "<id>": { name, id, uuid } }
function ref(id) {
    return id ? { [id]: { name: id, id, uuid: `Item.${id}` } } : {};
}

function change({ id, kind = "ItemGrant", mode = "Direct", itemRef, cachedSourceItemId }) {
    return {
        id,
        system: {
            template: CHANGE_ID,
            props: {
                Kind: kind,
                ItemGrantMode: mode,
                ItemGrantRef: ref(itemRef)
            }
        },
        flags: cachedSourceItemId
            ? { "1547core": { rolledResult: { tableUuid: "T", rolledAt: 1, sourceItemId: cachedSourceItemId } } }
            : {}
    };
}

function changeSet({ id, changeIds = [] }) {
    const changeDisplayer = {};
    for (const cid of changeIds) {
        changeDisplayer[cid] = { name: cid, id: cid, uuid: `Item.${cid}` };
    }
    return {
        id,
        system: {
            template: CHANGESET_ID,
            props: { Group: "Loadout", ForTypeAny: true, ChangeDisplayer: changeDisplayer }
        }
    };
}

function grantedItem({ id, changeSetId, changeId, name = "Granted" }) {
    return {
        id,
        name,
        flags: { "1547core": { grantedBy: { changeSetId, changeId } } }
    };
}

function makeItemsCollection(items) {
    const map = new Map(items.map((i) => [i.id, i]));
    return {
        get: (id) => map.get(id),
        filter: (pred) => Array.from(map.values()).filter(pred),
        [Symbol.iterator]: () => map.values()
    };
}

function actor({ items = [] } = {}) {
    return { documentName: "Actor", items: makeItemsCollection(items) };
}

const sourceLibrary = {
    "source-claws": { name: "Claws", system: { props: { damage: "1d6" } } },
    "source-bite": { name: "Bite", system: { props: { damage: "1d8" } } }
};
const resolve = (id) => (sourceLibrary[id] ? { ...sourceLibrary[id] } : null);

console.log("computeGrantedItemReconciliation...");

{
    const ch = change({ id: "ch-1", itemRef: "source-claws" });
    const a = actor({ items: [changeSet({ id: "cs-1", changeIds: ["ch-1"] }), ch] });
    const { toCreate, toDelete, unresolved } = computeGrantedItemReconciliation(a, resolve);
    assert.strictEqual(toDelete.length, 0);
    assert.strictEqual(toCreate.length, 1);
    assert.strictEqual(toCreate[0].name, "Claws");
    assert.deepStrictEqual(toCreate[0].flags["1547core"].grantedBy, {
        changeSetId: "cs-1",
        changeId: "ch-1"
    });
    assert.strictEqual(toCreate[0]._id, undefined);
    assert.deepStrictEqual(unresolved, []);
    console.log("  ✓ Creates missing granted item, stamps grantedBy flag, strips _id");
}

{
    const ch = change({ id: "ch-1", itemRef: "source-claws" });
    const a = actor({
        items: [
            changeSet({ id: "cs-1", changeIds: ["ch-1"] }),
            ch,
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
    const ch = change({ id: "ch-1", itemRef: "source-claws" });
    const a = actor({
        items: [
            changeSet({ id: "cs-1", changeIds: ["ch-1"] }),
            ch,
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
    const items = [
        changeSet({ id: "cs-1", changeIds: ["ch-1", "ch-2", "ch-3", "ch-4"] }),
        change({ id: "ch-1", itemRef: "source-claws" }),
        change({ id: "ch-2", mode: "RollTable", itemRef: "source-bite" }),
        change({ id: "ch-3", itemRef: undefined }),
        change({ id: "ch-4", kind: "Stat", itemRef: "source-bite" })
    ];
    const a = actor({ items });
    const { toCreate, toDelete } = computeGrantedItemReconciliation(a, resolve);
    assert.strictEqual(toCreate.length, 1);
    assert.strictEqual(toCreate[0].name, "Claws");
    assert.deepStrictEqual(toDelete, []);
    console.log("  ✓ Skips uncached RollTable mode, blank refs, and non-ItemGrant kinds");
}

{
    const ch = change({ id: "ch-1", itemRef: "source-missing" });
    const a = actor({ items: [changeSet({ id: "cs-1", changeIds: ["ch-1"] }), ch] });
    const { toCreate, toDelete, unresolved } = computeGrantedItemReconciliation(a, resolve);
    assert.deepStrictEqual(toCreate, []);
    assert.deepStrictEqual(toDelete, []);
    assert.strictEqual(unresolved.length, 1);
    assert.strictEqual(unresolved[0].sourceItemId, "source-missing");
    assert.strictEqual(unresolved[0].changeSetId, "cs-1");
    console.log("  ✓ Reports unresolved sources (not silently dropped)");
}

{
    const items = [
        changeSet({ id: "cs-1", changeIds: ["ch-cs1"] }),
        changeSet({ id: "cs-2", changeIds: ["ch-cs2"] }),
        change({ id: "ch-cs1", itemRef: "source-claws" }),
        change({ id: "ch-cs2", itemRef: "source-claws" })
    ];
    const a = actor({ items });
    const { toCreate } = computeGrantedItemReconciliation(a, resolve);
    assert.strictEqual(toCreate.length, 2);
    const grantSources = toCreate.map((d) => d.flags["1547core"].grantedBy.changeSetId).sort();
    assert.deepStrictEqual(grantSources, ["cs-1", "cs-2"]);
    console.log("  ✓ Two ChangeSets granting the same source item produce two independent grants");
}

{
    const ch = change({ id: "ch-1", mode: "RollTable", cachedSourceItemId: "source-bite" });
    const a = actor({ items: [changeSet({ id: "cs-1", changeIds: ["ch-1"] }), ch] });
    const { toCreate, toDelete } = computeGrantedItemReconciliation(a, resolve);
    assert.deepStrictEqual(toDelete, []);
    assert.strictEqual(toCreate.length, 1);
    assert.strictEqual(toCreate[0].name, "Bite");
    assert.deepStrictEqual(toCreate[0].flags["1547core"].grantedBy, { changeSetId: "cs-1", changeId: "ch-1" });
    console.log("  ✓ RollTable mode with cached sourceItemId creates the granted item");
}

{
    const ch = change({ id: "ch-1", mode: "RollTable" /* no cached result yet */ });
    const a = actor({ items: [changeSet({ id: "cs-1", changeIds: ["ch-1"] }), ch] });
    const { toCreate, toDelete } = computeGrantedItemReconciliation(a, resolve);
    assert.deepStrictEqual(toCreate, []);
    assert.deepStrictEqual(toDelete, []);
    console.log("  ✓ RollTable mode without cache is a no-op (waits for resolution)");
}

console.log("\nAll item-grant-service tests passed.");
