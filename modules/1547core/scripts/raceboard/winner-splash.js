const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

class WinnerSplash extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this._winner = options.winner ?? "?";
  }

  static DEFAULT_OPTIONS = {
    id: "raceboard-winner-{id}",
    classes: ["raceboard-winner-splash"],
    tag: "section",
    window: { title: "Winner!", icon: "fa-solid fa-trophy", resizable: false, frame: true },
    position: { width: 480, height: "auto" }
  };

  static PARTS = {
    body: { template: "modules/1547core/templates/raceboard/winner-splash.hbs" }
  };

  async _prepareContext() {
    return { winner: this._winner };
  }
}

export function announceWinner(label) {
  new WinnerSplash({ winner: label }).render(true);
}
