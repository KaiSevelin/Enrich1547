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

console.log("\nhumour-info: authored texts + name normalisation...");
{
    const { HUMOUR_INFO, canonicalHumour, getHumourTooltip, getHumourDescription } =
        await import("../services/humour-info.js");
    for (const h of ["Blood", "Yellow Bile", "Black Bile", "Phlegm"]) {
        assert.ok(HUMOUR_INFO[h] && HUMOUR_INFO[h].length > 20, `${h} authored`);
    }
    // Every spelling resolves to the canonical name.
    for (const spelling of ["Yellow Bile", "YellowBile", "yellow bile", "yellow-bile", "Humour_YellowBile"]) {
        assert.strictEqual(canonicalHumour(spelling), "Yellow Bile", `${spelling} -> Yellow Bile`);
    }
    assert.strictEqual(canonicalHumour("blood"), "Blood");
    assert.strictEqual(canonicalHumour("nonsense"), "", "unknown -> empty");
    assert.ok(getHumourTooltip("BlackBile").startsWith("Black Bile —"));
    assert.strictEqual(getHumourDescription("phlegm"), HUMOUR_INFO.Phlegm);
    console.log("  ✓ 4 humours authored; all spellings normalise");
}

console.log("\ninfo-enricher: resolveInfo...");
{
    const { resolveInfo } = await import("../enrichers/info-enricher.js");

    const str = resolveInfo("stat", "Strength");
    assert.strictEqual(str.type, "stat");
    assert.strictEqual(str.label, "Strength", "label defaults to the key");
    assert.ok(str.tooltip.includes(STAT_INFO.Strength), "stat tooltip resolved");
    assert.ok(str.known);

    const cond = resolveInfo("condition", "choking-hold", "the hold");
    assert.strictEqual(cond.label, "the hold", "custom label honoured");
    assert.ok(cond.tooltip.startsWith("choking-hold —"), "condition tooltip resolved by slug");
    assert.ok(cond.known);

    const unknownType = resolveInfo("widget", "Foo");
    assert.strictEqual(unknownType.label, "Foo");
    assert.strictEqual(unknownType.tooltip, "", "unknown type -> no tooltip");
    assert.strictEqual(unknownType.known, false);

    const unknownKey = resolveInfo("condition", "not-real");
    assert.strictEqual(unknownKey.tooltip, "", "unknown condition -> no tooltip");
    assert.strictEqual(unknownKey.known, false);
    console.log("  ✓ stat/condition resolve; custom label; unknown type/key degrade");
}

console.log("\ninfo-enricher: emit helpers (statRef/conditionRef)...");
{
    const { statRef, conditionRef } = await import("../enrichers/info-enricher.js");
    assert.strictEqual(statRef("Strength"), "@stat[Strength]{Strength}");
    assert.strictEqual(statRef("Power", "the uncanny"), "@stat[Power]{the uncanny}");
    assert.strictEqual(conditionRef("Choking Hold"), "@condition[Choking Hold]{Choking Hold}");
    const { humourRef, powerRef, maneuverRef, itemRef, skillRef } = await import("../enrichers/info-enricher.js");
    assert.strictEqual(humourRef("YellowBile", "Yellow Bile"), "@humour[YellowBile]{Yellow Bile}");
    assert.strictEqual(powerRef("Animal familiarity"), "@power[Animal familiarity]{Animal familiarity}");
    assert.strictEqual(maneuverRef("Shield Bash"), "@maneuver[Shield Bash]{Shield Bash}");
    assert.strictEqual(itemRef("Longbow"), "@item[Longbow]{Longbow}");
    assert.strictEqual(skillRef("Athletics"), "@skill[Athletics]{Athletics}");
    // Keys that can't be expressed in the bracket syntax degrade to plain text.
    assert.strictEqual(statRef("a]b"), "a]b", "key with ] is left plain");
    console.log("  ✓ helpers emit matching @stat/@condition source text");
}

console.log("\nAll hud-info-tooltip tests passed.");
