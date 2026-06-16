import { laneTiles, gatherObstacles, rollInterception } from "../lib/lane.mjs";
import { tokenDescriptor, footprintTiles } from "../lib/positioning.mjs";

/* ------------------------------------------------------------------ */
/*  Ranged cover — live glue (cover-spec-v1)                           */
/*                                                                     */
/*  Canvas-aware wrapper over the pure lane geometry (lib/lane.mjs).    */
/*  v1: token obstacles only. The interception roll + the stray hit on  */
/*  the obstacle live in hud-actions.js (where the roll/resolve helpers */
/*  are); this module just answers "what's in the lane?".              */
/* ------------------------------------------------------------------ */

function centerCell(desc) {
    return {
        col: desc.col + Math.floor((desc.w || 1) / 2),
        row: desc.row + Math.floor((desc.h || 1) / 2),
    };
}

function occupantFromToken(token) {
    const desc = tokenDescriptor(token);
    const id = token?.id ?? token?.document?.id;
    if (!desc || !id) return null;
    const cells = new Set(footprintTiles(desc).map((t) => `${t.col},${t.row}`));
    return {
        id,
        name: token?.name ?? token?.document?.name ?? "Obstacle",
        size: Math.max(desc.w || 1, desc.h || 1),
        cells,
    };
}

// Ordered token obstacles between the shooter and target (nearest-first), with
// block values. Endpoints and off-lane tokens excluded.
export function laneObstacles(shooterToken, targetToken) {
    const sd = tokenDescriptor(shooterToken);
    const td = tokenDescriptor(targetToken);
    if (!sd || !td) return [];
    const lane = laneTiles(centerCell(sd), centerCell(td));
    const occupants = (globalThis.canvas?.tokens?.placeables ?? [])
        .map(occupantFromToken)
        .filter(Boolean);
    return gatherObstacles(lane, occupants, {
        shooterId: shooterToken?.id ?? shooterToken?.document?.id ?? null,
        targetId: targetToken?.id ?? targetToken?.document?.id ?? null,
    });
}

// Roll the live interception: a d6 per obstacle nearest-first; first ≤ block wins.
export function rollLaneInterception(obstacles) {
    return rollInterception(obstacles, () => 1 + Math.floor(Math.random() * 6));
}

// "cart 3/6, ally 2/6" — for the read-only HUD warning / chat.
export function describeLaneOdds(obstacles) {
    return (obstacles ?? []).map((o) => `${o.name} ${o.blockValue}/6`).join(", ");
}

// True when a solid wall blocks the shot (Foundry sight collision). Defensive:
// any uncertainty / unavailable API → NOT blocked (assisted, never wrongly forced).
export function lineOfSightBlocked(shooterToken, targetToken) {
    try {
        const a = shooterToken?.center ?? null;
        const b = targetToken?.center ?? null;
        if (!a || !b) return false;
        const backend = globalThis.CONFIG?.Canvas?.polygonBackends?.sight;
        if (backend?.testCollision) {
            return !!backend.testCollision(a, b, { type: "sight", mode: "any" });
        }
        const walls = globalThis.canvas?.walls;
        if (typeof walls?.checkCollision === "function") {
            const RayCls = globalThis.foundry?.canvas?.geometry?.Ray ?? globalThis.Ray;
            if (RayCls) return !!walls.checkCollision(new RayCls(a, b), { type: "sight", mode: "any" });
        }
    } catch (_err) { /* fall through → not blocked */ }
    return false;
}
