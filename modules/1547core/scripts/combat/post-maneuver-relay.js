import { normalizePostManeuverChoiceId } from "../hud/hud-state.js";
import {
    bindRemoteWindowRelay,
    registerRemoteWindowPresenter,
    relayRemoteWindow,
    escapeRelayHtml,
} from "../services/remote-window-relay.js";

/* ------------------------------------------------------------------ */
/*  Cross-client post-maneuver windows                                 */
/*                                                                     */
/*  After an attack resolves, the loser/winner may spend critical      */
/*  points on a post-maneuver. These windows open on the *acting*       */
/*  client (local event bus), so a defender owned by a remote player    */
/*  never saw the prompt. This relays the choice to that owner; the     */
/*  acting client still executes the maneuver (commitPostManeuver does  */
/*  the combat writes). Built on the generic remote-window-relay.       */
/* ------------------------------------------------------------------ */

const DEFAULT_POST_MANEUVER_SECONDS = 30;
const MODULE_ID = "1547core";
const VIEW_CHANNEL = `module.${MODULE_ID}`;
const VIEW_OPEN = "crit-view-open";
const VIEW_UPDATE = "crit-view-update";
const VIEW_CLOSE = "crit-view-close";

function getPostManeuverTimeoutMs() {
    const configured = Number(globalThis.game?.settings?.get?.(MODULE_ID, "criticalWindowSeconds"));
    const seconds = Number.isFinite(configured) && configured >= 0 ? configured : DEFAULT_POST_MANEUVER_SECONDS;
    return seconds * 1000;
}

/* ----------------- GM view-only mirror of a player's window ---------------- */
// "Always show for GM": when a critical window belongs to a PLAYER, the GM gets a
// read-only mirror that updates as the player spends. View-only (no buttons) so
// it can never double-commit or over-spend — the controlling player drives.
const critViews = new Map();

function openCritView({ windowId, title, actorName, crit, candidates }) {
    if (!windowId || critViews.has(windowId)) return;
    const list = (Array.isArray(candidates) ? candidates : [])
        .map((c) => `<li>${escapeRelayHtml(c.name)}${c.cost ? ` — ${c.cost} crit` : ""}</li>`).join("");
    const content = `<div class="post-crit-view">`
        + `<p><strong>${escapeRelayHtml(actorName ?? "Combatant")}</strong> is spending critical points `
        + `<span class="crit-view-remaining">(${Number(crit) || 0} left)</span></p>`
        + `<ul class="crit-view-list">${list || "<li>(none)</li>"}</ul>`
        + `<p class="crit-view-log"></p>`
        + `<p><em>View only — the controlling player chooses.</em></p></div>`;
    const dlg = new Dialog(
        { title: title ?? "Critical Maneuvers (watching)", content, buttons: { ok: { label: "Close" } }, default: "ok" },
        { classes: ["post-maneuver-dialog", "post-crit-view-dialog"] }
    );
    dlg.render(true);
    critViews.set(windowId, dlg);
}

function updateCritView({ windowId, committedName, remaining }) {
    const dlg = critViews.get(windowId);
    if (!dlg) return;
    const root = dlg.element?.[0] ?? dlg.element;
    const rem = root?.querySelector?.(".crit-view-remaining");
    if (rem) rem.textContent = `(${Number(remaining) || 0} left)`;
    const log = root?.querySelector?.(".crit-view-log");
    if (log && committedName) log.innerHTML += `${log.innerHTML ? "<br>" : ""}Spent: ${escapeRelayHtml(committedName)}`;
}

function closeCritView(windowId) {
    const dlg = critViews.get(windowId);
    if (!dlg) return;
    critViews.delete(windowId);
    try { dlg.close(); } catch { /* noop */ }
}

// Drive the GM mirror: act locally if we ARE the GM (the acting client), else send
// it to the GM over the socket (a player is acting).
function notifyGmCritView(kind, payload) {
    if (globalThis.game?.user?.isGM) {
        if (kind === VIEW_OPEN) openCritView(payload);
        else if (kind === VIEW_UPDATE) updateCritView(payload);
        else if (kind === VIEW_CLOSE) closeCritView(payload.windowId);
        return;
    }
    try { globalThis.game?.socket?.emit(VIEW_CHANNEL, { type: kind, ...payload }); } catch { /* noop */ }
}

