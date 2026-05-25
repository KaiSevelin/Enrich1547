import { COMBAT_EVENTS, emitCombatEvent, onCombatEvent } from "./combat-events.js";
import { evaluateManeuverLegality, getLegalManeuvers } from "../combat/maneuver-legality.mjs";
import { buildDefenderPool } from "../combat/pool-builder.mjs";
import {
    parseJsonString,
    parseCommaList,
    isTruthyLike,
    firstFiniteNumber,
    hasUsableRangeBands,
    inferWeaponAttackType,
    buildAttackProfilesFromWeaponProps,
    resolveAmmoRangeSpec,
    normalizeRangeBands,
    applyAmmoRangeEffects,
    normalizeManeuver,
    normalizeAmmoItem,
    normalizeWeapon as normalizeWeaponPure,
} from "../combat/normalisation.mjs";
import {
    getAllowedAmmoTypes,
    validateAmmoCompatibility,
    resolveLoadedAmmoForAttack,
    planLoadWeaponAmmo,
    planSpendLoadedAmmo,
    planConsumeLoadedAmmo,
} from "../combat/ammo-state.mjs";

const MODULE_ID = "1547core";
const SOURCE_FLAG_SCOPE = "1547Core";
const PENDING_ATTACK_KIND = "1547core.pendingAttack";
const DEFAULT_UNARMED_WEAPON_SOURCE = {
    _id: "j2xrFYjojE9yUPYc",
    id: "j2xrFYjojE9yUPYc",
    name: "Unarmed",
    itemType: "weapon",
    category: "Unarmed",
    equipped: true,
    reloadTime: 0,
    reloadProgress: 0,
    traits: ["Disarming", "Control", "Fast"],
    attackProfiles: [
        {
            id: "default",
            name: "Default",
            attackType: "melee",
            dice: ["Control", "Control", "Control"],
            tags: []
        }
    ],
    groups: ["UnarmedWeapon"],
    minReach: 1,
    maxReach: 1,
    usesAmmo: false,
    ammoType: "",
    ammoCapacity: 0,
    ammoLoaded: 0,
};

const DEFAULT_UNPROTECTED_ARMOR_SOURCE = {
    _id: "default-unprotected",
    id: "default-unprotected",
    name: "Unprotected",
    itemType: "armor",
    armorClass: "Unprotected",
    equipped: true,
    traits: [],
    defenseDice: ["Evade", "Evade", "Evade"],
};
let combatResolverDisposers = [];

export function registerCombatResolverService() {
    const module = game.modules.get(MODULE_ID);
    if (!module) return;

    if (!combatResolverDisposers.length) {
        combatResolverDisposers = [
            onCombatEvent(COMBAT_EVENTS.REACTION_RESOLVED, (event) => executeResolvedReaction(event.payload)),
        ];
    }

    module.api = {
        ...(module.api ?? {}),
        combat: {
            ...(module.api?.combat ?? {}),
            buildPendingAttack,
            buildPendingMove,
            declareAttack,
            declareMovement,
            loadWeaponAmmo,
            resolveAttackOutcome,
            executeSafeCounterattack,
            spendLoadedAmmo,
            swapLoadedAmmo,
            commitFullTurnManeuver,
            commitPostManeuver,
            getActivePersistentEffects,
            consumePersistentEffect,
        },
    };
}

export function buildPendingAttack({
    actor,
    target = null,
    targets = null,
    weapon,
    profileId = null,
    profile = null,
    selectedPreManeuvers = [],
    forceSafeAttack = false,
    extraEffectData = null,
    generatedByReaction = null,
    ...context
} = {}) {
    const normalizedWeapon = normalizeWeapon(weapon, actor);
    if (!actor) throw new Error("Missing actor.");
    if (!normalizedWeapon) throw new Error("Missing weapon.");

    const selectedProfile = resolveSelectedWeaponProfile(normalizedWeapon, {
        profile,
        profileId,
    });

    if (!selectedProfile) {
        throw new Error(`${normalizedWeapon.name} does not have a legal attack profile.`);
    }

    const ammoState = resolveLoadedAmmoForAttack({
        actor,
        weapon: normalizedWeapon,
        profile: selectedProfile,
    });

    const legalPreManeuvers = getLegalManeuvers({
        actor,
        weapon: normalizedWeapon,
        profile: selectedProfile,
        target,
        targets,
        timingType: "pre",
        triggerType: "attack-declared",
        ...context,
    });

    const selected = selectedPreManeuvers
        .map(normalizeManeuver)
        .filter(Boolean);
    const extraModifiers = summarizeEffectData(extraEffectData);

    const selectedEvaluations = selected.map((maneuver) =>
        evaluateManeuverLegality(maneuver, {
            actor,
            weapon: normalizedWeapon,
            profile: selectedProfile,
            target,
            targets,
            timingType: "pre",
            triggerType: "attack-declared",
            ...context,
        })
    );

    const illegalSelections = selectedEvaluations.filter((entry) => !entry.legal);
    if (illegalSelections.length) {
        const summary = illegalSelections
            .map((entry) => `${entry.maneuver?.name}: ${entry.reasons.join(" ")}`)
            .join("; ");
        throw new Error(`Illegal pre-maneuver selection. ${summary}`);
    }

    return {
        kind: PENDING_ATTACK_KIND,
        actor,
        target,
        targets: Array.isArray(targets) && targets.length ? targets : [target].filter(Boolean),
        weapon: normalizedWeapon,
        profile: selectedProfile,
        loadedAmmo: ammoState.loadedAmmo,
        triggerType: "attack-declared",
        safeAttack: selected.some((maneuver) => createsSafeAttack(maneuver)) || forceSafeAttack || extraModifiers.safeAttack,
        selectedPreManeuvers: selected,
        legalPreManeuvers,
        reactionCandidates: buildAttackReactionCandidates({
            attacker: actor,
            defender: target,
            pendingWeapon: normalizedWeapon,
            pendingProfile: selectedProfile,
            context,
        }),
        reservedCosts: collectReservedCosts(selected),
        mergedModifiers: mergeModifierSummaries(mergeManeuverEffects(selected), extraModifiers),
        metadata: {
            ...context,
            generatedByReaction,
        },
        committed: false,
    };
}

