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
import { onCombatEvent, COMBAT_EVENTS } from "../services/combat-events.js";
import { getActiveSideId, getOrderedCombatants, resolveCombatantSideId } from "../combat-tracker/side-tracker.js";

// Tile geometry needs a grid. Only a truly *gridless* scene can't do facing —
// everything else (square; and, lacking a better tile model, hex) is treated as
// usable so facing isn't silently disabled on a normal map.
function isSquareGridded() {
    const g = globalThis.canvas?.grid;
    if (!g) return false;
    const gridless = globalThis.CONST?.GRID_TYPES?.GRIDLESS ?? 0;
    return g.type !== gridless;
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

// Rotate a token with the facingAutoFace tag, routing the write to the GM when
// this client can't own it (e.g. a player's attack provokes a GM NPC's Face).
// Falls back to a direct update if the combat patch API isn't available. The tag
// lets the off-turn facing lock through.
async function rotateTokenTagged(tokenDoc, rotation) {
    const doc = tokenDoc?.document ?? tokenDoc;
    if (!doc || Number(doc.rotation) === rotation) return;
    const api = globalThis.game?.modules?.get?.("1547core")?.api?.combat;
    try {
        if (typeof api?.rotateTokenAuthoritative === "function") {
            await api.rotateTokenAuthoritative(doc, rotation);
        } else {
            await doc.update({ rotation }, { facingAutoFace: true });
        }
    } catch (_err) { /* non-fatal */ }
}

// Rotate the attacker to face its target (the one auto-applied facing action).
export async function autoFaceAttacker(attackerToken, defenderToken) {
    const doc = attackerToken?.document ?? attackerToken;
    if (!doc || !defenderToken || !isSquareGridded()) return;
    const attacker = tokenDescriptor(attackerToken);
    const defender = tokenDescriptor(defenderToken);
    if (!attacker || !defender) return;
    const { rotation } = facingToward(attacker, defender);
    await rotateTokenTagged(doc, rotation);
}

// The positional advantage applied to the attack pool. Applied up-front in all
// cases; a faceable rear shot is cancelled when the defender takes the Face
// reaction (which cancels the attacker's pending roll before it lands).
export function positionalAdvantageToApply(pos) {
    return Number(pos?.advantage) || 0;
}

// A short, human note for the attack card.
export function positioningNote(pos) {
    if (!pos) return "";
    if (pos.surprise) return "Surprise attack — +1 advantage applied (target is not yet in the fight).";
    if (pos.rear) {
        return pos.faceable
            ? "Rear attack — +1 advantage applied (target may Face to cancel it)."
            : "Rear attack — +1 advantage applied (target cannot turn to face).";
    }
    return "";
}

/* ---------------------------------------- */
/*  The Face reaction (rule 3)              */
/* ---------------------------------------- */

// A synthetic reaction candidate offered to a defender struck from a faceable
// rear position. Selecting it (in the reaction window) cancels the attacker's
// pending roll — dropping the rear +1 — and turns the defender to face. Shaped
// to match the engine's other reaction candidates (cf. the overwatch candidate).
export function buildFaceReactionCandidate(defenderActor, attackerActor) {
    if (!defenderActor) return null;
    return {
        id: `face:${defenderActor.id ?? defenderActor.uuid ?? "defender"}`,
        name: "Face Attacker",
        type: "reaction",
        usage: "Facing",
        triggerType: "attack-declared",
        sourceManeuverName: "Face Attacker",
        actor: defenderActor,
        target: attackerActor ?? null,
        weapon: null,
        profile: null,
        effectData: { facingFace: true },
        reasons: [],
        legal: true,
        CostType: null,
        CostAmount: 0,
    };
}

function activeToken(actor) {
    const toks = actor?.getActiveTokens?.(true) ?? actor?.getActiveTokens?.() ?? [];
    return toks?.[0] ?? null;
}

// Off-turn facing lock (facing spec rule 1 / Move 3): a token's rotation may
// change only on its own side's activation. Vetoes a player's rotation of an
// in-combat token when it isn't that token's side's turn. Bypasses: the GM, the
// auto-face / Face-reaction updates (tagged `facingAutoFace`), tagged forced
// updates, and any token not in the active combat. preUpdateToken fires only on
// the client making the change, so the veto is local and never desyncs.
export function registerFacingLock() {
    globalThis.Hooks?.on?.("preUpdateToken", (tokenDoc, changes, options, userId) => {
        try {
            if (!("rotation" in (changes ?? {}))) return true;
            const combat = globalThis.game?.combat;
            if (!combat?.started) return true;
            if (options?.facingAutoFace || options?.facingForced) return true;
            if (globalThis.game?.users?.get?.(userId)?.isGM) return true;
            const combatant = (combat.combatants ?? []).find?.((c) => c.tokenId === (tokenDoc?.id));
            if (!combatant) return true; // not a combatant in this fight → free
            const activeSideId = getActiveSideId(combat, getOrderedCombatants(combat));
            if (resolveCombatantSideId(combatant) === activeSideId) return true; // your turn
            globalThis.ui?.notifications?.info?.("Not your side's turn — you can't turn to face yet.");
            return false;
        } catch (_err) {
            return true; // never block on an internal error
        }
    });
}

// React to a resolved Face reaction by rotating the defender to face the
// attacker. Additive listener — never throws into the resolution flow.
export function registerFacingService() {
    onCombatEvent(COMBAT_EVENTS.REACTION_RESOLVED, async (event) => {
        try {
            const reaction = event?.payload?.reaction;
            if (!reaction?.effectData?.facingFace || !isSquareGridded()) return null;
            const defToken = activeToken(reaction.actor);
            const attToken = activeToken(reaction.target);
            if (!defToken || !attToken) return null;
            const { rotation } = facingToward(tokenDescriptor(defToken), tokenDescriptor(attToken));
            await rotateTokenTagged(defToken.document ?? defToken, rotation);
        } catch (_err) { /* non-fatal */ }
        return null;
    });
}
