/**
 * Positioning & facing geometry (pure, grid-tile based).
 *
 * The single source of truth for the facing-and-positioning spec
 * (docs/specs/facing-and-positioning-spec-v1.md). Everything here is pure and
 * tile-coordinate based — no Foundry globals — so it is unit-testable and shared
 * by the combat lifecycle (rear +1, surprise, auto-face) and the HUD overlay.
 *
 * A token is described as { col, row, w, h, rotation }:
 *   col,row = top-left occupied grid tile; w,h = footprint in tiles (default 1);
 *   rotation = degrees (Foundry token rotation). Convert a live token with
 *   `tokenDescriptor()`.
 */

/* ---------------------------------------- */
/*  Facing (8-way) from rotation            */
/* ---------------------------------------- */

// Mirrors the actor HUD's getFacingDirection: rotation 0 = facing South, and
// each +45° turns clockwise. Snap to the nearest of 8 directions.
export function facingFromRotation(rotation) {
    const r = ((Number(rotation) || 0) % 360 + 360) % 360;
    switch (Math.round(r / 45) * 45 % 360) {
        case 45: return "SW";
        case 90: return "W";
        case 135: return "NW";
        case 180: return "N";
        case 225: return "NE";
        case 270: return "E";
        case 315: return "SE";
        case 0:
        default: return "S";
    }
}

const OPPOSITE = { N: "S", NE: "SW", E: "W", SE: "NW", S: "N", SW: "NE", W: "E", NW: "SE" };
export function oppositeFacing(facing) { return OPPOSITE[facing] ?? "S"; }

// Token rotation (degrees) that produces a given facing (inverse of the above).
const ROTATION_FOR = { S: 0, SW: 45, W: 90, NW: 135, N: 180, NE: 225, E: 270, SE: 315 };
export function rotationForFacing(facing) { return ROTATION_FOR[facing] ?? 0; }

// The 8-way direction from one tile toward another (dcol east+, drow south+).
// Used to auto-face an attacker toward its target.
const OCTANT = ["E", "SE", "S", "SW", "W", "NW", "N", "NE"];
export function facingFromDelta(dcol, drow) {
    if (!dcol && !drow) return "S";
    const deg = (Math.atan2(drow, dcol) * 180 / Math.PI + 360) % 360;
    return OCTANT[Math.round(deg / 45) % 8];
}

/* ---------------------------------------- */
/*  Footprints & cones                      */
/* ---------------------------------------- */

export function footprintTiles(token) {
    const { col, row, w = 1, h = 1 } = token;
    const out = [];
    for (let dy = 0; dy < h; dy += 1) for (let dx = 0; dx < w; dx += 1) out.push({ col: col + dx, row: row + dy });
    return out;
}

// Nearest-edge Chebyshev distance (in grid tiles) between two token footprints,
// each described as { col, row, w, h }. Overlapping footprints → 0; touching
// (orthogonally OR diagonally) → 1. This is the melee reach / adjacency metric
// (battle-flow-spec §12 #4): it measures the gap between occupied tiles, so large
// tokens and diagonal placement read correctly (center-to-center misjudged them).
// For a 1×1-vs-1×1 pair it equals the old center-Chebyshev exactly.
export function footprintDistanceSquares(a, b) {
    if (!a || !b) return null;
    const aw = Math.max(1, Math.round(a.w ?? 1));
    const ah = Math.max(1, Math.round(a.h ?? 1));
    const bw = Math.max(1, Math.round(b.w ?? 1));
    const bh = Math.max(1, Math.round(b.h ?? 1));
    // Separation of two closed integer intervals [lo,hi]; 0 when they overlap.
    const axisGap = (lo1, hi1, lo2, hi2) => Math.max(0, lo1 - hi2, lo2 - hi1);
    const gapX = axisGap(a.col, a.col + aw - 1, b.col, b.col + bw - 1);
    const gapY = axisGap(a.row, a.row + ah - 1, b.row, b.row + bh - 1);
    return Math.max(gapX, gapY);
}

// Whether tile offset (dx,dy) at Chebyshev `distance` lies in the cone facing
// `facing`. Identical masks to the HUD's getThreatTiles, so the lib and the
// on-canvas overlay agree exactly.
function inFacingMask(facing, dx, dy, distance) {
    switch (facing) {
        case "N": return dy === -distance && Math.abs(dx) <= distance;
        case "S": return dy === distance && Math.abs(dx) <= distance;
        case "E": return dx === distance && Math.abs(dy) <= distance;
        case "W": return dx === -distance && Math.abs(dy) <= distance;
        case "NE": return dx >= 0 && dy <= 0 && Math.max(dx, -dy) === distance;
        case "NW": return dx <= 0 && dy <= 0 && Math.max(-dx, -dy) === distance;
        case "SE": return dx >= 0 && dy >= 0 && Math.max(dx, dy) === distance;
        case "SW": return dx <= 0 && dy >= 0 && Math.max(-dx, dy) === distance;
        default: return false;
    }
}

