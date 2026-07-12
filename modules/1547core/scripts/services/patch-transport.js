/**
 * Patch transport (ADR-0004; amends ADR-0002's dispatcher location).
 *
 * The ONE place a Patch (the ADR-0002 discriminated union) becomes a Foundry
 * mutation, plus the write-authority routing that makes combat writes land on
 * a client that may perform them:
 *
 *   - applyPatch:   the CLOSED switch over patch kinds. New kinds require a
 *                    one-line addition here AND an update to ADR-0002's list.
 *   - authority:    the GM can write anything; a player only actors they own.
 *                    Patches a player can't apply are routed to the single
 *                    designated GM over the module socket (patch-apply), who
 *                    applies them and — for awaitRemote round-trips — acks
 *                    back (patch-ack) once the writes landed.
 *   - applyPatches: local-or-routed batch apply, preserving per-actor order.
 *
 * Domain-flavored patch kinds (actor.applyCondition, actor.statusEffect) are
 * NOT implemented here — the combat resolver injects their handlers via
 * configurePatchTransport at registration, keeping this module a transport
 * with zero domain imports.
 */

import { MODULE_ID } from "../lib/constants.mjs";

const PATCH_CHANNEL = `module.${MODULE_ID}`;
const PATCH_APPLY_TYPE = "patch-apply";
const PATCH_ACK_TYPE = "patch-ack";
const PATCH_ACK_TIMEOUT_MS = 5000;

let patchSocketBound = false;
// awaitRemote round-trips: ackId -> resolver that settles the awaiting promise.
const pendingPatchAcks = new Map();

// Injected domain handlers (see header). Missing handlers warn instead of
// crash so a partially-registered boot degrades loudly-but-safely.
let domainHandlers = {
    applyCondition: null,      // (actor, name, {inflictorId, ...options})
    setActorStatusEffect: null // (actor, keyword, active)
};

export function configurePatchTransport(handlers = {}) {
    domainHandlers = { ...domainHandlers, ...handlers };
}

// Resolve an actor by id, preferring a token-bound actor in the current scene.
// Unlinked tokens have a synthetic actor whose items differ from the world
// prototype's; updating game.actors.get(actorId).items there silently no-ops
// because the token's items aren't on the prototype. Linked tokens resolve to
// the same actor either way, so token-first is safe in both cases.
export function resolveActorById(actorId) {
    if (!actorId) return null;
    const tokenActor = globalThis.canvas?.tokens?.placeables?.find?.((token) => token?.actor?.id === actorId)?.actor;
    return tokenActor ?? globalThis.game?.actors?.get?.(actorId) ?? null;
}

export function resolveTokenById(tokenId, sceneId) {
    if (!tokenId) return null;
    const scene = sceneId ? globalThis.game?.scenes?.get?.(sceneId) : (globalThis.canvas?.scene ?? null);
    return scene?.tokens?.get?.(tokenId)
        ?? globalThis.canvas?.tokens?.get?.(tokenId)?.document
        ?? null;
}

// Runtime write tracer: `CONFIG.debug.combat1547 = true` in the console logs
// every actor.update patch with a post-write read-back — the fastest way to
// see whether a combat write (Core spend, movement, HP) actually landed on
// the actor the display reads.
function patchLog(...args) {
    if (!globalThis.CONFIG?.debug?.combat1547) return;
    try { console.debug(`${MODULE_ID} | patch-debug |`, ...args); } catch (_e) { /* ignore */ }
}

