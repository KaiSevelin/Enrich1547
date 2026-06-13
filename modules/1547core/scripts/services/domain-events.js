// App-wide domain event bus for cross-cutting reactions (spell/ritual/disease/…).
// Separate from combatEventBus only by convention — same EventBus class. Events
// are namespaced ("spell:*", "ritual:*", …) so reactions from any domain can
// subscribe. IN-PROCESS / per-client: use this to wire reactions within a
// client, NOT to sync other clients (that's the race-board socket's job).

import { EventBus } from "./event-bus.js";

export const DOMAIN_EVENTS = {
    SPELL_SUCCEEDED: "spell:succeeded",
    SPELL_FAILED: "spell:failed",
    RITUAL_RESOLVED: "ritual:resolved",
    DISEASE_CONTRACTED: "disease:contracted",
    DISEASE_ADVANCED: "disease:advanced",
    // GM-driven (alarm is never automated); emitted for future consumers — no
    // listener today.
    BOARD_ALARM_CHANGED: "board:alarm-changed",
};

export const domainEventBus = new EventBus();

export function onDomainEvent(type, handler, options = {}) {
    return domainEventBus.on(type, handler, options);
}

export function onceDomainEvent(type, handler, options = {}) {
    return domainEventBus.once(type, handler, options);
}

export function offDomainEvent(type, handler) {
    return domainEventBus.off(type, handler);
}

// Emits and swallows listener errors — a misbehaving reaction must never break
// the producer (e.g. a failed spell still resolves even if a listener throws).
export async function emitDomainEvent(type, payload = {}) {
    try {
        return await domainEventBus.emit(type, payload);
    } catch (err) {
        console.error(`1547core | domain event '${type}' listener threw`, err);
        return null;
    }
}
