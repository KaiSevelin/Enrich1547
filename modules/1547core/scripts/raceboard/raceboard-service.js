/**
 * Raceboard service (migrated from the standalone `raceboard` module
 * in 1547core 0.3.1). Owns the floating progress-race tracker UI and
 * its `JournalEntryPage` subtype.
 *
 * The page subtype is "1547core.race": Foundry v13 only accepts document
 * subtypes namespaced to the owning module *and* declared in module.json
 * `documentTypes`. The old standalone-module type "raceboard.race" is no
 * longer valid here and is migrated to the new type on ready (see
 * migrateLegacyRacePages). Socket namespace stays "module.raceboard" so any
 * in-flight cross-client messages still route correctly.
 *
 * Consumers continue to use `globalThis.RaceBoard`.
 */

import { RaceBoardData } from "./raceboard-data.js";
import { RaceBoardPageSheet } from "./raceboard-page.js";
import {
    openRaceBoardApp,
    newEphemeralRaceBoard,
    getOpenAppForUuid,
    getEphemeralApp
} from "./raceboard-app.js";
import {
    registerSidebarButton,
    registerPageContextMenu,
    registerSceneControl
} from "./sidebar-buttons.js";

const LEGACY_NAMESPACE = "raceboard";
const PAGE_TYPE = "1547core.race";
// Pre-consolidation subtype from the standalone "raceboard" module. Invalid in
// v13 under 1547core; migrated to PAGE_TYPE on ready.
const LEGACY_PAGE_TYPE = "raceboard.race";

// Domain resolvers keyed by a board's `resolver.kind` ("ritual", "disease", …).
// A consumer registers one via RaceBoard.registerResolver and the board's
// resolve controls invoke it. Module-scoped so it survives the RaceBoard object
// being (re)built in refreshRaceboardApi.
const _resolvers = new Map();

/** Register a domain resolver for a board kind. handler({outcome, resolver, options, app}). */
function registerResolver(kind, handler) {
    if (kind && typeof handler === "function") _resolvers.set(kind, handler);
}

/**
 * Resolve a board's process as success/failure. Looks up the handler for the
 * board's `resolver.kind` and invokes it. The app already set the banner state;
 * this performs the domain side-effects (chat card, failure roll, apply).
 */
async function resolveBoard({ outcome, resolver, options = {}, app = null } = {}) {
    const kind = resolver?.kind;
    const handler = kind ? _resolvers.get(kind) : null;
    if (!handler) {
        ui.notifications?.warn(`1547 Core: no race-board resolver registered for '${kind ?? "?"}'.`);
        return null;
    }
    return await handler({ outcome, resolver, options, app });
}

function registerSocket() {
    game.socket.on(`module.${LEGACY_NAMESPACE}`, (msg) => {
        if (!msg || typeof msg !== "object") return;
        if (game.user.isGM) return;

        switch (msg.type) {
            case "show": {
                if (msg.uuid) {
                    openRaceBoardApp({ uuid: msg.uuid, readOnly: true });
                    return;
                }
                if (msg.state) {
                    openRaceBoardApp({ state: msg.state, readOnly: true });
                }
                return;
            }
            case "hide": {
                // GM set visibility to hidden — close the player's copy.
                const app = msg.uuid ? getOpenAppForUuid(msg.uuid) : getEphemeralApp();
                app?.close();
                return;
            }
            case "ephemeral-update": {
                const app = getEphemeralApp();
                if (app) {
                    app._state = msg.state;
                    app.render();
                }
                return;
            }
            case "saved": {
                const eph = getEphemeralApp();
                if (eph) eph.close();
                if (msg.uuid) openRaceBoardApp({ uuid: msg.uuid, readOnly: true });
                return;
            }
        }
    });
}

/**
 * Rewrite one JournalEntry's legacy "raceboard.race" pages to "1547core.race".
 * A type-invalid embedded page can't be read/deleted through the normal page
 * collection in v13, so we operate on the parent's raw `_source.pages`. Foundry
 * only permits a document's type to change when its `system` field is replaced
 * rather than merged — we try recursive:false first, then the "==" force-replace
 * operator. Returns true on success.
 */
async function rewriteLegacyRacePages(entry, sourcePages) {
    // Strategy 1: full pages array with recursive:false (force-replaces system).
    const replaced = sourcePages.map((p) => {
        const c = foundry.utils.deepClone(p);
        if (c?.type === LEGACY_PAGE_TYPE) c.type = PAGE_TYPE;
        return c;
    });
    try {
        await entry.update({ pages: replaced }, { recursive: false });
        return true;
    } catch (err1) {
        console.warn(`1547core | raceboard: recursive:false update failed for "${entry.name}", trying ==system`, err1);
    }

    // Strategy 2: per-page update using the "==" force-replace operator on system.
    const ops = sourcePages
        .filter((p) => p?.type === LEGACY_PAGE_TYPE)
        .map((p) => {
            const c = foundry.utils.deepClone(p);
            const system = c.system ?? {};
            delete c.system;
            c.type = PAGE_TYPE;
            c["==system"] = system;
            return c;
        });
    try {
        await entry.update({ pages: ops });
        return true;
    } catch (err2) {
        console.error(`1547core | raceboard: FAILED migrating "${entry.name}" (${entry.id})`, err2);
        return false;
    }
}

