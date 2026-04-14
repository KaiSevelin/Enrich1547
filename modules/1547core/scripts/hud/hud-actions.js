function consumePersistentEffectIfPresent(actor, effectType, deps = {}) {
    const { MODULE_ID, game } = deps;
    const consumer = game?.modules?.get?.(MODULE_ID)?.api?.combat?.consumePersistentEffect;
    if (typeof consumer !== "function") return Promise.resolve(false);
    return consumer(actor, effectType);
}

function getDiceTermCode(dieName) {
    switch (String(dieName ?? "").trim()) {
        case "Armor": return "a";
        case "Balanced": return "b";
        case "Control": return "c";
        case "Evade": return "e";
        case "Finesse": return "f";
        case "Heavy": return "h";
        case "Lethality": return "l";
        case "Penetration": return "p";
        case "Risk": return "r";
        case "Multiplier": return "x";
        default: return "";
    }
}

function buildDefenseRollFormula(armorSummary) {
    const defenseDice = Array.isArray(armorSummary?.defenseDice)
        ? armorSummary.defenseDice
        : String(armorSummary?.defense ?? "").split(",").map((entry) => entry.trim()).filter(Boolean);
    const terms = defenseDice.map(getDiceTermCode).filter(Boolean).map((code) => `1d${code}`);
    return terms.join(" + ");
}

function extractDice1547Totals(game, message) {
    const result = game?.modules?.get?.("dice1547")?.api?.getRollResult?.(message?.id ?? message);
    if (!result?.totals) return null;
    return {
        damage: Number(result.totals.damage ?? 0) || 0,
        protection: Number(result.totals.protection ?? 0) || 0,
        crit: Number(result.totals.crit ?? 0) || 0,
        fumble: Number(result.totals.fumble ?? 0) || 0,
        multiplier: Number(result.totals.multiplier ?? 1) || 1,
    };
}

async function rollFormulaToChatAndSummarize({ Roll, speaker, formula, flavor, game }) {
    if (!formula) return null;
    const roll = await new Roll(formula).evaluate({ async: true });
    const message = await roll.toMessage({ speaker, flavor });
    return extractDice1547Totals(game, message);
}
async function consumeHudFullTurn(actor) {
    if (!actor?.update) return;
    await actor.update({
        "system.props.FullTurnAvailable": false
    });
}

async function executeStatAction(descriptor, context, evaluation, deps = {}) {
    const { HUD_STATE, Roll, ChatMessage, escapeHtml, maybeRollCounter, getPendingNextSkillDice, clearPendingNextSkillDice } = deps;
    const stat = evaluation.resolvedSource;
    const formula = evaluation.rollPreview?.finalFormula ?? stat?.formula;
    if (!formula || !stat) return;

    HUD_STATE.activeStatPreview = stat.label;
    const roll = await new Roll(formula).evaluate({ async: true });
    const speaker = ChatMessage.getSpeaker({ actor: context.actor, token: context.token?.document });
    const flavor = `${descriptor.label}<br>Base: ${escapeHtml(evaluation.rollPreview.baseFormula)}<br>Advantage Dice: ${escapeHtml(evaluation.rollPreview.advantageDice)}<br>Risk Dice: ${escapeHtml(evaluation.rollPreview.riskDice)}`;
    await roll.toMessage({
        speaker,
        flavor
    });
    await maybeRollCounter(context, descriptor.label, roll.total);
    if (Number(getPendingNextSkillDice?.(context.actor?.id) ?? 0) > 0) {
        clearPendingNextSkillDice?.(context.actor?.id);
    }
}

