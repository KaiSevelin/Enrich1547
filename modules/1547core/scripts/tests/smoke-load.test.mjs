import assert from "assert";

/**
 * Smoke-load test.
 *
 * Imports every file under `scripts/services/` and `scripts/combat/`
 * and asserts each one parses + binds without throwing. This catches
 * the class of bug the unit tests can't see, because they import
 * individual pure modules in isolation:
 *
 *   - duplicate identifier declarations between imports and local
 *     `function` definitions (broke combat-resolver-service 0.0.95
 *     → 0.1.2; surfaced as
 *     `SyntaxError: Identifier 'firstFiniteNumber' has already
 *      been declared` at live module load)
 *   - missing imports / wrong paths after a relocation
 *   - re-introduced cyclic deps
 *
 * Stubs the minimal Foundry surface (`game`, `Hooks`, `CONFIG`, `ui`)
 * that some services touch in top-level code. The smoke test doesn't
 * invoke any `register*` functions — just verifies the module body
 * parses + the imports resolve.
 */

if (typeof globalThis.game === "undefined") {
    globalThis.game = {
        modules: { get: () => ({ api: {} }) },
        actors: new Map(),
        items: new Map(),
        settings: { get: () => null, register: () => {} },
        packs: new Map(),
        user: { isGM: true },
        combat: null,
    };
}
if (typeof globalThis.Hooks === "undefined") {
    globalThis.Hooks = { on: () => {}, once: () => {}, off: () => {}, callAll: () => {} };
}
if (typeof globalThis.CONFIG === "undefined") {
    globalThis.CONFIG = { statusEffects: [] };
}
if (typeof globalThis.ui === "undefined") {
    globalThis.ui = { notifications: { warn: () => {}, info: () => {}, error: () => {} } };
}
if (typeof globalThis.canvas === "undefined") {
    globalThis.canvas = { tokens: { controlled: [] } };
}
if (typeof globalThis.foundry === "undefined") {
    class StubApplicationV2 {
        static DEFAULT_OPTIONS = {};
        static PARTS = {};
    }
    const HandlebarsApplicationMixin = (base) => class extends base {};
    globalThis.foundry = {
        utils: {
            deepClone: (v) => JSON.parse(JSON.stringify(v)),
            mergeObject: (a, b) => Object.assign({}, a, b),
        },
        applications: {
            api: { ApplicationV2: StubApplicationV2, HandlebarsApplicationMixin },
        },
    };
}
if (typeof globalThis.Application === "undefined") {
    globalThis.Application = class { static get defaultOptions() { return {}; } };
}
if (typeof globalThis.Die === "undefined") {
    globalThis.Die = class { constructor() {} };
}

const SERVICE_FILES = [
    "combat-events.js",
    "event-bus.js",
    "reaction-service.js",
    "primary-stats.js",
    "boost-service.js",
    "tier-display-service.js",
    "changeset-drop-hook.js",
    "item-grant-service.js",
    "monster-image-resolver-service.js",
    "rolltable-resolution-service.js",
    "combat-resolver-service.js",
    "csb-container-helpers.mjs",
    "composition-service.mjs",
    "monster-wizard-service.js",
    "compendium-import-hook.js",
    "skill-tree/node-logic.js",
    "skill-tree/node-editor.js",
    "skill-tree/skill-tree-service.js",
];

// Dice die-type classes — these are self-contained (no dice-so-nice import).
// The main dice/dice1547.js is exercised only in Foundry runtime since it
// imports from a sibling module (`dice-so-nice`) that does not exist in node.
const DICE_FILES = [
    "armor.js",
    "balanced.js",
    "control.js",
    "evade.js",
    "finesse.js",
    "heavy.js",
    "lethality.js",
    "multiplier.js",
    "penetration.js",
    "risk.js",
];

const COMBAT_FILES = [
    "resolver.mjs",
    "pool-builder.mjs",
    "maneuver-legality.mjs",
    "ammo-state.mjs",
    "normalisation.mjs",
    "persistent-effects.mjs",
    "hp-state.mjs",
    "reaction-candidates.mjs",
    "maneuver-state.mjs",
    "attack-lifecycle.mjs",
    "lifecycle-flow.mjs",
];

console.log("smoke-load: services/...");

for (const file of SERVICE_FILES) {
    let mod;
    try {
        mod = await import(`../services/${file}`);
    } catch (err) {
        assert.fail(`services/${file} failed to load: ${err.message}`);
    }
    assert.ok(mod, `services/${file} loaded but produced no module object`);
    const exportCount = Object.keys(mod).length;
    console.log(`  ✓ services/${file} (${exportCount} export${exportCount === 1 ? "" : "s"})`);
}

console.log("\nsmoke-load: combat/...");

for (const file of COMBAT_FILES) {
    let mod;
    try {
        mod = await import(`../combat/${file}`);
    } catch (err) {
        assert.fail(`combat/${file} failed to load: ${err.message}`);
    }
    assert.ok(mod);
    const exportCount = Object.keys(mod).length;
    console.log(`  ✓ combat/${file} (${exportCount} export${exportCount === 1 ? "" : "s"})`);
}

console.log("\nsmoke-load: dice/...");

for (const file of DICE_FILES) {
    let mod;
    try {
        mod = await import(`../dice/${file}`);
    } catch (err) {
        assert.fail(`dice/${file} failed to load: ${err.message}`);
    }
    assert.ok(mod);
    const exportCount = Object.keys(mod).length;
    console.log(`  ✓ dice/${file} (${exportCount} export${exportCount === 1 ? "" : "s"})`);
}

console.log("\nAll smoke-load checks passed.");
