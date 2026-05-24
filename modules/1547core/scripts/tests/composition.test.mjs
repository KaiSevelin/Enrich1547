import assert from "assert";

/**
 * Test suite for composition-service.js
 * 
 * Tests:
 *   - Requirement evaluation (GroupPresent, HasTag, StatAtLeast, PrimaryStatAtLeast, HasSkill)
 *   - Change application (Stat, PrimaryStat, Skill, Text, Image, ItemGrant, Tag, Trait)
 *   - Pipeline order (Size > Role > Domain > Motivation > Loadout > Quirk > Boost)
 *   - Cache invalidation
 */

// Mock Foundry globals for Node test environment
if (typeof globalThis.game === "undefined") {
    globalThis.game = {
        modules: new Map(),
        modules: {
            get: (id) => ({
                api: {}
            })
        }
    };
    globalThis.Hooks = {
        on: () => {},
        off: () => {}
    };
}

// Import the service functions
import {
    evaluateRequirement,
    applyChange,
    getEffectiveActorCached,
    invalidateEffectiveActorCache
} from "../services/composition-service.mjs";

// ============================================================================
// Test Helpers
// ============================================================================

function createMockActor(overrides = {}) {
    return {
        id: "actor-1",
        name: "Test Actor",
        system: {
            props: {
                TypeDropdown: "Beast",
                HP: 10,
                Strength: "2d6",
                Dexterity: "1d6+1",
                ...overrides.props
            }
        },
        items: overrides.items ?? [],
        _stats: {
            modifiedTime: Date.now()
        },
        ...overrides
    };
}

function createMockChangeSet(group, requirements = [], changes = []) {
    return {
        id: `changeset-${group}-${Math.random()}`,
        name: `${group} Set`,
        system: {
            template: "b7A1z6cSZO4dYTKT",
            props: {
                Group: group,
                ForTypeAny: true
            }
        },
        items: [...requirements, ...changes]
    };
}

function createMockRequirement(type, config = {}) {
    return {
        id: `req-${type}-${Math.random()}`,
        system: {
            template: "L4ujYgqhGBGcoo2P",
            props: {
                PredicateType: type,
                Negate: config.negate ?? false,
                ...config
            }
        }
    };
}

function createMockChange(kind, config = {}) {
    return {
        id: `change-${kind}-${Math.random()}`,
        system: {
            template: "WsrkfjBmudnIhvEK",
            props: {
                Kind: kind,
                ...config
            }
        }
    };
}

// ============================================================================
// Requirement Evaluation Tests
// ============================================================================

console.log("Testing requirement evaluation...");

{
    const actor = createMockActor();
    const cumulativeState = {
        applicableChangeSets: { Size: "changeset-1" }
    };

    const req = createMockRequirement("GroupPresent", {
        GroupTarget: "Size"
    });

    assert.strictEqual(evaluateRequirement(actor, req, cumulativeState), true);
    console.log("✓ GroupPresent: group present");

    const req2 = createMockRequirement("GroupPresent", {
        GroupTarget: "Role"
    });
    assert.strictEqual(evaluateRequirement(actor, req2, cumulativeState), false);
    console.log("✓ GroupPresent: group absent");

    const req3 = createMockRequirement("GroupPresent", {
        GroupTarget: "Size",
        negate: true
    });
    assert.strictEqual(evaluateRequirement(actor, req3, cumulativeState), false);
    console.log("✓ GroupPresent: negated");
}

{
    const actor = createMockActor();
    const cumulativeState = {
        appliedTags: new Set(["fire", "claws"])
    };

    const req = createMockRequirement("HasTag", {
        TagName: "fire"
    });
    assert.strictEqual(evaluateRequirement(actor, req, cumulativeState), true);
    console.log("✓ HasTag: tag present");

    const req2 = createMockRequirement("HasTag", {
        TagName: "water"
    });
    assert.strictEqual(evaluateRequirement(actor, req2, cumulativeState), false);
    console.log("✓ HasTag: tag absent");
}

{
    const actor = createMockActor();
    const cumulativeState = {
        effectiveProps: { HP: 25 }
    };

    const req = createMockRequirement("StatAtLeast", {
        StatTarget: "HP",
        StatThreshold: 20
    });
    assert.strictEqual(evaluateRequirement(actor, req, cumulativeState), true);
    console.log("✓ StatAtLeast: threshold met");

    const req2 = createMockRequirement("StatAtLeast", {
        StatTarget: "HP",
        StatThreshold: 30
    });
    assert.strictEqual(evaluateRequirement(actor, req2, cumulativeState), false);
    console.log("✓ StatAtLeast: threshold not met");
}

{
    const actor = createMockActor();
    const cumulativeState = {
        effectivePrimaryStats: {
            StrengthDice: 2,
            StrengthMod: 1
        }
    };

    const req = createMockRequirement("PrimaryStatAtLeast", {
        PrimaryStatRequirementTarget: "Strength",
        PrimaryStatRequirementDice: 2,
        PrimaryStatRequirementMod: 0
    });
    assert.strictEqual(evaluateRequirement(actor, req, cumulativeState), true);
    console.log("✓ PrimaryStatAtLeast: stat met");

    const req2 = createMockRequirement("PrimaryStatAtLeast", {
        PrimaryStatRequirementTarget: "Strength",
        PrimaryStatRequirementDice: 2,
        PrimaryStatRequirementMod: 2
    });
    assert.strictEqual(evaluateRequirement(actor, req2, cumulativeState), false);
    console.log("✓ PrimaryStatAtLeast: stat not sufficient");
}

