/**
 * Multi-client fake-socket harness — simulate cross-client combat without Foundry.
 *
 * The cross-client layer (remote-window-relay.js) reads `game` / `ui` / `Hooks`
 * as ambient globals at call time and is driven entirely by `game.socket.emit` /
 * `game.socket.on`. So we can fake two (or more) clients in one Node process by:
 *
 *   1. Importing the relay module ONCE PER CLIENT with a cache-busting query
 *      string — Node keys ESM by full specifier, so each client gets its own
 *      module-level state (pendingWindows / openResponses / presenters).
 *   2. Routing every emit through a shared in-memory bus that, before invoking a
 *      recipient's socket handler, swaps the ambient globals to THAT client's —
 *      so the relay code always runs as the right client.
 *
 * Foundry sockets don't echo to the sender, so the bus delivers only to OTHER
 * clients. Synchronous handlers (response/close) run fully inside the swap and
 * restore on the way out, so nested deliveries (a response that triggers a close
 * broadcast) stay correctly scoped. For the one async handler (onRemoteRequest),
 * its synchronous portion runs under the recipient; resolve the presenter promise
 * via `runAs(client, …)` so the continuation's emit reads the right socket.
 */

const RELAY_URL = "../services/remote-window-relay.js";

// A process-wide counter so every addClient() gets a globally-unique module
// specifier — hence its own fresh relay state (pendingWindows / openResponses /
// presenters / relayBound). Reusing a logical id across worlds would otherwise
// return the cached instance (already bound) and the socket handler wouldn't
// rebind to the new world's fake socket.
let instanceSeq = 0;

function activate(client) {
    globalThis.game = client.game;
    globalThis.ui = client.ui;
    globalThis.Hooks = client.Hooks;
}

export function createSocketWorld() {
    const clients = [];
    const users = []; // shared across all clients (game.users)

    const bus = {
        deliver(senderId, channel, msg) {
            for (const c of clients) {
                if (c.id === senderId) continue; // no echo to sender
                const prev = { game: globalThis.game, ui: globalThis.ui, Hooks: globalThis.Hooks };
                activate(c);
                try {
                    for (const fn of c.socketHandlers[channel] ?? []) fn(msg);
                } finally {
                    globalThis.game = prev.game;
                    globalThis.ui = prev.ui;
                    globalThis.Hooks = prev.Hooks;
                }
            }
        },
    };

    async function addClient({ id, isGM = false, name = id, active = true }) {
        const user = { id, isGM, name, active };
        users.push(user);
        const socketHandlers = {}; // channel -> [fn]
        const userConnectedHandlers = [];
        let notificationSeq = 0;
        const notifications = {
            info: () => ++notificationSeq,
            remove: () => {},
        };
        const game = {
            user,
            users,
            get activeGM() { return users.find((u) => u.isGM && u.active) ?? null; },
            socket: {
                emit: (channel, msg) => bus.deliver(id, channel, msg),
                on: (channel, fn) => { (socketHandlers[channel] ??= []).push(fn); },
            },
        };
        const ui = { notifications };
        const Hooks = {
            on: (hook, fn) => { if (hook === "userConnected") userConnectedHandlers.push(fn); },
        };
        const client = {
            id, isGM, name, user, game, ui, Hooks,
            socketHandlers, userConnectedHandlers, instance: null,
        };
        clients.push(client);
        activate(client);
        // Per-client module instance (separate relay state) — unique per call.
        instanceSeq += 1;
        client.instance = await import(`${RELAY_URL}?client=${encodeURIComponent(id)}-${instanceSeq}`);
        client.instance.bindRemoteWindowRelay();
        return client;
    }

    // Run a synchronous body with `client`'s globals active and LEAVE them active
    // (so a promise resolved inside continues under the same client).
    function runAs(client, fn) {
        activate(client);
        return fn();
    }

    function fireUserConnected(onClient, user, connected = true) {
        return runAs(onClient, () => {
            for (const fn of onClient.userConnectedHandlers) fn(user, connected);
        });
    }

    return { bus, addClient, runAs, fireUserConnected, users, clients };
}

// A fake actor with ownership-based testUserPermission (the only Actor API the
// relay's pickResponders touches).
export function makeActor({ id, name = id, owners = [] }) {
    return {
        id,
        name,
        testUserPermission: (user, perm) => perm === "OWNER" && owners.includes(user?.id),
    };
}

// A recording presenter: captures each present() call and lets the test resolve
// or observe its close. Use for INTERACTIVE windows.
export function makeRecordingPresenter() {
    const calls = [];
    const present = (msg) => {
        let resolveFn;
        const promise = new Promise((res) => { resolveFn = res; });
        const rec = {
            msg,
            closeCalled: false,
            resolve: (id = null) => resolveFn(id),
        };
        rec.close = () => { rec.closeCalled = true; };
        calls.push(rec);
        return { promise, close: rec.close };
    };
    return { present, calls };
}

// An informational presenter: runs a side effect, returns nothing (no response).
export function makeInformationalPresenter() {
    const calls = [];
    const present = (msg) => { calls.push({ msg }); /* no return → informational */ };
    return { present, calls };
}

// Flush pending microtasks/timers a few turns.
export async function flush(turns = 4) {
    for (let i = 0; i < turns; i += 1) await new Promise((r) => setTimeout(r, 0));
}

export async function sleep(ms) {
    await new Promise((r) => setTimeout(r, ms));
}
