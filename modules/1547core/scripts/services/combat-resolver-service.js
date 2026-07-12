import { COMBAT_EVENTS, emitCombatEvent, onCombatEvent } from "./combat-events.js";
import { applyCondition, removeCondition, getActiveConditions, CONDITIONS, getConditionInflictorId, hasCondition } from "./condition-registry.js";
import { buildDefenderPool, toFoundryFormula } from "../combat/pool-builder.mjs";
import { MODULE_ID, SOURCE_FLAG_SCOPE } from "../lib/constants.mjs";
import {
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
    buildGuardAllyDefenseSources,
    buildShieldWallFormationSource,
} from "../combat/reaction-candidates.mjs";
import { buildFaceReactionCandidate } from "../combat/facing.mjs";
import {
    declareAttackPhased,
    declareMovementPhased,
    executeResolvedReactionPhased,
    executeSafeCounterattackPhased,
    resolveAttackOutcomePhased,
    resolveExchangePhased,
} from "../combat/lifecycle-flow.mjs";
import { rollToChat } from "../lib/roll-chat.mjs";
import { applyPostManeuverEffectPhased } from "../combat/post-maneuver-effects.mjs";
import { rollDefenseForActor } from "../combat/defense-roll.js";
import {
    configurePatchTransport,
    bindPatchSocket,
    applyPatches,
    isDesignatedPatchGM,
    resolveActorById,
} from "./patch-transport.js";
import {
    buildPendingAttack as buildPendingAttackPure,
    buildPendingMove as buildPendingMovePure,
    planCommitPostManeuver,
    planCommitFullTurnManeuver,
} from "../combat/attack-lifecycle.mjs";
import { planMarkReactionUsed, planMarkMovementReacted, isReactionAvailable } from "../combat/activation-state.mjs";
import { planSpendActorManeuverCost, planAppendCommittedManeuverState, buildCommittedManeuverRecord } from "../combat/maneuver-state.mjs";
import { planEscapeConditions, statCheckFormula, escapeSucceeds } from "../combat/escape-state.mjs";
import { planApplyDamage } from "../combat/hp-state.mjs";

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

    // The transport is domain-free; the combat resolver owns the two
    // domain-flavored patch kinds and injects their handlers here (ADR-0004).
    configurePatchTransport({ applyCondition, setActorStatusEffect });
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
            resolveExchange,
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
            spendActorManeuverCost,
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
    const effect = maneuverSource?.effectData ?? {};
    const ChatMessageCls = globalThis.ChatMessage;
    const speaker = ChatMessageCls?.getSpeaker?.({ actor }) ?? {};
    const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));

    // Spend the cost (Core Escape spends CorePoints; the free escapes cost nothing).
    const { patches: costPatches } = planSpendActorManeuverCost(actor, maneuverSource);
    if (costPatches.length) await applyPatches(costPatches);

    // --- Opposed-check escapes (Break Grapple / Slip The Lock / Break The Choke) ---
    // Roll the escaper's stat against the condition's inflictor; break free on a
    // tie or better. The inflictor was recorded when the condition was applied.
    if (effect.opposedCheck) {
        const stat = String(effect.opposedCheck);
        const condition = (Array.isArray(effect.removesCondition) ? effect.removesCondition[0] : effect.removesCondition) ?? "";
        const inflictorId = getConditionInflictorId(actor, condition);
        const inflictor = inflictorId ? (game.actors?.get?.(inflictorId) ?? null) : null;

        const RollCls = globalThis.Roll;
        const escaperRoll = await new RollCls(statCheckFormula(actor.system?.props ?? {}, stat)).evaluate();
        const inflictorRoll = inflictor
            ? await new RollCls(statCheckFormula(inflictor.system?.props ?? {}, stat)).evaluate()
            : null;
        const success = escapeSucceeds(escaperRoll.total, inflictorRoll?.total ?? null);

        if (success) await removeCondition(actor, condition);

        // Grapple Break: a successful break grants advantage on the next attack.
        let grappleBreakNote = "";
        if (success && actorKnowsManeuver(actor, "Grapple Break")) {
            await grantGrappleBreakAdvantage(actor);
            grappleBreakNote = "<br><em>Grapple Break: advantage on next attack.</em>";
        }

        const vs = inflictor
            ? `${esc(actor.name)} ${escaperRoll.total} vs ${esc(inflictor.name)} ${inflictorRoll.total}`
            : `${esc(actor.name)} ${escaperRoll.total} (uncontested)`;
        try {
            await ChatMessageCls?.create?.({
                speaker,
                content: `<strong>${esc(maneuverSource.name ?? "Escape")}</strong> — ${esc(stat)} check`
                    + `<br>${vs}`
                    + `<br>${success ? `Breaks free of ${esc(condition)}.` : `Fails to break free of ${esc(condition)}.`}`
                    + grappleBreakNote,
            });
        } catch (_err) { /* non-fatal */ }
        return { ok: true, success, removed: success ? [condition] : [] };
    }

    // --- Guaranteed removals (Core Escape clears every held condition; Stand Up) ---
    const toRemove = planEscapeConditions(effect, (name) => hasCondition(actor, name));
    for (const name of toRemove) await removeCondition(actor, name);
    try {
        const freed = toRemove.length ? toRemove.map(esc).join(", ") : esc("the hold");
        await ChatMessageCls?.create?.({
            speaker,
            content: `<strong>${esc(maneuverSource.name ?? "Escape")}</strong>`
                + `<br>${esc(actor.name ?? "Combatant")} breaks free of ${freed}.`,
        });
    } catch (_err) { /* non-fatal */ }
    return { ok: true, removed: toRemove };
}

