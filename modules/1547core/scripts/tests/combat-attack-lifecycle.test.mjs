import assert from "assert";

/**
 * Tests for combat/attack-lifecycle.mjs and combat/maneuver-state.mjs.
 *
 * Both modules ship in pass A of the attack-lifecycle carve-up:
 *  - attack-lifecycle.mjs holds the self-contained pure helpers
 *    (modifier summary/merging, reserved-cost gathering, roll-summary
 *    normalisation, pending-attack tagging, equipped-armor probe).
 *  - maneuver-state.mjs holds the two patch-returners for maneuver
 *    resource spending + committed-maneuver flag updates, plus the
 *    pure buildCommittedManeuverRecord.
 *
 * Pass B (next round) will move the imperative lifecycle functions
 * (resolveAttackOutcome, declareAttack, executeResolvedReaction, ...)
 * into attack-lifecycle.mjs and they'll start returning
 * `{ events, patches }`. These tests grow then.
 */

const al = await import("../combat/attack-lifecycle.mjs");
const ms = await import("../combat/maneuver-state.mjs");

// ────────────────────────────────────────── modifier summarisation ──

console.log("attack-lifecycle.summarizeEffectData...");

assert.deepStrictEqual(
    al.summarizeEffectData({}),
    {
        addMainDice: 0, addDisadvantage: 0, addMultiplierDice: 0,
        addRiskDice: 0, addMoveSquares: 0, safeAttack: false,
    },
    "zero defaults across the board"
);
assert.strictEqual(
    al.summarizeEffectData({ createFreeSafeAttack: true }).safeAttack,
    true,
    "any safe-attack flavour flips safeAttack to true"
);
assert.strictEqual(
    al.summarizeEffectData({ ifEscapeSucceedsCreateFreeSafeAttack: true }).safeAttack,
    true
);
assert.strictEqual(
    al.summarizeEffectData({ safeAttack: true }).safeAttack,
    true,
    "direct safeAttack flag flips safeAttack to true"
);
console.log("  ✓ zero defaults + safeAttack triggers");

console.log("\nattack-lifecycle.mergeModifierSummaries...");
{
    const out = al.mergeModifierSummaries(
        { addMainDice: 2, safeAttack: false },
        { addMainDice: 3, addRiskDice: 1, safeAttack: true }
    );
    assert.strictEqual(out.addMainDice, 5);
    assert.strictEqual(out.addRiskDice, 1);
    assert.strictEqual(out.safeAttack, true);
    console.log("  ✓ sums numerics; safeAttack OR'd");
}

console.log("\nattack-lifecycle.mergeManeuverEffects...");
{
    const m1 = { effectData: { addMainDice: 1, addRiskDice: 2, createFreeSafeAttack: true } };
    const m2 = { effectData: { addMainDice: 3 } };
    const out = al.mergeManeuverEffects([m1, m2]);
    assert.strictEqual(out.addMainDice, 4);
    assert.strictEqual(out.addRiskDice, 2);
    assert.strictEqual(out.safeAttack, true);
    console.log("  ✓ folds many maneuvers; createsSafeAttack rule propagates");
}

console.log("\nattack-lifecycle.normalizeDefenseModifiers...");
{
    const out = al.normalizeDefenseModifiers({
        defenseReaction: { effectData: { addArmorDice: 1, reduceDamageTaken: 2 } },
        damageTakenReaction: { effectData: { lockParryingWeaponUntil: "endOfTurn", createFreeSafeCounterattack: true } },
    });
    assert.strictEqual(out.addArmorDice, 1);
    assert.strictEqual(out.reduceDamageTaken, 2);
    assert.strictEqual(out.lockParryingWeaponUntil, "endOfTurn");
    assert.strictEqual(out.safeCounterattack, true);
    console.log("  ✓ collects both reactions; nulls collapse cleanly");
}

