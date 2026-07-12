import { toFoundryFormula } from "../combat/pool-builder.mjs";
import { conditionDisadvantageSources, conditionAttackersAdvantageSources } from "../services/condition-registry.js";
import { formatRollModifiers } from "../combat/defense-roll.js";
import { autoFaceAttacker, getAttackPositioning, positioningNote, positionalAdvantageToApply } from "../combat/facing.mjs";
import { showDefenseSummary } from "../combat/defense-summary.js";
import { relayRemoteWindow, presentCandidateDialog, escapeRelayHtml } from "../services/remote-window-relay.js";
import { laneObstacles, rollLaneInterception, describeLaneOdds, lineOfSightBlocked } from "../combat/ranged-cover.js";
import { applyRollClickModifier } from "../lib/roll-modifier.mjs";
import { findOverCommittedPools } from "../combat/attack-lifecycle.mjs";
import { rollToChat } from "../lib/roll-chat.mjs";

const SAFE_COUNTERATTACK_WINDOW_MS = 15000;

// Ranged cover (cover-spec): an intercepted shot hits the obstacle as a SAFE
// attack — full damage roll, NO defense roll, no reaction, no crit/fumble — and
// never reaches the target. One Exchange pipeline call in "interception" mode.
async function resolveInterception({ obstacle, shooter, weapon, profileId, attackFormula, deps }) {
    const { MODULE_ID, game, ui, ChatMessage, escapeHtml } = deps;
    const combatApi = game?.modules?.get?.(MODULE_ID)?.api?.combat;
    const token = globalThis.canvas?.tokens?.get?.(obstacle.id);
    const obstacleActor = token?.actor ?? null;
    if (!obstacleActor || typeof combatApi?.buildPendingAttack !== "function" || typeof combatApi?.resolveExchange !== "function") return;

    const pending = combatApi.buildPendingAttack({
        actor: shooter,
        target: obstacleActor,
        weapon,
        profileId,
        forceSafeAttack: true,
    });
    await combatApi.resolveExchange({
        mode: "interception",
        pendingAttack: pending,
        buildAttackRoll: () => ({
            formula: attackFormula,
            speaker: ChatMessage.getSpeaker({ actor: shooter }),
            flavor: `Stray shot -> ${escapeHtml(obstacleActor.name ?? "Obstacle")}`,
        }),
        card: { title: "Cover — shot intercepted" },
    });
    ui.notifications?.info?.(`Shot intercepted by ${obstacleActor.name ?? "an obstacle"}.`);
}

// Resolve the defender's free safe counterattack as a full attack back at the
// original attacker — one Exchange pipeline call in "safe-counter" mode. The
// counter-attacker is the original defender; its target is the original
// attacker, so the context tokens are reused crosswise.
async function runSafeCounterattack({ originalPendingAttack, defenseReaction, context, deps }) {
    const { MODULE_ID, game, ui, ChatMessage, escapeHtml, summarizeActor, buildFoundryAttackRollFormula } = deps;
    const combatApi = game?.modules?.get?.(MODULE_ID)?.api?.combat;
    if (typeof combatApi?.resolveExchange !== "function") return;

    const counterAttackerToken = context.primaryTarget ?? null;
    const counterTargetToken = context.token ?? null;

    let exchange;
    try {
        exchange = await combatApi.resolveExchange({
            mode: "safe-counter",
            declare: { pendingAttack: originalPendingAttack, defenseReaction },
            targetToken: counterTargetToken,
            buildAttackRoll: (counter) => {
                const counterAttacker = context.primaryTarget?.actor ?? counter?.pendingAttack?.actor ?? null;
                const counterTarget = context.actor ?? counter?.pendingAttack?.target ?? null;
                if (!counterAttacker || !counterTarget) return null;
                // Attack formula from the defender's equipped weapon (same path
                // the normal attack uses), falling back to the profile's dice.
                const counterSummary = summarizeActor(counterAttacker, counterAttackerToken);
                const counterWeapon = (counterSummary?.equippedWeapons ?? []).find((w) => Array.isArray(w?.activeAttackProfileData?.dice) && w.activeAttackProfileData.dice.length) ?? null;
                const formula = (counterWeapon && buildFoundryAttackRollFormula(counterWeapon.activeAttackProfileData, {}))
                    || toFoundryFormula(Array.isArray(counter?.pendingAttack?.profile?.dice) ? counter.pendingAttack.profile.dice : []);
                if (!formula) {
                    ui.notifications?.warn?.(`${counterAttacker.name ?? "Defender"} has no weapon dice for a safe counterattack.`);
                    return null;
                }
                return {
                    formula,
                    speaker: ChatMessage.getSpeaker({ actor: counterAttacker, token: counterAttackerToken?.document }),
                    flavor: `Safe Counterattack<br>${escapeHtml(counterAttacker.name ?? "Defender")} -> ${escapeHtml(counterTarget.name ?? "Attacker")}`,
                };
            },
            card: { title: "Safe Counterattack Result" },
        });
    } catch (error) {
        ui.notifications?.warn?.(error?.message || "Could not declare the safe counterattack.");
        return;
    }
    if (exchange?.cancelled) { ui.notifications?.info?.("Safe counterattack cancelled by a reaction."); return; }
    if (exchange?.aborted) return;
    ui.notifications?.info?.(`${exchange?.pendingAttack?.actor?.name ?? "Defender"} made a safe counterattack.`);
}

