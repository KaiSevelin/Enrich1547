import assert from "assert";

/**
 * Test suite for rolltable-resolution-service.js
 *
 * Fixtures mirror real CSB data shape: Changes live on actor.items, the
 * ChangeSet references them via system.props.ChangeDisplayer: { "<id>": {...} }.
 *
 * Covers findChangesNeedingRoll: identifies Image/ItemGrant RollTable-mode
 * Changes whose cache is missing or stale, ignores Direct mode and
 * non-RollTable kinds, and respects matching cache.
 */

if (typeof globalThis.game === "undefined") globalThis.game = { modules: { get: () => ({ api: {} }) } };
if (typeof globalThis.Hooks === "undefined") globalThis.Hooks = { on: () => {}, off: () => {} };

const { findChangesNeedingRoll, getCachedRoll } = await import("../services/rolltable-resolution-service.js");

const CHANGESET_ID = "b7A1z6cSZO4dYTKT";
const CHANGE_ID = "WsrkfjBmudnIhvEK";

function change({ id, kind, props = {}, cached = null }) {
    return {
        id,
        system: { template: CHANGE_ID, props: { Kind: kind, ...props } },
        flags: cached ? { "1547core": { rolledResult: cached } } : {}
    };
}

function changeSet({ id, changeIds = [] }) {
    const displayer = {};
    for (const cid of changeIds) displayer[cid] = { name: cid, id: cid, uuid: `Item.${cid}` };
    return {
        id,
        system: {
            template: CHANGESET_ID,
            props: { Group: "Loadout", ForTypeAny: true, ChangeDisplayer: displayer }
        }
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

console.log("findChangesNeedingRoll...");

{
    const a = actor({
        items: [
            changeSet({ id: "cs-1", changeIds: ["ch-1"] }),
            change({ id: "ch-1", kind: "Image", props: { ImageMode: "RollTable", ImageRollTable: "RollTable.abc" } })
        ]
    });
    const needed = findChangesNeedingRoll(a);
    assert.strictEqual(needed.length, 1);
    assert.deepStrictEqual(needed[0], {
        changeSetId: "cs-1",
        changeId: "ch-1",
        kind: "Image",
        uuid: "RollTable.abc"
    });
    console.log("  ✓ Identifies Image RollTable change needing roll");
}

{
    const a = actor({
        items: [
            changeSet({ id: "cs-1", changeIds: ["ch-1"] }),
            change({ id: "ch-1", kind: "ItemGrant", props: { ItemGrantMode: "RollTable", ItemGrantRollTable: "RollTable.xyz" } })
        ]
    });
    const needed = findChangesNeedingRoll(a);
    assert.strictEqual(needed.length, 1);
    assert.strictEqual(needed[0].kind, "ItemGrant");
    assert.strictEqual(needed[0].uuid, "RollTable.xyz");
    console.log("  ✓ Identifies ItemGrant RollTable change needing roll");
}

{
    const a = actor({
        items: [
            changeSet({ id: "cs-1", changeIds: ["ch-1"] }),
            change({
                id: "ch-1",
                kind: "ItemGrant",
                props: { ItemGrantMode: "RollTable", ItemGrantRollTable: "RollTable.xyz" },
                cached: { tableUuid: "RollTable.xyz", rolledAt: 1, sourceItemId: "item-42" }
            })
        ]
    });
    assert.deepStrictEqual(findChangesNeedingRoll(a), []);
    console.log("  ✓ Skips Changes whose cache matches the target table");
}

{
    const a = actor({
        items: [
            changeSet({ id: "cs-1", changeIds: ["ch-1"] }),
            change({
                id: "ch-1",
                kind: "ItemGrant",
                props: { ItemGrantMode: "RollTable", ItemGrantRollTable: "RollTable.new" },
                cached: { tableUuid: "RollTable.old", rolledAt: 1, sourceItemId: "item-42" }
            })
        ]
    });
    const needed = findChangesNeedingRoll(a);
    assert.strictEqual(needed.length, 1);
    assert.strictEqual(needed[0].uuid, "RollTable.new");
    console.log("  ✓ Re-rolls when table UUID has been retargeted");
}

{
    const a = actor({
        items: [
            changeSet({ id: "cs-1", changeIds: ["ch-direct", "ch-image-direct", "ch-stat", "ch-blank"] }),
            change({ id: "ch-direct", kind: "ItemGrant", props: { ItemGrantMode: "Direct", ItemGrantRef: { "source-1": { id: "source-1" } } } }),
            change({ id: "ch-image-direct", kind: "Image", props: { ImageMode: "Direct", ImageValue: "/path.png" } }),
            change({ id: "ch-stat", kind: "Stat" }),
            change({ id: "ch-blank", kind: "ItemGrant", props: { ItemGrantMode: "RollTable", ItemGrantRollTable: "" } })
        ]
    });
    assert.deepStrictEqual(findChangesNeedingRoll(a), []);
    console.log("  ✓ Ignores Direct mode, non-target kinds, and blank UUIDs");
}

{
    const a = actor({
        items: [
            changeSet({ id: "cs-1", changeIds: ["ch-1", "ch-2"] }),
            changeSet({ id: "cs-2", changeIds: ["ch-3"] }),
            change({ id: "ch-1", kind: "Image", props: { ImageMode: "RollTable", ImageRollTable: "Table.a" } }),
            change({ id: "ch-2", kind: "ItemGrant", props: { ItemGrantMode: "RollTable", ItemGrantRollTable: "Table.b" } }),
            change({ id: "ch-3", kind: "ItemGrant", props: { ItemGrantMode: "RollTable", ItemGrantRollTable: "Table.c" } })
        ]
    });
    const needed = findChangesNeedingRoll(a);
    assert.strictEqual(needed.length, 3);
    const keys = needed.map((n) => `${n.changeSetId}:${n.changeId}`).sort();
    assert.deepStrictEqual(keys, ["cs-1:ch-1", "cs-1:ch-2", "cs-2:ch-3"]);
    console.log("  ✓ Walks all ChangeSets and all child Changes");
}

console.log("\ngetCachedRoll...");
{
    const c = change({ id: "ch-1", kind: "Image", cached: { tableUuid: "T", rolledAt: 5, imagePath: "/p.png" } });
    assert.deepStrictEqual(getCachedRoll(c), { tableUuid: "T", rolledAt: 5, imagePath: "/p.png" });
    assert.strictEqual(getCachedRoll(change({ id: "ch-2", kind: "Image" })), null);
    console.log("  ✓ Reads cache flag, returns null when absent");
}

console.log("\nAll rolltable-resolution-service tests passed.");
