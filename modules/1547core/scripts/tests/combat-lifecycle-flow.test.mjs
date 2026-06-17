import assert from "assert";

/**
 * Tests for combat/lifecycle-flow.mjs.
 *
 * Each phased function is async and takes `(opts, run)`. The runner
 * is injected, so we test by passing a `fakeRun` that records every
 * `{phase, patches, event}` it sees and returns canned responses.
 * No Foundry required.
 *
 * What's covered:
 *   - declareAttackPhased: happy path, with/without target, cancelled
 *   - declareMovementPhased: zero / multiple threat events
 *   - executeResolvedReactionPhased: short-circuits when effect carries
 *     neither createFreeSafeAttack nor createFreeSafeCounterattack
 *   - executeSafeCounterattackPhased: throws when defender lacks
 *     reaction weapon
 *   - resolveAttackOutcomePhased: damage happy path (HP patch, two
 *     post-windows, ammo consume, ACTION_COMMITTED)
 */

const {
    declareAttackPhased,
    declareMovementPhased,
    executeResolvedReactionPhased,
    executeSafeCounterattackPhased,
    resolveAttackOutcomePhased,
} = await import("../combat/lifecycle-flow.mjs");

// ─────────────────────────────────────────────────── fakeRun ──

function makeFakeRun(responses = []) {
    const phases = [];
    const responseQueue = [...responses];
    const fakeRun = async (phase) => {
        phases.push(phase);
        if (phase.event === undefined || phase.event === null) return {};
        const next = responseQueue.shift() ?? { cancelled: false };
        return { response: next };
    };
    fakeRun.phases = phases;
    return fakeRun;
}

function fakeWeapon({ id = "w1", name = "Sword", attackType = "melee" } = {}) {
    return {
        id, _id: id, name,
        attackProfiles: [{ id: "default", name: "Default", attackType, dice: ["Heavy"], allowedAmmoTypes: [] }],
        activeAttackProfileKey: "Attack",
        usesAmmo: false,
        loadedAmmoId: null,
        ammoType: "", ammoCapacity: 0, ammoLoaded: 0,
        equipped: true,
        itemDocument: { id, update: async () => {} },
    };
}

function fakeActor({ id = "a1", name = "Hero", hp = 10, flags = {} } = {}) {
    return {
        id, name,
        items: { get: () => null, contents: [] },
        system: { props: { CurrentHitPoints: hp } },
        flags: { "1547core": { activeFullTurnManeuvers: [], ...flags }, "1547Core": {} },
    };
}

// ─────────────────────────────────────────────────── declareAttackPhased ──

console.log("declareAttackPhased...");

{
    const actor = fakeActor();
    const weapon = fakeWeapon();
    const target = fakeActor({ id: "t1", name: "Goblin" });
    const fakeRun = makeFakeRun([{ cancelled: false, results: [] }]);

    const result = await declareAttackPhased({
        actor, target, weapon,
        normalizeWeapon: (w) => w,
        buildAttackReactionCandidates: () => [],
    }, fakeRun);

    // Phase 1: declare → patches include overwatch-consume attempt (no overwatch → []), event = ATTACK_DECLARED
    assert.strictEqual(fakeRun.phases[0].phase, "declare");
    assert.strictEqual(fakeRun.phases[0].event.type, "combat:attack-declared");
    // Phase 2: consumeAmmo → patches (empty since usesAmmo:false)
    assert.strictEqual(fakeRun.phases[1].phase, "consumeAmmo");
    assert.deepStrictEqual(fakeRun.phases[1].patches, []);
    assert.strictEqual(fakeRun.phases[1].event ?? null, null);
    assert.strictEqual(result.pendingAttack.committed, true);
    assert.strictEqual(result.cancelled, false);
    console.log("  ✓ happy path: declare + consumeAmmo phases; committed flips true");
}

{
    // No target → no overwatch-consume patch attempt
    const actor = fakeActor();
    const weapon = fakeWeapon();
    const fakeRun = makeFakeRun([{ cancelled: false, results: [] }]);
    const result = await declareAttackPhased({
        actor, weapon,
        normalizeWeapon: (w) => w,
        buildAttackReactionCandidates: () => [],
    }, fakeRun);
    assert.deepStrictEqual(fakeRun.phases[0].patches, [], "no target → empty declare patches");
    assert.strictEqual(result.pendingAttack.target, null);
    console.log("  ✓ no target: declare phase has empty patches");
}

