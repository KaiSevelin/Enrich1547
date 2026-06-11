import { RaceBoardData, MIN_TRACKS, MAX_TRACKS, MIN_BOXES, DEFAULT_BOXES } from "./raceboard-data.js";
import { announceWinner } from "./winner-splash.js";

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

const MODULE_ID = "raceboard";
// Number of event-marker states a box cycles through on right-click, including
// "none" (0). 3 = none → red (1) → amber (2) → none. Bump to add more colors.
const EVENT_STATE_COUNT = 3;
const PAGE_TYPE = `${MODULE_ID}.race`;
const FOLDER_NAME = "RaceBoards";
const EPHEMERAL_KEY = "__ephemeral__";

/**
 * Floating RaceBoard window. Works in two modes:
 *  - Ephemeral: no document yet; state lives on the app instance; GM can Save to create one.
 *  - Document-backed: bound to a JournalEntryPage; edits persist via page.update().
 */
export class RaceBoardApp extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this._uuid = options.uuid ?? null;
    this._readOnly = !!options.readOnly;
    this._state = options.state ?? null;
    if (!this._uuid && !this._state) {
      this._state = { rows: RaceBoardData.defaultRows(), announcedWinners: [] };
    }
  }

  static DEFAULT_OPTIONS = {
    id: "raceboard-app-{id}",
    classes: ["raceboard-app"],
    tag: "section",
    window: {
      title: "RaceBoard",
      icon: "fa-solid fa-flag-checkered",
      resizable: true
    },
    position: { width: 480, height: "auto" },
    actions: {
      "tick": function(event, target) { return this._onTick(event, target); },
      "row-add-box": function(event, target) { return this._onRowAddBox(event, target); },
      "row-remove-box": function(event, target) { return this._onRowRemoveBox(event, target); },
      "row-delete": function(event, target) { return this._onRowDelete(event, target); },
      "add-row": function(event, target) { return this._onAddRow(event, target); },
      "edit-label": function(event, target) { return this._onEditLabel(event, target); },
      "reset": function(event, target) { return this._onReset(event, target); },
      "discard": function(event, target) { return this._onDiscard(event, target); },
      "save": function(event, target) { return this._onSave(event, target); },
      "show-to-players": function(event, target) { return this._onShowToPlayers(event, target); }
    }
  };

  static PARTS = {
    body: { template: "modules/1547core/templates/raceboard/raceboard.hbs" }
  };

  get document() {
    return this._uuid ? fromUuidSync(this._uuid) : null;
  }

  get data() {
    const doc = this.document;
    if (doc) return { rows: doc.system.rows, announcedWinners: doc.system.announcedWinners ?? [] };
    return this._state;
  }

  get isEphemeral() { return !this._uuid; }
  get canEdit() { return !this._readOnly && game.user.isGM; }

  async _prepareContext() {
    const data = this.data;
    const rows = data.rows.map((r, idx) => {
      const eventStates = new Map((r.events ?? []).map(e => [e.index, e.state]));
      return {
        idx,
        label: r.label,
        filled: r.filled,
        total: r.total,
        isWon: r.filled >= r.total,
        canRemoveBox: r.total > MIN_BOXES,
        boxes: Array.from({ length: r.total }, (_, i) => {
          const eventState = eventStates.get(i) ?? 0;
          return {
            checked: i < r.filled,
            idx: i,
            eventState,
            reached: eventState > 0 && i < r.filled
          };
        })
      };
    });
    return {
      rows,
      canEdit: this.canEdit,
      canAddRow: data.rows.length < MAX_TRACKS,
      canDeleteRow: data.rows.length > MIN_TRACKS,
      isEphemeral: this.isEphemeral,
      docName: this.document?.name ?? game.i18n.localize("RACEBOARD.UntitledRaceBoard")
    };
  }

  async _updateData(mutator) {
    const data = foundry.utils.deepClone(this.data);
    mutator(data);
    if (this.isEphemeral) {
      this._state = data;
      this._broadcastEphemeral();
      this.render();
    } else {
      await this.document.update({
        "system.rows": data.rows,
        "system.announcedWinners": data.announcedWinners
      });
    }
    this._checkForWinners();
  }

  _checkForWinners() {
    const data = this.data;
    const announced = new Set(data.announcedWinners);
    const newlyWon = [];
    data.rows.forEach((row, idx) => {
      if (row.filled >= row.total && !announced.has(idx)) newlyWon.push(idx);
    });
    if (!newlyWon.length) return;

    for (const idx of newlyWon) announceWinner(data.rows[idx].label);
    const updated = [...data.announcedWinners, ...newlyWon];
    if (this.isEphemeral) {
      this._state.announcedWinners = updated;
      this._broadcastEphemeral();
    } else {
      this.document.update({ "system.announcedWinners": updated });
    }
  }

  _broadcastEphemeral() {
    if (!this.isEphemeral || !game.user.isGM || this._readOnly) return;
    game.socket.emit(`module.${MODULE_ID}`, {
      type: "ephemeral-update",
      state: this._state
    });
  }

  /* ---------------------------------------- */
  /*  Action handlers                         */
  /* ---------------------------------------- */

  async _onTick(event, target) {
    if (!this.canEdit) return;
    const rowIdx = Number(target.dataset.row);
    const isChecked = target.classList.contains("is-checked");
    await this._updateData(d => {
      const row = d.rows[rowIdx];
      if (isChecked) {
        row.filled = Math.max(0, row.filled - 1);
        d.announcedWinners = d.announcedWinners.filter(i => i !== rowIdx);
      } else {
        row.filled = Math.min(row.total, row.filled + 1);
      }
    });
  }

  /**
   * Right-click a box to cycle its "event step" marker through its states
   * (none → red → amber → none). Visual only — signals that something happens
   * when an actor reaches this box.
   */
  async _onMarkBox(event) {
    event.preventDefault();
    if (!this.canEdit) return;
    const box = event.currentTarget;
    const rowIdx = Number(box.dataset.row);
    const boxIdx = Number(box.dataset.box);
    if (!Number.isInteger(rowIdx) || !Number.isInteger(boxIdx)) return;
    await this._updateData(d => {
      const row = d.rows[rowIdx];
      const events = (row.events ?? []).filter(e => e.index !== boxIdx);
      const current = (row.events ?? []).find(e => e.index === boxIdx)?.state ?? 0;
      const next = (current + 1) % EVENT_STATE_COUNT;
      if (next > 0) events.push({ index: boxIdx, state: next });
      events.sort((a, b) => a.index - b.index);
      row.events = events;
    });
  }

  async _onRowAddBox(event, target) {
    if (!this.canEdit) return;
    const rowIdx = Number(target.dataset.row);
    await this._updateData(d => { d.rows[rowIdx].total += 1; });
  }

  async _onRowRemoveBox(event, target) {
    if (!this.canEdit) return;
    const rowIdx = Number(target.dataset.row);
    await this._updateData(d => {
      const row = d.rows[rowIdx];
      if (row.total <= MIN_BOXES) return;
      row.total -= 1;
      if (row.filled > row.total) {
        row.filled = row.total;
        if (row.filled < row.total) {
          d.announcedWinners = d.announcedWinners.filter(i => i !== rowIdx);
        }
      }
      // Drop any event markers that fell off the end of the track.
      row.events = (row.events ?? []).filter(e => e.index < row.total);
    });
  }

  async _onRowDelete(event, target) {
    if (!this.canEdit) return;
    if (this.data.rows.length <= MIN_TRACKS) {
      ui.notifications.warn(game.i18n.format("RACEBOARD.MinTracksReached", { min: MIN_TRACKS }));
      return;
    }
    const rowIdx = Number(target.dataset.row);
    const confirmed = await DialogV2.confirm({
      window: { title: game.i18n.localize("RACEBOARD.DeleteTrack") },
      content: `<p>${game.i18n.format("RACEBOARD.DeleteTrackConfirm", { label: this.data.rows[rowIdx].label })}</p>`
    });
    if (!confirmed) return;
    await this._updateData(d => {
      d.rows.splice(rowIdx, 1);
      d.announcedWinners = d.announcedWinners
        .filter(i => i !== rowIdx)
        .map(i => (i > rowIdx ? i - 1 : i));
    });
  }

  async _onAddRow() {
    if (!this.canEdit) return;
    if (this.data.rows.length >= MAX_TRACKS) {
      ui.notifications.warn(game.i18n.format("RACEBOARD.MaxTracksReached", { max: MAX_TRACKS }));
      return;
    }
    await this._updateData(d => {
      d.rows.push({
        label: RaceBoardData.nextOpponentLabel(d.rows),
        filled: 0,
        total: DEFAULT_BOXES,
        events: []
      });
    });
  }

  async _onEditLabel(event, target) {
    if (!this.canEdit) return;
    const rowIdx = Number(target.dataset.row);
    const current = this.data.rows[rowIdx].label;
    const result = await DialogV2.prompt({
      window: { title: game.i18n.localize("RACEBOARD.EditLabel") },
      content: `<input type="text" name="label" value="${foundry.utils.escapeHTML(current)}" autofocus />`,
      ok: {
        label: game.i18n.localize("RACEBOARD.SaveLabel"),
        callback: (event, button) => button.form.elements.label.value.trim()
      }
    });
    if (!result) return;
    await this._updateData(d => { d.rows[rowIdx].label = result; });
  }

  async _onReset() {
    if (!this.canEdit) return;
    const confirmed = await DialogV2.confirm({
      window: { title: game.i18n.localize("RACEBOARD.Reset") },
      content: `<p>${game.i18n.localize("RACEBOARD.ResetConfirm")}</p>`
    });
    if (!confirmed) return;
    await this._updateData(d => {
      for (const row of d.rows) row.filled = 0;
      d.announcedWinners = [];
    });
  }

  async _onDiscard() {
    if (!this.canEdit) return;
    if (this.isEphemeral) {
      // For ephemeral, Discard just closes — there's nothing persisted to delete.
      this.close();
      return;
    }
    const doc = this.document;
    if (!doc) return;
    const confirmed = await DialogV2.confirm({
      window: { title: game.i18n.localize("RACEBOARD.Discard") },
      content: `<p>${game.i18n.format("RACEBOARD.DiscardConfirm", { name: doc.name })}</p>`
    });
    if (!confirmed) return;

    const parent = doc.parent;
    const isLastPage = parent?.pages?.size === 1;
    await doc.delete();
    if (isLastPage && parent) await parent.delete();
    this.close();
  }

  async _onSave() {
    if (!this.canEdit) return;
    if (!this.isEphemeral) {
      ui.notifications.info(game.i18n.localize("RACEBOARD.AlreadySaved"));
      return;
    }
    const name = await DialogV2.prompt({
      window: { title: game.i18n.localize("RACEBOARD.SaveTitle") },
      content: `<p>${game.i18n.localize("RACEBOARD.SavePrompt")}</p>
                <input type="text" name="name" value="${game.i18n.localize("RACEBOARD.UntitledRaceBoard")}" autofocus />`,
      ok: {
        label: game.i18n.localize("RACEBOARD.SaveLabel"),
        callback: (event, button) => button.form.elements.name.value.trim()
      }
    });
    if (!name) return;

    const folder = await getOrCreateRaceBoardFolder();
    const entry = await JournalEntry.create({ name, folder: folder.id });
    const [page] = await entry.createEmbeddedDocuments("JournalEntryPage", [{
      name,
      type: PAGE_TYPE,
      system: {
        rows: this._state.rows,
        announcedWinners: this._state.announcedWinners
      }
    }]);

    // Re-key the registry: this app was at EPHEMERAL_KEY, now belongs at the new uuid.
    _openApps.delete(EPHEMERAL_KEY);
    this._uuid = page.uuid;
    this._state = null;
    _openApps.set(this._uuid, this);

    // Tell players to re-open against the new uuid so they switch from ephemeral state to doc-backed.
    game.socket.emit(`module.${MODULE_ID}`, { type: "saved", uuid: this._uuid });

    ui.notifications.info(game.i18n.format("RACEBOARD.SavedAs", { name }));
    this.render();
  }

  _onShowToPlayers() {
    if (!this.canEdit) return;
    if (this.isEphemeral) {
      game.socket.emit(`module.${MODULE_ID}`, { type: "show", state: this._state });
    } else {
      game.socket.emit(`module.${MODULE_ID}`, { type: "show", uuid: this._uuid });
    }
    ui.notifications.info(game.i18n.localize("RACEBOARD.ShownToPlayers"));
  }

  async _onRender(context, options) {
    await super._onRender?.(context, options);
    this._hasBeenRendered = true;
    if (this.canEdit) {
      for (const box of this.element.querySelectorAll('.rb-box[data-action="tick"]')) {
        box.addEventListener("contextmenu", this._onMarkBox.bind(this));
      }
    }
  }

  async _onClose(options) {
    await super._onClose(options);
    unregisterApp(this._uuid ?? EPHEMERAL_KEY);
  }
}