export function buildPendingMove({
    actor,
    path = [],
    selectedPreManeuvers = [],
    forceSafeAttack = false,
    extraEffectData = null,
    generatedByReaction = null,
    ...context
} = {}) {
    if (!actor) throw new Error("Missing actor.");

    const selected = selectedPreManeuvers
        .map(normalizeManeuver)
        .filter(Boolean);
    const extraModifiers = summarizeEffectData(extraEffectData);

    const selectedEvaluations = selected.map((maneuver) =>
        evaluateManeuverLegality(maneuver, {
            actor,
            timingType: "pre",
            triggerType: "move-declared",
            ...context,
        })
    );

    const illegalSelections = selectedEvaluations.filter((entry) => !entry.legal);
    if (illegalSelections.length) {
        const summary = illegalSelections
            .map((entry) => `${entry.maneuver?.name}: ${entry.reasons.join(" ")}`)
            .join("; ");
        throw new Error(`Illegal movement pre-maneuver selection. ${summary}`);
    }

    return {
        actor,
        path: Array.isArray(path) ? path : [],
        triggerType: "move-declared",
        selectedPreManeuvers: selected,
        reservedCosts: collectReservedCosts(selected),
        mergedModifiers: mergeModifierSummaries(mergeManeuverEffects(selected), extraModifiers),
        metadata: {
            ...context,
            generatedByReaction,
        },
        committed: false,
    };
}


export function getActivePersistentEffects(actor, {
    isCombatActive = false,
    fullTurnAvailable = false,
} = {}) {
    const active = Array.isArray(actor?.flags?.[MODULE_ID]?.activeFullTurnManeuvers)
        ? actor.flags[MODULE_ID].activeFullTurnManeuvers
        : [];

    return active.filter((entry) => {
        const effectType = String(entry?.createsPersistentEffect ?? "").trim();
        if (!effectType) return false;
        const duration = String(entry?.duration ?? "").trim().toLowerCase();
        if (isCombatActive && fullTurnAvailable && ["until-side-active-again", "until-side-active-again-or-consumed"].includes(duration)) {
            return false;
        }
        return true;
    });
}

export async function consumePersistentEffect(actor, effectType) {
    const normalizedType = String(effectType ?? "").trim();
    if (!actor?.update || !normalizedType) return false;
    const currentFlags = actor.flags?.[MODULE_ID] ?? {};
    const active = Array.isArray(currentFlags.activeFullTurnManeuvers) ? currentFlags.activeFullTurnManeuvers : [];
    const targetIndex = active.findIndex((entry) => String(entry?.createsPersistentEffect ?? "").trim() === normalizedType);
    if (targetIndex < 0) return false;
    const nextActive = [...active.slice(0, targetIndex), ...active.slice(targetIndex + 1)];
    await actor.update({
        [`flags.${MODULE_ID}.activeFullTurnManeuvers`]: nextActive,
    });
    return true;
}export async function commitFullTurnManeuver({
    actor,
    maneuver,
    weapon = null,
    profile = null,
    profileId = null,
    target = null,
    targets = null,
    reservedResources = {},
    usedManeuvers = [],
    hasVisibleAlly = false,
    actorConditions = [],
    targetConditions = [],
    distanceSquares = null,
    rangeSquares = null,
    currentCriticalPoints = null,
    metadata = {},
} = {}) {
    const selectedManeuver = normalizeManeuver(maneuver);
    if (!actor) throw new Error("Missing actor.");
    if (!selectedManeuver) throw new Error("Missing maneuver.");

    const normalizedWeapon = normalizeWeapon(weapon, actor);
    const selectedProfile = resolveSelectedWeaponProfile(normalizedWeapon, {
        profile,
        profileId,
    });

    const evaluation = evaluateManeuverLegality(selectedManeuver, {
        actor,
        weapon: normalizedWeapon,
        profile: selectedProfile,
        target,
        targets,
        timingType: "full-turn",
        triggerType: "full-turn-activation",
        fullTurnAvailable: metadata.fullTurnAvailable,
        reservedResources,
        usedManeuvers,
        hasVisibleAlly,
        actorConditions,
        targetConditions,
        distanceSquares,
        rangeSquares,
        currentCriticalPoints,
    });

    if (!evaluation.legal) {
        throw new Error(evaluation.reasons?.[0] || "This full-turn maneuver is not currently legal.");
    }

    await spendActorManeuverCost(actor, selectedManeuver);

    if (metadata.isCombatActive === true) {
        await actor.update({
            "system.props.FullTurnAvailable": false
        });
    }

    const record = buildCommittedManeuverRecord(selectedManeuver);
    await appendCommittedManeuverState(actor, record);

    const commitEvent = await emitCombatEvent(COMBAT_EVENTS.ACTION_COMMITTED, {
        type: "full-turn",
        actor,
        maneuver: selectedManeuver,
        weapon: normalizedWeapon,
        profile: selectedProfile,
        target,
        targets,
        metadata,
        record,
    });

    return {
        maneuver: selectedManeuver,
        record,
        commitEvent,
    };
}

export async function commitPostManeuver({
    actor,
    maneuver,
    pendingAttack,
    side = "attacker",
    target = null,
    currentCriticalPoints = null,
    actorConditions = [],
    targetConditions = [],
} = {}) {
    const selectedManeuver = normalizeManeuver(maneuver);
    if (!actor) throw new Error("Missing actor.");
    if (!selectedManeuver) throw new Error("Missing maneuver.");
    if (!pendingAttack) throw new Error("Missing pending attack.");

    const evaluation = evaluateManeuverLegality(selectedManeuver, {
        actor,
        weapon: pendingAttack.weapon,
        profile: pendingAttack.profile,
        target,
        timingType: "post",
        triggerType: "post-attack",
        currentCriticalPoints,
        actorConditions,
        targetConditions,
    });

    if (!evaluation.legal) {
        throw new Error(evaluation.reasons?.[0] || "This post maneuver is not currently legal.");
    }

    await spendActorManeuverCost(actor, selectedManeuver);

    const commitEvent = await emitCombatEvent(COMBAT_EVENTS.ACTION_COMMITTED, {
        type: "post-maneuver",
        side,
        actor,
        target,
        pendingAttack,
        maneuver: selectedManeuver,
        currentCriticalPoints,
    });

    return {
        maneuver: selectedManeuver,
        commitEvent,
    };
}

