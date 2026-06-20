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

function getPostManeuverTimeoutMs() {
    const moduleId = "1547core";
    const configured = Number(globalThis.game?.settings?.get?.(moduleId, "criticalWindowSeconds"));
    const seconds = Number.isFinite(configured) && configured >= 0 ? configured : DEFAULT_POST_MANEUVER_SECONDS;
    return seconds * 1000;
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
    let committedAny = false;
    return relayRemoteWindow({
        kind: "post-maneuver",
        windowId,
        responderActor: actor,
        timeoutMs: getPostManeuverTimeoutMs(),
        multi: true, // sustained window: spend several criticals before closing
        request: {
            side: windowPayload.side ?? "",
            actorName: actor.name ?? "Combatant",
            currentCriticalPoints: Number(windowPayload.currentCriticalPoints ?? 0) || 0,
            candidates,
        },
        // Each pick the responder makes commits one critical maneuver.
        onCommit: (id) => {
            const selection = id ? legal.find((c) => normalizePostManeuverChoiceId(c) === id) ?? null : null;
            if (!selection || typeof windowPayload.commitPostManeuver !== "function") return;
            try { void windowPayload.commitPostManeuver(selection); committedAny = true; } catch (_err) { /* non-fatal */ }
        },
        // The window closed (Done / timeout / out of points). If nothing was spent,
        // resolve the underlying choice as a pass so the orchestrator settles.
        onResolve: () => {
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
    registerRemoteWindowPresenter("post-maneuver", presentPostManeuver);
}
