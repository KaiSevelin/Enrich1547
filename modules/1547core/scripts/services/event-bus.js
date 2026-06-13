export class DomainEvent {
    constructor(type, payload = {}) {
        this.type = String(type ?? "").trim();
        this.payload = payload;
        this.cancelled = false;
        this.propagationStopped = false;
        this.reason = null;
        this.results = [];
    }

    cancel(reason = null) {
        this.cancelled = true;
        this.reason = reason;
    }

    stopPropagation() {
        this.propagationStopped = true;
    }
}

export class EventBus {
    constructor() {
        this.listeners = new Map();
    }

    on(type, handler, { priority = 0, once = false } = {}) {
        if (!type) throw new Error("Event type is required.");
        if (typeof handler !== "function") {
            throw new Error("Event handler must be a function.");
        }

        const key = String(type).trim();
        const entry = {
            handler,
            priority: Number.isFinite(Number(priority)) ? Number(priority) : 0,
            once: Boolean(once),
        };

        const listeners = this.listeners.get(key) ?? [];
        listeners.push(entry);
        listeners.sort((a, b) => b.priority - a.priority);
        this.listeners.set(key, listeners);

        return () => this.off(key, handler);
    }

    once(type, handler, options = {}) {
        return this.on(type, handler, { ...options, once: true });
    }

    off(type, handler) {
        const key = String(type ?? "").trim();
        const listeners = this.listeners.get(key);
        if (!listeners?.length) return false;

        const nextListeners = listeners.filter((entry) => entry.handler !== handler);
        if (nextListeners.length === listeners.length) return false;

        if (nextListeners.length) {
            this.listeners.set(key, nextListeners);
        } else {
            this.listeners.delete(key);
        }

        return true;
    }

    async emit(type, payload = {}) {
        const key = String(type ?? "").trim();
        if (!key) throw new Error("Event type is required.");

        const event = new DomainEvent(key, payload);
        const listeners = [...(this.listeners.get(key) ?? [])];

        for (const entry of listeners) {
            const result = await entry.handler(event);
            event.results.push({
                handler: entry.handler,
                priority: entry.priority,
                value: result,
            });

            if (entry.once) {
                this.off(key, entry.handler);
            }

            if (event.propagationStopped) break;
        }

        return event;
    }

    listenerCount(type) {
        return (this.listeners.get(String(type ?? "").trim()) ?? []).length;
    }

    clear(type = null) {
        if (type == null) {
            this.listeners.clear();
            return;
        }

        this.listeners.delete(String(type).trim());
    }
}

// The single app-wide bus instance. Both the combat events facade
// (combatEventBus) and the domain events facade (domainEventBus) point at this,
// so events from any domain ("combat:*", "spell:*", "disease:*", …) share one
// bus and can drive cross-domain reactions. In-process / per-client.
export const sharedEventBus = new EventBus();
