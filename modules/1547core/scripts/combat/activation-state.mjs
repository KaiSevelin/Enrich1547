import { MODULE_ID } from "../lib/constants.mjs";

/* ------------------------------------------------------------------ */
/*  Per-actor activation state (combat-architecture-evolution Move 3)  */
/*                                                                     */
/*  Turn-scoped combat state that the side model didn't have a home    */
/*  for. Today it carries the once-per-round reaction economy: we store */
/*  the combat+round in which an actor last spent its reaction, so the  */
/*  reaction is "available" whenever the current combat+round differs — */
/*  it renews automatically each new round, with no reset pass, and the */
/*  combat id keeps a stale flag from a prior fight from matching.      */
/* ------------------------------------------------------------------ */

const REACTION_USED_KEY = "reactionUsedRound";

// A stable id for "this combat, this round" — `${combatId}:${round}`.
function reactionRoundKey(combat) {
    if (!combat?.id) return "";
    return `${combat.id}:${Number(combat.round) || 0}`;
}

// Has the actor NOT yet spent its reaction in the current combat round?
export function isReactionAvailable(actor, combat) {
    if (!actor) return true;
    const key = reactionRoundKey(combat);
    if (!key) return true; // no active round → economy is moot (e.g. out of combat)
    const used = String(actor?.flags?.[MODULE_ID]?.[REACTION_USED_KEY] ?? "");
    return used !== key;
}

// Patch set marking the actor's reaction spent for the current round. Applied
// through the combat patch dispatcher (so it routes to the GM when needed).
export function planMarkReactionUsed(actor, combat) {
    const key = reactionRoundKey(combat);
    if (!actor?.id || !key) return { patches: [] };
    return {
        patches: [{
            kind: "actor.setFlag",
            actorId: actor.id,
            scope: MODULE_ID,
            key: REACTION_USED_KEY,
            value: key,
        }],
    };
}

/* ----------------------------- movement reactions ------------------- */
// A separate economy from the attack reaction above: a reactor may take ONE
// movement (threat / overwatch) reaction against a GIVEN mover per round. Keyed
// per mover so reacting to opponent A doesn't spend the opportunity against B,
// and marked on *resolution* (pass or use) so declining the first opportunity
// doesn't re-trigger on the same mover's later steps this round.
const MOVE_REACT_PREFIX = "moveReact_";

export function isMovementReactionAvailable(reactor, mover, combat) {
    if (!reactor || !mover) return true;
    const key = reactionRoundKey(combat);
    if (!key) return true;
    const used = String(reactor?.flags?.[MODULE_ID]?.[`${MOVE_REACT_PREFIX}${mover.id}`] ?? "");
    return used !== key;
}

export function planMarkMovementReacted(reactor, mover, combat) {
    const key = reactionRoundKey(combat);
    if (!reactor?.id || !mover?.id || !key) return { patches: [] };
    return {
        patches: [{
            kind: "actor.setFlag",
            actorId: reactor.id,
            scope: MODULE_ID,
            key: `${MOVE_REACT_PREFIX}${mover.id}`,
            value: key,
        }],
    };
}
