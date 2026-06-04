/**
 * Equipment export macro for 1547core.
 *
 * Usage in Foundry:
 *   1. Open the macro bar at the bottom of the screen.
 *   2. Create a NEW SCRIPT MACRO (the dropdown defaults to "Chat" — change
 *      it to "Script" or this whole file gets interpreted as chat text).
 *   3. Paste this whole file into the macro body.
 *   4. Edit ROOT_FOLDER_NAMES below to name the parent folder(s) that hold
 *      your equipment subfolders. The macro walks descendants automatically.
 *   5. Save + execute the macro.
 *   6. The exported JSON is copied to your clipboard AND printed to the
 *      browser console (F12). Paste it into
 *      modules/1547core/foundry/Templates/equipment.json (replace the [] ).
 *
 * Each exported item gets a `_exportFolderName` field carrying its IMMEDIATE
 * parent folder's name. The build-packs script reads that into the item's
 * `system.props.Category` so the compendium displays them grouped by their
 * subfolder (Amulets / Clothing / Cooking / etc.).
 *
 * GM-only (reads game.items which is world-scoped).
 */

const ROOT_FOLDER_NAMES = [
    "Items"
    // Add more root folder names here if you have multiple item trees.
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

const rootFolders = game.folders.filter(
    (f) => f.type === "Item" && ROOT_FOLDER_NAMES.includes(f.name)
);

if (!rootFolders.length) {
    ui.notifications.warn(
        `No Item folders matched: ${ROOT_FOLDER_NAMES.join(", ")}. Edit ROOT_FOLDER_NAMES at the top of the macro.`
    );
    return;
}

// Build the set of folder IDs to include, plus a folder-id → folder-name map
// so each item gets stamped with its IMMEDIATE parent folder's name.
const includedFolderIds = new Set();
const folderIdToName = new Map();
for (const root of rootFolders) {
    for (const f of collectFolderAndDescendants(root)) {
        includedFolderIds.add(f.id);
        folderIdToName.set(f.id, f.name);
    }
}

const out = [];
for (const item of game.items.contents) {
    const folderId = item.folder?.id;
    if (!folderId || !includedFolderIds.has(folderId)) continue;
    const obj = item.toObject();
    obj._exportFolderName = folderIdToName.get(folderId);
    out.push(obj);
}

const json = JSON.stringify(out, null, 2);

// Show how many items came out of each category, so you can sanity-check.
const byCategory = {};
for (const it of out) {
    const k = it._exportFolderName ?? "(uncategorised)";
    byCategory[k] = (byCategory[k] ?? 0) + 1;
}
console.log(`1547core | Equipment export: ${out.length} item(s) from ${includedFolderIds.size} folder(s)`);
console.table(byCategory);
console.log(json);

try {
    await navigator.clipboard.writeText(json);
    ui.notifications.info(
        `Exported ${out.length} item(s). JSON copied to clipboard — paste into modules/1547core/foundry/Templates/equipment.json.`
    );
} catch (err) {
    console.error("clipboard copy failed:", err);
    ui.notifications.warn(
        `Exported ${out.length} item(s) to console. Clipboard write failed — copy from console manually (F12).`
    );
}
