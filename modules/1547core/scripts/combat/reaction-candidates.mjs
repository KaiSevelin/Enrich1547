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
 * Reaction candidates a defender may take when an attack is declared
 * against them.
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
        activePersistentEffects,
    });

    if (overwatchCandidate) candidates.push(overwatchCandidate);

    return candidates;
}
