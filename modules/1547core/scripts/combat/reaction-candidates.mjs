/**
 * combat/reaction-candidates.mjs
 *
 * Pure builders for the reaction-candidate lists that the orchestrator
 * attaches to PendingAttack and threat-zone events. The functions
 * here take pre-resolved live-doc descriptors (reactor, reactionWeapon,
 * reactionProfile, activePersistentEffects) so the module itself
 * doesn't reach back into Foundry singletons.
 *
 * Exports:
 *   resolveThreatReactionActor(threatPayload) -> actor | null
 *   buildOverwatchReactionCandidate({...}) -> candidate | null
 *   buildAttackReactionCandidates({...}) -> candidate[]
 *   buildThreatReactionCandidates({...}) -> candidate[]
 *
 * Calls into combat/maneuver-legality.mjs for the legal-maneuver list;
 * that module is itself pure.
 */

import { getLegalManeuvers } from "./maneuver-legality.mjs";

/**
 * Identify the actor that should be offered a reaction when something
 * enters their threat zone. Walks an ordered list of payload-supplied
 * candidates and falls back to `payload.actor` if it isn't the mover.
 */
export function resolveThreatReactionActor(threatPayload = {}) {
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

/**
 * Build the special "Overwatch Attack" reaction candidate, when the
 * reactor has an active overwatch persistent effect AND a ranged /
 * thrown reaction weapon with range >= distance.
 */
export function buildOverwatchReactionCandidate({
    reactor,
    mover,
    reactionWeapon,
    reactionProfile,
    threatPayload = {},
    activePersistentEffects = [],
} = {}) {
    if (!reactor || !mover) return null;

    const activeOverwatch = activePersistentEffects.find(
        (entry) => String(entry?.createsPersistentEffect ?? "").trim() === "overwatch"
    );
    if (!activeOverwatch) return null;
    if (!reactionWeapon || !reactionProfile) return null;

    const profileType = String(reactionProfile.attackType ?? "").trim().toLowerCase();
    if (!["ranged", "thrown"].includes(profileType)) return null;

    const distanceSquares = Number(threatPayload.distanceSquares ?? threatPayload.rangeSquares);
    if (Number.isFinite(distanceSquares)) {
        const maxRange = Number(reactionWeapon.maxRange);
        const withinMax = Number.isFinite(maxRange) ? distanceSquares <= maxRange : true;
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

/**
 * Would this reaction do literally nothing against the incoming attack? Today the
 * only case is an Evade-style maneuver whose sole effect is removing incoming
 * multiplier dice when the attack has none — offering it would just waste the
 * defender's reaction. Reactions with any other live effect are always kept.
 */
function reactionWouldDoNothing(candidate, { incomingMultiplierDice = null } = {}) {
    const effect = candidate?.effectData ?? {};
    const removesMultiplier = Number(effect.removeIncomingMultiplierDice ?? 0) || 0;
    if (removesMultiplier <= 0) return false;
    if (incomingMultiplierDice == null || Number(incomingMultiplierDice) > 0) return false;
    // Only suppress when removing multiplier dice is the candidate's sole effect.
    const otherLiveEffect = Object.entries(effect).some(([key, value]) =>
        key !== "removeIncomingMultiplierDice" && (value === true || (Number(value) || 0) !== 0)
    );
    return !otherLiveEffect;
}

/**
 * Reaction candidates a defender may take when an attack is declared
 * against them. No-op reactions for this attack are filtered out.
 */
export function buildAttackReactionCandidates({
    attacker,
    defender,
    pendingWeapon,
    pendingProfile,
    reactionWeapon,
    reactionProfile,
    context = {},
} = {}) {
    if (!defender) return [];

    const candidates = getLegalManeuvers({
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

    // Stamp the reactor (defender) and its target (attacker) on every candidate so
    // the relay can route the prompt to the reactor's owner deterministically,
    // rather than inferring it from whichever candidate happens to carry an actor.
    return candidates
        .filter((candidate) => !reactionWouldDoNothing(candidate, {
            incomingMultiplierDice: context.incomingMultiplierDice,
        }))
        .map((candidate) => ({ ...candidate, actor: defender, target: attacker }));
}

/**
 * The defender's always-on passive defense maneuvers (Shield, ...) when
 * an attack is declared against them. Returned as normalized maneuvers so
 * the caller can fold their effectData into the defense modifiers.
 *
 * Weapon-gated passives are STRICTLY gated (Shield requires a Shield-trait
 * weapon and passesWeaponGate fails closed when no weapon resolves), so the
 * caller must pass the defender's resolved reaction weapon/profile —
 * exactly as buildAttackReactionCandidates does for reactions.
 */
export function buildDefensePassiveManeuvers({
    defender,
    attacker,
    reactionWeapon,
    reactionProfile,
    context = {},
} = {}) {
    if (!defender) return [];
    return getLegalManeuvers({
        actor: defender,
        weapon: reactionWeapon,
        profile: reactionProfile,
        target: attacker,
        timingType: "passive",
        triggerType: "defending",
        distanceSquares: context.distanceSquares,
        rangeSquares: context.rangeSquares,
        actorConditions: context.targetConditions,
        targetConditions: context.actorConditions,
    });
}

/**
 * Reaction candidates the zone-owner may take when someone enters
 * their threat zone. Combines legal threat-reactions with the
 * overwatch candidate when applicable.
 */
export function buildThreatReactionCandidates({
    threatPayload = {},
    reactor,
    reactionWeapon,
    reactionProfile,
    activePersistentEffects = [],
} = {}) {
    if (!reactor) return [];

    const mover = threatPayload.mover ?? null;
    const distanceSquares = Number(threatPayload.distanceSquares ?? threatPayload.rangeSquares);

    // Stamp the reactor (zone owner) and its target (mover) on every candidate so
    // the relay routes deterministically to the reactor's owner (the overwatch
    // candidate already carries these).
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
    }).map((candidate) => ({ ...candidate, actor: reactor, target: mover }));

    const overwatchCandidate = buildOverwatchReactionCandidate({
        reactor,
        mover,
        reactionWeapon,
        reactionProfile,
        threatPayload,
        activePersistentEffects,
    });

    if (overwatchCandidate) candidates.push(overwatchCandidate);

    return candidates;
}
