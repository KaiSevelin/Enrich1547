import { MODULE_ID } from "../lib/constants.mjs";
/**
 * combat/persistent-effects.mjs
 *
 * Persistent effects are flag-stored "until consumed" maneuvers an
 * actor carries between turns (canonical example: overwatch). They
 * live at `actor.flags["1547core"].activeFullTurnManeuvers` as an
 * array; entries with a non-empty `createsPersistentEffect` value
 * count as active.
 *
 * Pure / patch-returner module per CONTEXT.md.
 *
 *   getActivePersistentEffects(actor, options) -> entry[]
 *   planConsumePersistentEffect(actor, effectType) -> { patches, result: { consumed } }
 *
 * Patch shape: `{ kind: "actor.update", actorId, data }` — the array
 * is rewritten in one update.
 */


/**
 * Returns the currently-active persistent-effect entries on `actor`.
 * Some entries opt-out when their owning side is active again in the
 * current combat — those are filtered out when `isCombatActive &&
 * fullTurnAvailable`.
 */
export function getActivePersistentEffects(actor, {
    isCombatActive = false,
    fullTurnAvailable = false,
} = {}) {
    const active = Array.isArray(actor?.flags?.[MODULE_ID]?.activeFullTurnManeuvers)
        ? actor.flags[MODULE_ID].activeFullTurnManeuvers
        : [];

    return active.filter((entry) => {
        const effectType = String(entry?.createsPersistentEffect ?? "").trim();
        if (!effectType) return false;
        const duration = String(entry?.duration ?? "").trim().toLowerCase();
        if (
            isCombatActive
            && fullTurnAvailable
            && ["until-side-active-again", "until-side-active-again-or-consumed"].includes(duration)
        ) {
            return false;
        }
        return true;
    });
}

/**
 * Compute the patch needed to remove the first persistent effect of
 * `effectType` from `actor`. Returns `{ consumed: false }` in the
 * result when no matching effect exists (and no patches).
 */
export function planConsumePersistentEffect(actor, effectType) {
    const normalizedType = String(effectType ?? "").trim();
    if (!actor?.id || !normalizedType) {
        return { patches: [], result: { consumed: false } };
    }
    const currentFlags = actor.flags?.[MODULE_ID] ?? {};
    const active = Array.isArray(currentFlags.activeFullTurnManeuvers)
        ? currentFlags.activeFullTurnManeuvers
        : [];
    const targetIndex = active.findIndex(
        (entry) => String(entry?.createsPersistentEffect ?? "").trim() === normalizedType
    );
    if (targetIndex < 0) {
        return { patches: [], result: { consumed: false } };
    }
    const nextActive = [...active.slice(0, targetIndex), ...active.slice(targetIndex + 1)];
    return {
        patches: [
            {
                kind: "actor.update",
                actorId: actor.id,
                data: { [`flags.${MODULE_ID}.activeFullTurnManeuvers`]: nextActive },
            },
        ],
        result: { consumed: true },
    };
}
