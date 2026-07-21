/**
 * Carried-weight tracker.
 *
 * Keeps the actor prop `CurrentWeight` equal to the summed `Weight` of every
 * embedded inventory item (× `Quantity` where the item has one, e.g. ammo).
 * The Inventory tab's header shows the prop via a read-only numberField; CSB
 * formulas can't aggregate over embedded items, so a hook service owns the sum.
 *
 * Recomputes on inventory-item create/update/delete (only on the client that
 * made the change, via the hook's userId) and backfills lazily when an actor
 * sheet renders. Writes only when the value actually changed, so the
 * render-hook can't update-loop.
 */

import { MODULE_ID } from "../lib/constants.mjs";

// Item templates that count as carried inventory (mirrors the Inventory tab's
// AllItemsDisplayer templateFilter in the CSB actor template).
const INVENTORY_TEMPLATES = new Set([
    "qZCfLEYQ7egbm1B9", // weapon
    "uLlgZXz3GlXPFtsj", // armor
    "HkiFlUWUkUycJdBZ", // magic item
    "PDxRO5ObvLaThpez", // consumable
    "389uqkKKn8M1SKux", // ammunition
    "l4j1zT3kpdkZmACQ", // container
    "eCIZRFXbcQVZKqEr", // equippable
    "CmGj09PEdHfklGsT", // light source
    "woHyeHPKKdo4JDJd", // unequippable
]);

const PROP_KEY = "CurrentWeight";

/** Pure: total carried weight, rounded to one decimal. */
export function computeCurrentWeight(actor) {
    let total = 0;
    for (const item of actor?.items ?? []) {
        if (!INVENTORY_TEMPLATES.has(item?.system?.template)) continue;
        const props = item.system?.props ?? {};
        const weight = Number(props.Weight) || 0;
        if (!weight) continue;
        const hasQuantity = props.Quantity !== undefined && props.Quantity !== null && props.Quantity !== "";
        const quantity = hasQuantity ? (Number(props.Quantity) || 0) : 1;
        total += weight * quantity;
    }
    return Math.round(total * 10) / 10;
}

/** Write CurrentWeight if it drifted. No-op for non-actors and _templates. */
export async function syncCurrentWeight(actor) {
    if (!actor || actor.documentName !== "Actor") return;
    if (actor.type === "_template") return;
    const computed = computeCurrentWeight(actor);
    if (Number(actor.system?.props?.[PROP_KEY]) === computed) return;
    await actor.update({ [`system.props.${PROP_KEY}`]: computed });
}

function isInventoryItemOnActor(item) {
    return item?.parent?.documentName === "Actor" && INVENTORY_TEMPLATES.has(item?.system?.template);
}

export function registerEncumbranceService() {
    // Only the client that made the change writes — hooks fire everywhere.
    const onItemChange = (item, userId) => {
        if (userId !== game.user?.id) return;
        if (!isInventoryItemOnActor(item)) return;
        void syncCurrentWeight(item.parent);
    };
    Hooks.on("createItem", (item, _options, userId) => onItemChange(item, userId));
    Hooks.on("updateItem", (item, _change, _options, userId) => onItemChange(item, userId));
    Hooks.on("deleteItem", (item, _options, userId) => onItemChange(item, userId));

    // Lazy backfill for actors created before the prop existed. Equality
    // guard in syncCurrentWeight prevents an update→render loop.
    Hooks.on("renderActorSheet", (app) => {
        const actor = app?.actor;
        if (actor?.isOwner) void syncCurrentWeight(actor);
    });

    const moduleApi = game.modules.get(MODULE_ID);
    if (!moduleApi) {
        console.warn(`${MODULE_ID} | registerEncumbranceService: module not found`);
        return;
    }
    moduleApi.api = moduleApi.api ?? {};
    moduleApi.api.syncCurrentWeight = syncCurrentWeight;
    moduleApi.api.computeCurrentWeight = computeCurrentWeight;
}