let viewSocketBound = false;
function bindCritViewSocket() {
    if (viewSocketBound || !globalThis.game?.socket) return;
    viewSocketBound = true;
    globalThis.game.socket.on(VIEW_CHANNEL, (msg) => {
        if (!globalThis.game?.user?.isGM || !msg) return;
        if (msg.type === VIEW_OPEN) openCritView(msg);
        else if (msg.type === VIEW_UPDATE) updateCritView(msg);
        else if (msg.type === VIEW_CLOSE) closeCritView(msg.windowId);
    });
}

// Serialise a post-maneuver candidate for the wire (id + label only).
function serializePostManeuver(candidate) {
    const id = normalizePostManeuverChoiceId(candidate);
    if (!id) return null;
    const name = String(candidate?.name ?? candidate?._id ?? "Maneuver");
    const cost = Number(candidate?.cost ?? candidate?.costAmount ?? candidate?.CostAmount ?? 0) || 0;
    return { id, name, cost };
}

/**
 * Acting side: if this post-maneuver window's actor is owned by a remote player
 * (or the GM, for a player-driven attack), relay the choice to them and execute
 * the result locally. Returns true if relayed (caller skips queuing it in the
 * local HUD).
 */
export function relayPostManeuverWindow(windowPayload) {
    const actor = windowPayload?.actor;
    if (!actor) return false;
    const legal = Array.isArray(windowPayload.legalPostManeuvers) ? windowPayload.legalPostManeuvers : [];
    const candidates = legal.map(serializePostManeuver).filter(Boolean);
    if (!candidates.length) return false; // nothing to choose — let the local/no-op path handle it

    const windowId = windowPayload.id ?? foundry.utils.randomID();
    const actorName = actor.name ?? "Combatant";
    const side = windowPayload.side ?? "";
    // The GM watches a PLAYER's critical window (read-only mirror). A GM/NPC actor
    // is already shown to the GM (local HUD or relayed to the GM), so no mirror.
    const mirrorToGm = actor.hasPlayerOwner === true;
    let viewRemaining = Number(windowPayload.currentCriticalPoints ?? 0) || 0;
    let committedAny = false;
    if (mirrorToGm) {
        notifyGmCritView(VIEW_OPEN, {
            windowId,
            title: side === "defender" ? "Defender Critical Maneuvers (watching)" : "Critical Maneuvers (watching)",
            actorName,
            crit: viewRemaining,
            candidates,
        });
    }
    return relayRemoteWindow({
        kind: "post-maneuver",
        windowId,
        responderActor: actor,
        timeoutMs: getPostManeuverTimeoutMs(),
        multi: true, // sustained window: spend several criticals before closing
        request: {
            side,
            actorName,
            currentCriticalPoints: viewRemaining,
            candidates,
        },
        // Each pick the responder makes commits one critical maneuver.
        onCommit: (id) => {
            const selection = id ? legal.find((c) => normalizePostManeuverChoiceId(c) === id) ?? null : null;
            if (!selection || typeof windowPayload.commitPostManeuver !== "function") return;
            try { void windowPayload.commitPostManeuver(selection); committedAny = true; } catch (_err) { /* non-fatal */ }
            if (mirrorToGm) {
                viewRemaining = Math.max(0, viewRemaining - (Number(serializePostManeuver(selection)?.cost) || 0));
                notifyGmCritView(VIEW_UPDATE, { windowId, committedName: selection.name ?? "critical maneuver", remaining: viewRemaining });
            }
        },
        // The window closed (Done / timeout / out of points). If nothing was spent,
        // resolve the underlying choice as a pass so the orchestrator settles.
        onResolve: () => {
            if (mirrorToGm) notifyGmCritView(VIEW_CLOSE, { windowId });
            if (!committedAny && typeof windowPayload.passPostManeuver === "function") {
                try { windowPayload.passPostManeuver(); } catch (_err) { /* non-fatal */ }
            }
        },
    });
}

