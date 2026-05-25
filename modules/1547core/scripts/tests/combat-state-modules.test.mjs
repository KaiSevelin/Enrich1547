import assert from "assert";

/**
 * Tests for the three small combat state modules added in step 4-6 of
 * the combat-resolver carve-up: persistent-effects, hp-state,
 * reaction-candidates.
 *
 * Each module follows the same shape: pure helpers return plain
 * descriptors; patch-returners return `{ patches, result }`. Tests
 * assert on the patch shape (per ADR-0001) without needing a real
 * Foundry actor.
 */

const persistentEffects = await import("../combat/persistent-effects.mjs");
const hpState = await import("../combat/hp-state.mjs");
const reactionCandidates = await import("../combat/reaction-candidates.mjs");

// Stub the legality module before reaction-candidates pulls it (it
// already loaded above but doesn't actually call game.* until invoked).
// For getLegalManeuvers we need a passthrough; mock at the import
// boundary instead.

// ─────────────────────────────────────── persistent-effects.mjs ──

const PE_FLAG = "1547core";

console.log("persistent-effects.getActivePersistentEffects...");

{
    const actor = { flags: { [PE_FLAG]: { activeFullTurnManeuvers: [
        { createsPersistentEffect: "overwatch", duration: "until-consumed", name: "Overwatch" },
        { createsPersistentEffect: "", name: "ignored (no effect type)" },
        { createsPersistentEffect: "guardian-stance", duration: "until-side-active-again" },
    ] } } };

    const all = persistentEffects.getActivePersistentEffects(actor);
    assert.strictEqual(all.length, 2);
    console.log("  ✓ filters out entries with no createsPersistentEffect");

    const filtered = persistentEffects.getActivePersistentEffects(actor, {
        isCombatActive: true,
        fullTurnAvailable: true,
    });
    assert.strictEqual(filtered.length, 1, "drops until-side-active-again when combat active + fullTurnAvailable");
    assert.strictEqual(filtered[0].createsPersistentEffect, "overwatch");
    console.log("  ✓ honours the side-active drop rule");
}

console.log("\npersistent-effects.planConsumePersistentEffect...");

{
    const actor = {
        id: "actor-1",
        flags: { [PE_FLAG]: { activeFullTurnManeuvers: [
            { createsPersistentEffect: "overwatch", name: "Overwatch" },
            { createsPersistentEffect: "rally", name: "Rally" },
        ] } },
    };

    const { patches, result } = persistentEffects.planConsumePersistentEffect(actor, "overwatch");
    assert.strictEqual(result.consumed, true);
    assert.strictEqual(patches.length, 1);
    assert.strictEqual(patches[0].kind, "actor.update");
    assert.strictEqual(patches[0].actorId, "actor-1");
    const updateKey = `flags.${PE_FLAG}.activeFullTurnManeuvers`;
    assert.strictEqual(patches[0].data[updateKey].length, 1);
    assert.strictEqual(patches[0].data[updateKey][0].createsPersistentEffect, "rally");
    console.log("  ✓ patches rewrite the array without the consumed entry");
}

{
    const actor = {
        id: "a",
        flags: { [PE_FLAG]: { activeFullTurnManeuvers: [{ createsPersistentEffect: "rally" }] } },
    };
    const out = persistentEffects.planConsumePersistentEffect(actor, "overwatch");
    assert.deepStrictEqual(out, { patches: [], result: { consumed: false } });
    console.log("  ✓ no patches, consumed:false when effect missing");
}

// ─────────────────────────────────────── hp-state.mjs ──

console.log("\nhp-state.getActorCurrentHitPoints...");

assert.strictEqual(
    hpState.getActorCurrentHitPoints({ system: { props: { CurrentHitPoints: 12 } } }),
    12
);
assert.strictEqual(
    hpState.getActorCurrentHitPoints({ system: { props: { HP: 7 } } }),
    7,
    "falls back through CurrentHitPoints → HitPoints → HP → CurrentHP"
);
assert.strictEqual(hpState.getActorCurrentHitPoints(null), 0);
console.log("  ✓ resolves CurrentHitPoints; falls through aliases");

console.log("\nhp-state.planApplyDamage...");

{
    const actor = { id: "actor-1", system: { props: { CurrentHitPoints: 10 } } };
    const { patches, result } = hpState.planApplyDamage(actor, 3);
    assert.strictEqual(result.previousHitPoints, 10);
    assert.strictEqual(result.currentHitPoints, 7);
    assert.strictEqual(result.isDead, false);
    assert.strictEqual(result.isUnconscious, false);
    assert.strictEqual(patches.length, 4, "HP update + 3 status effects");
    assert.strictEqual(patches[0].kind, "actor.update");
    assert.strictEqual(patches[0].data["system.props.CurrentHitPoints"], 7);
    const statusKinds = patches.slice(1).map((p) => `${p.keyword}=${p.active}`);
    assert.deepStrictEqual(statusKinds, ["dead=false", "defeated=false", "unconscious=false"]);
    console.log("  ✓ partial damage: HP patch + 3 inactive status effects");
}

