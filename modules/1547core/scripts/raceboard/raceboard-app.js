import {
  RaceBoardData, MIN_TRACKS, MAX_TRACKS, MIN_BOXES, DEFAULT_BOXES,
  ALARM_MAX_LEVEL, defaultAlarm, buildAlarmContext,
  VISIBILITY_HIDDEN, VISIBILITY_ALL, VISIBILITY_MAX, VISIBILITY_DEFAULT,
  normalizeVisibility, buildVisibilityOptions, buildHeaderCells,
  RESOLUTION_SUCCESS, RESOLUTION_FAILURE, buildResolutionContext
} from "./raceboard-data.js";
import { announceWinner } from "./winner-splash.js";

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

const MODULE_ID = "raceboard";
// Number of event-marker states a box cycles through on right-click, including
// "none" (0). 3 = none → red (1) → amber (2) → none. Bump to add more colors.
const EVENT_STATE_COUNT = 3;
// JournalEntryPage subtype must be namespaced to the owning module ("1547core"),
// and declared in module.json documentTypes, to be valid in Foundry v13.
const PAGE_TYPE = "1547core.race";
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
      this._state = {
        rows: RaceBoardData.defaultRows(),
        announcedWinners: [],
        visibility: VISIBILITY_DEFAULT,
        columns: [],
        alarm: defaultAlarm(),
        resolution: { state: 0 },
        resolver: null
      };
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
      "alarm-add": function(event, target) { return this._onAlarmAdd(event, target); },
      "alarm-remove": function(event, target) { return this._onAlarmRemove(event, target); },
      "alarm-up": function(event, target) { return this._onAlarmUp(event, target); },
      "set-visibility": function(event, target) { return this._onSetVisibility(event, target); },
      "edit-header": function(event, target) { return this._onEditHeader(event, target); },
      "resolve-success": function() { return this._onResolve("success"); },
      "resolve-failure": function() { return this._onResolve("failure"); },
      "resolve-clear": function() { return this._onResolveClear(); }
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
    if (doc) return {
      rows: doc.system.rows,
      announcedWinners: doc.system.announcedWinners ?? [],
      visibility: doc.system.visibility ?? VISIBILITY_DEFAULT,
      columns: doc.system.columns ?? [],
      alarm: doc.system.alarm ?? defaultAlarm(),
      resolution: doc.system.resolution ?? { state: 0 },
      resolver: doc.system.resolver ?? null
    };
    return this._state;
  }

  get isEphemeral() { return !this._uuid; }
  get canEdit() { return !this._readOnly && game.user.isGM; }

  async _prepareContext() {
    const data = this.data;
    const isGM = game.user.isGM;
    const visibility = normalizeVisibility(data.visibility);
    // Colored squares + alarm render for the GM, or for players when the board
    // visibility is set to "everything" (level 2).
    const showExtras = isGM || visibility === VISIBILITY_ALL;
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
          const eventState = showExtras ? (eventStates.get(i) ?? 0) : 0;
          return {
            checked: i < r.filled,
            idx: i,
            eventState,
            reached: eventState > 0 && i < r.filled
          };
        })
      };
    });
    const alarm = buildAlarmContext(data.alarm, { showExtras, canControl: this.canEdit });
    const maxBoxes = data.rows.reduce((m, r) => Math.max(m, r.total ?? 0), 0);
    const headerCells = buildHeaderCells(data.columns, maxBoxes);
    const resolution = buildResolutionContext(data.resolution, {
      canResolve: this.canEdit && !!data.resolver
    });
    return {
      rows,
      alarm,
      resolution,
      header: { show: headerCells.length > 0, cells: headerCells },
      visibility,
      visibilityOptions: buildVisibilityOptions(visibility),
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
        "system.announcedWinners": data.announcedWinners,
        "system.visibility": normalizeVisibility(data.visibility),
        "system.columns": data.columns ?? [],
        "system.alarm": data.alarm ?? defaultAlarm(),
        "system.resolution": data.resolution ?? { state: 0 },
        "system.resolver": data.resolver ?? null
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

  /* ----- Alarm meter ----- */

  async _onAlarmAdd() {
    if (!this.canEdit) return;
    await this._updateData(d => {
      d.alarm = { ...defaultAlarm(), ...(d.alarm ?? {}), enabled: true };
    });
  }

  async _onAlarmRemove() {
    if (!this.canEdit) return;
    await this._updateData(d => { d.alarm = defaultAlarm(); });
  }

  /**
   * Set the player visibility level (0 hidden, 1 board, 2 board+extras) from
   * the reveal radio. Pushes the board to players (or hides it) when crossing
   * the hidden boundary; level 1↔2 changes re-render via the normal state sync.
   */
  async _onSetVisibility(event, target) {
    if (!this.canEdit) return;
    const level = normalizeVisibility(Number(target.dataset.level));
    const prev = normalizeVisibility(this.data.visibility);
    if (level === prev) return;
    await this._updateData(d => { d.visibility = level; });
    if (level === VISIBILITY_HIDDEN && prev !== VISIBILITY_HIDDEN) {
      this._broadcastHide();
    } else if (level !== VISIBILITY_HIDDEN && prev === VISIBILITY_HIDDEN) {
      this._broadcastShow();
    }
  }

  _broadcastShow() {
    if (!game.user.isGM || this._readOnly) return;
    if (this.isEphemeral) {
      game.socket.emit(`module.${MODULE_ID}`, { type: "show", state: this._state });
    } else {
      game.socket.emit(`module.${MODULE_ID}`, { type: "show", uuid: this._uuid });
    }
  }

  _broadcastHide() {
    if (!game.user.isGM || this._readOnly) return;
    game.socket.emit(`module.${MODULE_ID}`, { type: "hide", uuid: this.isEphemeral ? null : this._uuid });
  }

  /** Left-click raises the alarm one stage. */
  async _onAlarmUp() {
    if (!this.canEdit) return;
    await this._updateData(d => {
      const a = d.alarm ?? defaultAlarm();
      a.level = Math.min(ALARM_MAX_LEVEL, (a.level ?? 0) + 1);
      d.alarm = a;
    });
  }

  /** Right-click lowers the alarm one stage. */
  async _onAlarmDown(event) {
    event.preventDefault();
    if (!this.canEdit) return;
    await this._updateData(d => {
      const a = d.alarm ?? defaultAlarm();
      a.level = Math.max(0, (a.level ?? 0) - 1);
      d.alarm = a;
    });
  }

  /**
   * Click a column header (GM) to edit its icon + tooltip. Lets a GM author
   * premade boards with labelled columns. Stores the values in `columns[col]`;
   * clearing both fields reverts that column to its numbered default.
   */
  async _onEditHeader(event, target) {
    if (!this.canEdit) return;
    const col = Number(target.dataset.col);
    if (!Number.isInteger(col) || col < 0) return;
    const data = this.data;
    const maxBoxes = data.rows.reduce((m, r) => Math.max(m, r.total ?? 0), 0);
    const current = buildHeaderCells(data.columns, maxBoxes)[col] ?? { icon: "", tooltip: "" };
    const esc = foundry.utils.escapeHTML;
    const result = await DialogV2.prompt({
      window: { title: game.i18n.localize("RACEBOARD.EditHeader") },
      content: `<div class="rb-edit-header">
        <label>${game.i18n.localize("RACEBOARD.HeaderIconLabel")}
          <input type="text" name="icon" value="${esc(current.icon)}" placeholder="fa-flask" autofocus />
        </label>
        <label>${game.i18n.localize("RACEBOARD.HeaderTooltipLabel")}
          <input type="text" name="tooltip" value="${esc(current.tooltip)}" placeholder="${game.i18n.localize("RACEBOARD.HeaderTooltipPlaceholder")}" />
        </label>
        <p class="rb-edit-header-hint">${game.i18n.localize("RACEBOARD.HeaderEditHint")}</p>
      </div>`,
      ok: {
        label: game.i18n.localize("RACEBOARD.SaveLabel"),
        callback: (event, button) => ({
          icon: button.form.elements.icon.value.trim(),
          tooltip: button.form.elements.tooltip.value.trim()
        })
      }
    });
    if (!result) return;
    await this._updateData(d => {
      const cols = Array.isArray(d.columns) ? [...d.columns] : [];
      while (cols.length <= col) cols.push({ icon: "", tooltip: "" });
      cols[col] = { icon: result.icon, tooltip: result.tooltip };
      d.columns = cols;
    });
  }

  /**
   * Resolve the board's process as success/failure. Sets the resolution state
   * (which broadcasts a banner to players), then hands off to the registered
   * domain resolver (e.g. the ritual resolver rolls the failure table / applies
   * the spell). A small dialog gathers the per-resolve toggles.
   */
  async _onResolve(outcome) {
    if (!this.canEdit) return;
    const resolver = this.data.resolver;
    if (!resolver) return;
    const isSuccess = outcome === "success";
    const applyRow = isSuccess
      ? `<label class="rb-resolve-opt"><input type="checkbox" name="apply" /> ${game.i18n.localize("RACEBOARD.ApplyEffects")}</label>`
      : "";
    const result = await DialogV2.prompt({
      window: { title: game.i18n.localize(isSuccess ? "RACEBOARD.ResolveDialogSuccess" : "RACEBOARD.ResolveDialogFailure") },
      content: `<div class="rb-resolve-dialog">
        <label class="rb-resolve-opt"><input type="checkbox" name="announce" checked /> ${game.i18n.localize("RACEBOARD.AnnounceToPlayers")}</label>
        ${applyRow}
      </div>`,
      ok: {
        label: game.i18n.localize("RACEBOARD.ResolveConfirm"),
        callback: (event, button) => ({
          announce: !!button.form.elements.announce?.checked,
          apply: isSuccess ? !!button.form.elements.apply?.checked : false
        })
      }
    });
    if (!result) return;
    await this._updateData(d => { d.resolution = { state: isSuccess ? RESOLUTION_SUCCESS : RESOLUTION_FAILURE }; });
    try {
      await globalThis.RaceBoard?.resolve?.({ outcome, resolver, options: result, app: this });
    } catch (err) {
      console.error("1547core | raceboard resolve failed", err);
      ui.notifications?.error(`1547 Core: resolution failed. ${err.message}`);
    }
  }

  /** Clear a resolution, re-enabling the resolve controls. */
  async _onResolveClear() {
    if (!this.canEdit) return;
    await this._updateData(d => { d.resolution = { state: 0 }; });
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
      if (d.alarm) d.alarm.level = 0;
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
        announcedWinners: this._state.announcedWinners,
        visibility: normalizeVisibility(this._state.visibility),
        columns: this._state.columns ?? [],
        alarm: this._state.alarm ?? defaultAlarm(),
        resolution: this._state.resolution ?? { state: 0 },
        resolver: this._state.resolver ?? null
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

  async _onRender(context, options) {
    await super._onRender?.(context, options);
    this._hasBeenRendered = true;
    if (this.canEdit) {
      for (const box of this.element.querySelectorAll('.rb-box[data-action="tick"]')) {
        box.addEventListener("contextmenu", this._onMarkBox.bind(this));
      }
      const alarmIcon = this.element.querySelector('.rb-alarm-icon[data-action="alarm-up"]');
      alarmIcon?.addEventListener("contextmenu", this._onAlarmDown.bind(this));
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
