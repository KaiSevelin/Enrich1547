import { getCoreStackCount, setCoreStackCount } from "./hud-state.js";
import { rollToChat } from "../lib/roll-chat.mjs";

// Modifier keys for roll buttons. ALT (or SHIFT, a reliable alternate) → advantage;
// CTRL/META → disadvantage. Event keys are primary; game.keyboard is a defensive fallback
// for the case where the synthesized event loses modifier state.
function resolveRollModifier(event) {
    const MODS = globalThis.KeyboardManager?.MODIFIER_KEYS ?? { ALT: "Alt", CONTROL: "Control" };
    const kb = globalThis.game?.keyboard;
    const advantage = event.altKey || event.shiftKey || kb?.isModifierActive?.(MODS.ALT);
    const disadvantage = event.ctrlKey || event.metaKey || kb?.isModifierActive?.(MODS.CONTROL);
    return advantage ? "advantage" : disadvantage ? "disadvantage" : null;
}

const ESCAPE_MODULE_ID = "1547core";

// Commit a self-initiated escape maneuver from its HUD row: re-read the actor+s
// escape entries, find the clicked one, and (if usable) spend its cost + remove
// the condition via the combat API.
async function runEscapeCommit(token, maneuverId, { summarizeActor, ui, renderHudForSelection } = {}) {
    const actor = token?.actor;
    if (!actor || !maneuverId) return;
    let entry = null;
    try {
        const summary = typeof summarizeActor === "function" ? summarizeActor(actor, token) : null;
        entry = (summary?.escapeManeuvers ?? []).find((e) => e.id === maneuverId) ?? null;
    } catch { entry = null; }
    if (!entry?.usable || !entry.source) {
        ui?.notifications?.warn?.("Can+t escape right now.");
        return;
    }
    const combatApi = globalThis.game?.modules?.get?.(ESCAPE_MODULE_ID)?.api?.combat ?? {};
    if (typeof combatApi.commitConditionEscapeManeuver === "function") {
        await combatApi.commitConditionEscapeManeuver(actor, entry.source);
    }
    void renderHudForSelection?.();
}