{
    const actor = { id: "actor-1", system: { props: { CurrentHitPoints: 4 } } };
    const { patches, result } = hpState.planApplyDamage(actor, 10);
    assert.strictEqual(result.currentHitPoints, 0);
    assert.strictEqual(result.isDead, true);
    assert.strictEqual(result.isUnconscious, false);
    const statusKinds = patches.slice(1).map((p) => `${p.keyword}=${p.active}`);
    assert.deepStrictEqual(statusKinds, ["dead=true", "defeated=true", "unconscious=false"]);
    console.log("  ✓ lethal damage: dead+defeated true, unconscious false");
}

{
    const actor = { id: "actor-1", system: { props: { CurrentHitPoints: 4 } } };
    const { result } = hpState.planApplyDamage(actor, 3);
    assert.strictEqual(result.currentHitPoints, 1);
    assert.strictEqual(result.isUnconscious, true,
        "HP == 1 → unconscious (HP > 0 && HP <= 1)");
    assert.strictEqual(result.isDead, false);
    console.log("  ✓ HP=1: unconscious true, dead false");
}

{
    const out = hpState.planApplyDamage(null, 5);
    assert.deepStrictEqual(out.patches, []);
    console.log("  ✓ null actor: no patches, defensive defaults");
}

// ─────────────────────────────────────── reaction-candidates.mjs ──

console.log("\nreaction-candidates.resolveThreatReactionActor...");

assert.strictEqual(reactionCandidates.resolveThreatReactionActor({}), null);

{
    const reactor = { id: "react-1" };
    const mover = { id: "mover-1" };
    const r = reactionCandidates.resolveThreatReactionActor({ mover, reactor });
    assert.strictEqual(r, reactor, "explicit reactor wins");
    console.log("  ✓ explicit reactor wins");
}

{
    // mover and one explicit candidate match → reactor skipped because it'd be the mover
    const mover = { id: "same" };
    const r = reactionCandidates.resolveThreatReactionActor({ mover, reactor: { id: "same" } });
    assert.strictEqual(r, null, "skips a candidate whose id matches the mover");
    console.log("  ✓ skips candidate matching mover id");
}

console.log("\nreaction-candidates.buildOverwatchReactionCandidate...");

{
    const out = reactionCandidates.buildOverwatchReactionCandidate({
        reactor: { id: "r" },
        mover: { id: "m" },
        reactionWeapon: { _id: "w", maxRange: 6 },
        reactionProfile: { attackType: "ranged" },
        threatPayload: { distanceSquares: 4 },
        activePersistentEffects: [{ createsPersistentEffect: "overwatch", name: "Overwatch", effectData: {} }],
    });
    assert.ok(out, "produces a candidate when overwatch is active and in range");
    assert.strictEqual(out.generatedByPersistentEffect, "overwatch");
    assert.strictEqual(out.effectData.createFreeSafeAttack, true);
    console.log("  ✓ produces a candidate when overwatch active + ranged + in range");
}

{
    const out = reactionCandidates.buildOverwatchReactionCandidate({
        reactor: { id: "r" },
        mover: { id: "m" },
        reactionWeapon: { _id: "w", maxRange: 6 },
        reactionProfile: { attackType: "melee" },
        threatPayload: {},
        activePersistentEffects: [{ createsPersistentEffect: "overwatch" }],
    });
    assert.strictEqual(out, null, "melee weapon disqualifies overwatch");
    console.log("  ✓ null when reaction profile is melee");
}

{
    const out = reactionCandidates.buildOverwatchReactionCandidate({
        reactor: { id: "r" },
        mover: { id: "m" },
        reactionWeapon: { _id: "w", maxRange: 3 },
        reactionProfile: { attackType: "ranged" },
        threatPayload: { distanceSquares: 5 },
        activePersistentEffects: [{ createsPersistentEffect: "overwatch" }],
    });
    assert.strictEqual(out, null, "distance > maxRange disqualifies overwatch");
    console.log("  ✓ null when distance exceeds maxRange");
}

{
    const out = reactionCandidates.buildOverwatchReactionCandidate({
        reactor: { id: "r" },
        mover: { id: "m" },
        reactionWeapon: { _id: "w", maxRange: 6 },
        reactionProfile: { attackType: "ranged" },
        threatPayload: {},
        activePersistentEffects: [],
    });
    assert.strictEqual(out, null, "no overwatch effect → no candidate");
    console.log("  ✓ null when activePersistentEffects has no overwatch");
}

console.log("\nAll combat state-module tests passed.");