async function executeSkillAction(descriptor, context, evaluation, deps = {}) {
    const { HUD_STATE, Roll, ChatMessage, escapeHtml, maybeRollCounter, getPendingNextSkillDice, clearPendingNextSkillDice } = deps;
    const skill = evaluation.resolvedSource;
    const formula = evaluation.rollPreview?.finalFormula ?? skill?.formula;
    if (!formula || !skill) return;

    if (skill.linkedStat) {
        HUD_STATE.activeStatPreview = skill.linkedStat;
    }

    const roll = await new Roll(formula).evaluate({ async: true });
    const speaker = ChatMessage.getSpeaker({ actor: context.actor, token: context.token?.document });
    const fallbackNote = skill.rollData?.usedFallback ? "<br>Fallback: minimum skill roll is 1d6" : "";
    const flavor = `${descriptor.label}<br>Stat: ${escapeHtml(skill.linkedStat)}<br>Base Stat: ${escapeHtml(skill.baseFormula || "-")}<br>Level: ${escapeHtml(skill.currentLevel)}<br>Dice Shift: ${escapeHtml(skill.diceShift)}<br>Advantage Dice: ${escapeHtml(evaluation.rollPreview.advantageDice)}<br>Risk Dice: ${escapeHtml(evaluation.rollPreview.riskDice)}${fallbackNote}`;
    await roll.toMessage({
        speaker,
        flavor
    });
    await maybeRollCounter(context, descriptor.label, roll.total);
    if (Number(getPendingNextSkillDice?.(context.actor?.id) ?? 0) > 0) {
        clearPendingNextSkillDice?.(context.actor?.id);
    }
}