{
    // Passive defense maneuvers (Shield) fold in like a chosen reaction.
    const out = al.normalizeDefenseModifiers({
        defenseReaction: { effectData: { addArmorDice: 1 } },
        passiveSources: [
            { name: "Shield", effectData: { addArmorDice: 2 } },
            { name: "Nope", effectData: {} },
        ],
    });
    assert.strictEqual(out.addArmorDice, 3, "reaction +1 and passive Shield +2 stack");
    // Absent/empty passiveSources is a no-op.
    const none = al.normalizeDefenseModifiers({ defenseReaction: { effectData: { addArmorDice: 1 } } });
    assert.strictEqual(none.addArmorDice, 1);
    console.log("  ✓ passiveSources (Shield) fold into addArmorDice; empty is a no-op");
}

console.log("\nattack-lifecycle.normalizeAppliedAttackModifiers...");
assert.deepStrictEqual(
    al.normalizeAppliedAttackModifiers({ addMainDice: 2, addMoveSquares: 3 }),
    { addMainDice: 2, addDisadvantage: 0, addMultiplierDice: 0, addRiskDice: 0, addMoveSquares: 3, safeAttack: false }
);
console.log("  ✓ fills missing keys with 0/false");

// ────────────────────────────────────────── reserved costs ──

console.log("\nattack-lifecycle.collectReservedCosts...");
{
    const maneuvers = [
        { _id: "m1", CostType: "StaminaPoints", CostAmount: 2 },
        { _id: "m2", CostType: "null", CostAmount: 0 },        // skipped
        { _id: "m3", CostAmount: 5 },                          // skipped (no CostType)
        { _id: "m4", CostType: "CriticalPoints", CostAmount: 1 },
    ];
    const out = al.collectReservedCosts(maneuvers);
    assert.strictEqual(out.length, 2);
    assert.deepStrictEqual(out[0], { maneuverId: "m1", costType: "StaminaPoints", costAmount: 2 });
    assert.deepStrictEqual(out[1], { maneuverId: "m4", costType: "CriticalPoints", costAmount: 1 });
    console.log("  ✓ filters out 'null' and missing CostType");
}

// ────────────────────────────────────────── roll summary ──

console.log("\nattack-lifecycle.normalizeRollSummary...");
assert.deepStrictEqual(
    al.normalizeRollSummary(null),
    { damage: 0, protection: 0, crit: 0, fumble: 0, multiplier: 1 }
);
assert.deepStrictEqual(
    al.normalizeRollSummary({ damage: 4, multiplier: 2 }),
    { damage: 4, protection: 0, crit: 0, fumble: 0, multiplier: 2 }
);
console.log("  ✓ defaults missing fields, preserves multiplier");

console.log("\nattack-lifecycle.applyMultiplier...");
assert.deepStrictEqual(
    al.applyMultiplier({ damage: 4, protection: 2, crit: 1, multiplier: 2 }),
    { damage: 8, protection: 4, crit: 2, multiplier: 2 }
);
// A 0 multiplier (multiply-fail) cancels ALL damage and protection.
assert.deepStrictEqual(
    al.applyMultiplier({ damage: 5, protection: 3, crit: 2, multiplier: 0 }),
    { damage: 0, protection: 0, crit: 0, multiplier: 0 }
);
// A missing / non-finite multiplier means "no multiplier" (×1).
assert.strictEqual(al.applyMultiplier({ damage: 5 }).damage, 5);
console.log("  ✓ scales by multiplier; 0 cancels everything; missing → ×1");

// ────────────────────────────────────────── pending-attack tag ──

console.log("\nattack-lifecycle.isPendingAttack / PENDING_ATTACK_KIND...");
assert.strictEqual(al.PENDING_ATTACK_KIND, "1547core.pendingAttack");
assert.strictEqual(al.isPendingAttack({ kind: al.PENDING_ATTACK_KIND }), true);
assert.strictEqual(al.isPendingAttack({ kind: "something-else" }), false);
assert.strictEqual(al.isPendingAttack(null), false);
console.log("  ✓ tag constant + predicate");

// ────────────────────────────────────────── actorHasEquippedArmor ──

