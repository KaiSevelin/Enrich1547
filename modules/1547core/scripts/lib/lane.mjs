/**
 * Ranged cover as obstacle interception (cover-spec-v1). Pure grid geometry +
 * dice math — no Foundry. The live glue (canvas tokens, the d6 rolls, the stray
 * hit) lives in combat/ranged-cover.js and hud-actions.js.
 *
 *   laneTiles(from, to)            -> ordered cells the shot crosses (near→far)
 *   blockValueForSize(maxDim)      -> a creature's d6 threshold (1..4) by size
 *   gatherObstacles(lane, occ, …)  -> ordered obstacles between shooter & target
 *   rollInterception(obstacles, r) -> the first obstacle to catch the shot (or null)
 */

// Every grid cell the segment from cell `a` to cell `b` passes through, ordered
// from `a` (the shooter) to `b` (the target), de-duplicated. Oversampled so a
// shot that grazes a tile still counts it (cover-spec: "occupies a crossed tile").
export function laneTiles(a, b) {
    const x0 = Math.round(a?.col ?? 0), y0 = Math.round(a?.row ?? 0);
    const x1 = Math.round(b?.col ?? 0), y1 = Math.round(b?.row ?? 0);
    const span = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    if (span === 0) return [{ col: x0, row: y0 }];
    const steps = span * 4; // oversample to catch grazed cells
    const seen = new Set();
    const cells = [];
    for (let i = 0; i <= steps; i += 1) {
        const t = i / steps;
        const col = Math.round(x0 + (x1 - x0) * t);
        const row = Math.round(y0 + (y1 - y0) * t);
        const key = `${col},${row}`;
        if (!seen.has(key)) { seen.add(key); cells.push({ col, row }); }
    }
    return cells;
}

// A creature's block value by token size (max of width/height in grid units):
// tiny (<1) → 1, medium 1×1 → 2, large 2×2 → 3, huge 3×3+ → 4. Clamped to 1..4.
export function blockValueForSize(maxDim) {
    const size = Number(maxDim);
    const value = (Number.isFinite(size) ? Math.floor(size) : 1) + 1;
    return Math.min(4, Math.max(1, value));
}

// From the lane cells and a list of occupants, return the obstacles between
// shooter and target — ordered nearest-the-shooter first, one entry per occupant
// even if it spans several lane cells. occupants: [{ id, name, size, cells:Set }].
export function gatherObstacles(laneCells, occupants = [], { shooterId = null, targetId = null } = {}) {
    const obstacles = [];
    const added = new Set();
    for (let i = 0; i < (laneCells?.length ?? 0); i += 1) {
        const key = `${laneCells[i].col},${laneCells[i].row}`;
        for (const occ of occupants) {
            if (!occ?.id || added.has(occ.id)) continue;
            if (occ.id === shooterId || occ.id === targetId) continue;
            if (occ.cells?.has?.(key)) {
                added.add(occ.id);
                obstacles.push({
                    id: occ.id,
                    name: occ.name ?? "Obstacle",
                    blockValue: blockValueForSize(occ.size),
                    distanceIndex: i,
                });
            }
        }
    }
    return obstacles;
}

// Roll a d6 per obstacle nearest-first; the FIRST roll ≤ its block value catches
// the shot (and stops). `rollD6()` returns 1..6 (injected for testability).
// Returns { obstacle, roll } of the catcher, or null if the shot gets through.
export function rollInterception(obstacles = [], rollD6) {
    for (const obstacle of obstacles) {
        const roll = Number(rollD6?.());
        if (Number.isFinite(roll) && roll <= obstacle.blockValue) {
            return { obstacle, roll };
        }
    }
    return null;
}
