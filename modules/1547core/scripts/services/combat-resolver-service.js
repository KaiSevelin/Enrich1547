import { COMBAT_EVENTS, emitCombatEvent, onCombatEvent } from "./combat-events.js";
import { evaluateManeuverLegality, getLegalManeuvers } from "../combat/maneuver-legality.mjs";
import { buildDefenderPool } from "../combat/pool-builder.mjs";
import { MODULE_ID, SOURCE_FLAG_SCOPE } from "../lib/constants.mjs";
import {
    normalizeManeuver,
    normalizeWeapon as normalizeWeaponPure,
    resolveSelectedWeaponProfile,
} from "../combat/normalisation.mjs";
import {
    planLoadWeaponAmmo,
    planSpendLoadedAmmo,
} from "../combat/ammo-state.mjs";
import {
    getActivePersistentEffects as getActivePersistentEffectsPure,
    planConsumePersistentEffect,
} from "../combat/persistent-effects.mjs";
import {
    resolveThreatReactionActor,
    buildAttackReactionCandidates as buildAttackReactionCandidatesPure,
    buildThreatReactionCandidates as buildThreatReactionCandidatesPure,
} from "../combat/reaction-candidates.mjs";
import { buildFaceReactionCandidate } from "../combat/facing.mjs";
import {
    declareAttackPhased,
    declareMovementPhased,
    executeResolvedReactionPhased,
    executeSafeCounterattackPhased,
    resolveAttackOutcomePhased,
} from "../combat/lifecycle-flow.mjs";
import {
    buildPendingAttack as buildPendingAttackPure,
    buildPendingMove as buildPendingMovePure,
    planCommitPostManeuver,
    planCommitFullTurnManeuver,
} from "../combat/attack-lifecycle.mjs";

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

    bindPatchSocket();

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

// ─── Effect runner per ADR-0003 ────────────────────────────────────────────
//
// Drives a phased function across patch + event boundaries. The
// phased function (in combat/lifecycle-flow.mjs) calls `runPhases`
// at each cancellable-event boundary; this implementation applies
// patches via the dispatcher, emits the event (if any), and returns
// the response. Throws propagate unchanged.

async function runPhases({ phase, patches = [], event = null } = {}) {
    if (patches.length) await applyPatches(patches);
    if (!event) return {};
    const response = await emitCombatEvent(event.type, event.payload);
    return { response };
}

// Thin orchestrator wrappers binding the runner + Foundry-glue deps.
// Public API shape preserved exactly.

export async function declareAttack(options = {}) {
    return declareAttackPhased({
        ...options,
        normalizeWeapon,
        buildAttackReactionCandidates,
    }, runPhases);
}

export async function declareMovement(options = {}) {
    return declareMovementPhased({
        ...options,
        buildThreatReactionCandidates,
    }, runPhases);
}

