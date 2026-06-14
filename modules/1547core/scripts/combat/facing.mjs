/**
 * Combat-side facing glue (facing-and-positioning-spec-v1).
 *
 * Reads the live canvas / game.combat and delegates the geometry to the pure
 * lib/positioning.mjs. Implements the deterministic attack-time pieces:
 *   - autoFaceAttacker: rotate the attacker to face its target (rule 1).
 *   - getAttackPositioning: rear +1 / surprise / Hidden detection (rules 2,4,5).
 * The +1 is *surfaced as a suggestion* (positioningNote) — it is never
 * auto-applied to the attack pool; that stays a GM/player choice.
 */
import { tokenDescriptor, facingToward, computePositionalAdvantage } from "../lib/positioning.mjs";

// Square-gridded scenes only — the tile geometry is meaningless on a gridless or
// hex scene, so facing quietly does nothing there (the spec degrades to a GM call).
function isSquareGridded() {
    const g = globalThis.canvas?.grid;
    const T = globalThis.CONST?.GRID_TYPES;
    if (!g) return false;
    if (T) return g.type === T.SQUARE;
    return g.type === 1; // SQUARE === 1 in Foundry's grid-type enum
}

// True if the token (or its actor) is a combatant in the active encounter.
export function tokenInActiveCombat(token) {
    const combat = globalThis.game?.combat;
    if (!combat) return false;
    const tid = token?.id ?? token?.document?.id;
    const aid = token?.actor?.id;
    return (combat.combatants ?? []).some((c) => (tid && c.tokenId === tid) || (aid && c.actorId === aid));
}

// Positional standing of an attack. maxDist is the attacker→target distance
// (Chebyshev), so the rear cone reaches exactly to where the attacker stands.
// Returns null off-grid or with missing tokens.
export function getAttackPositioning(attackerToken, defenderToken, maxDist = 1) {
    if (!attackerToken || !defenderToken || !isSquareGridded()) return null;
    const attacker = tokenDescriptor(attackerToken);
    const defender = tokenDescriptor(defenderToken);
    if (!attacker || !defender) return null;
    const hidden = !!(attackerToken.document ?? attackerToken)?.hidden;
    return computePositionalAdvantage({
        attacker,
        defender,
        maxDist: Math.max(1, Number(maxDist) || 1),
        attackerHidden: hidden,
        defenderInCombat: tokenInActiveCombat(defenderToken)
    });
}

// Rotate the attacker to face its target (the one auto-applied facing action).
// The update is tagged so the future off-turn lock lets it through.
export async function autoFaceAttacker(attackerToken, defenderToken) {
    const doc = attackerToken?.document ?? attackerToken;
    if (!doc || !defenderToken || !isSquareGridded()) return;
    const attacker = tokenDescriptor(attackerToken);
    const defender = tokenDescriptor(defenderToken);
    if (!attacker || !defender) return;
    const { rotation } = facingToward(attacker, defender);
    if (Number(doc.rotation) === rotation) return;
    try {
        await doc.update({ rotation }, { facingAutoFace: true });
    } catch (_err) { /* non-fatal */ }
}

// A short, human note for the attack card when a positional bonus is available
// (suggestion only — the +1 is not added to the pool here).
export function positioningNote(pos) {
    if (!pos) return "";
    if (pos.surprise) return "Surprise attack — +1 advantage available (target is not yet in the fight).";
    if (pos.rear) return `Rear shot — +1 advantage available${pos.faceable ? "" : " (target cannot turn to face)"}.`;
    return "";
}
