/**
 * Content registry — unified lookup for items / actors / roll tables that
 * live in EITHER the world (`game.items` / `game.actors` / `game.tables`)
 * OR in 1547core's compendium packs.
 *
 * Loads compendium contents into in-memory maps on ready, then merges with
 * world content. Services use the sync `getAllItems()` / `getItemById()` etc.
 * helpers instead of touching `game.items` directly, so they work whether
 * the user has imported content to their world or not.
 *
 * World docs take precedence over compendium docs of the same ID (the user
 * may have edited the world copy).
 *
 * The registry is rebuilt when:
 *   - 1547core's "ready" hook fires (initial load)
 *   - A world item/actor/table is created/updated/deleted (delta update)
 *   - The user clicks Setup Data (full rebuild)
 *
 * Consumers must NOT mutate registry entries. To write changes, do so on
 * a world doc (via `Item.create` / `actor.update` / etc.) — the change hook
 * refreshes the registry.
 */

const MODULE_ID = "1547core";

const PACK_IDS = {
    items: [
        "1547core.maneuvers",
        "1547core.spells",
        "1547core.monster-magic",
        "1547core.weapons",
        "1547core.armors",
        "1547core.ammunition",
        "1547core.weapon-modifiers",
        "1547core.pacts",
        "1547core.supernatural-marks",
        "1547core.requirements",
        "1547core.changesets"
    ],
    actors: ["1547core.monsters"],
    tables: ["1547core.roll-tables"]
};

const state = {
    items: new Map(),
    actors: new Map(),
    tables: new Map(),
    ready: false,
    readyPromise: null
};

async function loadPackDocs(packId) {
    const pack = game.packs?.get(packId);
    if (!pack) return [];
    try {
        const docs = await pack.getDocuments();
        return Array.from(docs ?? []);
    } catch (err) {
        console.warn(`${MODULE_ID} | content-registry: failed to load pack ${packId}`, err);
        return [];
    }
}

async function rebuildAll() {
    state.items.clear();
    state.actors.clear();
    state.tables.clear();

    // Load compendiums first (lower priority).
    const [packItems, packActors, packTables] = await Promise.all([
        Promise.all(PACK_IDS.items.map(loadPackDocs)).then((arr) => arr.flat()),
        Promise.all(PACK_IDS.actors.map(loadPackDocs)).then((arr) => arr.flat()),
        Promise.all(PACK_IDS.tables.map(loadPackDocs)).then((arr) => arr.flat())
    ]);
    for (const doc of packItems) if (doc?.id) state.items.set(doc.id, doc);
    for (const doc of packActors) if (doc?.id) state.actors.set(doc.id, doc);
    for (const doc of packTables) if (doc?.id) state.tables.set(doc.id, doc);

    // Overlay world docs (higher priority — user may have edited).
    for (const doc of (game.items?.values() ?? [])) state.items.set(doc.id, doc);
    for (const doc of (game.actors?.values() ?? [])) state.actors.set(doc.id, doc);
    for (const doc of (game.tables?.values() ?? [])) state.tables.set(doc.id, doc);

    state.ready = true;
    console.log(`${MODULE_ID} | content-registry ready: ${state.items.size} items, ${state.actors.size} actors, ${state.tables.size} tables`);
}

function upsertWorldDoc(map, doc) {
    if (!doc?.id) return;
    map.set(doc.id, doc);
}

function removeWorldDoc(map, doc, packDocs) {
    if (!doc?.id) return;
    // If the deleted world doc has a compendium counterpart, fall back to it.
    // Otherwise drop the entry entirely.
    const fallback = packDocs.get(doc.id);
    if (fallback) map.set(doc.id, fallback);
    else map.delete(doc.id);
}

