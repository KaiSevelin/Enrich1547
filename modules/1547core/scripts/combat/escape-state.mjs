/**
 * combat/escape-state.mjs
 *
 * Pure helpers for resolving escape maneuvers (Break Grapple, Slip The
 * Lock, Break The Choke, Core Escape, Stand Up). The Foundry-side commit
 * (rolling, condition removal, chat) lives in the orchestrator; this
 * module holds the decision logic so it can be unit-tested.
 */

/**
 * Which conditions should this escape remove?
 *  - Core Escape (`removesAllHeld`): every listed condition the actor
 *    currently holds (clears Grappled + Locked + Choking Hold at once).
 *  - Everything else: the single listed condition, as authored.
 *
 * `actorHoldsCondition(name)` → boolean.
 */
export function planEscapeConditions(effect, actorHoldsCondition) {
    const raw = effect?.removesCondition;
    const list = Array.isArray(raw) ? raw : (raw ? [raw] : []);
    if (effect?.removesAllHeld) {
        return list.filter((name) => actorHoldsCondition(name));
    }
    return list;
}

/**
 * The d6 roll formula for a stat check: `<dice>d6 + <mod>` (mod omitted
 * when zero). Dice count comes from `Stats_<Stat>Dice`, the modifier from
 * `Stats_<Stat>Mod`. At least 1 die always rolls.
 */
export function statCheckFormula(props, statName) {
    const dice = Math.max(1, Number(props?.[`Stats_${statName}Dice`] ?? 0) || 0);
    const mod = Number(props?.[`Stats_${statName}Mod`] ?? 0) || 0;
    return mod ? `${dice}d6 + ${mod}` : `${dice}d6`;
}

/**
 * Opposed escape outcome: the escaper breaks free on a tie or better.
 * With no inflictor to contest (inflictorTotal null/undefined), the
 * escape simply succeeds.
 */
export function escapeSucceeds(escaperTotal, inflictorTotal) {
    if (inflictorTotal == null) return true;
    return Number(escaperTotal) >= Number(inflictorTotal);
}
