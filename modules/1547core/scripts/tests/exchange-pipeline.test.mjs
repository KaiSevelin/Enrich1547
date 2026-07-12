// The Exchange pipeline (combat/lifecycle-flow.mjs resolveExchangePhased,
// ADR-0004): the single entry point for declare → roll → resolve → card.
// Tested with fake deps per ADR-0003 (a fake run isn't needed for the
// "given"-declare modes, which never touch the runner).
import assert from "node:assert/strict";
import { resolveExchangePhased, buildExchangeResultCard } from "../combat/lifecycle-flow.mjs";

const ATTACK_TOTALS = { damage: 5, protection: 0, crit: 2, fumble: 1, multiplier: 1 };
const DEFENSE_TOTALS = { damage: 0, protection: 2, crit: 1, fumble: 0, multiplier: 1 };

function makeDeps(overrides = {}) {
    const calls = { rolls: [], defense: [], resolve: [], cards: [] };
    const deps = {
        rollToChat: async (spec) => { calls.rolls.push(spec); return { roll: {}, message: {}, totals: { ...ATTACK_TOTALS } }; },
        rollDefenseForActor: async (actor, token, opts) => { calls.defense.push({ actor, token, opts }); return { ...DEFENSE_TOTALS }; },
        resolveOutcome: async (args) => {
            calls.resolve.push(args);
            return {
                attackRoll: args.attackRoll,
                defenseRoll: args.defenseRoll ?? { protection: 0 },
                damageApplied: 3,
                attackerCriticalPoints: args.attackRoll.crit,
                defenderCriticalPoints: args.defenseRoll?.crit ?? 0,
                hitPointUpdate: { currentHitPoints: 7, previousHitPoints: 10 },
            };
        },
        postChat: async (message) => { calls.cards.push(message); },
        ...overrides,
    };
    return { deps, calls };
}

const pendingAttack = {
    actor: { id: "a", name: "Attacker <b>" },
    target: { id: "d", name: "Defender" },
    profile: { dice: ["Heavy"] },
};

console.log("resolveExchangePhased: guards...");
{
    await assert.rejects(() => resolveExchangePhased({ mode: "nope", deps: makeDeps().deps }), /unknown mode/);
    await assert.rejects(() => resolveExchangePhased({ mode: "free-shot", pendingAttack, deps: {} }), /missing rollToChat/);
    const { deps } = makeDeps({ rollDefenseForActor: undefined });
    await assert.rejects(() => resolveExchangePhased({ mode: "free-shot", pendingAttack, deps }), /missing rollDefenseForActor/);
    console.log("  ✓ unknown mode + missing deps throw");
}

console.log("resolveExchangePhased: free-shot (declare pre-done)...");
{
    const { deps, calls } = makeDeps();
    const result = await resolveExchangePhased({
        mode: "free-shot",
        pendingAttack,
        buildAttackRoll: () => ({ formula: "1dh", speaker: { alias: "A" }, flavor: "Reaction Attack" }),
        card: { title: "Reaction Attack" },
        deps,
    }, null);
    assert.equal(calls.rolls.length, 1, "one attack roll");
    assert.equal(calls.defense.length, 1, "defender rolls");
    assert.deepEqual(calls.resolve[0].attackRoll, ATTACK_TOTALS, "crits/fumbles kept in free-shot mode");
    assert.deepEqual(calls.resolve[0].defenseRoll, DEFENSE_TOTALS);
    assert.equal(calls.cards.length, 1, "result card posted");
    assert.ok(calls.cards[0].content.includes("Reaction Attack"));
    assert.ok(calls.cards[0].content.includes("Critical: attacker 2 / defender 1"), "crit line present");
    assert.equal(result.resolved.damageApplied, 3);
    console.log("  ✓ rolls, resolves, cards; crits live");
}

console.log("resolveExchangePhased: interception (safe attack vs obstacle)...");
{
    const { deps, calls } = makeDeps();
    await resolveExchangePhased({
        mode: "interception",
        pendingAttack,
        buildAttackRoll: () => ({ formula: "1dh", speaker: {}, flavor: "Stray shot" }),
        card: { title: "Cover — shot intercepted" },
        deps,
    }, null);
    assert.equal(calls.defense.length, 0, "no defense roll against an obstacle");
    assert.equal(calls.resolve[0].attackRoll.crit, 0, "crits zeroed (safe attack)");
    assert.equal(calls.resolve[0].attackRoll.fumble, 0, "fumbles zeroed (safe attack)");
    assert.deepEqual(calls.resolve[0].defenseRoll, { damage: 0, protection: 0, crit: 0, fumble: 0, multiplier: 1 }, "null defense");
    assert.ok(!calls.cards[0].content.includes("Critical:"), "no crit line on the interception card");
    console.log("  ✓ null defense, zeroed crits, crit-less card");
}

