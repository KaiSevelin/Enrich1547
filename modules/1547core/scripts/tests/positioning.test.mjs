import assert from "assert";

/**
 * Tests for lib/positioning.mjs — the facing-and-positioning geometry.
 * Verifies the spec's claims: rear-arc tile counts, flanks neutral, the cone
 * scaling with reach/range, large-token rear arc, and the surprise/Hidden
 * branches of computePositionalAdvantage.
 */

const p = await import("../lib/positioning.mjs");

// rotation 0 = South; 180 = North (mirrors the HUD).
console.log("positioning.facingFromRotation / oppositeFacing / rotationForFacing...");
assert.equal(p.facingFromRotation(0), "S");
assert.equal(p.facingFromRotation(180), "N");
assert.equal(p.facingFromRotation(270), "E");
assert.equal(p.facingFromRotation(20), "S");      // snaps to nearest 45°
assert.equal(p.facingFromRotation(44), "SW");     // 44° is nearer 45° than 0°
assert.equal(p.oppositeFacing("N"), "S");
assert.equal(p.oppositeFacing("NE"), "SW");
assert.equal(p.rotationForFacing(p.facingFromRotation(90)), 90); // round-trip

// A 1×1 token facing North (rotation 180) at (5,5). Its rear arc (reach 1) is
// the three tiles directly south: (4,6),(5,6),(6,6).
console.log("positioning.rearConeTiles — 1×1 has 3 rear tiles at reach 1...");
const d1 = { col: 5, row: 5, w: 1, h: 1, rotation: 180 };
const rear1 = p.rearConeTiles(d1, 1).map((t) => `${t.col},${t.row}`).sort();
assert.deepEqual(rear1, ["4,6", "5,6", "6,6"]);

// Pure-flank tiles (due east/west, same row) are NOT rear — flanks are neutral.
console.log("positioning.isInRearCone — flanks are neutral, rear gives +1...");
const flankAttacker = { col: 6, row: 5, w: 1, h: 1, rotation: 0 }; // directly east of d1
assert.equal(p.isInRearCone(d1, flankAttacker, 1), false);
const rearAttacker = { col: 5, row: 6, w: 1, h: 1, rotation: 0 };  // directly behind
assert.equal(p.isInRearCone(d1, rearAttacker, 1), true);
const frontAttacker = { col: 5, row: 4, w: 1, h: 1, rotation: 0 }; // in front
assert.equal(p.isInRearCone(d1, frontAttacker, 1), false);

// Cone scales with distance: a reach-2 attacker two tiles behind only counts
// when maxDist >= 2.
console.log("positioning.isInRearCone — scales with reach/range...");
const rearAttacker2 = { col: 5, row: 7, w: 1, h: 1, rotation: 0 }; // two behind
assert.equal(p.isInRearCone(d1, rearAttacker2, 1), false);
assert.equal(p.isInRearCone(d1, rearAttacker2, 2), true);

// Large token: a 2×2 facing North has 4 rear tiles at reach 1 (back edge + one
// each flank).
console.log("positioning.rearConeTiles — 2×2 has 4 rear tiles...");
const big = { col: 5, row: 5, w: 2, h: 2, rotation: 180 };
const rearBig = p.rearConeTiles(big, 1).map((t) => `${t.col},${t.row}`).sort();
assert.equal(rearBig.length, 4, `expected 4 rear tiles, got ${rearBig.length}: ${rearBig}`);

// Auto-face: an attacker to the north of its target faces North.
console.log("positioning.facingToward...");
const att = { col: 5, row: 8, w: 1, h: 1 };
const tgt = { col: 5, row: 2, w: 1, h: 1 };
assert.equal(p.facingToward(att, tgt).facing, "N");

