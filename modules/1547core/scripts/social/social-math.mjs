/**
 * social/social-math.mjs (ADR-0004 sweep)
 *
 * Pure rules math for the Social Battle, extracted from social-battle.js so
 * it is unit-testable in node (the app file destructures
 * foundry.applications.api at module level and can't be imported headless).
 * social-battle.js imports these back — one implementation, tested here.
 */

export function numProp(props, key) {
    const v = props?.[key];
    if (v === undefined || v === null || v === "") return null;
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
}

// Skill dice shift: an explicit DiceShift prop wins; otherwise the shift for
// the skill's current level (Level<N>DiceShift), defaulting to 0.
export function skillDiceShift(props) {
    const explicit = numProp(props, "DiceShift");
    if (explicit !== null) return explicit;
    const lvl = numProp(props, "CurrentLevel") ?? 0;
    return numProp(props, `Level${lvl}DiceShift`) ?? 0;
}

// Marks dealt by one exchange: tie or loss = 0; a win = 1 mark; a win with
// MORE THAN DOUBLE the loser's total = 2 marks (a crushing argument).
export function marksFromExchange(winnerTotal, loserTotal) {
    if (winnerTotal <= loserTotal) return 0;
    return winnerTotal > 2 * loserTotal ? 2 : 1;
}

// The social pool formula: at least 1d6 always (an untrained or heavily
// disadvantaged pool never rolls a flat 0), modifier appended when nonzero.
export function socialPoolFormula(dice, mod) {
    const d = Math.max(0, Number(dice) || 0);
    const m = Number(mod) || 0;
    return d >= 1 ? (m ? `${d}d6 + ${m}` : `${d}d6`) : "1d6";
}
