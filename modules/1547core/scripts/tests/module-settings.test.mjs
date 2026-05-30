import assert from "assert";

/**
 * Unit tests for the pure data-seeding helpers in settings/module-settings.js.
 * These are the functions behind the rolltable-resolution bug class: Foundry-id
 * validation/derivation and the RollTable doc builders that now carry `sourceKey`.
 */

globalThis.foundry = {
    utils: { deepClone: (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v))) },
};

const {
    isValidFoundryId,
    deriveFoundryIdFromText,
    normalizeSourceEntry,
    mergeDefinedProps,
    buildRitualStepRollTableDoc,
    buildSpellFailureRollTableDoc,
} = await import("../settings/module-settings.js");

console.log("module-settings pure helpers...");

{
    assert.strictEqual(isValidFoundryId("AbCdEfGhIjKlMnOp"), true);
    assert.strictEqual(isValidFoundryId("RitualSteps_Hard"), false, "underscores are not valid Foundry ids");
    assert.strictEqual(isValidFoundryId("tooShort"), false);
    assert.strictEqual(isValidFoundryId(""), false);
    console.log("  ✓ isValidFoundryId: 16-char alphanumeric only");
}

{
    const id = deriveFoundryIdFromText("ritualStepRollTable:Ritual Steps Hard:");
    assert.match(id, /^[A-Za-z0-9]{16}$/, "derives a valid Foundry id");
    assert.strictEqual(deriveFoundryIdFromText("same"), deriveFoundryIdFromText("same"), "deterministic");
    assert.notStrictEqual(deriveFoundryIdFromText("a"), deriveFoundryIdFromText("b"));
    console.log("  ✓ deriveFoundryIdFromText: deterministic, valid-id output");
}

{
    const valid = normalizeSourceEntry({ _id: "AbCdEfGhIjKlMnOp", name: "X" }, "kind");
    assert.strictEqual(valid._id, "AbCdEfGhIjKlMnOp", "valid _id is preserved");
    assert.strictEqual(valid.uuid, "Item.AbCdEfGhIjKlMnOp");

    const asTable = normalizeSourceEntry({ _id: "AbCdEfGhIjKlMnOp" }, "kind", "RollTable");
    assert.strictEqual(asTable.uuid, "RollTable.AbCdEfGhIjKlMnOp", "documentType drives the uuid prefix");

    const derived = normalizeSourceEntry({ id: "RitualSteps_Hard", name: "Ritual Steps Hard" }, "ritualStepRollTable", "RollTable");
    assert.strictEqual(isValidFoundryId(derived._id), true, "an invalid key is replaced with a derived valid id");
    assert.strictEqual(derived._id, derived.id);
    assert.strictEqual(derived.uuid, `RollTable.${derived._id}`);
    console.log("  ✓ normalizeSourceEntry: preserves valid ids, derives for invalid keys");
}

{
    assert.deepStrictEqual(
        mergeDefinedProps({ a: 1, b: 2 }, { b: 3, c: undefined }),
        { a: 1, b: 3 },
        "undefined override values are skipped"
    );
    console.log("  ✓ mergeDefinedProps: only defined overrides win");
}

{
    // The sourceKey fix: spells reference tables by key, so the built doc must
    // retain the source key even though the _id is a derived hash.
    const doc = buildRitualStepRollTableDoc(
        { id: "RitualSteps_Hard", name: "Ritual Steps Hard", entries: [{ id: "e1", stepText: "Gather soil" }, { id: "e2", stepText: "Wait" }] },
        "folder-1",
        "Spells/Ritual"
    );
    assert.strictEqual(doc.name, "Ritual Steps Hard", "human-readable name is kept");
    assert.strictEqual(doc.flags["1547Core"].sourceKey, "RitualSteps_Hard", "stable lookup key is preserved");
    assert.strictEqual(isValidFoundryId(doc._id), true, "doc gets a valid derived id");
    assert.strictEqual(doc.results.length, 2);
    assert.strictEqual(doc.formula, "1d2");

    const failure = buildSpellFailureRollTableDoc(
        { id: "SpellFailure_Minor", name: "Spell Failure Minor", entries: [{ id: "f1", resultText: "Fizzle" }] },
        "folder-2",
        "Spells/Failure"
    );
    assert.strictEqual(failure.flags["1547Core"].sourceKey, "SpellFailure_Minor");
    console.log("  ✓ build*RollTableDoc: carries sourceKey for key-based resolution");
}

