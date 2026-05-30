import assert from "assert";

const service = await import("../services/weapon-modifier-attachment-service.js");

function makeItem({
    id,
    name,
    template,
    itemType = null,
    stackKey = "",
    attachedModifierIds = [],
    system = {},
    flags = {},
    parent = null,
} = {}) {
    return {
        id,
        name,
        parent,
        system: {
            template,
            props: {},
            ...system,
        },
        flags: {
            "1547Core": {
                sourceData: {
                    _id: id,
                    id,
                    name,
                    ...(itemType ? { itemType } : {}),
                    ...(stackKey ? { stackKey } : {}),
                    ...(attachedModifierIds.length ? { attachedModifierIds } : {}),
                },
                ...(attachedModifierIds.length ? { attachedModifierIds } : {}),
            },
            ...flags,
        },
    };
}

function makeActor(items = []) {
    const actor = {
        documentName: "Actor",
        items: {
            get: (id) => items.find((entry) => entry.id === id) ?? null,
            contents: items,
        },
    };
    for (const item of items) item.parent = actor;
    return actor;
}

console.log("weapon-modifier-attachment-service...");

{
    const targetWeapon = makeItem({
        id: "weapon-1",
        name: "Knife",
        template: "qZCfLEYQ7egbm1B9",
    });
    const droppedModifier = makeItem({
        id: "modifier-1",
        name: "Poisoned",
        template: "WmP9Ld3Qs7Nk2FvR",
        itemType: "weaponModifier",
        system: { container: "weapon-1", props: {} },
    });
    const actor = makeActor([targetWeapon, droppedModifier]);

    const inferred = service.inferModifierAttachmentTarget(droppedModifier);
    assert.strictEqual(inferred?.id, "weapon-1");
    console.log("  ✓ infers attach target from dropped modifier system.container");
}

{
    const existingSilver = makeItem({
        id: "silver-1",
        name: "Silvered",
        template: "WmP9Ld3Qs7Nk2FvR",
        itemType: "weaponModifier",
        stackKey: "material",
    });
    const newColdIron = makeItem({
        id: "coldiron-1",
        name: "Cold Iron",
        template: "WmP9Ld3Qs7Nk2FvR",
        itemType: "weaponModifier",
        stackKey: "material",
    });
    const poison = makeItem({
        id: "poison-1",
        name: "Poisoned",
        template: "WmP9Ld3Qs7Nk2FvR",
        itemType: "weaponModifier",
        stackKey: "poison",
    });
    const targetWeapon = makeItem({
        id: "weapon-1",
        name: "Knife",
        template: "qZCfLEYQ7egbm1B9",
        attachedModifierIds: ["silver-1", "poison-1"],
    });
    const actor = makeActor([targetWeapon, existingSilver, newColdIron, poison]);

    const nextIds = service.computeAttachedModifierIds({
        actor,
        targetItem: targetWeapon,
        modifierItem: newColdIron,
    });

    assert.deepStrictEqual(nextIds, ["poison-1", "coldiron-1"]);
    console.log("  ✓ replaces existing modifier with same stackKey and preserves others");
}

{
    const silver = makeItem({
        id: "silver-1",
        name: "Silvered",
        template: "WmP9Ld3Qs7Nk2FvR",
        itemType: "weaponModifier",
        stackKey: "material",
    });
    const poison = makeItem({
        id: "poison-1",
        name: "Poisoned",
        template: "WmP9Ld3Qs7Nk2FvR",
        itemType: "weaponModifier",
        stackKey: "poison",
    });
    const targetAmmo = makeItem({
        id: "ammo-1",
        name: "Arrow",
        template: "389uqkKKn8M1SKux",
        attachedModifierIds: ["silver-1"],
    });
    const actor = makeActor([targetAmmo, silver, poison]);

    const nextIds = service.computeAttachedModifierIds({
        actor,
        targetItem: targetAmmo,
        modifierItem: poison,
    });

    assert.deepStrictEqual(nextIds, ["silver-1", "poison-1"]);
    console.log("  ✓ appends non-conflicting modifier stack");
}

{
    // getEffectiveUsesRemaining: returns null for non-uses durations and reads
    // the live `usesRemaining` flag in preference to the source initial value.
    const permanent = { flags: { "1547Core": { sourceData: { durationType: "Permanent" } } } };
    assert.strictEqual(service.getEffectiveUsesRemaining(permanent), null);

    const fresh = { flags: { "1547Core": { sourceData: { durationType: "Uses", durationValue: 3 } } } };
    assert.strictEqual(service.getEffectiveUsesRemaining(fresh), 3);

    const decremented = { flags: { "1547Core": { sourceData: { durationType: "Uses", durationValue: 3 }, usesRemaining: 1 } } };
    assert.strictEqual(service.getEffectiveUsesRemaining(decremented), 1);
    console.log("  ✓ getEffectiveUsesRemaining: null for permanent; flag overrides initial");
}

{
    // buildAttachedModifierSummary: pluralises 'use' / 'uses' correctly,
    // omits uses for non-uses modifiers, and skips unknown ids.
    const items = [
        { id: "poison", name: "Poisoned", flags: { "1547Core": { sourceData: { durationType: "Uses", durationValue: 3 } } } },
        { id: "silver", name: "Silvered", flags: { "1547Core": { sourceData: { durationType: "Permanent" } } } },
        { id: "blessed", name: "Blessed", flags: { "1547Core": { sourceData: { durationType: "Uses", durationValue: 5 }, usesRemaining: 1 } } },
    ];
    const actor = makeActor(items);
    assert.strictEqual(
        service.buildAttachedModifierSummary(actor, ["poison", "silver", "blessed"]),
        "Poisoned (3 uses), Silvered, Blessed (1 use)"
    );
    assert.strictEqual(
        service.buildAttachedModifierSummary(actor, ["poison", "ghost"]),
        "Poisoned (3 uses)",
        "unknown ids are skipped without throwing"
    );
    assert.strictEqual(service.buildAttachedModifierSummary(actor, []), "");
    console.log("  ✓ buildAttachedModifierSummary: name + (N uses), singular/plural, unknown ids skipped");
}

console.log("\nAll weapon-modifier-attachment-service tests passed.");
