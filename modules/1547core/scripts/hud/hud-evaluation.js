export function buildHudActionContext(actor, token, deps = {}) {
    const {
        summarizeActor,
        game,
        getSelectedToken,
        canvas,
        HUD_STATE,
        sanitizeCounterRollDice,
    } = deps;

    const summary = summarizeActor(actor, token);
    const targetedTokens = Array.from(game.user?.targets ?? []);
    return {
        actor,
        token,
        selectedToken: getSelectedToken(),
        hoveredToken: canvas?.tokens?.hover,
        targetedTokens,
        primaryTarget: targetedTokens[0] ?? null,
        inCombat: Boolean(game.combat?.started),
        combatRound: game.combat?.round ?? null,
        counterRollEnabled: HUD_STATE.counterRollEnabled,
        counterRollDice: sanitizeCounterRollDice(HUD_STATE.counterRollDice),
        summary
    };
}

export function createStatActionDescriptor(context, statLabel) {
    return {
        actionType: "roll-stat",
        sourceType: "stat",
        sourceId: statLabel,
        label: `${statLabel} Check`,
        actorId: context.actor?.id ?? "",
        tokenId: context.token?.id ?? "",
        handlerId: "roll-stat",
        targeting: "none",
        requirements: {},
        costs: {},
        rollData: {},
        metadata: {
            statLabel
        }
    };
}

export function createSkillActionDescriptor(context, skillName) {
    const skill = context.summary.skills.find((entry) => entry.name === skillName);
    return {
        actionType: "roll-skill",
        sourceType: "skill",
        sourceId: skill?.id ?? skillName,
        label: `${skillName} Check`,
        actorId: context.actor?.id ?? "",
        tokenId: context.token?.id ?? "",
        handlerId: "roll-skill",
        targeting: "none",
        requirements: {},
        costs: {},
        rollData: {},
        metadata: {
            skillName
        }
    };
}

export function createWeaponAttackActionDescriptor(context, weaponId) {
    const weapon = context.summary.equippedWeapons.find((entry) => entry.id === weaponId);
    return {
        actionType: "attack-with-weapon",
        sourceType: "weapon",
        sourceId: weaponId,
        label: weapon ? `Attack with ${weapon.name}` : "Attack",
        actorId: context.actor?.id ?? "",
        tokenId: context.token?.id ?? "",
        handlerId: "attack-with-weapon",
        targeting: "single-or-none",
        requirements: {},
        costs: {},
        rollData: {},
        metadata: {
            weaponId
        }
    };
}

function evaluateStatAction(descriptor, context, deps = {}) {
    const { buildRollFormula } = deps;
    const stat = context.summary.stats.find((entry) => entry.label === descriptor.metadata?.statLabel);
    if (!stat) {
        return {
            status: "invalid",
            reasons: ["Stat is not available on this actor"],
            resolvedTargets: [],
            resolvedCosts: {},
            rollPreview: null,
            followUp: null,
            resolvedSource: null
        };
    }

    const extraD6 = Math.max(0, Number(context.summary.rollContext?.extraD6 ?? 0) || 0);
    const totalDice = stat.dice + context.summary.rollContext.advantageDice + extraD6;
    const finalFormula = buildRollFormula(totalDice, stat.mod);
    return {
        status: "valid",
        reasons: [],
        resolvedTargets: [],
        resolvedCosts: {},
        rollPreview: {
            title: descriptor.label,
            actionType: descriptor.actionType,
            sourceLabel: stat.label,
            targetLabels: [],
            baseFormula: stat.formula,
            advantageDice: context.summary.rollContext.advantageDice,
            riskDice: context.summary.rollContext.riskDice,
            finalFormula,
            costs: {},
            notes: extraD6 > 0 ? [`+${extraD6} d6 staged from Dice tab`] : []
        },
        followUp: null,
        resolvedSource: stat
    };
}

function evaluateSkillAction(descriptor, context, deps = {}) {
    const { buildSkillRollData } = deps;
    const skill = context.summary.skills.find((entry) => entry.name === descriptor.metadata?.skillName);
    if (!skill) {
        return {
            status: "invalid",
            reasons: ["Skill is not available on this actor"],
            resolvedTargets: [],
            resolvedCosts: {},
            rollPreview: null,
            followUp: null,
            resolvedSource: null
        };
    }
    if (!skill.canRoll) {
        return {
            status: "invalid",
            reasons: ["This skill cannot be rolled from the HUD"],
            resolvedTargets: [],
            resolvedCosts: {},
            rollPreview: null,
            followUp: null,
            resolvedSource: skill
        };
    }
    if (!skill.linkedStat) {
        return {
            status: "invalid",
            reasons: ["Skill is missing a linked stat"],
            resolvedTargets: [],
            resolvedCosts: {},
            rollPreview: null,
            followUp: null,
            resolvedSource: skill
        };
    }

    const baseStat = context.summary.stats.find((entry) => entry.label === skill.linkedStat) ?? null;
    if (!baseStat) {
        return {
            status: "invalid",
            reasons: [`Actor is missing ${skill.linkedStat}`],
            resolvedTargets: [],
            resolvedCosts: {},
            rollPreview: null,
            followUp: null,
            resolvedSource: skill
        };
    }

    const extraD6 = Math.max(0, Number(context.summary.rollContext?.extraD6 ?? 0) || 0);
    const rollData = buildSkillRollData(baseStat, skill.diceShift, context.summary.rollContext.advantageDice, extraD6);
    const notes = [];
    if (rollData.usedFallback) notes.push("Fallback: minimum skill roll is 1d6");
    if (extraD6 > 0) notes.push(`+${extraD6} d6 staged from Dice tab`);

    return {
        status: "valid",
        reasons: [],
        resolvedTargets: [],
        resolvedCosts: {},
        rollPreview: {
            title: descriptor.label,
            actionType: descriptor.actionType,
            sourceLabel: skill.name,
            targetLabels: [],
            baseFormula: skill.baseFormula || "-",
            advantageDice: context.summary.rollContext.advantageDice,
            riskDice: context.summary.rollContext.riskDice,
            finalFormula: rollData.formula,
            costs: {},
            notes
        },
        followUp: null,
        resolvedSource: {
            ...skill,
            baseStat,
            rollData
        }
    };
}

