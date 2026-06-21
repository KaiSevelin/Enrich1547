export const PRIMARY_STATS = [
    "Strength",
    "Dexterity",
    "Stamina",
    "Intelligence",
    "Faith",
    "Charisma",
    "Power"
]

/**
 * A primary stat's calculated value, in "steps" up the d6 ladder from 1d6 = 0.
 * Each die spans four modifier steps (+0..+3) before rolling to the next die:
 *
 *   0 = 1d6     1 = 1d6+1   2 = 1d6+2   3 = 1d6+3
 *   4 = 2d6     5 = 2d6+1   6 = 2d6+2   7 = 2d6+3
 *   8 = 3d6     ...
 *
 * Stored on actor.system.props as Stats_{Name}Dice (default 1) and
 * Stats_{Name}Mod (default 0, range 0-3). This is the single source of truth
 * for ordering/comparing stats; advancing a stat adds steps to this value.
 */
export function statSteps(dice, mod) {
    return (Number(dice) - 1) * 4 + Number(mod);
}

/** Inverse of statSteps: a step count back to { dice, mod } (mod 0-3, dice >= 1). */
export function statFromSteps(steps) {
    const clamped = Math.max(0, Math.floor(Number(steps) || 0));
    return {
        dice: Math.floor(clamped / 4) + 1,
        mod: clamped % 4
    };
}

export default PRIMARY_STATS;