// computePositionalAdvantage — the rule branches.
console.log("positioning.computePositionalAdvantage — surprise / rear / hidden...");
// Not in combat = surprise: unguarded opening strike, +1, not faceable.
assert.deepEqual(
    p.computePositionalAdvantage({ attacker: frontAttacker, defender: d1, defenderInCombat: false }),
    { surprise: true, rear: true, advantage: 1, faceable: false }
);
// In combat, rear attacker = +1, faceable.
assert.deepEqual(
    p.computePositionalAdvantage({ attacker: rearAttacker, defender: d1, maxDist: 1 }),
    { surprise: false, rear: true, advantage: 1, faceable: true }
);
// In combat, rear but Hidden attacker = +1, NOT faceable.
assert.deepEqual(
    p.computePositionalAdvantage({ attacker: rearAttacker, defender: d1, maxDist: 1, attackerHidden: true }),
    { surprise: false, rear: true, advantage: 1, faceable: false }
);
// Front attacker in combat = no bonus.
assert.deepEqual(
    p.computePositionalAdvantage({ attacker: frontAttacker, defender: d1, maxDist: 1 }),
    { surprise: false, rear: false, advantage: 0, faceable: false }
);

// positionalAdvantageToApply — the +1 is applied up-front in all cases; a
// faceable rear is cancelled when the defender takes the Face reaction.
console.log("facing.positionalAdvantageToApply — applies the advantage up-front...");
const f = await import("../combat/facing.mjs");
assert.equal(f.positionalAdvantageToApply({ surprise: true, rear: true, advantage: 1, faceable: false }), 1);
assert.equal(f.positionalAdvantageToApply({ surprise: false, rear: true, advantage: 1, faceable: false }), 1);
assert.equal(f.positionalAdvantageToApply({ surprise: false, rear: true, advantage: 1, faceable: true }), 1);
assert.equal(f.positionalAdvantageToApply({ surprise: false, rear: false, advantage: 0, faceable: false }), 0);
assert.equal(f.positionalAdvantageToApply(null), 0);

// buildFaceReactionCandidate — shaped like a reaction candidate, carries the
// facingFace effect, and targets the attacker.
console.log("facing.buildFaceReactionCandidate...");
const faceCand = f.buildFaceReactionCandidate({ id: "def1" }, { id: "att1" });
assert.equal(faceCand.type, "reaction");
assert.equal(faceCand.effectData.facingFace, true);
assert.equal(faceCand.id, "face:def1");
assert.equal(faceCand.actor.id, "def1");
assert.equal(faceCand.target.id, "att1");
assert.equal(f.buildFaceReactionCandidate(null), null);

// Nearest-edge footprint distance (melee reach metric, §12 #4).
console.log("positioning.footprintDistanceSquares...");
{
    const at = (col, row, w = 1, h = 1) => ({ col, row, w, h });
    // 1×1 vs 1×1: equals center-Chebyshev.
    assert.equal(p.footprintDistanceSquares(at(0, 0), at(0, 0)), 0, "same tile → 0");
    assert.equal(p.footprintDistanceSquares(at(0, 0), at(1, 0)), 1, "orthogonally adjacent → 1");
    assert.equal(p.footprintDistanceSquares(at(0, 0), at(1, 1)), 1, "diagonally adjacent → 1");
    assert.equal(p.footprintDistanceSquares(at(0, 0), at(2, 0)), 2, "one gap → 2");
    // 2×2 attacker: nearest edge, not center. A 2×2 at (0,0) touches a 1×1 at (2,1).
    assert.equal(p.footprintDistanceSquares(at(0, 0, 2, 2), at(2, 1)), 1, "2×2 footprint touches → 1 (in reach)");
    assert.equal(p.footprintDistanceSquares(at(0, 0, 2, 2), at(1, 1)), 0, "target inside 2×2 footprint → 0");
    assert.equal(p.footprintDistanceSquares(at(0, 0, 2, 2), at(3, 0)), 2, "2×2 right edge (col 1) to col 3 → 2 (one empty tile between)");
    assert.equal(p.footprintDistanceSquares(null, at(0, 0)), null, "missing footprint → null");
}
console.log("  ✓ nearest-edge: overlap 0, touching 1, large tokens correct");

console.log("positioning.test.mjs — all assertions passed.");
