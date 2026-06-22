import assert from "assert";
import { evaluateManeuverLegality, getLegalManeuvers } from "../combat/maneuver-legality.mjs";

// Plain-object maneuvers: normalizeManeuver lowercases `type`/`triggerType` and
// reads CostType/CostAmount/requirements/effectData straight off the object when
// it carries no Foundry source flag. A bare post-attack maneuver passes every
// gate, so each section can vary one dimension in isolation.
const man = (o = {}) => ({ name: "Test", type: "post", triggerType: "post-attack", ...o });
const legal = (m, ctx) => evaluateManeuverLegality(m, ctx).legal;
const reasonsOf = (m, ctx) => evaluateManeuverLegality(m, ctx).reasons;
const hasReason = (m, ctx, frag) => reasonsOf(m, ctx).some((r) => r.includes(frag));

/* ── Preparations: timing windows ─────────────────────────────────────── */
console.log("maneuver-legality: timing / preparations...");
{
    // A "pre" (preparation) maneuver is legal in a pre window, not a post one.
    assert.strictEqual(legal(man({ type: "pre" }), { timingType: "pre" }), true);
    assert.strictEqual(legal(man({ type: "pre" }), { timingType: "post" }), false);
    assert.ok(hasReason(man({ type: "pre" }), { timingType: "post" }, "Timing mismatch"));

    // WINDOW_TO_TIMING: the move/attack declaration windows both map to "pre".
    assert.strictEqual(legal(man({ type: "pre" }), { timingType: "move" }), true);
    assert.strictEqual(legal(man({ type: "pre" }), { timingType: "attack" }), true);
    assert.strictEqual(legal(man({ type: "reaction" }), { timingType: "reaction" }), true);

    // No timing context → timing is not checked at all.
    assert.strictEqual(legal(man({ type: "pre" }), {}), true);

    // Full-turn maneuvers are gated by the full-turn budget.
    const ft = man({ type: "full-turn", triggerType: "full-turn-activation" });
    assert.strictEqual(legal(ft, { timingType: "full-turn", fullTurnAvailable: true }), true);
    assert.strictEqual(legal(ft, { timingType: "full-turn", fullTurnAvailable: false }), false);
    assert.ok(hasReason(ft, { timingType: "full-turn", fullTurnAvailable: false }, "Action economy"));
    console.log("  ✓ pre/post/reaction timing, move/attack→pre mapping, full-turn budget gate");
}

/* ── Reactions: trigger matching + usage limit ────────────────────────── */
console.log("\nmaneuver-legality: reaction triggers...");
{
    const react = (o = {}) => man({ type: "reaction", triggerType: "attack-declared", ...o });
    const rctx = (trigger) => ({ timingType: "reaction", triggerType: trigger });

    // Exact trigger match vs mismatch.
    assert.strictEqual(legal(react(), rctx("attack-declared")), true);
    assert.strictEqual(legal(react(), rctx("move-declared")), false);
    assert.ok(hasReason(react(), rctx("move-declared"), "Trigger mismatch"));

    // alternateTriggers widen the accepted set — via requirements OR effectData.
    assert.strictEqual(
        legal(react({ requirements: { alternateTriggers: ["move-declared"] } }), rctx("move-declared")),
        true, "alternateTriggers on requirements");
    assert.strictEqual(
        legal(react({ effectData: { alternateTriggers: ["threat-zone"] } }), rctx("threat-zone")),
        true, "alternateTriggers on effectData");

    // No trigger in context → trigger is not checked.
    assert.strictEqual(legal(react(), { timingType: "reaction" }), true);

    // Usage limit: a maneuver already used this activation is blocked (by id or name).
    const parry = react({ _id: "p1", name: "Parry" });
    assert.strictEqual(legal(parry, { ...rctx("attack-declared"), usedManeuvers: ["p1"] }), false);
    assert.strictEqual(legal(parry, { ...rctx("attack-declared"), usedManeuvers: [{ name: "Parry" }] }), false);
    assert.ok(hasReason(parry, { ...rctx("attack-declared"), usedManeuvers: ["p1"] }, "Usage limit"));
    assert.strictEqual(legal(parry, { ...rctx("attack-declared"), usedManeuvers: ["other"] }), true);
    console.log("  ✓ exact trigger, alternateTriggers (reqs + effectData), no-context passthrough, usage limit");
}

