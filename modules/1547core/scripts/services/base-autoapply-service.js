/**
 * Base ChangeSet auto-apply service.
 *
 * When an actor is created or its TypeDropdown changes, ensures the matching
 * Base ChangeSet is on the actor — adds it if missing, swaps it if wrong.
 *
 * This removes the manual "drop the Base ChangeSet" step from monster
 * authoring. Type is set; chassis follows.
 *
 * Runs GM-side only (createEmbeddedDocuments / deleteEmbeddedDocuments).
 */

import { findChangeSetsByGroup } from "./content-registry.js";

const MODULE_ID = "1547core";
const CHANGESET_TEMPLATE_ID = "b7A1z6cSZO4dYTKT";

function isChangeSet(item) {
    return item?.system?.template === CHANGESET_TEMPLATE_ID;
}

function getActorType(actor) {
    return String(actor?.system?.props?.TypeDropdown ?? "").trim();
}

function findBaseChangeSetForType(typeDropdown) {
    if (!typeDropdown) return null;
    const flag = `ForType_${typeDropdown}`;
    const candidates = findChangeSetsByGroup("Base", typeDropdown);
    return candidates.find((item) => item.system?.props?.[flag] === true) ?? null;
}

function findActorBaseItem(actor) {
    for (const item of actor.items ?? []) {
        if (!isChangeSet(item)) continue;
        if (String(item.system?.props?.Group ?? "").trim() === "Base") return item;
    }
    return null;
}

function actorBaseMatchesType(actor, typeDropdown) {
    const base = findActorBaseItem(actor);
    if (!base) return false;
    const flag = `ForType_${typeDropdown}`;
    return base.system?.props?.[flag] === true;
}

async function ensureBaseChangeSetForActor(actor) {
    if (!actor || actor.documentName !== "Actor") return;
    if (actor.type === "_template") return;
    if (!game.user.isGM) return;

    const typeDropdown = getActorType(actor);
    if (!typeDropdown) return;

    // Already correct — nothing to do
    if (actorBaseMatchesType(actor, typeDropdown)) return;

    const expectedBase = findBaseChangeSetForType(typeDropdown);
    if (!expectedBase) {
        console.warn(`${MODULE_ID} | No Base ChangeSet found for type "${typeDropdown}"`);
        return;
    }

    // Remove wrong base if present
    const currentBase = findActorBaseItem(actor);
    if (currentBase) {
        try {
            await actor.deleteEmbeddedDocuments("Item", [currentBase.id]);
        } catch (err) {
            console.error(`${MODULE_ID} | Failed to remove old Base ChangeSet`, err);
            return;
        }
    }

    // Add the correct base
    try {
        const itemData = expectedBase.toObject();
        delete itemData._id;
        await actor.createEmbeddedDocuments("Item", [itemData]);
    } catch (err) {
        console.error(`${MODULE_ID} | Failed to apply Base ChangeSet`, err);
    }
}

export function registerBaseAutoApply() {
    Hooks.on("createActor", (actor) => {
        void ensureBaseChangeSetForActor(actor);
    });

    Hooks.on("updateActor", (actor, changes) => {
        // Only react if TypeDropdown was touched
        const newType = foundry.utils.getProperty(changes, "system.props.TypeDropdown");
        if (newType === undefined) return;
        void ensureBaseChangeSetForActor(actor);
    });

    const moduleApi = game.modules.get(MODULE_ID);
    if (!moduleApi) {
        console.warn(`${MODULE_ID} | registerBaseAutoApply: module not found`);
        return;
    }
    moduleApi.api = moduleApi.api ?? {};
    moduleApi.api.ensureBaseChangeSetForActor = ensureBaseChangeSetForActor;
}
