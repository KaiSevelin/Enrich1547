import assert from "assert";

/**
 * Test suite for monster-image-resolver-service.js
 *
 * Covers the resolution ladder (override → PortraitKey → Type:Domain:Role →
 * Type:Role → Type:Domain → Type → actor.img → mystery-man) against a mock
 * portrait registry, and applyResolvedMonsterImage's write behavior
 * (fills defaults, never clobbers hand-set art).
 */

const DEFAULT_IMAGE = "icons/svg/mystery-man.svg";

let registry = {};
if (typeof globalThis.game === "undefined") globalThis.game = {};
globalThis.game.modules = globalThis.game.modules ?? { get: () => ({ api: {} }) };
globalThis.game.settings = { get: (_scope, key) => (key === "portraitRegistry" ? registry : undefined) };
if (typeof globalThis.Hooks === "undefined") globalThis.Hooks = { on: () => {}, off: () => {} };

const { CHANGESET_TEMPLATE_ID } = await import("../lib/constants.mjs");
const { resolveMonsterImage, applyResolvedMonsterImage } = await import("../services/monster-image-resolver-service.js");

function changeSet(name, group) {
    return { name, system: { template: CHANGESET_TEMPLATE_ID, props: { Group: group } } };
}

function actor({ type, img = DEFAULT_IMAGE, tokenSrc = DEFAULT_IMAGE, items = [], flags = {} } = {}) {
    const updates = [];
    return {
        documentName: "Actor",
        img,
        flags,
        system: { props: { TypeDropdown: type ?? "" } },
        prototypeToken: { texture: { src: tokenSrc } },
        items,
        updates,
        async update(data) { updates.push(data); }
    };
}

// The wolf's actual composition: Beast type, "Wolf (Beast)" Role, "Wood
// (Beast)" Domain — mirrors the world's portrait registry keys.
registry = {
    "Beast": "art/beast.webp",
    "Beast:Wolf": "art/beast-wolf.webp",
    "Beast:Wood": "art/beast-wood.webp",
    "Named:Fenrir": "art/fenrir.webp"
};

console.log("resolveMonsterImage...");

{
    const a = actor({
        type: "Beast",
        items: [changeSet("Wolf (Beast)", "Role"), changeSet("Wood (Beast)", "Domain")]
    });
    assert.strictEqual(resolveMonsterImage(a), "art/beast-wolf.webp");
    console.log("  ✓ Wolf regression: Beast + Wolf role resolves to Beast:Wolf (Type:Role)");
}

{
    const a = actor({ type: "Beast", items: [changeSet("Wood (Beast)", "Domain")] });
    assert.strictEqual(resolveMonsterImage(a), "art/beast-wood.webp");
    console.log("  ✓ Falls to Type:Domain when no Role matches");
}

{
    const a = actor({ type: "Beast" });
    assert.strictEqual(resolveMonsterImage(a), "art/beast.webp");
    console.log("  ✓ Falls to bare Type");
}

{
    const a = actor({
        type: "Beast",
        items: [changeSet("Wolf (Beast)", "Role")],
        flags: { "1547core": { portraitOverride: "art/custom.webp" } }
    });
    assert.strictEqual(resolveMonsterImage(a), "art/custom.webp");
    console.log("  ✓ portraitOverride beats the registry");
}

{
    const a = actor({ type: "Beast", flags: { "1547core": { portraitKey: "Named:Fenrir" } } });
    assert.strictEqual(resolveMonsterImage(a), "art/fenrir.webp");
    console.log("  ✓ PortraitKey beats the composition cascade");
}

{
    const a = actor({ type: "Undead", img: "art/hand-set.webp" });
    assert.strictEqual(resolveMonsterImage(a), "art/hand-set.webp");
    console.log("  ✓ No registry hit falls back to actor.img");
}

{
    const a = actor({ type: "Undead" });
    assert.strictEqual(resolveMonsterImage(a), DEFAULT_IMAGE);
    console.log("  ✓ Nothing at all falls back to mystery-man");
}

console.log("\napplyResolvedMonsterImage...");

{
    // The wolf bug: wizard-created actor shipped with mystery-man portrait
    // and token even though the registry had Beast:Wolf. Apply must fill both.
    const a = actor({
        type: "Beast",
        items: [changeSet("Wolf (Beast)", "Role"), changeSet("Wood (Beast)", "Domain")]
    });
    const applied = await applyResolvedMonsterImage(a);
    assert.strictEqual(applied, "art/beast-wolf.webp");
    assert.deepStrictEqual(a.updates, [{
        img: "art/beast-wolf.webp",
        "prototypeToken.texture.src": "art/beast-wolf.webp"
    }]);
    console.log("  ✓ Fills default portrait AND prototype token from the registry");
}

{
    // Hand-set portrait must survive; only the still-default token is filled.
    const a = actor({ type: "Beast", img: "art/hand-set.webp" });
    const applied = await applyResolvedMonsterImage(a);
    assert.strictEqual(applied, "art/beast.webp");
    assert.deepStrictEqual(a.updates, [{ "prototypeToken.texture.src": "art/beast.webp" }]);
    console.log("  ✓ Never clobbers a hand-set portrait; still fills a default token");
}

{
    // Fully customized actor: nothing to do.
    const a = actor({ type: "Beast", img: "art/hand-set.webp", tokenSrc: "art/hand-token.webp" });
    const applied = await applyResolvedMonsterImage(a);
    assert.strictEqual(applied, null);
    assert.deepStrictEqual(a.updates, []);
    console.log("  ✓ No-op when portrait and token are both customized");
}

{
    // No registry hit and no art: leave the default alone (no pointless write).
    const a = actor({ type: "Undead" });
    const applied = await applyResolvedMonsterImage(a);
    assert.strictEqual(applied, null);
    assert.deepStrictEqual(a.updates, []);
    console.log("  ✓ No-op when the resolver only finds the default");
}

console.log("\nportrait-registry.json data shape...");

{
    // Regression: Setup Data seeded an empty registry for months because the
    // loader it used rejects non-array JSON — and portrait-registry.json is an
    // object. Pin the shipped file's shape here so the contract stays visible:
    // an object with a non-empty `registry` map of string keys → string paths.
    const fs = await import("fs");
    const url = new URL("../../foundry/Templates/portrait-registry.json", import.meta.url);
    const file = JSON.parse(fs.readFileSync(url, "utf8"));
    assert.ok(!Array.isArray(file), "file is an object, not an array (must load via #loadTemplate)");
    assert.ok(file.registry && typeof file.registry === "object", "has a registry map");
    const entries = Object.entries(file.registry);
    assert.ok(entries.length > 0, "registry is not empty");
    for (const [key, value] of entries) {
        assert.ok(typeof value === "string" && value.length > 0, `registry["${key}"] is a non-empty string path`);
    }
    assert.ok(file.registry["Beast:Wolf"], "Beast:Wolf entry exists (the wizard-wolf case)");
    console.log(`  ✓ Shipped registry parses: ${entries.length} entries, object shape`);
}

console.log("\nAll monster-image-resolver tests passed.");
