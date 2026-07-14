/**
 * Equipped-effects service.
 *
 * Generic, item-agnostic mechanism: while an item is equipped, its Self-targeted
 * persistent effects (ApplicationMode "CreateActiveEffect") are mirrored onto the
 * wearer as *managed* ActiveEffects; unequip or delete the item and they are
 * removed. This reuses the same effect model as spells/marks/monster-magic
 * (`collectUsageEffectsFromCarrier` + `buildManagedActiveEffectData`), so any
 * equippable — armour, an amulet like the Nazar, a ring — can grant an immunity,
 * resistance, or condition simply by carrying a usage-effect child. Nothing here
 * is specific to Evil Eye.
 *
 * Modelled on changeset-cascade-service: hook-driven, reconciles actor state.
 * Only one client mutates (active GM, else the primary active owner) to avoid
 * duplicate application across clients.
 */

import { MODULE_ID } from "../lib/constants.mjs";
import { isTruthyLike } from "../combat/normalisation.mjs";
import {
    collectUsageEffectsFromCarrier,
    isSupportedCarrierItem,
    buildManagedActiveEffectData,
} from "./usage-effect-action-resolver.js";

const EQUIPPED_EFFECT_FLAG = "equippedEffect";
const EQUIPPED_KEY_FLAG = "equippedKey";

// A Self-targeted persistent effect is the only kind that makes sense to apply
// passively while worn — one-shot payloads (HP deltas, table rolls) must NOT be
// re-run on every reconcile.
function isEquipApplicableEffect(effect) {
    return /^self$/i.test(String(effect?.TargetType ?? ""))
        && /^createactiveeffect$/i.test(String(effect?.ApplicationMode ?? ""));
}

function isEquipped(item) {
    return isTruthyLike(item?.system?.props?.Equipped);
}

// Single-writer guard: the active GM if there is one, otherwise the lowest-id
// active owner of this actor. Prevents every client from creating duplicates.
function isResponsibleForActor(actor) {
    const game = globalThis.game;
    const activeGM = game?.users?.activeGM;
    if (activeGM) return !!game.user?.isGM && activeGM.id === game.user.id;
    if (game?.user?.isGM) return true;
    if (!actor?.isOwner) return false;
    const owners = Array.from(game?.users ?? [])
        .filter((u) => u.active && actor.testUserPermission?.(u, "OWNER"))
        .sort((a, b) => String(a.id).localeCompare(String(b.id)));
    return owners[0]?.id === game?.user?.id;
}

function desiredEquippedEffects(actor) {
    const desired = [];
    const items = actor?.items?.contents ?? actor?.items ?? [];
    for (const item of items) {
        if (!isEquipped(item) || !isSupportedCarrierItem(item)) continue;
        const effects = collectUsageEffectsFromCarrier(item).filter(isEquipApplicableEffect);
        effects.forEach((effect, index) => {
            const key = `${item.id}:${index}`;
            const data = buildManagedActiveEffectData(item, effect, actor, "equipped");
            foundry.utils.setProperty(data, `flags.${MODULE_ID}.${EQUIPPED_EFFECT_FLAG}`, true);
            foundry.utils.setProperty(data, `flags.${MODULE_ID}.${EQUIPPED_KEY_FLAG}`, key);
            desired.push({ key, data });
        });
    }
    return desired;
}

/**
 * Reconcile an actor's managed equipped-effect ActiveEffects to match its
 * currently-equipped carrier items. Idempotent; safe to call repeatedly.
 */
export async function syncActorEquippedEffects(actor) {
    if (actor?.documentName !== "Actor") return;
    if (!isResponsibleForActor(actor)) return;

    const desired = desiredEquippedEffects(actor);
    const desiredKeys = new Set(desired.map((d) => d.key));

    const managed = Array.from(actor.effects ?? [])
        .filter((effect) => effect?.flags?.[MODULE_ID]?.[EQUIPPED_EFFECT_FLAG] === true);
    const existingKeys = new Set(managed.map((e) => e?.flags?.[MODULE_ID]?.[EQUIPPED_KEY_FLAG]));

    const toDelete = managed
        .filter((e) => !desiredKeys.has(e?.flags?.[MODULE_ID]?.[EQUIPPED_KEY_FLAG]))
        .map((e) => e.id);
    const toCreate = desired.filter((d) => !existingKeys.has(d.key)).map((d) => d.data);

    if (toDelete.length) await actor.deleteEmbeddedDocuments("ActiveEffect", toDelete);
    if (toCreate.length) await actor.createEmbeddedDocuments("ActiveEffect", toCreate);
}

export function registerEquippedEffectsService() {
    const onCarrierItemChange = (item) => {
        // Only carrier items contribute equipped effects; skip everything else
        // so ordinary item edits don't trigger a reconcile.
        if (!isSupportedCarrierItem(item)) return;
        const actor = item?.parent;
        if (actor?.documentName === "Actor") void syncActorEquippedEffects(actor);
    };
    Hooks.on("createItem", onCarrierItemChange);
    Hooks.on("updateItem", onCarrierItemChange);
    Hooks.on("deleteItem", onCarrierItemChange);
    // Initial sweep so already-equipped items are honoured on load.
    Hooks.once("ready", () => {
        for (const actor of globalThis.game?.actors ?? []) void syncActorEquippedEffects(actor);
    });
}