async function executeWeaponAttackAction(descriptor, context, evaluation, deps = {}) {
    const {
        MODULE_ID,
        game,
        ui,
        Roll,
        ChatMessage,
        escapeHtml,
        summarizeActor,
        summarizeManeuverEffects,
        buildWeaponRollContext,
        buildFoundryAttackRollFormula,
        getWeaponAttackState,
        clearActorManeuverSelections,
        getChebyshevDistanceSquares,
        getPendingNextAttackDice,
        clearPendingNextAttackDice,
    } = deps;

    const weaponId = descriptor.metadata?.weaponId;
    const currentSummary = summarizeActor(context.actor, context.token);
    const currentWeapon = currentSummary.equippedWeapons.find((entry) => entry.id === weaponId) ?? evaluation?.resolvedSource?.weapon ?? null;
    const weaponItem = context.actor?.items?.get?.(weaponId) ?? currentWeapon?.itemDocument ?? null;
    if (!currentWeapon) {
        ui.notifications?.warn?.("Weapon item could not be resolved.");
        return;
    }
    if (!weaponItem && !currentWeapon?.isVirtualDefault) {
        ui.notifications?.warn?.("Weapon item could not be resolved.");
        return;
    }
    const currentManeuverEffects = summarizeManeuverEffects(currentSummary.selectedPreManeuvers);
    const effectiveWeaponRollContext = buildWeaponRollContext(currentSummary, currentManeuverEffects);
    const attackFormula = buildFoundryAttackRollFormula(currentWeapon?.activeAttackProfileData, effectiveWeaponRollContext) || "";

    if (!context.primaryTarget) {
        if (!attackFormula) {
            const speaker = ChatMessage.getSpeaker({ actor: context.actor, token: context.token?.document });
            await ChatMessage.create({
                speaker,
                content: `<strong>${escapeHtml(descriptor.label)}</strong><br>No target selected.<br>Attack pool: ${escapeHtml(currentWeapon?.activeAttackFormula || "Unavailable")}`
            });
            return;
        }
        const roll = await new Roll(attackFormula).evaluate({ async: true });
        const speaker = ChatMessage.getSpeaker({ actor: context.actor, token: context.token?.document });
        const flavor = `${descriptor.label}<br>No target selected: rolled to chat only.`;
        await roll.toMessage({ speaker, flavor });

        if (currentWeapon?.usesAmmo) {
            const combatApi = game?.modules?.get?.(MODULE_ID)?.api?.combat;
            const spendLoadedAmmo = combatApi?.spendLoadedAmmo;
            if (typeof spendLoadedAmmo === "function") {
                try {
                    await spendLoadedAmmo({
                        actor: context.actor,
                        weapon: weaponItem ?? currentWeapon,
                        loadedAmmo: currentWeapon.loadedAmmo ?? null
                    });
                } catch (error) {
                    ui.notifications?.warn?.(error?.message || "Could not spend the loaded ammunition.");
                }
            }
        }
        await consumePersistentEffectIfPresent(context.actor, "aimed", deps);
        if (Object.keys(getPendingNextAttackDice?.(context.actor?.id) ?? {}).length > 0) {
            clearPendingNextAttackDice?.(context.actor?.id);
        }
        clearActorManeuverSelections(context.actor?.id);
        return;
    }

    const refreshedAttackState = getWeaponAttackState(currentWeapon, {
        token: context.token,
        primaryTarget: context.primaryTarget,
        targetCount: context.targetedTokens.length,
        attacksRemaining: currentSummary.isCombatActive ? currentSummary.attacksRemaining : null
    });
    if (refreshedAttackState.status !== "valid") {
        ui.notifications?.warn?.(refreshedAttackState.reason || "This attack is not currently legal.");
        return;
    }

    const combatApi = game?.modules?.get?.(MODULE_ID)?.api?.combat;
    const declareAttack = combatApi?.declareAttack;
    if (typeof declareAttack !== "function") {
        ui.notifications?.warn?.("Combat resolver is not available.");
        return;
    }

    const targetActor = context.primaryTarget?.actor ?? null;
    const distanceSquares = refreshedAttackState.distanceSquares ?? getChebyshevDistanceSquares(context.token, context.primaryTarget);
    try {
        const result = await declareAttack({
            actor: context.actor,
            target: targetActor,
            targets: targetActor ? [targetActor] : [],
            weapon: weaponItem ?? currentWeapon,
            profileId: currentWeapon?.activeAttackProfileId ?? null,
            selectedPreManeuvers: currentSummary.selectedPreManeuvers ?? [],
            distanceSquares
        });
        if (result?.cancelled) {
            clearActorManeuverSelections(context.actor?.id);
            ui.notifications?.info?.("Attack declaration was cancelled by a reaction.");
            return;
        }

        if (currentSummary.isCombatActive !== true) {
            const resolveAttackOutcome = combatApi?.resolveAttackOutcome;
            if (typeof resolveAttackOutcome !== "function") {
                throw new Error("Combat resolver is not available.");
            }

            const speaker = ChatMessage.getSpeaker({ actor: context.actor, token: context.token?.document });
            const attackRollSummary = await rollFormulaToChatAndSummarize({
                Roll,
                speaker,
                formula: attackFormula,
                flavor: `${descriptor.label}<br>Target: ${escapeHtml(targetActor?.name ?? "Target")}`,
                game,
            });
            if (!attackRollSummary) {
                throw new Error("Could not read the attack roll result.");
            }

            const defenderArmor = (targetActor?.items?.contents ?? targetActor?.items ?? [])
                .map((item) => {
                    const props = item?.system?.props ?? {};
                    const sourceData = item?.flags?.["1547Core"]?.sourceData ?? item?.flags?.[MODULE_ID]?.sourceData ?? {};
                    if (!(Boolean(props.Equipped) || sourceData?.equipped === true)) return null;
                    const defenseDice = Array.isArray(sourceData?.defenseDice)
                        ? [...sourceData.defenseDice]
                        : String(props.Defense ?? "").split(",").map((entry) => entry.trim()).filter(Boolean);
                    return defenseDice.length ? {
                        defenseDice,
                        defense: defenseDice.join(", "),
                        name: item.name,
                    } : null;
                })
                .filter(Boolean)[0] ?? null;

            const defenseFormula = buildDefenseRollFormula(defenderArmor);
            const defenderSpeaker = ChatMessage.getSpeaker({ actor: targetActor, token: context.primaryTarget?.document });
            const defenseRollSummary = defenseFormula
                ? await rollFormulaToChatAndSummarize({
                    Roll,
                    speaker: defenderSpeaker,
                    formula: defenseFormula,
                    flavor: `Defense Roll<br>Defender: ${escapeHtml(targetActor?.name ?? "Target")}`,
                    game,
                })
                : null;

            await resolveAttackOutcome({
                pendingAttack: result.pendingAttack,
                attackRoll: attackRollSummary,
                defenseRoll: defenseRollSummary,
            });
        }

        await consumePersistentEffectIfPresent(context.actor, "aimed", deps);
        if (Object.keys(getPendingNextAttackDice?.(context.actor?.id) ?? {}).length > 0) {
            clearPendingNextAttackDice?.(context.actor?.id);
        }
        clearActorManeuverSelections(context.actor?.id);
        ui.notifications?.info?.(currentSummary.isCombatActive === true
            ? `Attack declared against ${targetActor?.name ?? "target"}.`
            : `Attack resolved against ${targetActor?.name ?? "target"}.`);
    } catch (error) {
        ui.notifications?.warn?.(error?.message || "Could not declare the attack.");
    }
}