/* ── Criticals: critical-point cost gate ──────────────────────────────── */
console.log("\nmaneuver-legality: critical-point cost...");
{
    const critM = (cost) => man({ CostType: "CriticalPoints", CostAmount: cost });

    // Affordable only when the actor's own crit count meets the cost.
    assert.strictEqual(legal(critM(2), { currentCriticalPoints: 2 }), true, "2 ≥ 2");
    assert.strictEqual(legal(critM(2), { currentCriticalPoints: 3 }), true, "3 ≥ 2");
    assert.strictEqual(legal(critM(2), { currentCriticalPoints: 1 }), false, "1 < 2");
    assert.strictEqual(legal(critM(2), { currentCriticalPoints: 0 }), false, "0 < 2");
    assert.strictEqual(legal(critM(2), {}), false, "no crits available → cannot afford");
    assert.ok(hasReason(critM(2), { currentCriticalPoints: 0 }, "Required resources"));

    // Zero / absent cost never gates on crits.
    assert.strictEqual(legal(critM(0), {}), true, "zero cost is free");
    assert.strictEqual(legal(man(), {}), true, "no CostType at all is free");

    // A non-crit cost type with no actor present is not crit-gated (passes).
    assert.strictEqual(
        legal(man({ CostType: "StrengthPoints", CostAmount: 5 }), { currentCriticalPoints: 0 }),
        true, "Strength cost ignores crit pool when no actor to check");
    console.log("  ✓ per-token affordability, zero/no cost free, non-crit cost not crit-gated");
}

/* ── Combat: range bands, action economy, getLegalManeuvers ───────────── */
console.log("\nmaneuver-legality: range + action economy + filtering...");
{
    const weapon = { shortRange: 3, longRange: 6, maxRange: 9 };
    const atDist = (distanceSquares, extra = {}) => ({
        timingType: "post", triggerType: "post-attack",
        profile: { attackType: "ranged" }, weapon, distanceSquares, ...extra,
    });

    // Short and long bands pass; the max band needs useMaxRange; beyond is out.
    assert.strictEqual(legal(man(), atDist(2)), true, "short band");
    assert.strictEqual(legal(man(), atDist(5)), true, "long band");
    assert.strictEqual(legal(man(), atDist(8)), false, "max band without useMaxRange");
    assert.strictEqual(legal(man({ effectData: { useMaxRange: true } }), atDist(8)), true, "max band with useMaxRange");
    assert.strictEqual(legal(man(), atDist(12)), false, "out of range");
    assert.ok(hasReason(man(), atDist(12), "Current range"));

    // Melee (non-distance) profiles skip the range gate entirely.
    assert.strictEqual(
        legal(man(), { timingType: "post", triggerType: "post-attack", profile: { attackType: "melee" }, weapon, distanceSquares: 99 }),
        true, "melee ignores range");

    // Action economy: a move/attack reaction is blocked when the budget is spent.
    const moveReact = man({ type: "reaction", triggerType: "move-declared" });
    assert.strictEqual(legal(moveReact, { timingType: "reaction", triggerType: "move-declared", movementBudgetRemaining: 0 }), false);
    assert.strictEqual(legal(moveReact, { timingType: "reaction", triggerType: "move-declared", movementBudgetRemaining: 2 }), true);
    const atkReact = man({ type: "reaction", triggerType: "attack-declared" });
    assert.strictEqual(legal(atkReact, { timingType: "reaction", triggerType: "attack-declared", attacksRemaining: 0 }), false);
    assert.strictEqual(legal(atkReact, { timingType: "reaction", triggerType: "attack-declared", attacksRemaining: 1 }), true);

    // getLegalManeuvers filters a supplied list down to the legal ones.
    const cheap = man({ name: "Cheap" });
    const pricey = man({ name: "Pricey", CostType: "CriticalPoints", CostAmount: 5 });
    const filtered = getLegalManeuvers({
        maneuvers: [cheap, pricey],
        timingType: "post", triggerType: "post-attack", currentCriticalPoints: 1,
    });
    assert.deepStrictEqual(filtered.map((m) => m.name), ["Cheap"], "prices out the unaffordable maneuver");

    const evals = getLegalManeuvers({
        maneuvers: [cheap, pricey], includeReasons: true,
        timingType: "post", triggerType: "post-attack", currentCriticalPoints: 1,
    });
    assert.strictEqual(evals.length, 2, "includeReasons returns every evaluation");
    assert.strictEqual(evals.find((e) => e.maneuver.name === "Pricey").legal, false);
    console.log("  ✓ range bands, melee skip, move/attack economy, getLegalManeuvers filter + includeReasons");
}

