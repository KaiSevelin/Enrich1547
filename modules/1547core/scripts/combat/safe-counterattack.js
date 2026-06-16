import {
    bindRemoteWindowRelay,
    registerRemoteWindowPresenter,
    presentCandidateDialog,
    escapeRelayHtml,
} from "../services/remote-window-relay.js";

/* ------------------------------------------------------------------ */
/*  Safe counterattack — responder side (B3)                           */
/*                                                                     */
/*  When a defender's chosen defense reaction grants a free safe        */
/*  counterattack, the acting (GM) client offers it to the defender via */
/*  the relay; this presenter renders the yes/no on the defender's own  */
/*  client. The acting client runs the actual counter resolution        */
/*  (declare → roll → defense → resolve), keeping writes authoritative. */
/* ------------------------------------------------------------------ */

function presentSafeCounterattack(msg) {
    const cands = Array.isArray(msg.candidates) && msg.candidates.length
        ? msg.candidates
        : [{ id: "counter", name: "Safe Counterattack" }];
    return presentCandidateDialog({
        title: "Safe Counterattack",
        intro: `<strong>${escapeRelayHtml(msg.defenderName ?? msg.reactorName ?? "Defender")}</strong> may make a free safe counterattack.`,
        candidates: cands.map((c) => ({ id: c.id, label: c.name ?? "Safe Counterattack" })),
        timeoutMs: Math.max(0, Number(msg.timeoutMs) || 0),
        countdownClass: "safe-counter-countdown",
        dialogClass: "safe-counterattack-dialog",
    });
}

export function registerSafeCounterattackRelay() {
    bindRemoteWindowRelay();
    registerRemoteWindowPresenter("safe-counterattack", presentSafeCounterattack);
}
