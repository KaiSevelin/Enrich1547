// combat/weapon-state.mjs — the attack-legality gate every Exchange enters
// through (extracted from actor-hud, ADR-0004). Pins getWeaponAttackState's
// gate order, the range-band/reach verdicts, and the item parsing.
import assert from "node:assert/strict";
import {
    getWeaponAttackState,
    getWeaponRangeBands,
    getWeaponReach,
    getWeaponAttackProfiles,
    getWeaponActiveAttackProfile,
    getChebyshevDistanceSquares,
    buildFoundryAttackRollFormula,
    getAmmoType,
    getAmmoQuantity,
} from "../combat/weapon-state.mjs";

// Fake tokens: tokenDescriptor reads x/y/width/height straight off the object
// (grid defaults to 100px without a canvas), so plain literals work headless.
const tokenAt = (col, row, size = 1) => ({ x: col * 100, y: row * 100, width: size, height: size });

// A weapon SUMMARY as summarizeActor builds it — the shape the gate reads.
function weaponSummary(overrides = {}) {
    return {
        equipped: true,
        usesAmmo: false,
        canTargetMultiple: false,
        activeAttackType: "melee",
        shortRange: null, longRange: null, maxRange: null,
        minReach: null, maxReach: null,
        ...overrides,
    };
}

console.log("weapon-state.getWeaponAttackState: pre-target gates...");
{
    assert.equal(getWeaponAttackState(null).status, "invalid");
    assert.equal(getWeaponAttackState(weaponSummary(), { attacksRemaining: 0 }).label, "No attacks remaining");
    assert.equal(getWeaponAttackState(weaponSummary({ equipped: false })).label, "Not equipped");
    assert.equal(getWeaponAttackState(weaponSummary({ usesAmmo: true, loadedAmmoId: null })).label, "No ammo loaded");
    assert.equal(getWeaponAttackState(weaponSummary({ usesAmmo: true, loadedAmmoId: "am1", loadedAmmoQuantity: 0 })).label, "Ammo depleted");
    assert.equal(getWeaponAttackState(weaponSummary({
        usesAmmo: true, loadedAmmoId: "am1", loadedAmmoQuantity: 3,
        loadedAmmoType: "bolt", activeAttackAllowedAmmoTypes: ["arrow"],
    })).label, "Wrong ammo");
    assert.equal(getWeaponAttackState(weaponSummary(), { targetCount: 2 }).label, "Multiple targets marked");
    const preview = getWeaponAttackState(weaponSummary(), { targetCount: 0 });
    assert.equal(preview.status, "valid");
    assert.equal(preview.previewOnly, true, "no target → valid preview-only roll");
    console.log("  ✓ weapon/attacks/equip/ammo/multi-target gates in order; no-target preview");
}

console.log("weapon-state.getWeaponAttackState: range bands (ranged)...");
{
    const bow = weaponSummary({ activeAttackType: "ranged", shortRange: 3, longRange: 6, maxRange: 10 });
    const shooter = tokenAt(0, 0);
    const verdictAt = (col) => getWeaponAttackState(bow, { token: shooter, primaryTarget: tokenAt(col, 0) });
    assert.equal(verdictAt(2).status, "valid");
    assert.ok(verdictAt(2).label.startsWith("Short range"));
    assert.ok(verdictAt(5).label.startsWith("Long range"), "long band legal (disadvantaged)");
    assert.equal(verdictAt(8).status, "invalid", "beyond long range: no direct attack");
    assert.ok(verdictAt(8).label.startsWith("Beyond long range"));
    assert.ok(verdictAt(12).label.startsWith("Out of range"));
    assert.equal(verdictAt(2).distanceSquares, 2, "distance carried on the verdict");
    console.log("  ✓ short/long legal, beyond-long and out-of-range illegal");
}

console.log("weapon-state.getWeaponAttackState: melee reach...");
{
    const shooter = tokenAt(0, 0);
    // No explicit reach → canonical melee default (1,1).
    const sword = weaponSummary();
    assert.equal(getWeaponAttackState(sword, { token: shooter, primaryTarget: tokenAt(1, 1) }).status, "valid", "diagonal adjacency is reach 1 (Chebyshev)");
    assert.equal(getWeaponAttackState(sword, { token: shooter, primaryTarget: tokenAt(2, 0) }).status, "invalid");
    // Reach weapon (1-2): hits at 2.
    const spear = weaponSummary({ minReach: 1, maxReach: 2 });
    assert.equal(getWeaponAttackState(spear, { token: shooter, primaryTarget: tokenAt(2, 0) }).status, "valid");
    // Min-reach 2 weapon can't strike an adjacent target.
    const pike = weaponSummary({ minReach: 2, maxReach: 3 });
    assert.equal(getWeaponAttackState(pike, { token: shooter, primaryTarget: tokenAt(1, 0) }).status, "invalid", "too close for a min-reach 2 weapon");
    // Large token: nearest-edge footprint distance (battle-flow §12 #4).
    const giant = tokenAt(0, 0, 2); // occupies (0,0)-(1,1)
    assert.equal(getWeaponAttackState(sword, { token: giant, primaryTarget: tokenAt(2, 0) }).status, "valid", "2×2 attacker reaches the tile touching its footprint");
    console.log("  ✓ melee default (1,1), reach bands, min-reach floor, 2×2 footprint");
}

