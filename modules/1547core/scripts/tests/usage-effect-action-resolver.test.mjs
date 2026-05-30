import assert from "assert";

/**
 * Unit tests for the pure helpers in services/usage-effect-action-resolver.js.
 * These run in Node with a tiny `foundry.utils.getProperty` shim — the helpers
 * themselves touch no Foundry globals.
 */

globalThis.foundry = {
    utils: {
        getProperty: (obj, path) => String(path).split(".").reduce((o, k) => (o == null ? o : o[k]), obj),
    },
};
// `canvas` is a Foundry global the range helpers read for grid size.
globalThis.canvas = { grid: { size: 100 } };

const {
    buildRollFormula,
    parseTargetCount,
    slugify,
    escapeHtml,
    normalizeEffectProps,
    resolveDirectTargetPath,
    buildDirectDocumentUpdate,
    removalMatchesEffect,
    isRangeSatisfied,
    buildStatFormulaFromActor,
} = await import("../services/usage-effect-action-resolver.js");

console.log("usage-effect-action-resolver pure helpers...");

{
    assert.strictEqual(buildRollFormula(3, 2), "3d6 + 2");
    assert.strictEqual(buildRollFormula(3, 0), "3d6");
    assert.strictEqual(buildRollFormula("2", "3"), "2d6 + 3");
    assert.strictEqual(buildRollFormula(-1, -5), "0d6", "negative dice/mod clamp to 0");
    console.log("  ✓ buildRollFormula: dice/mod formatting and clamping");
}

{
    assert.strictEqual(parseTargetCount(""), 1);
    assert.strictEqual(parseTargetCount("3"), 3);
    assert.strictEqual(parseTargetCount("0"), 1, "non-positive falls back to 1");
    assert.strictEqual(parseTargetCount("abc"), 1);
    assert.strictEqual(parseTargetCount("all"), Number.POSITIVE_INFINITY);
    console.log("  ✓ parseTargetCount: numbers, 'all', and fallbacks");
}

{
    assert.strictEqual(slugify("Ill Luck!"), "ill-luck");
    assert.strictEqual(slugify("  A__B  "), "a-b");
    assert.strictEqual(slugify(null), "");
    console.log("  ✓ slugify: normalises to kebab-case");
}

{
    // Security-relevant: helper feeds dialog/chat HTML built from item names.
    assert.strictEqual(escapeHtml("<script>"), "&lt;script&gt;");
    assert.strictEqual(escapeHtml('a&"b\''), "a&amp;&quot;b&#39;");
    console.log("  ✓ escapeHtml: escapes <, >, &, \", '");
}

{
    const defaults = normalizeEffectProps({});
    assert.strictEqual(defaults.ApplicationMode, "NarrativeOnly");
    assert.strictEqual(defaults.EffectType, "Descriptive");
    assert.strictEqual(defaults.EffectSubtype, "Omen");
    assert.strictEqual(defaults.TargetType, "Actor");
    assert.strictEqual(defaults.CheckType, "None");
    assert.strictEqual(defaults.Visible, true);

    const fromCamel = normalizeEffectProps({ system: { props: { effectType: "Status", visible: false } } });
    assert.strictEqual(fromCamel.EffectType, "Status");
    assert.strictEqual(fromCamel.Visible, false);
    console.log("  ✓ normalizeEffectProps: defaults + camelCase aliasing");
}

{
    assert.strictEqual(resolveDirectTargetPath({ PayloadTarget: "" }).kind, "invalid");
    assert.deepStrictEqual(resolveDirectTargetPath({ PayloadTarget: "system.props.Foo" }), { kind: "property", path: "system.props.Foo" });
    assert.strictEqual(resolveDirectTargetPath({ PayloadTarget: "PrimaryStat:Strength:dice" }).path, "system.props.Stats_StrengthDice");
    assert.deepStrictEqual(resolveDirectTargetPath({ PayloadTarget: "PrimaryStat:Strength:steps" }), { kind: "primary-stat-steps", statLabel: "Strength" });
    assert.strictEqual(resolveDirectTargetPath({ PayloadTarget: "PrimaryStat:Bogus:dice" }).kind, "invalid");
    assert.strictEqual(resolveDirectTargetPath({ PayloadTarget: "Resource:Mana" }).path, "system.props.Mana");
    const trait = resolveDirectTargetPath({ PayloadTarget: "FlagTrait:Cursed-Soul" });
    assert.strictEqual(trait.kind, "trait-record");
    assert.ok(trait.namePath.endsWith("directTraits.cursed-soul.name"));
    assert.strictEqual(resolveDirectTargetPath({ PayloadTarget: "FlagTag:Marked" }).kind, "flag-tag");
    console.log("  ✓ resolveDirectTargetPath: stat / resource / trait / tag / invalid");
}

