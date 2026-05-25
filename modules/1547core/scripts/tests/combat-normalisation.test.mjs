import assert from "assert";

/**
 * Test suite for combat/normalisation.mjs.
 *
 * The module is pure (no Foundry globals, no game.*, no Hooks), so these
 * tests are literal fixture-driven. The aim is to lock in the canonical
 * descriptor shapes that combat-resolver-service and
 * maneuver-legality-service both consume, so a future tweak in one can't
 * silently break the other.
 */

const {
    parseJsonString,
    parseCommaList,
    isTruthyLike,
    firstFiniteNumber,
    hasUsableRangeBands,
    inferWeaponAttackType,
    buildAttackProfilesFromWeaponProps,
    resolveAmmoRangeSpec,
    normalizeRangeBands,
    applyAmmoRangeEffects,
    normalizeManeuver,
    normalizeAmmoItem,
    normalizeWeapon,
    normalizeArmor,
} = await import("../combat/normalisation.mjs");

// ─────────────────────────────────────────────────────────────── parsers ──

console.log("parsers...");

assert.strictEqual(parseJsonString('{"a":1}').a, 1);
assert.strictEqual(parseJsonString("not json", "fb"), "fb");
assert.strictEqual(parseJsonString("", "fb"), "fb");
assert.strictEqual(parseJsonString(null, "fb"), "fb");
console.log("  ✓ parseJsonString returns parsed object / fallback");

assert.deepStrictEqual(parseCommaList("a, b ,, c"), ["a", "b", "c"]);
assert.deepStrictEqual(parseCommaList(["x", "y"]), ["x", "y"]);
assert.deepStrictEqual(parseCommaList(null), []);
console.log("  ✓ parseCommaList trims, dedupes empties, accepts arrays");

assert.strictEqual(isTruthyLike(true), true);
assert.strictEqual(isTruthyLike("override"), true);
assert.strictEqual(isTruthyLike(1), true);
assert.strictEqual(isTruthyLike("no"), false);
assert.strictEqual(isTruthyLike(0), false);
console.log("  ✓ isTruthyLike accepts {true,1,yes,y,override}");

assert.strictEqual(firstFiniteNumber([undefined, "x", 3, 4]), 3,
    "skips undefined (→ NaN) and non-numeric strings");
assert.strictEqual(firstFiniteNumber([null, 99]), 0,
    "Number(null) === 0 IS finite — caller beware (matches existing behaviour)");
assert.strictEqual(firstFiniteNumber([]), null);
assert.strictEqual(firstFiniteNumber([NaN, Infinity, -1]), -1,
    "Infinity is not finite; -1 is — note no >=0 filter (legality has its own)");
console.log("  ✓ firstFiniteNumber walks until finite (combat-resolver variant: no >=0 filter)");

assert.strictEqual(hasUsableRangeBands({ shortRange: 0, longRange: 0, maxRange: 5 }), true);
assert.strictEqual(hasUsableRangeBands({}), false);
console.log("  ✓ hasUsableRangeBands true when any band is positive");

// ──────────────────────────────────────────────────────── weapon helpers ──

console.log("\nweapon helpers...");

assert.strictEqual(inferWeaponAttackType({}, {}, { attackType: "Ranged" }), "ranged");
assert.strictEqual(inferWeaponAttackType({ category: "Thrown" }, {}), "thrown");
assert.strictEqual(inferWeaponAttackType({ groups: ["RangedWeapon"] }, {}), "ranged");
assert.strictEqual(inferWeaponAttackType({}, { UsesAmmo: true }), "ranged");
assert.strictEqual(inferWeaponAttackType({}, {}), "melee");
console.log("  ✓ inferWeaponAttackType: explicit > groups > usesAmmo > melee default");

{
    const profiles = buildAttackProfilesFromWeaponProps(
        { attackProfiles: [{ id: "p1", name: "Slash", dice: ["Heavy"] }] },
        { Attack: "1d6", AttackB: "1d8" }
    );
    assert.strictEqual(profiles.length, 2);
    assert.strictEqual(profiles[0].id, "p1");
    assert.strictEqual(profiles[0].name, "Slash");
    assert.deepStrictEqual(profiles[0].dice, ["Heavy"]);
    assert.strictEqual(profiles[1].id, "attackb");
    assert.strictEqual(profiles[1].name, "Alternative 1");
    console.log("  ✓ buildAttackProfilesFromWeaponProps merges source profiles with prop formulas");
}

// ───────────────────────────────────────────────── range bands & ammo specs ──

console.log("\nrange bands...");

{
    const bands = normalizeRangeBands({ shortRange: 5, longRange: 3, maxRange: 2 });
    assert.strictEqual(bands.longRange, 5, "long < short → bumped to short");
    assert.strictEqual(bands.maxRange, 5, "max < long (after bump) → bumped to long");
    console.log("  ✓ normalizeRangeBands enforces short ≤ long ≤ max");
}

{
    const bands = normalizeRangeBands({ shortRange: 4 });
    assert.deepStrictEqual(bands, { shortRange: 4, longRange: 4, maxRange: 4 });
    console.log("  ✓ normalizeRangeBands fills missing bands forward");
}

