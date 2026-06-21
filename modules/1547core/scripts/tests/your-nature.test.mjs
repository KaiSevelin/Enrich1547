import assert from "assert";

/**
 * Unit tests for the pure "Your Nature" logic extracted from chargen.js into
 * your-nature.js: trigger gate, stage eligibility, domain qualification, and the
 * computed selector-bucket fallback. These rules previously lived as RNG-gated
 * methods on the 5,000-line SkillTreeChargenApp with no test seam.
 *
 * Spec: docs/specs/chargen-spec-v1.md (Part 3 - Your Nature).
 */

const yn = await import("../chargen/your-nature.js");
const { statSteps, statFromSteps } = await import("../../foundry/Templates/chargen/foundry-primary-stats/stats.js");

console.log("stats: steps ladder (calculated stat value)...");
{
    // The exact mapping: 0=1d6, 1=1d6+1, 2=1d6+2, 3=1d6+3, 4=2d6, ...
    const ladder = [
        [1, 0, 0], [1, 1, 1], [1, 2, 2], [1, 3, 3],
        [2, 0, 4], [2, 1, 5], [2, 2, 6], [2, 3, 7],
        [3, 0, 8], [3, 3, 11], [4, 0, 12]
    ];
    for (const [dice, mod, steps] of ladder) {
        assert.strictEqual(statSteps(dice, mod), steps, `${dice}d6+${mod} = ${steps} steps`);
        assert.deepStrictEqual(statFromSteps(steps), { dice, mod }, `${steps} steps -> ${dice}d6+${mod}`);
    }
    // statFromSteps clamps below zero and floors fractional input.
    assert.deepStrictEqual(statFromSteps(-5), { dice: 1, mod: 0 }, "negative steps clamp to 1d6");
    assert.strictEqual(statSteps("2", "1"), 5, "string dice/mod coerce");
    console.log("  ✓ statSteps / statFromSteps round-trip the d6 ladder");
}

console.log("your-nature: trigger gate (1d6, 4-6 fires)...");
{
    assert.strictEqual(yn.shouldTriggerYourNature(3), false);
    assert.strictEqual(yn.shouldTriggerYourNature(4), true);
    assert.strictEqual(yn.shouldTriggerYourNature(5), true);
    assert.strictEqual(yn.shouldTriggerYourNature(6), true);
    assert.strictEqual(yn.shouldTriggerYourNature(0), false, "no roll / 0 never fires");
    assert.strictEqual(yn.shouldTriggerYourNature("4"), true, "string totals coerce");
    console.log("  ✓ 4, 5 and 6 trigger a draw");
}

console.log("\nyour-nature: stage eligibility (adolescence → retirement)...");
{
    for (const stage of ["adolescence", "career", "advanced"]) {
        assert.strictEqual(yn.isYourNatureEligibleStage(stage), true, `${stage} eligible`);
    }
    for (const stage of ["birth", "childhood", "deferred", "", null, undefined]) {
        assert.strictEqual(yn.isYourNatureEligibleStage(stage), false, `${stage} excluded`);
    }
    assert.strictEqual(yn.isYourNatureEligibleStage("  career  "), true, "trims whitespace");
    console.log("  ✓ birth/childhood excluded; adolescence/career/advanced included");
}

console.log("\nyour-nature: domain qualification...");
{
    // Stat domains qualify at 1d6+2 or better (statSteps >= 2). Both the
    // die count and the modifier count; props default to 1d6+0 when absent.
    assert.strictEqual(yn.hasYourNatureRequirement({ Stats_DexterityDice: 2 }, "Dexterity"), true, "2d6 qualifies");
    assert.strictEqual(yn.hasYourNatureRequirement({ Stats_DexterityDice: 3 }, "Dexterity"), true, "3d6 qualifies");
    assert.strictEqual(yn.hasYourNatureRequirement({ Stats_DexterityDice: 1, Stats_DexterityMod: 2 }, "Dexterity"), true, "1d6+2 qualifies (the new floor)");
    assert.strictEqual(yn.hasYourNatureRequirement({ Stats_DexterityDice: 1, Stats_DexterityMod: 3 }, "Dexterity"), true, "1d6+3 qualifies");
    assert.strictEqual(yn.hasYourNatureRequirement({ Stats_DexterityDice: 1, Stats_DexterityMod: 1 }, "Dexterity"), false, "1d6+1 is below the floor");
    assert.strictEqual(yn.hasYourNatureRequirement({ Stats_DexterityDice: 1 }, "Dexterity"), false, "1d6+0 fails");
    assert.strictEqual(yn.hasYourNatureRequirement({}, "Dexterity"), false, "absent stat → 1d6+0 → fails");
    assert.strictEqual(yn.hasYourNatureRequirement({ Stats_DexterityDice: "1", Stats_DexterityMod: "2" }, "Dexterity"), true, "string dice/mod coerce");

    // Humour domains need the corresponding Humour_* flag to be truthy.
    assert.strictEqual(yn.hasYourNatureRequirement({ Humour_Blood: true }, "Blood"), true);
    assert.strictEqual(yn.hasYourNatureRequirement({ Humour_YellowBile: 1 }, "Yellow bile"), true);
    assert.strictEqual(yn.hasYourNatureRequirement({ Humour_BlackBile: false }, "Black bile"), false);
    assert.strictEqual(yn.hasYourNatureRequirement({}, "Phlegm"), false, "absent humour flag → fails");

    // Defensive: unknown keys and empty input never qualify.
    assert.strictEqual(yn.hasYourNatureRequirement({ Stats_DexterityDice: 6 }, "Charm"), false, "unknown domain");
    assert.strictEqual(yn.hasYourNatureRequirement({}, ""), false);
    assert.strictEqual(yn.hasYourNatureRequirement(null, "Dexterity"), false, "null props tolerated");
    console.log("  ✓ stat 1d6+2 gate (mod-aware), humour-flag gate, unknown/empty rejected");
}