export async function applyPatch(patch) {
    if (!patch || !patch.kind) return;
    switch (patch.kind) {
        case "actor.update": {
            const actor = resolveActorById(patch.actorId);
            if (actor?.update) {
                await actor.update(patch.data);
                if (globalThis.CONFIG?.debug?.combat1547) {
                    const readBack = Object.fromEntries(Object.keys(patch.data).map((path) => [
                        path,
                        globalThis.foundry?.utils?.getProperty?.(actor, path),
                    ]));
                    patchLog("actor.update", actor.name, `(id ${patch.actorId})`, "wrote", patch.data, "read-back", readBack);
                }
            } else {
                patchLog("actor.update UNRESOLVED actor", patch.actorId, patch.data);
            }
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
            if (!actor) return;
            if (typeof domainHandlers.setActorStatusEffect !== "function") {
                console.warn(`${MODULE_ID} | patch-transport: no setActorStatusEffect handler configured`);
                return;
            }
            await domainHandlers.setActorStatusEffect(actor, patch.keyword, patch.active);
            return;
        }
        case "actor.applyCondition": {
            const actor = resolveActorById(patch.actorId);
            if (!actor || !patch.name) return;
            if (typeof domainHandlers.applyCondition !== "function") {
                console.warn(`${MODULE_ID} | patch-transport: no applyCondition handler configured`);
                return;
            }
            await domainHandlers.applyCondition(actor, patch.name, { inflictorId: patch.inflictorId ?? "", ...(patch.options ?? {}) });
            return;
        }
        case "token.update": {
            const token = resolveTokenById(patch.tokenId, patch.sceneId);
            if (token?.update) await token.update(patch.data ?? {}, patch.options ?? {});
            return;
        }
        case "combatant.update": {
            const combat = patch.combatId ? globalThis.game?.combats?.get?.(patch.combatId) : globalThis.game?.combat;
            const combatant = combat?.combatants?.get?.(patch.combatantId);
            if (combatant?.update) await combatant.update(patch.data ?? {});
            return;
        }
        default:
            console.warn(`${MODULE_ID} | applyPatch: unknown patch kind "${patch.kind}"`);
    }
}

/* ---- Patch authority (combat-architecture-evolution-spec, Move 1) -------- */

// The single GM that applies routed patches (avoids double-apply with >1 GM).
export function isDesignatedPatchGM() {
    const game = globalThis.game;
    if (!game?.user?.isGM) return false;
    const activeGM = game.users?.activeGM;
    if (activeGM) return activeGM.id === game.user.id;
    const gms = Array.from(game.users ?? [])
        .filter((u) => u.active && u.isGM)
        .sort((a, b) => String(a.id).localeCompare(String(b.id)));
    return !gms.length || gms[0].id === game.user.id;
}

export function canApplyPatchLocally(patch) {
    const game = globalThis.game;
    if (game?.user?.isGM) return true;
    if (patch?.kind === "combatant.update") return false; // the Combat doc is GM-only
    if (patch?.kind === "token.update") {
        const token = resolveTokenById(patch.tokenId, patch.sceneId);
        return !!token?.actor?.isOwner;
    }
    const actor = resolveActorById(patch?.actorId);
    return !!actor?.isOwner;
}

export function bindPatchSocket() {
    const game = globalThis.game;
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

export async function applyPatches(patches = [], { awaitRemote = false } = {}) {
    const game = globalThis.game;
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
        try { game?.socket?.emit(PATCH_CHANNEL, message); }
        catch (err) { console.error(`${MODULE_ID} | could not route patches to GM`, err); }
        return;
    }
    // awaitRemote: a later phase reads back the written state, so wait for the GM
    // to confirm the apply. A timeout backstop guarantees we never hang on an
    // absent/asleep GM — the resolution then proceeds as it would fire-and-forget.
    const ackId = globalThis.foundry.utils.randomID();
    message.ackId = ackId;
    message.fromUserId = game?.user?.id ?? null;
    await new Promise((resolve) => {
        let settled = false;
        const settle = () => { if (settled) return; settled = true; pendingPatchAcks.delete(ackId); resolve(); };
        pendingPatchAcks.set(ackId, settle);
        try { game?.socket?.emit(PATCH_CHANNEL, message); }
        catch (err) { console.error(`${MODULE_ID} | could not route patches to GM`, err); settle(); return; }
        setTimeout(settle, PATCH_ACK_TIMEOUT_MS);
    });
}
