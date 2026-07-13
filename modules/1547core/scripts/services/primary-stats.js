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
 * The ladder math (a stat's "steps") is the single source of truth in
 * foundry-primary-stats/stats.js. statIndex/indexToStat are kept here as the
 * combat-layer's names for statSteps/statFromSteps so existing callers don't
 * change, but they no longer carry a second copy of the formula.
 */

import { statSteps, statFromSteps } from "../../foundry/Templates/chargen/foundry-primary-stats/stats.js";

export const PRIMARY_STATS = [
    "Strength",
    "Dexterity",
    "Stamina",
    "Intelligence",
    "Faith",
    "Charisma",
    "Power"
];

// Stats whose dice feed the Max HP base (Str + Dex + Cha). Changing one of
// these adjusts MaxHitPoints by the dice delta — MaxHitPoints is a STORED
// field now (not a formula), so manual tweaks (injuries, boons) survive.
export const HIT_POINT_DRIVING_STATS = [
    "Strength",
    "Dexterity",
    "Charisma"
];

// Unified onto the canonical ladder math (statSteps / statFromSteps).
export const statIndex = statSteps;
export const indexToStat = statFromSteps;

export function getStatRating(actor, characteristic) {
    const props = actor?.system?.props ?? {};
    const dKey = `Stats_${characteristic}Dice`;
    const mKey = `Stats_${characteristic}Mod`;
    return {
        dice: Number(props[dKey] ?? 1),
        mod: Number(props[mKey] ?? 0)
    };
}

export function getDefaultMaxHitPointsFromProps(props = {}) {
    return Math.max(
        0,
        Number(props?.Stats_StrengthDice ?? 1)
        + Number(props?.Stats_DexterityDice ?? 1)
        + Number(props?.Stats_CharismaDice ?? 1)
    );
}

export function getStoredOrDefaultMaxHitPoints(actorOrProps) {
    const props = actorOrProps?.system?.props ?? actorOrProps ?? {};
    const stored = Number(props?.MaxHitPoints);
    return Number.isFinite(stored) ? stored : getDefaultMaxHitPointsFromProps(props);
}

function isHitPointDrivingStat(characteristic) {
    return HIT_POINT_DRIVING_STATS.includes(String(characteristic ?? ""));
}

export function buildAdvanceStatUpdateFromProps(props = {}, characteristic, steps) {
    const dKey = `Stats_${characteristic}Dice`;
    const mKey = `Stats_${characteristic}Mod`;

    const beforeDice = Number(props[dKey] ?? 1);
    const beforeMod = Number(props[mKey] ?? 0);
    const beforeIndex = statIndex(beforeDice, beforeMod);
    const afterIndex = Math.max(0, beforeIndex + Number(steps ?? 0));
    const { dice, mod } = indexToStat(afterIndex);

    const update = {
        [`system.props.${dKey}`]: dice,
        [`system.props.${mKey}`]: mod
    };

    if (isHitPointDrivingStat(characteristic)) {
        const currentMax = getStoredOrDefaultMaxHitPoints(props);
        const nextMax = Math.max(0, currentMax + (dice - beforeDice));
        update["system.props.MaxHitPoints"] = nextMax;
    }

    return { update, dice, mod };
}

export function buildSetStatUpdateFromProps(props = {}, characteristic, dice, mod) {
    const dKey = `Stats_${characteristic}Dice`;
    const mKey = `Stats_${characteristic}Mod`;

    const beforeDice = Number(props[dKey] ?? 1);
    const clampedDice = Math.max(1, Math.floor(Number(dice ?? 1)));
    const clampedMod = Math.max(0, Math.min(3, Math.floor(Number(mod ?? 0))));

    const update = {
        [`system.props.${dKey}`]: clampedDice,
        [`system.props.${mKey}`]: clampedMod
    };

    if (isHitPointDrivingStat(characteristic)) {
        const currentMax = getStoredOrDefaultMaxHitPoints(props);
        const nextMax = Math.max(0, currentMax + (clampedDice - beforeDice));
        update["system.props.MaxHitPoints"] = nextMax;
    }

    return { update, dice: clampedDice, mod: clampedMod };
}

export async function advanceStat(actor, characteristic, steps) {
    const props = actor.system?.props ?? {};
    const { update, dice, mod } = buildAdvanceStatUpdateFromProps(props, characteristic, steps);
    await actor.update(update);

    return { dice, mod };
}

export async function setStat(actor, characteristic, dice, mod) {
    const props = actor.system?.props ?? {};
    const result = buildSetStatUpdateFromProps(props, characteristic, dice, mod);
    await actor.update(result.update);
    return { dice: result.dice, mod: result.mod };
}
