import { MODULE_ID } from "../lib/constants.mjs";

/* ------------------------------------------------------------------ */
/*  Generic cross-client "window relay" (cross-client-reaction-spec)   */
/*                                                                     */
/*  Combat/UI windows are opened on the *acting* client (combat events  */
/*  run on a local bus). This hub relays an interactive window to the   */
/*  owner of the relevant actor over the socket and routes their choice */
/*  back. The acting client stays the authority — it performs the       */
/*  resolution and all combat writes; only the prompt + selection are   */
/*  delegated. Consumers register a per-`kind` responder presenter and  */
/*  call relayRemoteWindow on the acting side.                          */
/*                                                                     */
/*  Used by: reaction windows, defender post-maneuver windows, and the  */
/*  informational defense-summary window.                               */
/* ------------------------------------------------------------------ */

const SOCKET_CHANNEL = `module.${MODULE_ID}`;
const REQUEST_TYPE = "rw-request";
const RESPONSE_TYPE = "rw-response";
const CLOSE_TYPE = "rw-close";

const pendingWindows = new Map(); // acting side: windowId -> { onResolve, notificationId, request, timer }
const openResponses = new Map();  // responder side: windowId -> closeFn
const presenters = new Map();     // kind -> present(msg) => { promise, close } | void (informational)
let relayBound = false;

export function escapeRelayHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ----------------------------- acting-side waiting indicator -------- */

function showWaitingIndicator(entry, names) {
    if (!entry) return;
    const text = `Waiting for ${names.join(", ")} to respond…`;
    try {
        const id = ui.notifications?.info?.(text, { permanent: true });
        entry.notificationId = (typeof ui.notifications?.remove === "function") ? id : null;
    } catch {
        entry.notificationId = null;
    }
}

function clearWaitingIndicator(entry) {
    if (!entry || entry.notificationId == null) return;
    try { ui.notifications?.remove?.(entry.notificationId); } catch { /* noop */ }
    entry.notificationId = null;
}

/* ----------------------------- shared dialog presenter ------------- */

/**
 * A standalone candidate-choice dialog presenter used as a fallback (and for
 * kinds without a bespoke HUD window). Returns `{ promise, close }` for the
 * relay: the promise resolves with the chosen candidate id or null, and `close`
 * shuts the dialog (first-wins / timeout).
 *
 * @param {object}  opts
 * @param {string}  opts.title
 * @param {string}  opts.intro          inner HTML (already escaped by caller)
 * @param {Array}   opts.candidates     [{ id, label }]
 * @param {number}  [opts.timeoutMs]
 * @param {string}  [opts.countdownClass="rw-countdown"]
 * @param {string}  [opts.dialogClass="remote-window-dialog"]
 */
export function presentCandidateDialog({ title, intro = "", candidates = [], timeoutMs = 0, countdownClass = "rw-countdown", dialogClass = "remote-window-dialog" }) {
    let closeFn = () => {};
    const promise = new Promise((resolve) => {
        let settled = false;
        let timer = null;
        let countdown = null;
        const ms = Math.max(0, Number(timeoutMs) || 0);
        const deadline = Date.now() + ms;
        const done = (v) => {
            if (settled) return;
            settled = true;
            if (timer) clearTimeout(timer);
            if (countdown) clearInterval(countdown);
            resolve(v);
        };
        const buttons = {};
        (candidates ?? []).forEach((c, i) => {
            buttons[`opt-${i}`] = { label: c.label ?? c.name ?? "Option", callback: () => done(c.id) };
        });
        buttons.pass = { label: "Pass", callback: () => done(null) };
        const countdownText = ms > 0 ? ` <span class="${countdownClass}">${Math.ceil(ms / 1000)}s</span>` : "";
        const dlg = new Dialog({
            title,
            content: `<p>${intro}${countdownText}</p>`,
            buttons,
            default: "pass",
            close: () => done(null),
        }, { classes: [dialogClass] });
        dlg.render(true);
        closeFn = () => { try { dlg.close(); } catch { /* noop */ } done(null); };
        if (ms > 0) {
            timer = setTimeout(() => { try { dlg.close(); } catch { /* noop */ } done(null); }, ms);
            countdown = setInterval(() => {
                const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
                const root = dlg.element?.[0] ?? dlg.element;
                const span = root?.querySelector?.(`.${countdownClass}`);
                if (span) span.textContent = `${remaining}s`;
            }, 500);
        }
    });
    return { promise, close: () => closeFn() };
}

/* ----------------------------- responders -------------------------- */

// Active users (other than us) who should decide for this actor: a controlling
// player if any owns it, else the GM when we (a player) can't decide.
export function pickResponders(actor) {
    if (!actor?.testUserPermission) return [];
    const others = Array.from(game.users ?? []).filter((u) => u.active && u.id !== game.user.id);
    const players = others.filter((u) => !u.isGM && actor.testUserPermission(u, "OWNER"));
    if (players.length) return players;
    if (!actor.testUserPermission(game.user, "OWNER")) {
        const gms = others.filter((u) => u.isGM);
        if (gms.length) return gms;
    }
    return [];
}

/**
 * Register a responder presenter for a window kind. `present(msg)` either:
 *  - returns `{ promise: Promise<id|null>, close: () => void }` for an
 *    interactive window (the relay sends the resolved id back), or
 *  - performs its side effects and returns nothing for an informational
 *    window (no response).
 */
export function registerRemoteWindowPresenter(kind, present) {
    if (kind && typeof present === "function") presenters.set(kind, present);
}

/* ----------------------------- socket plumbing --------------------- */

