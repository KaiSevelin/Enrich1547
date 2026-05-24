/**
 * RollTable resolution service for the monster-maker.
 *
 * When a ChangeSet attached to an actor contains Changes with
 * `ImageMode == "RollTable"` or `ItemGrantMode == "RollTable"`, the table
 * is rolled exactly once and the result is cached on the Change item as a
 * Foundry flag. Subsequent derivations read the cache; the roll is not
 * repeated. Removing the parent ChangeSet discards the cache by virtue of
 * the Change being deleted with it.
 *
 * Cache shape (on each Change item):
 *   flags["1547core"].rolledResult = {
 *     tableUuid: string,         // the source table; used to detect retargets
 *     rolledAt: number,          // ms timestamp
 *     imagePath?: string,        // for Image mode
 *     sourceItemId?: string      // for ItemGrant mode
 *   }
 *
 * Cache invalidation: if the Change's RollTable UUID changes, the cache
 * is recognised as stale (`cached.tableUuid !== target.uuid`) and re-rolled.
 *
 * Note: deviates from monster-maker-spec-v1.md's suggested
 * `flags.custom-system-builder.rolledResult` — we use the `1547core`
 * namespace so we never write into CSB's flag bucket.
 */

const MODULE_ID = "1547core";
const CHANGESET_TEMPLATE_ID = "b7A1z6cSZO4dYTKT";
const CHANGE_TEMPLATE_ID = "WsrkfjBmudnIhvEK";
const ROLLED_FLAG = "rolledResult";
const RESOLVE_GUARD = "_1547core_rollingTables";

function isChangeSet(item) {
    return item?.system?.template === CHANGESET_TEMPLATE_ID;
}
function isChange(item) {
    return item?.system?.template === CHANGE_TEMPLATE_ID;
}

function getRollTableTarget(change) {
    const props = change?.system?.props ?? {};
    if (props.Kind === "Image" && String(props.ImageMode ?? "").trim() === "RollTable") {
        const uuid = String(props.ImageRollTable ?? "").trim();
        return uuid ? { kind: "Image", uuid } : null;
    }
    if (props.Kind === "ItemGrant" && String(props.ItemGrantMode ?? "").trim() === "RollTable") {
        const uuid = String(props.ItemGrantRollTable ?? "").trim();
        return uuid ? { kind: "ItemGrant", uuid } : null;
    }
    return null;
}

export function getCachedRoll(change) {
    return change?.flags?.[MODULE_ID]?.[ROLLED_FLAG] ?? null;
}

/**
 * Pure: enumerate every RollTable-mode Change whose cache is missing or
 * stale (different tableUuid). Returned items are descriptors, not docs.
 */
export function findChangesNeedingRoll(actor) {
    const result = [];
    for (const set of Array.from(actor?.items ?? []).filter(isChangeSet)) {
        for (const change of Array.from(set.items ?? []).filter(isChange)) {
            const target = getRollTableTarget(change);
            if (!target) continue;
            const cached = getCachedRoll(change);
            if (cached?.tableUuid === target.uuid) continue;
            result.push({
                changeSetId: set.id,
                changeId: change.id,
                kind: target.kind,
                uuid: target.uuid
            });
        }
    }
    return result;
}

async function resolveResultToItem(result) {
    if (!result) return null;
    const docTypes = CONST?.TABLE_RESULT_TYPES ?? {};
    const documentType = docTypes.DOCUMENT ?? 1;
    const compendiumType = docTypes.COMPENDIUM ?? 2;
    if (result.type === documentType) {
        const collection = game[result.documentCollection];
        return collection?.get?.(result.documentId) ?? null;
    }
    if (result.type === compendiumType) {
        const pack = game.packs.get(result.documentCollection);
        return pack ? await pack.getDocument(result.documentId) : null;
    }
    return null;
}

async function rollOnce(uuid) {
    const table = await fromUuid(uuid);
    if (!table || table.documentName !== "RollTable") return null;
    const tableRoll = await table.roll();
    const results = Array.isArray(tableRoll.results) ? tableRoll.results : [tableRoll.results];
    return results[0] ?? null;
}

const inFlight = new WeakSet();

export async function rollChangeTables(actor) {
    if (!actor || actor.documentName !== "Actor") return;
    if (actor.type === "_template") return;
    if (!globalThis.game?.user?.isGM) return;
    if (inFlight.has(actor)) return;

    const needed = findChangesNeedingRoll(actor);
    if (needed.length === 0) return;

    inFlight.add(actor);
    try {
        for (const target of needed) {
            const set = actor.items.get(target.changeSetId);
            const change = set?.items?.get?.(target.changeId);
            if (!change) continue;

            const rolled = await rollOnce(target.uuid);
            if (!rolled) continue;

            const payload = { tableUuid: target.uuid, rolledAt: Date.now() };
            if (target.kind === "Image") {
                const imagePath = rolled.text || (await resolveResultToItem(rolled))?.img;
                if (!imagePath) continue;
                payload.imagePath = imagePath;
            } else {
                const itemDoc = await resolveResultToItem(rolled);
                if (!itemDoc) continue;
                payload.sourceItemId = itemDoc.id;
            }

            await change.setFlag(MODULE_ID, ROLLED_FLAG, payload);
        }
    } finally {
        inFlight.delete(actor);
    }
}

function shouldTrigger(item, options) {
    if (options?.[RESOLVE_GUARD]) return false;
    if (!item?.parent || item.parent.documentName !== "Actor") {
        // Change nested inside a ChangeSet has actor as grandparent
        if (item?.parent?.parent?.documentName !== "Actor") return false;
    }
    return isChangeSet(item) || isChange(item);
}

function actorFromItem(item) {
    if (item?.parent?.documentName === "Actor") return item.parent;
    if (item?.parent?.parent?.documentName === "Actor") return item.parent.parent;
    return null;
}

export function registerRollTableResolutionService() {
    Hooks.on("createItem", (item, options) => {
        if (!shouldTrigger(item, options)) return;
        const actor = actorFromItem(item);
        if (actor) void rollChangeTables(actor);
    });
    Hooks.on("updateItem", (item, _change, options) => {
        if (!shouldTrigger(item, options)) return;
        const actor = actorFromItem(item);
        if (actor) void rollChangeTables(actor);
    });

    const moduleApi = game.modules.get(MODULE_ID);
    if (!moduleApi) {
        console.warn(`${MODULE_ID} | registerRollTableResolutionService: module not found`);
        return;
    }
    moduleApi.api = moduleApi.api ?? {};
    moduleApi.api.rollChangeTables = rollChangeTables;
    moduleApi.api.findChangesNeedingRoll = findChangesNeedingRoll;
}
