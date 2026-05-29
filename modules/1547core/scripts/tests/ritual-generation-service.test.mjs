import assert from "assert";

/**
 * Regression test for ritual-step RollTable resolution.
 *
 * Spells reference their step table by a stable source key (e.g.
 * "RitualSteps_Hard"). The upsert that creates the world RollTable cannot use
 * that key as the Foundry _id (underscores / >16 chars fail validation) and
 * names the table with a spaced display name ("Ritual Steps Hard"). The
 * resolver must therefore match on the `sourceKey` flag, not just _id / name.
 */

globalThis.foundry = { utils: { deepClone: (x) => (x === undefined ? x : JSON.parse(JSON.stringify(x))) } };
globalThis.fromUuid = async () => null;

function makeTables(list) {
    return {
        get: (id) => list.find((t) => t._id === id) ?? undefined,
        find: (fn) => list.find(fn) ?? null,
    };
}

const SPELL_TEMPLATE_ID = "2kiWw3Cv5Zk1lZxn";

function makeSpell(props) {
    return { name: "Test Spell", system: { template: SPELL_TEMPLATE_ID, props } };
}

// Mirrors a created world table: hashed _id, spaced display name, stable key in flags.
const hardTable = {
    _id: "AbCdEfGhIjKlMnOp",
    name: "Ritual Steps Hard",
    flags: {
        "1547Core": {
            sourceKey: "RitualSteps_Hard",
            sourceData: { entries: [{ id: "e1", stepType: "Material", stepText: "Gather grave soil" }] },
        },
    },
};

const { generateRitualStepsFromSpell } = await import("../services/ritual-generation-service.js");

console.log("ritual-generation-service: table resolution...");

{
    // References the table by its source key — not the Foundry _id or display name.
    globalThis.game = { tables: makeTables([hardTable]) };
    const result = await generateRitualStepsFromSpell(makeSpell({
        StaticRitualSteps: [],
        RitualStepTable: "RitualSteps_Hard",
        RandomStepRollFormula: "1d1", // count is always 1
    }));
    assert.strictEqual(result.drawCount, 1);
    assert.strictEqual(result.rolledSteps.length, 1);
    assert.strictEqual(result.rolledSteps[0].stepType, "Material");
    console.log("  ✓ resolves a RollTable by its sourceKey flag (RitualSteps_Hard)");
}

{
    // An unknown reference still surfaces a clear error.
    globalThis.game = { tables: makeTables([hardTable]) };
    await assert.rejects(
        () => generateRitualStepsFromSpell(makeSpell({
            StaticRitualSteps: [],
            RitualStepTable: "RitualSteps_Missing",
            RandomStepRollFormula: "1d1",
        })),
        /Could not resolve ritual step roll table/
    );
    console.log("  ✓ throws when the referenced table is absent");
}

console.log("\nAll ritual-generation-service tests passed.");
