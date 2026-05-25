import assert from "assert";

/**
 * Tests for combat/ammo-state.mjs.
 *
 * Pure helpers are tested with literal fixtures. Patch-returners are
 * tested by asserting on the returned `{ patches, result }` shape —
 * no mock .update() calls, no fake Foundry needed beyond shaped
 * weapon/ammo descriptors.
 *
 * This is the test surface the combat-resolver orchestrator can rely
 * on: if these pass, the only thing left to verify in-Foundry is the
 * patch dispatcher.
 */

const {
    getAllowedAmmoTypes,
    validateAmmoCompatibility,
    resolveLoadedAmmoForAttack,
    planLoadWeaponAmmo,
    planConsumeLoadedAmmo,
    planSpendLoadedAmmo,
} = await import("../combat/ammo-state.mjs");

// ────────────────────────────────────────────── pure helpers ──

console.log("getAllowedAmmoTypes...");

assert.deepStrictEqual(
    getAllowedAmmoTypes({ ammoType: "arrow" }, null),
    ["arrow"],
    "falls back to weapon.ammoType when profile has none"
);
assert.deepStrictEqual(
    getAllowedAmmoTypes({ ammoType: "arrow" }, { allowedAmmoTypes: ["bolt", "stone"] }),
    ["bolt", "stone"],
    "profile.allowedAmmoTypes wins over weapon.ammoType"
);
assert.deepStrictEqual(getAllowedAmmoTypes({}, {}), [], "empty when neither provides");
console.log("  ✓ profile > weapon, empty when neither");

console.log("\nvalidateAmmoCompatibility...");

{
    const v = validateAmmoCompatibility({
        weapon: { name: "Bow", ammoType: "arrow" },
        profile: null,
        ammo: { name: "Arrow", ammoType: "arrow", quantity: 5 },
    });
    assert.strictEqual(v.valid, true);
    assert.deepStrictEqual(v.allowedAmmoTypes, ["arrow"]);
    console.log("  ✓ valid: matching types, quantity > 0");
}

{
    const v = validateAmmoCompatibility({
        weapon: { name: "Bow", ammoType: "arrow" },
        ammo: { name: "Stone", ammoType: "stone", quantity: 5 },
    });
    assert.strictEqual(v.valid, false);
    assert.match(v.reason, /not compatible/);
    console.log("  ✓ invalid: ammoType mismatch surfaces reason");
}

{
    const v = validateAmmoCompatibility({
        weapon: { name: "Bow", ammoType: "arrow" },
        ammo: { name: "Arrow", ammoType: "arrow", quantity: 0 },
        requireQuantity: true,
    });
    assert.strictEqual(v.valid, false);
    assert.match(v.reason, /out of ammunition/);
    console.log("  ✓ invalid: requireQuantity catches quantity 0");
}

{
    const v = validateAmmoCompatibility({
        weapon: { name: "Bow", ammoType: "arrow" },
        ammo: { name: "Arrow", ammoType: "arrow", quantity: 0 },
        requireQuantity: false,
    });
    assert.strictEqual(v.valid, true,
        "requireQuantity:false used by resolveLoadedAmmoForAttack — ammo can be loaded but empty");
    console.log("  ✓ requireQuantity:false skips the empty check");
}

console.log("\nresolveLoadedAmmoForAttack...");

{
    const out = resolveLoadedAmmoForAttack({
        actor: null,
        weapon: { name: "Sword", ammoType: "", usesAmmo: false },
        profile: null,
    });
    assert.strictEqual(out.loadedAmmo, null,
        "non-ammo weapons return null loadedAmmo");
    console.log("  ✓ non-ammo weapons: loadedAmmo=null");
}

{
    assert.throws(
        () => resolveLoadedAmmoForAttack({
            actor: { items: { get: () => null } },
            weapon: { name: "Bow", usesAmmo: true, loadedAmmoId: "" },
            profile: null,
        }),
        /requires loaded ammunition/
    );
    console.log("  ✓ throws when usesAmmo but no loadedAmmoId");
}

// ────────────────────────────────────────────── patch-returners ──

function fakeItem({ id, props = {}, sourceData = {} }) {
    return {
        id,
        _id: id,
        system: { props },
        flags: { "1547Core": { sourceData: { name: id, _id: id, id, ...sourceData } } },
    };
}
function fakeActor({ id = "actor-1", items = [] } = {}) {
    const m = new Map(items.map((i) => [i.id, i]));
    return { id, items: { get: (id) => m.get(id) ?? null } };
}

console.log("\nplanLoadWeaponAmmo...");