console.log("resolveExchangePhased: abort + extraHtml...");
{
    const { deps, calls } = makeDeps();
    const aborted = await resolveExchangePhased({
        mode: "free-shot",
        pendingAttack,
        buildAttackRoll: () => null, // caller declined (e.g. no weapon dice)
        card: { title: "X" },
        deps,
    }, null);
    assert.equal(aborted.aborted, true);
    assert.equal(calls.resolve.length, 0, "nothing resolved after abort");
    assert.equal(calls.cards.length, 0, "no card after abort");

    const { deps: deps2, calls: calls2 } = makeDeps();
    await resolveExchangePhased({
        mode: "free-shot",
        pendingAttack,
        buildAttackRoll: () => ({ formula: "1dh", speaker: {}, flavor: "f" }),
        card: { title: "T", buildExtraHtml: (resolved) => `<br>extra:${resolved.damageApplied}` },
        deps: deps2,
    }, null);
    assert.ok(calls2.cards[0].content.endsWith("<br>extra:3"), "caller decoration appended");
    console.log("  ✓ quiet abort; buildExtraHtml decoration rides the card");
}

// ───────────────────────── weapon / safe-counter (declare-composing modes) ──
// These modes run declareAttackPhased / executeSafeCounterattackPhased through
// the ADR-0003 runner — tested with a fake run that answers the declare event.

function makeFakeRun(responses = []) {
    const phases = [];
    const queue = [...responses];
    const fakeRun = async (phase) => {
        phases.push(phase);
        if (!phase.event) return {};
        return { response: queue.shift() ?? { cancelled: false, results: [] } };
    };
    fakeRun.phases = phases;
    return fakeRun;
}

function fakeWeapon({ id = "w1" } = {}) {
    return {
        id, _id: id, name: "Sword",
        attackProfiles: [{ id: "default", name: "Default", attackType: "melee", dice: ["Heavy"], allowedAmmoTypes: [] }],
        usesAmmo: false, loadedAmmoId: null, equipped: true,
        itemDocument: { id, update: async () => {} },
    };
}

function fakeActor({ id = "a1", name = "Hero" } = {}) {
    return {
        id, name,
        items: { get: () => null, contents: [] },
        system: { props: { CurrentHitPoints: 10 } },
        flags: { "1547core": { activeFullTurnManeuvers: [] }, "1547Core": {} },
    };
}

console.log("resolveExchangePhased: weapon mode (declare → reaction → rolls)...");
{
    const attacker = fakeActor();
    const defender = fakeActor({ id: "d1", name: "Goblin" });
    // The reaction window settles with a Core Defense that both Faces the
    // attacker and adds 2 defense Multiplier dice.
    const chosenReaction = {
        name: "Core Defense",
        effectData: { addDefenseMultiplierDice: 2, facingFace: true },
    };
    const fakeRun = makeFakeRun([{ cancelled: false, results: [{ value: { reaction: chosenReaction } }] }]);
    const { deps, calls } = makeDeps({
        normalizeWeapon: (w) => w,
        buildAttackReactionCandidates: () => [],
    });
    let declareResultSeen = null;
    const result = await resolveExchangePhased({
        mode: "weapon",
        declare: { actor: attacker, target: defender, weapon: fakeWeapon() },
        targetToken: { id: "tok-d" },
        buildAttackRoll: (declareResult) => {
            declareResultSeen = declareResult;
            return { formula: "1dh", speaker: { alias: "Hero" }, flavor: "Attack" };
        },
        // No card — callers may handle their own result presentation.
        deps,
    }, fakeRun);

    assert.equal(fakeRun.phases[0].event.type, "combat:attack-declared", "declaration ran through the runner");
    assert.equal(declareResultSeen?.reactionResolution?.reaction, chosenReaction, "buildAttackRoll sees the declare result (Face → rear-advantage hook)");
    assert.equal(calls.defense.length, 1, "defender rolled");
    assert.equal(calls.defense[0].opts.addMultiplierDice, 2, "reaction's Multiplier dice fold into the defense roll");
    assert.deepEqual(calls.defense[0].token, { id: "tok-d" }, "defender token forwarded for the speaker");
    assert.equal(calls.resolve[0].defenseReaction, chosenReaction, "chosen reaction rides into resolution");
    assert.equal(calls.cards.length, 0, "no card requested → none posted");
    assert.equal(result.defenseReaction, chosenReaction);
    console.log("  ✓ declare→reaction→rolls; reaction modifiers reach defense + resolution");
}

