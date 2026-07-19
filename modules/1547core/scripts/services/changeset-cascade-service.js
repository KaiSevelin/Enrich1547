/**
 * ChangeSet cascade.
 *
 * When a world-side ChangeSet item is dropped onto an actor, Foundry embeds
 * the parent doc but does NOT copy the items referenced by its CSB
 * itemContainers (ChangeDisplayer for Changes, RequirementsDisplayer for
 * Requirements). The composition pipeline reads child items from
 * `actor.items.get(<id>)`, so without a cascade those references resolve to
 * world items (or nothing, on a fresh world), and the pipeline silently
 * skips the chassis.
 *
 * This service closes that loop: on `createItem` of a ChangeSet on an actor,
 * each referenced source item is copied as an embedded actor item with a
 * fresh id, then the parent's container linkage maps are rewritten to point
 * at the new actor-side ids. On `deleteItem` of the ChangeSet, the
 * actor-side child copies are deleted (they live as siblings keyed by
 * `system.container`).
 *
 * A GUARD flag prevents the cascade's own embed/update operations from
 * re-triggering the hook recursively.
 */

import { getItemById } from "./content-registry.js";
import { MODULE_ID, SOURCE_FLAG_SCOPE, CHANGESET_TEMPLATE_ID, CHANGE_TEMPLATE_ID, REQUIREMENT_TEMPLATE_ID } from "../lib/constants.mjs";

const CHANGE_CONTAINER_KEY = "ChangeDisplayer";
const REQUIREMENT_CONTAINER_KEY = "RequirementsDisplayer";
const CASCADE_GUARD = `${MODULE_ID}.changesetCascadeGuard`;

// In-flight createItem-hook cascades, keyed by ChangeSet item id. The monster
// wizard's resyncActorChangeSets used to race these: it checked "does this set
// have children yet?" while the hook cascade's createEmbeddedDocuments was
// still in flight, saw none, and cascaded the same set a second time — every
// child Change (and every item it grants) landed twice.
const pendingCascades = new Map();

function trackCascade(changeSetId, promise) {
    const tracked = promise.catch((err) => {
        console.error(`${MODULE_ID} | ChangeSet cascade failed for ${changeSetId}`, err);
    });
    pendingCascades.set(changeSetId, tracked);
    tracked.then(() => {
        if (pendingCascades.get(changeSetId) === tracked) pendingCascades.delete(changeSetId);
    });
    return tracked;
}

function isChangeSetItem(item) {
    return item?.system?.template === CHANGESET_TEMPLATE_ID;
}

// CSB container linkage shape is `{ [childId]: { name, id, uuid } }`. Older
// fixtures used a plain array of ids; tolerate both.
//
// IMPORTANT: read from `_source` (raw stored data), not `system` (prepared).
// `ChangeDisplayer`/`RequirementsDisplayer` are CSB itemContainer props: CSB's
// data-prep RECOMPUTES them from the actor's actual container-children and
// EMPTIES them when there are none yet. So on a freshly-dropped ChangeSet the
// prepared `item.system.props[key]` is `{}` — the cascade would read no child
// ids and create nothing. The seed linkage (pointing at the canonical Change
// ids) survives only on `_source`.
function readLinkageIds(item, key) {
    const linkage = item?._source?.system?.props?.[key] ?? item?.system?.props?.[key];
    if (!linkage || typeof linkage !== "object") return [];
    if (Array.isArray(linkage)) return linkage.filter((id) => typeof id === "string" && id);
    return Object.keys(linkage).filter((id) => typeof id === "string" && id);
}

function buildLinkageEntry(item) {
    return {
        name: item?.name ?? "",
        id: item?.id ?? "",
        uuid: item?.uuid ?? `Item.${item?.id ?? ""}`,
    };
}

async function handleChangeSetCreate(item, options) {
    if (options?.[CASCADE_GUARD]) return;
    if (!isChangeSetItem(item)) return;
    const actor = item?.parent;
    if (actor?.documentName !== "Actor") return;

    // Build the embed payloads from world-side source items.
    const docsToCreate = [];
    for (const sourceId of readLinkageIds(item, CHANGE_CONTAINER_KEY)) {
        const source = getItemById(sourceId);
        if (!source) continue;
        const data = source.toObject();
        delete data._id;
        data.system = data.system ?? {};
        // Link the copy to the actor-side parent ChangeSet (not the world doc).
        data.system.container = item.id;
        docsToCreate.push({ data, role: "change" });
    }
    for (const sourceId of readLinkageIds(item, REQUIREMENT_CONTAINER_KEY)) {
        const source = getItemById(sourceId);
        if (!source) continue;
        const data = source.toObject();
        delete data._id;
        data.system = data.system ?? {};
        data.system.container = item.id;
        docsToCreate.push({ data, role: "requirement" });
    }
    if (!docsToCreate.length) return;

    const payloads = docsToCreate.map((entry) => entry.data);
    const created = await actor.createEmbeddedDocuments("Item", payloads, { [CASCADE_GUARD]: true });

    // Rewrite the parent's linkage maps to point at the new actor-side ids.
    const newChangeDisplayer = {};
    const newRequirementsDisplayer = {};
    for (let i = 0; i < created.length; i++) {
        const newItem = created[i];
        const role = docsToCreate[i].role;
        const entry = buildLinkageEntry(newItem);
        if (role === "change") newChangeDisplayer[newItem.id] = entry;
        else newRequirementsDisplayer[newItem.id] = entry;
    }
    await item.update({
        "system.props.ChangeDisplayer": newChangeDisplayer,
        "system.props.RequirementsDisplayer": newRequirementsDisplayer,
    }, { [CASCADE_GUARD]: true });
}