{
    const ammo = fakeItem({
        id: "ammo-1",
        props: { Quantity: 5, AmmoType: "arrow" },
        sourceData: { ammoType: "arrow", quantity: 5 },
    });
    const weapon = fakeItem({
        id: "weapon-1",
        props: { AmmoType: "arrow", AmmoCapacity: 1, UsesAmmo: true },
        sourceData: { ammoType: "arrow", usesAmmo: true, ammoCapacity: 1 },
    });
    const actor = fakeActor({ id: "actor-1", items: [weapon, ammo] });

    const { patches, result } = planLoadWeaponAmmo({ actor, weapon, ammoItem: ammo });

    assert.strictEqual(patches.length, 2, "two patches: decrement ammo Quantity, set weapon LoadedAmmoId+AmmoLoaded");
    assert.deepStrictEqual(patches[0], {
        kind: "item.update",
        actorId: "actor-1",
        itemId: "ammo-1",
        data: { "system.props.Quantity": 4 },
    });
    assert.strictEqual(patches[1].kind, "item.update");
    assert.strictEqual(patches[1].itemId, "weapon-1");
    assert.strictEqual(patches[1].data["system.props.LoadedAmmoId"], "ammo-1");
    assert.strictEqual(patches[1].data["system.props.AmmoLoaded"], 1);
    assert.strictEqual(result.remainingQuantity, 4);
    assert.strictEqual(result.loadedAmmoId, "ammo-1");
    console.log("  ✓ produces ammo-decrement + weapon-load patches; result reports both");
}

{
    const ammo = fakeItem({
        id: "ammo-bad",
        props: { Quantity: 5, AmmoType: "stone" },
        sourceData: { ammoType: "stone", quantity: 5 },
    });
    const weapon = fakeItem({
        id: "weapon-1",
        props: { AmmoType: "arrow", AmmoCapacity: 1, UsesAmmo: true },
        sourceData: { ammoType: "arrow", usesAmmo: true, ammoCapacity: 1 },
    });
    const actor = fakeActor({ items: [weapon, ammo] });
    assert.throws(
        () => planLoadWeaponAmmo({ actor, weapon, ammoItem: ammo }),
        /not compatible/
    );
    console.log("  ✓ throws on incompatible ammo type (no patches produced)");
}

{
    const ammo = fakeItem({
        id: "ammo-empty",
        props: { Quantity: 0, AmmoType: "arrow" },
        sourceData: { ammoType: "arrow", quantity: 0 },
    });
    const weapon = fakeItem({
        id: "weapon-1",
        props: { AmmoType: "arrow", AmmoCapacity: 1, UsesAmmo: true },
        sourceData: { ammoType: "arrow", usesAmmo: true, ammoCapacity: 1 },
    });
    const actor = fakeActor({ items: [weapon, ammo] });
    assert.throws(
        () => planLoadWeaponAmmo({ actor, weapon, ammoItem: ammo }),
        /out of ammunition/
    );
    console.log("  ✓ throws when source ammo Quantity is 0");
}

console.log("\nplanConsumeLoadedAmmo...");

{
    const weapon = fakeItem({
        id: "weapon-1",
        props: { AmmoLoaded: 1, LoadedAmmoId: "ammo-1", UsesAmmo: true },
        sourceData: { ammoLoaded: 1, loadedAmmoId: "ammo-1", usesAmmo: true },
    });
    weapon.itemDocument = weapon; // self-ref so the plan finds it
    const actor = fakeActor({ items: [weapon] });

    const { patches, result } = planConsumeLoadedAmmo({
        actor,
        weapon: { ...weapon, usesAmmo: true, ammoLoaded: 1, _id: "weapon-1", itemDocument: weapon },
        loadedAmmo: { _id: "ammo-1", quantity: 4 },
    });

    assert.strictEqual(patches.length, 1);
    assert.strictEqual(patches[0].kind, "item.update");
    assert.strictEqual(patches[0].itemId, "weapon-1");
    assert.strictEqual(patches[0].data["system.props.AmmoLoaded"], 0);
    assert.strictEqual(patches[0].data["system.props.LoadedAmmoId"], "",
        "when AmmoLoaded hits 0, LoadedAmmoId is cleared");
    assert.strictEqual(result.ammoLoaded, 0);
    console.log("  ✓ decrements AmmoLoaded; clears LoadedAmmoId when it reaches 0");
}

{
    const out = planConsumeLoadedAmmo({
        actor: fakeActor(),
        weapon: { usesAmmo: false },
        loadedAmmo: null,
    });
    assert.deepStrictEqual(out, { patches: [], result: null },
        "non-ammo weapon: no-op, never throws (matches original consumeLoadedAmmo permissiveness)");
    console.log("  ✓ non-ammo weapon: no-op");
}

console.log("\nAll combat/ammo-state.mjs tests passed.");
