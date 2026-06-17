// Click modifier on a HUD roll button: ALT/SHIFT → advantage (+1 die on the base
// pool), CTRL/Cmd → disadvantage (-1 die, never below 1d6). Adjusts the first
// dice term of the formula so it applies uniformly to stat / skill / attack rolls.
// (The event → "advantage"/"disadvantage" mapping is set on context.rollModifier
// in hud-bindings; pure formula logic lives here so it can be unit-tested.)
export function applyRollClickModifier(formula, modifier) {
    if (!modifier || !formula) return formula;
    const str = String(formula);
    const m = str.match(/(\d+)d([a-z0-9]+)/i);
    if (!m) return formula;
    const count = Number(m[1]) || 1;
    if (modifier === "advantage") {
        return str.replace(m[0], `${count + 1}d${m[2]}`);
    }
    // Disadvantage: one fewer die (never below 1d6) AND drop a trailing flat "+N"
    // bonus, so e.g. a "1d6 + 3" stat roll becomes a bare "1d6". (Pure dice terms
    // like "+1dr" are not stripped — only a flat numeric bonus.)
    return str
        .replace(m[0], `${Math.max(1, count - 1)}d${m[2]}`)
        .replace(/\s*\+\s*\d+\s*$/, "");
}
