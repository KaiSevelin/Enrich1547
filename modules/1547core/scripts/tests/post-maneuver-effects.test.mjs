// Post-maneuver effect interpreter — pure fragments (combat/post-maneuver-
// effects.mjs, ADR-0004). The push stepping, facing arithmetic and Convert
// re-match math added by the 2026-07-11 automation ruling get direct tests.
import assert from "node:assert/strict";
import {
    planPushPath,
    nextFacingRotation,
    computeConvertBreakdown,
    describePostManeuverEffect,
    postManeuverConditionName,
} from "../combat/post-maneuver-effects.mjs";

console.log("post-maneuver.planPushPath...");
{
    // Unblocked: full distance along +x.
    const clear = planPushPath({ startX: 100, startY: 100, stepX: 1, stepY: 0, gridPx: 100, squares: 3, collides: () => false });
    assert.deepEqual(clear, { x: 400, y: 100, movedSquares: 3 });

    // Wall before the second step: stops after one square.
    let calls = 0;
    const walled = planPushPath({
        startX: 0, startY: 0, stepX: 0, stepY: 1, gridPx: 100, squares: 3,
        collides: () => { calls += 1; return calls >= 2; },
    });
    assert.deepEqual(walled, { x: 0, y: 100, movedSquares: 1 });

    // Fully blocked: stays put.
    const stuck = planPushPath({ startX: 50, startY: 50, stepX: -1, stepY: -1, gridPx: 100, squares: 2, collides: () => true });
    assert.deepEqual(stuck, { x: 50, y: 50, movedSquares: 0 });

    // A throwing collision predicate reads as blocked, not as a crash.
    const throwing = planPushPath({ startX: 0, startY: 0, stepX: 1, stepY: 0, gridPx: 100, squares: 2, collides: () => { throw new Error("boom"); } });
    assert.equal(throwing.movedSquares, 0);

    // Collision is tested center-to-center for the token's footprint (2×2).
    const centers = [];
    planPushPath({
        startX: 0, startY: 0, stepX: 1, stepY: 0, gridPx: 100, squares: 1,
        tokenWidth: 2, tokenHeight: 2,
        collides: (from, to) => { centers.push([from, to]); return false; },
    });
    assert.deepEqual(centers[0], [{ x: 100, y: 100 }, { x: 200, y: 100 }]);
    console.log("  ✓ full push, wall stop, fully blocked, throw-safe, footprint centers");
}

console.log("post-maneuver.nextFacingRotation...");
{
    assert.equal(nextFacingRotation(0, 1), 45, "one step = 45° (8-way facing)");
    assert.equal(nextFacingRotation(315, 1), 0, "wraps at 360");
    assert.equal(nextFacingRotation(0, -1), 315, "negative steps wrap positive");
    assert.equal(nextFacingRotation("90", 2), 180, "string rotation coerces");
    console.log("  ✓ 45°/step, wrap-around both directions");
}

console.log("post-maneuver.computeConvertBreakdown...");
{
    // 1 dmg + 1 crit (rate 1) vs 2 defence: nothing new gets through.
    assert.deepEqual(
        computeConvertBreakdown({ critCount: 1, rate: 1, rawDamage: 1, protection: 2 }),
        { critCount: 1, convertedDamage: 1, additionalDamage: 0 }
    );
    // 3 dmg already through 0 (vs 3 prot); +2 crits at rate 2 → 4 new through.
    assert.deepEqual(
        computeConvertBreakdown({ critCount: 2, rate: 2, rawDamage: 3, protection: 3 }),
        { critCount: 2, convertedDamage: 4, additionalDamage: 4 }
    );
    // Base damage already exceeded protection: only the converted part adds.
    assert.deepEqual(
        computeConvertBreakdown({ critCount: 1, rate: 3, rawDamage: 5, protection: 2 }),
        { critCount: 1, convertedDamage: 3, additionalDamage: 3 }
    );
    assert.equal(computeConvertBreakdown({ critCount: 0, rate: 5, rawDamage: 9, protection: 0 }).convertedDamage, 0);
    console.log("  ✓ re-match against protection (only NEW through damage counts)");
}

console.log("post-maneuver.describePostManeuverEffect...");
{
    // Automated effects (push, rotate) carry NO "(GM applies)" suffix;
    // manual ones (disarm, swallow, place-adjacent, choose-one) keep it.
    const text = describePostManeuverEffect({
        pushTargetSquares: 2,
        rotateTargetFacingSteps: 1,
        disarmWeapon: true,
        swallowTarget: true,
        placeTargetAdjacent: true,
        applyCondition: "prone",
    });
    assert.ok(text.includes("Push 2 sq") && !/Push 2 sq[^;]*GM applies/.test(text), "push is automated");
    assert.ok(text.includes("Rotate target facing 1 step") && !/Rotate target facing 1 step[^;]*GM applies/.test(text), "rotate is automated");
    assert.ok(/Disarm[^;]*GM applies/.test(text), "disarm stays manual");
    assert.ok(/Swallow target \(GM applies\)/.test(text), "swallow stays manual");
    assert.ok(/Place target adjacent \(GM applies\)/.test(text), "place-adjacent stays manual");
    assert.ok(text.includes("<strong>prone</strong>"), "condition named");
    assert.equal(describePostManeuverEffect({}), "", "empty effect describes nothing");
    console.log("  ✓ automated vs (GM applies) labels match the 2026-07-11 ruling");
}

console.log("post-maneuver.postManeuverConditionName...");
{
    assert.equal(postManeuverConditionName({ applyCondition: "locked" }), "locked");
    assert.equal(postManeuverConditionName({ upgradeCondition: " grappled " }), "grappled");
    assert.equal(postManeuverConditionName({}), "");
    console.log("  ✓ apply/upgrade precedence + trim");
}

console.log("\nAll post-maneuver-effects tests passed.");
