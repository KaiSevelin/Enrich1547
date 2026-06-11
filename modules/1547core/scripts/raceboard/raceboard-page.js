import { openRaceBoardApp } from "./raceboard-app.js";

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
    context.rows = sys.rows.map((r, idx) => {
      const eventStates = new Map((r.events ?? []).map(e => [e.index, e.state]));
      return {
        idx,
        label: r.label,
        filled: r.filled,
        total: r.total,
        isWon: r.filled >= r.total,
        boxes: Array.from({ length: r.total }, (_, i) => {
          const eventState = eventStates.get(i) ?? 0;
          return {
            checked: i < r.filled,
            eventState,
            reached: eventState > 0 && i < r.filled
          };
        })
      };
    });
    context.canEdit = game.user.isGM;
    context.docName = this.document.name;
    return context;
  }

  _onOpenPrivate() {
    openRaceBoardApp({ uuid: this.document.uuid, show: false });
  }
}
