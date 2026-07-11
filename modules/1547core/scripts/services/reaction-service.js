import { MODULE_ID } from "../lib/constants.mjs";
﻿import {
    COMBAT_EVENTS,
    emitCombatEvent,
    onCombatEvent,
} from "./combat-events.js";
import {
    bindRemoteWindowRelay,
    registerRemoteWindowPresenter,
    relayRemoteWindow,
    closeRelayedWindow,
    presentCandidateDialog,
    escapeRelayHtml,
} from "./remote-window-relay.js";
import { isReactionAvailable, isMovementReactionAvailable } from "../combat/activation-state.mjs";

const DEFAULT_REACTION_WINDOW_SECONDS = 10;

let reactionServiceDisposers = [];

/* ------------------------------------------------------------------ */
/*  Cross-client reaction window (cross-client-reaction-spec-v1)       */
/*  Combat events run on a local bus, so a reaction prompt would only  */
/*  appear on the acting client. The generic remote-window-relay routes */
/*  it to the reactor's owner; this module supplies the reaction-kind   */
/*  responder presenter and the acting-side resolve wiring. The acting  */
/*  client stays the authority (timeout, resolution, writes).          */
/* ------------------------------------------------------------------ */

function serializeReactionCandidates(candidates) {
    return (candidates ?? [])
        .filter((c) => c && c.legal !== false && c.id)
        .map((c) => ({ id: c.id, name: c.name ?? "Reaction", usage: c.usage ?? "" }));
}

// Responder presenter: render the reaction prompt and resolve with the chosen
// candidate id (or null). Prefers the in-HUD reaction window for a consistent
// UX; falls back to a dialog when the reactor has no token on the active scene.
// Returns { promise, close } for the relay's first-wins / timeout handling.
function presentReaction(msg) {
    const cands = Array.isArray(msg.candidates) ? msg.candidates : [];
    if (!cands.length) return { promise: Promise.resolve(null), close: () => {} };
    const actor = msg.forActorId ? game.actors?.get(msg.forActorId) : null;
    const token = actor?.getActiveTokens?.(true)?.[0] ?? actor?.getActiveTokens?.()?.[0] ?? null;
    return token ? presentReactionViaHud(msg, actor, token, cands) : presentReactionDialog(msg, cands);
}

// Reconstruct a reactionWindow and feed it through the existing HUD reaction UI
// by emitting REACTION_WINDOW_OPENED locally. The HUD's Commit/Pass bindings
// call selectReaction/passReaction; the window auto-expires on its deadline.
function presentReactionViaHud(msg, actor, token, cands) {
    let closeFn = () => {};
    const promise = new Promise((resolve) => {
        let settled = false;
        let timer = null;
        const timeoutMs = Math.max(0, Number(msg.timeoutMs) || 0);
        const done = (v) => { if (settled) return; settled = true; if (timer) clearTimeout(timer); resolve(v); };
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
                done(id ?? null);
            },
            passReaction: () => done(null),
        };
        // First-wins close from the acting client: expire the HUD window (the
        // ticker clears it) and settle without sending a real choice.
        closeFn = () => { reactionWindow.expiresAt = 0; done(null); };
        // Focus the reactor's token so the HUD renders for it, then open the window.
        try { token.control?.({ releaseOthers: true }); } catch { /* noop */ }
        void emitCombatEvent(COMBAT_EVENTS.REACTION_WINDOW_OPENED, reactionWindow);
        if (timeoutMs > 0) timer = setTimeout(() => done(null), timeoutMs);
    });
    return { promise, close: () => closeFn() };
}

// Fallback standalone prompt — one button per candidate plus Pass, with a live
// countdown, auto-passing on the deadline.
function presentReactionDialog(msg, cands) {
    return presentCandidateDialog({
        title: "Reaction",
        intro: `<strong>${escapeRelayHtml(msg.reactorName)}</strong> may react to an incoming attack.`,
        candidates: cands.map((c) => ({ id: c.id, label: `${c.name}${c.usage ? ` (${c.usage})` : ""}` })),
        timeoutMs: Math.max(0, Number(msg.timeoutMs) || 0),
        countdownClass: "reaction-countdown",
        dialogClass: "reaction-window-dialog",
    });
}

// Acting side: relay to the reactor's owner; the choice routes back through the
// selectionController. Returns true if relayed (caller skips the local prompt).
function relayReactionWindow({ windowId, reactorActor, selectionController, candidates, trigger, timeoutMs }) {
    return relayRemoteWindow({
        kind: "reaction",
        windowId,
        responderActor: reactorActor,
        timeoutMs,
        request: { trigger, candidates: serializeReactionCandidates(candidates) },
        onResolve: (id) => {
            if (id) selectionController.selectReaction(id);
            else selectionController.passReaction();
        },
    });
}

