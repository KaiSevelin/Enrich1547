import {
    COMBAT_EVENTS,
    emitCombatEvent,
    onCombatEvent,
} from "./combat-events.js";

const MODULE_ID = "1547core";
const DEFAULT_REACTION_WINDOW_SECONDS = 10;

let reactionServiceDisposers = [];

export function registerReactionService({ priority = 100 } = {}) {
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

    const windowEvent = await emitCombatEvent(
        COMBAT_EVENTS.REACTION_WINDOW_OPENED,
        reactionWindow
    );
    const immediateSelection = resolveSelectedReaction(reactionWindow, windowEvent);
    if (immediateSelection) {
        selectionController.selectReaction(immediateSelection);
    }

    const selectedReaction = await waitForReactionSelection({
        reactionWindow,
        selectionController,
    });

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