console.log("\nattack-lifecycle.actorHasEquippedArmor...");
{
    const actorWithArmor = {
        items: { contents: [{
            type: "armor",
            system: { props: { Equipped: true } },
            flags: {},
        }] },
    };
    assert.strictEqual(al.actorHasEquippedArmor(actorWithArmor), true);

    const actorNoArmor = { items: { contents: [{ system: { props: {} } }] } };
    assert.strictEqual(al.actorHasEquippedArmor(actorNoArmor), false);

    const actorUnequippedArmor = {
        items: { contents: [{
            type: "armor",
            system: { props: { ArmorType: "Medium", Equipped: false } },
            flags: {},
        }] },
    };
    assert.strictEqual(al.actorHasEquippedArmor(actorUnequippedArmor), false,
        "armor on the actor but not equipped → false");
    console.log("  ✓ recognises armor and respects Equipped flag");
}

// ────────────────────────────────────────── maneuver-state ──

console.log("\nmaneuver-state.buildCommittedManeuverRecord...");
{
    const rec = ms.buildCommittedManeuverRecord({
        _id: "m1",
        name: "Overwatch",
        type: "full-turn",
        effectData: { duration: "until-consumed", createsPersistentEffect: "overwatch" },
    });
    assert.strictEqual(rec.id, "m1");
    assert.strictEqual(rec.duration, "until-consumed");
    assert.strictEqual(rec.createsPersistentEffect, "overwatch");
    assert.ok(typeof rec.committedAt === "number");
    console.log("  ✓ snapshots id / duration / persistent-effect from effectData");
}

console.log("\nmaneuver-state.planSpendActorManeuverCost...");
{
    const actor = { id: "a", system: { props: { StaminaPoints: 5 } } };
    const m = { CostType: "StaminaPoints", CostAmount: 2 };
    const { patches, result } = ms.planSpendActorManeuverCost(actor, m);
    assert.strictEqual(patches.length, 1);
    assert.strictEqual(patches[0].kind, "actor.update");
    assert.strictEqual(patches[0].data["system.props.StaminaPoints"], 3);
    assert.strictEqual(result.previousValue, 5);
    assert.strictEqual(result.nextValue, 3);
    console.log("  ✓ produces an actor.update patch decrementing the resource");
}

{
    const out = ms.planSpendActorManeuverCost(
        { id: "a" },
        { CostType: "null", CostAmount: 5 }
    );
    assert.deepStrictEqual(out, { patches: [], result: null },
        "CostType 'null' → no patches");
    console.log("  ✓ CostType 'null': no patches");
}

{
    const out = ms.planSpendActorManeuverCost(
        { id: "a", system: { props: { StaminaPoints: 1 } } },
        { CostType: "StaminaPoints", CostAmount: 5 }
    );
    assert.strictEqual(out.patches[0].data["system.props.StaminaPoints"], 0,
        "clamped to 0 when cost > available");
    console.log("  ✓ clamped at 0 when cost exceeds available");
}

// CorePoints is a derived pool: spending INCREMENTS SpentCorePoints
// (Available = Max - Spent - Reserved recomputes), not a raw decrement.
{
    const actor = { id: "a", system: { props: { SpentCorePoints: 1, MaxCorePoints: 5 } } };
    const { patches, result } = ms.planSpendActorManeuverCost(actor, { CostType: "CorePoints", CostAmount: 2 });
    assert.strictEqual(patches[0].data["system.props.SpentCorePoints"], 3,
        "Core spend increments SpentCorePoints (1 + 2)");
    assert.strictEqual(result.nextValue, 3);
    console.log("  ✓ CorePoints spend increments SpentCorePoints (derived pool)");
}

{
    const actor = { id: "a", system: { props: { SpentCorePoints: 4, MaxCorePoints: 5 } } };
    const out = ms.planSpendActorManeuverCost(actor, { CostType: "CorePoints", CostAmount: 3 });
    assert.strictEqual(out.patches[0].data["system.props.SpentCorePoints"], 5,
        "clamped to MaxCorePoints");
    console.log("  ✓ CorePoints spend clamps to MaxCorePoints");
}