export function bindHudInteractions(root, token, deps = {}) {
    const {
        HUD_STATE,
        ui,
        renderHudForSelection,
        announceSideReady,
        getActiveReactionWindow,
        getSelectedReactionChoiceId,
        toggleSelectedReactionChoiceId,
        clearHudReactionWindow,
        clearHudDamageTakenWindow,
        releaseDeferredPostWindowsIntoHud,
        getDiceTabAttackSelection,
        setDiceTabAttackSelectionCount,
        clearDiceTabAttackSelection,
        setPendingNextAttackDice,
        clearPendingNextAttackDice,
        getDiceTabSkillDice,
        setDiceTabSkillDice,
        clearDiceTabSkillDice,
        setPendingNextSkillDice,
        clearPendingNextSkillDice,
        clearIgnoredCostManeuver,
        clearIgnoredCostManeuvers,
        setIgnoredCostManeuver,
        confirmManeuverCostSelection,
        getActivePostManeuverWindow,
        toggleSelectedPostManeuver,
        getSelectedPostManeuverId,
        normalizePostManeuverChoiceId,
        advancePostManeuverWindow,
        clearSelectedFullTurnManeuver,
        toggleSelectedPreManeuver,
        clearSelectedPreManeuvers,
        adjustCoreStackCount,
        toggleSelectedFullTurnManeuver,
        summarizeActor,
        executeSelectedFullTurnManeuver,
        buildHudActionContext,
        createStatActionDescriptor,
        createSkillActionDescriptor,
        createWeaponAttackActionDescriptor,
        runHudAction,
        executeWeaponReloadAction,
        executeWeaponReadyAction,
        executeItemUnequipAction,
        sanitizeCounterRollDice,
        ChatMessage,
        getAttackDiceTabOptions,
    } = deps;

    for (const button of root.querySelectorAll("[data-hud-open-item]")) {
        button.addEventListener("click", () => {
            const itemId = button.dataset.hudOpenItem;
            if (!token?.actor || !itemId) return;
            const item = token.actor.items?.get?.(itemId) ?? null;
            if (!item?.sheet?.render) {
                ui.notifications?.warn?.("Item could not be opened.");
                return;
            }
            item.sheet.render(true);
        });
    }

    for (const button of root.querySelectorAll("[data-hud-use-monster-magic]")) {
        button.addEventListener("click", async () => {
            const itemId = button.dataset.hudUseMonsterMagic;
            if (!token?.actor || !itemId || button.disabled) return;
            const item = token.actor.items?.get?.(itemId) ?? null;
            const resolver = game.modules.get("1547core")?.api?.resolveUsageEffectsFromCarrier;
            if (!item) {
                ui.notifications?.warn?.("Monster magic could not be found.");
                return;
            }
            if (typeof resolver !== "function") {
                ui.notifications?.warn?.("Monster magic resolver is not available.");
                return;
            }
            try {
                const result = await resolver(item, { sourceToken: token.document });
                const appliedCount = Array.isArray(result?.targetsResolved)
                    ? result.targetsResolved.filter((row) => row.applied).length
                    : 0;
                if (appliedCount > 0) {
                    ui.notifications?.info?.(`1547 Core: used '${item.name}'.`);
                } else {
                    ui.notifications?.warn?.(`1547 Core: '${item.name}' resolved, but nothing was applied.`);
                }
            } catch (error) {
                console.error(error);
                ui.notifications?.error?.(`1547 Core: failed to use '${item?.name ?? "monster magic"}'. ${error?.message ?? ""}`.trim());
            }
            void renderHudForSelection();
        });
    }

    for (const select of root.querySelectorAll("[data-hud-inventory-filter]")) {
        select.addEventListener("change", (event) => {
            HUD_STATE.view.inventoryFilter = event.currentTarget.value || "all";
            void renderHudForSelection();
        });
    }
    for (const button of root.querySelectorAll("[data-hud-category]")) {
        button.addEventListener("click", (event) => {
            const category = event.currentTarget.dataset.hudCategory;
            if (!category || category === HUD_STATE.view.activeCategory) return;
            HUD_STATE.view.activeCategory = category;
            void renderHudForSelection();
        });
    }
    for (const select of root.querySelectorAll("[data-hud-maneuver-filter]")) {
        select.addEventListener("change", (event) => {
            HUD_STATE.view.maneuverFilter = event.currentTarget.value || "all";
            void renderHudForSelection();
        });
    }
    for (const checkbox of root.querySelectorAll("[data-hud-maneuver-show-all]")) {
        checkbox.addEventListener("change", (event) => {
            HUD_STATE.view.maneuverShowAll = !!event.currentTarget.checked;
            void renderHudForSelection();
        });
    }
    for (const button of root.querySelectorAll("[data-hud-collapse-toggle]")) {
        button.addEventListener("click", () => {
            HUD_STATE.view.collapsed = !HUD_STATE.view.collapsed;
            void renderHudForSelection();
        });
    }
    for (const button of root.querySelectorAll("[data-hud-weapon-range]")) {
        button.addEventListener("click", (event) => {
            const weaponId = event.currentTarget.dataset.hudWeaponRange;
            if (!weaponId) return;
            HUD_STATE.view.weaponRangeShownIds = { ...(HUD_STATE.view.weaponRangeShownIds ?? {}) };
            if (HUD_STATE.view.weaponRangeShownIds[weaponId]) {
                delete HUD_STATE.view.weaponRangeShownIds[weaponId];
            } else {
                HUD_STATE.view.weaponRangeShownIds[weaponId] = true;
            }
            void renderHudForSelection();
        });
    }
    // Range-band buttons: toggle .is-highlighted on weapon rows whose
    // data-band-<key> is set. Click the same band again to clear. Switching
    // bands swaps the highlight without re-rendering the HUD.
    for (const button of root.querySelectorAll("[data-hud-range-band]")) {
        button.addEventListener("click", () => {
            const band = button.dataset.hudRangeBand;
            const container = button.closest(".hud-range-bands");
            const list = container?.querySelector("[data-hud-range-list]");
            if (!container || !list) return;
            const wasActive = button.classList.contains("is-active");
            container.querySelectorAll("[data-hud-range-band]").forEach((b) => b.classList.remove("is-active"));
            list.querySelectorAll("li").forEach((li) => li.classList.remove("is-highlighted"));
            if (wasActive) return;
            button.classList.add("is-active");
            list.querySelectorAll(`li[data-band-${band}="1"]`).forEach((li) => li.classList.add("is-highlighted"));
        });
    }
    for (const button of root.querySelectorAll("[data-hud-dice-attack-adjust]")) {
        button.addEventListener("click", (event) => {
            if (!token?.actor) return;
            const dieKey = event.currentTarget.dataset.hudDiceAttackAdjust;
            const delta = Number(event.currentTarget.dataset.hudDiceDelta ?? 0) || 0;
            const current = getDiceTabAttackSelection(token.actor.id);
            const nextValue = Math.max(0, Number(current?.[dieKey] ?? 0) + delta);
            setDiceTabAttackSelectionCount(token.actor.id, dieKey, nextValue);
            void renderHudForSelection();
        });
    }
    for (const button of root.querySelectorAll("[data-hud-dice-skill-adjust]")) {
        button.addEventListener("click", (event) => {
            if (!token?.actor) return;
            const delta = Number(event.currentTarget.dataset.hudDiceDelta ?? 0) || 0;
            const current = Math.max(0, Number(getDiceTabSkillDice(token.actor.id)) || 0);
            setDiceTabSkillDice(token.actor.id, Math.max(0, current + delta));
            void renderHudForSelection();
        });
    }
    for (const button of root.querySelectorAll("[data-hud-dice-attack-roll]")) {
        button.addEventListener("click", async () => {
            if (!token?.actor || button.disabled) return;
            const selection = getDiceTabAttackSelection(token.actor.id);
            const terms = (getAttackDiceTabOptions?.() ?? []).flatMap((option) => Array.from({ length: Math.max(0, Number(selection?.[option.key] ?? 0) || 0) }, () => `1d${option.code}`));
            if (!terms.length) return;
            await rollToChat({
                formula: terms.join(" + "),
                speaker: ChatMessage.getSpeaker({ actor: token.actor, token: token.document }),
                flavor: "Dice Tab Attack Dice",
                rollMode: "default",
                waitForTotals: false,
            });
        });
    }
    for (const button of root.querySelectorAll("[data-hud-dice-attack-add]")) {
        button.addEventListener("click", () => {
            if (!token?.actor || button.disabled) return;
            const selection = getDiceTabAttackSelection(token.actor.id);
            setPendingNextAttackDice(token.actor.id, selection);
            clearDiceTabAttackSelection(token.actor.id);
            void renderHudForSelection();
        });
    }
    for (const button of root.querySelectorAll("[data-hud-dice-attack-clear]")) {
        button.addEventListener("click", () => {
            if (!token?.actor || button.disabled) return;
            // Clear resets both the staged "next attack" dice AND the live
            // per-row selection counts back to 0. Previously only the staged
            // pending set was cleared, leaving the row counters stuck.
            clearPendingNextAttackDice(token.actor.id);
            clearDiceTabAttackSelection(token.actor.id);
            void renderHudForSelection();
        });
    }
    for (const button of root.querySelectorAll("[data-hud-dice-skill-roll]")) {
        button.addEventListener("click", async () => {
            if (!token?.actor || button.disabled) return;
            const count = Math.max(0, Number(getDiceTabSkillDice(token.actor.id)) || 0);
            if (count <= 0) return;
            await rollToChat({
                formula: `${count}d6`,
                speaker: ChatMessage.getSpeaker({ actor: token.actor, token: token.document }),
                flavor: "Dice Tab D6",
                rollMode: "default",
                waitForTotals: false,
            });
        });
    }
    for (const button of root.querySelectorAll("[data-hud-dice-skill-add]")) {
        button.addEventListener("click", () => {
            if (!token?.actor || button.disabled) return;
            const count = Math.max(0, Number(getDiceTabSkillDice(token.actor.id)) || 0);
            setPendingNextSkillDice(token.actor.id, count);
            clearDiceTabSkillDice(token.actor.id);
            void renderHudForSelection();
        });
    }
    for (const button of root.querySelectorAll("[data-hud-dice-skill-clear]")) {
        button.addEventListener("click", () => {
            if (!token?.actor || button.disabled) return;
            clearPendingNextSkillDice(token.actor.id);
            clearDiceTabSkillDice(token.actor.id);
            void renderHudForSelection();
        });
    }    for (const button of root.querySelectorAll("[data-hud-side-ready]")) {
        button.addEventListener("click", async () => {
            await announceSideReady(token?.actor, token);
        });
    }
    for (const button of root.querySelectorAll("[data-hud-escape-commit]")) {
        button.addEventListener("click", async () => {
            await runEscapeCommit(token, button.dataset.hudEscapeCommit, { summarizeActor, ui, renderHudForSelection });
        });
    }
    for (const button of root.querySelectorAll("[data-hud-reaction-choice]")) {
        button.addEventListener("click", (event) => {
            const choiceId = event.currentTarget.dataset.hudReactionChoice;
            const reactionWindow = getActiveReactionWindow();
            if (!reactionWindow || !choiceId || event.currentTarget.disabled) return;
            toggleSelectedReactionChoiceId(choiceId);
            void renderHudForSelection();
        });
    }
    for (const button of root.querySelectorAll("[data-hud-reaction-commit]")) {
        button.addEventListener("click", () => {
            const reactionWindow = getActiveReactionWindow();
            const selectedId = getSelectedReactionChoiceId();
            if (!reactionWindow || !selectedId) {
                ui.notifications?.warn?.("Select a reaction first.");
                return;
            }
            // Staged Core Points ride the selection payload (ADR-0004) — the
            // reaction service no longer reaches into HUD state for them. The
            // stack is HUD-local: clear ONLY the committed reaction's own stack
            // (a blanket clear wiped Core points staged on OTHER maneuvers,
            // e.g. a Core Attack prepared for the actor's upcoming turn).
            const reactorId = token?.actor?.id ?? reactionWindow.actor?.id ?? null;
            const stagedCore = reactorId ? getCoreStackCount(reactorId, selectedId) : 0;
            reactionWindow.selectReaction(selectedId, { stagedCore });
            if (reactorId && stagedCore > 0) setCoreStackCount(reactorId, selectedId, 0);
            clearHudReactionWindow();
            void renderHudForSelection();
        });
    }
    for (const button of root.querySelectorAll("[data-hud-reaction-pass]")) {
        button.addEventListener("click", () => {
            const reactionWindow = getActiveReactionWindow();
            if (!reactionWindow) return;
            reactionWindow.passReaction();
            clearHudReactionWindow();
            void renderHudForSelection();
        });
    }
    for (const button of root.querySelectorAll("[data-hud-damage-taken-close]")) {
        button.addEventListener("click", () => {
            clearHudDamageTakenWindow();
            releaseDeferredPostWindowsIntoHud?.();
            void renderHudForSelection();
        });
    }
    for (const button of root.querySelectorAll("[data-hud-post-choice]")) {
        button.addEventListener("click", () => {
            const postWindow = getActivePostManeuverWindow();
            if (!postWindow) return;
            const choiceId = button.dataset.hudPostChoice;
            if (!choiceId) return;
            toggleSelectedPostManeuver(postWindow.id, choiceId);
            void renderHudForSelection();
        });
    }
    for (const button of root.querySelectorAll("[data-hud-post-commit]")) {
        button.addEventListener("click", async () => {
            const postWindow = getActivePostManeuverWindow();
            if (!postWindow) return;
            const selectedId = getSelectedPostManeuverId(postWindow.id);
            const selection = (postWindow.legalPostManeuvers ?? []).find((candidate) => normalizePostManeuverChoiceId(candidate) === selectedId) ?? null;
            if (!selection) {
                ui.notifications?.warn?.("Select a post maneuver first.");
                return;
            }
            try {
                if (typeof postWindow.commitPostManeuver === "function") {
                    await postWindow.commitPostManeuver(selection);
                }
                // Sustained window: stay open to spend more critical points. Drop
                // the used maneuver, deduct its cost, and re-filter to what's still
                // affordable; close only when nothing affordable remains.
                const cost = Number(selection.cost ?? selection.costAmount ?? selection.CostAmount ?? 0) || 0;
                postWindow.currentCriticalPoints = Math.max(0, (Number(postWindow.currentCriticalPoints ?? 0) || 0) - cost);
                postWindow.legalPostManeuvers = (postWindow.legalPostManeuvers ?? []).filter((candidate) => {
                    if (normalizePostManeuverChoiceId(candidate) === selectedId) return false;
                    const candidateCost = Number(candidate.cost ?? candidate.costAmount ?? candidate.CostAmount ?? 0) || 0;
                    return candidateCost <= postWindow.currentCriticalPoints;
                });
                ui.notifications?.info?.(`Committed ${selection.name ?? "critical maneuver"}.`);
                if (!postWindow.legalPostManeuvers.length) {
                    advancePostManeuverWindow();
                }
            } catch (error) {
                ui.notifications?.warn?.(error?.message || "Could not commit the post maneuver.");
                return;
            }
            void renderHudForSelection();
        });
    }
    for (const button of root.querySelectorAll("[data-hud-post-pass]")) {
        button.addEventListener("click", () => {
            const postWindow = getActivePostManeuverWindow();
            if (!postWindow) return;
            if (typeof postWindow.passPostManeuver === "function") {
                postWindow.passPostManeuver();
            }
            advancePostManeuverWindow();
            void renderHudForSelection();
        });
    }
    for (const button of root.querySelectorAll("[data-hud-maneuver-group]")) {
        button.addEventListener("click", (event) => {
            const group = event.currentTarget.dataset.hudManeuverGroup;
            if (!group || group === HUD_STATE.view.activeManeuverGroup) return;
            HUD_STATE.view.activeManeuverGroup = group;
            void renderHudForSelection();
        });
    }
    for (const button of root.querySelectorAll("[data-hud-maneuver-select]")) {
        button.addEventListener("click", async () => {
            if (!token?.actor) return;
            const maneuverId = button.dataset.hudManeuverSelect;
            const timing = button.dataset.hudManeuverTiming;
            if (!maneuverId || !timing || button.disabled) return;
            const summary = summarizeActor(token.actor, token);
            const maneuver = [...(summary.maneuvers ?? []), ...(summary.fullTurnManeuvers ?? [])].find((entry) => entry.id === maneuverId && entry.timingKey === timing) ?? null;
            if (!maneuver) return;

            const actorId = token.actor.id;
            const alreadySelected = timing === "pre"
                ? (summary.selectedPreManeuvers ?? []).some((entry) => String(entry?._id ?? entry?.id ?? entry?.name ?? "") === String(maneuver.sourceId ?? maneuver.id))
                : summary.selectedFullTurnManeuver?.id === maneuverId;

            if (alreadySelected) {
                if (timing === "pre") {
                    toggleSelectedPreManeuver(actorId, maneuverId);
                } else if (timing === "full-turn") {
                    clearSelectedPreManeuvers(actorId);
                    toggleSelectedFullTurnManeuver(actorId, maneuverId);
                }
                clearIgnoredCostManeuver(actorId, maneuverId);
                void renderHudForSelection();
                return;
            }

            const costChoice = await confirmManeuverCostSelection(maneuver.source ?? maneuver);
            if (!costChoice?.confirmed) return;
            setIgnoredCostManeuver(actorId, maneuverId, costChoice.ignoreCost === true);

            if (timing === "pre") {
                clearSelectedFullTurnManeuver(actorId);
                toggleSelectedPreManeuver(actorId, maneuverId);
            } else if (timing === "full-turn") {
                clearSelectedPreManeuvers(actorId);
                clearIgnoredCostManeuvers(actorId);
                setIgnoredCostManeuver(actorId, maneuverId, costChoice.ignoreCost === true);
                toggleSelectedFullTurnManeuver(actorId, maneuverId);
            }
            void renderHudForSelection();
        });
    }
    // Core-maneuver stacking: left-click adds a Core Point, right-click removes
    // one. The count (and its ceiling = staged + available) drives the ×N badge
    // and the scaled cost/effect in summarizeActor.
    for (const button of root.querySelectorAll("[data-hud-core-stack]")) {
        const maneuverId = button.dataset.hudCoreStack;
        const max = Math.max(0, Number(button.dataset.hudCoreMax) || 0);
        const bump = (delta) => {
            if (!token?.actor || !maneuverId || button.disabled) return;
            if (typeof adjustCoreStackCount === "function") adjustCoreStackCount(token.actor.id, maneuverId, delta, max);
            void renderHudForSelection();
        };
        button.addEventListener("click", () => bump(1));
        button.addEventListener("contextmenu", (event) => { event.preventDefault(); bump(-1); });
    }
    for (const button of root.querySelectorAll("[data-hud-pre-maneuver]")) {
        button.addEventListener("click", () => {
            if (!token?.actor) return;
            const maneuverId = button.dataset.hudPreManeuver;
            if (!maneuverId || button.disabled) return;
            clearSelectedFullTurnManeuver(token.actor.id);
            toggleSelectedPreManeuver(token.actor.id, maneuverId);
            void renderHudForSelection();
        });
    }
    for (const button of root.querySelectorAll("[data-hud-full-turn-maneuver]")) {
        button.addEventListener("click", () => {
            if (!token?.actor) return;
            const maneuverId = button.dataset.hudFullTurnManeuver;
            if (!maneuverId || button.disabled) return;
            clearSelectedPreManeuvers(token.actor.id);
            toggleSelectedFullTurnManeuver(token.actor.id, maneuverId);
            void renderHudForSelection();
        });
    }
    for (const button of root.querySelectorAll("[data-hud-commit-full-turn]")) {
        button.addEventListener("click", async () => {
            if (!token?.actor) return;
            const summary = summarizeActor(token.actor, token);
            await executeSelectedFullTurnManeuver(token.actor, summary);
            void renderHudForSelection();
        });
    }
    // Roll buttons fire on `pointerup`, not `click`: holding ALT triggers Foundry's
    // "Highlight Objects" keybinding, which suppresses the synthesized click on the button
    // (CTRL has no such binding, so it worked). `pointerup` fires regardless and reads the
    // modifier from the pointer event. SHIFT is wired as a guaranteed-reliable advantage
    // alternate. See resolveRollModifier.
    for (const button of root.querySelectorAll("[data-hud-stat]")) {
        button.addEventListener("pointerup", async (event) => {
            if (event.button !== 0) return;
            const stat = event.currentTarget.dataset.hudStat;
            if (!stat) return;
            const context = buildHudActionContext(token?.actor, token);
            context.rollModifier = resolveRollModifier(event);
            const descriptor = createStatActionDescriptor(context, stat);
            await runHudAction(descriptor, context);
            void renderHudForSelection();
        });
    }
    for (const button of root.querySelectorAll("[data-hud-skill]")) {
        button.addEventListener("pointerup", async (event) => {
            if (event.button !== 0) return;
            const skill = event.currentTarget.dataset.hudSkill;
            if (!skill) return;
            const context = buildHudActionContext(token?.actor, token);
            context.rollModifier = resolveRollModifier(event);
            const descriptor = createSkillActionDescriptor(context, skill);
            await runHudAction(descriptor, context);
            void renderHudForSelection();
        });
    }
    for (const button of root.querySelectorAll("[data-hud-weapon-attack]")) {
        button.addEventListener("pointerup", async (event) => {
            if (event.button !== 0) return;
            const weaponId = event.currentTarget.dataset.hudWeaponAttack;
            if (!weaponId || !token?.actor) return;
            const context = buildHudActionContext(token.actor, token);
            context.rollModifier = resolveRollModifier(event);
            const descriptor = createWeaponAttackActionDescriptor(context, weaponId);
            await runHudAction(descriptor, context);
            void renderHudForSelection();
        });
    }
    for (const button of root.querySelectorAll("[data-hud-weapon-reload]")) {
        button.addEventListener("click", async (event) => {
            const weaponId = event.currentTarget.dataset.hudWeaponReload;
            if (!weaponId || !token?.actor) return;
            const context = buildHudActionContext(token.actor, token);
            await executeWeaponReloadAction(weaponId, token.actor, context.summary);
            void renderHudForSelection();
        });
    }
    for (const button of root.querySelectorAll("[data-hud-item-equip]")) {
        button.addEventListener("click", async (event) => {
            const itemId = event.currentTarget.dataset.hudItemEquip;
            if (!itemId || !token?.actor) return;
            const context = buildHudActionContext(token.actor, token);
            await executeWeaponReadyAction(itemId, token.actor, context.summary);
            void renderHudForSelection();
        });
    }
    for (const button of root.querySelectorAll("[data-hud-item-unequip]")) {
        button.addEventListener("click", async (event) => {
            const itemId = event.currentTarget.dataset.hudItemUnequip;
            if (!itemId || !token?.actor) return;
            const context = buildHudActionContext(token.actor, token);
            await executeItemUnequipAction(itemId, token.actor, context.summary);
            void renderHudForSelection();
        });
    }
    for (const button of root.querySelectorAll("[data-hud-weapon-profile]")) {
        button.addEventListener("click", async (event) => {
            const weaponId = event.currentTarget.dataset.hudWeaponProfile;
            const profileKey = event.currentTarget.dataset.hudProfileKey;
            if (!weaponId || !profileKey || !token?.actor) return;
            const weaponItem = token.actor.items?.get?.(weaponId);
            if (!weaponItem?.update) return;

            const context = buildHudActionContext(token.actor, token);
            const weaponSummary = context.summary.equippedWeapons.find((entry) => entry.id === weaponId) ?? null;
            const nextProfile = weaponSummary?.attackProfiles?.find((profile) => profile.key === profileKey) ?? null;
            const selectedAmmoId = HUD_STATE.view.selectedAmmoByWeapon?.[weaponId] ?? null;
            if (weaponSummary && nextProfile && selectedAmmoId) {
                const selectedAmmo = weaponSummary.compatibleAmmo.find((ammo) => ammo.id === selectedAmmoId) ?? null;
                const allowedAmmoTypes = Array.isArray(nextProfile.allowedAmmoTypes) ? nextProfile.allowedAmmoTypes : [];
                if (selectedAmmo && allowedAmmoTypes.length && !allowedAmmoTypes.includes(selectedAmmo.ammoType)) {
                    delete HUD_STATE.view.selectedAmmoByWeapon[weaponId];
                }
            }

            await weaponItem.update({
                "system.props.ActiveAttackProfile": profileKey
            });
            void renderHudForSelection();
        });
    }
    for (const button of root.querySelectorAll("[data-hud-weapon-ammo]")) {
        button.addEventListener("click", async (event) => {
            const weaponId = event.currentTarget.dataset.hudWeaponAmmo;
            const ammoId = event.currentTarget.dataset.hudAmmoId;
            if (!weaponId || !ammoId || !token?.actor) return;
            HUD_STATE.view.selectedAmmoByWeapon[weaponId] = ammoId;
            void renderHudForSelection();
        });
    }
    for (const input of root.querySelectorAll("[data-hud-counter-enabled]")) {
        input.addEventListener("change", (event) => {
            HUD_STATE.view.counterRollEnabled = Boolean(event.currentTarget.checked);
        });
    }
    for (const input of root.querySelectorAll("[data-hud-counter-dice]")) {
        input.addEventListener("change", (event) => {
            HUD_STATE.view.counterRollDice = sanitizeCounterRollDice(event.currentTarget.value);
            event.currentTarget.value = String(HUD_STATE.view.counterRollDice);
        });
    }
    // Checks header: radio mode picker + per-mode selection. Mode change
    // re-renders so the expansion swaps; the inner selects only update state.
    for (const input of root.querySelectorAll("[data-hud-check-mode]")) {
        input.addEventListener("change", (event) => {
            if (!event.currentTarget.checked) return;
            HUD_STATE.view.checkMode = String(event.currentTarget.value || "manual");
            void renderHudForSelection();
        });
    }
    for (const select of root.querySelectorAll("[data-hud-check-stat]")) {
        select.addEventListener("change", (event) => {
            HUD_STATE.view.checkStatTarget = String(event.currentTarget.value || "");
        });
    }
    for (const input of root.querySelectorAll("[data-hud-check-skill]")) {
        input.addEventListener("change", (event) => {
            if (!event.currentTarget.checked) return;
            HUD_STATE.view.checkSkillTarget = String(event.currentTarget.value || "");
        });
    }
    const generalDifficultyToDice = { Trivial: 1, Easy: 2, Average: 3, Hard: 4, Rough: 5 };
    for (const select of root.querySelectorAll("[data-hud-check-difficulty]")) {
        select.addEventListener("change", (event) => {
            const value = String(event.currentTarget.value || "Average");
            HUD_STATE.view.checkGeneralDifficulty = value;
            // Difficulty preset overrides the numeric so they stay in sync.
            HUD_STATE.view.checkGeneralDice = generalDifficultyToDice[value] ?? 3;
            void renderHudForSelection();
        });
    }
    for (const input of root.querySelectorAll("[data-hud-check-general-dice]")) {
        input.addEventListener("change", (event) => {
            HUD_STATE.view.checkGeneralDice = sanitizeCounterRollDice(event.currentTarget.value);
            event.currentTarget.value = String(HUD_STATE.view.checkGeneralDice);
        });
    }
}


