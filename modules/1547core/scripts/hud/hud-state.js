export const HUD_STATE = {
    activeCategory: "overview",
    activeManeuverGroup: "",
    activeStatPreview: "",
    counterRollEnabled: false,
    counterRollDice: 1,
    // Skills tab "Checks" header: which counter-roll mode the player chose,
    // plus the per-mode selection. Manual = no counter; Stat = counter is
    // target's chosen stat formula; Skill = counter is target's chosen skill
    // formula; General = counter is N d6 picked via difficulty preset + numeric.
    checkMode: "manual",
    checkStatTarget: "Strength",
    checkSkillTarget: "",
    checkGeneralDifficulty: "Average",
    checkGeneralDice: 3,
    collapsed: false,
    reactionWindow: null,
    damageTakenWindow: null,
    selectedAmmoByWeapon: {},
    // Per-weapon toggle for the inline range-band pills. Off by default so two
    // ranged weapons don't both crowd their range numbers into the equipped
    // tab; click the Range button on a weapon row to reveal that weapon's
    // bands.
    weaponRangeShownIds: {},
    inventoryFilter: "all",
    maneuverFilter: "all",
    // The contextual default last applied to maneuverFilter (reaction/post/pre/all);
    // when the context changes, the filter follows it (see hud-render maneuvers case).
    maneuverFilterContext: null,
    maneuverShowAll: false,
    selectedPreManeuverIdsByActor: {},
    selectedFullTurnManeuverIdByActor: {},
    ignoredCostManeuverIdsByActor: {},
    postManeuverQueue: [],
    deferredPostManeuverWindows: [],
    selectedPostManeuverIdByWindow: {},
    selectedReactionChoiceId: null,
    diceTabAttackSelectionByActor: {},
    pendingNextAttackDiceByActor: {},
    diceTabSkillDiceByActor: {},
    pendingNextSkillDiceByActor: {},
};

function normalizeActorKey(actorId) {
    return String(actorId ?? "").trim();
}

function sanitizeDiceCount(value) {
    return Math.max(0, Math.min(10, Number(value) || 0));
}

function cloneDiceMap(source = {}) {
    return Object.fromEntries(
        Object.entries(source ?? {})
            .map(([key, value]) => [String(key), sanitizeDiceCount(value)])
            .filter(([, value]) => value > 0)
    );
}

function getActorDiceMap(store, actorId) {
    const key = normalizeActorKey(actorId);
    if (!key) return {};
    return cloneDiceMap(store?.[key] ?? {});
}

function setActorDiceMap(storeKey, actorId, valueMap) {
    const key = normalizeActorKey(actorId);
    if (!key) return;
    const nextMap = cloneDiceMap(valueMap);
    if (!Object.keys(nextMap).length) {
        delete HUD_STATE[storeKey]?.[key];
        return;
    }
    HUD_STATE[storeKey][key] = nextMap;
}

export function getDiceTabAttackSelection(actorId) {
    return getActorDiceMap(HUD_STATE.diceTabAttackSelectionByActor, actorId);
}

export function setDiceTabAttackSelection(actorId, valueMap) {
    setActorDiceMap("diceTabAttackSelectionByActor", actorId, valueMap);
}

export function setDiceTabAttackSelectionCount(actorId, dieKey, value) {
    const current = getDiceTabAttackSelection(actorId);
    const normalizedKey = String(dieKey ?? "").trim();
    if (!normalizedKey) return;
    const count = sanitizeDiceCount(value);
    if (count > 0) current[normalizedKey] = count;
    else delete current[normalizedKey];
    setDiceTabAttackSelection(actorId, current);
}

export function clearDiceTabAttackSelection(actorId) {
    const key = normalizeActorKey(actorId);
    if (!key) return;
    delete HUD_STATE.diceTabAttackSelectionByActor?.[key];
}

export function getPendingNextAttackDice(actorId) {
    return getActorDiceMap(HUD_STATE.pendingNextAttackDiceByActor, actorId);
}

export function setPendingNextAttackDice(actorId, valueMap) {
    setActorDiceMap("pendingNextAttackDiceByActor", actorId, valueMap);
}

export function clearPendingNextAttackDice(actorId) {
    const key = normalizeActorKey(actorId);
    if (!key) return;
    delete HUD_STATE.pendingNextAttackDiceByActor?.[key];
}

