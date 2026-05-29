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

console.log("\nAll weapon-modifier-attachment-service tests passed.");
