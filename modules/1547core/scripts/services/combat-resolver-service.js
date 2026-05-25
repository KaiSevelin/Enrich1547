import { COMBAT_EVENTS, emitCombatEvent, onCombatEvent } from "./combat-events.js";
import { evaluateManeuverLegality, getLegalManeuvers } from "../combat/maneuver-legality.mjs";
import { buildDefenderPool } from "../combat/pool-builder.mjs";
import {
    normalizeManeuver,
    normalizeWeapon as normalizeWeaponPure,
    resolveSelectedWeaponProfile,
} from "../combat/normalisation.mjs";
import {
    getAllowedAmmoTypes,
    validateAmmoCompatibility,
    resolveLoadedAmmoForAttack,
    planLoadWeaponAmmo,
    planSpendLoadedAmmo,
    planConsumeLoadedAmmo,
} from "../combat/ammo-state.mjs";
import {
    getActivePersistentEffects as getActivePersistentEffectsPure,
    planConsumePersistentEffect,
} from "../combat/persistent-effects.mjs";
import {
    getActorCurrentHitPoints,
    planApplyDamage,
} from "../combat/hp-state.mjs";
import {
    resolveThreatReactionActor,
    buildOverwatchReactionCandidate,
    buildAttackReactionCandidates as buildAttackReactionCandidatesPure,
    buildThreatReactionCandidates as buildThreatReactionCandidatesPure,
} from "../combat/reaction-candidates.mjs";
import {
    buildCommittedManeuverRecord,
    planSpendActorManeuverCost,
    planAppendCommittedManeuverState,
} from "../combat/maneuver-state.mjs";
import {
    createsSafeAttack,
    summarizeEffectData,
    mergeModifierSummaries,
    mergeManeuverEffects,
    normalizeDefenseModifiers,
    normalizeAppliedAttackModifiers,
    collectReservedCosts,
    normalizeRollSummary,
    isPendingAttack,
    actorHasEquippedArmor,
    PENDING_ATTACK_KIND,
    buildPendingAttack as buildPendingAttackPure,
    buildPendingMove as buildPendingMovePure,
    planApplyDefenseFollowUpState,
    planCommitPostManeuver,
    planCommitFullTurnManeuver,
} from "../combat/attack-lifecycle.mjs";

const MODULE_ID = "1547core";
const SOURCE_FLAG_SCOPE = "1547Core";
// PENDING_ATTACK_KIND now lives in combat/attack-lifecycle.mjs and is re-imported above.
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

// Thin wrappers around the pure builders in combat/attack-lifecycle.mjs.
// The pure versions require two Foundry-side helpers as deps:
//   - normalizeWeapon (with unarmed-default fallback, defined below)
//   - buildAttackReactionCandidates (resolves reaction weapon via
//     getActorReactionWeapon, defined below)
export function buildPendingAttack(options = {}) {
    return buildPendingAttackPure({
        ...options,
        normalizeWeapon,
        buildAttackReactionCandidates,
    });
}

export function buildPendingMove(options = {}) {
    return buildPendingMovePure(options);
}


// ─── Persistent effects (thin wrappers around combat/persistent-effects.mjs) ──

export function getActivePersistentEffects(actor, options = {}) {
    return getActivePersistentEffectsPure(actor, options);
}

export async function consumePersistentEffect(actor, effectType) {
    const { patches, result } = planConsumePersistentEffect(actor, effectType);
    await applyPatches(patches);
    return result.consumed;
}
// Thin orchestrator wrapper. Pure compute → patches → events.
export async function commitFullTurnManeuver(options = {}) {
    const { patches, events, result } = planCommitFullTurnManeuver({
        ...options,
        normalizeWeapon,
    });
    await applyPatches(patches);
    let commitEvent = null;
    for (const evt of events) {
        commitEvent = await emitCombatEvent(evt.type, evt.payload);
    }
    return { ...result, commitEvent };
}

