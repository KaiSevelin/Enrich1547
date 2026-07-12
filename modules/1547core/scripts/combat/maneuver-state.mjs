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
// Costs backed by a derived Spent/Reserved/Available pool on the actor
// template would be spent by INCREMENTING a stored `Spent<Name>Points`
// field (Available = Max - Spent - Reserved recomputes) instead of
// decrementing a raw pool prop. The map is EMPTY (2026-07-12): the live
// actor template stores Core as a single raw `CorePoints` prop — the old
// `CorePoints: "Core"` mapping wrote a phantom SpentCorePoints field the
// sheet never displayed, which is why Core Points "were never deducted".
// Re-add a mapping only together with matching Max/Spent template fields.
export const DERIVED_POOL_COSTS = {};

/**
 * Resolve the single actor prop and its next value for spending `amount`
 * of `costType`. Derived pools (Core) increment `Spent<Name>Points`
 * clamped to `Max<Name>Points`; legacy base costs decrement
 * `system.props.<costType>` (floored at 0). Shared by both the
 * committed-maneuver and reserved-pre-maneuver spend paths.
 */
export function planPoolSpend(actor, costType, amount) {
    const poolName = DERIVED_POOL_COSTS[costType];
    if (poolName) {
        const prop = `Spent${poolName}Points`;
        const previousValue = firstFiniteNumber([actor.system?.props?.[prop]]) ?? 0;
        const max = firstFiniteNumber([actor.system?.props?.[`Max${poolName}Points`]]);
        let nextValue = previousValue + amount;
        if (max != null) nextValue = Math.min(nextValue, max);
        return { prop, previousValue, nextValue };
    }
    const previousValue = firstFiniteNumber([
        actor.system?.props?.[costType],
        actor.system?.[costType],
    ]) ?? 0;
    return { prop: costType, previousValue, nextValue: Math.max(0, previousValue - amount) };
}

export function planSpendActorManeuverCost(actor, maneuver) {
    const costType = String(maneuver?.CostType ?? "").trim();
    const costAmount = Math.max(0, Number(maneuver?.CostAmount ?? 0) || 0);
    if (!actor?.id || !costType || costType === "null" || costAmount <= 0) {
        return { patches: [], result: null };
    }

    const { prop, previousValue, nextValue } = planPoolSpend(actor, costType, costAmount);

    return {
        patches: [
            {
                kind: "actor.update",
                actorId: actor.id,
                data: { [`system.props.${prop}`]: nextValue },
            },
        ],
        result: {
            costType,
            spentProp: prop,
            previousValue,
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