{
    const out = applyAmmoRangeEffects({ shortRange: 3, longRange: 6, maxRange: 9 }, {
        range: { mode: "modify", shortRange: 1, longRange: 2, maxRange: 3 }
    });
    assert.deepStrictEqual(out, { shortRange: 4, longRange: 8, maxRange: 12 });
    console.log("  ✓ applyAmmoRangeEffects: modify adds to base bands");
}

{
    const out = applyAmmoRangeEffects({ shortRange: 3, longRange: 6, maxRange: 9 }, {
        range: { mode: "override", shortRange: 1, longRange: 2, maxRange: 3 }
    });
    assert.deepStrictEqual(out, { shortRange: 1, longRange: 2, maxRange: 3 });
    console.log("  ✓ applyAmmoRangeEffects: override replaces base bands");
}

{
    const spec = resolveAmmoRangeSpec({}, { RangeShort: 5, RangeMedium: 10, RangeLong: 20 });
    assert.strictEqual(spec.mode, "modify");
    assert.strictEqual(spec.shortRange, 5);
    console.log("  ✓ resolveAmmoRangeSpec reads RangeShort/Medium/Long props (modify default)");

    const overrideSpec = resolveAmmoRangeSpec({}, {
        RangeShort: 5, RangeMedium: 10, RangeLong: 20, RangeModeOverride: true
    });
    assert.strictEqual(overrideSpec.mode, "override");
    console.log("  ✓ resolveAmmoRangeSpec honours RangeModeOverride flag");
}

// ────────────────────────────────────────────────── document normalisers ──

console.log("\nnormalizeWeapon...");

assert.strictEqual(normalizeWeapon(null), null,
    "REGRESSION: pure variant returns null for null input — callers (combat-resolver) layer the unarmed-default fallback");

{
    const weapon = {
        id: "w1",
        name: "Sword",
        flags: {
            "1547Core": {
                sourceData: { name: "Sword", category: "Blade", groups: ["MeleeWeapon"], traits: ["Parrying"] }
            }
        },
        system: { props: { ActiveAttackProfile: "AttackB", AmmoCapacity: 6 } }
    };
    const out = normalizeWeapon(weapon);
    assert.strictEqual(out.name, "Sword");
    assert.deepStrictEqual(out.traits, ["Parrying"]);
    assert.strictEqual(out.activeAttackProfileKey, "AttackB");
    assert.strictEqual(out.ammoCapacity, 6);
    assert.strictEqual(out.equipped, false, "default Equipped=false when not set");
    console.log("  ✓ reads source via 1547Core flag; default Equipped=false");
}

{
    const weapon = {
        id: "w2",
        flags: {},
        system: { props: { Equipped: true } }
    };
    assert.strictEqual(normalizeWeapon(weapon).equipped, true);
    console.log("  ✓ Equipped prop on the item is honoured");
}

console.log("\nnormalizeAmmoItem...");

assert.strictEqual(normalizeAmmoItem(null), null);

{
    const ammo = {
        id: "a1",
        flags: { "1547Core": { sourceData: { name: "Arrow", quantity: 12 } } },
        system: { props: { Quantity: 8, AmmoType: "arrow", AddDiceSummary: "Penetration, Heavy" } }
    };
    const out = normalizeAmmoItem(ammo);
    assert.strictEqual(out.name, "Arrow");
    assert.strictEqual(out.quantity, 8, "prop Quantity wins over source quantity");
    assert.strictEqual(out.ammoType, "arrow");
    assert.deepStrictEqual(out.addDice, ["Penetration", "Heavy"]);
    assert.strictEqual(out.itemDocument, ammo, "preserves doc ref for orchestrator");
    console.log("  ✓ canonical fields populated; itemDocument preserved");
}

console.log("\nnormalizeManeuver...");

{
    const m = {
        id: "m1",
        name: "Riposte",
        flags: {
            "1547Core": {
                sourceData: {
                    name: "Riposte",
                    type: "reaction",
                    triggerType: "attack-declared",
                    requirements: { requiredWeaponTags: ["Parrying"] }
                }
            }
        },
        system: { props: { UsageLimit: 2 } }
    };
    const out = normalizeManeuver(m);
    assert.strictEqual(out.type, "reaction");
    assert.strictEqual(out.triggerType, "attack-declared");
    assert.deepStrictEqual(out.requirements.requiredWeaponTags, ["Parrying"]);
    assert.deepStrictEqual(out.usageLimit, { maxUses: 2 });
    console.log("  ✓ timing / trigger / requirements / usage limit normalised");
}

assert.strictEqual(normalizeManeuver(null), null);

console.log("\nnormalizeArmor...");

{
    const armor = {
        id: "ar1",
        flags: { "1547Core": { sourceData: { name: "Mail", traits: ["Heavy"] } } },
        system: { props: { ArmorType: "Medium", Equipped: true } }
    };
    const out = normalizeArmor(armor);
    assert.strictEqual(out.armorClass, "Medium");
    assert.strictEqual(out.equipped, true);
    assert.deepStrictEqual(out.traits, ["Heavy"]);
    console.log("  ✓ armorClass from ArmorType prop; Equipped honoured");
}

assert.strictEqual(normalizeArmor(null), null);

console.log("\nAll combat/normalisation.mjs tests passed.");
