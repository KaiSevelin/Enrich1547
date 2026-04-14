export const DICE1547_MODULE_ID = "dice1547" as const;
export const DICE1547_ROLL_RESULT_HOOK = "dice1547RollResult" as const;

export type Dice1547DieType =
    | "armor"
    | "balanced"
    | "control"
    | "evade"
    | "grace"
    | "heavy"
    | "lethality"
    | "multiplier"
    | "penetration"
    | "risk";

export type Dice1547Denomination =
    | "a"
    | "b"
    | "c"
    | "e"
    | "g"
    | "h"
    | "l"
    | "x"
    | "p"
    | "r";

export interface Dice1547Totals {
    protection: number;
    damage: number;
    crit: number;
    fumble: number;
    multiplier: number;
}

export interface Dice1547DieFaceResult {
    result: 1 | 2 | 3 | 4 | 5 | 6;
    active?: boolean;
    discarded?: boolean;
    exploded?: boolean;
    rerolled?: boolean;
    counted?: boolean;
    totals: Partial<Dice1547Totals>;
}

export interface Dice1547DieResult {
    type: Dice1547DieType;
    formula: string;
    number: number;
    faces: Dice1547DieFaceResult[];
}

export interface Dice1547RollResult {
    chatMessageId: string;
    authorId: string | null;
    dice: Dice1547DieResult[];
    totals: Dice1547Totals;
}

export interface Dice1547FaceEffect {
    face: 1 | 2 | 3 | 4 | 5 | 6;
    label: string;
    totals: Partial<Dice1547Totals>;
    notes?: string;
}

export interface Dice1547DieSpec {
    type: Dice1547DieType;
    denomination: Dice1547Denomination;
    faces: readonly Dice1547FaceEffect[];
}

export interface Dice1547Api {
    getRollResult(messageOrId: string | ChatMessage): Dice1547RollResult | null;
}

export const DICE1547_DIE_SPECS: Record<Dice1547DieType, Dice1547DieSpec> = {
    armor: {
        type: "armor",
        denomination: "a",
        faces: [
            { face: 1, label: "fumble", totals: { fumble: 1 } },
            { face: 2, label: "blank", totals: {} },
            { face: 3, label: "protection 1", totals: { protection: 1 } },
            { face: 4, label: "protection 2", totals: { protection: 2 } },
            { face: 5, label: "protection 4", totals: { protection: 4 } },
            { face: 6, label: "critical", totals: { crit: 1 } }
        ]
    },
    balanced: {
        type: "balanced",
        denomination: "b",
        faces: [
            { face: 1, label: "fumble", totals: { fumble: 1 } },
            { face: 2, label: "blank", totals: {} },
            { face: 3, label: "damage 1", totals: { damage: 1 } },
            { face: 4, label: "damage 1", totals: { damage: 1 } },
            { face: 5, label: "damage 2", totals: { damage: 2 } },
            { face: 6, label: "critical", totals: { crit: 1 } }
        ]
    },
    control: {
        type: "control",
        denomination: "c",
        faces: [
            { face: 1, label: "fumble", totals: { fumble: 1 } },
            { face: 2, label: "blank", totals: {} },
            { face: 3, label: "blank", totals: {} },
            { face: 4, label: "damage 1", totals: { damage: 1 } },
            { face: 5, label: "critical", totals: { crit: 1 } },
            { face: 6, label: "critical", totals: { crit: 1 } }
        ]
    },
    evade: {
        type: "evade",
        denomination: "e",
        faces: [
            { face: 1, label: "fumble", totals: { fumble: 1 } },
            { face: 2, label: "blank", totals: {} },
            { face: 3, label: "protection 1", totals: { protection: 1 } },
            { face: 4, label: "protection 2", totals: { protection: 2 } },
            { face: 5, label: "critical", totals: { crit: 1 } },
            { face: 6, label: "critical", totals: { crit: 1 } }
        ]
    },
    grace: {
        type: "grace",
        denomination: "g",
        faces: [
            { face: 1, label: "blank", totals: {} },
            { face: 2, label: "blank", totals: {} },
            { face: 3, label: "damage 1", totals: { damage: 1 } },
            { face: 4, label: "damage 1", totals: { damage: 1 } },
            { face: 5, label: "critical", totals: { crit: 1 } },
            { face: 6, label: "critical", totals: { crit: 1 } }
        ]
    },
    heavy: {
        type: "heavy",
        denomination: "h",
        faces: [
            { face: 1, label: "fumble", totals: { fumble: 1 } },
            { face: 2, label: "fumble", totals: { fumble: 1 } },
            { face: 3, label: "damage 1", totals: { damage: 1 } },
            { face: 4, label: "damage 2", totals: { damage: 2 } },
            { face: 5, label: "damage 4", totals: { damage: 4 } },
            { face: 6, label: "critical", totals: { crit: 1 } }
        ]
    },
    lethality: {
        type: "lethality",
        denomination: "l",
        faces: [
            { face: 1, label: "fumble", totals: { fumble: 1 } },
            { face: 2, label: "fumble", totals: { fumble: 1 } },
            { face: 3, label: "damage 2", totals: { damage: 2 } },
            { face: 4, label: "damage 3", totals: { damage: 3 } },
            { face: 5, label: "damage 5", totals: { damage: 5 } },
            { face: 6, label: "critical", totals: { crit: 1 } }
        ]
    },
    multiplier: {
        type: "multiplier",
        denomination: "x",
        faces: [
            { face: 1, label: "0x", totals: { multiplier: 0 }, notes: "Sets the final multiplier to 0." },
            { face: 2, label: "blank", totals: {} },
            { face: 3, label: "blank", totals: {} },
            { face: 4, label: "2x", totals: { multiplier: 2 }, notes: "Internally increments the running multiplier by 1." },
            { face: 5, label: "2x", totals: { multiplier: 2 }, notes: "Internally increments the running multiplier by 1." },
            { face: 6, label: "3x", totals: { multiplier: 3 }, notes: "Internally increments the running multiplier by 2." }
        ]
    },
    penetration: {
        type: "penetration",
        denomination: "p",
        faces: [
            { face: 1, label: "fumble", totals: { fumble: 1 } },
            { face: 2, label: "blank", totals: {} },
            { face: 3, label: "damage 1", totals: { damage: 1 } },
            { face: 4, label: "damage 1", totals: { damage: 1 } },
            { face: 5, label: "damage 3", totals: { damage: 3 } },
            { face: 6, label: "critical", totals: { crit: 1 } }
        ]
    },
    risk: {
        type: "risk",
        denomination: "r",
        faces: [
            { face: 1, label: "0x", totals: { multiplier: 0 }, notes: "Sets the final multiplier to 0." },
            { face: 2, label: "fumble", totals: { fumble: 1 } },
            { face: 3, label: "fumble", totals: { fumble: 1 } },
            { face: 4, label: "blank", totals: {} },
            { face: 5, label: "damage 2", totals: { damage: 2 } },
            { face: 6, label: "critical", totals: { crit: 1 } }
        ]
    }
};

declare global {
    interface HookCallbacks {
        [DICE1547_ROLL_RESULT_HOOK]: (
            result: Dice1547RollResult,
            message: ChatMessage
        ) => void;
    }
}

/*
Example consumer usage:

Hooks.on(DICE1547_ROLL_RESULT_HOOK, (result, message) => {
    for (const die of result.dice) {
        console.log(die.type, die.faces.map((face) => face.result));
    }
});

const api = game.modules.get(DICE1547_MODULE_ID)?.api as Dice1547Api | undefined;
const result = api?.getRollResult(message.id);
*/