export async function declareAttack(options = {}) {
    const pendingAttack = buildPendingAttack(options);
    if (pendingAttack.target) {
        await consumePersistentEffect(pendingAttack.target, "overwatch");
    }

    const event = await emitCombatEvent(COMBAT_EVENTS.ATTACK_DECLARED, pendingAttack);

    const declarationCommitted = !event.cancelled || event.reason === "reaction-triggered";
    if (declarationCommitted && !pendingAttack.committed) {
        await consumeLoadedAmmo({
            actor: pendingAttack.actor,
            weapon: pendingAttack.weapon,
            loadedAmmo: pendingAttack.loadedAmmo,
        });
        pendingAttack.committed = true;
    }

    return {
        pendingAttack,
        event,
        cancelled: event.cancelled,
        reactionResolution: findReactionResolution(event),
    };
}

export async function declareMovement({
    threatEvents = [],
    ...options
} = {}) {
    const pendingMove = buildPendingMove(options);
    const movementEvent = await emitCombatEvent(COMBAT_EVENTS.MOVEMENT_STARTED, pendingMove);
    const reactionResolutions = [];

    for (const threatEvent of threatEvents) {
        const threatPayload = {
            ...pendingMove,
            ...threatEvent,
            mover: pendingMove.actor,
            path: pendingMove.path,
        };
        if (!threatPayload.reactor) {
            threatPayload.reactor = resolveThreatReactionActor(threatPayload);
        }
        if (!Array.isArray(threatPayload.reactionCandidates) || !threatPayload.reactionCandidates.length) {
            threatPayload.reactionCandidates = buildThreatReactionCandidates(threatPayload);
        }
        const enteredEvent = await emitCombatEvent(COMBAT_EVENTS.THREAT_ZONE_ENTERED, threatPayload);
        const resolution = findReactionResolution(enteredEvent);
        if (resolution) {
            reactionResolutions.push(resolution);
        }
    }

    return {
        pendingMove,
        event: movementEvent,
        reactionResolutions,
    };
}

async function executeResolvedReaction(resolution) {
    const reaction = resolution?.reaction ?? null;
    const effect = reaction?.effectData ?? {};
    if (!effect.createFreeSafeAttack && !effect.createFreeSafeCounterattack) return null;

    const actor = reaction?.actor ?? resolution?.actor ?? null;
    const target = reaction?.target ?? resolution?.target ?? null;
    const weapon = reaction?.weapon ?? null;
    const profile = reaction?.profile ?? null;
    if (!actor || !target || !weapon || !profile) return null;

    const sourcePayload = resolution?.sourceEvent?.payload ?? {};
    const distanceSquares = Number(sourcePayload.distanceSquares ?? sourcePayload.rangeSquares);

    return declareAttack({
        actor,
        target,
        targets: [target],
        weapon: weapon.itemDocument ?? weapon,
        profile,
        forceSafeAttack: true,
        extraEffectData: effect,
        generatedByReaction: reaction.generatedByPersistentEffect ?? reaction.sourceManeuverName ?? reaction.name ?? "reaction",
        distanceSquares: Number.isFinite(distanceSquares) ? distanceSquares : null,
        actorConditions: sourcePayload.actorConditions,
        targetConditions: sourcePayload.targetConditions,
    });
}
function buildThreatReactionCandidates(threatPayload = {}) {
    const reactor = resolveThreatReactionActor(threatPayload);
    if (!reactor) return [];

    const reactionWeapon = getActorReactionWeapon(reactor);
    const reactionProfile = resolveSelectedWeaponProfile(reactionWeapon, {});
    const mover = threatPayload.mover ?? null;
    const distanceSquares = Number(threatPayload.distanceSquares ?? threatPayload.rangeSquares);

    const candidates = getLegalManeuvers({
        actor: reactor,
        weapon: reactionWeapon,
        profile: reactionProfile,
        target: mover,
        targets: mover ? [mover] : [],
        timingType: "reaction",
        triggerType: "threat-zone-entered",
        distanceSquares,
        rangeSquares: distanceSquares,
        actorConditions: threatPayload.actorConditions,
        targetConditions: threatPayload.targetConditions,
    });

    const overwatchCandidate = buildOverwatchReactionCandidate({
        reactor,
        mover,
        reactionWeapon,
        reactionProfile,
        threatPayload,
    });

    if (overwatchCandidate) {
        candidates.push(overwatchCandidate);
    }

    return candidates;
}

function resolveThreatReactionActor(threatPayload = {}) {
    const moverId = threatPayload.mover?.id ?? null;
    const explicitCandidates = [
        threatPayload.reactor,
        threatPayload.reactingActor,
        threatPayload.threatActor,
        threatPayload.zoneOwner,
        threatPayload.owner,
        threatPayload.sourceActor,
        threatPayload.token?.actor ?? null,
    ].filter(Boolean);

    for (const candidate of explicitCandidates) {
        if (!candidate) continue;
        if (moverId && candidate.id === moverId) continue;
        return candidate;
    }

    if (threatPayload.actor && (!moverId || threatPayload.actor.id !== moverId)) {
        return threatPayload.actor;
    }

    return null;
}

function buildOverwatchReactionCandidate({
    reactor,
    mover,
    reactionWeapon,
    reactionProfile,
    threatPayload = {},
} = {}) {
    if (!reactor || !mover) return null;

    const activeOverwatch = getActivePersistentEffects(reactor, {}).find((entry) => String(entry?.createsPersistentEffect ?? "").trim() === "overwatch");
    if (!activeOverwatch) return null;
    if (!reactionWeapon || !reactionProfile) return null;

    const profileType = String(reactionProfile.attackType ?? "").trim().toLowerCase();
    if (!["ranged", "thrown"].includes(profileType)) return null;

    const distanceSquares = Number(threatPayload.distanceSquares ?? threatPayload.rangeSquares);
    if (Number.isFinite(distanceSquares)) {
        const withinMax = Number.isFinite(Number(reactionWeapon.maxRange)) ? distanceSquares <= Number(reactionWeapon.maxRange) : true;
        if (!withinMax) return null;
    }

    return {
        id: `overwatch:${reactor.id}:${reactionWeapon._id ?? reactionWeapon.id ?? reactionWeapon.name}`,
        name: "Overwatch Attack",
        type: "reaction",
        usage: "Persistent effect",
        triggerType: "threat-zone-entered",
        generatedByPersistentEffect: "overwatch",
        sourceManeuverName: activeOverwatch.name ?? "Overwatch",
        actor: reactor,
        target: mover,
        weapon: reactionWeapon,
        profile: reactionProfile,
        effectData: {
            ...(activeOverwatch.effectData ?? {}),
            createFreeSafeAttack: true,
            addMainDice: Math.max(1, Number(activeOverwatch.effectData?.addMainDice ?? 1) || 1),
        },
        reasons: [],
        legal: true,
        CostType: null,
        CostAmount: 0,
    };
}

