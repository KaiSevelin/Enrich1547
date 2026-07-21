import assert from "assert";

/**
 * Test suite for drive-store.mjs
 *
 * Drives are stored as a CSB dynamicTable `DriveTable` — object-keyed rows
 * `{ "0": { DriveText }, … }`, numeric-sorted, with `$deleted` tombstones. A
 * legacy newline `Drives` string is read as a fallback and cleared on write.
 */

const { getDrives, buildSetDrivesUpdate, addDrive, addDriveCapped, removeDriveAt, removeDrivesWhere, CHARGEN_DRIVE_CAP } =
    await import("../services/drive-store.mjs");

function actorWith(props) {
    return { system: { props } };
}
// An actor whose update() just records the payload (we assert on it, not merge).
function captureActor(props = {}) {
    const calls = [];
    return { actor: { system: { props }, async update(data) { calls.push(data); } }, calls };
}

console.log("drive-store: getDrives...");

{
    const a = actorWith({ DriveTable: {
        "2": { DriveText: "c" }, "0": { DriveText: "a" },
        "1": { DriveText: "" }, "3": { $deleted: true }, "4": { DriveText: "e" }
    } });
    assert.deepStrictEqual(getDrives(a), ["a", "c", "e"]);
    console.log("  ✓ Reads DriveTable in numeric order; drops blank + $deleted rows");
}

{
    const a = actorWith({ Drives: "[A] one\n [B] two \n\n" });
    assert.deepStrictEqual(getDrives(a), ["[A] one", "[B] two"]);
    console.log("  ✓ Falls back to the legacy newline string when no table rows");
}

{
    const a = actorWith({ DriveTable: { "0": { DriveText: "tbl" } }, Drives: "[X] legacy" });
    assert.deepStrictEqual(getDrives(a), ["tbl"]);
    console.log("  ✓ Prefers the DriveTable over the legacy string");
}

assert.deepStrictEqual(getDrives(actorWith({})), []);
assert.deepStrictEqual(getDrives(null), []);
console.log("  ✓ Empty/blank actor → []");

console.log("drive-store: buildSetDrivesUpdate...");

{
    // Migration: legacy string present, no table yet → writes table, clears legacy.
    const a = actorWith({ Drives: "[A] one\n[B] two" });
    const u = buildSetDrivesUpdate(a, getDrives(a));
    assert.strictEqual(u["system.props.Drives"], "");
    const rows = u["system.props.DriveTable"];
    assert.deepStrictEqual(Object.keys(rows), ["0", "1"]);
    assert.deepStrictEqual([rows["0"].DriveText, rows["1"].DriveText], ["[A] one", "[B] two"]);
    console.log("  ✓ Migrates legacy string → table + clears the legacy prop");
}

{
    // Shrinking must tombstone the vanished indices (Foundry deep-merges).
    const a = actorWith({ DriveTable: { "0": { DriveText: "a" }, "1": { DriveText: "b" }, "2": { DriveText: "c" } } });
    const u = buildSetDrivesUpdate(a, ["a", "c"]);
    const rows = u["system.props.DriveTable"];
    assert.strictEqual(rows["0"].DriveText, "a");
    assert.strictEqual(rows["1"].DriveText, "c");
    assert.ok(rows["2"] && rows["2"].$deleted === true, "vanished index must be tombstoned");
    console.log("  ✓ Tombstones indices the shorter list no longer covers");
}

console.log("drive-store: addDrive / removeDriveAt / removeDrivesWhere...");

{
    const { actor, calls } = captureActor({ DriveTable: { "0": { DriveText: "[A] one" } } });
    const ok = await addDrive(actor, "  [B] two  ");
    assert.strictEqual(ok, true);
    const rows = calls[0]["system.props.DriveTable"];
    assert.deepStrictEqual([rows["0"].DriveText, rows["1"].DriveText], ["[A] one", "[B] two"]);
    console.log("  ✓ addDrive appends (trimmed); blank input is a no-op");
}
assert.strictEqual(await addDrive(captureActor().actor, "   "), false);

