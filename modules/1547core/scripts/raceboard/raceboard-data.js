const { TypeDataModel } = foundry.abstract;
const fields = foundry.data.fields;

export const MIN_TRACKS = 1;
export const MAX_TRACKS = 6;
export const MIN_BOXES = 1;
export const DEFAULT_BOXES = 3;

// Alarm meter escalation stages. Level indexes this array; the last entry is
// the top alarm. Colors run a green→red heatmap (see main.css). Add entries to
// extend the range — no other code needs to change.
export const ALARM_STAGES = [
  { icon: "fa-eye-slash",        labelKey: "RACEBOARD.AlarmUnaware" },
  { icon: "fa-eye",              labelKey: "RACEBOARD.AlarmAware" },
  { icon: "fa-magnifying-glass", labelKey: "RACEBOARD.AlarmSuspicious" },
  { icon: "fa-bell",             labelKey: "RACEBOARD.AlarmSearching" },
  { icon: "fa-lock",             labelKey: "RACEBOARD.AlarmAlert" }
];
export const ALARM_MAX_LEVEL = ALARM_STAGES.length - 1;

// Player visibility levels for a board. 0 = hidden entirely, 1 = plain board
// (no event colors, no alarm), 2 = board + colors + alarm.
export const VISIBILITY_HIDDEN = 0;
export const VISIBILITY_BOARD = 1;
export const VISIBILITY_ALL = 2;
export const VISIBILITY_MAX = 2;
export const VISIBILITY_DEFAULT = VISIBILITY_BOARD;

// The three reveal radio buttons, in order. Icon-only; titles explain each.
export const VISIBILITY_LEVELS = [
  { level: VISIBILITY_HIDDEN, icon: "fa-eye-slash", titleKey: "RACEBOARD.RevealHiddenTitle" },
  { level: VISIBILITY_BOARD,  icon: "fa-eye",       titleKey: "RACEBOARD.RevealBoardTitle" },
  { level: VISIBILITY_ALL,    icon: "fa-display",   titleKey: "RACEBOARD.RevealAllTitle" }
];

/** Normalize a stored visibility value to a valid level. */
export function normalizeVisibility(value) {
  return Number.isInteger(value) && value >= 0 && value <= VISIBILITY_MAX
    ? value
    : VISIBILITY_DEFAULT;
}

/** Build the reveal radio options for the given current visibility. */
export function buildVisibilityOptions(visibility) {
  const current = normalizeVisibility(visibility);
  return VISIBILITY_LEVELS.map(o => ({ ...o, active: o.level === current }));
}

/** Default alarm sub-state for a fresh / un-alarmed board. */
export function defaultAlarm() {
  return { enabled: false, level: 0 };
}

// Ordinal words for the default column header tooltips (1-based).
export const COLUMN_ORDINALS = [
  "First", "Second", "Third", "Fourth", "Fifth",
  "Sixth", "Seventh", "Eighth", "Ninth", "Tenth"
];

/** Ordinal label for a 1-based column position, e.g. 1 → "First". */
export function ordinalLabel(n) {
  return COLUMN_ORDINALS[n - 1] ?? `${n}th`;
}

/**
 * Build the header row cells. One cell per column, where `count` is the number
 * of boxes in the widest track. A caller-supplied `columns` entry overrides the
 * default for that position; otherwise the default is the numbered icon
 * (fa-1, fa-2, …) with an ordinal tooltip ("First", "Second", …).
 */
export function buildHeaderCells(columns, count) {
  const cols = Array.isArray(columns) ? columns : [];
  const cells = [];
  for (let i = 0; i < count; i += 1) {
    const custom = cols[i];
    const n = i + 1;
    const defaultIcon = n <= 9 ? `fa-${n}` : "fa-hashtag";
    cells.push({
      icon: (custom && custom.icon) ? custom.icon : defaultIcon,
      tooltip: (custom && custom.tooltip) ? custom.tooltip : ordinalLabel(n)
    });
  }
  return cells;
}

/**
 * Build the render context for the alarm meter. The alarm (like the colored
 * event squares) only renders when `showExtras` is true — i.e. for the GM, or
 * for players when the board's visibility is set to "everything" (level 2).
 */
export function buildAlarmContext(alarm, { showExtras, canControl }) {
  const a = alarm ?? defaultAlarm();
  const level = Math.max(0, Math.min(ALARM_MAX_LEVEL, a.level ?? 0));
  const stage = ALARM_STAGES[level];
  return {
    enabled: !!a.enabled,
    show: !!a.enabled && !!showExtras,
    level,
    icon: stage.icon,
    label: game.i18n.localize(stage.labelKey),
    canControl: !!canControl
  };
}

export class RaceBoardData extends TypeDataModel {
  static defineSchema() {
    return {
      rows: new fields.ArrayField(
        new fields.SchemaField({
          label: new fields.StringField({ required: true, blank: false, initial: "Players" }),
          filled: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
          total: new fields.NumberField({ required: true, integer: true, min: MIN_BOXES, initial: DEFAULT_BOXES }),
          // Boxes flagged as "event steps" — each carries a non-zero state that
          // cycles on right-click (1 = red, 2 = amber) to signal something happens there.
          events: new fields.ArrayField(
            new fields.SchemaField({
              index: new fields.NumberField({ required: true, integer: true, min: 0 }),
              state: new fields.NumberField({ required: true, integer: true, min: 1, initial: 1 })
            }),
            { initial: [] }
          )
        }),
        { initial: () => RaceBoardData.defaultRows() }
      ),
      announcedWinners: new fields.ArrayField(
        new fields.NumberField({ integer: true, min: 0 }),
        { initial: [] }
      ),
      // Player visibility level: 0 hidden, 1 plain board, 2 board + event
      // colors + alarm. See VISIBILITY_* constants.
      visibility: new fields.NumberField({ required: true, integer: true, min: 0, max: 2, initial: 1 }),
      // Optional per-column header overrides ({ icon, tooltip }). Empty entries
      // fall back to numbered defaults. Callers (e.g. a plague-treatment board)
      // populate this to label each step. See buildHeaderCells().
      columns: new fields.ArrayField(
        new fields.SchemaField({
          icon: new fields.StringField({ required: true, blank: true, initial: "" }),
          tooltip: new fields.StringField({ required: true, blank: true, initial: "" })
        }),
        { initial: [] }
      ),
      // Optional board-level "general alarm" meter. enabled = the GM has added
      // it; level indexes ALARM_STAGES.
      alarm: new fields.SchemaField({
        enabled: new fields.BooleanField({ initial: false }),
        level: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 })
      })
    };
  }

  static defaultRows() {
    return [
      { label: "Players", filled: 0, total: DEFAULT_BOXES, events: [] },
      { label: "Opponent 1", filled: 0, total: DEFAULT_BOXES, events: [] }
    ];
  }

  static nextOpponentLabel(existingRows) {
    const taken = new Set(existingRows.map(r => r.label));
    let n = 1;
    while (taken.has(`Opponent ${n}`)) n++;
    return `Opponent ${n}`;
  }
}
