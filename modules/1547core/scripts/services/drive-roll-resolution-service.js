/**
 * Drive-roll resolution service.
 *
 * A ChangeSet can carry a Change of Kind `DriveRoll` that names a 3d6 drive
 * RollTable (`DriveRollTable`) and an optional `DriveCategory`. When the
 * ChangeSet settles on an actor, the table is rolled EXACTLY ONCE (cached on the
 * Change like the item-grant roll cache); a non-blank result is appended to the
 * actor's DriveTable via drive-store. A blank table result adds nothing.
 *
 * Drives are KEPT if the ChangeSet is later removed — a conviction, once formed,
 * sticks — so there is deliberately no delete hook. Rolls do not repeat
 * (cached); a freshly-built monster rolls fresh (no cache on new Changes).
 *
 * Modelled on rolltable-resolution-service; GM-only, single-flight per actor.
 */

import { MODULE_ID, CHANGESET_TEMPLATE_ID, CHANGE_TEMPLATE_ID } from "../lib/constants.mjs";
import { getContainerChildItems } from "./csb-container-helpers.mjs";
import { getTableById } from "./content-registry.js";
import { addDrive } from "./drive-store.mjs";

const CHANGE_CONTAINER_KEY = "ChangeDisplayer";
const ROLLED_FLAG = "rolledResult";
const RESOLVE_GUARD = "_1547core_rollingDrives";

function isChangeSet(item) { return item?.system?.template === CHANGESET_TEMPLATE_ID; }
function isChange(item) { return item?.system?.template === CHANGE_TEMPLATE_ID; }

// Read the DriveRoll target. Scalar props survive CSB data-prep, but read
// `_source` as a fallback to be safe.
export function getDriveRollTarget(change) {
    const props = change?.system?.props ?? {};
    const src = change?._source?.system?.props ?? {};
    if ((props.Kind ?? src.Kind) !== "DriveRoll") return null;
    const tableId = String(props.DriveRollTable ?? src.DriveRollTable ?? "").trim();
    if (!tableId) return null;
    const category = String(props.DriveCategory ?? src.DriveCategory ?? "").trim();
    return { tableId, category };
}

export function getCachedRoll(change) {
    return change?.flags?.[MODULE_ID]?.[ROLLED_FLAG] ?? null;
}

/** Pure: enumerate DriveRoll Changes whose cache is missing or points at a different table. */
export function findDriveRollsNeeded(actor) {
    const result = [];
    for (const set of Array.from(actor?.items ?? []).filter(isChangeSet)) {
        const changes = getContainerChildItems(set, actor, CHANGE_CONTAINER_KEY, CHANGE_TEMPLATE_ID);
        for (const change of changes) {
            const target = getDriveRollTarget(change);
            if (!target) continue;
            const cached = getCachedRoll(change);
            if (cached?.tableUuid === target.tableId) continue;
            result.push({ changeId: change.id, tableId: target.tableId, category: target.category });
        }
    }
    return result;
}

/** Pure: format a rolled drive line, or null for a blank result. */
export function formatDriveLine(category, text) {
    const clean = String(text ?? "").trim();
    if (!clean) return null;
    const cat = String(category ?? "").trim();
    return cat ? `[${cat}] ${clean}` : clean;
}

// Roll 3d6 (or the table's own formula) and return the matching result's text.
// Rolls the formula directly rather than table.roll() so a compendium-sourced
// table isn't written to.
async function rollTableText(table) {
    if (!table) return "";
    const formula = String(table.formula ?? "3d6").trim() || "3d6";
    const roll = await new Roll(formula).evaluate();
    const total = Number(roll.total ?? 0) || 0;
    for (const r of Array.from(table.results ?? [])) {
        const range = Array.isArray(r.range) ? r.range : [r?.range?.[0], r?.range?.[1]];
        const lo = Number(range?.[0]);
        const hi = Number(range?.[1]);
        if (Number.isFinite(lo) && Number.isFinite(hi) && total >= lo && total <= hi) {
            return String(r.text ?? "");
        }
    }
    return "";
}

const inFlight = new WeakSet();

export async function rollDriveTables(actor) {
    if (!actor || actor.documentName !== "Actor") return;
    if (actor.type === "_template") return;
    if (!globalThis.game?.user?.isGM) return;
    if (inFlight.has(actor)) return;

    const needed = findDriveRollsNeeded(actor);
    if (!needed.length) return;

    inFlight.add(actor);
    try {
        for (const target of needed) {
            const change = actor.items.get(target.changeId);
            if (!change) continue;
            const table = getTableById(target.tableId);
            if (!table) {
                console.warn(`${MODULE_ID} | DriveRoll: table '${target.tableId}' not found for actor ${actor.name}`);
                continue;
            }
            const text = await rollTableText(table);
            const line = formatDriveLine(target.category, text);
            if (line) await addDrive(actor, line);
            await change.setFlag(MODULE_ID, ROLLED_FLAG, {
                tableUuid: target.tableId,
                rolledAt: Date.now(),
                driveText: line ?? ""
            });
        }
    } finally {
        inFlight.delete(actor);
    }
}

function shouldTrigger(item, options) {
    if (options?.[RESOLVE_GUARD]) return false;
    if (item?.parent?.documentName !== "Actor") return false;
    return isChangeSet(item) || isChange(item);
}

export function registerDriveRollResolutionService() {
    Hooks.on("createItem", (item, options) => {
        if (!shouldTrigger(item, options)) return;
        const actor = item?.parent;
        if (actor) void rollDriveTables(actor);
    });
    Hooks.on("updateItem", (item, _change, options) => {
        if (!shouldTrigger(item, options)) return;
        const actor = item?.parent;
        if (actor) void rollDriveTables(actor);
    });
    // No deleteItem hook: rolled drives persist even if the ChangeSet is removed.

    const moduleApi = globalThis.game?.modules?.get?.(MODULE_ID);
    if (moduleApi) {
        moduleApi.api = moduleApi.api ?? {};
        moduleApi.api.rollDriveTables = rollDriveTables;
        moduleApi.api.findDriveRollsNeeded = findDriveRollsNeeded;
    }
}
