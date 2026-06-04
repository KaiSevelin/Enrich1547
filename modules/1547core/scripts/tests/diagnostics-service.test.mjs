import assert from "assert";

/**
 * Unit tests for services/diagnostics-service.js. The report builder takes its
 * `game`/`canvas` via an injected env, so it runs in Node against mocks.
 */

const { buildDiagnosticsReport } = await import("../services/diagnostics-service.js");

function tablesMock(list) {
    return {
        size: list.length,
        get: (id) => list.find((t) => t._id === id),
        find: (fn) => list.find(fn) ?? null,
        filter: (fn) => list.filter(fn),
    };
}

function makeGame({ spellData = [], tables = [], summarizeActor, targets = [], settings = {} } = {}) {
    const store = { spellData, lastDataSetupAt: "2026-05-29T00:00:00.000Z", ...settings };
    return {
        version: "13.350",
        system: { id: "custom-system-builder", version: "5.2.0" },
        modules: {
            get: (id) => {
                if (id === "1547core") return { version: "0.2.10", active: true, api: summarizeActor ? { summarizeActor } : {} };
                if (id === "dice-so-nice") return { active: true };
                return undefined;
            },
        },
        settings: { get: (_mod, key) => store[key] },
        items: { size: 0, filter: () => [{ id: "2kiWw3Cv5Zk1lZxn", name: "SpellTemplate", type: "_equippableItemTemplate" }] },
        actors: { size: 0 },
        tables: tablesMock(tables),
        user: { targets: new Set(targets) },
    };
}

const tok = (name, actorName, type = "character") => ({
    name,
    id: `${name}-id`,
    actor: actorName ? { name: actorName, id: `${actorName}-id`, type } : null,
});

console.log("diagnostics-service report builder...");

{
    const game = makeGame({
        spellData: [
            { ritualStepTable: "RitualSteps_Hard", failureProfile: "Minor" },
            { ritualStepTable: "RitualSteps_Missing", failureProfile: "Major" },
        ],
        tables: [
            { _id: "hashRitualHard0", name: "Ritual Steps Hard", flags: { "1547Core": { sourceKey: "RitualSteps_Hard" } } },
            { _id: "hashFailMinor00", name: "Spell Failure Minor", flags: { "1547Core": { sourceKey: "SpellFailure_Minor" } } },
        ],
    });
    const report = buildDiagnosticsReport({ game, canvas: undefined });

    assert.strictEqual(report.errors.length, 0, "no section threw");
    assert.strictEqual(report.sections.environment.moduleVersion, "0.2.10");
    assert.strictEqual(report.sections.environment.diceSoNiceActive, true);
    assert.strictEqual(report.sections.seedData.counts.spellData, 2);

    const ritual = report.sections.tableResolution.ritualStepTables;
    assert.strictEqual(ritual.checked, 2);
    assert.strictEqual(ritual.resolved, 1, "RitualSteps_Hard resolves by sourceKey");
    assert.deepStrictEqual(ritual.unresolved, ["RitualSteps_Missing"]);
    assert.deepStrictEqual(report.sections.tableResolution.failureTables.unresolved, ["SpellFailure_Major"]);

    assert.strictEqual(report.sections.worldContent.templates.length, 1);
    assert.deepStrictEqual(report.sections.tokens, { controlledCount: 0, targetedCount: 0, controlled: [], targeted: [] });
    console.log("  ✓ environment, seed counts, table resolution by sourceKey, empty token report");
}

{
    // Two controlled (sources) + one targeted (defender): the multi-actor case.
    const summarizeActor = (actor, token) => ({ actorName: actor.name, tokenName: token.name });
    const game = makeGame({ summarizeActor, targets: [tok("DefTok", "Goblin")] });
    const canvas = { tokens: { controlled: [tok("AtkTok", "Hero"), tok("AllyTok", "Squire")] } };
    const report = buildDiagnosticsReport({ game, canvas });

    const t = report.sections.tokens;
    assert.strictEqual(t.controlledCount, 2);
    assert.strictEqual(t.targetedCount, 1);
    assert.deepStrictEqual(t.controlled.map((c) => c.hudSummary.actorName), ["Hero", "Squire"]);
    assert.strictEqual(t.targeted[0].hudSummary.actorName, "Goblin");
    assert.strictEqual(t.targeted[0].tokenName, "DefTok");
    console.log("  ✓ captures all controlled + all targeted tokens for multi-actor flows");
}

{
    // A throwing HUD summary on one token is captured per-token, not fatal.
    const summarizeActor = () => { throw new Error("boom in summary"); };
    const game = makeGame({ summarizeActor });
    const canvas = { tokens: { controlled: [tok("Tok", "Hero")] } };
    const report = buildDiagnosticsReport({ game, canvas });
    assert.match(report.sections.tokens.controlled[0].hudSummaryError, /boom in summary/);
    console.log("  ✓ a throwing HUD summary is captured as hudSummaryError per token");
}

console.log("\nAll diagnostics-service tests passed.");