function actorKnowsManeuver(actor, name) {
    const items = actor?.items?.contents ?? actor?.items ?? [];
    const want = String(name ?? "").trim().toLowerCase();
    return items.some((i) => String(i?.name ?? "").trim().toLowerCase() === want);
}

function getTokenCenter(token) {
    if (token?.center && Number.isFinite(Number(token.center.x))) {
        return { x: Number(token.center.x), y: Number(token.center.y) };
    }
    const doc = token?.document ?? token ?? {};
    const size = globalThis.canvas?.grid?.size ?? 100;
    return {
        x: Number(doc.x ?? 0) + (Number(doc.width ?? 1) * size) / 2,
        y: Number(doc.y ?? 0) + (Number(doc.height ?? 1) * size) / 2,
    };
}

function chebyshevSquares(a, b) {
    const size = globalThis.canvas?.grid?.size ?? 100;
    const ca = getTokenCenter(a);
    const cb = getTokenCenter(b);
    return Math.max(Math.abs((cb.x - ca.x) / size), Math.abs((cb.y - ca.y) / size));
}

// Same-side (same disposition) actors within one square of the defender.
function getAdjacentAllies(defender) {
    const dToken = defender?.getActiveTokens?.(true)?.[0] ?? null;
    if (!dToken) return [];
    const disposition = Number(dToken.document?.disposition);
    const placeables = globalThis.canvas?.tokens?.placeables ?? [];
    const seen = new Set();
    const allies = [];
    for (const t of placeables) {
        const actor = t?.actor;
        if (!actor || actor.id === defender.id || seen.has(actor.id)) continue;
        if (Number(t.document?.disposition) !== disposition) continue;
        if (chebyshevSquares(dToken, t) > 1) continue;
        seen.add(actor.id);
        allies.push(actor);
    }
    return allies;
}