export async function commitPostManeuver(options = {}) {
    const { patches, events, result } = planCommitPostManeuver(options);
    await applyPatches(patches);
    let commitEvent = null;
    for (const evt of events) {
        commitEvent = await emitCombatEvent(evt.type, evt.payload);
    }
    return { ...result, commitEvent };
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
// ─── Reaction-candidate orchestrators ─────────────────────────────────────
//
// The pure builders in combat/reaction-candidates.mjs require pre-resolved
// reactionWeapon / reactionProfile / activePersistentEffects. These tiny
// wrappers do the Foundry-side resolution then delegate.

function buildThreatReactionCandidates(threatPayload = {}) {
    const reactor = resolveThreatReactionActor(threatPayload);
    if (!reactor) return [];
    const reactionWeapon = getActorReactionWeapon(reactor);
    const reactionProfile = resolveSelectedWeaponProfile(reactionWeapon, {});
    const activePersistentEffects = getActivePersistentEffects(reactor, {});
    return buildThreatReactionCandidatesPure({
        threatPayload,
        reactor,
        reactionWeapon,
        reactionProfile,
        activePersistentEffects,
    });
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
    return buildAttackReactionCandidatesPure({
        attacker,
        defender,
        pendingWeapon,
        pendingProfile,
        reactionWeapon,
        reactionProfile,
        context,
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

// Thin wrapper around planApplyDefenseFollowUpState (combat/attack-lifecycle.mjs).
// Preserves the original API: returns `{}` when nothing was locked,
// otherwise `{ lockedParryingWeaponUntil: <string> }`.
async function applyDefenseFollowUpState(pendingAttack, defenseModifiers) {
    const { patches, result } = planApplyDefenseFollowUpState(pendingAttack, defenseModifiers);
    if (!patches.length) return {};
    await applyPatches(patches);
    return { lockedParryingWeaponUntil: result.lockedParryingWeaponUntil ?? null };
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

// Thin wrappers around the patch-returners in combat/maneuver-state.mjs.
async function spendActorManeuverCost(actor, maneuver) {
    const { patches, result } = planSpendActorManeuverCost(actor, maneuver);
    await applyPatches(patches);
    return result;
}

async function appendCommittedManeuverState(actor, record) {
    const { patches } = planAppendCommittedManeuverState(actor, record);
    await applyPatches(patches);
}

// buildCommittedManeuverRecord moved to combat/maneuver-state.mjs
// appendCommittedManeuverState replaced by planAppendCommittedManeuverState + applyPatches at call sites
// Pure helpers (createsSafeAttack, collectReservedCosts, summarizeEffectData, mergeModifierSummaries,
//   mergeManeuverEffects, normalizeDefenseModifiers, normalizeAppliedAttackModifiers, actorHasEquippedArmor)
//   moved to combat/attack-lifecycle.mjs — all imported at the top of this file.

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

/**
 * Orchestrator wrapper: plan the HP+status patches, dispatch them,
 * then sync combatant.defeated (different document collection).
 */
async function applyDamageToActorHitPoints(actor, damageApplied) {
    const { patches, result } = planApplyDamage(actor, damageApplied);
    await applyPatches(patches);

    const combatants = Array.from(game?.combat?.combatants ?? [])
        .filter((combatant) => combatant?.actorId === actor?.id);
    for (const combatant of combatants) {
        if (combatant?.update) await combatant.update({ defeated: result.isDead });
    }

    return {
        previousHitPoints: result.previousHitPoints,
        currentHitPoints: result.currentHitPoints,
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

// firstFiniteNumber / hasUsableRangeBands / inferWeaponAttackType /
// buildAttackProfilesFromWeaponProps / ACTIVE_ATTACK_PROFILE_KEYS
// used to live here but are now in combat/normalisation.mjs. They
// were dead duplicates that lingered after the step-1 carve-up;
// combined with the new imports they cause a "already declared"
// SyntaxError under live module loading. Removed.






