export async function executeSelectedFullTurnManeuver(actor, summary, deps = {}) {
    const {
        MODULE_ID,
        game,
        ui,
        getSelectedFullTurnManeuverId,
        clearSelectedFullTurnManeuver,
        clearActorManeuverSelections,
        getPrimaryTargetToken,
        isTruthyLike,
    } = deps;

    const actorId = actor?.id;
    const selectedId = getSelectedFullTurnManeuverId(actorId);
    if (!selectedId) {
        ui.notifications?.warn?.("Select a full-turn maneuver first.");
        return;
    }

    const selectedManeuver = summary?.fullTurnManeuvers?.find((maneuver) => maneuver.id === selectedId) ?? null;
    if (!selectedManeuver) {
        clearSelectedFullTurnManeuver(actorId);
        ui.notifications?.warn?.("The selected full-turn maneuver is no longer available.");
        return;
    }
    if (selectedManeuver.disabled) {
        ui.notifications?.warn?.(selectedManeuver.reason || "This full-turn maneuver is not currently legal.");
        return;
    }

    const commitFullTurnManeuver = game?.modules?.get?.(MODULE_ID)?.api?.combat?.commitFullTurnManeuver;
    if (typeof commitFullTurnManeuver !== "function") {
        ui.notifications?.warn?.("Combat resolver is not available.");
        return;
    }

    const activeWeaponItem = selectedManeuver.weaponId ? actor?.items?.get?.(selectedManeuver.weaponId) ?? null : null;
    const primaryTarget = getPrimaryTargetToken();
    const targetActor = primaryTarget?.actor ?? null;
    try {
        await commitFullTurnManeuver({
            actor,
            maneuver: selectedManeuver.item ?? selectedManeuver.source,
            weapon: activeWeaponItem,
            profileId: selectedManeuver.profileId ?? null,
            target: targetActor,
            targets: targetActor ? [targetActor] : [],
            reservedResources: summary?.reservedResources ?? {},
            usedManeuvers: summary?.usedManeuvers ?? [],
            hasVisibleAlly: summary?.hasVisibleAlly === true,
            actorConditions: summary?.conditions ?? [],
            targetConditions: summary?.targetConditions ?? [],
            distanceSquares: selectedManeuver.distanceSquares ?? null,
            rangeSquares: selectedManeuver.distanceSquares ?? null,
            currentCriticalPoints: (summary?.riskAndCritical ?? []).find((entry) => entry.key === "CriticalPoints")?.current ?? null,
            metadata: {
                isCombatActive: summary?.isCombatActive === true,
                fullTurnAvailable: summary?.isCombatActive === true ? isTruthyLike(summary?.fullTurnAvailable) : true,
            },
        });
        clearActorManeuverSelections(actorId);
        ui.notifications?.info?.(`Committed ${selectedManeuver.name}.`);
    } catch (error) {
        ui.notifications?.warn?.(error?.message || "Could not commit the full-turn maneuver.");
    }
}