// Responder presenter: a SUSTAINED dialog — the actor spends critical points on
// as many critical maneuvers as they can afford. Each pick commits immediately
// (respond, non-final) and the list re-filters by the points left; the window
// stays open until Done, timeout, or no affordable maneuver remains.
function presentPostManeuver(msg, helpers = {}) {
    const respond = typeof helpers.respond === "function" ? helpers.respond : () => {};
    let candidates = (Array.isArray(msg.candidates) ? msg.candidates : []).filter(Boolean);
    if (!candidates.length) return { promise: Promise.resolve(null), close: () => {} };

    let remaining = Number(msg.currentCriticalPoints ?? 0) || 0;
    const ms = Math.max(0, Number(msg.timeoutMs) || 0);
    let dlg = null;
    let closeFn = () => {};
    const promise = new Promise((resolve) => {
        let settled = false;
        let timer = null;
        let countdown = null;
        const deadline = Date.now() + ms;
        const done = () => {
            if (settled) return;
            settled = true;
            if (timer) clearTimeout(timer);
            if (countdown) clearInterval(countdown);
            try { dlg?.close(); } catch { /* noop */ }
            resolve(null);
        };
        const affordable = () => candidates.filter((c) => (Number(c.cost) || 0) <= remaining);
        const paint = (root) => {
            if (!root) return;
            const critSpan = root.querySelector(".post-crit-remaining");
            if (critSpan) critSpan.textContent = String(remaining);
            const list = root.querySelector(".post-crit-list");
            if (!list) return;
            const aff = affordable();
            list.innerHTML = aff.length
                ? aff.map((c) => `<button type="button" class="post-crit-pick" data-id="${escapeRelayHtml(c.id)}">${escapeRelayHtml(c.name)}${c.cost ? ` — ${c.cost} crit` : ""}</button>`).join("")
                : `<p class="post-crit-empty">No more affordable critical maneuvers.</p>`;
            list.querySelectorAll(".post-crit-pick").forEach((btn) => {
                btn.addEventListener("click", () => {
                    const id = btn.dataset.id;
                    const picked = candidates.find((c) => c.id === id);
                    if (!picked) return;
                    respond(id, { final: false });                 // commit on the acting client
                    remaining -= (Number(picked.cost) || 0);
                    candidates = candidates.filter((c) => c.id !== id); // one of each per window
                    paint(root);
                    if (!affordable().length) done();
                });
            });
        };
        const countdownText = ms > 0 ? ` <span class="post-maneuver-countdown">${Math.ceil(ms / 1000)}s</span>` : "";
        const content = `<div class="post-crit-window">`
            + `<p><strong>${escapeRelayHtml(msg.actorName ?? "Combatant")}</strong> — critical points: <span class="post-crit-remaining">${remaining}</span>${countdownText}</p>`
            + `<div class="post-crit-list"></div></div>`;
        dlg = new Dialog({
            title: msg.side === "defender" ? "Defender Critical Maneuvers" : "Critical Maneuvers",
            content,
            buttons: { done: { label: "Done", callback: () => done() } },
            default: "done",
            close: () => done(),
            render: (html) => paint(html?.[0] ?? html),
        }, { classes: ["post-maneuver-dialog", "reaction-window-dialog"] });
        dlg.render(true);
        closeFn = () => done();
        if (ms > 0) {
            timer = setTimeout(() => done(), ms);
            countdown = setInterval(() => {
                const remainingS = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
                const span = (dlg.element?.[0] ?? dlg.element)?.querySelector?.(".post-maneuver-countdown");
                if (span) span.textContent = `${remainingS}s`;
            }, 500);
        }
    });
    return { promise, close: () => closeFn() };
}

export function registerPostManeuverRelay() {
    bindRemoteWindowRelay();
    bindCritViewSocket();
    registerRemoteWindowPresenter("post-maneuver", presentPostManeuver);
}