async function executeResolvedReaction(resolution) {
    return executeResolvedReactionPhased(resolution, runPhases, {
        normalizeWeapon,
        buildAttackReactionCandidates,
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
    const candidates = buildAttackReactionCandidatesPure({
        attacker,
        defender,
        pendingWeapon,
        pendingProfile,
        reactionWeapon,
        reactionProfile,
        context,
    });
    // Offer "Face attacker" when the incoming shot is a faceable rear hit
    // (facing spec rule 3). positionAdvantage is threaded from the HUD.
    if (context?.positionAdvantage?.faceable) {
        const face = buildFaceReactionCandidate(defender, attacker);
        if (face) return [face, ...candidates];
    }
    return candidates;
}


// createPostManeuverWindowPayload moved into resolveAttackOutcomePhased
// (data half) + decoratePostManeuverWindow below (closure half).
// applyDefenseFollowUpState absorbed into resolveAttackOutcomePhased.

export async function executeSafeCounterattack(options = {}) {
    return executeSafeCounterattackPhased({
        ...options,
        getActorReactionWeapon,
        normalizeWeapon,
        buildAttackReactionCandidates,
    }, runPhases);
}
export async function resolveAttackOutcome(options = {}) {
    const result = await resolveAttackOutcomePhased({
        ...options,
        buildDefaultDefenseRollSummary,
    }, runPhases);

    // Decorate the data-only post-window payloads with the closure
    // callbacks the HUD consumer expects. The phased function returns
    // these as plain data so it stays pure of orchestrator concerns.
    result.pendingPostManeuverWindows = result.pendingPostManeuverWindows.map(decoratePostManeuverWindow);

    // Sync combatant.defeated separately — it's not a patch kind, and
    // a combatant lives on game.combat, not on the actor. The phased
    // function surfaces hitPointUpdate.isDead so we know what to set.
    const isDead = result.hitPointUpdate?.isDead === true;
    const targetActor = result.pendingAttack?.target ?? null;
    if (targetActor?.id) {
        const combatants = Array.from(game?.combat?.combatants ?? [])
            .filter((c) => c?.actorId === targetActor.id);
        for (const combatant of combatants) {
            if (combatant?.update) await combatant.update({ defeated: isDead });
        }
    }

    return result;
}

function decoratePostManeuverWindow(window) {
    const {
        side,
        actor,
        target,
        pendingAttack,
        currentCriticalPoints,
        actorConditions,
        targetConditions,
    } = window;
    return {
        ...window,
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
 * Replaced by planConsumeLoadedAmmo called directly from the phased
 * functions in combat/lifecycle-flow.mjs.
 */

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

// Resolve an actor by id, preferring a token-bound actor in the current scene.
// Unlinked tokens have a synthetic actor whose items differ from the world
// prototype's; updating game.actors.get(actorId).items there silently no-ops
// because the token's items aren't on the prototype. Linked tokens resolve to
// the same actor either way, so token-first is safe in both cases.
function resolveActorById(actorId) {
    if (!actorId) return null;
    const tokenActor = canvas?.tokens?.placeables?.find?.((token) => token?.actor?.id === actorId)?.actor;
    return tokenActor ?? game.actors?.get?.(actorId) ?? null;
}

async function applyPatch(patch) {
    if (!patch || !patch.kind) return;
    switch (patch.kind) {
        case "actor.update": {
            const actor = resolveActorById(patch.actorId);
            if (actor?.update) await actor.update(patch.data);
            return;
        }
        case "item.update": {
            const actor = resolveActorById(patch.actorId);
            const item = actor?.items?.get?.(patch.itemId);
            if (item?.update) await item.update(patch.data);
            return;
        }
        case "item.delete": {
            const actor = resolveActorById(patch.actorId);
            const ids = Array.isArray(patch.itemIds) ? patch.itemIds : (patch.itemId ? [patch.itemId] : []);
            const existingIds = ids.filter((id) => actor?.items?.get?.(id));
            if (actor?.deleteEmbeddedDocuments && existingIds.length) {
                await actor.deleteEmbeddedDocuments("Item", existingIds);
            }
            return;
        }
        case "actor.setFlag": {
            const actor = resolveActorById(patch.actorId);
            if (actor?.setFlag) await actor.setFlag(patch.scope, patch.key, patch.value);
            return;
        }
        case "actor.statusEffect": {
            const actor = resolveActorById(patch.actorId);
            if (actor) await setActorStatusEffect(actor, patch.keyword, patch.active);
            return;
        }
        default:
            console.warn(`${MODULE_ID} | applyPatch: unknown patch kind "${patch.kind}"`);
    }
}

/* ---- Patch authority (combat-architecture-evolution-spec, Move 1) -------- */
// Combat resolution runs on whoever is acting (often the GM, but a player when
// they attack). Writes must land on a client that can write the target. The GM
// can write anything; a player can write only actors they own. Patches a player
// can't apply are routed to the designated GM over the socket, who applies them.
const PATCH_CHANNEL = `module.${MODULE_ID}`;
const PATCH_APPLY_TYPE = "patch-apply";
let patchSocketBound = false;

// The single GM that applies routed patches (avoids double-apply with >1 GM).
function isDesignatedPatchGM() {
    if (!game.user?.isGM) return false;
    const activeGM = game.users?.activeGM;
    if (activeGM) return activeGM.id === game.user.id;
    const gms = Array.from(game.users ?? [])
        .filter((u) => u.active && u.isGM)
        .sort((a, b) => String(a.id).localeCompare(String(b.id)));
    return !gms.length || gms[0].id === game.user.id;
}

function canApplyPatchLocally(patch) {
    if (game.user?.isGM) return true;
    const actor = resolveActorById(patch?.actorId);
    return !!actor?.isOwner;
}

function bindPatchSocket() {
    if (patchSocketBound || !game?.socket) return;
    patchSocketBound = true;
    game.socket.on(PATCH_CHANNEL, (msg) => {
        if (msg?.type !== PATCH_APPLY_TYPE || !isDesignatedPatchGM()) return;
        void (async () => {
            for (const patch of Array.isArray(msg.patches) ? msg.patches : []) {
                try { await applyPatch(patch); }
                catch (err) { console.error(`${MODULE_ID} | routed patch failed`, patch, err); }
            }
        })();
    });
}

async function applyPatches(patches = []) {
    const list = Array.isArray(patches) ? patches.filter(Boolean) : [];
    const remote = [];
    for (const patch of list) {
        if (canApplyPatchLocally(patch)) await applyPatch(patch);
        else remote.push(patch); // preserves per-actor order (one actor's patches stay together)
    }
    // A player can't write actors they don't own (e.g. attacking a GM NPC) — hand
    // those patches to the GM. Fire-and-forget: combat reads outcomes from the
    // rolls, not the written docs, so it needn't await the remote apply.
    if (remote.length) {
        try { game.socket?.emit(PATCH_CHANNEL, { type: PATCH_APPLY_TYPE, patches: remote }); }
        catch (err) { console.error(`${MODULE_ID} | could not route patches to GM`, err); }
    }
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

// applyDamageToActorHitPoints absorbed into resolveAttackOutcomePhased.
// The combatant.defeated sync (different doc collection from the patch
// dispatcher) now lives in the orchestrator's resolveAttackOutcome
// wrapper, fed by hitPointUpdate.isDead returned from the phased fn.

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

// applyMultiplier + findReactionResolution moved to combat/attack-lifecycle.mjs.

// firstFiniteNumber / hasUsableRangeBands / inferWeaponAttackType /
// buildAttackProfilesFromWeaponProps / ACTIVE_ATTACK_PROFILE_KEYS
// used to live here but are now in combat/normalisation.mjs. They
// were dead duplicates that lingered after the step-1 carve-up;
// combined with the new imports they cause a "already declared"
// SyntaxError under live module loading. Removed.






























