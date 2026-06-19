/**
 * combat/side-assignment.mjs
 *
 * Pure logic for assigning combatants to sides at combat start and for
 * ordering the sides by their 3d6 side-initiative roll. No Foundry globals,
 * no Roll, no game.* — the Foundry-coupled wiring (ownership extraction,
 * rolling, setFlag, chat) lives in combat-tracker/side-tracker.js, which
 * feeds plain descriptors in and applies the results.
 *
 * Rules encoded here (see docs/specs/battle-flow-spec):
 *   - Players DEFAULT TO THE SAME SIDE. The one exception is a players-only
 *     fight (no NPC combatants): there the distinct players split round-robin
 *     across team-1 / team-2 (A -> team-1, B -> team-2, C -> team-1, ...), so a
 *     pure-PvP duel puts each player on their own side. In any MIXED fight
 *     (at least one NPC present) all players share team-1 and NPCs fall back to
 *     disposition — the co-op "party vs the GM's monsters" case.
 *   - All of one player's combatants stay together on that player's side.
 *   - With fewer than two distinct players, NOTHING is overridden — the
 *     existing per-combatant disposition default stands (assignSides returns
 *     an empty map, signalling "leave defaults alone").
 *   - Side turn order is the 3d6 side-initiative result, highest first, fixed
 *     for the whole combat; tied side rolls are re-rolled (roll-off) by the
 *     Foundry orchestrator before this ordering runs.
 *
 * Exports:
 *   primaryPlayerOwner(ownerUserIds) -> string | null
 *   dispositionSide(disposition) -> "team-1" | "team-2"
 *   assignSides(combatants) -> Map<combatantId, sideId>
 *   orderSidesByInitiative(sideIds, rollsBySide) -> sideId[]
 */

const TEAM_ONE = "team-1";
const TEAM_TWO = "team-2";

/**
 * The single player a combatant "belongs to" for round-robin grouping: the
 * lowest non-GM owner id (sorted so the choice is deterministic across
 * clients). Null when no player owns it (a GM/NPC combatant).
 */
export function primaryPlayerOwner(ownerUserIds = []) {
    const ids = Array.isArray(ownerUserIds)
        ? ownerUserIds.filter((id) => typeof id === "string" && id.trim())
        : [];
    if (!ids.length) return null;
    return [...ids].sort()[0];
}

/** Disposition fallback: friendly -> team-1, hostile/neutral/unknown -> team-2. */
export function dispositionSide(disposition) {
    const value = Number(disposition);
    if (Number.isFinite(value) && value > 0) return TEAM_ONE;
    if (Number.isFinite(value) && value < 0) return TEAM_TWO;
    return TEAM_TWO;
}

/**
 * Assign combatants to sides at combat start.
 *
 * @param {Array<{id:string, ownerUserIds?:string[], disposition?:number}>} combatants
 *   Combatants in their tracker order (order matters: it fixes which player
 *   gets team-1 vs team-2 in a duel, and the disposition fallback for NPCs).
 * @returns {Map<string,string>} combatantId -> sideId. Empty when there are
 *   fewer than two distinct players (caller should not override anything).
 */
export function assignSides(combatants = []) {
    const result = new Map();
    const list = Array.isArray(combatants) ? combatants.filter((c) => c && c.id) : [];

    // Distinct player owners (first-appearance order) and whether any NPC is in.
    const ownerByCombatant = new Map();
    const playerOwnerOrder = [];
    let hasNpc = false;
    for (const c of list) {
        const owner = primaryPlayerOwner(c.ownerUserIds);
        ownerByCombatant.set(c.id, owner);
        if (owner) {
            if (!playerOwnerOrder.includes(owner)) playerOwnerOrder.push(owner);
        } else {
            hasNpc = true;
        }
    }

    // Fewer than two players: leave the existing defaults untouched.
    if (playerOwnerOrder.length < 2) return result;

    // Mixed fight (any NPC present): co-op default — all players share a side,
    // NPCs fall back to disposition.
    if (hasNpc) {
        for (const c of list) {
            const owner = ownerByCombatant.get(c.id);
            result.set(c.id, owner ? TEAM_ONE : dispositionSide(c.disposition));
        }
        return result;
    }

    // Players-only fight: a duel/PvP — distinct players round-robin across teams.
    const sideForOwner = new Map();
    playerOwnerOrder.forEach((owner, index) => {
        sideForOwner.set(owner, index % 2 === 0 ? TEAM_ONE : TEAM_TWO);
    });
    for (const c of list) {
        result.set(c.id, sideForOwner.get(ownerByCombatant.get(c.id)));
    }
    return result;
}

/**
 * Order side ids by their side-initiative total, highest first. Ties keep the
 * order they appear in `sideIds` (stable). Sides with no roll sort to 0.
 *
 * @param {string[]} sideIds
 * @param {Map<string,number>|Record<string,number>} rollsBySide
 * @returns {string[]}
 */
export function orderSidesByInitiative(sideIds = [], rollsBySide = new Map()) {
    const get = (id) => {
        const value = rollsBySide instanceof Map ? rollsBySide.get(id) : rollsBySide?.[id];
        const n = Number(value);
        return Number.isFinite(n) ? n : 0;
    };
    const order = Array.isArray(sideIds) ? [...sideIds] : [];
    return order
        .map((id, index) => ({ id, index, roll: get(id) }))
        .sort((a, b) => (b.roll - a.roll) || (a.index - b.index))
        .map((entry) => entry.id);
}