/* ── Structured requirements + "guide on grey areas" convention ───────── */
console.log("\nmaneuver-legality: structured requirements + guiding gates...");
{
    const req = (requirements, extra = {}) => man({ requirements, ...extra });

    // Actor conditions: required present / prohibited absent.
    assert.strictEqual(legal(req({ requiresHidden: true }), { actorConditions: ["Hidden"] }), true, "hidden present → ok");
    assert.strictEqual(legal(req({ requiresHidden: true }), { actorConditions: [] }), false, "hidden absent → blocked");
    assert.strictEqual(legal(req({ requiresMounted: true }), { actorConditions: ["Mounted"] }), true);
    assert.strictEqual(legal(req({ requiresUnmounted: true }), { actorConditions: ["Mounted"] }), false, "mounted → unmounted blocked");
    assert.strictEqual(legal(req({ prohibitedActorConditions: ["locked", "prone"] }), { actorConditions: ["Prone"] }), false);
    assert.strictEqual(legal(req({ prohibitedActorConditions: ["locked", "prone"] }), { actorConditions: [] }), true);

    // Armor-class exclusion (Evade migrated to prohibitedArmorClasses).
    const evadeLike = req({ prohibitedArmorClasses: ["Medium", "Heavy", "Very Heavy", "VeryHeavy"] });
    assert.strictEqual(legal(evadeLike, { armors: [{ equipped: true, armorClass: "Heavy" }] }), false, "heavy armour bars it");
    assert.strictEqual(legal(evadeLike, { armors: [{ equipped: true, armorClass: "Light" }] }), true, "light armour fine");
    assert.strictEqual(legal(evadeLike, {}), true, "no armour info → grey → passes");

    // Target locked (Choke/Lock And Strike migrated to requiresTargetLocked).
    assert.strictEqual(legal(req({ requiresTargetLocked: true }), { targetConditions: ["Locked"] }), true);
    assert.strictEqual(legal(req({ requiresTargetLocked: true }), { targetConditions: [] }), false);

    // Guide-on-grey: ally-geometry requirements block only when the caller computed
    // the flag FALSE; an absent (uncomputed) flag passes so the GM can adjudicate.
    assert.strictEqual(legal(req({ requiresVisibleAlly: true }), {}), true, "visible-ally unknown → passes (guide)");
    assert.strictEqual(legal(req({ requiresVisibleAlly: true }), { hasVisibleAlly: false }), false, "known-absent → blocked");
    assert.strictEqual(legal(req({ requiresVisibleAlly: true }), { hasVisibleAlly: true }), true);
    assert.strictEqual(legal(req({ requiresFlankingAlly: true }), {}), true, "flanking unknown → passes (guide)");
    assert.strictEqual(legal(req({ requiresFlankingAlly: true }), { hasFlankingAlly: false }), false);
    assert.strictEqual(legal(req({ requiresFormationPartner: true }), {}), true);
    assert.strictEqual(legal(req({ requiresPolearmAlly: true }), {}), true);
    assert.strictEqual(legal(req({ requiresAdjacentAllyTarget: true }), {}), true);

    // Profile gate guides on absent profile (was a hard fail before).
    const meleeOnly = man({ effectData: { appliesTo: "melee-attack" } });
    assert.strictEqual(legal(meleeOnly, {}), true, "no profile → grey → passes");
    assert.strictEqual(legal(meleeOnly, { profile: { attackType: "ranged" } }), false, "wrong profile still blocks");
    assert.strictEqual(legal(meleeOnly, { profile: { attackType: "melee" } }), true);

    // The free-text `requirements.text` is display-only — it no longer gates.
    assert.strictEqual(legal(req({ text: "Hidden" }), { actorConditions: [] }), true, "text alone does not gate");
    console.log("  ✓ structured actor/target gates, armour exclusion, guide-on-grey ally flags, profile guide, text non-gating");
}

console.log("\nmaneuver-legality.test.mjs — all assertions passed.");