{
    const target = { update() {}, system: { props: { HP: 5 } } };
    assert.deepStrictEqual(
        buildDirectDocumentUpdate({ PayloadTarget: "system.props.HP", PayloadOperation: "increase", PayloadValue: 3 }, target).update,
        { "system.props.HP": 8 }
    );
    assert.deepStrictEqual(
        buildDirectDocumentUpdate({ PayloadTarget: "system.props.HP", PayloadOperation: "set", PayloadValue: 10 }, target).update,
        { "system.props.HP": 10 }
    );
    assert.deepStrictEqual(
        buildDirectDocumentUpdate({ PayloadTarget: "system.props.HP", PayloadOperation: "decrease", PayloadValue: 2 }, target).update,
        { "system.props.HP": 3 }
    );
    assert.strictEqual(
        buildDirectDocumentUpdate({ PayloadTarget: "system.props.HP", PayloadValue: "nope" }, target).update,
        null,
        "non-numeric value on a numeric property is rejected"
    );
    const steppedTarget = {
        update() {},
        system: { props: { Stats_StrengthDice: 1, Stats_StrengthMod: 3, Stats_StaminaDice: 1, Stats_DexterityDice: 1, MaxHitPoints: 3 } }
    };
    assert.deepStrictEqual(
        buildDirectDocumentUpdate({ PayloadTarget: "PrimaryStat:Strength:steps", PayloadOperation: "add", PayloadValue: 1 }, steppedTarget).update,
        {
            "system.props.Stats_StrengthDice": 2,
            "system.props.Stats_StrengthMod": 0,
            "system.props.MaxHitPoints": 4
        }
    );
    assert.deepStrictEqual(
        buildDirectDocumentUpdate({ PayloadTarget: "PrimaryStat:Strength:steps", PayloadOperation: "decrease", PayloadValue: 2 }, steppedTarget).update,
        {
            "system.props.Stats_StrengthDice": 1,
            "system.props.Stats_StrengthMod": 1,
            "system.props.MaxHitPoints": 3
        }
    );
    console.log("  ✓ buildDirectDocumentUpdate: set/increase/decrease + numeric guard");
}

{
    const stored = (type, subtype) => ({ flags: { "1547core": { usageEffect: { EffectType: type, EffectSubtype: subtype } } } });
    assert.strictEqual(removalMatchesEffect(stored("Binding", ""), { EffectSubtype: "Binding" }), true);
    assert.strictEqual(removalMatchesEffect(stored("Status", "Cursed"), { EffectSubtype: "Curse" }), true);
    assert.strictEqual(removalMatchesEffect(stored("Status", "Happy"), { EffectSubtype: "Curse" }), false);
    assert.strictEqual(removalMatchesEffect(stored("Status", "Cursed"), { EffectSubtype: "Unknown" }), false);
    console.log("  ✓ removalMatchesEffect: subtype-class matching");
}

{
    const at = (x) => ({ x, y: 0, width: 1, height: 1 });
    const src = at(0);
    assert.strictEqual(isRangeSatisfied(src, at(0), "self"), true);
    assert.strictEqual(isRangeSatisfied(src, at(300), ""), true, "empty range is unrestricted");
    assert.strictEqual(isRangeSatisfied(src, at(100), "touch"), true, "1 square away is in touch range");
    assert.strictEqual(isRangeSatisfied(src, at(200), "touch"), false, "2 squares away is out of touch range");
    assert.strictEqual(isRangeSatisfied(src, at(300), "3"), true);
    assert.strictEqual(isRangeSatisfied(src, at(300), "2"), false);
    console.log("  ✓ isRangeSatisfied: self / unrestricted / touch / numeric squares");
}

{
    const actor = { system: { props: { Stats_StrengthDice: 3, Stats_StrengthMod: 2 } } };
    assert.strictEqual(buildStatFormulaFromActor(actor, "Strength"), "3d6 + 2");
    assert.strictEqual(buildStatFormulaFromActor(actor, "strength"), "3d6 + 2", "stat label is case-insensitive");
    assert.strictEqual(buildStatFormulaFromActor(actor, "Bogus"), "", "unknown stat yields empty formula");
    console.log("  ✓ buildStatFormulaFromActor: resolves stat dice/mod into a formula");
}

console.log("\nAll usage-effect-action-resolver pure-helper tests passed.");