console.log("\nyour-nature: selector-bucket fallback...");
{
    // Endpoints: [1,1,1] → first key, [6,6,6] → last key.
    assert.strictEqual(yn.yourNatureSelectorBucket([1, 1, 1]).key, yn.YOUR_NATURE_SELECTOR_KEYS[0]);
    assert.strictEqual(
        yn.yourNatureSelectorBucket([6, 6, 6]).key,
        yn.YOUR_NATURE_SELECTOR_KEYS[yn.YOUR_NATURE_SELECTOR_KEYS.length - 1]
    );

    // Every one of the 216 ordered combinations maps to a real selector key,
    // and the mapping is monotonic in the combination index.
    const counts = Object.fromEntries(yn.YOUR_NATURE_SELECTOR_KEYS.map(k => [k, 0]));
    let lastBucket = -1;
    for (let a = 1; a <= 6; a += 1) {
        for (let b = 1; b <= 6; b += 1) {
            for (let c = 1; c <= 6; c += 1) {
                const { key } = yn.yourNatureSelectorBucket([a, b, c]);
                assert.ok(key in counts, `combination ${a},${b},${c} → known key`);
                counts[key] += 1;
                const bucket = yn.YOUR_NATURE_SELECTOR_KEYS.indexOf(key);
                assert.ok(bucket >= lastBucket, "bucketing is monotonic in combination index");
                lastBucket = bucket;
            }
        }
    }
    assert.strictEqual(Object.values(counts).reduce((s, n) => s + n, 0), 216, "all 216 combos mapped");
    // Uniform-ish: 216 / 11 ≈ 19.6, so each key lands 19 or 20 combinations.
    for (const [key, n] of Object.entries(counts)) {
        assert.ok(n === 19 || n === 20, `${key} got ${n} (expected 19 or 20)`);
    }

    // Out-of-range / malformed faces clamp to 1..6 rather than throwing.
    assert.strictEqual(yn.yourNatureSelectorBucket([0, 0, 0]).key, yn.YOUR_NATURE_SELECTOR_KEYS[0]);
    assert.strictEqual(yn.yourNatureSelectorBucket([9, 9, 9]).key, yn.YOUR_NATURE_SELECTOR_KEYS[yn.YOUR_NATURE_SELECTOR_KEYS.length - 1]);
    assert.deepStrictEqual(yn.yourNatureSelectorBucket([]).dice, [1, 1, 1], "missing dice clamp to 1");
    console.log("  ✓ endpoints, full 216-combo coverage, monotonic, ~uniform, clamps");
}

console.log("\nyour-nature: cause lines...");
{
    // Every selector domain has an authored, non-empty cause line.
    for (const key of yn.YOUR_NATURE_SELECTOR_KEYS) {
        const line = yn.yourNatureCauseLine(key);
        assert.ok(line && line.length > 0, `${key} has a cause line`);
        assert.strictEqual(line, yn.YOUR_NATURE_CAUSE_LINES[key], `${key} cause line matches the map`);
    }
    // Unknown/empty inputs degrade gracefully.
    assert.ok(yn.yourNatureCauseLine("Charm").includes("Charm"), "unknown domain falls back generically");
    assert.strictEqual(yn.yourNatureCauseLine(""), "", "empty domain yields empty line");
    console.log("  ✓ all 11 domains have cause lines; graceful fallback");
}

console.log("\nyour-nature: ref table integrity...");
{
    // Every selector key has a destination ref, and every ref is a 16-char id.
    const ID_RX = /^RollTable\.[A-Za-z0-9]{16}$/;
    for (const key of yn.YOUR_NATURE_SELECTOR_KEYS) {
        const ref = yn.YOUR_NATURE_TABLE_REFS[key];
        assert.ok(ref, `selector key "${key}" has a destination table ref`);
        assert.ok(ID_RX.test(ref), `${key} ref "${ref}" is a valid RollTable.<16-char-id>`);
    }
    assert.ok(ID_RX.test(yn.YOUR_NATURE_SELECTOR_TABLE_REF), "selector table ref is valid");
    assert.strictEqual(yn.YOUR_NATURE_SELECTOR_KEYS.length, 11, "seven stats + four humours");
    console.log("  ✓ 11 keys, all refs present and id-valid (import keeps these ids)");
}

console.log("\nAll your-nature tests passed.");
