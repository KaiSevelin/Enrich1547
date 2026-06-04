/**
 * Equipment export macro for 1547core.
 *
 * Usage in Foundry:
 *   1. Game Settings -> Configure Settings -> Macro Directory, or just open
 *      the macro bar at the bottom of the screen.
 *   2. Create a new Script macro (not chat).
 *   3. Paste this whole file into the macro body.
 *   4. Edit FOLDER_NAMES below to match the Item folder names in your world.
 *   5. Save + execute the macro.
 *   6. The exported JSON is copied to your clipboard AND printed to the
 *      browser console (F12). Paste it into
 *      modules/1547core/foundry/Templates/equipment.json.
 *
 * Each exported item gets a `_exportFolderName` field carrying its source
 * folder name; the build-packs script reads this into the item's
 * `system.props.Category` so the compendium displays them grouped.
 *
 * GM-only (the macro reads game.items which is world-scoped).
 */

const FOLDER_NAMES = [
    "Amulets",
    "Animal & Transport",
    "Clothing",
    "Containers",
    "Cooking"
    // Add more folder names here as needed, exact case.
];

if (!game.user?.isGM) {
    ui.notifications.error("Equipment export must be run by the GM.");
    return;
}

function collectFolderAndDescendants(rootFolder) {
    const out = [rootFolder];
    const queue = [...(rootFolder.children ?? [])];
    while (queue.length) {
        const node = queue.shift();
        const f = node?.folder ?? node;
        if (!f) continue;
        out.push(f);
        const kids = f.children ?? [];
        for (const k of kids) queue.push(k);
    }
    return out;
}

const targetFolders = game.folders.filter(
    (f) => f.type === "Item" && FOLDER_NAMES.includes(f.name)
);

if (!targetFolders.length) {
    ui.notifications.warn(
        `No Item folders matched: ${FOLDER_NAMES.join(", ")}. Edit FOLDER_NAMES at the top of the macro.`
    );
    return;
}

const folderIdToName = new Map();
const allFolderIds = new Set();
for (const top of targetFolders) {
    for (const f of collectFolderAndDescendants(top)) {
        allFolderIds.add(f.id);
        // Items under any descendant inherit the top-level category name.
        folderIdToName.set(f.id, top.name);
    }
}

const out = [];
for (const item of game.items.contents) {
    const folderId = item.folder?.id;
    if (!folderId || !allFolderIds.has(folderId)) continue;
    const obj = item.toObject();
    obj._exportFolderName = folderIdToName.get(folderId);
    out.push(obj);
}

const json = JSON.stringify(out, null, 2);
console.log(`1547core | Equipment export: ${out.length} item(s) from ${targetFolders.length} folder(s)`);
console.log(json);

try {
    await navigator.clipboard.writeText(json);
    ui.notifications.info(
        `Exported ${out.length} item(s) from ${targetFolders.length} folder(s). JSON copied to clipboard — paste into modules/1547core/foundry/Templates/equipment.json.`
    );
} catch (err) {
    console.error("clipboard copy failed:", err);
    ui.notifications.warn(
        `Exported ${out.length} item(s) to console. Clipboard write failed — copy from console manually (F12).`
    );
}
