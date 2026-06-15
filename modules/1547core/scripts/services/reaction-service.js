import { MODULE_ID } from "../lib/constants.mjs";
﻿import {
    COMBAT_EVENTS,
    emitCombatEvent,
    onCombatEvent,
} from "./combat-events.js";

const DEFAULT_REACTION_WINDOW_SECONDS = 10;

let reactionServiceDisposers = [];

/* ------------------------------------------------------------------ */
/*  Cross-client reaction relay (cross-client-reaction-spec-v1)       */
/*  Combat events run on a local bus, so a reaction prompt would only  */
/*  appear on the acting client. This relays the prompt to the         */
/*  reactor's owner over the socket and routes their choice back. The  */
/*  acting client stays the authority (timeout, resolution, writes).   */
/* ------------------------------------------------------------------ */

const SOCKET_CHANNEL = `module.${MODULE_ID}`;
const REQUEST_TYPE = "reaction-request";
const RESPONSE_TYPE = "reaction-response";
const CLOSE_TYPE = "reaction-closed";
const pendingRemoteWindows = new Map(); // acting side: windowId -> { selectionController, notificationId, request }
const openRemoteResponses = new Map(); // responder side: windowId -> closeFn (multi-owner first-wins close)
let reactionSocketBound = false;
let reactionHooksBound = false;

function escapeReactionHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Acting side: a persistent "waiting for <player>…" notification, removed when
// the response arrives or the window times out. Falls back to a transient toast
// if this Foundry build can't remove notifications by id.
function showWaitingIndicator(entry, responders) {
    if (!entry) return;
    const text = `Waiting for ${responders.map((u) => u.name).join(", ")} to react…`;
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

// Acting side: once a window settles, tell the *other* responders to close their
// prompt (multi-owner first-wins). The winner's own prompt is already gone.
function broadcastReactionClose(windowId) {
    try { game.socket?.emit(SOCKET_CHANNEL, { type: CLOSE_TYPE, windowId }); } catch { /* noop */ }
}

// Responder side: a sibling owner answered (or the window timed out on the acting
// client) — tear down our still-open prompt for that window.
function onRemoteReactionClose(windowId) {
    const close = openRemoteResponses.get(windowId);
    if (!close) return;
    openRemoteResponses.delete(windowId);
    try { close(); } catch { /* noop */ }
}

function bindReactionSocket() {
    if (reactionSocketBound || !game?.socket) return;
    reactionSocketBound = true;
    game.socket.on(SOCKET_CHANNEL, (msg) => {
        if (!msg || typeof msg !== "object") return;
        if (msg.type === REQUEST_TYPE) void onRemoteReactionRequest(msg);
        else if (msg.type === RESPONSE_TYPE) onRemoteReactionResponse(msg);
        else if (msg.type === CLOSE_TYPE) onRemoteReactionClose(msg.windowId);
    });
    bindReactionHooks();
}

// Acting side: a responder who connects after the request was broadcast missed
// it — re-send any pending window they're an intended responder for, to them only.
function bindReactionHooks() {
    if (reactionHooksBound) return;
    reactionHooksBound = true;
    Hooks.on("userConnected", (user, connected) => {
        if (!connected || !user?.id || !pendingRemoteWindows.size) return;
        for (const entry of pendingRemoteWindows.values()) {
            const req = entry?.request;
            if (req && Array.isArray(req.toUserIds) && req.toUserIds.includes(user.id)) {
                try { game.socket?.emit(SOCKET_CHANNEL, { ...req, toUserIds: [user.id] }); } catch { /* noop */ }
            }
        }
    });
}

// Active users (other than us) who should decide the reaction: a controlling
// player if any owns the reactor, else the GM when we (a player) can't decide.
function pickReactionResponders(reactorActor) {
    if (!reactorActor?.testUserPermission) return [];
    const others = Array.from(game.users ?? []).filter((u) => u.active && u.id !== game.user.id);
    const players = others.filter((u) => !u.isGM && reactorActor.testUserPermission(u, "OWNER"));
    if (players.length) return players;
    if (!reactorActor.testUserPermission(game.user, "OWNER")) {
        const gms = others.filter((u) => u.isGM);
        if (gms.length) return gms;
    }
    return [];
}

function serializeReactionCandidates(candidates) {
    return (candidates ?? [])
        .filter((c) => c && c.legal !== false && c.id)
        .map((c) => ({ id: c.id, name: c.name ?? "Reaction", usage: c.usage ?? "" }));
}

// Acting side: hand the window to a remote responder. Returns true if relayed
// (the caller then skips the local prompt); the choice returns over the socket.
function relayReactionWindow({ windowId, reactorActor, selectionController, candidates, trigger, timeoutMs }) {
    const responders = pickReactionResponders(reactorActor);
    if (!responders.length) return false;
    const request = {
        type: REQUEST_TYPE,
        windowId,
        toUserIds: responders.map((u) => u.id),
        forActorId: reactorActor?.id ?? null,
        reactorName: reactorActor?.name ?? "A combatant",
        trigger,
        timeoutMs,
        candidates: serializeReactionCandidates(candidates),
    };
    const entry = { selectionController, notificationId: null, request };
    pendingRemoteWindows.set(windowId, entry);
    game.socket.emit(SOCKET_CHANNEL, request);
    showWaitingIndicator(entry, responders);
    return true;
}

// Acting side: a remote responder answered. selectReaction accepts the candidate
// id and normalises it back to the real candidate; an unknown/absent id passes.
function onRemoteReactionResponse(msg) {
    const entry = pendingRemoteWindows.get(msg.windowId);
    if (!entry) return;
    pendingRemoteWindows.delete(msg.windowId);
    clearWaitingIndicator(entry);
    broadcastReactionClose(msg.windowId);
    if (msg.candidateId) entry.selectionController.selectReaction(msg.candidateId);
    else entry.selectionController.passReaction();
}

// Responder side: we were asked to react — prompt, then send the choice back.
async function onRemoteReactionRequest(msg) {
    if (!Array.isArray(msg.toUserIds) || !msg.toUserIds.includes(game.user.id)) return;
    const candidateId = await presentRemoteReaction(msg);
    game.socket.emit(SOCKET_CHANNEL, { type: RESPONSE_TYPE, windowId: msg.windowId, candidateId: candidateId ?? null });
}

// Responder side: render the prompt. Prefer the in-HUD reaction window (Phase 2)
// for a consistent UX; fall back to the standalone dialog when the reactor has
// no token on the active scene (so the HUD has nothing to render against).
function presentRemoteReaction(msg) {
    const cands = Array.isArray(msg.candidates) ? msg.candidates : [];
    if (!cands.length) return Promise.resolve(null);
    const actor = msg.forActorId ? game.actors?.get(msg.forActorId) : null;
    const token = actor?.getActiveTokens?.(true)?.[0] ?? actor?.getActiveTokens?.()?.[0] ?? null;
    if (token) return presentRemoteReactionViaHud(msg, actor, token, cands);
    return promptRemoteReaction(msg);
}

// Responder side: reconstruct a reactionWindow object and feed it through the
// existing HUD reaction UI by emitting REACTION_WINDOW_OPENED locally. The HUD's
// Commit/Pass bindings call selectReaction/passReaction (and self-clear the
// window); the window auto-expires on its deadline (getActiveReactionWindow).
function presentRemoteReactionViaHud(msg, actor, token, cands) {
    return new Promise((resolve) => {
        let settled = false;
        let timer = null;
        const timeoutMs = Math.max(0, Number(msg.timeoutMs) || 0);
        const reactionWindow = {
            trigger: msg.trigger,
            actor: { name: msg.reactorName ?? actor?.name ?? "Combatant" },
            target: null,
            candidates: cands.map((c) => ({
                id: c.id,
                name: c.name ?? "Reaction",
                usage: c.usage ?? "",
                type: "reaction",
                legal: true,
            })),
            timeoutMs,
            expiresAt: Date.now() + timeoutMs,
            selectReaction: (selection) => {
                const id = (selection && typeof selection === "object")
                    ? (selection.id ?? selection.uuid ?? null)
                    : selection;
                finish(id ?? null);
            },
            passReaction: () => finish(null),
        };
        const finish = (v) => {
            if (settled) return;
            settled = true;
            if (timer) clearTimeout(timer);
            openRemoteResponses.delete(msg.windowId);
            resolve(v);
        };
        // First-wins close from the acting client: expire the HUD window (the
        // ticker clears it) and settle without sending a real choice.
        openRemoteResponses.set(msg.windowId, () => { reactionWindow.expiresAt = 0; finish(null); });
        // Focus the reactor's token so the HUD renders for it, then open the window.
        try { token.control?.({ releaseOthers: true }); } catch { /* noop */ }
        void emitCombatEvent(COMBAT_EVENTS.REACTION_WINDOW_OPENED, reactionWindow);
        if (timeoutMs > 0) timer = setTimeout(() => finish(null), timeoutMs);
    });
}

// Responder side: a minimal standalone prompt (Phase 1 fallback) — one button
// per candidate plus Pass, auto-passing on the deadline. Resolves to an id|null.
function promptRemoteReaction(msg) {
    const cands = Array.isArray(msg.candidates) ? msg.candidates : [];
    if (!cands.length) return Promise.resolve(null);
    return new Promise((resolve) => {
        let settled = false;
        let timer = null;
        let countdown = null;
        const timeoutMs = Math.max(0, Number(msg.timeoutMs) || 0);
        const deadline = Date.now() + timeoutMs;
        const finish = (v) => {
            if (settled) return;
            settled = true;
            if (timer) clearTimeout(timer);
            if (countdown) clearInterval(countdown);
            openRemoteResponses.delete(msg.windowId);
            resolve(v);
        };
        const buttons = {};
        cands.forEach((c, i) => {
            buttons[`react-${i}`] = {
                label: `${c.name}${c.usage ? ` (${c.usage})` : ""}`,
                callback: () => finish(c.id),
            };
        });
        buttons.pass = { label: "Pass", callback: () => finish(null) };
        const countdownText = timeoutMs > 0
            ? ` <span class="reaction-countdown">${Math.ceil(timeoutMs / 1000)}s</span>`
            : "";
        const dlg = new Dialog({
            title: "Reaction",
            content: `<p><strong>${escapeReactionHtml(msg.reactorName)}</strong> may react to an incoming attack.${countdownText}</p>`,
            buttons,
            default: "pass",
            close: () => finish(null),
        }, { classes: ["reaction-window-dialog"] });
        dlg.render(true);
        // First-wins close from the acting client: shut the dialog and settle.
        openRemoteResponses.set(msg.windowId, () => { try { dlg.close(); } catch { /* noop */ } finish(null); });
        if (timeoutMs > 0) {
            timer = setTimeout(() => { try { dlg.close(); } catch { /* noop */ } finish(null); }, timeoutMs);
            countdown = setInterval(() => {
                const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
                const root = dlg.element?.[0] ?? dlg.element;
                const span = root?.querySelector?.(".reaction-countdown");
                if (span) span.textContent = `${remaining}s`;
            }, 500);
        }
    });
}

export function registerReactionService({ priority = 100 } = {}) {
    bindReactionSocket();
    if (reactionServiceDisposers.length) return;

    reactionServiceDisposers = [
        onCombatEvent(
            COMBAT_EVENTS.THREAT_ZONE_ENTERED,
            (event) => handleReactionTrigger(event, "threat-zone"),
            { priority }
        ),
        onCombatEvent(
            COMBAT_EVENTS.ATTACK_DECLARED,
            (event) => handleReactionTrigger(event, "attack"),
            { priority }
        ),
    ];
}

export function unregisterReactionService() {
    for (const dispose of reactionServiceDisposers) {
        dispose();
    }

    reactionServiceDisposers = [];
}

async function handleReactionTrigger(sourceEvent, trigger) {
    const candidates = await resolveReactionCandidates(sourceEvent, trigger);
    if (!candidates.length) return null;

    const timeoutMs = getReactionWindowTimeoutMs();
    const selectionController = createReactionSelectionController(candidates);
    const reactionWindow = {
        trigger,
        sourceEvent,
        candidates,
        actor:
            sourceEvent.payload?.reactor ??
            sourceEvent.payload?.actor ??
            null,
        target:
            sourceEvent.payload?.target ??
            sourceEvent.payload?.mover ??
            null,
        selectedReaction: null,
        timeoutMs,
        expiresAt: Date.now() + timeoutMs,
        selectReaction: selectionController.selectReaction,
        passReaction: selectionController.passReaction,
        metadata: sourceEvent.payload,
    };

    // Relay the prompt to the reactor's owner (a controlling player, or the GM
    // when a player attacks an NPC). Falls back to the local prompt when we own
    // the reactor or no remote responder is online.
    const windowId = foundry.utils.randomID();
    const reactorActor = candidates.find((c) => c?.actor)?.actor ?? reactionWindow.actor ?? null;
    const relayed = relayReactionWindow({
        windowId, reactorActor, selectionController, candidates, trigger, timeoutMs,
    });

    if (!relayed) {
        const windowEvent = await emitCombatEvent(
            COMBAT_EVENTS.REACTION_WINDOW_OPENED,
            reactionWindow
        );
        const immediateSelection = resolveSelectedReaction(reactionWindow, windowEvent);
        if (immediateSelection) {
            selectionController.selectReaction(immediateSelection);
        }
    }

    const selectedReaction = await waitForReactionSelection({
        reactionWindow,
        selectionController,
    });
    const leftover = pendingRemoteWindows.get(windowId);
    if (leftover) {
        clearWaitingIndicator(leftover);
        pendingRemoteWindows.delete(windowId);
        broadcastReactionClose(windowId);
    }

    if (!selectedReaction) return null;

    if (selectedReaction?.generatedByPersistentEffect === "overwatch") {
        const consumePersistentEffect = game.modules.get(MODULE_ID)?.api?.combat?.consumePersistentEffect;
        if (typeof consumePersistentEffect === "function") {
            await consumePersistentEffect(selectedReaction.actor ?? reactionWindow.actor, "overwatch");
        }
    }

    const resolution = {
        trigger,
        sourceEvent,
        reaction: selectedReaction,
        actor: reactionWindow.actor,
        target: reactionWindow.target,
        metadata: reactionWindow.metadata,
    };

    await emitCombatEvent(COMBAT_EVENTS.REACTION_RESOLVED, resolution);

    sourceEvent.cancel("reaction-triggered");
    sourceEvent.stopPropagation();

    return resolution;
}

async function resolveReactionCandidates(sourceEvent, trigger) {
    const candidates = sourceEvent.payload?.reactionCandidates;
    if (Array.isArray(candidates)) {
        return candidates.filter(Boolean);
    }

    const getReactionCandidates = sourceEvent.payload?.getReactionCandidates;
    if (typeof getReactionCandidates === "function") {
        const resolved = await getReactionCandidates({ trigger, sourceEvent });
        return Array.isArray(resolved) ? resolved.filter(Boolean) : [];
    }

    return [];
}

function resolveSelectedReaction(reactionWindow, windowEvent) {
    if (reactionWindow.selectedReaction) {
        return normalizeSelectedReaction(
            reactionWindow.selectedReaction,
            reactionWindow.candidates
        );
    }

    for (const result of windowEvent.results) {
        const selection =
            result.value?.selectedReaction ??
            result.value?.reaction ??
            result.value ??
            null;

        const selected = normalizeSelectedReaction(
            selection,
            reactionWindow.candidates
        );
        if (selected) return selected;
    }

    return null;
}

function normalizeSelectedReaction(selection, candidates) {
    if (!selection) return null;
    if (typeof selection === "object") return selection;

    return candidates.find(
        (candidate) =>
            candidate?.id === selection || candidate?.uuid === selection
    ) ?? null;
}

function getReactionWindowTimeoutMs() {
    const configuredSeconds = Number(game.settings?.get?.(MODULE_ID, "reactionWindowSeconds"));
    const safeSeconds = Number.isFinite(configuredSeconds) && configuredSeconds >= 0
        ? configuredSeconds
        : DEFAULT_REACTION_WINDOW_SECONDS;
    return safeSeconds * 1000;
}

function createReactionSelectionController(candidates) {
    let settled = false;
    let resolveSelection = null;

    const selectionPromise = new Promise((resolve) => {
        resolveSelection = resolve;
    });

    const settle = (selection) => {
        if (settled) return false;
        settled = true;
        resolveSelection(selection);
        return true;
    };

    return {
        selectionPromise,
        selectReaction(selection) {
            const normalized = normalizeSelectedReaction(selection, candidates);
            if (!normalized) return false;
            return settle(normalized);
        },
        passReaction() {
            return settle(null);
        }
    };
}

async function waitForReactionSelection({ reactionWindow, selectionController }) {
    const timeoutMs = Math.max(0, Number(reactionWindow?.timeoutMs) || 0);
    if (timeoutMs === 0) {
        selectionController.passReaction();
    }

    const timeoutHandle = setTimeout(() => {
        selectionController.passReaction();
    }, timeoutMs);

    try {
        return await selectionController.selectionPromise;
    } finally {
        clearTimeout(timeoutHandle);
    }
}