function buildAttackReactionCandidates({
    attacker,
    defender,
    pendingWeapon,
    pendingProfile,
    context = {},
} = {}) {
    if (!defender) return [];

    const reactionWeapon = getActorReactionWeapon(defender);
    const reactionProfile = resolveSelectedWeaponProfile(reactionWeapon, {});

    return getLegalManeuvers({
        actor: defender,
        weapon: reactionWeapon,
        profile: reactionProfile,
        target: attacker,
        timingType: "reaction",
        triggerType: "attack-declared",
        distanceSquares: context.distanceSquares,
        rangeSquares: context.rangeSquares,
        actorConditions: context.targetConditions,
        targetConditions: context.actorConditions,
        incomingAttack: {
            weapon: pendingWeapon,
            profile: pendingProfile,
        },
    });
}


function createPostManeuverWindowPayload({
    side,
    actor,
    target,
    pendingAttack,
    currentCriticalPoints,
    legalPostManeuvers,
    selectedPostManeuver = null,
    actorConditions = [],
    targetConditions = [],
} = {}) {
    const selected = normalizeManeuver(selectedPostManeuver);
    return {
        id: `post-${side}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        side,
        actor,
        target,
        pendingAttack,
        currentCriticalPoints,
        legalPostManeuvers: Array.isArray(legalPostManeuvers) ? legalPostManeuvers : [],
        selectedPostManeuver: selected,
        actorConditions,
        targetConditions,
        async commitPostManeuver(selection) {
            return commitPostManeuver({
                actor,
                maneuver: selection,
                pendingAttack,
                side,
                target,
                currentCriticalPoints,
                actorConditions,
                targetConditions,
            });
        },
        passPostManeuver() {
            return null;
        },
    };
}

async function applyDefenseFollowUpState(pendingAttack, defenseModifiers) {
    const defender = pendingAttack?.target ?? null;
    if (!defender?.update) return {};

    const updates = {};
    const lockedUntil = String(defenseModifiers?.lockParryingWeaponUntil ?? "").trim();
    if (lockedUntil) {
        updates[`flags.${MODULE_ID}.defenseState`] = {
            lockedParryingWeaponUntil: lockedUntil,
            updatedAt: Date.now(),
        };
    }

    if (!Object.keys(updates).length) return {};
    await defender.update(updates);
    return {
        lockedParryingWeaponUntil: lockedUntil || null,
    };
}
export async function executeSafeCounterattack({
    pendingAttack,
    defenseReaction = null,
    currentDamageTakenReaction = null,
} = {}) {
    const defender = pendingAttack?.target ?? null;
    const attacker = pendingAttack?.actor ?? null;
    if (!defender || !attacker) {
        throw new Error("Safe counterattack is missing a defender or attacker.");
    }

    const defenseModifiers = normalizeDefenseModifiers({
        defenseReaction,
        damageTakenReaction: currentDamageTakenReaction,
    });
    if (!defenseModifiers.safeCounterattack) {
        throw new Error("No safe counterattack is available.");
    }

    const reactionWeapon = getActorReactionWeapon(defender);
    const reactionProfile = resolveSelectedWeaponProfile(reactionWeapon, {});
    if (!reactionWeapon || !reactionProfile) {
        throw new Error(`${defender.name ?? "Defender"} has no equipped weapon for a safe counterattack.`);
    }

    const distanceSquares = Number(
        pendingAttack?.metadata?.distanceSquares ??
        pendingAttack?.metadata?.rangeSquares
    );

    return declareAttack({
        actor: defender,
        target: attacker,
        targets: [attacker],
        weapon: reactionWeapon.itemDocument ?? reactionWeapon,
        profile: reactionProfile,
        forceSafeAttack: true,
        extraEffectData: { createFreeSafeCounterattack: true },
        generatedByReaction: currentDamageTakenReaction?.name ?? defenseReaction?.name ?? "safe-counterattack",
        distanceSquares: Number.isFinite(distanceSquares) ? distanceSquares : null,
        actorConditions: pendingAttack?.metadata?.targetConditions,
        targetConditions: pendingAttack?.metadata?.actorConditions,
    });
}
export async function resolveAttackOutcome({
    pendingAttack,
    attackRoll,
    defenseRoll,
    defenseReaction = null,
    defenderPostChoice = null,
    attackerPostChoice = null,
    currentCriticalPoints = null,
    currentDamageTakenReaction = null,
} = {}) {
    if (!pendingAttack) throw new Error("Missing pending attack.");
    if (!isPendingAttack(pendingAttack)) {
        throw new Error("Pending attack must be created through buildPendingAttack.");
    }

    const appliedModifiers = normalizeAppliedAttackModifiers(pendingAttack?.mergedModifiers ?? {});
    const defenseModifiers = normalizeDefenseModifiers({
        defenseReaction,
        damageTakenReaction: currentDamageTakenReaction,
    });
    const normalizedAttackRoll = {
        ...applyMultiplier(normalizeRollSummary(attackRoll)),
        appliedModifiers,
    };
    const fallbackDefenseRoll = defenseRoll ?? (!actorHasEquippedArmor(pendingAttack?.target) ? buildDefaultDefenseRollSummary(pendingAttack) : null);
    const baseDefenseRoll = applyMultiplier(normalizeRollSummary(fallbackDefenseRoll));
    const normalizedDefenseRoll = {
        ...baseDefenseRoll,
        protection: baseDefenseRoll.protection + defenseModifiers.addArmorDice,
        appliedModifiers: defenseModifiers,
    };
    const damageApplied = Math.max(
        0,
        normalizedAttackRoll.damage - normalizedDefenseRoll.protection - defenseModifiers.reduceDamageTaken
    );
    const hitPointUpdate = damageApplied > 0
        ? await applyDamageToActorHitPoints(pendingAttack.target, damageApplied)
        : {
            previousHitPoints: getActorCurrentHitPoints(pendingAttack.target),
            currentHitPoints: getActorCurrentHitPoints(pendingAttack.target),
        };

    const criticalPoints =
        currentCriticalPoints ??
        Math.max(0, normalizedAttackRoll.crit) +
            Math.max(0, normalizedDefenseRoll.crit);

    const defenseFollowUpState = await applyDefenseFollowUpState(pendingAttack, defenseModifiers);

    const damageWindow = await emitCombatEvent(COMBAT_EVENTS.DAMAGE_APPLIED, {
        pendingAttack,
        attackRoll: normalizedAttackRoll,
        defenseRoll: normalizedDefenseRoll,
        damageApplied,
        hitPointUpdate,
        appliedModifiers,
        defenseModifiers,
        defenseFollowUpState,
    });

    const defenderPostOptions = getLegalManeuvers({
        actor: pendingAttack.target,
        maneuvers: pendingAttack.target ? undefined : [],
        weapon: pendingAttack.weapon,
        profile: pendingAttack.profile,
        target: pendingAttack.actor,
        timingType: "post",
        triggerType: "post-attack",
        currentCriticalPoints: criticalPoints,
        actorConditions: pendingAttack.metadata?.targetConditions,
        targetConditions: pendingAttack.metadata?.actorConditions,
    });

    const attackerPostOptions = getLegalManeuvers({
        actor: pendingAttack.actor,
        weapon: pendingAttack.weapon,
        profile: pendingAttack.profile,
        target: pendingAttack.target,
        timingType: "post",
        triggerType: "post-attack",
        currentCriticalPoints: criticalPoints,
        actorConditions: pendingAttack.metadata?.actorConditions,
        targetConditions: pendingAttack.metadata?.targetConditions,
    });

    const pendingPostManeuverWindows = [
        createPostManeuverWindowPayload({
            side: "defender",
            actor: pendingAttack.target,
            target: pendingAttack.actor,
            pendingAttack,
            currentCriticalPoints: criticalPoints,
            legalPostManeuvers: defenderPostOptions,
            selectedPostManeuver: defenderPostChoice,
            actorConditions: pendingAttack.metadata?.targetConditions,
            targetConditions: pendingAttack.metadata?.actorConditions,
        }),
        createPostManeuverWindowPayload({
            side: "attacker",
            actor: pendingAttack.actor,
            target: pendingAttack.target,
            pendingAttack,
            currentCriticalPoints: criticalPoints,
            legalPostManeuvers: attackerPostOptions,
            selectedPostManeuver: attackerPostChoice,
            actorConditions: pendingAttack.metadata?.actorConditions,
            targetConditions: pendingAttack.metadata?.targetConditions,
        }),
    ].filter((entry) => entry?.actor);

    const postManeuverWindowEvents = [];
    for (const postWindow of pendingPostManeuverWindows) {
        postManeuverWindowEvents.push(
            await emitCombatEvent(COMBAT_EVENTS.POST_MANEUVER_WINDOW_OPENED, postWindow)
        );
    }

    if (!pendingAttack.committed) {
        await consumeLoadedAmmo({
            actor: pendingAttack.actor,
            weapon: pendingAttack.weapon,
            loadedAmmo: pendingAttack.loadedAmmo,
        });
        pendingAttack.committed = true;
    }
    const commitEvent = await emitCombatEvent(COMBAT_EVENTS.ACTION_COMMITTED, {
        type: "attack",
        pendingAttack,
        damageApplied,
        hitPointUpdate,
        appliedModifiers,
        defenseModifiers,
        defenseFollowUpState,
    });

    return {
        pendingAttack,
        attackRoll: normalizedAttackRoll,
        defenseRoll: normalizedDefenseRoll,
        damageApplied,
        hitPointUpdate,
        currentCriticalPoints: criticalPoints,
        appliedModifiers,
        defenseModifiers,
        defenseFollowUpState,
        defenderPostOptions,
        attackerPostOptions,
        events: {
            damageWindow,
            commitEvent,
            postManeuverWindowEvents,
        },
        pendingPostManeuverWindows,
    };
}

// ─────────────────────────────────────── Ammo orchestrators (patch dispatch) ──
//
// These functions preserve the existing public API shape — same inputs,
// same return values, still async — but delegate computation to the
// pure planners in combat/ammo-state.mjs and apply the returned patches
// here. The pure planners can be unit-tested with literal fixtures.

export async function loadWeaponAmmo(options = {}) {
    const { patches, result } = planLoadWeaponAmmo(options);
    await applyPatches(patches);
    return result;
}

export async function spendLoadedAmmo(options = {}) {
    const { patches, result } = planSpendLoadedAmmo(options);
    await applyPatches(patches);
    return result;
}

export async function swapLoadedAmmo(options = {}) {
    return loadWeaponAmmo(options);
}

function getStoredDatasetEntry(settingKey, name) {
    const dataset = game?.settings?.get?.(MODULE_ID, settingKey) ?? [];
    if (!Array.isArray(dataset)) return null;
    return dataset.find((entry) => String(entry?.name ?? "").trim().toLowerCase() === String(name ?? "").trim().toLowerCase()) ?? null;
}

function buildDefaultUnarmedWeapon() {
    return {
        ...(getStoredDatasetEntry("weaponData", "Unarmed") ?? DEFAULT_UNARMED_WEAPON_SOURCE),
        itemDocument: null,
        equipped: true,
        isVirtualDefault: true,
    };
}

function buildDefaultUnprotectedArmor() {
    return {
        ...(getStoredDatasetEntry("armorData", "Unprotected") ?? DEFAULT_UNPROTECTED_ARMOR_SOURCE),
        equipped: true,
        isVirtualDefault: true,
    };
}

/**
 * Foundry-side wrapper around the pure normalizeWeapon. Falls back to
 * the unarmed default when no weapon is provided; this fallback depends
 * on game.settings (via getStoredDatasetEntry), so it stays here rather
 * than in the pure normalisation module.
 */
function normalizeWeapon(weapon, actor = null) {
    return normalizeWeaponPure(weapon, actor) ?? buildDefaultUnarmedWeapon();
}

function getActorReactionWeapon(actor) {
    const items = actor?.items?.contents ?? actor?.items ?? [];
    const weapons = items
        .filter((item) => isWeaponSource(item.flags?.[SOURCE_FLAG_SCOPE]?.sourceData ?? item.flags?.[MODULE_ID]?.sourceData ?? item))
        .map((item) => normalizeWeapon(item, actor))
        .filter(Boolean);

    const equippedWeapon = weapons.find((weapon) => weapon.equipped);
    if (equippedWeapon) return equippedWeapon;

    return weapons[0] ?? normalizeWeapon(null, actor);
}

function isWeaponSource(source) {
    if (!source) return false;
    if (source.itemType === "weapon") return true;
    return source.folder === "Weapons";
}

function resolveSelectedWeaponProfile(weapon, { profile = null, profileId = null } = {}) {
    if (profile) return profile;

    const attackProfiles = Array.isArray(weapon?.attackProfiles) ? weapon.attackProfiles : [];
    if (!attackProfiles.length) return null;

    if (profileId) {
        const explicitProfile = attackProfiles.find((entry) => entry?.id === profileId);
        if (explicitProfile) return explicitProfile;
    }

    const activeProfile = getProfileFromActiveKey(attackProfiles, weapon?.activeAttackProfileKey);
    return activeProfile ?? attackProfiles[0] ?? null;
}

function getProfileFromActiveKey(attackProfiles, activeKey) {
    const profileIndex = ACTIVE_ATTACK_PROFILE_KEYS.indexOf(String(activeKey ?? "").trim());
    if (profileIndex < 0) return null;
    return attackProfiles[profileIndex] ?? null;
}

/**
 * Orchestrator-side wrapper for the consume planner. Used by
 * lifecycle functions inside this file (resolveAttackOutcome,
 * commitFullTurnManeuver) that need to consume ammo as a side effect.
 */
async function consumeLoadedAmmo({ actor, weapon, loadedAmmo }) {
    const { patches, result } = planConsumeLoadedAmmo({ actor, weapon, loadedAmmo });
    await applyPatches(patches);
    return result;
}

// ────────────────────────────────────────────────── Patch dispatch ──
//
// Patch-returner modules (ammo-state.mjs, future ammo/hp/persistent-
// effects modules) return arrays of patch descriptors. This dispatcher
// is the single place that translates them into Foundry mutations.
// Per CONTEXT.md + ADR-0001, patch shape is a discriminated union:
//
//   { kind: "actor.update",       actorId, data }
//   { kind: "item.update",        actorId, itemId, data }
//   { kind: "actor.setFlag",      actorId, scope, key, value }
//   { kind: "actor.statusEffect", actorId, keyword, active }
//
// Only "item.update" is consumed today (by ammo-state); the others are
// in the shape contract so later patch-returner modules slot in.

async function applyPatch(patch) {
    if (!patch || !patch.kind) return;
    switch (patch.kind) {
        case "actor.update": {
            const actor = game.actors?.get?.(patch.actorId);
            if (actor?.update) await actor.update(patch.data);
            return;
        }
        case "item.update": {
            const actor = game.actors?.get?.(patch.actorId);
            const item = actor?.items?.get?.(patch.itemId);
            if (item?.update) await item.update(patch.data);
            return;
        }
        case "actor.setFlag": {
            const actor = game.actors?.get?.(patch.actorId);
            if (actor?.setFlag) await actor.setFlag(patch.scope, patch.key, patch.value);
            return;
        }
        case "actor.statusEffect": {
            const actor = game.actors?.get?.(patch.actorId);
            if (actor) await setActorStatusEffect(actor, patch.keyword, patch.active);
            return;
        }
        default:
            console.warn(`${MODULE_ID} | applyPatch: unknown patch kind "${patch.kind}"`);
    }
}

async function applyPatches(patches = []) {
    for (const patch of patches) await applyPatch(patch);
}

async function spendActorManeuverCost(actor, maneuver) {
    const costType = String(maneuver?.CostType ?? "").trim();
    const costAmount = Math.max(0, Number(maneuver?.CostAmount ?? 0) || 0);
    if (!actor?.update || !costType || costType === "null" || costAmount <= 0) return null;

    const currentValue = firstFiniteNumber([
        actor.system?.props?.[costType],
        actor.system?.[costType],
    ]) ?? 0;
    const nextValue = Math.max(0, currentValue - costAmount);
    await actor.update({
        [`system.props.${costType}`]: nextValue,
    });
    return {
        costType,
        previousValue: currentValue,
        nextValue,
        costAmount,
    };
}

function buildCommittedManeuverRecord(maneuver) {
    return {
        id: maneuver?._id ?? maneuver?.id ?? maneuver?.name ?? null,
        name: maneuver?.name ?? "Maneuver",
        type: maneuver?.type ?? "full-turn",
        triggerType: maneuver?.triggerType ?? "full-turn-activation",
        committedAt: Date.now(),
        duration: maneuver?.effectData?.duration ?? null,
        createsPersistentEffect: maneuver?.effectData?.createsPersistentEffect ?? null,
        effectData: maneuver?.effectData ?? {},
    };
}

async function appendCommittedManeuverState(actor, record) {
    if (!actor?.update || !record?.id) return;
    const currentFlags = actor.flags?.[MODULE_ID] ?? {};
    const activeFullTurnManeuvers = Array.isArray(currentFlags.activeFullTurnManeuvers) ? currentFlags.activeFullTurnManeuvers : [];
    const nextActive = [...activeFullTurnManeuvers.filter((entry) => entry?.id !== record.id), record];
    await actor.update({
        [`flags.${MODULE_ID}.activeFullTurnManeuvers`]: nextActive,
    });
}
function createsSafeAttack(maneuver) {
    const effect = maneuver?.effectData ?? {};
    return Boolean(
        effect.createFreeSafeAttack ||
        effect.createSecondSafeAttack ||
        effect.createFreeSafeCounterattack ||
        effect.ifEscapeSucceedsCreateFreeSafeAttack
    );
}

function collectReservedCosts(maneuvers) {
    return maneuvers
        .filter((maneuver) => maneuver?.CostType && maneuver.CostType !== "null")
        .map((maneuver) => ({
            maneuverId: maneuver._id ?? maneuver.id ?? maneuver.name,
            costType: maneuver.CostType,
            costAmount: Number(maneuver.CostAmount ?? 0),
        }));
}

function summarizeEffectData(effect = {}) {
    return {
        addMainDice: Number(effect?.addMainDice ?? 0) || 0,
        addDisadvantage: Number(effect?.addDisadvantage ?? 0) || 0,
        addMultiplierDice: Number(effect?.addMultiplierDice ?? 0) || 0,
        addRiskDice: Number(effect?.addRiskDice ?? 0) || 0,
        addMoveSquares: Number(effect?.addMoveSquares ?? 0) || 0,
        safeAttack: Boolean(
            effect?.createFreeSafeAttack ||
            effect?.createSecondSafeAttack ||
            effect?.createFreeSafeCounterattack ||
            effect?.ifEscapeSucceedsCreateFreeSafeAttack
        ),
    };
}

function mergeModifierSummaries(baseSummary = {}, extraSummary = {}) {
    return {
        addMainDice: Number(baseSummary.addMainDice ?? 0) + Number(extraSummary.addMainDice ?? 0),
        addDisadvantage: Number(baseSummary.addDisadvantage ?? 0) + Number(extraSummary.addDisadvantage ?? 0),
        addMultiplierDice: Number(baseSummary.addMultiplierDice ?? 0) + Number(extraSummary.addMultiplierDice ?? 0),
        addRiskDice: Number(baseSummary.addRiskDice ?? 0) + Number(extraSummary.addRiskDice ?? 0),
        addMoveSquares: Number(baseSummary.addMoveSquares ?? 0) + Number(extraSummary.addMoveSquares ?? 0),
        safeAttack: Boolean(baseSummary.safeAttack || extraSummary.safeAttack),
    };
}
function mergeManeuverEffects(maneuvers) {
    return maneuvers.reduce(
        (summary, maneuver) => {
            const effect = maneuver?.effectData ?? {};
            summary.addMainDice += Number(effect.addMainDice ?? 0);
            summary.addDisadvantage += Number(effect.addDisadvantage ?? 0);
            summary.addMultiplierDice += Number(effect.addMultiplierDice ?? 0);
            summary.addRiskDice += Number(effect.addRiskDice ?? 0);
            summary.addMoveSquares += Number(effect.addMoveSquares ?? 0);
            summary.safeAttack = summary.safeAttack || createsSafeAttack(maneuver);
            return summary;
        },
        {
            addMainDice: 0,
            addDisadvantage: 0,
            addMultiplierDice: 0,
            addRiskDice: 0,
            addMoveSquares: 0,
            safeAttack: false,
        }
    );
}

function normalizeDefenseModifiers({ defenseReaction = null, damageTakenReaction = null } = {}) {
    const sources = [defenseReaction, damageTakenReaction].filter(Boolean);
    return sources.reduce((summary, source) => {
        const effect = source?.effectData ?? {};
        summary.addArmorDice += Number(effect.addArmorDice ?? 0) || 0;
        summary.reduceDamageTaken += Number(effect.reduceDamageTaken ?? 0) || 0;
        summary.lockParryingWeaponUntil = summary.lockParryingWeaponUntil || String(effect.lockParryingWeaponUntil ?? "").trim() || null;
        summary.safeCounterattack = summary.safeCounterattack || Boolean(effect.createFreeSafeCounterattack);
        return summary;
    }, {
        addArmorDice: 0,
        reduceDamageTaken: 0,
        lockParryingWeaponUntil: null,
        safeCounterattack: false,
    });
}
function normalizeAppliedAttackModifiers(modifiers = {}) {
    return {
        addMainDice: Number(modifiers?.addMainDice ?? 0) || 0,
        addDisadvantage: Number(modifiers?.addDisadvantage ?? 0) || 0,
        addMultiplierDice: Number(modifiers?.addMultiplierDice ?? 0) || 0,
        addRiskDice: Number(modifiers?.addRiskDice ?? 0) || 0,
        addMoveSquares: Number(modifiers?.addMoveSquares ?? 0) || 0,
        safeAttack: Boolean(modifiers?.safeAttack),
    };
}

function actorHasEquippedArmor(actor) {
    const items = actor?.items?.contents ?? actor?.items ?? [];
    return Array.from(items).some((item) => {
        const props = item?.system?.props ?? {};
        const sourceData = item?.flags?.[SOURCE_FLAG_SCOPE]?.sourceData ?? item?.flags?.[MODULE_ID]?.sourceData ?? {};
        const isArmor = sourceData?.itemType === "armor"
            || item?.system?.template === "uLlgZXz3GlXPFtsj"
            || item?.type === "armor"
            || Object.prototype.hasOwnProperty.call(props, "ArmorType")
            || Object.prototype.hasOwnProperty.call(props, "Defense");
        const equipped = isTruthyLike(props?.Equipped) || sourceData?.equipped === true;
        return isArmor && equipped;
    });
}

function buildDefaultDefenseRollSummary(pendingAttack) {
    const armor = buildDefaultUnprotectedArmor();
    const defenseDice = buildDefenderPool(Array.isArray(armor.defenseDice) ? armor.defenseDice : undefined);
    const evadeDice = defenseDice.filter((die) => String(die ?? "").trim().toLowerCase() === "evade").length;
    return {
        damage: 0,
        protection: evadeDice,
        crit: 0,
        fumble: 0,
        multiplier: 1,
        armorName: armor.name ?? "Unprotected",
        usedDefaultEvade: evadeDice > 0,
        evadeDice,
    };
}

function getActorCurrentHitPoints(actor) {
    const props = actor?.system?.props ?? {};
    return firstFiniteNumber([
        props?.CurrentHitPoints,
        props?.HitPoints,
        props?.HP,
        props?.CurrentHP,
    ]) ?? 0;
}

async function applyDamageToActorHitPoints(actor, damageApplied) {
    if (!actor?.update) {
        return {
            previousHitPoints: null,
            currentHitPoints: null,
        };
    }

    const previousHitPoints = getActorCurrentHitPoints(actor);
    const currentHitPoints = Math.max(0, previousHitPoints - Math.max(0, Number(damageApplied) || 0));
    await actor.update({
        "system.props.CurrentHitPoints": currentHitPoints,
    });
    await syncActorHitPointStates(actor, currentHitPoints);

    return {
        previousHitPoints,
        currentHitPoints,
    };
}

function getStatusEffectDefinitions(keyword) {
    const normalized = String(keyword ?? "").trim().toLowerCase();
    const configured = Array.isArray(CONFIG?.statusEffects) ? CONFIG.statusEffects : [];
    const matches = configured
        .filter((entry) => {
            const id = String(entry?.id ?? "").trim().toLowerCase();
            const name = String(entry?.name ?? entry?.label ?? "").trim().toLowerCase();
            return id === normalized || name.includes(normalized);
        })
        .filter((entry) => String(entry?.id ?? "").trim());
    if (matches.length) return matches;
    return [{ id: keyword, name: keyword, label: keyword }];
}

async function setActorStatusEffect(actor, keyword, active) {
    const definitions = getStatusEffectDefinitions(keyword);
    const existingEffects = Array.from(actor?.effects ?? []);
    const matchingEffectIds = existingEffects
        .filter((effect) => {
            const statuses = Array.isArray(effect?.statuses) ? effect.statuses : Array.from(effect?.statuses ?? []);
            const name = String(effect?.name ?? "").trim().toLowerCase();
            return definitions.some((entry) => statuses.includes(entry.id) || name === String(entry.name ?? entry.label ?? entry.id).trim().toLowerCase());
        })
        .map((effect) => effect.id)
        .filter(Boolean);

    if (!active) {
        if (matchingEffectIds.length && typeof actor?.deleteEmbeddedDocuments === "function") {
            await actor.deleteEmbeddedDocuments("ActiveEffect", matchingEffectIds);
        }
        return;
    }

    if (matchingEffectIds.length || typeof actor?.createEmbeddedDocuments !== "function") {
        return;
    }

    const definition = definitions[0];
    await actor.createEmbeddedDocuments("ActiveEffect", [{
        name: definition.name ?? definition.label ?? definition.id ?? keyword,
        img: definition.img ?? "icons/svg/aura.svg",
        statuses: [definition.id ?? keyword],
        disabled: false,
    }]);
}

async function syncActorHitPointStates(actor, currentHitPoints) {
    const safeHitPoints = Number(currentHitPoints ?? 0) || 0;
    const isDead = safeHitPoints <= 0;
    const isUnconscious = !isDead && safeHitPoints <= 1;

    await setActorStatusEffect(actor, "dead", isDead);
    await setActorStatusEffect(actor, "defeated", isDead);
    await setActorStatusEffect(actor, "unconscious", isUnconscious);

    const combatants = Array.from(game?.combat?.combatants ?? []).filter((combatant) => combatant?.actorId === actor?.id);
    for (const combatant of combatants) {
        if (combatant?.update) {
            await combatant.update({ defeated: isDead });
        }
    }
}
function normalizeRollSummary(roll) {
    const summary = roll ?? {};
    return {
        damage: Number(summary.damage ?? 0),
        protection: Number(summary.protection ?? 0),
        crit: Number(summary.crit ?? 0),
        fumble: Number(summary.fumble ?? 0),
        multiplier: Number(summary.multiplier ?? 1),
    };
}

function applyMultiplier(roll) {
    const multiplier = Number.isFinite(roll.multiplier) && roll.multiplier > 0
        ? roll.multiplier
        : 1;

    return {
        ...roll,
        damage: roll.damage * multiplier,
        protection: roll.protection * multiplier,
        crit: roll.crit * multiplier,
    };
}

function findReactionResolution(event) {
    return event?.results?.find(
        (entry) => entry?.value?.reaction || entry?.value?.trigger
    )?.value ?? null;
}

function isPendingAttack(value) {
    return value?.kind === PENDING_ATTACK_KIND;
}

function firstFiniteNumber(values) {
    for (const value of values) {
        const numeric = Number(value);
        if (Number.isFinite(numeric) && numeric >= 0) return numeric;
    }
    return null;
}

const ACTIVE_ATTACK_PROFILE_KEYS = ["Attack", "AttackB", "AttackC"];

function hasUsableRangeBands(rangeBands = {}) {
    return [rangeBands.shortRange, rangeBands.longRange, rangeBands.maxRange]
        .some((value) => Number.isFinite(Number(value)) && Number(value) > 0);
}

function inferWeaponAttackType(source = {}, props = {}, sourceProfile = null) {
    const explicitType = String(sourceProfile?.attackType ?? "").trim().toLowerCase();
    if (explicitType) return explicitType;

    const groups = Array.isArray(source?.groups) ? source.groups.map((entry) => String(entry ?? "").trim().toLowerCase()) : [];
    const category = String(source?.category ?? props?.WeaponType ?? "").trim().toLowerCase();
    const usesAmmo = isTruthyLike(props?.UsesAmmo) || source?.usesAmmo === true;

    if (category === "thrown" || groups.includes("thrownweapon")) return "thrown";
    if (usesAmmo || groups.includes("rangedweapon") || ["bow", "crossbow", "firearm"].includes(category)) return "ranged";
    return "melee";
}

function buildAttackProfilesFromWeaponProps(source = {}, props = {}) {
    const sourceProfiles = Array.isArray(source?.attackProfiles) ? source.attackProfiles : [];
    return ACTIVE_ATTACK_PROFILE_KEYS.map((key, index) => {
        const formula = String(props?.[key] ?? "").trim();
        if (!formula) return null;
        const sourceProfile = sourceProfiles[index] ?? null;
        const allowedAmmoText = String(props?.[key + "Ammo"] ?? "").trim();
        return {
            id: sourceProfile?.id ?? (index === 0 ? "default" : key.toLowerCase()),
            name: sourceProfile?.name ?? (index === 0 ? "Default" : "Alternative " + index),
            attackType: inferWeaponAttackType(source, props, sourceProfile),
            dice: Array.isArray(sourceProfile?.dice) ? [...sourceProfile.dice] : [],
            tags: Array.isArray(sourceProfile?.tags) ? [...sourceProfile.tags] : [],
            allowedAmmoTypes: Array.isArray(sourceProfile?.allowedAmmoTypes)
                ? [...sourceProfile.allowedAmmoTypes]
                : (allowedAmmoText ? allowedAmmoText.split(",").map((entry) => entry.trim()).filter(Boolean) : []),
            targetCount: Number(sourceProfile?.targetCount ?? 1) || 1,
        };
    }).filter(Boolean);
}






