{
    const { actor, calls } = captureActor({ DriveTable: { "0": { DriveText: "a" }, "1": { DriveText: "b" }, "2": { DriveText: "c" } } });
    assert.strictEqual(await removeDriveAt(actor, 1), true);
    const rows = calls[0]["system.props.DriveTable"];
    const live = Object.entries(rows).filter(([, r]) => !r.$deleted).sort((x, y) => Number(x[0]) - Number(y[0])).map(([, r]) => r.DriveText);
    assert.deepStrictEqual(live, ["a", "c"]);
    console.log("  ✓ removeDriveAt drops the right index and reindexes");
}

{
    const { actor, calls } = captureActor({ DriveTable: { "0": { DriveText: "a" } } });
    assert.strictEqual(await removeDriveAt(actor, 9), false);
    assert.strictEqual(calls.length, 0);
    console.log("  ✓ removeDriveAt out of range → false, no write");
}

{
    const { actor, calls } = captureActor({ DriveTable: {
        "0": { DriveText: "[Drive] keep" }, "1": { DriveText: "[Mood] gone" }, "2": { DriveText: "[Mood] also gone" }
    } });
    const removed = await removeDrivesWhere(actor, (l) => /^\s*\[Mood\]/i.test(l));
    assert.strictEqual(removed, 2);
    const rows = calls[0]["system.props.DriveTable"];
    const live = Object.entries(rows).filter(([, r]) => !r.$deleted).map(([, r]) => r.DriveText);
    assert.deepStrictEqual(live, ["[Drive] keep"]);
    console.log("  ✓ removeDrivesWhere strips matching lines (e.g. Moods) and returns the count");
}
assert.strictEqual(await removeDrivesWhere(captureActor({ DriveTable: { "0": { DriveText: "keep" } } }).actor, () => false), 0);

console.log("drive-store: addDriveCapped...");

{
    assert.strictEqual(CHARGEN_DRIVE_CAP, 3);
    const { actor, calls } = captureActor({ DriveTable: { "0": { DriveText: "a" }, "1": { DriveText: "b" } } });
    const { added, removed } = await addDriveCapped(actor, "c");
    assert.strictEqual(added, true);
    assert.deepStrictEqual(removed, []);
    const live = Object.entries(calls[0]["system.props.DriveTable"]).filter(([, r]) => !r.$deleted).map(([, r]) => r.DriveText);
    assert.deepStrictEqual(live, ["a", "b", "c"]);
    console.log("  ✓ Under the cap appends normally");
}

{
    // At the cap: the randomly-picked OLD line goes; the new line survives.
    const { actor, calls } = captureActor({ DriveTable: {
        "0": { DriveText: "a" }, "1": { DriveText: "b" }, "2": { DriveText: "c" }
    } });
    const { added, removed } = await addDriveCapped(actor, "d", { random: () => 0.5 }); // picks index 1 of 3
    assert.strictEqual(added, true);
    assert.deepStrictEqual(removed, ["b"]);
    const live = Object.entries(calls[0]["system.props.DriveTable"]).filter(([, r]) => !r.$deleted).map(([, r]) => r.DriveText);
    assert.deepStrictEqual(live, ["a", "c", "d"]);
    console.log("  ✓ Fourth drive evicts one random old line; the new one stays");
}

{
    // Over-full table (legacy data): removes as many old lines as needed.
    const { actor, calls } = captureActor({ DriveTable: {
        "0": { DriveText: "a" }, "1": { DriveText: "b" }, "2": { DriveText: "c" },
        "3": { DriveText: "d" }, "4": { DriveText: "e" }
    } });
    const { removed } = await addDriveCapped(actor, "f", { random: () => 0 }); // always evicts the head
    assert.deepStrictEqual(removed, ["a", "b", "c"]);
    const live = Object.entries(calls[0]["system.props.DriveTable"]).filter(([, r]) => !r.$deleted).map(([, r]) => r.DriveText);
    assert.deepStrictEqual(live, ["d", "e", "f"]);
    console.log("  ✓ Over-full legacy list shrinks to the cap");
}

{
    const { actor, calls } = captureActor({});
    const { added, removed } = await addDriveCapped(actor, "   ");
    assert.strictEqual(added, false);
    assert.deepStrictEqual(removed, []);
    assert.strictEqual(calls.length, 0);
    console.log("  ✓ Blank input → no write");
}

console.log("\nAll drive-store tests passed.");