{
    // Cancelled event without "reaction-triggered" reason: ammo NOT consumed
    const actor = fakeActor();
    const weapon = fakeWeapon();
    const fakeRun = makeFakeRun([{ cancelled: true, reason: "user-cancelled" }]);
    const result = await declareAttackPhased({
        actor, weapon,
        normalizeWeapon: (w) => w,
        buildAttackReactionCandidates: () => [],
    }, fakeRun);
    assert.strictEqual(fakeRun.phases.length, 1, "no consumeAmmo phase when cancelled");
    assert.strictEqual(result.pendingAttack.committed, false);
    assert.strictEqual(result.cancelled, true);
    console.log("  ✓ cancelled without reaction: ammo not consumed, committed stays false");
}

{
    // Cancelled with "reaction-triggered": ammo IS consumed
    const actor = fakeActor();
    const weapon = fakeWeapon();
    const fakeRun = makeFakeRun([{ cancelled: true, reason: "reaction-triggered" }]);
    const result = await declareAttackPhased({
        actor, weapon,
        normalizeWeapon: (w) => w,
        buildAttackReactionCandidates: () => [],
    }, fakeRun);
    assert.strictEqual(fakeRun.phases.length, 2, "consumeAmmo phase still runs for reaction-triggered cancel");
    assert.strictEqual(result.pendingAttack.committed, true);
    console.log("  ✓ cancelled with reaction-triggered: ammo still consumed");
}

// ─────────────────────────────────────────────────── declareMovementPhased ──

console.log("\ndeclareMovementPhased...");

{
    const actor = fakeActor();
    const fakeRun = makeFakeRun([{ cancelled: false }]);
    const result = await declareMovementPhased({
        actor, path: [[0, 0], [1, 0]],
        threatEvents: [],
        buildThreatReactionCandidates: () => [],
    }, fakeRun);
    assert.strictEqual(fakeRun.phases.length, 1);
    assert.strictEqual(fakeRun.phases[0].phase, "movementStarted");
    assert.deepStrictEqual(result.reactionResolutions, []);
    console.log("  ✓ zero threat events: only movementStarted phase");
}

{
    const actor = fakeActor();
    // Movement event + 2 threat events. The 2nd threat event has a reaction.
    const fakeRun = makeFakeRun([
        { cancelled: false },
        { cancelled: false, results: [] },                                    // threat 0 — no resolution
        { cancelled: false, results: [{ value: { reaction: { name: "Parry" } } }] }, // threat 1 — resolution
    ]);
    const result = await declareMovementPhased({
        actor,
        threatEvents: [{ mover: actor }, { mover: actor }],
        buildThreatReactionCandidates: () => [],
    }, fakeRun);
    assert.strictEqual(fakeRun.phases.length, 3, "1 movement + 2 threat phases");
    assert.strictEqual(fakeRun.phases[1].phase, "threatZone[0]");
    assert.strictEqual(fakeRun.phases[2].phase, "threatZone[1]");
    assert.strictEqual(result.reactionResolutions.length, 1);
    console.log("  ✓ multiple threat events: collects only resolutions that exist");
}

{
    assert.rejects(
        () => declareMovementPhased({ actor: fakeActor() }, makeFakeRun()),
        /missing buildThreatReactionCandidates dep/
    );
    console.log("  ✓ throws when buildThreatReactionCandidates dep is missing");
}

// ─────────────────────────────────────── executeResolvedReactionPhased ──

console.log("\nexecuteResolvedReactionPhased...");

{
    // Resolution with neither free-attack flag → short-circuit, no phases
    const fakeRun = makeFakeRun();
    const result = await executeResolvedReactionPhased(
        { reaction: { effectData: {} } },
        fakeRun,
        {}
    );
    assert.strictEqual(result, null);
    assert.strictEqual(fakeRun.phases.length, 0);
    console.log("  ✓ short-circuits when reaction effect has neither free-attack flag");
}

{
    // Resolution missing actor/target/weapon → also null
    const fakeRun = makeFakeRun();
    const result = await executeResolvedReactionPhased(
        { reaction: { effectData: { createFreeSafeAttack: true } } },
        fakeRun,
        {}
    );
    assert.strictEqual(result, null);
    console.log("  ✓ returns null when actor/target/weapon/profile incomplete");
}

