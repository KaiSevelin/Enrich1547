import { MODULE_ID, CHANGESET_TEMPLATE_ID } from "../lib/constants.mjs";
/**
 * Compendium-import auto-cascade for ChangeSets.
 *
 * When a ChangeSet is imported from the `1547core.changesets` compendium into
 * the world (drag from sidebar, or `pack.importDocument`), this hook reads the
 * ChangeSet's `system.props.ChangeDisplayer` map of child Change IDs and
 * imports any missing children from the same compendium.
 *
 * Without this hook, dragging a single ChangeSet leaves orphaned
 * ChangeDisplayer refs because the linked Change items only exist in the
 * compendium, not the world.
 *
 * Non-recursive: only fires on ChangeSet items (template id
 * `b7A1z6cSZO4dYTKT`); imported Changes are a different template and skip.
 */

const CHANGESETS_PACK_ID = "1547core.changesets";

function getCompendiumSourceId(item) {
    return item?.flags?.core?.sourceId ?? null;
}

function isFromOurChangeSetsPack(sourceId) {
    return typeof sourceId === "string" && sourceId.startsWith(`Compendium.${CHANGESETS_PACK_ID}.`);
}

function getChildIdsFromDisplayer(changeSetItem) {
    const displayer = changeSetItem?.system?.props?.ChangeDisplayer;
    if (!displayer || typeof displayer !== "object") return [];
    return Object.keys(displayer);
}

async function autoImportChangeSetChildren(item) {
    if (!game.user?.isGM) return;
    if (item?.system?.template !== CHANGESET_TEMPLATE_ID) return;
    if (item?.parent) return; // embedded items aren't world items

    const sourceId = getCompendiumSourceId(item);
    if (!isFromOurChangeSetsPack(sourceId)) return;

    const childIds = getChildIdsFromDisplayer(item);
    if (!childIds.length) return;

    const missingIds = childIds.filter((id) => !game.items?.get(id));
    if (!missingIds.length) return;

    const pack = game.packs.get(CHANGESETS_PACK_ID);
    if (!pack) {
        console.warn(`${MODULE_ID} | compendium-import: pack ${CHANGESETS_PACK_ID} not found`);
        return;
    }

    let imported = 0;
    for (const id of missingIds) {
        try {
            const sourceDoc = await pack.getDocument(id);
            if (!sourceDoc) continue;
            await Item.create(sourceDoc.toObject(), { keepId: true });
            imported++;
        } catch (err) {
            console.error(`${MODULE_ID} | compendium-import: failed to import Change ${id}`, err);
        }
    }
    if (imported > 0) {
        ui.notifications.info(`1547 Core: auto-imported ${imported} Change(s) for ${item.name}.`);
    }
}

export function registerCompendiumImportHook() {
    Hooks.on("createItem", (item) => {
        void autoImportChangeSetChildren(item);
    });
}
