import { normalizePostManeuverChoiceId } from "../hud/hud-state.js";
import {
    bindRemoteWindowRelay,
    registerRemoteWindowPresenter,
    relayRemoteWindow,
    presentCandidateDialog,
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

const DEFAULT_POST_MANEUVER_SECONDS = 15;

function getPostManeuverTimeoutMs() {
    return DEFAULT_POST_MANEUVER_SECONDS * 1000;
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
    return relayRemoteWindow({
        kind: "post-maneuver",
        windowId,
        responderActor: actor,
        timeoutMs: getPostManeuverTimeoutMs(),
        request: {
            side: windowPayload.side ?? "",
            actorName: actor.name ?? "Combatant",
            currentCriticalPoints: Number(windowPayload.currentCriticalPoints ?? 0) || 0,
            candidates,
        },
        onResolve: (id) => {
            const selection = id
                ? legal.find((c) => normalizePostManeuverChoiceId(c) === id) ?? null
                : null;
            try {
                if (selection && typeof windowPayload.commitPostManeuver === "function") {
                    void windowPayload.commitPostManeuver(selection);
                } else if (typeof windowPayload.passPostManeuver === "function") {
                    windowPayload.passPostManeuver();
                }
            } catch (_err) { /* non-fatal */ }
        },
    });
}

// Responder presenter: a dialog listing the legal post-maneuvers + Pass.
function presentPostManeuver(msg) {
    const cands = Array.isArray(msg.candidates) ? msg.candidates : [];
    if (!cands.length) return { promise: Promise.resolve(null), close: () => {} };
    const crit = Number(msg.currentCriticalPoints ?? 0) || 0;
    const intro = `<strong>${escapeRelayHtml(msg.actorName ?? msg.reactorName ?? "Combatant")}</strong> may spend critical points`
        + `${crit ? ` (${crit} available)` : ""} on a post maneuver.`;
    return presentCandidateDialog({
        title: msg.side === "defender" ? "Defender Post Maneuver" : "Post Maneuver",
        intro,
        candidates: cands.map((c) => ({
            id: c.id,
            label: `${c.name}${c.cost ? ` — ${c.cost} crit` : ""}`,
        })),
        timeoutMs: Math.max(0, Number(msg.timeoutMs) || 0),
        countdownClass: "post-maneuver-countdown",
        dialogClass: "post-maneuver-dialog",
    });
}

export function registerPostManeuverRelay() {
    bindRemoteWindowRelay();
    registerRemoteWindowPresenter("post-maneuver", presentPostManeuver);
}