export async function executeWeaponReloadAction(weaponId, actor, summary, deps = {}) {
    const { MODULE_ID, HUD_STATE, game, ui, isTruthyLike } = deps;
    const requiresFullTurn = summary?.isCombatActive === true;
    if (requiresFullTurn && !isTruthyLike(summary?.fullTurnAvailable)) {
        ui.notifications?.warn?.("A full turn is required to reload.");
        return;
    }

    const weapon = summary?.equippedWeapons?.find((entry) => entry.id === weaponId) ?? null;
    const weaponItem = actor?.items?.get?.(weaponId) ?? null;
    if (!weapon || !weaponItem) {
        ui.notifications?.warn?.("Weapon item could not be resolved.");
        return;
    }
    if (!weapon.usesAmmo) {
        ui.notifications?.warn?.("This weapon does not use ammunition.");
        return;
    }

    const selectedAmmoId = HUD_STATE.selectedAmmoByWeapon?.[weaponId] ?? weapon.loadedAmmoId ?? null;
    const chosenAmmo = selectedAmmoId
        ? weapon.compatibleAmmo.find((ammo) => ammo.id === selectedAmmoId) ?? null
        : (weapon.compatibleAmmo.length === 1 ? weapon.compatibleAmmo[0] : null);

    if (!chosenAmmo) {
        ui.notifications?.warn?.("Choose a compatible ammo chip first, or keep only one compatible ammo stack.");
        return;
    }

    const loadWeaponAmmo = game?.modules?.get?.(MODULE_ID)?.api?.combat?.loadWeaponAmmo;
    if (typeof loadWeaponAmmo !== "function") {
        ui.notifications?.warn?.("Combat resolver is not available.");
        return;
    }

    await loadWeaponAmmo({
        actor,
        weapon: weaponItem,
        ammoItemId: chosenAmmo.id,
        profileId: weapon.activeAttackProfileId ?? null
    });

    if (summary?.isCombatActive === true) {
        await consumeHudFullTurn(actor);
    }
    ui.notifications?.info?.(`Reloaded ${weapon.name} with ${chosenAmmo.name}.`);
}

export async function executeWeaponReadyAction(weaponId, actor, summary, deps = {}) {
    const { ui, isTruthyLike } = deps;
    const requiresFullTurn = summary?.isCombatActive === true;
    if (requiresFullTurn && !isTruthyLike(summary?.fullTurnAvailable)) {
        ui.notifications?.warn?.("A full turn is required to ready a weapon.");
        return;
    }

    const weaponItem = actor?.items?.get?.(weaponId) ?? null;
    if (!weaponItem?.update) {
        ui.notifications?.warn?.("Weapon item could not be resolved.");
        return;
    }

    await weaponItem.update({
        "system.props.Equipped": true,
        "system.props.Ready": true
    });
    if (summary?.isCombatActive === true) {
        await consumeHudFullTurn(actor);
    }
    ui.notifications?.info?.(`Readied ${weaponItem.name}.`);
}

export async function executeItemUnequipAction(itemId, actor, summary, deps = {}) {
    const { ui, isTruthyLike } = deps;
    const requiresFullTurn = summary?.isCombatActive === true;
    if (requiresFullTurn && !isTruthyLike(summary?.fullTurnAvailable)) {
        ui.notifications?.warn?.("A full turn is required to unequip an item.");
        return;
    }

    const item = actor?.items?.get?.(itemId) ?? null;
    if (!item?.update) {
        ui.notifications?.warn?.("Item could not be resolved.");
        return;
    }

    await item.update({
        "system.props.Equipped": false,
        "system.props.Ready": false
    });
    if (summary?.isCombatActive === true) {
        await consumeHudFullTurn(actor);
    }
    ui.notifications?.info?.(`Unequipped ${item.name}.`);
}

const HUD_ACTION_HANDLERS = {
    "roll-stat": {
        execute: executeStatAction
    },
    "roll-skill": {
        execute: executeSkillAction
    },
    "attack-with-weapon": {
        execute: executeWeaponAttackAction
    }
};

export async function runHudAction(descriptor, context, evaluation, deps = {}) {
    const { ui } = deps;
    if (evaluation.status !== "valid") {
        const message = evaluation.reasons?.[0] || "This action is not currently available.";
        ui.notifications?.warn?.(message);
        return evaluation;
    }

    const handler = HUD_ACTION_HANDLERS[descriptor.handlerId];
    if (!handler?.execute) {
        ui.notifications?.warn?.("No HUD action handler is defined for this action.");
        return {
            ...evaluation,
            status: "invalid",
            reasons: ["No HUD action handler is defined for this action"]
        };
    }

    await handler.execute(descriptor, context, evaluation, deps);
    return evaluation;
}





