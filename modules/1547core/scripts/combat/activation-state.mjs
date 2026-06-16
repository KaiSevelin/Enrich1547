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
