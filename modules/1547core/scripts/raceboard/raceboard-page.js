import { openRaceBoardApp } from "./raceboard-app.js";
import { buildAlarmContext, buildHeaderCells, normalizeVisibility, VISIBILITY_ALL } from "./raceboard-data.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;

const BasePageSheet =
  foundry.applications.sheets.journal?.JournalEntryPageHandlebarsSheet
  ?? foundry.applications.sheets.JournalEntryPageSheet;

export class RaceBoardPageSheet extends HandlebarsApplicationMixin(BasePageSheet) {
  static DEFAULT_OPTIONS = {
    classes: ["raceboard-page-sheet"],
    actions: {
      "open-private": function(event, target) { return this._onOpenPrivate(event, target); }
    }
  };

  static PARTS = {
    content: {
      template: "modules/1547core/templates/raceboard/raceboard-page.hbs",
      root: true
    }
  };

  async _prepareContext(options) {
    const context = (await super._prepareContext?.(options)) ?? {};
    const sys = this.document.system;
    const isGM = game.user.isGM;
    const showExtras = isGM || normalizeVisibility(sys.visibility) === VISIBILITY_ALL;
    context.rows = sys.rows.map((r, idx) => {
      const eventStates = new Map((r.events ?? []).map(e => [e.index, e.state]));
      return {
        idx,
        label: r.label,
        filled: r.filled,
        total: r.total,
        isWon: r.filled >= r.total,
        boxes: Array.from({ length: r.total }, (_, i) => {
          const eventState = showExtras ? (eventStates.get(i) ?? 0) : 0;
          return {
            checked: i < r.filled,
            eventState,
            reached: eventState > 0 && i < r.filled
          };
        })
      };
    });
    // Read-only page: alarm is never controllable here, only displayed.
    context.alarm = buildAlarmContext(sys.alarm, { showExtras, canControl: false });
    const maxBoxes = sys.rows.reduce((m, r) => Math.max(m, r.total ?? 0), 0);
    const headerCells = buildHeaderCells(sys.columns, maxBoxes);
    context.header = { show: headerCells.length > 0, cells: headerCells };
    context.canEdit = game.user.isGM;
    context.docName = this.document.name;
    return context;
  }

  _onOpenPrivate() {
    openRaceBoardApp({ uuid: this.document.uuid, show: false });
  }
}