export function registerReactionService({ priority = 100 } = {}) {
    bindRemoteWindowRelay();
    registerRemoteWindowPresenter("reaction", presentReaction);
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
    // A reaction-generated free attack (safe attack / counterattack) re-emits
    // ATTACK_DECLARED. Don't open a fresh reaction window for it, or reactions
    // recurse (an overwatch shot would itself be reactable, and so on).
    if (sourceEvent?.payload?.metadata?.generatedByReaction) return null;

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
    // The reactor is whoever may react: for an attack that's the *defender*
    // (reactionWindow.actor is the attacker here), for a threat zone it's the
    // zone owner. Candidate builders now stamp `.actor` (the reactor) on every
    // candidate, so this resolves deterministically; the trigger-aware fallback
    // remains only as a safety net for any externally-supplied candidate list.
    const reactorActor = candidates.find((c) => c?.actor)?.actor
        ?? (trigger === "attack" ? reactionWindow.target : reactionWindow.actor)
        ?? reactionWindow.actor
        ?? null;

    // Reaction economy: ONE reaction per round. Using any reaction (movement or
    // attack) spends it, after which NO further window is offered this round.
    // Movement additionally de-dups per opponent: each mover entering the threat
    // zone offers at most once per round (passing burns that opponent's offer but
    // NOT the one reaction), so a pass on A doesn't block reacting to B.
    const combat = globalThis.game?.combat;
    const mover = trigger === "threat-zone" ? (sourceEvent.payload?.mover ?? null) : null;
    if (reactorActor) {
        const hasReaction = isReactionAvailable(reactorActor, combat);
        const available = trigger === "threat-zone"
            ? hasReaction && isMovementReactionAvailable(reactorActor, mover, combat)
            : hasReaction;
        if (!available) return null;
    }

    const relayed = relayReactionWindow({
        windowId, reactorActor, selectionController, candidates, trigger, timeoutMs,
    });

    // Open the window on the acting client only when it is the authority for it:
    //  - not relayed (we own the reactor) → the local prompt IS the prompt; or
    //  - we are the GM → mirror it so the GM sees every reaction dialog, even one
    //    also relayed to the defending player (GM attacks a player → both see it).
    // A player attacking a GM-owned reactor must NOT see it locally — only the GM
    // does, via the relay. First response wins via the single-settle controller.
    const openedLocally = !relayed || game.user?.isGM;
    if (openedLocally) {
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
    // If the acting client resolved first, close the responder's relayed copy
    // and clear the waiting indicator (no-op if the responder already answered).
    if (relayed) closeRelayedWindow(windowId);

    // Spend the reaction economy. ONE reaction per round: actually USING a
    // reaction (movement or attack) marks the single per-round reaction spent, so
    // no further window of any kind is offered this round.
    //
    // Movement also marks a per-opponent flag on resolution — pass OR use — so a
    // declined opportunity doesn't re-trigger on the same mover this round (the
    // "once per opponent" offer), while a pass still leaves the one reaction
    // available for a different mover or an incoming attack. Only spend it when a
    // prompt was actually presentable: a relay that reached a live owner, or a
    // locally-opened window with a real (positive) duration — a zero-length window
    // auto-passes instantly, so burning the economy there would be a silent no-show.
    const promptPresented = relayed || (openedLocally && timeoutMs > 0);
    const combatApi = game.modules.get(MODULE_ID)?.api?.combat;
    if (trigger === "threat-zone") {
        if (reactorActor && mover && promptPresented) void combatApi?.markMovementReacted?.(reactorActor, mover);
        if (selectedReaction && reactorActor) void combatApi?.markReactionUsed?.(reactorActor);
    } else if (selectedReaction && reactorActor) {
        void combatApi?.markReactionUsed?.(reactorActor);
    }

    // Spend the chosen reaction maneuver's resource cost (e.g. Core Defense's
    // Core Point). markReactionUsed only spends the per-turn reaction budget, so
    // costed reactions were never charging their pool.
    if (selectedReaction && reactorActor) {
        const costManeuver = (selectedReaction.CostType ?? selectedReaction.source?.CostType)
            ? (selectedReaction.CostType ? selectedReaction : selectedReaction.source)
            : selectedReaction;
        void combatApi?.spendActorManeuverCost?.(reactorActor, costManeuver);
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

    // A free safe attack / counterattack REPLACES the normal resolution
    // (executeResolvedReactionPhased runs it), so cancel the declaration. A plain
    // defense reaction (Desperate Defense, Evade, Face, …) only MODIFIES the
    // incoming attack — let the declaration proceed so the attacker still rolls
    // and resolveAttackOutcome applies the reaction's defense modifiers. Cancelling
    // those would drop the whole attack (no attack/defense roll, no damage card).
    const effect = selectedReaction?.effectData ?? {};
    if (effect.createFreeSafeAttack || effect.createFreeSafeCounterattack) {
        sourceEvent.cancel("reaction-triggered");
        sourceEvent.stopPropagation();
    }

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


