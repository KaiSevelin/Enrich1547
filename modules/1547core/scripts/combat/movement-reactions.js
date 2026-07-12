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
// Set true (or set the `1547core.debugMovement` world flag) to trace why a move
// did/didn't spend the movement budget. Logs to the browser console.
const DEBUG_MOVE = false;
// Runtime toggle (no reload needed): run `CONFIG.debug.combat1547 = true`
// (or the older move1547) in the console to trace why a move did or didn't
// spend the movement budget.
function moveLog(...args) {
    if (!DEBUG_MOVE && !globalThis.CONFIG?.debug?.move1547 && !globalThis.CONFIG?.debug?.combat1547) return;
    try { console.debug(`${MODULE_ID} | move-debug |`, ...args); } catch (_e) { /* ignore */ }
}

// Spend movement whenever a token actually changes cells: subtract the minimum
// number of squares to reach the new position (Chebyshev — a diagonal step is 1
// square). No turn/side gating; negative "remaining" is allowed and meaningful
// (the token overspent its budget). The per-turn refill back to full lives in
// side-tracker.resetSideTurnState.
function trackMoverMovementBudget({ mover, oldPos, newPos }) {
    const g = gridSize();
    const movedSquares = chebyshev(toCell(oldPos.x, oldPos.y, g), toCell(newPos.x, newPos.y, g));
    if (movedSquares <= 0) {
        moveLog("BAIL zero-move: gridSize", g, "old", oldPos, "new", newPos);
        return;
    }
    const props = mover.system?.props ?? {};
    const budget = getMovementBudget(mover);
    const remainingRaw = props.MovementRemaining ?? props.MoveRemaining;
    let remaining = Number(remainingRaw);
    // First move with no counter yet: start from the full budget.
    if (!Number.isFinite(remaining)) remaining = Number.isFinite(budget) ? budget : 0;
    const next = remaining - movedSquares; // negatives are valid (overspent)
    moveLog("WRITE MovementRemaining", remainingRaw, "->", next, "(budget", budget, "moved", movedSquares, "mover", mover?.name, ")");
    void mover.update({ "system.props.MovementRemaining": next })
        .then((doc) => moveLog("WRITE ok, read-back", doc?.system?.props?.MovementRemaining))
        .catch((err) => moveLog("WRITE FAILED", err?.message ?? err));
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
    moveLog("registerMovementReactions: binding updateToken/preUpdateToken hooks");

    const seed = () => {
        lastPos.clear();
        for (const token of globalThis.canvas?.tokens?.placeables ?? []) {
            const d = token?.document;
            if (d?.id) lastPos.set(d.id, { x: Number(d.x) || 0, y: Number(d.y) || 0 });
        }
    };
    Hooks.on("canvasReady", seed);

    // Re-seed the movement baseline whenever the combat advances (turn/side/round
    // change). Otherwise a stale lastPos left over from a move earlier in the turn
    // could read as a fresh delta on the next token update and spuriously provoke
    // a threat reaction "when changing side".
    // The side system advances via a combat FLAG (activeSideId), not turn/round,
    // so re-seed on any combat update (cheap + harmless).
    Hooks.on("updateCombat", () => { moveLog("updateCombat: re-seeding movement baseline"); seed(); });
    Hooks.on("combatTurnChange", () => seed());

    // Capture each token's position BEFORE the update is applied. preUpdateToken
    // still carries the pre-update x/y on the document, so this guarantees
    // updateToken can measure the delta even on a token's very FIRST move of the
    // session — the canvasReady seed alone can miss late-drawn tokens, which
    // made the first move register as 0 squares.
    Hooks.on("preUpdateToken", (tokenDoc) => {
        try {
            const id = tokenDoc?.id;
            if (id) lastPos.set(id, { x: Number(tokenDoc.x) || 0, y: Number(tokenDoc.y) || 0 });
        } catch (_err) { /* non-fatal */ }
    });

    Hooks.on("updateToken", (tokenDoc, changes, options) => {
        try {
            const id = tokenDoc?.id;
            // Entry trace (before any bail) — tells us whether the hook fires at
            // all on a drag, and what the change diff carried.
            moveLog("updateToken FIRED", { id, name: tokenDoc?.name, changeKeys: Object.keys(changes ?? {}), x: tokenDoc?.x, y: tokenDoc?.y, isGM: globalThis.game?.user?.isGM });
            if (!id) return;
            const newPos = { x: Number(tokenDoc.x) || 0, y: Number(tokenDoc.y) || 0 };
            // A forced maneuver move (post-maneuver Push) is not the token's own
            // movement: it spends no budget and provokes no opportunity attacks.
            // Still record the position so the NEXT real move measures correctly.
            if (options?.forcedManeuverMove) {
                lastPos.set(id, newPos);
                moveLog("skip forced maneuver move", id);
                return;
            }
            const oldPos = lastPos.get(id);
            lastPos.set(id, newPos);
            // Detect movement by the actual position delta rather than by whether
            // the update diff carried x/y. In Foundry v13 a drag can update the
            // token without surfacing x/y at the top level of the change diff,
            // which previously left the movement budget un-decremented.
            const moved = !!oldPos && (oldPos.x !== newPos.x || oldPos.y !== newPos.y);
            if (!moved) { moveLog("updateToken: no position delta", { id, oldPos, newPos }); return; }
            if (!globalThis.game?.user?.isGM) { moveLog("BAIL not-GM"); return; } // GM is the authoritative trigger

            // Movement-budget deduction runs for ANY moved token with an actor,
            // regardless of combat state or whose turn it is (per design: 1
            // square = 1 move spent, negatives allowed). The per-turn refill to
            // full still happens at side-turn start in the combat tracker.
            const mover = tokenDoc.actor ?? game.actors?.get?.(tokenDoc.actorId) ?? null;
            if (mover) trackMoverMovementBudget({ mover, oldPos, newPos });
            else moveLog("BAIL no actor on token", id);

            // The opportunity-attack / threat system is genuinely combat-scoped.
            const combat = globalThis.game?.combat;
            if (!combat?.started) { moveLog("threats: no combat started"); return; }
            const moverCombatant = combatantForToken(combat, id);
            if (!moverCombatant) { moveLog("threats: no combatant for token", id); return; }
            const combatMover = moverCombatant.actor;
            if (!combatMover) { moveLog("threats: combatant has no actor"); return; }
            const moverSide = resolveCombatantSideId(moverCombatant);
            // Opportunity attacks only fire while the mover is in ITS OWN side's
            // window. Without this, a token position update that lands outside
            // that window — e.g. when a side turn ends and the tracker refills /
            // repositions tokens — spuriously provokes a threat reaction.
            const activeSideId = getActiveSideId(combat, getOrderedCombatants(combat));
            if (activeSideId && moverSide && activeSideId !== moverSide) {
                moveLog("threats: mover not on active side", { moverSide, activeSideId });
                return;
            }
            void triggerMovementThreats({
                combat,
                mover: combatMover,
                moverSide,
                oldPos,
                newPos,
            });
        } catch (_err) { /* non-fatal */ }
    });
}