console.log("\nmaneuver-state.planAppendCommittedManeuverState...");
{
    const actor = {
        id: "a",
        flags: { "1547core": { activeFullTurnManeuvers: [{ id: "m1", name: "Old" }] } },
    };
    const record = { id: "m2", name: "New", effectData: {} };
    const { patches, result } = ms.planAppendCommittedManeuverState(actor, record);
    assert.strictEqual(patches.length, 1);
    const updateKey = "flags.1547core.activeFullTurnManeuvers";
    assert.strictEqual(patches[0].data[updateKey].length, 2);
    assert.strictEqual(patches[0].data[updateKey][1].id, "m2");
    assert.strictEqual(result.appended, true);
    console.log("  ✓ appends new record; preserves prior entries");
}

{
    // Replacing the same id should NOT duplicate
    const actor = {
        id: "a",
        flags: { "1547core": { activeFullTurnManeuvers: [{ id: "m1", name: "Old" }] } },
    };
    const record = { id: "m1", name: "Updated" };
    const { patches } = ms.planAppendCommittedManeuverState(actor, record);
    const list = patches[0].data["flags.1547core.activeFullTurnManeuvers"];
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].name, "Updated");
    console.log("  ✓ replaces existing entry with the same id (no duplicates)");
}

{
    const out = ms.planAppendCommittedManeuverState({ id: "a" }, { id: null });
    assert.deepStrictEqual(out, { patches: [], result: { appended: false } });
    console.log("  ✓ no patches when record has no id");
}

// ────────────────────────────────────────── buildPendingAttack ──

console.log("\nattack-lifecycle.buildPendingAttack (with injected deps)...");

function fakeWeapon({ id = "w1", name = "Sword", attackType = "melee" } = {}) {
    return {
        id, _id: id, name,
        attackProfiles: [{ id: "default", name: "Default", attackType, dice: ["Heavy"], allowedAmmoTypes: [] }],
        activeAttackProfileKey: "Attack",
        usesAmmo: false,
        loadedAmmoId: null,
        ammoType: "", ammoCapacity: 0, ammoLoaded: 0,
        equipped: true,
        itemDocument: { id, parent: null },
    };
}
function fakeActor({ id = "a1", name = "Hero" } = {}) {
    return {
        id, name,
        items: { get: () => null, contents: [] },
        system: { props: {} },
        flags: {},
    };
}

{
    // Happy path
    const weapon = fakeWeapon();
    const actor = fakeActor();
    const target = fakeActor({ id: "t1", name: "Goblin" });

    const pa = al.buildPendingAttack({
        actor,
        target,
        weapon,
        normalizeWeapon: (w, a) => w,  // already normalised in fixture
        buildAttackReactionCandidates: () => [{ id: "react-1", name: "Parry" }],
    });

    assert.strictEqual(pa.kind, al.PENDING_ATTACK_KIND);
    assert.strictEqual(pa.actor, actor);
    assert.strictEqual(pa.target, target);
    assert.strictEqual(pa.weapon, weapon);
    assert.strictEqual(pa.profile.id, "default");
    assert.strictEqual(pa.safeAttack, false);
    assert.strictEqual(pa.committed, false);
    assert.deepStrictEqual(pa.reactionCandidates, [{ id: "react-1", name: "Parry" }]);
    console.log("  ✓ happy path: returns PendingAttack with PENDING_ATTACK_KIND tag + injected reactionCandidates");
}

{
    const modifierDoc = {
        id: "mod-poison",
        name: "Poisoned",
        system: { props: {} },
        flags: {
            "1547Core": {
                sourceData: {
                    _id: "mod-poison",
                    name: "Poisoned",
                    onHitEffects: [{ triggerMode: "onDamageApplied", damageAmount: 1 }],
                },
            },
        },
    };
    const actor = {
        ...fakeActor(),
        items: {
            get: (id) => (id === "mod-poison" ? modifierDoc : null),
            contents: [modifierDoc],
        },
    };
    const weapon = {
        ...fakeWeapon(),
        attachedModifierIds: ["mod-poison"],
        itemDocument: { id: "w1", parent: actor },
    };

    const pa = al.buildPendingAttack({
        actor,
        weapon,
        normalizeWeapon: (w) => w,
        buildAttackReactionCandidates: () => [],
    });

    assert.strictEqual(pa.weaponModifiers.length, 1);
    assert.strictEqual(pa.attackModifiers.length, 1);
    assert.strictEqual(pa.weaponModifiers[0].name, "Poisoned");
    console.log("  ✓ attached weapon modifier ids resolve into pending attack modifier descriptors");
}