console.log("weapon-state.getChebyshevDistanceSquares...");
{
    assert.equal(getChebyshevDistanceSquares(tokenAt(0, 0), tokenAt(3, 1)), 3, "Chebyshev max-axis");
    assert.equal(getChebyshevDistanceSquares(tokenAt(0, 0, 2), tokenAt(2, 2)), 1, "footprint nearest-edge for 2×2");
    assert.equal(getChebyshevDistanceSquares(tokenAt(1, 1), tokenAt(1, 1)), 0);
    console.log("  ✓ nearest-edge footprint Chebyshev");
}

console.log("weapon-state.getWeaponRangeBands / getWeaponReach (item parsing)...");
{
    const item = (props = {}, sourceData = {}) => ({
        system: { props },
        flags: { "1547Core": { sourceData } },
    });
    // Item props win when usable; source fills in when props are absent.
    assert.deepEqual(
        getWeaponRangeBands(item({ ShortRange: 3, LongRange: 6, MaxRange: 10 }, { shortRange: 1, longRange: 2, maxRange: 3 })),
        { shortRange: 3, longRange: 6, maxRange: 10 }
    );
    assert.deepEqual(
        getWeaponRangeBands(item({}, { shortRange: 1, longRange: 2, maxRange: 3 })),
        { shortRange: 1, longRange: 2, maxRange: 3 }
    );
    // Band ordering is normalized (long >= short, max >= long).
    assert.deepEqual(
        getWeaponRangeBands(item({ ShortRange: 5, LongRange: 2, MaxRange: 1 })),
        { shortRange: 5, longRange: 5, maxRange: 5 }
    );
    // Reach: a template-default (1,1) prop yields to a real source reach.
    assert.deepEqual(
        getWeaponReach(item({ MinReach: 1, MaxReach: 1 }, { minReach: 1, maxReach: 2 })),
        { minReach: 1, maxReach: 2 }
    );
    assert.deepEqual(
        getWeaponReach(item({ MinReach: 2, MaxReach: 3 }, { minReach: 1, maxReach: 2 })),
        { minReach: 2, maxReach: 3 },
        "an explicit non-default prop reach wins over source"
    );
    console.log("  ✓ props-over-source, normalization, template-default yielding");
}

console.log("weapon-state.getWeaponAttackProfiles / active profile...");
{
    const item = {
        system: { props: { Attack: "3dh", AttackB: "2dc", ActiveAttackProfile: "AttackB", AttackBAmmo: "bolt, stone" } },
        flags: { "1547Core": { sourceData: { attackProfiles: [
            { id: "p1", name: "Swing", attackType: "melee", dice: ["Heavy"] },
            { id: "p2", name: "Sling", attackType: "ranged", dice: ["Control"] },
        ] } } },
    };
    const profiles = getWeaponAttackProfiles(item);
    assert.equal(profiles.length, 2, "empty AttackC dropped");
    assert.equal(profiles[0].label, "Swing");
    assert.deepEqual(profiles[1].allowedAmmoTypes, ["bolt", "stone"]);
    assert.equal(getWeaponActiveAttackProfile(item).key, "AttackB", "ActiveAttackProfile selects");
    assert.equal(getWeaponActiveAttackProfile({ system: { props: { Attack: "3dh" } } }).key, "Attack", "defaults to first");
    console.log("  ✓ profile parsing, ammo lists, active selection + fallback");
}

console.log("weapon-state.buildFoundryAttackRollFormula / ammo probes...");
{
    assert.equal(buildFoundryAttackRollFormula(null), "", "no profile → empty");
    assert.equal(buildFoundryAttackRollFormula({ dice: [] }), "", "no dice → empty");
    assert.ok(buildFoundryAttackRollFormula({ dice: ["Heavy"] }).length > 0);
    const ammo = { system: { props: { AmmoType: "bolt", Quantity: "7" } }, flags: {} };
    assert.equal(getAmmoType(ammo), "bolt");
    assert.equal(getAmmoQuantity(ammo), 7);
    console.log("  ✓ formula emptiness contract + ammo type/quantity coercion");
}

console.log("\nAll weapon-state tests passed.");
