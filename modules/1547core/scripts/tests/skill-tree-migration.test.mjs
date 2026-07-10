import assert from "assert";
import { reconcileManeuverGraph } from "../migrations/skill-tree-migration.js";

// Skill nodes (structure) + maneuver nodes wired to them.
const SKILL = { kind: "skill", name: "Combat Melee" };
const man = (name, reqSkillId, minLevel = 1) => ({
    kind: "maneuver",
    name,
    requirements: [{ nodeId: reqSkillId, minLevel }],
    anyOf: [],
});

console.log("skill-tree-migration.reconcileManeuverGraph...");
{
    const CM = "Item.CombatMelee";
    // World: has the skill, a stale maneuver (removed), and a custom node.
    const world = {
        [CM]: SKILL,
        "Item.CounterStrike": man("Counter Strike", CM, 2),   // removed by the rework
        "Item.Custom": { kind: "custom", name: "GM Homebrew" },
    };
    // Default: dropped Counter Strike, added Flank (prereq CM present) and a
    // maneuver whose prereq is absent from the world (must NOT be added).
    const def = {
        [CM]: SKILL,
        "Item.Flank": man("Flank", CM, 2),
        "Item.Exotic": man("Exotic", "Item.MissingSkill", 3),
    };

    const { next, changed } = reconcileManeuverGraph(world, def);
    assert.strictEqual(changed, true);
    // Stale maneuver removed.
    assert.ok(!next["Item.CounterStrike"], "stale maneuver node removed");
    // New maneuver with a present prereq added.
    assert.ok(next["Item.Flank"], "new maneuver with present prereq added");
    // New maneuver with an ABSENT prereq is skipped (no dangling requirement).
    assert.ok(!next["Item.Exotic"], "maneuver with missing prereq is not added");
    // Skill node and GM custom node untouched.
    assert.deepStrictEqual(next[CM], SKILL, "skill node preserved");
    assert.ok(next["Item.Custom"], "custom node preserved");
    console.log("  ✓ removes stale maneuvers, adds new ones with present prereqs, preserves skills/custom");
}

{
    // No-op when the world already matches the default's maneuver set.
    const CM = "Item.CombatMelee";
    const graph = { [CM]: SKILL, "Item.Flank": man("Flank", CM) };
    const { changed } = reconcileManeuverGraph(graph, graph);
    assert.strictEqual(changed, false, "already-aligned graph reports no change");
    console.log("  ✓ no change when already aligned");
}

console.log("\nskill-tree-migration.test.mjs — all assertions passed.");