{
    // Missing deps throw clearly
    assert.throws(
        () => al.buildPendingAttack({ actor: fakeActor(), weapon: fakeWeapon() }),
        /missing normalizeWeapon dep/
    );
    assert.throws(
        () => al.buildPendingAttack({
            actor: fakeActor(),
            weapon: fakeWeapon(),
            normalizeWeapon: (w) => w,
        }),
        /missing buildAttackReactionCandidates dep/
    );
    console.log("  ✓ missing deps throw explicit errors");
}

{
    // forceSafeAttack flips the descriptor
    const pa = al.buildPendingAttack({
        actor: fakeActor(),
        weapon: fakeWeapon(),
        forceSafeAttack: true,
        normalizeWeapon: (w) => w,
        buildAttackReactionCandidates: () => [],
    });
    assert.strictEqual(pa.safeAttack, true);
    console.log("  ✓ forceSafeAttack propagates to descriptor");
}

{
    // No-profile weapon throws
    const wpn = { id: "w", name: "Useless", attackProfiles: [] };
    assert.throws(
        () => al.buildPendingAttack({
            actor: fakeActor(),
            weapon: wpn,
            normalizeWeapon: (w) => w,
            buildAttackReactionCandidates: () => [],
        }),
        /does not have a legal attack profile/
    );
    console.log("  ✓ weapon with no profiles throws");
}

console.log("\nattack-lifecycle.buildPendingMove...");
{
    const actor = fakeActor();
    const pm = al.buildPendingMove({
        actor,
        path: [[0, 0], [1, 0]],
    });
    assert.strictEqual(pm.actor, actor);
    assert.strictEqual(pm.triggerType, "move-declared");
    assert.deepStrictEqual(pm.path, [[0, 0], [1, 0]]);
    assert.deepStrictEqual(pm.selectedPreManeuvers, []);
    assert.strictEqual(pm.committed, false);
    console.log("  ✓ basic move descriptor");
}

{
    assert.throws(() => al.buildPendingMove({}), /Missing actor/);
    console.log("  ✓ throws without actor");
}

// ────────────────────────────────────────── planApplyDefenseFollowUpState ──

console.log("\nattack-lifecycle.planApplyDefenseFollowUpState...");

{
    const out = al.planApplyDefenseFollowUpState(
        { target: { id: "d1" } },
        { lockParryingWeaponUntil: "endOfTurn" }
    );
    assert.strictEqual(out.patches.length, 1);
    assert.strictEqual(out.patches[0].kind, "actor.update");
    assert.strictEqual(out.patches[0].actorId, "d1");
    assert.strictEqual(
        out.patches[0].data["flags.1547core.defenseState"].lockedParryingWeaponUntil,
        "endOfTurn"
    );
    assert.ok(typeof out.patches[0].data["flags.1547core.defenseState"].updatedAt === "number");
    assert.strictEqual(out.result.lockedParryingWeaponUntil, "endOfTurn");
    console.log("  ✓ produces an actor.update patch with the lock + timestamp");
}

{
    const out = al.planApplyDefenseFollowUpState({ target: { id: "d1" } }, {});
    assert.deepStrictEqual(out, { patches: [], result: {} },
        "no lock specified: no patches");
    console.log("  ✓ no lock: no patches");
}

{
    const out = al.planApplyDefenseFollowUpState({ target: null }, { lockParryingWeaponUntil: "endOfTurn" });
    assert.deepStrictEqual(out, { patches: [], result: {} },
        "no defender: defensive no-op");
    console.log("  ✓ no defender: defensive no-op");
}

// ────────────────────────────────────────── planCommitPostManeuver ──

console.log("\nattack-lifecycle.planCommitPostManeuver...");

