import { COMBAT_EVENTS, emitCombatEvent, onCombatEvent } from "./combat-events.js";
import { applyCondition, removeCondition, getActiveConditions, CONDITIONS } from "./condition-registry.js";
import { evaluateManeuverLegality, getLegalManeuvers } from "../combat/maneuver-legality.mjs";
import { buildDefenderPool, toFoundryFormula } from "../combat/pool-builder.mjs";
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
    buildDefensePassiveManeuvers,
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
import { planMarkReactionUsed, planMarkMovementReacted, isReactionAvailable } from "../combat/activation-state.mjs";
import { planSpendActorManeuverCost } from "../combat/maneuver-state.mjs";

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
    bindChokeHoldRoundAttacks();

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
            markReactionUsed,
            markMovementReacted,
            isReactionAvailable: (actor) => isReactionAvailable(actor, game.combat),
            getActorReactionWeapon,
            rotateTokenAuthoritative,
            spendLoadedAmmo,
            swapLoadedAmmo,
            commitFullTurnManeuver,
            commitPostManeuver,
            commitConditionEscapeManeuver,
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

// Commit a self-initiated escape maneuver: spend its stat-point cost and remove
// the condition it targets. The actor owns its own condition/pool, so writes apply
// locally (the dispatcher routes them to the GM otherwise).
export async function commitConditionEscapeManeuver(actor, maneuverSource) {
    if (!actor || !maneuverSource) return { ok: false };
    const { patches } = planSpendActorManeuverCost(actor, maneuverSource);
    if (patches.length) await applyPatches(patches);
    const removes = maneuverSource?.effectData?.removesCondition;
    if (removes) await removeCondition(actor, removes);
    try {
        const ChatMessageCls = globalThis.ChatMessage;
        await ChatMessageCls?.create?.({
            speaker: ChatMessageCls.getSpeaker({ actor }),
            content: `<strong>${foundry.utils.escapeHTML(String(maneuverSource.name ?? "Escape"))}</strong>`
                + `<br>${foundry.utils.escapeHTML(String(actor.name ?? "Combatant"))} breaks free of ${foundry.utils.escapeHTML(String(removes ?? "the hold"))}.`,
        });
    } catch (_err) { /* non-fatal */ }
    return { ok: true };
}

export async function commitPostManeuver(options = {}) {
    const { patches, events, result } = planCommitPostManeuver(options);
    await applyPatches(patches);
    let commitEvent = null;
    for (const evt of events) {
        commitEvent = await emitCombatEvent(evt.type, evt.payload);
    }
    // planCommitPostManeuver only spends the critical cost + logs the commit — the
    // maneuver's actual effect runs here, or it would silently do nothing.
    await applyPostManeuverEffect(options);
    return { ...result, commitEvent };
}

function postManeuverConditionName(effect = {}) {
    return String(effect.applyCondition ?? effect.upgradeCondition ?? "").trim();
}

function describePostManeuverEffect(effect = {}) {
    const parts = [];
    if (effect.createSecondSafeAttack || effect.createFreeSafeAttack) parts.push("Follow-up safe attack");
    const condition = postManeuverConditionName(effect);
    if (condition) parts.push(`Applies condition: <strong>${condition}</strong>`);
    if (Number(effect.addDisadvantage ?? 0) > 0) parts.push(`+${effect.addDisadvantage} disadvantage`);
    if (Number(effect.addDisadvantageToTargetAttack ?? 0) > 0) parts.push(`+${effect.addDisadvantageToTargetAttack} disadvantage to target's attacks`);
    if (Number(effect.addDisadvantageToTargetDefense ?? 0) > 0) parts.push(`+${effect.addDisadvantageToTargetDefense} disadvantage to target's defence`);
    if (Number(effect.addMainDice ?? 0) > 0) parts.push(`+${effect.addMainDice} main die`);
    if (Number(effect.addDamage ?? 0) > 0) parts.push(`+${effect.addDamage} damage`);
    const ongoing = String(effect.ongoingDamagePerTurn ?? "").trim();
    if (ongoing) parts.push(`Ongoing damage: ${ongoing}/turn (GM applies)`);
    if (effect.disarmWeapon) parts.push(`Disarm — drop ${Number(effect.placeDroppedWeaponSquares ?? 0) || 0} sq away (GM applies)`);
    if (Number(effect.pushTargetSquares ?? 0) > 0) parts.push(`Push ${effect.pushTargetSquares} sq ${String(effect.direction ?? "").replace(/-/g, " ")} (GM applies)`);
    if (effect.placeTargetAdjacent) parts.push("Place target adjacent (GM applies)");
    if (Number(effect.rotateTargetFacingSteps ?? 0) > 0) parts.push(`Rotate target facing ${effect.rotateTargetFacingSteps} step (GM applies)`);
    if (Array.isArray(effect.chooseOne) && effect.chooseOne.length) parts.push(`Choose one: ${effect.chooseOne.map((c) => String(c).replace(/-/g, " ")).join(" / ")} (GM applies)`);
    if (effect.swallowTarget) parts.push("Swallow target (GM applies)");
    return parts.join("; ");
}

