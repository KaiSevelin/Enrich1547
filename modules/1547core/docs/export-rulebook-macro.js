/**
 * Rule Book export macro for 1547core.
 *
 * Workflow:
 *   1. Install 1547core; right-click the "1547 Rule Book" compendium → Import
 *      All Content. The "1547 Rule Book" JournalEntry appears in your world.
 *   2. Edit pages in Foundry's journal editor: add real rules content, add /
 *      reorder / rename pages, etc.
 *   3. Create a SCRIPT macro (not Chat — the dropdown defaults to Chat) and
 *      paste this whole file into it. Save + execute.
 *   4. The macro copies the exported JSON to your clipboard. Paste over the
 *      contents of modules/1547core/foundry/Templates/rulebook.json.
 *   5. Run release.ps1 to ship the updated rulebook.
 *
 * GM-only (the macro reads world journals).
 */

const ENTRY_NAME = "1547 Rule Book";

if (!game.user?.isGM) {
    ui.notifications.error("Rule Book export must be run by the GM.");
    return;
}

const entry = game.journal?.find((j) => j.name === ENTRY_NAME);
if (!entry) {
    ui.notifications.warn(`No journal named "${ENTRY_NAME}" found. Edit ENTRY_NAME in the macro if you renamed it.`);
    return;
}

// Reduce a JournalEntry to the minimal shape buildRulebookPack expects:
// { _id, name, pages: [{ title, content }] }.
const sortedPages = [...entry.pages.contents].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
const sourceDoc = {
    _id: entry.id,
    name: entry.name,
    pages: sortedPages.map((p) => ({
        title: p.name,
        content: p.text?.content ?? ""
    }))
};

const json = JSON.stringify([sourceDoc], null, 2);
console.log(`1547core | Rule Book export: ${sortedPages.length} page(s)`);
console.table(sortedPages.map((p) => ({ title: p.name, contentLength: (p.text?.content ?? "").length })));
console.log(json);

try {
    await navigator.clipboard.writeText(json);
    ui.notifications.info(
        `Exported "${ENTRY_NAME}" (${sortedPages.length} pages). JSON copied to clipboard — paste into modules/1547core/foundry/Templates/rulebook.json.`
    );
} catch (err) {
    console.error("clipboard copy failed:", err);
    ui.notifications.warn(
        `Exported ${sortedPages.length} page(s) to console. Clipboard write failed — copy from console manually (F12).`
    );
}