async function handleChangeSetDelete(item, options) {
    if (options?.[CASCADE_GUARD]) return;
    if (!isChangeSetItem(item)) return;
    const actor = item?.parent;
    if (actor?.documentName !== "Actor") return;

    const siblings = actor.items?.contents ?? Array.from(actor.items ?? []);
    const orphanIds = siblings
        .filter((it) => String(it?.system?.container ?? "") === item.id)
        .filter((it) => it?.system?.template === CHANGE_TEMPLATE_ID || it?.system?.template === REQUIREMENT_TEMPLATE_ID)
        .map((it) => it.id);
    if (!orphanIds.length) return;
    await actor.deleteEmbeddedDocuments("Item", orphanIds, { [CASCADE_GUARD]: true });
}

// Surplus cascade children on an actor: for each (parent ChangeSet, canonical
// source) pair the cascade should have produced exactly one embedded
// Change/Requirement copy. A double-cascade (the resync race above) leaves a
// second copy — same `system.container`, same canonical source id in
// `flags[SOURCE_FLAG_SCOPE].sourceData._id` (falling back to name for content
// without source stamps). Returns the ids of every copy past the first, in
// actor-item order. Pure; exported for tests.
export function computeDuplicateCascadeChildIds(actor) {
    const seen = new Set();
    const duplicates = [];
    for (const item of (actor?.items?.contents ?? Array.from(actor?.items ?? []))) {
        const template = item?.system?.template;
        if (template !== CHANGE_TEMPLATE_ID && template !== REQUIREMENT_TEMPLATE_ID) continue;
        const container = String(item?.system?.container ?? item?._source?.system?.container ?? "");
        if (!container) continue;
        const sourceId = item?.flags?.[SOURCE_FLAG_SCOPE]?.sourceData?._id ?? item?.name ?? "";
        const key = `${container}::${template}::${sourceId}`;
        if (seen.has(key)) duplicates.push(item.id);
        else seen.add(key);
    }
    return duplicates;
}

// Explicitly (re)cascade every ChangeSet on an actor whose child items are
// missing. Idempotent — a ChangeSet that already has children is skipped, and
// a ChangeSet whose hook cascade is still in flight is awaited rather than
// cascaded again. Used by the monster wizard after creation to guarantee the
// chassis/role/etc. expand even when the createItem-hook cascade was missed
// (registry still warming up at create time, or a concurrent CSB template
// reload racing it). Also deletes surplus children left by historical
// double-cascades, so re-running it heals an already-duplicated actor.
export async function resyncActorChangeSets(actor) {
    if (actor?.documentName !== "Actor") return { cascaded: 0 };
    const changeSets = (actor.items?.contents ?? Array.from(actor.items ?? [])).filter(isChangeSetItem);
    let cascaded = 0;
    for (const changeSet of changeSets) {
        const pending = pendingCascades.get(changeSet.id);
        if (pending) await pending;
        const current = actor.items?.contents ?? Array.from(actor.items ?? []);
        const hasChildren = current.some((it) => String(it?.system?.container ?? "") === changeSet.id);
        if (hasChildren) continue;
        await trackCascade(changeSet.id, handleChangeSetCreate(changeSet, {}));
        cascaded += 1;
    }

    // Remove surplus duplicate children (same parent set + same source). The
    // grant reconciler below then cleans up whatever those copies granted —
    // their changeIds no longer resolve to a live Change.
    const duplicateChildIds = computeDuplicateCascadeChildIds(actor);
    if (duplicateChildIds.length) {
        console.log(`${MODULE_ID} | resyncActorChangeSets: deleting ${duplicateChildIds.length} duplicate cascade child(ren) on ${actor.name}`);
        await actor.deleteEmbeddedDocuments("Item", duplicateChildIds, { [CASCADE_GUARD]: true });
    }

    // Now that the child Changes exist, re-run the downstream consumers that
    // read them (item grants → actual weapons/armor; composition cache →
    // stats/traits recompute). They resolve children via `system.container`, so
    // this is reliable even when CSB has emptied the linkage props. Idempotent.
    try {
        const api = globalThis.game?.modules?.get?.(MODULE_ID)?.api;
        api?.composition?.invalidateEffectiveActorCache?.(actor);
        await api?.reconcileGrantedItems?.(actor);
    } catch (err) {
        console.warn(`${MODULE_ID} | resyncActorChangeSets: downstream refresh failed`, err);
    }
    return { cascaded };
}

export function registerChangeSetCascadeService() {
    Hooks.on("createItem", (item, options) => {
        if (!isChangeSetItem(item)) return;
        trackCascade(item.id, handleChangeSetCreate(item, options));
    });
    Hooks.on("deleteItem", (item, options) => {
        void handleChangeSetDelete(item, options);
    });
    const moduleApi = globalThis.game?.modules?.get?.(MODULE_ID);
    if (moduleApi) {
        moduleApi.api = moduleApi.api ?? {};
        moduleApi.api.resyncActorChangeSets = resyncActorChangeSets;
    }
}
