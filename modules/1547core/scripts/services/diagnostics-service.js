const MODULE_ID = "1547core";
const SOURCE_FLAG_SCOPE = "1547Core";

const SEED_DATA_KEYS = [
    "maneuverData",
    "weaponData",
    "armorData",
    "ammoData",
    "weaponModifierData",
    "spellData",
    "ritualStepRollTableData",
    "spellFailureRollTableData",
    "monsterData",
    "changeSetData",
    "changeData",
    "requirementData",
];

// Mirrors the live resolvers in ritual-generation-service / spell-casting-service:
// match by Foundry _id, then by the stable sourceKey flag, then by display name.
function resolveTable(game, ref) {
    const key = String(ref ?? "").trim();
    if (!key) return null;
    return game?.tables?.get?.(key)
        ?? game?.tables?.find?.((table) => table?.flags?.[SOURCE_FLAG_SCOPE]?.sourceKey === key)
        ?? game?.tables?.find?.((table) => table?.name === key)
        ?? null;
}

function buildTableResolutionReport(game) {
    const spells = game?.settings?.get?.(MODULE_ID, "spellData");
    const ritualRefs = new Set();
    const failureRefs = new Set();
    for (const spell of (Array.isArray(spells) ? spells : [])) {
        const ritualRef = String(spell?.ritualStepTable ?? "").trim();
        if (ritualRef) ritualRefs.add(ritualRef);
        const profile = String(spell?.failureProfile ?? "Minor").trim() || "Minor";
        const failureRef = String(spell?.failureTable ?? "").trim() || `SpellFailure_${profile}`;
        failureRefs.add(failureRef);
    }
    const check = (refs) => {
        const unresolved = [...refs].filter((ref) => !resolveTable(game, ref));
        return { checked: refs.size, resolved: refs.size - unresolved.length, unresolved };
    };
    return { ritualStepTables: check(ritualRefs), failureTables: check(failureRefs) };
}

function summarizeToken(game, token) {
    const base = {
        tokenName: token?.name ?? null,
        tokenId: token?.id ?? null,
        actorName: token?.actor?.name ?? null,
        actorId: token?.actor?.id ?? null,
        actorType: token?.actor?.type ?? null,
    };
    if (!token?.actor) return { ...base, hudSummaryError: "Token has no actor." };

    const summarize = game?.modules?.get?.(MODULE_ID)?.api?.summarizeActor;
    if (typeof summarize !== "function") {
        return { ...base, hudSummaryError: "game.modules.1547core.api.summarizeActor is unavailable (HUD not registered yet?)." };
    }
    try {
        return { ...base, hudSummary: summarize(token.actor, token) };
    } catch (error) {
        return { ...base, hudSummaryError: String(error?.stack ?? error?.message ?? error) };
    }
}

// Captures every actor a diagnostic might depend on: all controlled (source)
// tokens plus all targeted (defender/target) tokens, so multi-actor flows
// (attacker vs defender, caster vs targets) can be analysed together.
function buildTokensReport(game, canvas) {
    const controlled = canvas?.tokens?.controlled ?? [];
    const targeted = Array.from(game?.user?.targets ?? []);
    return {
        controlledCount: controlled.length,
        targetedCount: targeted.length,
        controlled: controlled.map((token) => summarizeToken(game, token)),
        targeted: targeted.map((token) => summarizeToken(game, token)),
    };
}

export function buildDiagnosticsReport({ game = globalThis.game, canvas = globalThis.canvas } = {}) {
    const report = { generatedAt: new Date().toISOString(), sections: {}, errors: [] };
    const section = (name, fn) => {
        try {
            report.sections[name] = fn();
        } catch (error) {
            report.errors.push({ section: name, message: String(error?.message ?? error) });
        }
    };

    section("environment", () => ({
        foundryVersion: game?.version ?? null,
        moduleVersion: game?.modules?.get?.(MODULE_ID)?.version ?? null,
        diceSoNiceActive: Boolean(game?.modules?.get?.("dice-so-nice")?.active),
        systemId: game?.system?.id ?? null,
        systemVersion: game?.system?.version ?? null,
    }));

    section("seedData", () => {
        const counts = {};
        for (const key of SEED_DATA_KEYS) {
            const value = game?.settings?.get?.(MODULE_ID, key);
            counts[key] = Array.isArray(value) ? value.length : 0;
        }
        return { lastDataSetupAt: game?.settings?.get?.(MODULE_ID, "lastDataSetupAt") || null, counts };
    });

    section("worldContent", () => ({
        items: game?.items?.size ?? 0,
        actors: game?.actors?.size ?? 0,
        rollTables: game?.tables?.size ?? 0,
        managedTables: (game?.tables?.filter?.((table) => table?.flags?.[SOURCE_FLAG_SCOPE]?.sourceKey) ?? []).length,
        templates: (game?.items?.filter?.((item) => String(item?.type ?? "").endsWith("Template")) ?? [])
            .map((item) => ({ id: item.id, name: item.name, type: item.type })),
    }));

    section("tableResolution", () => buildTableResolutionReport(game));
    section("tokens", () => buildTokensReport(game, canvas));

    return report;
}

export function registerDiagnosticsService() {
    const moduleApi = game.modules.get(MODULE_ID);
    if (!moduleApi) {
        console.warn(`${MODULE_ID} | registerDiagnosticsService: module not found`);
        return;
    }
    moduleApi.api = moduleApi.api ?? {};
    moduleApi.api.diagnostics = (options = {}) => buildDiagnosticsReport(options);
}

export { resolveTable, buildTableResolutionReport, buildTokensReport };