// Offer the safe counterattack to the defender (their client via the relay, or a
// local dialog when the acting client owns them); run it on accept.
async function offerSafeCounterattack({ originalPendingAttack, defenseReaction, context, deps }) {
    const defender = context.primaryTarget?.actor ?? null;
    if (!defender) return;
    const run = () => runSafeCounterattack({ originalPendingAttack, defenseReaction, context, deps });
    const candidates = [{ id: "counter", name: "Safe Counterattack" }];
    const relayed = relayRemoteWindow({
        kind: "safe-counterattack",
        windowId: foundry.utils.randomID(),
        responderActor: defender,
        timeoutMs: SAFE_COUNTERATTACK_WINDOW_MS,
        request: { defenderName: defender.name ?? "Defender", candidates },
        onResolve: (id) => { if (id === "counter") void run(); },
    });
    if (!relayed) {
        const { promise } = presentCandidateDialog({
            title: "Safe Counterattack",
            intro: `<strong>${escapeRelayHtml(defender.name ?? "Defender")}</strong> may make a free safe counterattack.`,
            candidates: [{ id: "counter", label: "Safe Counterattack" }],
            timeoutMs: SAFE_COUNTERATTACK_WINDOW_MS,
            dialogClass: "safe-counterattack-dialog",
        });
        if (await promise === "counter") await run();
    }
}

function consumePersistentEffectIfPresent(actor, effectType, deps = {}) {
    const { MODULE_ID, game } = deps;
    const consumer = game?.modules?.get?.(MODULE_ID)?.api?.combat?.consumePersistentEffect;
    if (typeof consumer !== "function") return Promise.resolve(false);
    return consumer(actor, effectType);
}

// Rider lines for the Exchange result card — the caller-side decoration the
// pipeline appends via card.buildExtraHtml.
function buildRidersHtml(resolved, escapeHtml) {
    const firedRiders = Array.isArray(resolved?.secondaryEffects) ? resolved.secondaryEffects : [];
    if (!firedRiders.length) return "";
    return "<br>Riders fired:<br>" + firedRiders.map(({ modifier, effect }) => {
        const name = String(modifier?.name ?? "Modifier");
        const resolution = String(effect?.resolution ?? "automatic");
        const payload = [];
        const damageAmount = Number(effect?.damageAmount ?? 0) || 0;
        if (damageAmount > 0) payload.push(`${damageAmount} ${String(effect?.damageType ?? "").trim() || "damage"}`);
        const status = String(effect?.applyStatus ?? "").trim();
        if (status) payload.push(`status ${status}`);
        const tag = String(effect?.applyTag ?? "").trim();
        if (tag) payload.push(`tag ${tag}`);
        const payloadText = payload.length ? payload.join(", ") : "(check passed, no payload)";
        return `• ${escapeHtml(name)} — ${escapeHtml(resolution)}: ${escapeHtml(payloadText)}`;
    }).join("<br>");
}

async function consumeHudFullTurn(actor) {
    if (!actor?.update) return;
    await actor.update({
        "system.props.FullTurnAvailable": false
    });
}

