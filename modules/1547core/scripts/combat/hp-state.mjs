/**
 * combat/hp-state.mjs
 *
 * Hit-point reads + damage-application patch planning.
 *
 *   getActorCurrentHitPoints(actor) -> number
 *   planApplyDamage(actor, damageApplied) -> { patches, result }
 *
 * Patches returned:
 *   { kind: "actor.update",       actorId, data: { "system.props.CurrentHitPoints": n } }
 *   { kind: "actor.statusEffect", actorId, keyword: "dead"|"unconscious", active }
 *
 * `dead` alone marks a 0-HP outcome (by ruling — we no longer also set a
 * `defeated` *status*). The Foundry combatant `defeated` flag is a separate
 * concern (different document collection) that the orchestrator's wrapper syncs
 * after applying these patches — it gates movement-reaction targeting / the
 * tracker and is still set.
 */

import { firstFiniteNumber } from "./normalisation.mjs";

export function getActorCurrentHitPoints(actor) {
    const props = actor?.system?.props ?? {};
    return firstFiniteNumber([
        props?.CurrentHitPoints,
        props?.HitPoints,
        props?.HP,
        props?.CurrentHP,
    ]) ?? 0;
}

/**
 * Compute the patches required to apply `damageApplied` HP loss to
 * `actor`. Returns the HP patch plus two status-effect patches that
 * track dead / unconscious.
 */
export function planApplyDamage(actor, damageApplied) {
    if (!actor?.id) {
        return {
            patches: [],
            result: { previousHitPoints: null, currentHitPoints: null, isDead: false, isUnconscious: false },
        };
    }

    const previousHitPoints = getActorCurrentHitPoints(actor);
    const damage = Math.max(0, Number(damageApplied) || 0);
    const currentHitPoints = Math.max(0, previousHitPoints - damage);

    const isDead = currentHitPoints <= 0;
    const isUnconscious = !isDead && currentHitPoints <= 1;

    return {
        patches: [
            {
                kind: "actor.update",
                actorId: actor.id,
                data: { "system.props.CurrentHitPoints": currentHitPoints },
            },
            { kind: "actor.statusEffect", actorId: actor.id, keyword: "dead", active: isDead },
            { kind: "actor.statusEffect", actorId: actor.id, keyword: "unconscious", active: isUnconscious },
        ],
        result: { previousHitPoints, currentHitPoints, isDead, isUnconscious },
    };
}
