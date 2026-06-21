import assert from "assert";

// Tooltip helpers for the HUD info popups: authored stat texts and the
// condition-registry descriptions surfaced on hover.

const { STAT_INFO, getStatTooltip } = await import("../hud/stat-info.js");
const { getConditionDescription, CONDITIONS } = await import("../services/condition-registry.js");

console.log("stat-info: every primary stat has authored text...");
{
    for (const stat of ["Strength", "Dexterity", "Stamina", "Intelligence", "Faith", "Charisma", "Power"]) {
        assert.ok(STAT_INFO[stat] && STAT_INFO[stat].length > 20, `${stat} has a description`);
    }
    const tip = getStatTooltip("Strength", "2d6+1");
    assert.ok(tip.startsWith("Strength (2d6+1) —"), "tooltip leads with name + formula");
    assert.ok(tip.includes(STAT_INFO.Strength), "tooltip includes the authored text");
    assert.strictEqual(getStatTooltip("Strength"), `Strength — ${STAT_INFO.Strength}`, "no formula -> name only head");
    assert.strictEqual(getStatTooltip("Bogus"), "Bogus", "unknown stat degrades to the label");
    console.log("  ✓ 7 stats authored; tooltip composes name + formula + text");
}

console.log("\ncondition-registry: every condition has a description...");
{
    for (const [name, rule] of Object.entries(CONDITIONS)) {
        assert.ok(rule.description && rule.description.length > 15, `${name} has a description`);
    }
    // Lookup by canonical name and by slug both resolve.
    assert.strictEqual(getConditionDescription("Choking Hold"), CONDITIONS["Choking Hold"].description);
    assert.strictEqual(getConditionDescription("choking-hold"), CONDITIONS["Choking Hold"].description, "slug resolves");
    assert.strictEqual(getConditionDescription("Prone"), CONDITIONS.Prone.description);
    assert.strictEqual(getConditionDescription("not-a-condition"), "", "unknown condition -> empty");
    console.log("  ✓ all conditions described; lookup by name and slug");
}

console.log("\nAll hud-info-tooltip tests passed.");
