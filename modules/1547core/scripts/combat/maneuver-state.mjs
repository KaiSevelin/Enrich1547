/**
 * combat/maneuver-state.mjs
 *
 * Patch-returner module for the actor-side state that committed
 * maneuvers leave behind:
 *
 *   - Resource cost spending (Strength/Stamina/Dexterity/Critical/...
 *     points get decremented by `CostAmount`).
 *   - Persistent-effect tracking: the committed maneuver record is
 *     appended to `actor.flags["1547core"].activeFullTurnManeuvers`.
 *
 * Plus one pure helper for the record shape itself.
 *
 * Pure/patch-returner contract:
 *
 *   buildCommittedManeuverRecord(maneuver) -> record
 *   planSpendActorManeuverCost(actor, maneuver) -> { patches, result }
 *   planAppendCommittedManeuverState(actor, record) -> { patches, result }
 *
 * Patch shape: `{ kind: "actor.update", actorId, data }` for both.
 */

import { firstFiniteNumber } from "./normalisation.mjs";
import { MODULE_ID } from "../lib/constants.mjs";


export function buildCommittedManeuverRecord(maneuver) {
    return {
        id: maneuver?._id ?? maneuver?.id ?? maneuver?.name ?? null,
        name: maneuver?.name ?? "Maneuver",
        type: maneuver?.type ?? "full-turn",
        triggerType: maneuver?.triggerType ?? "full-turn-activation",
        committedAt: Date.now(),
        duration: maneuver?.effectData?.duration ?? null,
        createsPersistentEffect: maneuver?.effectData?.createsPersistentEffect ?? null,
        effectData: maneuver?.effectData ?? {},
    };
}

/**
 * Plan the actor.update needed to decrement the resource pool a
 * maneuver charges. Returns `{ patches: [], result: null }` when the
 * maneuver has no cost (or is otherwise free).
 */
export function planSpendActorManeuverCost(actor, maneuver) {
    const costType = String(maneuver?.CostType ?? "").trim();
    const costAmount = Math.max(0, Number(maneuver?.CostAmount ?? 0) || 0);
    if (!actor?.id || !costType || costType === "null" || costAmount <= 0) {
        return { patches: [], result: null };
    }

    const currentValue = firstFiniteNumber([
        actor.system?.props?.[costType],
        actor.system?.[costType],
    ]) ?? 0;
    const nextValue = Math.max(0, currentValue - costAmount);

    return {
        patches: [
            {
                kind: "actor.update",
                actorId: actor.id,
                data: { [`system.props.${costType}`]: nextValue },
            },
        ],
        result: {
            costType,
            previousValue: currentValue,
            nextValue,
            costAmount,
        },
    };
}

/**
 * Plan the actor.update that adds `record` to the active full-turn
 * maneuvers list (overwriting any prior entry with the same id).
 * Returns `{ patches: [], result: { appended: false } }` when there's
 * nothing to record.
 */
export function planAppendCommittedManeuverState(actor, record) {
    if (!actor?.id || !record?.id) {
        return { patches: [], result: { appended: false } };
    }
    const currentFlags = actor.flags?.[MODULE_ID] ?? {};
    const activeFullTurnManeuvers = Array.isArray(currentFlags.activeFullTurnManeuvers)
        ? currentFlags.activeFullTurnManeuvers
        : [];
    const nextActive = [
        ...activeFullTurnManeuvers.filter((entry) => entry?.id !== record.id),
        record,
    ];
    return {
        patches: [
            {
                kind: "actor.update",
                actorId: actor.id,
                data: { [`flags.${MODULE_ID}.activeFullTurnManeuvers`]: nextActive },
            },
        ],
        result: { appended: true },
    };
}
