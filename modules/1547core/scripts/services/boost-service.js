/**
 * Boost service for the monster-maker.
 *
 * Provides:
 *   boostActor(actorId)   — roll on the configured boost RollTable, preview, apply on accept
 *   unboostActor(actorId) — remove the most recently added Boost-group ChangeSet from the actor
 *
 * Configured via the world setting "boostRollTableUuid" (1547core module setting).
 * Registered on game.modules.get("1547core").api so CSB label rollMessages can call it.
 */

const MODULE_ID = "1547core";

async function resolveBoostRollTable() {
    const uuid = game.settings.get(MODULE_ID, "boostRollTableUuid");
    if (!uuid) {
        ui.notifications.warn("1547 Core: No boost Roll Table configured. Set it in the module settings.");
        return null;
    }

    try {
        const table = await fromUuid(uuid);
        if (!table) {
            ui.notifications.error(`1547 Core: Roll Table not found at ${uuid}.`);
            return null;
        }
        if (table.documentName !== "RollTable") {
            ui.notifications.error(`1547 Core: ${uuid} is not a Roll Table (it is a ${table.documentName}).`);
            return null;
        }
        return table;
    } catch (error) {
        console.error(`${MODULE_ID} | Failed to resolve boost Roll Table`, error);
        ui.notifications.error(`1547 Core: Failed to resolve Roll Table at ${uuid}.`);
        return null;
    }
}

async function resolveTableResultToItem(result) {
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

async function rollOnBoostTable(table) {
    const tableRoll = await table.roll();
    const results = Array.isArray(tableRoll.results) ? tableRoll.results : [tableRoll.results];
    if (!results.length) return null;
    return await resolveTableResultToItem(results[0]);
}

function isChangeSet(item) {
    return item?.system?.template === "b7A1z6cSZO4dYTKT"
        || item?.system?.templateSystemUniqueVersion !== undefined && item?.flags?.["custom-system-builder"];
}

export async function boostActor(actorId) {
    if (!game.user.isGM) {
        ui.notifications.warn("Only the GM can boost monsters.");
        return;
    }

    const actor = game.actors.get(actorId);
    if (!actor) {
        ui.notifications.error("1547 Core: Actor not found.");
        return;
    }

    const table = await resolveBoostRollTable();
    if (!table) return;

    const rolledItem = await rollOnBoostTable(table);
    if (!rolledItem) {
        ui.notifications.warn("1547 Core: Roll yielded no item.");
        return;
    }

    const itemGroup = rolledItem.system?.props?.Group;
    if (itemGroup !== "Boost") {
        const proceed = await Dialog.confirm({
            title: "Apply non-Boost ChangeSet?",
            content: `<p>The rolled ChangeSet <strong>${rolledItem.name}</strong> has Group="${itemGroup ?? "(unset)"}", not "Boost".</p><p>Apply anyway? It will be forced into the Boost slot.</p>`,
            defaultYes: false
        });
        if (!proceed) return;
    }

    const accept = await Dialog.confirm({
        title: `Apply Boost: ${rolledItem.name}?`,
        content: `<p>Rolled <strong>${rolledItem.name}</strong>.</p><p>Apply this boost to <strong>${actor.name}</strong>?</p>`,
        defaultYes: true
    });
    if (!accept) return;

    const itemData = rolledItem.toObject();
    if (itemData.system?.props) {
        itemData.system.props.Group = "Boost";
    } else if (itemData.system) {
        itemData.system.props = { Group: "Boost" };
    }
    delete itemData._id;

    await actor.createEmbeddedDocuments("Item", [itemData]);
    ui.notifications.info(`Applied boost: ${rolledItem.name}`);
}

export async function unboostActor(actorId) {
    if (!game.user.isGM) {
        ui.notifications.warn("Only the GM can unboost monsters.");
        return;
    }

    const actor = game.actors.get(actorId);
    if (!actor) {
        ui.notifications.error("1547 Core: Actor not found.");
        return;
    }

    const boosts = actor.items
        .filter((item) => item.system?.props?.Group === "Boost")
        .sort((a, b) => {
            const aTime = Number(a._stats?.createdTime ?? 0);
            const bTime = Number(b._stats?.createdTime ?? 0);
            return bTime - aTime;
        });

    if (boosts.length === 0) {
        ui.notifications.warn("No boosts to remove.");
        return;
    }

    const mostRecent = boosts[0];
    const confirm = await Dialog.confirm({
        title: "Remove last boost?",
        content: `<p>Remove <strong>${mostRecent.name}</strong> from <strong>${actor.name}</strong>?</p>`,
        defaultYes: true
    });
    if (!confirm) return;

    await actor.deleteEmbeddedDocuments("Item", [mostRecent.id]);
    ui.notifications.info(`Removed boost: ${mostRecent.name}`);
}

export function registerBoostService() {
    const moduleApi = game.modules.get(MODULE_ID);
    if (!moduleApi) {
        console.warn(`${MODULE_ID} | registerBoostService: module not found`);
        return;
    }
    moduleApi.api = moduleApi.api ?? {};
    moduleApi.api.boostActor = boostActor;
    moduleApi.api.unboostActor = unboostActor;
}