/**
 * Migrate all pre-consolidation race-board pages (type "raceboard.race") to the
 * valid "1547core.race" subtype. GM-only; runs once on ready and is also exposed
 * as RaceBoard.migrateLegacyPages() for manual re-runs.
 */
async function migrateLegacyRacePages() {
    if (!game.user?.isGM) return { checked: 0, migrated: 0, failed: 0 };
    let checked = 0;
    let migrated = 0;
    let failed = 0;
    for (const entry of game.journal?.contents ?? []) {
        checked += 1;
        const sourcePages = entry?._source?.pages;
        if (!Array.isArray(sourcePages)) continue;
        const count = sourcePages.filter((p) => p?.type === LEGACY_PAGE_TYPE).length;
        if (!count) continue;

        const ok = await rewriteLegacyRacePages(entry, sourcePages);
        if (ok) {
            migrated += count;
            console.log(`1547core | raceboard: migrated ${count} legacy page(s) in "${entry.name}".`);
        } else {
            failed += count;
        }
    }
    console.log(`1547core | raceboard: legacy-page migration scan complete — ${checked} journals checked, ${migrated} migrated, ${failed} failed.`);
    return { checked, migrated, failed };
}

/** Called from 1547core/scripts/main.js during init. */
export function registerRaceboardService() {
    Object.assign(CONFIG.JournalEntryPage.dataModels, {
        [PAGE_TYPE]: RaceBoardData
    });

    const DSC = foundry.applications.apps.DocumentSheetConfig
        ?? foundry.documents.collections.DocumentSheetConfig;
    DSC.registerSheet(JournalEntryPage, LEGACY_NAMESPACE, RaceBoardPageSheet, {
        types: [PAGE_TYPE],
        makeDefault: true,
        label: "RACEBOARD.SheetLabel"
    });

    CONFIG.JournalEntryPage.typeLabels ??= {};
    CONFIG.JournalEntryPage.typeLabels[PAGE_TYPE] = "RACEBOARD.PageTypeLabel";
    CONFIG.JournalEntryPage.typeIcons ??= {};
    CONFIG.JournalEntryPage.typeIcons[PAGE_TYPE] = "fa-solid fa-flag-checkered";

    registerSidebarButton();
    registerPageContextMenu();
    registerSceneControl();

    Hooks.on("updateJournalEntryPage", (page) => {
        if (page.type !== PAGE_TYPE) return;
        const app = getOpenAppForUuid(page.uuid);
        if (app?.rendered) app.render();
    });

    Hooks.on("deleteJournalEntryPage", (page) => {
        if (page.type !== PAGE_TYPE) return;
        const app = getOpenAppForUuid(page.uuid);
        if (app?.rendered) app.close();
    });

    // One-time migration of legacy "raceboard.race" pages. Guard on game.ready
    // in case this init-time async import resolved after the ready hook fired.
    if (game.ready) void migrateLegacyRacePages();
    else Hooks.once("ready", () => void migrateLegacyRacePages());
}

/** Called from 1547core/scripts/main.js during ready. */
export function refreshRaceboardApi() {
    registerSocket();

    globalThis.RaceBoard = {
        open: (uuid) => openRaceBoardApp({ uuid, show: false }),
        show: (uuid) => openRaceBoardApp({ uuid, show: true }),
        new: () => newEphemeralRaceBoard(),
        // Re-run the legacy "raceboard.race" → "1547core.race" page migration.
        migrateLegacyPages: () => migrateLegacyRacePages(),
        // Open an ephemeral board from a custom state. Shape:
        //   { rows: [{ label, filled, total, events? }],
        //     announcedWinners?: [],
        //     visibility?: 0|1|2,
        //     alarm?: { enabled, level },
        //     columns?: [{ icon, tooltip }] }   // per-column header overrides
        // `columns` labels the header row: entry i sets column i's icon/tooltip,
        // e.g. { icon: "fa-user-doctor", tooltip: "Diagnose (easy)" }. Missing
        // entries fall back to numbered defaults (fa-1 "First", …). The header
        // shows as many columns as the widest track has boxes.
        openState: (state, { show = false } = {}) => openRaceBoardApp({ state, show }),
        // Register a domain resolver for a board kind, and resolve a board.
        // A resolver is `({ outcome, resolver, options, app }) => Promise`.
        registerResolver,
        resolve: resolveBoard
    };

    // Safety net: if the Journal sidebar already rendered before our hooks
    // attached, force a re-render so the button appears.
    const journalTab = ui.sidebar?.tabs?.journal ?? ui.journal;
    if (journalTab?.rendered) {
        try { journalTab.render(false); } catch { /* non-fatal */ }
    }

    const coreModule = game.modules?.get("1547core");
    if (coreModule) {
        coreModule.api = coreModule.api ?? {};
        coreModule.api.raceboard = globalThis.RaceBoard;
    }

    // Announce that the RaceBoard API is built so domain services (e.g. the
    // ritual resolver) can register against it without racing our async load.
    Hooks.callAll("1547coreRaceboardReady", globalThis.RaceBoard);
}
