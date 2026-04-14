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
        getActiveDamageTakenWindow,
        clearHudDamageTakenWindow,
        getActivePostManeuverWindow,
        toggleSelectedPostManeuver,
        getSelectedPostManeuverId,
        normalizePostManeuverChoiceId,
        advancePostManeuverWindow,
        clearSelectedFullTurnManeuver,
        toggleSelectedPreManeuver,
        clearSelectedPreManeuvers,
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
    } = deps;

    for (const select of root.querySelectorAll("[data-hud-inventory-filter]")) {
        select.addEventListener("change", (event) => {
            HUD_STATE.inventoryFilter = event.currentTarget.value || "all";
            void renderHudForSelection();
        });
    }
    for (const button of root.querySelectorAll("[data-hud-category]")) {
        button.addEventListener("click", (event) => {
            const category = event.currentTarget.dataset.hudCategory;
            if (!category || category === HUD_STATE.activeCategory) return;
            HUD_STATE.activeCategory = category;
            void renderHudForSelection();
        });
    }
    for (const button of root.querySelectorAll("[data-hud-collapse-toggle]")) {
        button.addEventListener("click", () => {
            HUD_STATE.collapsed = !HUD_STATE.collapsed;
            void renderHudForSelection();
        });
    }
    for (const button of root.querySelectorAll("[data-hud-side-ready]")) {
        button.addEventListener("click", async () => {
            await announceSideReady(token?.actor, token);
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
            reactionWindow.selectReaction(selectedId);
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
            void renderHudForSelection();
        });
    }
    for (const button of root.querySelectorAll("[data-hud-safe-counterattack]")) {
        button.addEventListener("click", async () => {
            const damageWindow = getActiveDamageTakenWindow();
            if (!damageWindow || typeof damageWindow.commitSafeCounterattack !== "function") return;
            try {
                await damageWindow.commitSafeCounterattack();
                clearHudDamageTakenWindow();
                ui.notifications?.info?.("Safe counterattack declared.");
            } catch (error) {
                ui.notifications?.warn?.(error?.message || "Could not declare a safe counterattack.");
                return;
            }
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
                advancePostManeuverWindow();
                ui.notifications?.info?.(`Committed ${selection.name ?? "post maneuver"}.`);
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
            if (!group || group === HUD_STATE.activeManeuverGroup) return;
            HUD_STATE.activeManeuverGroup = group;
            void renderHudForSelection();
        });
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
    for (const button of root.querySelectorAll("[data-hud-stat]")) {
        button.addEventListener("click", async (event) => {
            const stat = event.currentTarget.dataset.hudStat;
            if (!stat) return;
            const context = buildHudActionContext(token?.actor, token);
            const descriptor = createStatActionDescriptor(context, stat);
            await runHudAction(descriptor, context);
            void renderHudForSelection();
        });
    }
    for (const button of root.querySelectorAll("[data-hud-skill]")) {
        button.addEventListener("click", async (event) => {
            const skill = event.currentTarget.dataset.hudSkill;
            if (!skill) return;
            const context = buildHudActionContext(token?.actor, token);
            const descriptor = createSkillActionDescriptor(context, skill);
            await runHudAction(descriptor, context);
            void renderHudForSelection();
        });
    }
    for (const button of root.querySelectorAll("[data-hud-weapon-attack]")) {
        button.addEventListener("click", async (event) => {
            const weaponId = event.currentTarget.dataset.hudWeaponAttack;
            if (!weaponId || !token?.actor) return;
            const context = buildHudActionContext(token.actor, token);
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
    for (const button of root.querySelectorAll("[data-hud-weapon-ready]")) {
        button.addEventListener("click", async (event) => {
            const weaponId = event.currentTarget.dataset.hudWeaponReady;
            if (!weaponId || !token?.actor) return;
            const context = buildHudActionContext(token.actor, token);
            await executeWeaponReadyAction(weaponId, token.actor, context.summary);
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
            const selectedAmmoId = HUD_STATE.selectedAmmoByWeapon?.[weaponId] ?? null;
            if (weaponSummary && nextProfile && selectedAmmoId) {
                const selectedAmmo = weaponSummary.compatibleAmmo.find((ammo) => ammo.id === selectedAmmoId) ?? null;
                const allowedAmmoTypes = Array.isArray(nextProfile.allowedAmmoTypes) ? nextProfile.allowedAmmoTypes : [];
                if (selectedAmmo && allowedAmmoTypes.length && !allowedAmmoTypes.includes(selectedAmmo.ammoType)) {
                    delete HUD_STATE.selectedAmmoByWeapon[weaponId];
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
            HUD_STATE.selectedAmmoByWeapon[weaponId] = ammoId;
            void renderHudForSelection();
        });
    }
    for (const input of root.querySelectorAll("[data-hud-counter-enabled]")) {
        input.addEventListener("change", (event) => {
            HUD_STATE.counterRollEnabled = Boolean(event.currentTarget.checked);
        });
    }
    for (const input of root.querySelectorAll("[data-hud-counter-dice]")) {
        input.addEventListener("change", (event) => {
            HUD_STATE.counterRollDice = sanitizeCounterRollDice(event.currentTarget.value);
            event.currentTarget.value = String(HUD_STATE.counterRollDice);
        });
    }
}
