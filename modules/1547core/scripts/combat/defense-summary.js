import { COMBAT_EVENTS, emitCombatEvent } from "../services/combat-events.js";
import {
    bindRemoteWindowRelay,
    registerRemoteWindowPresenter,
    relayRemoteWindow,
} from "../services/remote-window-relay.js";

/* ------------------------------------------------------------------ */
/*  Defense-summary window (informational)                             */
/*                                                                     */
/*  After an attack resolves, push a short defense/damage summary to    */
/*  the *defender's* own client (the HUD damage-taken window). Combat   */
/*  events run on the acting client only, so without this the defending */
/*  player never sees a breakdown — only the public attack-result chat  */
/*  card. Informational: no choice is returned (a remote mirror omits   */
/*  the safe-counterattack action, which stays on the acting client).   */
/* ------------------------------------------------------------------ */

const SUMMARY_TTL_MS = 10000;

// Serialisable payload matching what buildDamageTakenPrompt reads.
function buildSummaryPayload(resolvedAttack, attacker, defender) {
    const dm = resolvedAttack?.defenseModifiers ?? {};
    const reactionName = resolvedAttack?.selectedReaction?.name ?? resolvedAttack?.defenseReaction?.name ?? null;
    return {
        pendingAttack: {
            actor: { name: attacker?.name ?? "Attacker" },
            target: { name: defender?.name ?? "Target" },
        },
        damageApplied: Number(resolvedAttack?.damageApplied ?? 0) || 0,
        hitPointUpdate: {
            currentHitPoints: resolvedAttack?.hitPointUpdate?.currentHitPoints ?? null,
        },
        defenseModifiers: {
            addArmorDice: Number(dm.addArmorDice ?? 0) || 0,
            reduceDamageTaken: Number(dm.reduceDamageTaken ?? 0) || 0,
            // Display-only: the counterattack itself is offered/executed by the
            // acting client's offerSafeCounterattack relay, never this window.
            safeCounterattack: Boolean(dm.safeCounterattack),
        },
        defenseFollowUpState: {
            lockedParryingWeaponUntil: resolvedAttack?.defenseFollowUpState?.lockedParryingWeaponUntil ?? null,
        },
        selectedReaction: reactionName ? { name: reactionName } : null,
    };
}

// Show the damage-taken summary locally (used on the responder, and as the GM
// fallback would be — but we skip GM since they get the chat card). Auto-clears.
function showSummaryLocally(summary, token) {
    try { token?.control?.({ releaseOthers: true }); } catch { /* noop */ }
    void emitCombatEvent(COMBAT_EVENTS.DAMAGE_TAKEN_WINDOW_OPENED, summary);
    setTimeout(() => { void emitCombatEvent(COMBAT_EVENTS.DAMAGE_TAKEN_WINDOW_OPENED, null); }, SUMMARY_TTL_MS);
}

// Responder presenter (informational — returns nothing).
function presentDefenseSummary(msg) {
    const summary = msg?.summary ?? null;
    if (!summary) return;
    const actor = msg.forActorId ? game.actors?.get(msg.forActorId) : null;
    const token = actor?.getActiveTokens?.(true)?.[0] ?? actor?.getActiveTokens?.()?.[0] ?? null;
    showSummaryLocally(summary, token);
}

/**
 * Acting side: push the defense summary to the defender's owner. No-op (silently)
 * when the defender has no remote owner — the GM already sees the attack-result
 * chat card, so an NPC defender needs no window.
 */
export function showDefenseSummary({ resolvedAttack, attacker, defender } = {}) {
    if (!resolvedAttack || !defender) return;
    const summary = buildSummaryPayload(resolvedAttack, attacker, defender);
    relayRemoteWindow({
        kind: "defense-summary",
        windowId: foundry.utils.randomID(),
        responderActor: defender,
        timeoutMs: SUMMARY_TTL_MS,
        expectsResponse: false,
        request: { summary },
    });
}

export function registerDefenseSummaryRelay() {
    bindRemoteWindowRelay();
    registerRemoteWindowPresenter("defense-summary", presentDefenseSummary);
}
