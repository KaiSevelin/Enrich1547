/**
 * ItemGrant reconciliation service.
 *
 * Syncs Direct-mode ItemGrant Changes on attached ChangeSets to actual
 * embedded items on the actor. Granted items are tagged with a
 * `flags["1547core"].grantedBy = { changeSetId, changeId }` marker so
 * subsequent reconciliations can find and remove them when the parent
 * ChangeSet (or the individual Change) goes away.
 *
 * RollTable-mode ItemGrant is also supported: the source item ID is read
 * from the Change's cached roll (`flags["1547core"].rolledResult.sourceItemId`,
 * populated by rolltable-resolution-service). If the cache is missing
 * (roll hasn't happened yet) the Change is skipped — the resolution
 * service will write the cache and the resulting updateItem hook will
 * re-trigger this reconciler.
 *
 * The diff function is pure and exported for testing; the hook glue is
 * GM-only and gated by an options flag to prevent self-trigger recursion.
 */

const MODULE_ID = "1547core";
const CHANGESET_TEMPLATE_ID = "b7A1z6cSZO4dYTKT";
const CHANGE_TEMPLATE_ID = "WsrkfjBmudnIhvEK";
const FLAG_KEY = "grantedBy";
const RECONCILE_GUARD = "_1547core_reconciling";

function isChangeSet(item) {
    return item?.system?.template === CHANGESET_TEMPLATE_ID;
}

function isChange(item) {
    return item?.system?.template === CHANGE_TEMPLATE_ID;
}

function grantKey(changeSetId, changeId) {
    return `${changeSetId}::${changeId}`;
}

function readGrantedByFlag(item) {
    return item?.flags?.[MODULE_ID]?.[FLAG_KEY] ?? null;
}

/**
 * Pure diff: given an actor and a source-item resolver, compute what
 * embedded items need to be created or deleted to bring the actor in line
 * with the ItemGrant Changes on its attached ChangeSets.
 *
 * @param {Actor|object} actor — must expose `items` iterable
 * @param {(id: string) => object|null} resolveSource — returns a plain item
 *   data object for a given source item ID, or null if unresolvable
 * @returns {{ toCreate: object[], toDelete: string[] }}
 */
export function computeGrantedItemReconciliation(actor, resolveSource) {
    const targetGrants = new Map();
    const items = Array.from(actor?.items ?? []);

    for (const set of items.filter(isChangeSet)) {
        const childChanges = Array.from(set.items ?? []).filter(isChange);
        for (const change of childChanges) {
            const props = change.system?.props ?? {};
            if (props.Kind !== "ItemGrant") continue;
            const mode = String(props.ItemGrantMode ?? "Direct").trim();
            let sourceItemId = null;
            if (mode === "Direct") {
                sourceItemId = props.ItemGrantRef?.[0] ?? null;
            } else if (mode === "RollTable") {
                sourceItemId = change.flags?.[MODULE_ID]?.rolledResult?.sourceItemId ?? null;
            }
            if (!sourceItemId) continue;
            targetGrants.set(grantKey(set.id, change.id), {
                changeSetId: set.id,
                changeId: change.id,
                sourceItemId
            });
        }
    }

    const existingGranted = new Map();
    for (const item of items) {
        const grantedBy = readGrantedByFlag(item);
        if (!grantedBy?.changeSetId || !grantedBy?.changeId) continue;
        existingGranted.set(grantKey(grantedBy.changeSetId, grantedBy.changeId), item);
    }

    const toDelete = [];
    for (const [key, item] of existingGranted) {
        if (!targetGrants.has(key)) toDelete.push(item.id);
    }

    const toCreate = [];
    for (const [key, target] of targetGrants) {
        if (existingGranted.has(key)) continue;
        const sourceData = resolveSource(target.sourceItemId);
        if (!sourceData) continue;
        const itemData = JSON.parse(JSON.stringify(sourceData));
        delete itemData._id;
        itemData.flags = itemData.flags ?? {};
        itemData.flags[MODULE_ID] = itemData.flags[MODULE_ID] ?? {};
        itemData.flags[MODULE_ID][FLAG_KEY] = {
            changeSetId: target.changeSetId,
            changeId: target.changeId
        };
        toCreate.push(itemData);
    }

    return { toCreate, toDelete };
}

function defaultResolveSource(id) {
    const source = globalThis.game?.items?.get?.(id);
    return source ? source.toObject() : null;
}

/**
 * Reconcile granted items on an actor. GM-only; no-op for non-GMs and for
 * `_template` actors.
 */
export async function reconcileGrantedItems(actor, { resolveSource = defaultResolveSource } = {}) {
    if (!actor || actor.documentName !== "Actor") return;
    if (actor.type === "_template") return;
    if (!globalThis.game?.user?.isGM) return;

    const { toCreate, toDelete } = computeGrantedItemReconciliation(actor, resolveSource);
    if (toDelete.length === 0 && toCreate.length === 0) return;

    const options = { [RECONCILE_GUARD]: true };
    if (toDelete.length) {
        await actor.deleteEmbeddedDocuments("Item", toDelete, options);
    }
    if (toCreate.length) {
        await actor.createEmbeddedDocuments("Item", toCreate, options);
    }
}

function shouldTriggerReconcile(item, options) {
    if (options?.[RECONCILE_GUARD]) return false;
    if (!item?.parent || item.parent.documentName !== "Actor") return false;
    if (isChangeSet(item)) return true;
    // A Change item nested inside a ChangeSet: reconcile when the parent set's
    // children change. The Change's parent in CSB is the ChangeSet item; its
    // grandparent is the actor.
    const grandparent = item.parent?.parent;
    if (isChange(item) && grandparent?.documentName === "Actor") return true;
    // Granted items themselves changing should not trigger reconcile (would
    // loop on our own creates/deletes; guard above handles the immediate case).
    return false;
}

function actorFromItem(item) {
    if (item?.parent?.documentName === "Actor") return item.parent;
    if (item?.parent?.parent?.documentName === "Actor") return item.parent.parent;
    return null;
}

export function registerItemGrantService() {
    Hooks.on("createItem", (item, options) => {
        if (!shouldTriggerReconcile(item, options)) return;
        const actor = actorFromItem(item);
        if (actor) void reconcileGrantedItems(actor);
    });
    Hooks.on("updateItem", (item, _change, options) => {
        if (!shouldTriggerReconcile(item, options)) return;
        const actor = actorFromItem(item);
        if (actor) void reconcileGrantedItems(actor);
    });
    Hooks.on("deleteItem", (item, options) => {
        if (!shouldTriggerReconcile(item, options)) return;
        const actor = actorFromItem(item);
        if (actor) void reconcileGrantedItems(actor);
    });

    const moduleApi = game.modules.get(MODULE_ID);
    if (!moduleApi) {
        console.warn(`${MODULE_ID} | registerItemGrantService: module not found`);
        return;
    }
    moduleApi.api = moduleApi.api ?? {};
    moduleApi.api.reconcileGrantedItems = reconcileGrantedItems;
    moduleApi.api.computeGrantedItemReconciliation = computeGrantedItemReconciliation;
}
