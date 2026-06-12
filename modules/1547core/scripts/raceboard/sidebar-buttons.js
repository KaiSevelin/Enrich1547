import { newEphemeralRaceBoard, openRaceBoardApp } from "./raceboard-app.js";

const MODULE_ID = "raceboard";
const PAGE_TYPE = "1547core.race";

/**
 * Add a "New RaceBoard" button to the Journal sidebar header (GM only).
 * This is the public-table entry point — clicking it creates a fresh
 * RaceBoard and immediately broadcasts it to all players.
 *
 * In v13 the Journal sidebar was migrated to ApplicationV2 and the inner
 * markup shifted across patch releases. We register against several render
 * hook names and try a wide net of selectors to find a sensible mount point.
 */
export function registerSidebarButton() {
  const inject = (app, htmlOrEl) => {
    if (!game.user.isGM) return;
    const root = htmlOrEl instanceof HTMLElement ? htmlOrEl : htmlOrEl?.[0];
    if (!root) return;
    if (root.querySelector(".raceboard-new-btn")) return;

    const mountSelectors = [
      ".header-actions.action-buttons",
      ".directory-header .header-actions",
      ".directory-header .action-buttons",
      ".directory-header",
      "header.directory-header",
      "header"
    ];

    let mount = null;
    let usedSelector = null;
    for (const sel of mountSelectors) {
      const found = root.querySelector(sel);
      if (found) { mount = found; usedSelector = sel; break; }
    }

    console.log(`[raceboard] sidebar render hook fired; mount selector: ${usedSelector ?? "NONE FOUND"}`);
    if (!mount) {
      console.warn("[raceboard] could not find a Journal sidebar mount point. Available top-level children:",
        Array.from(root.children).map(c => `${c.tagName.toLowerCase()}.${c.className}`));
      return;
    }

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "raceboard-new-btn";
    btn.title = game.i18n.localize("RACEBOARD.NewRaceBoard");
    btn.innerHTML = `<i class="fa-solid fa-flag-checkered"></i> <span>${game.i18n.localize("RACEBOARD.NewRaceBoard")}</span>`;
    btn.addEventListener("click", (ev) => { ev.preventDefault(); newEphemeralRaceBoard(); });
    mount.appendChild(btn);
  };

  Hooks.on("renderJournalDirectory", inject);
  Hooks.on("renderJournalDirectoryV2", inject);
  Hooks.on("renderJournalDirectoryHTML", inject);
}

/**
 * Add a "Show RaceBoard" entry to the right-click context menu of a
 * RaceBoard page in the journal's table of contents (GM only).
 *
 * v13 shuffles the exact hook name across patch releases; register under
 * every plausible variant so we work regardless of which one fires.
 */
export function registerPageContextMenu() {
  const handler = (app, options) => {
    if (options.__raceBoardInjected) return;
    options.__raceBoardInjected = true;
    options.push({
      name: "RACEBOARD.ShowRaceBoard",
      icon: '<i class="fa-solid fa-flag-checkered"></i>',
      condition: li => {
        if (!game.user.isGM) return false;
        const page = resolvePage(app, li);
        return page?.type === PAGE_TYPE;
      },
      callback: li => {
        const page = resolvePage(app, li);
        if (page) openRaceBoardApp({ uuid: page.uuid, show: true });
      }
    });
  };

  Hooks.on("getJournalEntryPageContextOptions", handler);
  Hooks.on("getJournalEntryPageContext", handler);
  Hooks.on("getJournalSheetPageContext", handler);
  Hooks.on("getJournalEntrySheetEntryContext", handler);
}

function resolvePage(app, li) {
  const el = li instanceof HTMLElement ? li : li?.[0];
  const pageId = el?.dataset?.pageId ?? el?.dataset?.entryId ?? el?.dataset?.documentId;
  return app?.document?.pages?.get(pageId);
}

/**
 * Add a "New RaceBoard" tool to the Journal Notes Scene Controls group
 * (left toolbar → Journal Notes → flag icon). GM only.
 *
 * v13's getSceneControlButtons hook passes a record (object), but earlier
 * patches passed an array — handle both, and likewise for the inner tools.
 */
export function registerSceneControl() {
  Hooks.on("getSceneControlButtons", (controls) => {
    if (!game.user?.isGM) return;

    const toolDef = {
      name: "raceboard-new",
      title: game.i18n.localize("RACEBOARD.NewRaceBoard"),
      icon: "fa-solid fa-flag-checkered",
      button: true,
      // v13's button-type Scene Controls tools fire onChange when activated.
      // Registering BOTH onChange and onClick caused double-creation.
      onChange: () => newEphemeralRaceBoard()
    };

    let notes = null;
    if (Array.isArray(controls)) {
      notes = controls.find(c => c?.name === "notes");
    } else if (controls && typeof controls === "object") {
      notes = controls.notes;
    }
    if (!notes) {
      console.warn("[raceboard] could not find the 'notes' Scene Controls group; tool not injected.");
      return;
    }

    if (Array.isArray(notes.tools)) {
      if (!notes.tools.some(t => t?.name === "raceboard-new")) {
        notes.tools.push(toolDef);
      }
    } else if (notes.tools && typeof notes.tools === "object") {
      notes.tools["raceboard-new"] = toolDef;
    }
  });
}