// Cone of tiles from a single origin in `facing`, distances [minDist, maxDist].
export function coneTiles(originCol, originRow, facing, minDist, maxDist) {
    const out = [];
    for (let distance = minDist; distance <= maxDist; distance += 1) {
        for (let dy = -distance; dy <= distance; dy += 1) {
            for (let dx = -distance; dx <= distance; dx += 1) {
                if (Math.max(Math.abs(dx), Math.abs(dy)) !== distance) continue;
                if (!inFacingMask(facing, dx, dy, distance)) continue;
                out.push({ col: originCol + dx, row: originRow + dy });
            }
        }
    }
    return out;
}

// The token tiles that sit on a given side (the "back edge" when `side` is the
// opposite of facing). Cardinals give the whole edge; diagonals give the corner.
function edgeOrigins(token, side) {
    const { col, row, w = 1, h = 1 } = token;
    const right = col + w - 1, bottom = row + h - 1, out = [];
    switch (side) {
        case "N": for (let i = 0; i < w; i += 1) out.push({ col: col + i, row }); break;
        case "S": for (let i = 0; i < w; i += 1) out.push({ col: col + i, row: bottom }); break;
        case "W": for (let i = 0; i < h; i += 1) out.push({ col, row: row + i }); break;
        case "E": for (let i = 0; i < h; i += 1) out.push({ col: right, row: row + i }); break;
        case "NW": out.push({ col, row }); break;
        case "NE": out.push({ col: right, row }); break;
        case "SW": out.push({ col, row: bottom }); break;
        case "SE": out.push({ col: right, row: bottom }); break;
    }
    return out;
}

// The rear vulnerability cone: the arc behind the token's back edge, out to
// `maxDist`. For a 1×1 token at reach 1 this is the 3 rear tiles; a 2×2 gives 4
// (back edge + one each flank), widening with distance.
export function rearConeTiles(token, maxDist = 1) {
    const back = oppositeFacing(facingFromRotation(token.rotation));
    const set = new Map();
    for (const o of edgeOrigins(token, back)) {
        for (const t of coneTiles(o.col, o.row, back, 1, maxDist)) set.set(`${t.col},${t.row}`, t);
    }
    return [...set.values()];
}

// True if the attacker occupies any tile in the defender's rear cone within
// `maxDist` (the attacker's weapon reach in melee, or range-band max in ranged).
export function isInRearCone(defender, attacker, maxDist = 1) {
    const rear = new Set(rearConeTiles(defender, maxDist).map((t) => `${t.col},${t.row}`));
    return footprintTiles(attacker).some((t) => rear.has(`${t.col},${t.row}`));
}

/* ---------------------------------------- */
/*  The positional result for an attack     */
/* ---------------------------------------- */

/**
 * Resolve an attack's positional standing (facing spec rules 2, 4, 5).
 *   - defenderInCombat === false → surprise: unguarded opening strike, +1, no
 *     reaction to Face with.
 *   - else rear = attacker in the defender's rear cone → +1; faceable unless the
 *     attacker is Hidden.
 * Returns { surprise, rear, advantage (0|1), faceable }.
 */
export function computePositionalAdvantage({
    attacker,
    defender,
    maxDist = 1,
    attackerHidden = false,
    defenderInCombat = true
} = {}) {
    if (!attacker || !defender) return { surprise: false, rear: false, advantage: 0, faceable: false };
    if (!defenderInCombat) {
        return { surprise: true, rear: true, advantage: 1, faceable: false };
    }
    const rear = isInRearCone(defender, attacker, maxDist);
    return {
        surprise: false,
        rear,
        advantage: rear ? 1 : 0,
        faceable: rear && !attackerHidden
    };
}

/* ---------------------------------------- */
/*  Live-token adapter                      */
/* ---------------------------------------- */

// Build a pure descriptor from a Foundry Token / TokenDocument. Kept here so the
// rest of the module stays canvas-free.
export function tokenDescriptor(tokenOrDoc) {
    const doc = tokenOrDoc?.document ?? tokenOrDoc;
    if (!doc) return null;
    const grid = Number(globalThis.canvas?.grid?.size) || Number(globalThis.canvas?.dimensions?.size) || 100;
    return {
        col: Math.round((Number(doc.x) || 0) / grid),
        row: Math.round((Number(doc.y) || 0) / grid),
        w: Math.max(1, Math.round(Number(doc.width) || 1)),
        h: Math.max(1, Math.round(Number(doc.height) || 1)),
        rotation: Number(doc.rotation) || 0
    };
}

// The facing (and rotation) an attacker should turn to in order to face a
// target — used for the auto-face on attack. Uses footprint centres.
export function facingToward(fromToken, towardToken) {
    const cx = (fromToken.col + (fromToken.w ?? 1) / 2);
    const cy = (fromToken.row + (fromToken.h ?? 1) / 2);
    const tx = (towardToken.col + (towardToken.w ?? 1) / 2);
    const ty = (towardToken.row + (towardToken.h ?? 1) / 2);
    const facing = facingFromDelta(tx - cx, ty - cy);
    return { facing, rotation: rotationForFacing(facing) };
}
