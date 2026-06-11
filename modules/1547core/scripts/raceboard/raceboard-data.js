const { TypeDataModel } = foundry.abstract;
const fields = foundry.data.fields;

export const MIN_TRACKS = 1;
export const MAX_TRACKS = 6;
export const MIN_BOXES = 1;
export const DEFAULT_BOXES = 3;

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
      )
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
