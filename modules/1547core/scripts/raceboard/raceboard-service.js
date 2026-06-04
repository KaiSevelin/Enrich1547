/**
 * Raceboard service (migrated from the standalone `raceboard` module
 * in 1547core 0.3.1). Owns the floating progress-race tracker UI and
 * its `JournalEntryPage` subtype.
 *
 * Back-compat: the JournalEntryPage subtype key remains "raceboard.race"
 * so existing world race tracks load without migration. Socket namespace
 * stays "module.raceboard" so any in-flight cross-client messages still
 * route correctly during the transition.
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
const PAGE_TYPE = `${LEGACY_NAMESPACE}.race`;

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
}

/** Called from 1547core/scripts/main.js during ready. */
export function refreshRaceboardApi() {
    registerSocket();

    globalThis.RaceBoard = {
        open: (uuid) => openRaceBoardApp({ uuid, show: false }),
        show: (uuid) => openRaceBoardApp({ uuid, show: true }),
        new: () => newEphemeralRaceBoard()
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
