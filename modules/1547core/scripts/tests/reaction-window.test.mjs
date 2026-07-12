// Reaction-window mechanics (services/reaction-service.js): the settle-once
// selection controller, the timeout auto-pass, candidate normalization, and
// the Core-stack scaling that now rides the selection payload (ADR-0004 —
// selectReaction(id, { stagedCore }) instead of a service → hud-state read).
import assert from "node:assert/strict";
import {
    scaleCoreReactionSelection,
    createReactionSelectionController,
    waitForReactionSelection,
    normalizeSelectedReaction,
} from "../services/reaction-service.js";

const CANDIDATES = [
    { id: "evade", name: "Evade", effectData: { removeMultiplierDie: 1 } },
    { id: "core-def", uuid: "uuid-core", name: "Core Defense", CostAmount: 1, effectData: { addDefenseMultiplierDice: 1, note: "x" } },
];

console.log("reaction-window.normalizeSelectedReaction...");
{
    assert.equal(normalizeSelectedReaction(null, CANDIDATES), null);
    assert.equal(normalizeSelectedReaction("evade", CANDIDATES), CANDIDATES[0], "id lookup");
    assert.equal(normalizeSelectedReaction("uuid-core", CANDIDATES), CANDIDATES[1], "uuid lookup");
    assert.equal(normalizeSelectedReaction("nope", CANDIDATES), null, "unknown id");
    const obj = { name: "Custom" };
    assert.equal(normalizeSelectedReaction(obj, CANDIDATES), obj, "object passes through");
    console.log("  ✓ id/uuid/object/null forms");
}

console.log("reaction-window.selection controller (settle-once)...");
{
    const controller = createReactionSelectionController(CANDIDATES);
    assert.equal(controller.selectReaction("nope"), false, "unknown id does NOT settle");
    assert.equal(controller.selectReaction("evade"), true, "first valid selection settles");
    assert.equal(controller.selectReaction("core-def"), false, "second selection rejected (settled)");
    assert.equal(controller.passReaction(), false, "pass after settle rejected");
    assert.equal(await controller.selectionPromise, CANDIDATES[0]);

    const passer = createReactionSelectionController(CANDIDATES);
    assert.equal(passer.passReaction(), true);
    assert.equal(await passer.selectionPromise, null, "pass settles null");
    console.log("  ✓ first valid selection wins; unknown ids don't burn the window");
}

console.log("reaction-window.stagedCore rides the selection payload...");
{
    const controller = createReactionSelectionController(CANDIDATES);
    controller.selectReaction("core-def", { stagedCore: 3 });
    const selected = await controller.selectionPromise;
    assert.equal(selected.stagedCore, 3, "staged count attached to the resolved candidate");
    assert.equal(selected.name, "Core Defense");
    assert.ok(!("stagedCore" in CANDIDATES[1]), "the shared candidate object is NOT mutated");

    const plain = createReactionSelectionController(CANDIDATES);
    plain.selectReaction("core-def");
    assert.equal((await plain.selectionPromise), CANDIDATES[1], "no meta → candidate untouched (no copy)");

    const zero = createReactionSelectionController(CANDIDATES);
    zero.selectReaction("core-def", { stagedCore: 0 });
    assert.ok(!("stagedCore" in await zero.selectionPromise), "stagedCore 0 is not attached");
    console.log("  ✓ stagedCore attaches as a copy, only when > 0");
}

console.log("reaction-window.scaleCoreReactionSelection...");
{
    const reaction = CANDIDATES[1];
    assert.equal(scaleCoreReactionSelection(reaction, 1), reaction, "count 1 → unchanged reference");
    assert.equal(scaleCoreReactionSelection(reaction, 0), reaction, "count 0 → unchanged");
    assert.equal(scaleCoreReactionSelection(null, 3), null);

    const scaled = scaleCoreReactionSelection(reaction, 3);
    assert.equal(scaled.effectData.addDefenseMultiplierDice, 3, "numeric effects ×n");
    assert.equal(scaled.effectData.note, "x", "non-numeric effects untouched");
    assert.equal(scaled.CostAmount, 3, "cost ×n");
    assert.equal(reaction.effectData.addDefenseMultiplierDice, 1, "original not mutated");

    const fromSource = scaleCoreReactionSelection({ source: { CostAmount: 2 }, effectData: {} }, 2);
    assert.equal(fromSource.CostAmount, 4, "cost falls back to source.CostAmount");
    console.log("  ✓ ×n scaling of numeric effects + cost, immutably, count<=1 no-op");
}

console.log("reaction-window.waitForReactionSelection (timeout auto-pass)...");
{
    // Zero-length window: auto-passes immediately.
    const instant = createReactionSelectionController(CANDIDATES);
    const instantResult = await waitForReactionSelection({
        reactionWindow: { timeoutMs: 0 },
        selectionController: instant,
    });
    assert.equal(instantResult, null, "0ms window auto-passes");

    // Selection lands before the deadline.
    const quick = createReactionSelectionController(CANDIDATES);
    setTimeout(() => quick.selectReaction("evade"), 5);
    const quickResult = await waitForReactionSelection({
        reactionWindow: { timeoutMs: 5000 },
        selectionController: quick,
    });
    assert.equal(quickResult, CANDIDATES[0], "in-time selection wins over the timer");

    // Deadline passes with no choice: auto-pass (short real timer).
    const slow = createReactionSelectionController(CANDIDATES);
    const slowResult = await waitForReactionSelection({
        reactionWindow: { timeoutMs: 20 },
        selectionController: slow,
    });
    assert.equal(slowResult, null, "expiry auto-passes");
    console.log("  ✓ instant/in-time/expired windows settle correctly");
}

console.log("\nAll reaction-window tests passed.");