export function registerContentRegistry() {
    if (state.readyPromise) return state.readyPromise;

    state.readyPromise = (async () => {
        await rebuildAll();

        // World delta updates — keep registry in sync without full rebuild.
        const itemHooks = ["createItem", "updateItem", "deleteItem"];
        for (const hookName of itemHooks) {
            Hooks.on(hookName, (item) => {
                if (item?.parent) return; // embedded item — skip
                if (hookName === "deleteItem") {
                    // Re-fetch the pack doc as fallback (not cheap — better to rebuild lazily).
                    state.items.delete(item.id);
                } else {
                    upsertWorldDoc(state.items, item);
                }
            });
        }
        const actorHooks = ["createActor", "updateActor", "deleteActor"];
        for (const hookName of actorHooks) {
            Hooks.on(hookName, (actor) => {
                if (hookName === "deleteActor") state.actors.delete(actor.id);
                else upsertWorldDoc(state.actors, actor);
            });
        }
        const tableHooks = ["createRollTable", "updateRollTable", "deleteRollTable"];
        for (const hookName of tableHooks) {
            Hooks.on(hookName, (table) => {
                if (hookName === "deleteRollTable") state.tables.delete(table.id);
                else upsertWorldDoc(state.tables, table);
            });
        }
    })();

    const moduleApi = game.modules?.get(MODULE_ID);
    if (moduleApi) {
        moduleApi.api = moduleApi.api ?? {};
        moduleApi.api.contentRegistry = {
            rebuild: () => rebuildAll(),
            isReady: () => state.ready,
            getAllItems,
            getItemById,
            getAllActors,
            getActorById,
            getAllTables,
            getTableById,
            findItemsByTemplate,
            findChangeSetsByGroup
        };
    }

    return state.readyPromise;
}

// Fallthroughs to world collections when registry hasn't been initialized
// (smoke tests, edge cases where a helper is called before ready fires).
function worldItems() {
    if (typeof globalThis.game?.items?.values === "function") return [...globalThis.game.items.values()];
    return [];
}
function worldActors() {
    if (typeof globalThis.game?.actors?.values === "function") return [...globalThis.game.actors.values()];
    return [];
}
function worldTables() {
    if (typeof globalThis.game?.tables?.values === "function") return [...globalThis.game.tables.values()];
    if (typeof globalThis.game?.tables?.find === "function") {
        // Some test stubs only provide get/find without values(). Caller must
        // tolerate this by using getTableById / find-style lookups.
        return [];
    }
    return [];
}

export function getAllItems() {
    return state.items.size ? Array.from(state.items.values()) : worldItems();
}

export function getItemById(id) {
    return state.items.get(id) ?? globalThis.game?.items?.get?.(id) ?? null;
}

export function getAllActors() {
    return state.actors.size ? Array.from(state.actors.values()) : worldActors();
}

export function getActorById(id) {
    return state.actors.get(id) ?? globalThis.game?.actors?.get?.(id) ?? null;
}

export function getAllTables() {
    return state.tables.size ? Array.from(state.tables.values()) : worldTables();
}

export function getTableById(id) {
    return state.tables.get(id) ?? globalThis.game?.tables?.get?.(id) ?? null;
}

export function findItemsByTemplate(templateId) {
    return getAllItems().filter((doc) => doc?.system?.template === templateId);
}

// Find-style helpers that work in either the registry OR a raw world
// collection (some test stubs only provide `find` / `get`, not iterators).
export function findItem(predicate) {
    for (const doc of state.items.values()) if (predicate(doc)) return doc;
    return globalThis.game?.items?.find?.(predicate) ?? null;
}

export function findActor(predicate) {
    for (const doc of state.actors.values()) if (predicate(doc)) return doc;
    return globalThis.game?.actors?.find?.(predicate) ?? null;
}

export function findTable(predicate) {
    for (const doc of state.tables.values()) if (predicate(doc)) return doc;
    return globalThis.game?.tables?.find?.(predicate) ?? null;
}

export function findChangeSetsByGroup(group, typeFilter = null) {
    const CHANGESET_TEMPLATE_ID = "b7A1z6cSZO4dYTKT";
    return getAllItems().filter((doc) => {
        if (doc?.system?.template !== CHANGESET_TEMPLATE_ID) return false;
        const props = doc.system?.props ?? {};
        if (String(props.Group ?? "").trim() !== group) return false;
        if (typeFilter && props.ForTypeAny !== true && props[`ForType_${typeFilter}`] !== true) return false;
        return true;
    });
}

/**
 * Wait until the registry's initial build has completed. Use in services that
 * read on ready / on user action when the registry might not be loaded yet.
 */
export async function awaitContentRegistry() {
    if (state.readyPromise) await state.readyPromise;
}
