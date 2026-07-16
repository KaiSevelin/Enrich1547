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
import { MODULE_ID, CHANGESET_TEMPLATE_ID, CHANGE_TEMPLATE_ID, REQUIREMENT_TEMPLATE_ID } from "../lib/constants.mjs";

const CHANGE_CONTAINER_KEY = "ChangeDisplayer";
const REQUIREMENT_CONTAINER_KEY = "RequirementsDisplayer";
const CASCADE_GUARD = `${MODULE_ID}.changesetCascadeGuard`;

function isChangeSetItem(item) {
    return item?.system?.template === CHANGESET_TEMPLATE_ID;
}

// CSB container linkage shape is `{ [childId]: { name, id, uuid } }`. Older
// fixtures used a plain array of ids; tolerate both.
function readLinkageIds(item, key) {
    const linkage = item?.system?.props?.[key];
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

// Explicitly (re)cascade every ChangeSet on an actor whose child items are
// missing. Idempotent — a ChangeSet that already has children is skipped. Used
// by the monster wizard after creation to guarantee the chassis/role/etc.
// expand even when the createItem-hook cascade was missed (registry still
// warming up at create time, or a concurrent CSB template reload racing it).
export async function resyncActorChangeSets(actor) {
    if (actor?.documentName !== "Actor") return { cascaded: 0 };
    const changeSets = (actor.items?.contents ?? Array.from(actor.items ?? [])).filter(isChangeSetItem);
    let cascaded = 0;
    for (const changeSet of changeSets) {
        const current = actor.items?.contents ?? Array.from(actor.items ?? []);
        const hasChildren = current.some((it) => String(it?.system?.container ?? "") === changeSet.id);
        if (hasChildren) continue;
        await handleChangeSetCreate(changeSet, {});
        cascaded += 1;
    }
    return { cascaded };
}

export function registerChangeSetCascadeService() {
    Hooks.on("createItem", (item, options) => {
        void handleChangeSetCreate(item, options);
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
