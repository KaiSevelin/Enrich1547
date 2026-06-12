const { TypeDataModel } = foundry.abstract;
const fields = foundry.data.fields;

export const MIN_TRACKS = 1;
export const MAX_TRACKS = 6;
export const MIN_BOXES = 1;
export const DEFAULT_BOXES = 3;

// Alarm meter escalation stages (Eye / awareness theme). Level indexes this
// array; the last entry is the top alarm. Add entries to extend the range —
// no other code needs to change.
export const ALARM_STAGES = [
  { icon: "fa-eye-slash", labelKey: "RACEBOARD.AlarmUnaware" },
  { icon: "fa-eye",       labelKey: "RACEBOARD.AlarmSuspicious" },
  { icon: "fa-eye",       labelKey: "RACEBOARD.AlarmSearching" },
  { icon: "fa-eye",       labelKey: "RACEBOARD.AlarmHunting" },
  { icon: "fa-skull",     labelKey: "RACEBOARD.AlarmFound" }
];
export const ALARM_MAX_LEVEL = ALARM_STAGES.length - 1;

/** Default alarm sub-state for a fresh / un-alarmed board. */
export function defaultAlarm() {
  return { enabled: false, level: 0 };
}

/**
 * Build the render context for the alarm meter. The alarm (like the colored
 * event squares) is hidden from players unless the GM has flipped the board's
 * `revealToPlayers` switch.
 */
export function buildAlarmContext(alarm, { isGM, revealToPlayers, canControl }) {
  const a = alarm ?? defaultAlarm();
  const level = Math.max(0, Math.min(ALARM_MAX_LEVEL, a.level ?? 0));
  const stage = ALARM_STAGES[level];
  return {
    enabled: !!a.enabled,
    show: !!a.enabled && (isGM || !!revealToPlayers),
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
      // When true, players also see the colored event squares and the alarm
      // meter. Default false: players get a plain board with neither.
      revealToPlayers: new fields.BooleanField({ initial: false }),
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
