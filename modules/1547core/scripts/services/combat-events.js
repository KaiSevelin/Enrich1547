import { sharedEventBus } from "./event-bus.js";

export const COMBAT_EVENTS = {
    TURN_STARTED: "combat:turn-started",
    TURN_ENDED: "combat:turn-ended",
    MOVEMENT_STARTED: "combat:movement-started",
    THREAT_ZONE_ENTERED: "combat:threat-zone-entered",
    ATTACK_DECLARED: "combat:attack-declared",
    REACTION_WINDOW_OPENED: "combat:reaction-window-opened",
    REACTION_RESOLVED: "combat:reaction-resolved",
    DAMAGE_APPLIED: "combat:damage-applied",
    DAMAGE_TAKEN_WINDOW_OPENED: "combat:damage-taken-window-opened",
    POST_MANEUVER_WINDOW_OPENED: "combat:post-maneuver-window-opened",
    ACTION_COMMITTED: "combat:action-committed",
};

// Shares the single app-wide bus (see event-bus.js) so combat events can drive
// cross-domain reactions and vice versa. The combatEventBus name + the helpers
// below are kept as a back-compat facade — no combat call sites change.
export const combatEventBus = sharedEventBus;

export function onCombatEvent(type, handler, options = {}) {
    return combatEventBus.on(type, handler, options);
}

export function onceCombatEvent(type, handler, options = {}) {
    return combatEventBus.once(type, handler, options);
}

export function offCombatEvent(type, handler) {
    return combatEventBus.off(type, handler);
}

export async function emitCombatEvent(type, payload = {}) {
    return combatEventBus.emit(type, payload);
}
