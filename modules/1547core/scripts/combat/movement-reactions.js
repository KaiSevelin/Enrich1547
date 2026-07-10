import {
    getActiveSideId,
    getOrderedCombatants,
    resolveCombatantSideId,
} from "../combat-tracker/side-tracker.js";
import { getMovementBudget } from "./movement-budget.mjs";
import { isMovementReactionAvailable } from "./activation-state.mjs";

/* ------------------------------------------------------------------ */
/*  Movement-provoked reactions (opportunity attacks / overwatch)      */
/*                                                                     */
/*  Detects a combatant moving through an opponent's threat zone and    */
/*  fires that opponent's threat reaction via declareMovement. Rules:   */
/*   - ONE opportunity per reactor per mover per movement (we emit one  */
/*     threat event per reactor, not one per square crossed);           */
/*   - one movement reaction per reactor *per mover per round* — passing */
/*     the first opportunity spends it (no re-trigger on later steps);   */
/*   - other opponents are independent and may still react.             */
/*  Only the GM runs the trigger (authoritative); reaction prompts then  */
/*  relay to each reactor's owner. The economy lives in activation-state */
/*  and is marked on resolution in reaction-service.                     */
/* ------------------------------------------------------------------ */

const MODULE_ID = "1547core";
// Hard cap on how far we ever look for a threatened mover (bounds a ranged
// reactor's overwatch search). Each reactor's real threatened distance is its
// own weapon reach — see reactorThreatReachSquares.
const MAX_THREAT_SQUARES = 30;

const lastPos = new Map(); // tokenId -> { x, y }

// The distance (in squares) at which `reactor` actually threatens a passing
// enemy: its reaction weapon's reach. Melee weapons with no range bands
// threaten one square (adjacency); a reach weapon (shortRange 2) threatens
// two; a ranged weapon threatens out to its max range. This is what makes a
// melee opportunity attack fire only within the weapon's reach instead of out
// to the coarse search cap.
function reactorThreatReachSquares(reactor) {
    const api = globalThis.game?.modules?.get?.(MODULE_ID)?.api?.combat;
    const weapon = api?.getActorReactionWeapon?.(reactor) ?? null;
    const finite = (value) => (Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null);
    const reach = weapon
        ? (finite(weapon.maxRange) ?? finite(weapon.longRange) ?? finite(weapon.shortRange) ?? 1)
        : 1;
    return Math.min(MAX_THREAT_SQUARES, reach);
}

// Spend the mover's per-turn movement budget as it drags around the canvas
// during its own side's window. Decrements `MovementRemaining` by the squares
// crossed (Chebyshev). No-ops when the actor defines no MovementBudget, when it
// isn't that side's turn, or when nothing actually changed. GM-authoritative
// (the caller already gated on isGM). The per-side refill lives in
// side-tracker.resetSideTurnState.
function trackMoverMovementBudget({ combat, mover, moverSide, oldPos, newPos }) {
    const activeSideId = getActiveSideId(combat, getOrderedCombatants(combat));
    if (activeSideId && moverSide && activeSideId !== moverSide) return;
    const g = gridSize();
    const movedSquares = chebyshev(toCell(oldPos.x, oldPos.y, g), toCell(newPos.x, newPos.y, g));
    if (movedSquares <= 0) return;
    const props = mover.system?.props ?? {};
    const budget = getMovementBudget(mover);
    const remainingRaw = props.MovementRemaining ?? props.MoveRemaining;
    let remaining = Number(remainingRaw);
    // First move of a turn with no counter yet: start from the full budget.
    if (!Number.isFinite(remaining)) remaining = Number.isFinite(budget) ? budget : movedSquares;
    const next = Math.max(0, remaining - movedSquares);
    if (Number.isFinite(Number(remainingRaw)) && next === Number(remainingRaw)) return;
    void mover.update({ "system.props.MovementRemaining": next });
}

function gridSize() {
    return Number(globalThis.canvas?.grid?.size) || Number(globalThis.canvas?.dimensions?.size) || 100;
}

function toCell(x, y, g) {
    return { col: Math.round((Number(x) || 0) / g), row: Math.round((Number(y) || 0) / g) };
}