async function executeStatAction(descriptor, context, evaluation, deps = {}) {
    const { HUD_STATE, ChatMessage, escapeHtml, maybeRollCounter, getPendingNextSkillDice, clearPendingNextSkillDice } = deps;
    const stat = evaluation.resolvedSource;
    const formula = applyRollClickModifier(evaluation.rollPreview?.finalFormula ?? stat?.formula, context.rollModifier);
    if (!formula || !stat) return;

    HUD_STATE.view.activeStatPreview = stat.label;
    const speaker = ChatMessage.getSpeaker({ actor: context.actor, token: context.token?.document });
    const flavor = `${descriptor.label}<br>Base: ${escapeHtml(evaluation.rollPreview.baseFormula)}<br>Advantage Dice: ${escapeHtml(evaluation.rollPreview.advantageDice)}<br>Risk Dice: ${escapeHtml(evaluation.rollPreview.riskDice)}`;
    const { roll } = await rollToChat({ formula, speaker, flavor, rollMode: "default", waitForTotals: false }) ?? {};
    if (!roll) return;
    await maybeRollCounter(context, descriptor.label, roll.total);
    if (Number(getPendingNextSkillDice?.(context.actor?.id) ?? 0) > 0) {
        clearPendingNextSkillDice?.(context.actor?.id);
    }
}

