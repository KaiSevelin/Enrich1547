import { resolveCombatantSideId } from "../combat-tracker/side-tracker.js";
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
// Generous reach cap for "plausibly threatened"; the reaction legality (range
// gate) does the precise filtering, so this only bounds how far we bother to look.
const MAX_THREAT_SQUARES = 30;

const lastPos = new Map(); // tokenId -> { x, y }

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
        if (closest > MAX_THREAT_SQUARES) continue;
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

    Hooks.on("updateToken", (tokenDoc, changes) => {
        try {
            const id = tokenDoc?.id;
            if (!id) return;
            const moved = ("x" in (changes ?? {})) || ("y" in (changes ?? {}));
            const newPos = { x: Number(tokenDoc.x) || 0, y: Number(tokenDoc.y) || 0 };
            const oldPos = lastPos.get(id);
            lastPos.set(id, newPos);
            if (!moved || !oldPos) return;
            if (!globalThis.game?.user?.isGM) return; // GM is the authoritative trigger
            const combat = globalThis.game?.combat;
            if (!combat?.started) return;
            const moverCombatant = combatantForToken(combat, id);
            if (!moverCombatant) return;
            const mover = moverCombatant.actor;
            if (!mover) return;
            void triggerMovementThreats({
                combat,
                mover,
                moverSide: resolveCombatantSideId(moverCombatant),
                oldPos,
                newPos,
            });
        } catch (_err) { /* non-fatal */ }
    });
}