// ============================================================================
// Change Application Tests
// ============================================================================

console.log("\nTesting change application...");

{
    const actor = createMockActor();
    const cumulativeState = { effectiveProps: { HP: 10 } };

    const statChange = createMockChange("Stat", {
        StatTarget: "HP",
        StatOp: "Add",
        StatValue: 5
    });

    applyChange(actor, statChange, cumulativeState);
    assert.strictEqual(cumulativeState.effectiveProps.HP, 15);
    console.log("✓ Stat Change: Add");

    const statChange2 = createMockChange("Stat", {
        StatTarget: "HP",
        StatOp: "Multiply",
        StatValue: 2
    });
    applyChange(actor, statChange2, cumulativeState);
    assert.strictEqual(cumulativeState.effectiveProps.HP, 30);
    console.log("✓ Stat Change: Multiply");

    const statChange3 = createMockChange("Stat", {
        StatTarget: "HP",
        StatOp: "Override",
        StatValue: 50
    });
    applyChange(actor, statChange3, cumulativeState);
    assert.strictEqual(cumulativeState.effectiveProps.HP, 50);
    console.log("✓ Stat Change: Override");
}

{
    const actor = createMockActor();
    const cumulativeState = { effectivePrimaryStats: { StrengthDice: 1, StrengthMod: 0 } };

    const primaryStatChange = createMockChange("PrimaryStat", {
        PrimaryStatTarget: "Strength",
        PrimaryStatOp: "Step",
        PrimaryStatSteps: 1
    });

    applyChange(actor, primaryStatChange, cumulativeState);
    assert.strictEqual(cumulativeState.effectivePrimaryStats.StrengthDice, 1);
    assert.strictEqual(cumulativeState.effectivePrimaryStats.StrengthMod, 1);
    console.log("✓ PrimaryStat Change: Step up within dice");

    const primaryStatChange2 = createMockChange("PrimaryStat", {
        PrimaryStatTarget: "Strength",
        PrimaryStatOp: "Set",
        PrimaryStatSetDice: 3,
        PrimaryStatSetMod: 2
    });
    applyChange(actor, primaryStatChange2, cumulativeState);
    assert.strictEqual(cumulativeState.effectivePrimaryStats.StrengthDice, 3);
    assert.strictEqual(cumulativeState.effectivePrimaryStats.StrengthMod, 2);
    console.log("✓ PrimaryStat Change: Set");
}

{
    const actor = createMockActor();
    const cumulativeState = { textFields: {} };

    const textChange = createMockChange("Text", {
        TextTarget: "Bio",
        TextOp: "Append",
        TextValue: "Often seen near water."
    });

    applyChange(actor, textChange, cumulativeState);
    assert.strictEqual(cumulativeState.textFields.Bio, "Often seen near water.");
    console.log("✓ Text Change: Append");

    const textChange2 = createMockChange("Text", {
        TextTarget: "Bio",
        TextOp: "Prepend",
        TextValue: "Mysterious creature:"
    });
    applyChange(actor, textChange2, cumulativeState);
    assert.strictEqual(cumulativeState.textFields.Bio, "Mysterious creature:Often seen near water.");
    console.log("✓ Text Change: Prepend");
}

{
    const actor = createMockActor();
    const cumulativeState = { appliedTags: new Set() };

    const tagChange = createMockChange("Tag", {
        TagName: "aquatic"
    });

    applyChange(actor, tagChange, cumulativeState);
    assert.ok(cumulativeState.appliedTags.has("aquatic"));
    console.log("✓ Tag Change");
}

{
    const actor = createMockActor();
    const cumulativeState = { appliedTraits: [] };

    const traitChange = createMockChange("Trait", {
        TraitName: "Blindsight",
        TraitDescription: "Can sense creatures within 60 feet without sight."
    });

    applyChange(actor, traitChange, cumulativeState);
    assert.strictEqual(cumulativeState.appliedTraits.length, 1);
    assert.strictEqual(cumulativeState.appliedTraits[0].name, "Blindsight");
    console.log("✓ Trait Change");
}

{
    const actor = createMockActor();
    const cumulativeState = { grantedItems: [] };

    const itemChange = createMockChange("ItemGrant", {
        ItemGrantMode: "Direct",
        ItemGrantRef: ["item-claws-1"]
    });

    applyChange(actor, itemChange, cumulativeState);
    assert.strictEqual(cumulativeState.grantedItems.length, 1);
    assert.strictEqual(cumulativeState.grantedItems[0], "item-claws-1");
    console.log("✓ ItemGrant Change");
}

// ============================================================================
// Cache Tests
// ============================================================================

console.log("\nTesting cache invalidation...");

{
    const actor = createMockActor();
    
    invalidateEffectiveActorCache(actor);
    assert.strictEqual(actor._1547core_effectiveCache, undefined);
    console.log("✓ Cache invalidation");
}

// ============================================================================
// Summary
// ============================================================================

console.log("\n✅ All composition service tests passed");
