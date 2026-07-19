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
globalThis.game.user = globalThis.game.user ?? { isGM: true };

const { computeGrantedItemReconciliation, reconcileGrantedItems } = await import("../services/item-grant-service.js");

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

function grantedItem({ id, changeSetId, changeId, sourceItemId, name = "Granted" }) {
    return {
        id,
        name,
        flags: { "1547core": { grantedBy: { changeSetId, changeId, sourceItemId } } }
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
        changeId: "ch-1",
        sourceItemId: "source-claws"
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
            grantedItem({ id: "claws-instance", changeSetId: "cs-1", changeId: "ch-1", sourceItemId: "source-claws", name: "Claws" })
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
            grantedItem({ id: "claws-instance", changeSetId: "cs-1", changeId: "ch-1", sourceItemId: "source-claws", name: "Claws" })
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
            grantedItem({ id: "claws-instance", changeSetId: "cs-1", changeId: "ch-1", sourceItemId: "source-claws", name: "Claws" }),
            grantedItem({ id: "stale-bite", changeSetId: "cs-1", changeId: "ch-removed", sourceItemId: "source-bite", name: "Bite" })
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
    assert.deepStrictEqual(toCreate[0].flags["1547core"].grantedBy, { changeSetId: "cs-1", changeId: "ch-1", sourceItemId: "source-bite" });
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

{
    // Regression: CSB stores system.container as a back-pointer that
    // scopes an item to a parent itemContainer (e.g. an ItemGrantRef
    // field). When present it suppresses the item from inventory panels.
    // The reconciler must strip it so the grant becomes free-floating.
    const containerScoped = {
        name: "Container-scoped Source",
        system: {
            template: "qZCfLEYQ7egbm1B9",
            container: "some-other-change-id",
            props: { damage: "1d8" }
        }
    };
    const resolveContainerScoped = () => ({ ...containerScoped, system: { ...containerScoped.system } });

    const ch = change({ id: "ch-1", itemRef: "anything" });
    const a = actor({ items: [changeSet({ id: "cs-1", changeIds: ["ch-1"] }), ch] });
    const { toCreate } = computeGrantedItemReconciliation(a, resolveContainerScoped);
    assert.strictEqual(toCreate.length, 1);
    assert.strictEqual(toCreate[0].system.container, undefined,
        "Granted item must have system.container stripped so it renders in inventory panels");
    console.log("  ✓ Strips system.container from the granted copy");
}

{
    // Auto-equip: items with an Equipped prop (weapons/armor/shields)
    // should come in equipped so the GM doesn't have to click every one.
    const equippableSource = {
        name: "Sword",
        type: "equippableItem",
        system: {
            template: "qZCfLEYQ7egbm1B9",
            props: { Equipped: false, WeaponType: "Sword" }
        }
    };
    const consumableSource = {
        name: "Potion",
        type: "equippableItem",
        system: {
            template: "PDxRO5ObvLaThpez",
            props: { Charges: 3 } // no Equipped prop
        }
    };

    const a = actor({
        items: [
            changeSet({ id: "cs-1", changeIds: ["ch-eq", "ch-cons"] }),
            change({ id: "ch-eq", itemRef: "src-sword" }),
            change({ id: "ch-cons", itemRef: "src-potion" })
        ]
    });
    const r = (id) => {
        if (id === "src-sword") return JSON.parse(JSON.stringify(equippableSource));
        if (id === "src-potion") return JSON.parse(JSON.stringify(consumableSource));
        return null;
    };
    const { toCreate } = computeGrantedItemReconciliation(a, r);
    const sword = toCreate.find((d) => d.name === "Sword");
    const potion = toCreate.find((d) => d.name === "Potion");
    assert.strictEqual(sword?.system?.props?.Equipped, true,
        "Items with an Equipped prop must be equipped on grant");
    assert.ok(potion && !("Equipped" in potion.system.props),
        "Items without an Equipped prop must not gain one");
    console.log("  ✓ Auto-equips items with an Equipped prop; leaves others alone");
}

{
    // One ItemGrant Change can reference several items (e.g. the Beast base's
    // "Claws + Bite + Natural Armor") — every ref must be granted, not just the first.
    const multiChange = {
        id: "ch-multi",
        system: {
            template: CHANGE_ID,
            props: {
                Kind: "ItemGrant",
                ItemGrantMode: "Direct",
                ItemGrantRef: {
                    "source-claws": { name: "Claws", id: "source-claws", uuid: "Item.source-claws" },
                    "source-bite": { name: "Bite", id: "source-bite", uuid: "Item.source-bite" },
                    "source-armor": { name: "Armor", id: "source-armor", uuid: "Item.source-armor" }
                }
            }
        },
        flags: {}
    };
    const lib = { ...sourceLibrary, "source-armor": { name: "Armor", system: { props: {} } } };
    const r = (id) => (lib[id] ? { ...lib[id] } : null);
    const a = actor({ items: [changeSet({ id: "cs-1", changeIds: ["ch-multi"] }), multiChange] });
    const { toCreate } = computeGrantedItemReconciliation(a, r);
    assert.strictEqual(toCreate.length, 3);
    assert.deepStrictEqual(toCreate.map((d) => d.name).sort(), ["Armor", "Bite", "Claws"]);
    // Each grant keyed per-ref so re-running is stable (no duplicates).
    const { toCreate: again, toDelete } = computeGrantedItemReconciliation(
        actor({ items: [
            changeSet({ id: "cs-1", changeIds: ["ch-multi"] }),
            multiChange,
            ...toCreate.map((d, i) => ({ id: `granted-${i}`, name: d.name, flags: d.flags }))
        ] }),
        r
    );
    assert.deepStrictEqual(again, []);
    assert.deepStrictEqual(toDelete, []);
    console.log("  ✓ Multi-ref ItemGrant grants every referenced item and stays stable");
}

{
    // Regression: CSB empties ItemGrantRef in the prepared props during
    // data-prep; the reconciler must read the raw `_source` copy.
    const prunedChange = {
        id: "ch-pruned",
        system: {
            template: CHANGE_ID,
            props: { Kind: "ItemGrant", ItemGrantMode: "Direct", ItemGrantRef: {} }
        },
        _source: {
            system: { props: { ItemGrantRef: ref("source-claws") } }
        },
        flags: {}
    };
    const a = actor({ items: [changeSet({ id: "cs-1", changeIds: ["ch-pruned"] }), prunedChange] });
    const { toCreate } = computeGrantedItemReconciliation(a, resolve);
    assert.strictEqual(toCreate.length, 1);
    assert.strictEqual(toCreate[0].name, "Claws");
    console.log("  ✓ Reads ItemGrantRef from _source when CSB has emptied the prepared prop");
}

{
    // Regression (bloated-wolf bug): historical reconcile races left several
    // copies of the same grant on the actor. Duplicate copies share a valid
    // grantKey, so the old diff saw them as "target matches existing" and
    // never removed them. The diff must keep the first copy and delete the rest.
    const ch = change({ id: "ch-1", itemRef: "source-claws" });
    const a = actor({
        items: [
            changeSet({ id: "cs-1", changeIds: ["ch-1"] }),
            ch,
            grantedItem({ id: "claws-keep", changeSetId: "cs-1", changeId: "ch-1", sourceItemId: "source-claws", name: "Claws" }),
            grantedItem({ id: "claws-dup-1", changeSetId: "cs-1", changeId: "ch-1", sourceItemId: "source-claws", name: "Claws" }),
            grantedItem({ id: "claws-dup-2", changeSetId: "cs-1", changeId: "ch-1", sourceItemId: "source-claws", name: "Claws" })
        ]
    });
    const { toCreate, toDelete } = computeGrantedItemReconciliation(a, resolve);
    assert.deepStrictEqual(toCreate, []);
    assert.deepStrictEqual(toDelete.sort(), ["claws-dup-1", "claws-dup-2"]);
    console.log("  ✓ Deletes surplus duplicate copies sharing a grantKey, keeps the first");
}

console.log("\nreconcileGrantedItems (serialization)...");

// A mutable mock actor whose createEmbeddedDocuments actually lands the items
// (with a delay, to give concurrent reconciles room to interleave).
function liveActor(initialItems) {
    const map = new Map(initialItems.map((i) => [i.id, i]));
    let counter = 0;
    const createCalls = [];
    const deleteCalls = [];
    const a = {
        documentName: "Actor",
        type: "character",
        id: "actor-live",
        uuid: "Actor.actor-live",
        items: {
            get: (id) => map.get(id),
            filter: (pred) => Array.from(map.values()).filter(pred),
            [Symbol.iterator]: () => map.values()
        },
        async createEmbeddedDocuments(_type, payloads) {
            createCalls.push(payloads);
            await new Promise((r) => setTimeout(r, 10));
            for (const data of payloads) {
                const id = `created-${++counter}`;
                map.set(id, { id, name: data.name, flags: data.flags, system: data.system });
            }
            return payloads;
        },
        async deleteEmbeddedDocuments(_type, ids) {
            deleteCalls.push(ids);
            await new Promise((r) => setTimeout(r, 5));
            for (const id of ids) map.delete(id);
            return ids;
        }
    };
    return { a, createCalls, deleteCalls };
}

{
    // Regression (bloated-wolf bug): concurrent reconciles used to each diff
    // against a snapshot missing the other's in-flight creates, so every one
    // of them created the full granted set again. Serialized runs must land
    // exactly one copy no matter how many triggers fire at once.
    const { a, createCalls } = liveActor([
        changeSet({ id: "cs-1", changeIds: ["ch-1"] }),
        change({ id: "ch-1", itemRef: "source-claws" })
    ]);
    await Promise.all([
        reconcileGrantedItems(a, { resolveSource: resolve }),
        reconcileGrantedItems(a, { resolveSource: resolve }),
        reconcileGrantedItems(a, { resolveSource: resolve })
    ]);
    assert.strictEqual(createCalls.length, 1, "only the first reconcile may create; the rest must see its writes");
    const granted = a.items.filter((i) => i.flags?.["1547core"]?.grantedBy);
    assert.strictEqual(granted.length, 1);
    assert.strictEqual(granted[0].name, "Claws");
    console.log("  ✓ Concurrent reconciles are serialized — one create, no duplicates");
}

{
    // Runtime self-heal: an actor already carrying duplicate copies loses the
    // surplus on the next reconcile.
    const { a, deleteCalls } = liveActor([
        changeSet({ id: "cs-1", changeIds: ["ch-1"] }),
        change({ id: "ch-1", itemRef: "source-claws" }),
        grantedItem({ id: "claws-keep", changeSetId: "cs-1", changeId: "ch-1", sourceItemId: "source-claws", name: "Claws" }),
        grantedItem({ id: "claws-dup", changeSetId: "cs-1", changeId: "ch-1", sourceItemId: "source-claws", name: "Claws" })
    ]);
    await reconcileGrantedItems(a, { resolveSource: resolve });
    assert.deepStrictEqual(deleteCalls, [["claws-dup"]]);
    assert.ok(a.items.get("claws-keep"));
    assert.strictEqual(a.items.get("claws-dup"), undefined);
    console.log("  ✓ Reconcile deletes pre-existing duplicate copies (self-heal)");
}

console.log("\nAll item-grant-service tests passed.");