async function grantGrappleBreakAdvantage(actor) {
    const record = {
        id: "grapple-break-advantage",
        name: "Grapple Break",
        type: "reaction",
        triggerType: "escape-succeeded",
        committedAt: Date.now(),
        duration: "until-next-attack",
        createsPersistentEffect: "grapple-break-advantage",
        effectData: { grantAdvantageNextLegalAttack: true, advantageOnNextAttack: 1 },
    };
    const { patches } = planAppendCommittedManeuverState(actor, record);
    if (patches.length) await applyPatches(patches);
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

// Post-maneuver effect interpreter moved to combat/post-maneuver-effects.mjs
// (ADR-0004). This wrapper binds the phased runner + Foundry-glue deps.
async function applyPostManeuverEffect(options = {}) {
    return applyPostManeuverEffectPhased(options, runPhases, {
        postCard: async (actor, content) => {
            const CM = globalThis.ChatMessage;
            await CM?.create?.({ speaker: CM.getSpeaker({ actor }), content });
        },
        applyDamageAwaited: async (target, amount) => {
            const { patches, result } = planApplyDamage(target, amount);
            if (patches.length) await applyPatches(patches, { awaitRemote: true });
            return result;
        },
        declareAttack,
        getActorActiveTokenDocument,
        gridSize: () => Number(globalThis.canvas?.grid?.size) || 100,
        buildCollisionTester: (tokenDoc) => {
            const placeable = tokenDoc?.object ?? null;
            if (!placeable?.checkCollision) return null;
            return (fromCenter, toCenter) => {
                try {
                    return placeable.checkCollision(toCenter, { origin: fromCenter, type: "move", mode: "any" }) ?? false;
                } catch (_e) { return true; }
            };
        },
    });
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

// Multi-target is deferred (ruling 2026-07-11): single-target is the only
// supported mode — reactions, crits and damage windows are all specified
// per one defender. Clamp an API caller's extra targets to the first.
function clampToSingleTarget(options = {}) {
    let { target, targets } = options;
    if (!Array.isArray(targets) || targets.length <= 1) return options;
    ui?.notifications?.warn?.("Multi-target attacks are not supported yet — resolving against the first target only.");
    targets = targets.slice(0, 1);
    target = target ?? targets[0];
    return { ...options, target, targets };
}

export async function declareAttack(options = {}) {
    return declareAttackPhased({
        ...clampToSingleTarget(options),
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

// The Exchange pipeline (ADR-0004): binds the phased skeleton to the live
// runner + Foundry-glue deps. Callers supply mode/declare/buildAttackRoll/card;
// everything Foundry-shaped is injected here, exactly once.
export async function resolveExchange(options = {}) {
    return resolveExchangePhased({
        ...options,
        declare: options.mode === "weapon" && options.declare ? clampToSingleTarget(options.declare) : options.declare,
        deps: {
            rollToChat,
            rollDefenseForActor,
            resolveOutcome: resolveAttackOutcome,
            postChat: (message) => globalThis.ChatMessage?.create?.(message),
            normalizeWeapon,
            buildAttackReactionCandidates,
            getActorReactionWeapon,
            ...(options.deps ?? {}),
        },
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

        // Cross-actor: adjacent same-side allies extend Guard Ally armor to the
        // defender, and an adjacent Shield Wall ally enables the defender's
        // Shield Wall formation bonus.
        const allies = getAdjacentAllies(defender);
        let hasAdjacentShieldWallAlly = false;
        for (const ally of allies) {
            const aw = getActorReactionWeapon(ally);
            const guard = buildGuardAllyDefenseSources({
                ally,
                defender,
                reactionWeapon: aw,
                reactionProfile: resolveSelectedWeaponProfile(aw, {}),
            });
            if (guard.length) defenderPassiveDefenseManeuvers = [...defenderPassiveDefenseManeuvers, ...guard];
            if (actorKnowsManeuver(ally, "Shield Wall")) hasAdjacentShieldWallAlly = true;
        }
        const formation = buildShieldWallFormationSource(defenderPassiveDefenseManeuvers, hasAdjacentShieldWallAlly);
        if (formation.length) defenderPassiveDefenseManeuvers = [...defenderPassiveDefenseManeuvers, ...formation];
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
        attackDamage,
        attackProtection,
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
                attackDamage,
                attackProtection,
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
// The applyPatch dispatcher, GM patch authority and socket routing live in
// services/patch-transport.js (ADR-0004; amends ADR-0002's location note).
// The two domain-flavored patch kinds (actor.applyCondition,
// actor.statusEffect) are injected there at registration — see
// configurePatchTransport in registerCombatResolverService.

// The actor's token document on the active scene (linked first, then any).
function getActorActiveTokenDocument(actorLike) {
    const tokens = actorLike?.getActiveTokens?.(true) ?? [];
    const fallback = tokens.length ? tokens : (actorLike?.getActiveTokens?.() ?? []);
    return fallback[0]?.document ?? null;
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
// but doesn't resolve). One Exchange pipeline call in "free-shot" mode — the
// roll-and-card path and the defense roll come from the shared deps (ADR-0004).
async function resolveFreeAttack(pendingAttack) {
    const attacker = pendingAttack?.actor ?? null;
    const target = pendingAttack?.target ?? null;
    if (!attacker || !target) return;
    const formula = toFoundryFormula(Array.isArray(pendingAttack?.profile?.dice) ? pendingAttack.profile.dice : []);
    if (!formula) return;
    const ChatMessageCls = globalThis.ChatMessage;
    const attackerToken = attacker.getActiveTokens?.(true)?.[0] ?? null;
    await resolveExchange({
        mode: "free-shot",
        pendingAttack,
        buildAttackRoll: () => ({
            formula,
            speaker: ChatMessageCls.getSpeaker({ actor: attacker, token: attackerToken?.document }),
            flavor: `Reaction Attack<br>${attacker.name ?? "Attacker"} -> ${target.name ?? "Target"}`,
        }),
        card: { title: "Reaction Attack" },
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






