console.log("resolveExchangePhased: weapon mode cancelled by a reaction...");
{
    const fakeRun = makeFakeRun([{ cancelled: true, reason: "reaction-triggered" }]);
    const { deps, calls } = makeDeps({ normalizeWeapon: (w) => w, buildAttackReactionCandidates: () => [] });
    const result = await resolveExchangePhased({
        mode: "weapon",
        declare: { actor: fakeActor(), target: fakeActor({ id: "d1" }), weapon: fakeWeapon() },
        buildAttackRoll: () => { throw new Error("must not roll after a cancel"); },
        card: { title: "Attack Result" },
        deps,
    }, fakeRun);
    assert.equal(result.cancelled, true);
    assert.equal(calls.rolls.length, 0, "no attack roll");
    assert.equal(calls.resolve.length, 0, "no resolution");
    assert.equal(calls.cards.length, 0, "no card");
    console.log("  ✓ cancelled declaration short-circuits the whole exchange");
}

console.log("resolveExchangePhased: safe-counter mode (roles swap)...");
{
    const originalAttacker = fakeActor({ id: "a1", name: "Attacker" });
    const originalDefender = fakeActor({ id: "d1", name: "Defender" });
    const originalPending = {
        actor: originalAttacker,
        target: originalDefender,
        metadata: {},
    };
    const counterWeapon = fakeWeapon({ id: "cw" });
    const fakeRun = makeFakeRun([{ cancelled: false, results: [] }]); // the counter's own declaration
    const { deps, calls } = makeDeps({
        normalizeWeapon: (w) => w,
        buildAttackReactionCandidates: () => [],
        getActorReactionWeapon: () => counterWeapon,
    });
    const result = await resolveExchangePhased({
        mode: "safe-counter",
        declare: {
            pendingAttack: originalPending,
            defenseReaction: { name: "Riposte", effectData: { createFreeSafeCounterattack: true } },
        },
        buildAttackRoll: (counter) => ({
            formula: "1dh",
            speaker: {},
            flavor: `counter by ${counter.pendingAttack.actor.name}`,
        }),
        card: { title: "Safe Counterattack Result" },
        deps,
    }, fakeRun);

    assert.equal(result.pendingAttack.actor.id, "d1", "the original DEFENDER attacks back");
    assert.equal(result.pendingAttack.target.id, "a1", "…against the original attacker");
    assert.equal(calls.resolve[0].defenseReaction, null, "the counter itself carries no defense reaction");
    assert.ok(calls.cards[0].content.includes("Safe Counterattack Result"));
    assert.ok(calls.cards[0].content.includes("Defender -> Attacker"), "card names the swapped roles");
    console.log("  ✓ counter declares with swapped roles and cards under its own title");
}

console.log("resolveExchangePhased: safe-counter without the grant is cancelled...");
{
    // A defense reaction that does NOT grant a counterattack: the phased
    // declare throws ("No safe counterattack is available") — the pipeline
    // surfaces that as an error to the caller, same as before the refactor.
    const fakeRun = makeFakeRun();
    const { deps } = makeDeps({
        normalizeWeapon: (w) => w,
        buildAttackReactionCandidates: () => [],
        getActorReactionWeapon: () => fakeWeapon(),
    });
    await assert.rejects(() => resolveExchangePhased({
        mode: "safe-counter",
        declare: {
            pendingAttack: { actor: fakeActor(), target: fakeActor({ id: "d1" }), metadata: {} },
            defenseReaction: { name: "Evade", effectData: {} },
        },
        buildAttackRoll: () => ({ formula: "1dh", speaker: {}, flavor: "f" }),
        deps,
    }, fakeRun), /No safe counterattack is available/);
    console.log("  ✓ ungranted counterattack rejects loudly");
}

console.log("buildExchangeResultCard...");
{
    const card = buildExchangeResultCard({
        title: "Attack Result",
        attackerName: "A <img>",
        defenderName: "D",
        resolved: {
            attackRoll: { damage: 4 },
            defenseRoll: { protection: 1 },
            damageApplied: 3,
            attackerCriticalPoints: 2,
            defenderCriticalPoints: 0,
            hitPointUpdate: { currentHitPoints: 7, previousHitPoints: 10 },
        },
        showCrits: true,
        extraHtml: "<br>riders",
    });
    assert.ok(card.includes("A &lt;img&gt;"), "names are escaped");
    assert.ok(card.includes("Damage: 4") && card.includes("Protection: 1") && card.includes("Applied: 3"));
    assert.ok(card.includes("HP: 7 / was 10"));
    assert.ok(card.endsWith("<br>riders"));
    const noCrit = buildExchangeResultCard({ title: "T", resolved: {}, showCrits: false });
    assert.ok(!noCrit.includes("Critical:"));
    console.log("  ✓ escaping, HP line, crit toggle, extraHtml");
}

console.log("\nAll exchange-pipeline tests passed.");