// Run a committed post-maneuver's effect. A follow-up "safe attack" maneuver
// (e.g. Redouble) declares a fresh safe attack; every commit posts a chat card so
// the table sees it landed. Effects we don't auto-apply (statuses/tags) are named
// in the card for the GM to apply — manual economy.
async function applyPostManeuverEffect(options = {}) {
    const maneuver = options.maneuver ?? null;
    const effect = maneuver?.effectData ?? {};
    const actor = options.actor ?? null;
    const pendingAttack = options.pendingAttack ?? null;
    const target = options.target ?? pendingAttack?.target ?? null;
    const esc = (value) => foundry.utils.escapeHTML(String(value ?? ""));

    try {
        const ChatMessageCls = globalThis.ChatMessage;
        // detail is built from trusted maneuver effectData (not user input) and
        // contains light markup (<strong>), so it is intentionally not escaped.
        const detail = describePostManeuverEffect(effect);
        await ChatMessageCls?.create?.({
            speaker: ChatMessageCls.getSpeaker({ actor }),
            content: `<strong>Critical Maneuver — ${esc(maneuver?.name ?? "Maneuver")}</strong>`
                + `<br>${esc(actor?.name ?? "Combatant")}${target ? ` &rarr; ${esc(target.name ?? "target")}` : ""}`
                + (detail ? `<br>${detail}` : ""),
        });
    } catch (_err) { /* non-fatal */ }

    // Auto-apply the condition to the target (Lock -> locked, Throw -> prone,
    // Constrict -> grappled, Choke -> choking-hold). Routed through the patch
    // dispatcher so it lands even when the acting client can't write the target.
    const conditionName = postManeuverConditionName(effect);
    if (conditionName && target?.id) {
        try {
            // inflictorId = the attacker, so an opposed escape can roll against them.
            await applyPatches([{ kind: "actor.applyCondition", actorId: target.id, name: conditionName, inflictorId: actor?.id ?? "" }]);
        } catch (err) {
            console.error("1547core | post-maneuver condition apply failed", err);
        }
    }

    if ((effect.createSecondSafeAttack || effect.createFreeSafeAttack) && actor && target && pendingAttack?.profile) {
        try {
            await declareAttack({
                actor,
                target,
                targets: [target],
                weapon: pendingAttack.weapon?.itemDocument ?? pendingAttack.weapon,
                profile: pendingAttack.profile,
                forceSafeAttack: true,
                extraEffectData: effect,
                // Mark it generated so it doesn't itself open a reaction window.
                generatedByReaction: maneuver?.name ?? "post-maneuver",
            });
        } catch (err) {
            console.error("1547core | post-maneuver follow-up attack failed", err);
        }
    }
}

// ─── Effect runner per ADR-0003 ────────────────────────────────────────────
//
// Drives a phased function across patch + event boundaries. The
// phased function (in combat/lifecycle-flow.mjs) calls `runPhases`
// at each cancellable-event boundary; this implementation applies
// patches via the dispatcher, emits the event (if any), and returns
// the response. Throws propagate unchanged.