function broadcastClose(windowId) {
    try { game.socket?.emit(SOCKET_CHANNEL, { type: CLOSE_TYPE, windowId }); } catch { /* noop */ }
}

// Responder side: a sibling owner answered (or the acting client closed the
// window) — tear down our still-open prompt for that window.
function onRemoteClose(windowId) {
    const close = openResponses.get(windowId);
    if (!close) return;
    openResponses.delete(windowId);
    try { close(); } catch { /* noop */ }
}

// Responder side: we were asked to present a window — render it, then send the
// choice back (interactive only).
async function onRemoteRequest(msg) {
    if (!Array.isArray(msg.toUserIds) || !msg.toUserIds.includes(game.user.id)) return;
    const present = presenters.get(msg.kind);
    if (!present) return;
    let result = null;
    try { result = present(msg); } catch { result = null; }
    if (!result || typeof result.promise?.then !== "function") return; // informational — no response
    openResponses.set(msg.windowId, typeof result.close === "function" ? result.close : () => {});
    let candidateId = null;
    try { candidateId = await result.promise; } catch { candidateId = null; }
    openResponses.delete(msg.windowId);
    if (msg.expectsResponse !== false) {
        try { game.socket?.emit(SOCKET_CHANNEL, { type: RESPONSE_TYPE, windowId: msg.windowId, candidateId: candidateId ?? null }); } catch { /* noop */ }
    }
}

// Acting side: a remote responder answered. Validate happens in the consumer's
// onResolve (it maps the id back against the candidates it offered).
function onRemoteResponse(msg) {
    const entry = pendingWindows.get(msg.windowId);
    if (!entry) return;
    pendingWindows.delete(msg.windowId);
    if (entry.timer) clearTimeout(entry.timer);
    clearWaitingIndicator(entry);
    broadcastClose(msg.windowId);
    try { entry.onResolve?.(msg.candidateId ?? null); } catch { /* noop */ }
}

// Acting side: the window was resolved locally (e.g. the GM picked on their own
// mirrored copy). Tear down the responder's copy and clear the indicator. Safe
// to call unconditionally — a no-op once the entry is gone (remote already won).
export function closeRelayedWindow(windowId) {
    const entry = pendingWindows.get(windowId);
    if (!entry) return;
    pendingWindows.delete(windowId);
    if (entry.timer) clearTimeout(entry.timer);
    clearWaitingIndicator(entry);
    broadcastClose(windowId);
}

export function bindRemoteWindowRelay() {
    if (relayBound || !game?.socket) return;
    relayBound = true;
    game.socket.on(SOCKET_CHANNEL, (msg) => {
        if (!msg || typeof msg !== "object") return;
        if (msg.type === REQUEST_TYPE) void onRemoteRequest(msg);
        else if (msg.type === RESPONSE_TYPE) onRemoteResponse(msg);
        else if (msg.type === CLOSE_TYPE) onRemoteClose(msg.windowId);
    });
    // A responder who connects after the request was broadcast missed it —
    // re-send any pending window they're an intended responder for, to them only.
    Hooks.on("userConnected", (user, connected) => {
        if (!connected || !user?.id || !pendingWindows.size) return;
        for (const entry of pendingWindows.values()) {
            const req = entry?.request;
            if (req && Array.isArray(req.toUserIds) && req.toUserIds.includes(user.id)) {
                try { game.socket?.emit(SOCKET_CHANNEL, { ...req, toUserIds: [user.id] }); } catch { /* noop */ }
            }
        }
    });
}

/* ----------------------------- acting-side entry point ------------- */

/**
 * Relay a window to the owner of `responderActor`. Returns true if relayed (the
 * caller then skips local presentation); false when there is no remote
 * responder (caller handles it locally).
 *
 * @param {object}   opts
 * @param {string}   opts.kind            window kind (matches a registered presenter)
 * @param {string}   opts.windowId        unique id (foundry.utils.randomID())
 * @param {Actor}    opts.responderActor  whose owner decides
 * @param {object}   [opts.request]       extra serialisable payload (candidates, summary, …)
 * @param {number}   [opts.timeoutMs]     deadline; the acting side auto-passes after it
 * @param {Function} [opts.onResolve]     (candidateId|null) => void  (interactive only)
 * @param {boolean}  [opts.expectsResponse=true]  false for informational windows
 */
export function relayRemoteWindow({ kind, windowId, responderActor, request = {}, timeoutMs = 0, onResolve = null, expectsResponse = true }) {
    const responders = pickResponders(responderActor);
    if (!responders.length) return false;
    const payload = {
        type: REQUEST_TYPE,
        kind,
        windowId,
        toUserIds: responders.map((u) => u.id),
        forActorId: responderActor?.id ?? null,
        reactorName: responderActor?.name ?? "A combatant",
        timeoutMs,
        expectsResponse,
        ...request,
    };
    if (!expectsResponse) {
        try { game.socket?.emit(SOCKET_CHANNEL, payload); } catch { /* noop */ }
        return true;
    }
    const entry = { onResolve, notificationId: null, request: payload, timer: null };
    pendingWindows.set(windowId, entry);
    try { game.socket?.emit(SOCKET_CHANNEL, payload); } catch { /* noop */ }
    showWaitingIndicator(entry, responders.map((u) => u.name));
    if (timeoutMs > 0) {
        // Backstop a little past the responder's own deadline so their answer wins.
        entry.timer = setTimeout(() => {
            if (!pendingWindows.has(windowId)) return;
            pendingWindows.delete(windowId);
            clearWaitingIndicator(entry);
            broadcastClose(windowId);
            try { onResolve?.(null); } catch { /* noop */ }
        }, timeoutMs + 500);
    }
    return true;
}