// ─────────────────────────────────────── executeSafeCounterattackPhased ──

console.log("\nexecuteSafeCounterattackPhased...");

{
    assert.rejects(
        () => executeSafeCounterattackPhased({ pendingAttack: null }, makeFakeRun()),
        /missing getActorReactionWeapon dep/
    );
    console.log("  ✓ throws when getActorReactionWeapon dep is missing");
}

{
    assert.rejects(
        () => executeSafeCounterattackPhased({
            pendingAttack: { target: null, actor: fakeActor() },
            getActorReactionWeapon: () => null,
        }, makeFakeRun()),
        /missing a defender or attacker/
    );
    console.log("  ✓ throws when pendingAttack lacks defender or attacker");
}

{
    assert.rejects(
        () => executeSafeCounterattackPhased({
            pendingAttack: { target: fakeActor({ id: "d" }), actor: fakeActor({ id: "a" }), metadata: {} },
            defenseReaction: null,
            currentDamageTakenReaction: null,
            getActorReactionWeapon: () => null,
        }, makeFakeRun()),
        /No safe counterattack is available/
    );
    console.log("  ✓ throws when no defense modifier grants safeCounterattack");
}

// ─────────────────────────────────────── resolveAttackOutcomePhased ──

console.log("\nresolveAttackOutcomePhased...");

{
    // Build a pending attack with the marker kind so isPendingAttack passes
    const attacker = fakeActor({ id: "a", name: "Attacker" });
    const defender = fakeActor({ id: "d", name: "Defender", hp: 10 });
    const weapon = fakeWeapon();
    const pendingAttack = {
        kind: "1547core.pendingAttack",
        actor: attacker,
        target: defender,
        weapon,
        profile: { id: "default", attackType: "melee", allowedAmmoTypes: [] },
        loadedAmmo: null,
        committed: false,
        mergedModifiers: {},
        metadata: {},
    };

    const fakeRun = makeFakeRun([
        { cancelled: false, results: [] },  // damageApplied
        // No postManeuverWindow phases: the test fake actor has no
        // maneuver items, so getLegalManeuvers returns []. Post-windows
        // with zero options are now filtered out (suppresses the
        // dead-end "no legal post maneuvers" UI prompt).
        { cancelled: false, results: [] },  // actionCommitted
    ]);

    const result = await resolveAttackOutcomePhased({
        pendingAttack,
        attackRoll: { damage: 5, protection: 0, crit: 0, fumble: 0, multiplier: 1 },
        defenseRoll: { damage: 0, protection: 2, crit: 0, fumble: 0, multiplier: 1 },
        buildDefaultDefenseRollSummary: () => ({ damage: 0, protection: 0, crit: 0, fumble: 0, multiplier: 1 }),
    }, fakeRun);

    // Damage = max(0, 5 - 2 - 0) = 3 → HP patch phase runs first
    const phaseNames = fakeRun.phases.map((p) => p.phase);
    assert.deepStrictEqual(
        phaseNames,
        ["applyDamage", "damageApplied", "consumeAmmo", "actionCommitted"]
    );
    assert.strictEqual(result.damageApplied, 3);
    assert.strictEqual(result.hitPointUpdate.previousHitPoints, 10);
    assert.strictEqual(result.hitPointUpdate.currentHitPoints, 7);
    assert.strictEqual(result.pendingPostManeuverWindows.length, 0,
        "no post-windows when neither side has any legal post maneuvers");
    assert.strictEqual(result.pendingAttack.committed, true);
    console.log("  ✓ happy path: applyDamage → damageApplied → consumeAmmo → actionCommitted (empty post-windows filtered)");
}