{
    // pruneDuplicateTemplates deletes wrong-_id duplicates (same name, random _id
    // left over from pre-keepId runs) and orphans of removed templates.
    const { pruneDuplicateTemplates } = await import("../settings/module-settings.js");

    const worldItems = [
        // canonical — keep
        { id: "WmP9Ld3Qs7Nk2FvR", name: "WeaponModifierTemplate", type: "_equippableItemTemplate" },
        // duplicate of WeaponModifierTemplate with a random _id — delete
        { id: "RandomXXXXXXXXXX", name: "WeaponModifierTemplate", type: "_equippableItemTemplate" },
        // obsolete (removed from source) — delete
        { id: "OldRecipeIdXXXXX", name: "RecipeTemplate", type: "_equippableItemTemplate" },
        // unrelated user content — keep
        { id: "UserTemplate1234", name: "Chargen Option Template", type: "_equippableItemTemplate" },
        // wrong type (not a CSB template) — keep
        { id: "RegularItemXXXXX", name: "WeaponModifierTemplate", type: "equippableItem" },
    ];
    const deleted = [];
    globalThis.game = { items: { filter: (fn) => worldItems.filter(fn) } };
    globalThis.Item = { deleteDocuments: async (ids) => { deleted.push(...ids); } };

    const canonicalDocs = [
        { _id: "WmP9Ld3Qs7Nk2FvR", name: "WeaponModifierTemplate" },
        { _id: "2kiWw3Cv5Zk1lZxn", name: "SpellTemplate" },
    ];
    const result = await pruneDuplicateTemplates(canonicalDocs);
    assert.deepStrictEqual(deleted.sort(), ["OldRecipeIdXXXXX", "RandomXXXXXXXXXX"]);
    assert.strictEqual(result.removed, 2);

    delete globalThis.game;
    delete globalThis.Item;
    console.log("  ✓ pruneDuplicateTemplates: deletes wrong-id duplicates and removed-template orphans, preserves unrelated content");
}

{
    // refreshActorItemBodiesFromTemplates: walks actor items, refreshes body/
    // header/display/hidden/templateSystemUniqueVersion from the canonical
    // template, preserves props (and other system fields via toObject), skips
    // items whose body already matches and items whose template is unrelated.
    const { refreshActorItemBodiesFromTemplates } = await import("../settings/module-settings.js");

    const templateDocs = [
        { _id: "TPL1", system: { body: { contents: ["new"] }, header: {}, display: {}, hidden: [], templateSystemUniqueVersion: "v2" } },
    ];

    const stale = {
        id: "stale1",
        system: { template: "TPL1", body: { contents: ["old"] }, header: {}, display: {}, hidden: [], props: { keep: "yes" }, templateSystemUniqueVersion: "v1" },
        toObject() { return JSON.parse(JSON.stringify({ _id: this.id, system: this.system })); },
    };
    const fresh = {
        id: "fresh1",
        system: { template: "TPL1", body: { contents: ["new"] }, header: {}, display: {}, hidden: [], props: {}, templateSystemUniqueVersion: "v2" },
        toObject() { return JSON.parse(JSON.stringify({ _id: this.id, system: this.system })); },
    };
    const unrelated = {
        id: "other",
        system: { template: "OTHER", body: { contents: ["x"] } },
        toObject() { return JSON.parse(JSON.stringify({ _id: this.id, system: this.system })); },
    };

    const calls = [];
    const actor = {
        items: { contents: [stale, fresh, unrelated] },
        updateEmbeddedDocuments: async (type, list, opts) => { calls.push({ type, list, opts }); },
    };

    const result = await refreshActorItemBodiesFromTemplates(templateDocs, [actor]);
    assert.strictEqual(result.refreshedItems, 1, "only the stale item is refreshed");
    assert.strictEqual(result.touchedActors, 1);
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].type, "Item");
    assert.strictEqual(calls[0].opts.recursive, false);
    assert.strictEqual(calls[0].list[0]._id, "stale1");
    assert.deepStrictEqual(calls[0].list[0].system.body, { contents: ["new"] }, "body refreshed from template");
    assert.strictEqual(calls[0].list[0].system.props.keep, "yes", "props preserved via toObject()");
    assert.strictEqual(calls[0].list[0].system.templateSystemUniqueVersion, "v2");
    console.log("  ✓ refreshActorItemBodiesFromTemplates: refreshes stale bodies, preserves props, skips up-to-date and unrelated items");
}

console.log("\nAll module-settings pure-helper tests passed.");
