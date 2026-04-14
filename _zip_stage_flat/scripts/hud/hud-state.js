export const HUD_STATE = {
    activeCategory: "overview",
    activeManeuverGroup: "",
    activeStatPreview: "",
    counterRollEnabled: false,
    counterRollDice: 1,
    collapsed: false,
    reactionWindow: null,
    damageTakenWindow: null,
    selectedAmmoByWeapon: {},
    inventoryFilter: "all",
    selectedPreManeuverIdsByActor: {},
    selectedFullTurnManeuverIdByActor: {},
    postManeuverQueue: [],
    selectedPostManeuverIdByWindow: {},
    selectedReactionChoiceId: null,
};

export function getSelectedPreManeuverIds(actorId) {
    const key = String(actorId ?? "").trim();
    if (!key) return [];
    const ids = HUD_STATE.selectedPreManeuverIdsByActor?.[key];
    return Array.isArray(ids) ? [...ids] : [];
}

export function setSelectedPreManeuverIds(actorId, ids) {
    const key = String(actorId ?? "").trim();
    if (!key) return;
    HUD_STATE.selectedPreManeuverIdsByActor[key] = Array.from(new Set((Array.isArray(ids) ? ids : []).filter(Boolean)));
}

export function clearSelectedPreManeuvers(actorId) {
    const key = String(actorId ?? "").trim();
    if (!key || !HUD_STATE.selectedPreManeuverIdsByActor?.[key]) return;
    delete HUD_STATE.selectedPreManeuverIdsByActor[key];
}

export function toggleSelectedPreManeuver(actorId, maneuverId) {
    const current = new Set(getSelectedPreManeuverIds(actorId));
    if (current.has(maneuverId)) current.delete(maneuverId);
    else current.add(maneuverId);
    setSelectedPreManeuverIds(actorId, Array.from(current));
}

export function getSelectedFullTurnManeuverId(actorId) {
    const key = String(actorId ?? "").trim();
    if (!key) return null;
    const id = HUD_STATE.selectedFullTurnManeuverIdByActor?.[key];
    return String(id ?? "").trim() || null;
}

export function setSelectedFullTurnManeuverId(actorId, maneuverId) {
    const key = String(actorId ?? "").trim();
    if (!key) return;
    const normalizedId = String(maneuverId ?? "").trim();
    if (!normalizedId) {
        delete HUD_STATE.selectedFullTurnManeuverIdByActor[key];
        return;
    }
    HUD_STATE.selectedFullTurnManeuverIdByActor[key] = normalizedId;
}

export function clearSelectedFullTurnManeuver(actorId) {
    const key = String(actorId ?? "").trim();
    if (!key || !HUD_STATE.selectedFullTurnManeuverIdByActor?.[key]) return;
    delete HUD_STATE.selectedFullTurnManeuverIdByActor[key];
}

export function toggleSelectedFullTurnManeuver(actorId, maneuverId) {
    const current = getSelectedFullTurnManeuverId(actorId);
    if (current && current === maneuverId) {
        clearSelectedFullTurnManeuver(actorId);
        return;
    }
    setSelectedFullTurnManeuverId(actorId, maneuverId);
}

export function clearActorManeuverSelections(actorId) {
    clearSelectedPreManeuvers(actorId);
    clearSelectedFullTurnManeuver(actorId);
}

export function getSelectedReactionChoiceId() {
    return String(HUD_STATE.selectedReactionChoiceId ?? "").trim() || null;
}

export function setSelectedReactionChoiceId(choiceId) {
    const normalizedId = String(choiceId ?? "").trim();
    HUD_STATE.selectedReactionChoiceId = normalizedId || null;
}

export function toggleSelectedReactionChoiceId(choiceId) {
    const normalizedId = String(choiceId ?? "").trim();
    if (!normalizedId) return;
    if (getSelectedReactionChoiceId() === normalizedId) {
        HUD_STATE.selectedReactionChoiceId = null;
        return;
    }
    HUD_STATE.selectedReactionChoiceId = normalizedId;
}

export function normalizePostManeuverChoiceId(candidate) {
    return String(candidate?._id ?? candidate?.id ?? candidate?.uuid ?? candidate?.name ?? "").trim();
}

export function getActivePostManeuverWindow() {
    const queue = Array.isArray(HUD_STATE.postManeuverQueue) ? HUD_STATE.postManeuverQueue : [];
    return queue[0] ?? null;
}

export function queuePostManeuverWindow(windowPayload) {
    if (!windowPayload?.id) return;
    if (!Array.isArray(HUD_STATE.postManeuverQueue)) {
        HUD_STATE.postManeuverQueue = [];
    }
    const initialSelection = normalizePostManeuverChoiceId(windowPayload.selectedPostManeuver);
    if (initialSelection) {
        HUD_STATE.selectedPostManeuverIdByWindow[windowPayload.id] = initialSelection;
    }
    HUD_STATE.postManeuverQueue.push(windowPayload);
}

export function advancePostManeuverWindow() {
    if (!Array.isArray(HUD_STATE.postManeuverQueue) || !HUD_STATE.postManeuverQueue.length) return null;
    const finished = HUD_STATE.postManeuverQueue.shift();
    if (finished?.id) {
        delete HUD_STATE.selectedPostManeuverIdByWindow[finished.id];
    }
    return finished ?? null;
}

export function clearPostManeuverWindows() {
    for (const entry of HUD_STATE.postManeuverQueue ?? []) {
        if (entry?.id) delete HUD_STATE.selectedPostManeuverIdByWindow[entry.id];
    }
    HUD_STATE.postManeuverQueue = [];
}

export function getSelectedPostManeuverId(windowId) {
    const key = String(windowId ?? "").trim();
    if (!key) return null;
    return String(HUD_STATE.selectedPostManeuverIdByWindow?.[key] ?? "").trim() || null;
}

export function toggleSelectedPostManeuver(windowId, maneuverId) {
    const key = String(windowId ?? "").trim();
    if (!key) return;
    const current = getSelectedPostManeuverId(key);
    if (current && current === maneuverId) {
        delete HUD_STATE.selectedPostManeuverIdByWindow[key];
        return;
    }
    HUD_STATE.selectedPostManeuverIdByWindow[key] = String(maneuverId ?? "").trim();
}

export function getActiveDamageTakenWindow() {
    return HUD_STATE.damageTakenWindow ?? null;
}

export function setHudDamageTakenWindow(windowPayload) {
    HUD_STATE.damageTakenWindow = windowPayload ?? null;
}

export function clearHudDamageTakenWindow() {
    HUD_STATE.damageTakenWindow = null;
}
