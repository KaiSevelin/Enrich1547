/**
 * combat/movement-budget.mjs
 *
 * The per-turn movement budget rule, in one place.
 */

import { statDice } from "../lib/foundry-utils.mjs";

/**
 * The DEFAULT movement budget from stats, in squares: `StaminaDice +
 * (DexterityDice × 2)`. Each added Stamina die is +1 square, each added
 * Dexterity die is +2 (and removing dice subtracts the same). Strength is
 * deliberately excluded — including it produced too much movement.
 */
export function getMovementBudgetBase(actor) {
    return statDice(actor, "Stamina") + statDice(actor, "Dexterity") * 2;
}

/**
 * Non-stat movement adjustment, in squares. Signed — injuries (and any other
 * non-stat effect) write a value here, almost always negative. Stored in the
 * `MovementBudgetMod` prop so it survives independently of the derived base.
 */
export function getMovementBudgetModifier(actor) {
    return Number(actor?.system?.props?.MovementBudgetMod) || 0;
}

/**
 * A combatant's movement budget for one turn, in squares: the stat-derived
 * base plus any non-stat modifier (injuries, etc.), floored at 0. Derived live
 * so it always tracks the actor's current stat dice and injury state.
 */
export function getMovementBudget(actor) {
    return Math.max(0, getMovementBudgetBase(actor) + getMovementBudgetModifier(actor));
}
