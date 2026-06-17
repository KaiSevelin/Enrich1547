import assert from "assert";
import {
    isReactionAvailable,
    planMarkReactionUsed,
    isMovementReactionAvailable,
    planMarkMovementReacted,
} from "../combat/activation-state.mjs";
import { MODULE_ID } from "../lib/constants.mjs";

// Minimal stubs: actors are plain { id, flags }, combats are { id, round }.
function actor(id, flags = {}) { return { id, flags: { [MODULE_ID]: flags } }; }
const fight = { id: "combat-1", round: 2 };

console.log("activation-state.isReactionAvailable...");
assert.strictEqual(isReactionAvailable(null, fight), true, "no actor → available");
assert.strictEqual(isReactionAvailable(actor("a"), null), true, "no active round → available");
assert.strictEqual(isReactionAvailable(actor("a"), fight), true, "no flag → available");
assert.strictEqual(
    isReactionAvailable(actor("a", { reactionUsedRound: "combat-1:1" }), fight),
    true, "flag from a different round → available",
);
assert.strictEqual(
    isReactionAvailable(actor("a", { reactionUsedRound: "combat-1:2" }), fight),
    false, "flag for this combat+round → spent",
);
assert.strictEqual(
    isReactionAvailable(actor("a", { reactionUsedRound: "old-fight:2" }), fight),
    true, "stale flag from a prior combat is ignored → available",
);
console.log("  ✓ renews each round, scoped by combat id");

console.log("\nactivation-state.planMarkReactionUsed...");
{
    const { patches } = planMarkReactionUsed(actor("a"), fight);
    assert.deepStrictEqual(patches, [{
        kind: "actor.setFlag", actorId: "a", scope: MODULE_ID,
        key: "reactionUsedRound", value: "combat-1:2",
    }]);
}
assert.deepStrictEqual(planMarkReactionUsed({ }, fight), { patches: [] }, "no actor id → no patch");
assert.deepStrictEqual(planMarkReactionUsed(actor("a"), null), { patches: [] }, "no round → no patch");
console.log("  ✓ emits one actor.setFlag patch with the round key; guards missing inputs");

console.log("\nactivation-state.isMovementReactionAvailable...");
{
    const reactor = actor("r", { "moveReact_moverA": "combat-1:2" });
    assert.strictEqual(isMovementReactionAvailable(reactor, { id: "moverA" }, fight), false, "spent vs mover A");
    assert.strictEqual(isMovementReactionAvailable(reactor, { id: "moverB" }, fight), true, "still available vs mover B");
    assert.strictEqual(isMovementReactionAvailable(null, { id: "moverA" }, fight), true, "no reactor → available");
    assert.strictEqual(isMovementReactionAvailable(reactor, null, fight), true, "no mover → available");
}
console.log("  ✓ per-mover isolation, renews each round");

console.log("\nactivation-state.planMarkMovementReacted...");
{
    const { patches } = planMarkMovementReacted(actor("r"), { id: "moverA" }, fight);
    assert.deepStrictEqual(patches, [{
        kind: "actor.setFlag", actorId: "r", scope: MODULE_ID,
        key: "moveReact_moverA", value: "combat-1:2",
    }]);
}
assert.deepStrictEqual(planMarkMovementReacted(actor("r"), { }, fight), { patches: [] }, "no mover id → no patch");
assert.deepStrictEqual(planMarkMovementReacted({ }, { id: "moverA" }, fight), { patches: [] }, "no reactor id → no patch");
console.log("  ✓ emits one per-mover actor.setFlag patch; guards missing inputs");

console.log("\nactivation-state.test.mjs — all assertions passed.");