{
    // Crits are PER-TOKEN: the attacker keeps its attack crits, the defender its
    // defense crits; they are not pooled. The sum is exposed only for the card.
    const attacker = fakeActor({ id: "a", name: "Attacker" });
    const defender = fakeActor({ id: "d", name: "Defender", hp: 10 });
    const pendingAttack = {
        kind: "1547core.pendingAttack",
        actor: attacker, target: defender,
        weapon: fakeWeapon(),
        profile: { id: "default", attackType: "melee", allowedAmmoTypes: [] },
        loadedAmmo: null, committed: false, mergedModifiers: {}, metadata: {},
    };
    const fakeRun = makeFakeRun([
        { cancelled: false, results: [] },  // damageApplied
        { cancelled: false, results: [] },  // actionCommitted
    ]);
    const result = await resolveAttackOutcomePhased({
        pendingAttack,
        attackRoll: { damage: 5, protection: 0, crit: 2, fumble: 0, multiplier: 1 },
        defenseRoll: { damage: 0, protection: 2, crit: 1, fumble: 0, multiplier: 1 },
        buildDefaultDefenseRollSummary: () => null,
    }, fakeRun);

    assert.strictEqual(result.attackerCriticalPoints, 2, "attacker keeps its 2 attack crits");
    assert.strictEqual(result.defenderCriticalPoints, 1, "defender keeps its 1 defense crit");
    assert.strictEqual(result.currentCriticalPoints, 3, "sum (3) is exposed only for the result card");
    console.log("  ✓ per-token crits: attacker 2 / defender 1, not pooled");
}

{
    // Zero damage: no applyDamage phase
    const attacker = fakeActor({ id: "a" });
    const defender = fakeActor({ id: "d", hp: 10 });
    const pendingAttack = {
        kind: "1547core.pendingAttack",
        actor: attacker, target: defender,
        weapon: fakeWeapon(),
        profile: { id: "default", attackType: "melee", allowedAmmoTypes: [] },
        committed: true,  // already committed → skip consumeAmmo too
        mergedModifiers: {}, metadata: {},
    };

    const fakeRun = makeFakeRun([
        { cancelled: false, results: [] },  // damageApplied
        { cancelled: false, results: [] },  // actionCommitted
        // (no post-window phases — empty post options are filtered)
    ]);

    const result = await resolveAttackOutcomePhased({
        pendingAttack,
        attackRoll: { damage: 0, protection: 0, crit: 0, fumble: 0, multiplier: 1 },
        defenseRoll: { damage: 0, protection: 0, crit: 0, fumble: 0, multiplier: 1 },
        buildDefaultDefenseRollSummary: () => null,
    }, fakeRun);

    const phaseNames = fakeRun.phases.map((p) => p.phase);
    assert.deepStrictEqual(
        phaseNames,
        ["damageApplied", "actionCommitted"],
        "no damage AND already committed → no applyDamage and no consumeAmmo; empty post-windows skipped"
    );
    assert.strictEqual(result.damageApplied, 0);
    console.log("  ✓ zero damage + already committed: skips applyDamage AND consumeAmmo (and empty post-windows)");
}

{
    const poisonModifier = {
        _id: "mod-poison",
        name: "Poisoned",
        attachedToItemId: "w1",
        durationType: "Uses",
        durationValue: 1,
        onHitEffects: [{
            triggerMode: "onDamageApplied",
            armorInteraction: "onlyIfBaseDamagePassed",
            resolution: "contest",
            sourceCheck: "source Dexterity",
            targetCheck: "target Stamina",
            damageType: "Poison",
            damageAmount: 1,
            applyStatus: "Weakened",
        }],
    };
    const attacker = {
        ...fakeActor({ id: "a", name: "Attacker" }),
        system: { props: { Stats_DexterityDice: 3, Stats_DexterityMod: 0 } },
        items: {
            get: (id) => {
                if (id !== "w1") return null;
                return {
                    id: "w1",
                    flags: { "1547Core": { attachedModifierIds: ["mod-poison"] } },
                    system: { props: {} },
                };
            },
            contents: [],
        },
    };
    const defender = {
        ...fakeActor({ id: "d", name: "Defender", hp: 10 }),
        system: { props: { CurrentHitPoints: 10, Stats_StaminaDice: 2, Stats_StaminaMod: 0 } },
    };
    const pendingAttack = {
        kind: "1547core.pendingAttack",
        actor: attacker,
        target: defender,
        weapon: fakeWeapon(),
        profile: { id: "default", attackType: "melee", allowedAmmoTypes: [] },
        loadedAmmo: null,
        committed: true,
        mergedModifiers: {},
        metadata: {},
        weaponModifiers: [poisonModifier],
        ammoModifiers: [],
        attackModifiers: [poisonModifier],
    };

    const fakeRun = makeFakeRun([
        { cancelled: false, results: [] },
        { cancelled: false, results: [] },
    ]);

    const result = await resolveAttackOutcomePhased({
        pendingAttack,
        attackRoll: { damage: 5, protection: 0, crit: 0, fumble: 0, multiplier: 1 },
        defenseRoll: { damage: 0, protection: 2, crit: 0, fumble: 0, multiplier: 1 },
        buildDefaultDefenseRollSummary: () => null,
    }, fakeRun);

    const phaseNames = fakeRun.phases.map((p) => p.phase);
    assert.deepStrictEqual(
        phaseNames,
        ["applyDamage", "applySecondaryEffects", "damageApplied", "actionCommitted"]
    );
    assert.strictEqual(result.baseDamageApplied, 3);
    assert.strictEqual(result.secondaryDamageApplied, 1);
    assert.strictEqual(result.damageApplied, 4);
    assert.strictEqual(result.hitPointUpdate.currentHitPoints, 6);
    assert.strictEqual(result.secondaryEffects.length, 1);
    assert.strictEqual(
        fakeRun.phases[1].patches.some((patch) => patch.kind === "item.update" && patch.itemId === "w1"),
        true,
        "one-use poison detaches after firing"
    );
    console.log("  ✓ poison rider applies after blood-drawing hit and detaches one-use modifier");
}