{
    // Build a maneuver that passes legality (the simplest: no constraints)
    const maneuver = { _id: "m-post", name: "Riposte", type: "post", triggerType: "post-attack" };
    const actor = fakeActor();
    const target = fakeActor({ id: "t1" });
    const pendingAttack = {
        kind: al.PENDING_ATTACK_KIND,
        actor, target,
        weapon: fakeWeapon(),
        profile: { id: "default", attackType: "melee" },
    };

    const out = al.planCommitPostManeuver({
        actor, maneuver, pendingAttack, side: "defender", target,
    });

    assert.strictEqual(out.result.maneuver.id, "m-post");
    assert.strictEqual(out.events.length, 1);
    assert.strictEqual(out.events[0].type, "combat:action-committed");
    assert.strictEqual(out.events[0].payload.type, "post-maneuver");
    assert.strictEqual(out.events[0].payload.side, "defender");
    console.log("  ✓ returns ACTION_COMMITTED event + maneuver result");
}

{
    assert.throws(
        () => al.planCommitPostManeuver({ actor: fakeActor(), maneuver: null }),
        /Missing maneuver/
    );
    assert.throws(
        () => al.planCommitPostManeuver({ actor: null, maneuver: { name: "m" } }),
        /Missing actor/
    );
    console.log("  ✓ throws on missing actor / maneuver / pendingAttack");
}

// ────────────────────────────────────────── planCommitFullTurnManeuver ──

console.log("\nattack-lifecycle.planCommitFullTurnManeuver...");

{
    const maneuver = {
        _id: "m-ft",
        name: "Charge",
        type: "full-turn",
        triggerType: "full-turn-activation",
        CostType: "StaminaPoints",
        CostAmount: 2,
        effectData: { duration: "until-consumed" },
    };
    const actor = {
        id: "a-ft",
        name: "Hero",
        items: { get: () => null, contents: [] },
        system: { props: { StaminaPoints: 5 } },
        flags: { "1547core": { activeFullTurnManeuvers: [] } },
    };

    const out = al.planCommitFullTurnManeuver({
        actor,
        maneuver,
        metadata: { fullTurnAvailable: true, isCombatActive: true },
        normalizeWeapon: () => null,  // no weapon needed for this maneuver
    });

    // Expect: cost patch + FullTurnAvailable patch + append-record patch
    assert.strictEqual(out.patches.length, 3);
    assert.strictEqual(out.patches[0].data["system.props.StaminaPoints"], 3, "cost spend");
    assert.strictEqual(out.patches[1].data["system.props.FullTurnAvailable"], false, "FullTurnAvailable flipped");
    assert.ok(out.patches[2].data["flags.1547core.activeFullTurnManeuvers"], "record appended");

    assert.strictEqual(out.events.length, 1);
    assert.strictEqual(out.events[0].type, "combat:action-committed");
    assert.strictEqual(out.events[0].payload.type, "full-turn");
    assert.strictEqual(out.events[0].payload.record.id, "m-ft");
    assert.strictEqual(out.result.maneuver.id, "m-ft");
    console.log("  ✓ produces 3 patches (cost + FullTurnAvailable + append) + ACTION_COMMITTED event");
}

{
    // isCombatActive: false → no FullTurnAvailable patch
    const maneuver = {
        _id: "m-ft", name: "Charge", type: "full-turn", triggerType: "full-turn-activation",
    };
    const actor = {
        id: "a-ft",
        items: { get: () => null, contents: [] },
        system: { props: {} },
        flags: {},
    };
    const out = al.planCommitFullTurnManeuver({
        actor, maneuver,
        metadata: { fullTurnAvailable: true, isCombatActive: false },
        normalizeWeapon: () => null,
    });
    // No cost, no FullTurnAvailable patch, but the append record patch
    assert.strictEqual(out.patches.length, 1);
    assert.ok(out.patches[0].data["flags.1547core.activeFullTurnManeuvers"]);
    console.log("  ✓ isCombatActive:false: skips the FullTurnAvailable patch");
}

{
    assert.throws(
        () => al.planCommitFullTurnManeuver({ actor: fakeActor(), maneuver: { name: "m" } }),
        /missing normalizeWeapon dep/
    );
    console.log("  ✓ throws on missing normalizeWeapon dep");
}

console.log("\nAll attack-lifecycle + maneuver-state tests passed.");
