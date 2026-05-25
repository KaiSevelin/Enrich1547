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
 *   { kind: "actor.statusEffect", actorId, keyword: "dead"|"defeated"|"unconscious", active }
 *
 * Combatant.defeated synchronisation is a separate concern (different
 * document collection) — the orchestrator's wrapper handles that after
 * applying these patches.
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
 * `actor`. Returns the HP patch plus three status-effect patches that
 * track dead / defeated / unconscious.
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
            { kind: "actor.statusEffect", actorId: actor.id, keyword: "defeated", active: isDead },
            { kind: "actor.statusEffect", actorId: actor.id, keyword: "unconscious", active: isUnconscious },
        ],
        result: { previousHitPoints, currentHitPoints, isDead, isUnconscious },
    };
}