function chebyshev(a, b) {
    return Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row));
}

// Grid cells along the straight move from a to b (inclusive of both ends).
function pathCells(a, b) {
    const steps = Math.max(Math.abs(b.col - a.col), Math.abs(b.row - a.row));
    if (steps === 0) return [{ col: a.col, row: a.row }];
    const cells = [];
    for (let i = 0; i <= steps; i += 1) {
        cells.push({
            col: Math.round(a.col + ((b.col - a.col) * i) / steps),
            row: Math.round(a.row + ((b.row - a.row) * i) / steps),
        });
    }
    return cells;
}

function combatantForToken(combat, tokenId) {
    return (combat?.combatants ?? []).find?.((c) => c.tokenId === tokenId) ?? null;
}

async function triggerMovementThreats({ combat, mover, moverSide, oldPos, newPos }) {
    const g = gridSize();
    const path = pathCells(toCell(oldPos.x, oldPos.y, g), toCell(newPos.x, newPos.y, g));

    const threatEvents = [];
    for (const combatant of combat.combatants ?? []) {
        if (combatant?.defeated) continue;
        if (resolveCombatantSideId(combatant) === moverSide) continue; // only opponents react
        const reactor = combatant.actor;
        const rDoc = combatant.token; // TokenDocument
        if (!reactor || !rDoc) continue;
        const rCell = toCell(rDoc.x, rDoc.y, g);
        let closest = Infinity;
        for (const cell of path) closest = Math.min(closest, chebyshev(cell, rCell));
        // Only a reactor whose weapon reach actually covers the move path may
        // take the opportunity — a melee reactor threatens its reach (1-2
        // squares), a ranged reactor out to its range.
        if (closest > reactorThreatReachSquares(reactor)) continue;
        // One opportunity per mover per round (pass already spent it).
        if (!isMovementReactionAvailable(reactor, mover, combat)) continue;
        // ONE event per reactor (not per square) — the first opportunity only.
        threatEvents.push({ reactor, distanceSquares: closest, rangeSquares: closest });
    }
    if (!threatEvents.length) return;

    const combatApi = globalThis.game?.modules?.get?.(MODULE_ID)?.api?.combat;
    if (typeof combatApi?.declareMovement !== "function") return;
    try {
        await combatApi.declareMovement({ actor: mover, path, threatEvents });
    } catch (err) {
        console.error(`${MODULE_ID} | movement threat resolution failed`, err);
    }
}

export function registerMovementReactions() {
    const Hooks = globalThis.Hooks;
    if (!Hooks?.on) return;

    const seed = () => {
        lastPos.clear();
        for (const token of globalThis.canvas?.tokens?.placeables ?? []) {
            const d = token?.document;
            if (d?.id) lastPos.set(d.id, { x: Number(d.x) || 0, y: Number(d.y) || 0 });
        }
    };
    Hooks.on("canvasReady", seed);

    Hooks.on("updateToken", (tokenDoc) => {
        try {
            const id = tokenDoc?.id;
            if (!id) return;
            const newPos = { x: Number(tokenDoc.x) || 0, y: Number(tokenDoc.y) || 0 };
            const oldPos = lastPos.get(id);
            lastPos.set(id, newPos);
            // Detect movement by the actual position delta rather than by whether
            // the update diff carried x/y. In Foundry v13 a drag can update the
            // token without surfacing x/y at the top level of the change diff,
            // which previously left the movement budget un-decremented.
            const moved = !!oldPos && (oldPos.x !== newPos.x || oldPos.y !== newPos.y);
            if (!moved) return;
            if (!globalThis.game?.user?.isGM) return; // GM is the authoritative trigger
            const combat = globalThis.game?.combat;
            if (!combat?.started) return;
            const moverCombatant = combatantForToken(combat, id);
            if (!moverCombatant) return;
            const mover = moverCombatant.actor;
            if (!mover) return;
            const moverSide = resolveCombatantSideId(moverCombatant);
            trackMoverMovementBudget({ combat, mover, moverSide, oldPos, newPos });
            void triggerMovementThreats({
                combat,
                mover,
                moverSide,
                oldPos,
                newPos,
            });
        } catch (_err) { /* non-fatal */ }
    });
}
