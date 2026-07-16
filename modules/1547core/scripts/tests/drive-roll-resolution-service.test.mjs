import assert from "assert";

if (typeof globalThis.game === "undefined") globalThis.game = { modules: { get: () => ({ api: {} }) } };
if (typeof globalThis.Hooks === "undefined") globalThis.Hooks = { on: () => {}, off: () => {} };

const { getDriveRollTarget, findDriveRollsNeeded, formatDriveLine } =
    await import("../services/drive-roll-resolution-service.js");

const CHANGESET_ID = "b7A1z6cSZO4dYTKT";
const CHANGE_ID = "WsrkfjBmudnIhvEK";
const MOD = "1547core";

function change({ id, kind = "DriveRoll", table = "T1", category = "Restless", container = "cs-1", source, cachedTable }) {
    const c = {
        id,
        system: { template: CHANGE_ID, container, props: { Kind: kind, DriveRollTable: table, DriveCategory: category } },
        flags: cachedTable ? { [MOD]: { rolledResult: { tableUuid: cachedTable } } } : {}
    };
    if (source) c._source = { system: { props: source } };
    return c;
}
function changeSet(id = "cs-1") { return { id, system: { template: CHANGESET_ID, props: {} } }; }
function actor(items) {
    const map = new Map(items.map((i) => [i.id, i]));
    return { documentName: "Actor", items: { get: (id) => map.get(id), [Symbol.iterator]: () => map.values() } };
}

console.log("drive-roll: getDriveRollTarget...");
{
    assert.deepStrictEqual(getDriveRollTarget(change({ id: "x" })), { tableId: "T1", category: "Restless" });
    assert.strictEqual(getDriveRollTarget(change({ id: "x", kind: "ItemGrant" })), null);
    assert.strictEqual(getDriveRollTarget(change({ id: "x", table: "" })), null);
    // pruning safety: Kind/table only on _source
    const pruned = { id: "x", system: { template: CHANGE_ID, props: {} }, _source: { system: { props: { Kind: "DriveRoll", DriveRollTable: "T9", DriveCategory: "Grave" } } } };
    assert.deepStrictEqual(getDriveRollTarget(pruned), { tableId: "T9", category: "Grave" });
    console.log("  ✓ Reads DriveRoll target; ignores other kinds/blank table; falls back to _source");
}

console.log("drive-roll: formatDriveLine...");
{
    assert.strictEqual(formatDriveLine("Restless", "  "), null);
    assert.strictEqual(formatDriveLine("Restless", ""), null);
    assert.strictEqual(formatDriveLine("Restless", "Punish the living."), "[Restless] Punish the living.");
    assert.strictEqual(formatDriveLine("", "Wander the moor."), "Wander the moor.");
    console.log("  ✓ Blank → null; category prefixes; no category → bare line");
}

console.log("drive-roll: findDriveRollsNeeded...");
{
    const a = actor([changeSet("cs-1"), change({ id: "d1", container: "cs-1" })]);
    assert.deepStrictEqual(findDriveRollsNeeded(a).map((x) => x.changeId), ["d1"]);
    console.log("  ✓ Finds uncached DriveRoll children by container");
}
{
    const a = actor([changeSet("cs-1"), change({ id: "d1", container: "cs-1", cachedTable: "T1" })]);
    assert.deepStrictEqual(findDriveRollsNeeded(a), []);
    console.log("  ✓ Skips a Change already rolled against the same table");
}
{
    const a = actor([changeSet("cs-1"), change({ id: "d1", container: "cs-1", table: "T2", cachedTable: "T1" })]);
    assert.deepStrictEqual(findDriveRollsNeeded(a).map((x) => x.changeId), ["d1"]);
    console.log("  ✓ Re-rolls when the table changed (stale cache)");
}
{
    const a = actor([changeSet("cs-1"), change({ id: "g1", container: "cs-1", kind: "ItemGrant" })]);
    assert.deepStrictEqual(findDriveRollsNeeded(a), []);
    console.log("  ✓ Ignores non-DriveRoll Changes");
}

console.log("\nAll drive-roll-resolution tests passed.");