async function executeSkillAction(descriptor, context, evaluation, deps = {}) {
    const { HUD_STATE, ChatMessage, escapeHtml, maybeRollCounter, getPendingNextSkillDice, clearPendingNextSkillDice } = deps;
    const skill = evaluation.resolvedSource;
    const formula = applyRollClickModifier(evaluation.rollPreview?.finalFormula ?? skill?.formula, context.rollModifier);
    if (!formula || !skill) return;

    if (skill.linkedStat) {
        HUD_STATE.view.activeStatPreview = skill.linkedStat;
    }

    const speaker = ChatMessage.getSpeaker({ actor: context.actor, token: context.token?.document });
    const fallbackNote = skill.rollData?.usedFallback ? "<br>Fallback: minimum skill roll is 1d6" : "";
    const flavor = `${descriptor.label}<br>Stat: ${escapeHtml(skill.linkedStat)}<br>Base Stat: ${escapeHtml(skill.baseFormula || "-")}<br>Level: ${escapeHtml(skill.currentLevel)}<br>Dice Shift: ${escapeHtml(skill.diceShift)}<br>Advantage Dice: ${escapeHtml(evaluation.rollPreview.advantageDice)}<br>Risk Dice: ${escapeHtml(evaluation.rollPreview.riskDice)}${fallbackNote}`;
    const { roll } = await rollToChat({ formula, speaker, flavor, rollMode: "default", waitForTotals: false }) ?? {};
    if (!roll) return;
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
        ChatMessage,
        escapeHtml,
        summarizeActor,
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
    // summarizeActor already folded the selected pre-maneuvers AND condition
    // disadvantage into currentSummary.weaponRollContext. Re-folding them here
    // double-counted every maneuver die (e.g. Core Attack added 2 Multiplier
    // dice + 2 Risk dice instead of 1 each), so use the already-built context.
    const effectiveWeaponRollContext = {
        ...currentSummary.weaponRollContext,
        ammoAddDice: Array.isArray(currentWeapon?.loadedAmmoAddDice) ? currentWeapon.loadedAmmoAddDice : []
    };
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
        await rollToChat({
            formula: applyRollClickModifier(attackFormula, context.rollModifier),
            speaker: ChatMessage.getSpeaker({ actor: context.actor, token: context.token?.document }),
            flavor: `${descriptor.label}<br>No target selected: rolled to chat only.`,
            rollMode: "default",
            waitForTotals: false,
        });

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
        await consumePersistentEffectIfPresent(context.actor, "grapple-break-advantage", deps);
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
    const resolveExchange = combatApi?.resolveExchange;
    if (typeof resolveExchange !== "function") {
        ui.notifications?.warn?.("Combat resolver is not available.");
        return;
    }

    // Over-commit check (ruling 2026-07-11): selection is free and the
    // per-maneuver resource gate only checks each cost alone, so two selected
    // maneuvers can together exceed a pool. Validate the combined total here,
    // at the one declaration choke point, before anything rolls or spends.
    const overCommitted = findOverCommittedPools(context.actor, currentSummary.selectedPreManeuvers ?? []);
    if (overCommitted.length) {
        const detail = overCommitted
            .map(({ costType, required, available }) => `${costType}: need ${required}, have ${available}`)
            .join("; ");
        ui.notifications?.warn?.(`Selected maneuvers cost more than you can pay — ${detail}. Deselect a maneuver.`);
        return;
    }

    const targetActor = context.primaryTarget?.actor ?? null;
    const distanceSquares = refreshedAttackState.distanceSquares ?? getChebyshevDistanceSquares(context.token, context.primaryTarget);

    // Ranged cover (cover-spec): trace the lane and roll obstacle interception
    // BEFORE the target's reaction. A direct (non-arced) ranged shot caught by an
    // obstacle hits THAT obstacle (safe attack, no defense/reaction/crit) and
    // never reaches the target. Arced shots (effectData.indirect) skip the lane.
    const isRanged = currentWeapon?.activeAttackType === "ranged";
    const isIndirect = (currentSummary.selectedPreManeuvers ?? []).some((m) => m?.effectData?.indirect === true);
    if (isRanged && !isIndirect && context.primaryTarget) {
        // Line of sight: a solid wall between shooter and target means no shot.
        if (lineOfSightBlocked(context.token, context.primaryTarget)) {
            ui.notifications?.warn?.("No line of sight to the target.");
            clearActorManeuverSelections(context.actor?.id);
            return;
        }
        let obstacles = laneObstacles(context.token, context.primaryTarget);
        // Thread the needle: a maneuver that lowers interception odds by 1 (the
        // disadvantage cost rides on the maneuver's addRiskDice / addDisadvantage).
        const threadsNeedle = (currentSummary.selectedPreManeuvers ?? []).some((m) => m?.effectData?.threadNeedle === true);
        if (threadsNeedle) obstacles = obstacles.map((o) => ({ ...o, blockValue: Math.max(0, o.blockValue - 1) }));
        if (obstacles.length) {
            const rangeLabel = refreshedAttackState?.label ? `${refreshedAttackState.label} · ` : "";
            ui.notifications?.info?.(`Ranged shot — ${rangeLabel}cover: ${describeLaneOdds(obstacles)}${threadsNeedle ? " (threading)" : ""}.`);
        }
        const caught = obstacles.length ? rollLaneInterception(obstacles) : null;
        if (caught) {
            await resolveInterception({
                obstacle: caught.obstacle,
                shooter: context.actor,
                weapon: weaponItem ?? currentWeapon,
                profileId: currentWeapon?.activeAttackProfileId ?? null,
                attackFormula,
                deps,
            });
            clearActorManeuverSelections(context.actor?.id);
            return;
        }
    }

    // Facing & positioning (spec): turn the attacker to face the target, then
    // detect a rear/surprise shot. The advantage die is applied AFTER the
    // reaction window so the Face reaction (which turns the defender) can drop it.
    await autoFaceAttacker(context.token, context.primaryTarget);
    const positioning = getAttackPositioning(context.token, context.primaryTarget, distanceSquares);

    try {
        // The Exchange pipeline (ADR-0004) owns declare → reaction → rolls →
        // resolve → result card. This caller supplies only its decoration:
        // the reaction-aware attack formula (Face cancels rear advantage) and
        // the rider lines on the card.
        const exchange = await resolveExchange({
            mode: "weapon",
            declare: {
                actor: context.actor,
                target: targetActor,
                targets: targetActor ? [targetActor] : [],
                weapon: weaponItem ?? currentWeapon,
                profileId: currentWeapon?.activeAttackProfileId ?? null,
                selectedPreManeuvers: currentSummary.selectedPreManeuvers ?? [],
                distanceSquares,
                positionAdvantage: positioning,
            },
            targetToken: context.primaryTarget,
            buildAttackRoll: (result) => {
                // If the defender took the Face reaction they turned to meet the
                // attack, so the rear +1 is cancelled — drive this off the chosen
                // reaction flag (deterministic) rather than re-reading rotation.
                // An arced shot (indirect) drops from above and forfeits the rear +1.
                const facedThisAttack = result?.reactionResolution?.reaction?.effectData?.facingFace === true;
                const appliedPositionAdvantage = (facedThisAttack || isIndirect) ? 0 : positionalAdvantageToApply(positioning);
                // A prone (or otherwise vulnerable) target grants the attacker advantage dice.
                const targetAdvSources = targetActor ? conditionAttackersAdvantageSources(targetActor) : [];
                const bonusAdvantage = appliedPositionAdvantage + targetAdvSources.reduce((sum, s) => sum + s.dice, 0);
                const positionNote = facedThisAttack
                    ? "Defender faced the attacker — rear advantage cancelled."
                    : (isIndirect ? "Arced shot — rear advantage forfeited." : positioningNote(positioning));
                const modifierNote = formatRollModifiers({
                    advantage: targetAdvSources.map((s) => ({ name: `${s.name} target`, dice: s.dice })),
                    disadvantage: conditionDisadvantageSources(context.actor, "attack"),
                });
                const finalAttackFormula = bonusAdvantage > 0
                    ? (buildFoundryAttackRollFormula(
                        currentWeapon?.activeAttackProfileData,
                        { ...effectiveWeaponRollContext, advantageDice: (Number(effectiveWeaponRollContext.advantageDice) || 0) + bonusAdvantage }
                    ) || attackFormula)
                    : attackFormula;
                return {
                    formula: applyRollClickModifier(finalAttackFormula, context.rollModifier),
                    speaker: ChatMessage.getSpeaker({ actor: context.actor, token: context.token?.document }),
                    flavor: `${descriptor.label}<br>Target: ${escapeHtml(targetActor?.name ?? "Target")}`
                        + (positionNote ? `<br><em>${escapeHtml(positionNote)}</em>` : "")
                        + (modifierNote ? `<br><em>${escapeHtml(modifierNote)}</em>` : ""),
                };
            },
            card: {
                title: "Attack Result",
                buildExtraHtml: (resolved) => buildRidersHtml(resolved, escapeHtml),
            },
        });
        if (exchange?.cancelled) {
            clearActorManeuverSelections(context.actor?.id);
            ui.notifications?.info?.("Attack declaration was cancelled by a reaction.");
            return;
        }
        if (exchange?.aborted) {
            // The declaration already ran (a reaction may have been spent) but
            // no attack roll could be built — say so instead of vanishing.
            clearActorManeuverSelections(context.actor?.id);
            ui.notifications?.warn?.("The attack could not be rolled — the weapon's active profile has no dice.");
            return;
        }
        const resolvedAttack = exchange.resolved;
        const chosenDefenseReaction = exchange.defenseReaction ?? null;

        // Push a defense summary to the defender's own client (informational).
        showDefenseSummary({ resolvedAttack, attacker: context.actor, defender: targetActor });

        // If the defender's chosen defense reaction granted a free safe
        // counterattack, offer it to them (their client) and resolve it fully.
        if (resolvedAttack?.defenseModifiers?.safeCounterattack) {
            await offerSafeCounterattack({
                originalPendingAttack: exchange.pendingAttack,
                defenseReaction: chosenDefenseReaction,
                context, deps,
            });
        }

        await consumePersistentEffectIfPresent(context.actor, "aimed", deps);
        await consumePersistentEffectIfPresent(context.actor, "grapple-break-advantage", deps);
        if (Object.keys(getPendingNextAttackDice?.(context.actor?.id) ?? {}).length > 0) {
            clearPendingNextAttackDice?.(context.actor?.id);
        }
        // Pre-maneuver costs are NOT charged here: the resolution's
        // "spendReservations" phase (planSpendReservedCosts, lifecycle-flow)
        // already spends pendingAttack.reservedCosts at commit. Charging them
        // again in the HUD double-spent every costed pre-maneuver (ruling
        // 2026-07-11: charge-at-commit, exactly one deduction path).
        clearActorManeuverSelections(context.actor?.id);
        ui.notifications?.info?.(`Attack resolved against ${targetActor?.name ?? "target"}.`);
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

    // Honour the stored selection only while it stays compatible; otherwise fall
    // back to the loaded round. (summarizeActor resolves the same way for display
    // but no longer writes the result back into HUD_STATE.)
    const storedAmmoId = HUD_STATE.view.selectedAmmoByWeapon?.[weaponId] ?? null;
    const storedAmmoValid = storedAmmoId && weapon.compatibleAmmo?.some?.((ammo) => ammo.id === storedAmmoId);
    const selectedAmmoId = (storedAmmoValid ? storedAmmoId : null) ?? weapon.loadedAmmoId ?? null;
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
        ui.notifications?.warn?.("A full turn is required to equip an item.");
        return;
    }

    const item = actor?.items?.get?.(weaponId) ?? null;
    if (!item?.update) {
        ui.notifications?.warn?.("Item could not be resolved.");
        return;
    }

    const itemType = item?.flags?.["1547Core"]?.sourceData?.itemType ?? item?.flags?.["1547core"]?.sourceData?.itemType ?? item?.type ?? "";
    const isWeapon = String(itemType).trim().toLowerCase() === "weapon";
    if (isWeapon) {
        const currentlyEquippedWeapons = (actor?.items?.contents ?? actor?.items ?? [])
            .filter((entry) => entry?.id !== weaponId && entry?.system?.props?.Equipped === true && entry?.update);
        for (const otherItem of currentlyEquippedWeapons) {
            await otherItem.update({
                "system.props.Equipped": false,
            });
        }
    }

    await item.update({
        "system.props.Equipped": true,
    });
    if (summary?.isCombatActive === true) {
        await consumeHudFullTurn(actor);
    }
    ui.notifications?.info?.(`Equipped ${item.name}.`);
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





