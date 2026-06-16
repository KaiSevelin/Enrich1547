import assert from "assert";
import { laneTiles, blockValueForSize, gatherObstacles, rollInterception } from "../lib/lane.mjs";

function cellSet(cells) { return new Set(cells.map((c) => `${c.col},${c.row}`)); }

console.log("lane.laneTiles...");
// Straight horizontal line includes every cell between the ends, ordered.
{
    const lane = laneTiles({ col: 0, row: 0 }, { col: 3, row: 0 });
    assert.deepStrictEqual(lane, [
        { col: 0, row: 0 }, { col: 1, row: 0 }, { col: 2, row: 0 }, { col: 3, row: 0 },
    ]);
}
// Same cell → single tile.
assert.deepStrictEqual(laneTiles({ col: 2, row: 2 }, { col: 2, row: 2 }), [{ col: 2, row: 2 }]);
// Pure diagonal passes through the diagonal cells (near→far, endpoints present).
{
    const lane = laneTiles({ col: 0, row: 0 }, { col: 2, row: 2 });
    const keys = cellSet(lane);
    assert.ok(keys.has("0,0") && keys.has("2,2"), "endpoints present");
    assert.strictEqual(lane[0].col, 0, "ordered from shooter");
}
console.log("  ✓ traces ordered cells, dedups, handles point + diagonal");

console.log("\nlane.blockValueForSize...");
assert.strictEqual(blockValueForSize(0.5), 1); // tiny
assert.strictEqual(blockValueForSize(1), 2);   // medium / person
assert.strictEqual(blockValueForSize(2), 3);   // large
assert.strictEqual(blockValueForSize(3), 4);   // huge
assert.strictEqual(blockValueForSize(5), 4);   // clamps at 4
assert.strictEqual(blockValueForSize(undefined), 2); // default ~person
console.log("  ✓ size → block value 1..4");

console.log("\nlane.gatherObstacles...");
{
    const lane = laneTiles({ col: 0, row: 0 }, { col: 4, row: 0 });
    const occupants = [
        { id: "shooter", name: "Me", size: 1, cells: cellSet([{ col: 0, row: 0 }]) },
        { id: "ally", name: "Ally", size: 1, cells: cellSet([{ col: 1, row: 0 }]) },
        { id: "cart", name: "Cart", size: 2, cells: cellSet([{ col: 2, row: 0 }, { col: 3, row: 0 }]) },
        { id: "target", name: "Foe", size: 1, cells: cellSet([{ col: 4, row: 0 }]) },
        { id: "bystander", name: "Off-lane", size: 1, cells: cellSet([{ col: 2, row: 3 }]) },
    ];
    const obstacles = gatherObstacles(lane, occupants, { shooterId: "shooter", targetId: "target" });
    // shooter & target excluded; off-lane excluded; nearest-first; cart is ONE entry.
    assert.deepStrictEqual(obstacles.map((o) => o.id), ["ally", "cart"]);
    assert.strictEqual(obstacles[0].blockValue, 2); // ally 1×1
    assert.strictEqual(obstacles[1].blockValue, 3); // cart 2×2, one obstacle
}
console.log("  ✓ excludes endpoints/off-lane, nearest-first, one entry per occupant");

console.log("\nlane.rollInterception...");
{
    const obstacles = [{ id: "ally", blockValue: 2 }, { id: "cart", blockValue: 3 }];
    // First obstacle rolls 1 (≤2) → caught, second never rolled.
    let calls = 0;
    const hit = rollInterception(obstacles, () => { calls += 1; return calls === 1 ? 1 : 6; });
    assert.strictEqual(hit.obstacle.id, "ally");
    assert.strictEqual(calls, 1, "stops at first catch");
}
{
    const obstacles = [{ id: "ally", blockValue: 2 }, { id: "cart", blockValue: 3 }];
    // ally rolls 5 (miss), cart rolls 3 (≤3) → cart catches.
    const seq = [5, 3]; let i = 0;
    const hit = rollInterception(obstacles, () => seq[i++]);
    assert.strictEqual(hit.obstacle.id, "cart");
}
{
    // All miss → shot gets through.
    const hit = rollInterception([{ id: "ally", blockValue: 2 }], () => 6);
    assert.strictEqual(hit, null);
}
console.log("  ✓ nearest-first, first catch wins, early stop, clean pass-through");

console.log("\nlane.test.mjs — all assertions passed.");
