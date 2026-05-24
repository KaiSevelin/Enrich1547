/**
 * Primary stat helpers for 1547.
 *
 * Primary stats use a d6-based ladder:
 *   1d6, 1d6+1, 1d6+2, 1d6+3, 2d6, 2d6+1, 2d6+2, 2d6+3, 3d6, ...
 *
 * Storage convention (on actor.system.props):
 *   Stats_{Name}Dice  (number, default 1)
 *   Stats_{Name}Mod   (number, default 0, range 0-3)
 *
 * Ladder index <-> (dice, mod):
 *   index = (dice - 1) * 4 + mod
 *   dice  = floor(index / 4) + 1
 *   mod   = index % 4
 *
 * TODO: chargen1547_v2 currently holds its own copy of these helpers
 *       (foundry-primary-stats/stats.js + chargen.js lines 5279-5311).
 *       Refactor chargen to import from this file and delete its local copy.
 */

export const PRIMARY_STATS = [
    "Strength",
    "Dexterity",
    "Stamina",
    "Intelligence",
    "Faith",
    "Charisma",
    "Power"
];

export function statIndex(dice, mod) {
    return (dice - 1) * 4 + mod;
}

export function indexToStat(index) {
    const clamped = Math.max(0, index);
    return {
        dice: Math.floor(clamped / 4) + 1,
        mod: clamped % 4
    };
}

export function getStatRating(actor, characteristic) {
    const props = actor?.system?.props ?? {};
    const dKey = `Stats_${characteristic}Dice`;
    const mKey = `Stats_${characteristic}Mod`;
    return {
        dice: Number(props[dKey] ?? 1),
        mod: Number(props[mKey] ?? 0)
    };
}

export async function advanceStat(actor, characteristic, steps) {
    const dKey = `Stats_${characteristic}Dice`;
    const mKey = `Stats_${characteristic}Mod`;

    const props = actor.system?.props ?? {};
    const beforeDice = Number(props[dKey] ?? 1);
    const beforeMod = Number(props[mKey] ?? 0);

    const beforeIndex = statIndex(beforeDice, beforeMod);
    const afterIndex = Math.max(0, beforeIndex + Number(steps ?? 0));

    const { dice, mod } = indexToStat(afterIndex);

    await actor.update({
        [`system.props.${dKey}`]: dice,
        [`system.props.${mKey}`]: mod
    });

    return { dice, mod };
}

export async function setStat(actor, characteristic, dice, mod) {
    const dKey = `Stats_${characteristic}Dice`;
    const mKey = `Stats_${characteristic}Mod`;

    const clampedDice = Math.max(1, Math.floor(Number(dice ?? 1)));
    const clampedMod = Math.max(0, Math.min(3, Math.floor(Number(mod ?? 0))));

    await actor.update({
        [`system.props.${dKey}`]: clampedDice,
        [`system.props.${mKey}`]: clampedMod
    });

    return { dice: clampedDice, mod: clampedMod };
}
