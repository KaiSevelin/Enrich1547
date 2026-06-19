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
 *   - If TWO OR MORE distinct players start a combat, they must always be on
 *     different sides: distinct player owners are distributed round-robin
 *     across team-1 / team-2 (player A -> team-1, B -> team-2, C -> team-1...).
 *     All of one player's combatants stay together on that player's side.
 *     Non-player (GM/NPC) combatants fall back to disposition.
 *   - With fewer than two distinct players, NOTHING is overridden — the
 *     existing per-combatant disposition default stands (assignSides returns
 *     an empty map, signalling "leave defaults alone").
 *   - Side turn order is the 3d6 side-initiative result, highest first,
 *     fixed for the whole combat (ties keep their incoming order).
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
 *   gets team-1 vs team-2, and the disposition fallback for NPCs).
 * @returns {Map<string,string>} combatantId -> sideId. Empty when there are
 *   fewer than two distinct players (caller should not override anything).
 */
export function assignSides(combatants = []) {
    const result = new Map();
    const list = Array.isArray(combatants) ? combatants.filter((c) => c && c.id) : [];

    // Distinct player owners, in first-appearance order.
    const ownerByCombatant = new Map();
    const playerOwnerOrder = [];
    for (const c of list) {
        const owner = primaryPlayerOwner(c.ownerUserIds);
        ownerByCombatant.set(c.id, owner);
        if (owner && !playerOwnerOrder.includes(owner)) playerOwnerOrder.push(owner);
    }

    // Fewer than two players: leave the existing defaults untouched.
    if (playerOwnerOrder.length < 2) return result;

    // Round-robin distinct players across the two teams.
    const sideForOwner = new Map();
    playerOwnerOrder.forEach((owner, index) => {
        sideForOwner.set(owner, index % 2 === 0 ? TEAM_ONE : TEAM_TWO);
    });

    for (const c of list) {
        const owner = ownerByCombatant.get(c.id);
        result.set(c.id, owner ? sideForOwner.get(owner) : dispositionSide(c.disposition));
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