/* ---------------------------------------- */
/*  Document creation + helpers              */
/* ---------------------------------------- */

async function getOrCreateRaceBoardFolder() {
  let folder = game.folders.find(f => f.type === "JournalEntry" && f.name === FOLDER_NAME);
  if (!folder) {
    folder = await Folder.create({ name: FOLDER_NAME, type: "JournalEntry", color: "#5a9b8e" });
  }
  return folder;
}

/* ---------------------------------------- */
/*  App registry (per-user)                  */
/* ---------------------------------------- */

const _openApps = new Map();

/**
 * Open a RaceBoard window.
 * @param {object} options
 * @param {string} [options.uuid]      UUID of the JournalEntryPage to open. Mutually exclusive with state.
 * @param {object} [options.state]     Ephemeral state snapshot (rows, announcedWinners). Mutually exclusive with uuid.
 * @param {boolean} [options.show]     If true (and current user is GM), also broadcast to players.
 * @param {boolean} [options.readOnly] Render in read-only mode.
 */
export function openRaceBoardApp({ uuid = null, state = null, show = false, readOnly = false } = {}) {
  const key = uuid ?? EPHEMERAL_KEY;
  let app = _openApps.get(key);
  // Recycle the registry entry only if the existing app is fully closed.
  // Treating "mid-render" as gone caused duplicate windows under double-fire.
  if (app && _isClosed(app)) {
    _openApps.delete(key);
    app = null;
  }
  if (!app) {
    app = new RaceBoardApp({ uuid, state, readOnly });
    _openApps.set(key, app);
  }
  app.render(true);

  if (show && game.user.isGM && !readOnly) {
    if (uuid) {
      game.socket.emit(`module.${MODULE_ID}`, { type: "show", uuid });
    } else {
      game.socket.emit(`module.${MODULE_ID}`, { type: "show", state: app._state });
    }
  }
  return app;
}

function _isClosed(app) {
  const STATES = foundry.applications.api.ApplicationV2?.RENDER_STATES;
  if (STATES && typeof app.state === "number") {
    return app.state === STATES.CLOSED || app.state === STATES.NONE;
  }
  // Fallback for builds without RENDER_STATES exposed: trust .rendered only
  // if the app was previously rendered at least once. We track that with a flag.
  return app._hasBeenRendered === true && !app.rendered;
}

/**
 * Create a new ephemeral RaceBoard (no document yet) and Show it to players.
 * If an ephemeral RaceBoard is already open (rendered OR mid-render), brings
 * it to the front instead of replacing it — only one ephemeral RaceBoard
 * can exist at a time per client.
 */
export function newEphemeralRaceBoard() {
  const existing = _openApps.get(EPHEMERAL_KEY);
  if (existing && !_isClosed(existing)) {
    existing.bringToFront?.();
    return existing;
  }
  return openRaceBoardApp({ show: true });
}

export function getOpenAppForUuid(uuid) {
  return _openApps.get(uuid);
}

export function getEphemeralApp() {
  return _openApps.get(EPHEMERAL_KEY);
}

export function unregisterApp(key) {
  _openApps.delete(key);
}
