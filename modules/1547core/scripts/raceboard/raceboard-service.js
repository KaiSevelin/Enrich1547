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
 * Migrate pre-consolidation race-board pages (type "raceboard.race") to the
 * valid "1547core.race" subtype. Such pages fail document validation in v13 and
 * land in their JournalEntry's `invalidDocuments`; we re-create each with the
 * new type, preserving its id and data. GM-only, runs once on ready.
 */
async function migrateLegacyRacePages() {
    if (!game.user?.isGM) return;
    let migrated = 0;
    for (const entry of game.journal?.contents ?? []) {
        const invalid = entry.pages?.invalidDocuments;
        if (!invalid?.size) continue;
        const legacy = [...invalid.values()].filter((p) => (p?._source?.type ?? p?.type) === LEGACY_PAGE_TYPE);
        if (!legacy.length) continue;

        const sources = legacy.map((p) => {
            const src = foundry.utils.deepClone(p._source ?? p.toObject?.() ?? {});
            src.type = PAGE_TYPE;
            return src;
        });
        const ids = legacy.map((p) => p.id ?? p._id).filter(Boolean);
        try {
            await entry.deleteEmbeddedDocuments("JournalEntryPage", ids);
            await entry.createEmbeddedDocuments("JournalEntryPage", sources, { keepId: true });
            migrated += sources.length;
        } catch (err) {
            console.error(`1547core | raceboard: failed migrating legacy race pages in "${entry.name}"`, err);
        }
    }
    if (migrated) console.log(`1547core | raceboard: migrated ${migrated} legacy race-board page(s) to ${PAGE_TYPE}`);
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
        openState: (state, { show = false } = {}) => openRaceBoardApp({ state, show })
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
}
