import {
    getActiveSideId,
    getOrderedCombatants,
    resolveCombatantSideId,
    getSideLabel,
} from "../combat-tracker/side-tracker.js";

/* ------------------------------------------------------------------ */
/*  Turn cues                                                          */
/*                                                                     */
/*  Side-based initiative stores the active side on the combat flag,    */
/*  which Foundry propagates to every client via updateCombat. So each  */
/*  player can notice locally when their side becomes active — no       */
/*  socket needed. We nudge a player ("Your side's turn") only on an    */
/*  actual change, and only when they own a combatant on the now-active */
/*  side. The GM drives the tracker, so they are not nudged.            */
/* ------------------------------------------------------------------ */

const lastAnnouncedSide = new Map(); // combatId -> activeSideId

function userOwnsActiveSideMember(combat, activeSideId) {
    if (!activeSideId) return false;
    for (const combatant of combat.combatants ?? []) {
        if (resolveCombatantSideId(combatant) !== activeSideId) continue;
        if (combatant.actor?.testUserPermission?.(game.user, "OWNER")) return true;
    }
    return false;
}

function onCombatUpdate(combat) {
    if (!combat?.id) return;
    if (!combat.started) { lastAnnouncedSide.delete(combat.id); return; }
    if (game.user?.isGM) return; // the GM runs the tracker; no nudge

    const activeSideId = getActiveSideId(combat, getOrderedCombatants(combat));
    if (!activeSideId) return;
    if (lastAnnouncedSide.get(combat.id) === activeSideId) return;
    lastAnnouncedSide.set(combat.id, activeSideId);

    if (userOwnsActiveSideMember(combat, activeSideId)) {
        ui.notifications?.info?.(`Your side's turn — ${getSideLabel(activeSideId)}.`);
    }
}

export function registerTurnCues() {
    Hooks.on("updateCombat", (combat) => { try { onCombatUpdate(combat); } catch { /* non-fatal */ } });
    Hooks.on("deleteCombat", (combat) => { if (combat?.id) lastAnnouncedSide.delete(combat.id); });
}