{
    // Multi-use modifier: each fire decrements `usesRemaining` and the
    // attachment is preserved until the last charge is spent.
    const threeUsePoison = {
        _id: "mod-poison-3",
        name: "Poisoned (3 uses)",
        attachedToItemId: "w1",
        durationType: "Uses",
        durationValue: 3,
        onHitEffects: [{
            triggerMode: "onDamageApplied",
            armorInteraction: "onlyIfBaseDamagePassed",
            resolution: "automatic",
            damageType: "Poison",
            damageAmount: 1,
        }],
    };
    const attacker = {
        ...fakeActor({ id: "a", name: "Attacker" }),
        items: {
            get: (id) => id === "w1" ? { id: "w1", flags: { "1547Core": { attachedModifierIds: ["mod-poison-3"] } }, system: { props: {} } } : null,
            contents: [],
        },
    };
    const defender = { ...fakeActor({ id: "d", name: "Defender", hp: 10 }), system: { props: { CurrentHitPoints: 10 } } };
    const pendingAttack = {
        kind: "1547core.pendingAttack",
        actor: attacker, target: defender,
        weapon: fakeWeapon(),
        profile: { id: "default", attackType: "melee", allowedAmmoTypes: [] },
        loadedAmmo: null, committed: true, mergedModifiers: {}, metadata: {},
        weaponModifiers: [threeUsePoison], ammoModifiers: [], attackModifiers: [threeUsePoison],
    };
    const fakeRun = makeFakeRun([
        { cancelled: false, results: [] },
        { cancelled: false, results: [] },
    ]);
    await resolveAttackOutcomePhased({
        pendingAttack,
        attackRoll: { damage: 5, protection: 0, crit: 0, fumble: 0, multiplier: 1 },
        defenseRoll: { damage: 0, protection: 2, crit: 0, fumble: 0, multiplier: 1 },
        buildDefaultDefenseRollSummary: () => null,
    }, fakeRun);

    const secondaryPhase = fakeRun.phases.find((p) => p.phase === "applySecondaryEffects");
    assert.ok(secondaryPhase, "the rider fires and a secondary-effects phase is scheduled");
    const consumePatches = secondaryPhase.patches.filter((p) => p.itemId === "mod-poison-3");
    assert.deepStrictEqual(
        consumePatches.map((p) => ({ kind: p.kind, data: p.data })),
        [{
            kind: "item.update",
            data: {
                "flags.1547Core.usesRemaining": 2,
                "system.props.UsesRemaining": 2,
            },
        }],
        "decrements both the legacy flag and the CSB UsesRemaining prop without detaching or deleting"
    );
    assert.ok(
        !secondaryPhase.patches.some((p) => p.kind === "item.delete"),
        "multi-use modifier is not deleted while charges remain"
    );
    console.log("  ✓ multi-use modifier: decrements usesRemaining, no detach/delete");
}

// ─────────────────────────────────────── resolveAttackOutcomePhased: save riders ──

console.log("\nresolveAttackOutcomePhased (save riders)...");