export function getDiceTabSkillDice(actorId) {
    const key = normalizeActorKey(actorId);
    if (!key) return 0;
    return sanitizeDiceCount(HUD_STATE.diceTabSkillDiceByActor?.[key] ?? 0);
}

export function setDiceTabSkillDice(actorId, value) {
    const key = normalizeActorKey(actorId);
    if (!key) return;
    const count = sanitizeDiceCount(value);
    if (count > 0) HUD_STATE.diceTabSkillDiceByActor[key] = count;
    else delete HUD_STATE.diceTabSkillDiceByActor?.[key];
}

export function clearDiceTabSkillDice(actorId) {
    const key = normalizeActorKey(actorId);
    if (!key) return;
    delete HUD_STATE.diceTabSkillDiceByActor?.[key];
}

export function getPendingNextSkillDice(actorId) {
    const key = normalizeActorKey(actorId);
    if (!key) return 0;
    return sanitizeDiceCount(HUD_STATE.pendingNextSkillDiceByActor?.[key] ?? 0);
}

export function setPendingNextSkillDice(actorId, value) {
    const key = normalizeActorKey(actorId);
    if (!key) return;
    const count = sanitizeDiceCount(value);
    if (count > 0) HUD_STATE.pendingNextSkillDiceByActor[key] = count;
    else delete HUD_STATE.pendingNextSkillDiceByActor?.[key];
}

export function clearPendingNextSkillDice(actorId) {
    const key = normalizeActorKey(actorId);
    if (!key) return;
    delete HUD_STATE.pendingNextSkillDiceByActor?.[key];
}

export function getIgnoredCostManeuverIds(actorId) {
    const key = String(actorId ?? "").trim();
    if (!key) return [];
    return Object.keys(HUD_STATE.ignoredCostManeuverIdsByActor?.[key] ?? {}).filter(Boolean);
}

export function isIgnoredCostManeuver(actorId, maneuverId) {
    const actorKey = String(actorId ?? "").trim();
    const maneuverKey = String(maneuverId ?? "").trim();
    if (!actorKey || !maneuverKey) return false;
    return HUD_STATE.ignoredCostManeuverIdsByActor?.[actorKey]?.[maneuverKey] === true;
}

export function setIgnoredCostManeuver(actorId, maneuverId, ignored = true) {
    const actorKey = String(actorId ?? "").trim();
    const maneuverKey = String(maneuverId ?? "").trim();
    if (!actorKey || !maneuverKey) return;
    if (!HUD_STATE.ignoredCostManeuverIdsByActor[actorKey]) {
        HUD_STATE.ignoredCostManeuverIdsByActor[actorKey] = {};
    }
    if (ignored) {
        HUD_STATE.ignoredCostManeuverIdsByActor[actorKey][maneuverKey] = true;
    } else {
        delete HUD_STATE.ignoredCostManeuverIdsByActor[actorKey][maneuverKey];
        if (!Object.keys(HUD_STATE.ignoredCostManeuverIdsByActor[actorKey]).length) {
            delete HUD_STATE.ignoredCostManeuverIdsByActor[actorKey];
        }
    }
}

export function clearIgnoredCostManeuver(actorId, maneuverId) {
    setIgnoredCostManeuver(actorId, maneuverId, false);
}

export function clearIgnoredCostManeuvers(actorId) {
    const key = String(actorId ?? "").trim();
    if (!key || !HUD_STATE.ignoredCostManeuverIdsByActor?.[key]) return;
    delete HUD_STATE.ignoredCostManeuverIdsByActor[key];
}
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

export function setDeferredPostManeuverWindows(windows) {
    HUD_STATE.deferredPostManeuverWindows = Array.isArray(windows)
        ? windows.filter((entry) => entry?.id)
        : [];
}

export function releaseDeferredPostManeuverWindows() {
    const pending = Array.isArray(HUD_STATE.deferredPostManeuverWindows)
        ? [...HUD_STATE.deferredPostManeuverWindows]
        : [];
    HUD_STATE.deferredPostManeuverWindows = [];
    for (const windowPayload of pending) {
        queuePostManeuverWindow(windowPayload);
    }
    return pending;
}

export function clearDeferredPostManeuverWindows() {
    HUD_STATE.deferredPostManeuverWindows = [];
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