function evaluateWeaponAttackAction(descriptor, context, deps = {}) {
    const {
        summarizeManeuverEffects,
        buildWeaponRollContext,
        getWeaponAttackState,
        buildFoundryAttackRollFormula,
    } = deps;

    const weapon = context.summary.equippedWeapons.find((entry) => entry.id === descriptor.metadata?.weaponId);
    if (!weapon) {
        return {
            status: "invalid",
            reasons: ["Weapon is not available on this actor"],
            resolvedTargets: [],
            resolvedCosts: {},
            rollPreview: null,
            followUp: null,
            resolvedSource: null
        };
    }

    const maneuverEffects = summarizeManeuverEffects(context.summary.selectedPreManeuvers);
    const baseWeaponRollContext = buildWeaponRollContext(context.summary, maneuverEffects);
    const effectiveWeaponRollContext = {
        ...baseWeaponRollContext,
        ammoAddDice: Array.isArray(weapon.loadedAmmoAddDice) ? weapon.loadedAmmoAddDice : []
    };
    const attackState = getWeaponAttackState(weapon, {
        token: context.token,
        primaryTarget: context.primaryTarget,
        targetCount: context.targetedTokens.length,
        attacksRemaining: context.summary.isCombatActive ? context.summary.attacksRemaining : null
    });

    if (attackState.status !== "valid") {
        return {
            status: "invalid",
            reasons: [attackState.reason || "This attack is not currently legal."],
            resolvedTargets: context.primaryTarget ? [context.primaryTarget] : [],
            resolvedCosts: {},
            rollPreview: null,
            followUp: null,
            resolvedSource: {
                weapon,
                attackState
            }
        };
    }

    return {
        status: "valid",
        reasons: [],
        resolvedTargets: context.primaryTarget ? [context.primaryTarget] : [],
        resolvedCosts: {},
        rollPreview: {
            title: descriptor.label,
            actionType: descriptor.actionType,
            sourceLabel: weapon.name,
            targetLabels: context.primaryTarget ? [context.primaryTarget.name ?? context.primaryTarget.actor?.name ?? "Target"] : [],
            baseFormula: weapon.activeAttackFormula || "-",
            advantageDice: effectiveWeaponRollContext.advantageDice,
            riskDice: effectiveWeaponRollContext.riskDice,
            finalFormula: buildFoundryAttackRollFormula(weapon.activeAttackProfileData, effectiveWeaponRollContext) || weapon.activeAttackFormula || "-",
            costs: {},
            notes: [
                attackState.label,
                attackState.reason,
                maneuverEffects.addMainDice > 0 ? `+${maneuverEffects.addMainDice} main die` : "",
                maneuverEffects.addMultiplierDice > 0 ? `+${maneuverEffects.addMultiplierDice} multiplier die` : "",
                maneuverEffects.addRiskDice > 0 ? `+${maneuverEffects.addRiskDice} risk die` : "",
                maneuverEffects.addDisadvantage > 0 ? `+${maneuverEffects.addDisadvantage} disadvantage` : "",
                ...Object.entries(effectiveWeaponRollContext.extraDiceCounts ?? {}).flatMap(([dieKey, count]) => Number(count) > 0 ? [`+${count} ${dieKey} die${Number(count) === 1 ? "" : "s"} staged`] : [])
            ].filter(Boolean)
        },
        followUp: null,
        resolvedSource: {
            weapon,
            attackState
        }
    };
}

export function evaluateHudAction(descriptor, context, deps = {}) {
    switch (descriptor.actionType) {
        case "roll-stat":
            return evaluateStatAction(descriptor, context, deps);
        case "roll-skill":
            return evaluateSkillAction(descriptor, context, deps);
        case "attack-with-weapon":
            return evaluateWeaponAttackAction(descriptor, context, deps);
        default:
            return {
                status: "invalid",
                reasons: ["No HUD handler is defined for this action"],
                resolvedTargets: [],
                resolvedCosts: {},
                rollPreview: null,
                followUp: null,
                resolvedSource: null
            };
    }
}
