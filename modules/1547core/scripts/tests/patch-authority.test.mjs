// Patch authority (services/patch-transport.js, ADR-0004): the write-routing
// decision table — who may apply which patch locally, and which GM is the
// designated applier. This is the logic behind every cross-client combat
// write; the socket itself still needs the two-client live test, but the
// decisions are pinned here with a stubbed `game`.
import assert from "node:assert/strict";
import { canApplyPatchLocally, isDesignatedPatchGM } from "../services/patch-transport.js";

const previousGame = globalThis.game;
const previousCanvas = globalThis.canvas;

function stubGame({ isGM = false, userId = "u1", activeGM = undefined, users = [], actors = {} } = {}) {
    globalThis.game = {
        user: { isGM, id: userId },
        users: Object.assign([...users], { activeGM }),
        actors: { get: (id) => actors[id] ?? null },
        scenes: { get: () => null },
    };
}

try {
    console.log("patch-authority.canApplyPatchLocally...");
    {
        // GM applies anything.
        stubGame({ isGM: true });
        assert.equal(canApplyPatchLocally({ kind: "combatant.update", combatantId: "c1" }), true);
        assert.equal(canApplyPatchLocally({ kind: "actor.update", actorId: "anyone" }), true);

        // Player: Combat doc is GM-only, regardless of ownership.
        stubGame({ isGM: false, actors: { mine: { isOwner: true } } });
        assert.equal(canApplyPatchLocally({ kind: "combatant.update", combatantId: "c1" }), false, "combatant.update always routes to the GM");

        // Player: actor writes hinge on ownership.
        assert.equal(canApplyPatchLocally({ kind: "actor.update", actorId: "mine" }), true, "owned actor applies locally");
        assert.equal(canApplyPatchLocally({ kind: "actor.setFlag", actorId: "theirs" }), false, "unowned actor routes to the GM");
        assert.equal(canApplyPatchLocally({ kind: "actor.applyCondition", actorId: "nobody" }), false, "unresolvable actor routes (safe default)");

        // Player: token writes hinge on the token's ACTOR ownership; an
        // unresolvable token (no scene/canvas) routes to the GM.
        assert.equal(canApplyPatchLocally({ kind: "token.update", tokenId: "t1", sceneId: null }), false);
        console.log("  ✓ GM-anything, combatant GM-only, ownership-gated actor/token writes");
    }

    console.log("patch-authority.isDesignatedPatchGM...");
    {
        stubGame({ isGM: false });
        assert.equal(isDesignatedPatchGM(), false, "players are never the designated GM");

        // Foundry's activeGM is authoritative when present.
        stubGame({ isGM: true, userId: "gm2", activeGM: { id: "gm2" } });
        assert.equal(isDesignatedPatchGM(), true);
        stubGame({ isGM: true, userId: "gm2", activeGM: { id: "gm1" } });
        assert.equal(isDesignatedPatchGM(), false, "a second GM defers to the active GM");

        // Fallback: lowest-id active GM wins (deterministic, no double-apply).
        const gms = [
            { id: "gmB", active: true, isGM: true },
            { id: "gmA", active: true, isGM: true },
            { id: "p1", active: true, isGM: false },
        ];
        stubGame({ isGM: true, userId: "gmA", users: gms });
        assert.equal(isDesignatedPatchGM(), true, "lowest-id active GM is designated");
        stubGame({ isGM: true, userId: "gmB", users: gms });
        assert.equal(isDesignatedPatchGM(), false, "the other GM stands down");

        // No user list at all: a lone GM designates itself.
        stubGame({ isGM: true, userId: "gm1", users: [] });
        assert.equal(isDesignatedPatchGM(), true);
        console.log("  ✓ activeGM authoritative; lowest-id fallback prevents double-apply");
    }
} finally {
    globalThis.game = previousGame;
    globalThis.canvas = previousCanvas;
}

console.log("\nAll patch-authority tests passed.");