async function runPhases({ phase, patches = [], event = null, awaitRemote = false } = {}) {
    // A phase that reads document state back after this boundary passes
    // `awaitRemote: true` so routed (GM-applied) writes are confirmed first.
    if (patches.length) await applyPatches(patches, { awaitRemote });
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
    const declared = await executeResolvedReactionPhased(resolution, runPhases, {
        normalizeWeapon,
        buildAttackReactionCandidates,
    });
    // Threat reactions (overwatch / opportunity) declare a free attack here but
    // nothing rolls it — resolve it now so the shot deals damage. Scoped to the
    // threat-zone trigger so it never double-fires with the attack-side safe
    // counterattack (handled separately by the HUD flow).
    if (resolution?.trigger === "threat-zone" && declared?.pendingAttack && !declared.cancelled) {
        try { await resolveFreeAttack(declared.pendingAttack); }
        catch (err) { console.error(`${MODULE_ID} | resolveFreeAttack failed`, err); }
    }
    return declared;
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
        // One-reaction-per-turn budget (decision #9): drop the whole reaction
        // candidate list once the defender has spent its reaction this round.
        context: { ...context, reactionAvailable: isReactionAvailable(defender, game.combat) },
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
    // Gather the defender's always-on passive defense maneuvers (Shield, ...)
    // here, where the defender's equipped reaction weapon resolves — the
    // weapon gate needs it (Shield requires a Shield-trait weapon).
    const pendingAttack = options.pendingAttack ?? null;
    const defender = pendingAttack?.target ?? null;
    let defenderPassiveDefenseManeuvers = [];
    if (defender) {
        const reactionWeapon = getActorReactionWeapon(defender);
        defenderPassiveDefenseManeuvers = buildDefensePassiveManeuvers({
            defender,
            attacker: pendingAttack?.actor ?? null,
            reactionWeapon,
            reactionProfile: resolveSelectedWeaponProfile(reactionWeapon, {}),
            context: pendingAttack?.metadata ?? {},
        });
    }

    const result = await resolveAttackOutcomePhased({
        ...options,
        defenderPassiveDefenseManeuvers,
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
        // Route through the dispatcher — the Combat doc is GM-only, so a player
        // who killed an NPC can't write `defeated` directly (Move 1).
        const patches = Array.from(game?.combat?.combatants ?? [])
            .filter((c) => c?.actorId === targetActor.id && c?.id)
            .map((c) => ({ kind: "combatant.update", combatantId: c.id, combatId: game.combat?.id ?? null, data: { defeated: isDead } }));
        if (patches.length) await applyPatches(patches);
    }

    return result;
}

// Rotate a token through the patch dispatcher so a non-owner (e.g. a player whose
// attack provoked a GM NPC's Face) routes the write to the GM. Tagged
// `facingAutoFace` so the off-turn facing lock lets it through.
async function rotateTokenAuthoritative(tokenDoc, rotation) {
    const doc = tokenDoc?.document ?? tokenDoc;
    if (!doc?.id) return;
    await applyPatches([{
        kind: "token.update",
        tokenId: doc.id,
        sceneId: doc.parent?.id ?? null,
        data: { rotation: Number(rotation) || 0 },
        options: { facingAutoFace: true },
    }]);
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

function resolveTokenById(tokenId, sceneId) {
    if (!tokenId) return null;
    const scene = sceneId ? game.scenes?.get?.(sceneId) : (canvas?.scene ?? null);
    return scene?.tokens?.get?.(tokenId)
        ?? canvas?.tokens?.get?.(tokenId)?.document
        ?? null;
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
        case "actor.applyCondition": {
            const actor = resolveActorById(patch.actorId);
            if (actor && patch.name) await applyCondition(actor, patch.name, { inflictorId: patch.inflictorId ?? "", ...(patch.options ?? {}) });
            return;
        }
        case "token.update": {
            const token = resolveTokenById(patch.tokenId, patch.sceneId);
            if (token?.update) await token.update(patch.data ?? {}, patch.options ?? {});
            return;
        }
        case "combatant.update": {
            const combat = patch.combatId ? game.combats?.get?.(patch.combatId) : game.combat;
            const combatant = combat?.combatants?.get?.(patch.combatantId);
            if (combatant?.update) await combatant.update(patch.data ?? {});
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
const PATCH_ACK_TYPE = "patch-ack";
const PATCH_ACK_TIMEOUT_MS = 5000;
let patchSocketBound = false;
// awaitRemote round-trips: ackId -> resolver that settles the awaiting promise.
const pendingPatchAcks = new Map();

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
    if (patch?.kind === "combatant.update") return false; // the Combat doc is GM-only
    if (patch?.kind === "token.update") {
        const token = resolveTokenById(patch.tokenId, patch.sceneId);
        return !!token?.actor?.isOwner;
    }
    const actor = resolveActorById(patch?.actorId);
    return !!actor?.isOwner;
}

function bindPatchSocket() {
    if (patchSocketBound || !game?.socket) return;
    patchSocketBound = true;
    game.socket.on(PATCH_CHANNEL, (msg) => {
        if (!msg || typeof msg !== "object") return;
        // Requester side: the GM acked an awaited routed apply — settle the wait.
        if (msg.type === PATCH_ACK_TYPE) {
            if (msg.toUserId && msg.toUserId !== game.user?.id) return;
            const settle = pendingPatchAcks.get(msg.ackId);
            if (settle) settle();
            return;
        }
        if (msg.type !== PATCH_APPLY_TYPE || !isDesignatedPatchGM()) return;
        void (async () => {
            for (const patch of Array.isArray(msg.patches) ? msg.patches : []) {
                try { await applyPatch(patch); }
                catch (err) { console.error(`${MODULE_ID} | routed patch failed`, patch, err); }
            }
            // Only the awaitRemote path stamps an ackId — ack it back once the
            // routed writes have actually landed so the requester can read state.
            if (msg.ackId && msg.fromUserId) {
                try { game.socket?.emit(PATCH_CHANNEL, { type: PATCH_ACK_TYPE, ackId: msg.ackId, toUserId: msg.fromUserId }); }
                catch (err) { console.error(`${MODULE_ID} | could not ack routed patches`, err); }
            }
        })();
    });
}

// ── Choking Hold per-round attack ────────────────────────────────────────────
// While an actor is choked, the choker (the condition's inflictorId) makes a free
// unarmed attack on them at the start of each new round. GM-authoritative.
const CHOKE_SLUG = (value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
let chokeRoundHookBound = false;

function bindChokeHoldRoundAttacks() {
    if (chokeRoundHookBound || !globalThis.Hooks) return;
    chokeRoundHookBound = true;
    Hooks.on("updateCombat", (combat, changed) => {
        if (typeof changed?.round !== "number") return; // only on a round change
        if (!isDesignatedPatchGM()) return;             // one GM resolves it
        void runChokeHoldRoundAttacks(combat).catch((err) => console.error(`${MODULE_ID} | choke round attacks failed`, err));
    });
}

async function runChokeHoldRoundAttacks(combat) {
    const chokeNames = new Set(Object.keys(CONDITIONS).filter((n) => CONDITIONS[n]?.inflictorAttackEachRound).map(CHOKE_SLUG));
    if (!chokeNames.size) return;
    const combatants = combat?.combatants?.contents ?? combat?.turns ?? [];
    for (const combatant of combatants) {
        const victim = combatant?.actor;
        if (!victim || combatant?.defeated) continue;
        if (!getActiveConditions(victim).some((n) => CONDITIONS[n]?.inflictorAttackEachRound)) continue;
        const ae = (victim.effects?.contents ?? []).find((e) => !e.disabled && chokeNames.has(CHOKE_SLUG(e?.name)));
        const inflictor = resolveActorById(ae?.flags?.[MODULE_ID]?.inflictorId);
        if (!inflictor) continue;
        await declareChokeAttack(inflictor, victim);
    }
}

async function declareChokeAttack(inflictor, victim) {
    const weapon = normalizeWeapon(null, inflictor); // unarmed default
    const profile = (Array.isArray(weapon?.attackProfiles) ? weapon.attackProfiles[0] : null)
        ?? weapon?.activeAttackProfileData ?? null;
    if (!profile) return;
    try {
        await declareAttack({
            actor: inflictor,
            target: victim,
            targets: [victim],
            weapon,
            profile,
            forceSafeAttack: true,         // free, no reaction window
            generatedByReaction: "choking-hold",
        });
    } catch (err) {
        console.error(`${MODULE_ID} | choke round attack failed`, err);
    }
}

async function applyPatches(patches = [], { awaitRemote = false } = {}) {
    const list = Array.isArray(patches) ? patches.filter(Boolean) : [];
    const remote = [];
    for (const patch of list) {
        if (canApplyPatchLocally(patch)) await applyPatch(patch);
        else remote.push(patch); // preserves per-actor order (one actor's patches stay together)
    }
    if (!remote.length) return;
    // A player can't write actors they don't own (e.g. attacking a GM NPC) — hand
    // those patches to the designated GM. Default is fire-and-forget: combat reads
    // outcomes from the rolls, not the written docs, so it needn't await the apply.
    const message = { type: PATCH_APPLY_TYPE, patches: remote };
    if (!awaitRemote) {
        try { game.socket?.emit(PATCH_CHANNEL, message); }
        catch (err) { console.error(`${MODULE_ID} | could not route patches to GM`, err); }
        return;
    }
    // awaitRemote: a later phase reads back the written state, so wait for the GM
    // to confirm the apply. A timeout backstop guarantees we never hang on an
    // absent/asleep GM — the resolution then proceeds as it would fire-and-forget.
    const ackId = foundry.utils.randomID();
    message.ackId = ackId;
    message.fromUserId = game.user?.id ?? null;
    await new Promise((resolve) => {
        let settled = false;
        const settle = () => { if (settled) return; settled = true; pendingPatchAcks.delete(ackId); resolve(); };
        pendingPatchAcks.set(ackId, settle);
        try { game.socket?.emit(PATCH_CHANNEL, message); }
        catch (err) { console.error(`${MODULE_ID} | could not route patches to GM`, err); settle(); return; }
        setTimeout(settle, PATCH_ACK_TIMEOUT_MS);
    });
}

// Thin wrappers around the patch-returners in combat/maneuver-state.mjs.
async function spendActorManeuverCost(actor, maneuver) {
    const { patches, result } = planSpendActorManeuverCost(actor, maneuver);
    await applyPatches(patches);
    return result;
}

// Mark an actor's once-per-round reaction spent (combat-architecture Move 3).
// Routed to the GM via the patch dispatcher when the caller can't write the actor.
async function markReactionUsed(actor) {
    const { patches } = planMarkReactionUsed(actor, game.combat);
    if (patches.length) await applyPatches(patches);
}

// Mark a reactor's movement reaction against a specific mover spent this round.
async function markMovementReacted(reactor, mover) {
    const { patches } = planMarkMovementReacted(reactor, mover, game.combat);
    if (patches.length) await applyPatches(patches);
}

// Roll + resolve a free attack that was only *declared* (e.g. an overwatch /
// opportunity shot from a threat reaction; executeResolvedReactionPhased declares
// but doesn't resolve). Rolls the attacker's profile, the target's armour, then
// resolveAttackOutcome — writes route to the GM via the dispatcher.
async function rollPublicTotals(formula, speaker, flavor) {
    if (!formula) return null;
    const RollCls = globalThis.Roll;
    const roll = await new RollCls(formula).evaluate();
    const publicMode = globalThis.CONST?.DICE_ROLL_MODES?.PUBLIC ?? "publicroll";
    await roll.toMessage({ speaker, flavor }, { rollMode: publicMode });
    const computeRollTotals = game.modules.get(MODULE_ID)?.api?.computeRollTotals;
    return typeof computeRollTotals === "function" ? computeRollTotals([roll]) : null;
}

function actorDefenseFormula(actor) {
    const armor = (actor?.items?.contents ?? actor?.items ?? [])
        .map((item) => {
            const props = item?.system?.props ?? {};
            const sourceData = item?.flags?.["1547Core"]?.sourceData ?? item?.flags?.["1547core"]?.sourceData ?? {};
            const equipped = props.Equipped === true || Number(props.Equipped) === 1
                || String(props.Equipped ?? "").trim().toLowerCase() === "true" || sourceData?.equipped === true;
            if (!equipped) return null;
            const dice = Array.isArray(sourceData?.defenseDice)
                ? [...sourceData.defenseDice]
                : String(props.Defense ?? "").split(",").map((e) => e.trim()).filter(Boolean);
            return dice.length ? dice : null;
        })
        .filter(Boolean)[0] ?? buildDefenderPool(undefined);
    return toFoundryFormula(armor);
}

async function resolveFreeAttack(pendingAttack) {
    const attacker = pendingAttack?.actor ?? null;
    const target = pendingAttack?.target ?? null;
    if (!attacker || !target) return;
    const dice = Array.isArray(pendingAttack?.profile?.dice) ? pendingAttack.profile.dice : [];
    const formula = toFoundryFormula(dice);
    if (!formula) return;
    const ChatMessageCls = globalThis.ChatMessage;
    const aTok = attacker.getActiveTokens?.(true)?.[0] ?? null;
    const tTok = target.getActiveTokens?.(true)?.[0] ?? null;
    const speaker = ChatMessageCls.getSpeaker({ actor: attacker, token: aTok?.document });
    const attackRoll = await rollPublicTotals(formula, speaker, `Reaction Attack<br>${attacker.name ?? "Attacker"} -> ${target.name ?? "Target"}`);
    if (!attackRoll) return;
    const defenseRoll = await rollPublicTotals(actorDefenseFormula(target), ChatMessageCls.getSpeaker({ actor: target, token: tTok?.document }), `Defense<br>${target.name ?? "Target"}`);
    const resolved = await resolveAttackOutcome({ pendingAttack, attackRoll, defenseRoll });
    await ChatMessageCls.create({
        speaker,
        content: `<strong>Reaction Attack</strong><br>${attacker.name ?? "Attacker"} -> ${target.name ?? "Target"}<br>Damage: ${attackRoll.damage ?? 0}<br>Protection: ${defenseRoll?.protection ?? 0}<br>Applied: ${resolved?.damageApplied ?? 0}`,
    });
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






