async function runSaveRider({ effect, attackerProps = {}, defenderProps = {} }) {
    const modifier = {
        _id: "mod-save",
        name: "Save Rider",
        attachedToItemId: "w1",
        durationType: "Permanent",
        durationValue: 0,
        onHitEffects: [effect],
    };
    const attacker = {
        ...fakeActor({ id: "a", name: "Attacker" }),
        system: { props: attackerProps },
        items: { get: () => null, contents: [] },
    };
    const defender = {
        ...fakeActor({ id: "d", name: "Defender", hp: 10 }),
        system: { props: { CurrentHitPoints: 10, ...defenderProps } },
    };
    const pendingAttack = {
        kind: "1547core.pendingAttack",
        actor: attacker,
        target: defender,
        weapon: fakeWeapon(),
        profile: { id: "default", attackType: "melee", allowedAmmoTypes: [] },
        loadedAmmo: null,
        committed: true,
        mergedModifiers: {},
        metadata: {},
        weaponModifiers: [modifier],
        ammoModifiers: [],
        attackModifiers: [modifier],
    };
    const fakeRun = makeFakeRun([
        { cancelled: false, results: [] },
        { cancelled: false, results: [] },
    ]);
    const result = await resolveAttackOutcomePhased({
        pendingAttack,
        attackRoll: { damage: 5, protection: 0, crit: 0, fumble: 0, multiplier: 1 },
        defenseRoll: { damage: 0, protection: 2, crit: 0, fumble: 0, multiplier: 1 },
        buildDefaultDefenseRollSummary: () => null,
    }, fakeRun);
    return { result, phaseNames: fakeRun.phases.map((p) => p.phase) };
}

const SAVE_RIDER_BASE = {
    triggerMode: "onDamageApplied",
    armorInteraction: "onlyIfBaseDamagePassed",
    resolution: "save",
    targetCheck: "target Power",
    damageType: "Corruption",
    damageAmount: 1,
    applyStatus: "Weakened",
};

{
    // No attacker stat → difficulty field (5) vs defender Power (2): rider lands.
    const { result, phaseNames } = await runSaveRider({
        effect: { ...SAVE_RIDER_BASE, sourceCheck: "", difficulty: 5 },
        defenderProps: { Stats_PowerDice: 2, Stats_PowerMod: 0 },
    });
    assert.strictEqual(result.secondaryDamageApplied, 1);
    assert.ok(phaseNames.includes("applySecondaryEffects"), "save fires when difficulty beats defender");
    console.log("  ✓ save with difficulty field (5) beats defender Power (2) → rider lands");
}

{
    // No attacker stat → difficulty from sourceCheck "1d6" (1) vs defender Power (3): resisted.
    const { result, phaseNames } = await runSaveRider({
        effect: { ...SAVE_RIDER_BASE, sourceCheck: "1d6" },
        defenderProps: { Stats_PowerDice: 3, Stats_PowerMod: 0 },
    });
    assert.strictEqual(result.secondaryDamageApplied, 0);
    assert.ok(!phaseNames.includes("applySecondaryEffects"), "save resisted when defender exceeds difficulty");
    console.log("  ✓ save with sourceCheck difficulty (1d6) below defender Power (3) → resisted");
}

{
    // Attacker stat present: source Faith (4) vs defender Power (2): rider lands.
    const { result } = await runSaveRider({
        effect: { ...SAVE_RIDER_BASE, sourceCheck: "source Faith" },
        attackerProps: { Stats_FaithDice: 4, Stats_FaithMod: 0 },
        defenderProps: { Stats_PowerDice: 2, Stats_PowerMod: 0 },
    });
    assert.strictEqual(result.secondaryDamageApplied, 1);
    console.log("  ✓ save with attacker stat (Faith 4) beats defender Power (2) → rider lands");
}

{
    assert.rejects(
        () => resolveAttackOutcomePhased({ pendingAttack: null }, makeFakeRun()),
        /Missing pending attack/
    );
    console.log("  ✓ throws on missing pendingAttack");
}

{
    assert.rejects(
        () => resolveAttackOutcomePhased({
            pendingAttack: { kind: "wrong" },
        }, makeFakeRun()),
        /must be created through buildPendingAttack/
    );
    console.log("  ✓ throws on pendingAttack without PENDING_ATTACK_KIND marker");
}

console.log("\nAll combat/lifecycle-flow.mjs tests passed.");
