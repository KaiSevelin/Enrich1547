import { assignSides, orderSidesByInitiative } from "../combat/side-assignment.mjs";
import { getMovementBudget } from "../combat/movement-budget.mjs";
import { ACTOR_TYPES } from "../lib/build-helpers.mjs";

const MODULE_ID = "1547core";
// The monster/NPC actor types. Anything else (incl. "Player" and untyped) is a PC.
const MONSTER_TYPES = new Set(ACTOR_TYPES.filter((type) => type !== "Player"));
const DEFAULT_TEAM_IDS = ["team-1", "team-2"];

function escapeHtml(value) {
    return foundry.utils.escapeHTML(String(value ?? ""));
}

function getCombatantRows(root) {
    return Array.from(root.querySelectorAll("li.combatant, .combatant"))
        .filter((row) => row instanceof HTMLElement)
        .filter((row) => getCombatantRowId(row));
}

function getCombatantRowId(row) {
    if (!row) return "";
    const direct = row.dataset?.combatantId
        || row.getAttribute?.("data-combatant-id")
        || row.dataset?.documentId
        || row.getAttribute?.("data-document-id")
        || row.dataset?.entryId
        || row.getAttribute?.("data-entry-id")
        || "";
    if (direct) return String(direct);
    const nested = row.querySelector?.("[data-combatant-id], [data-document-id], [data-entry-id]");
    return String(
        nested?.dataset?.combatantId
        || nested?.getAttribute?.("data-combatant-id")
        || nested?.dataset?.documentId
        || nested?.getAttribute?.("data-document-id")
        || nested?.dataset?.entryId
        || nested?.getAttribute?.("data-entry-id")
        || ""
    );
}

function getTrackerList(root) {
    return root.querySelector("ol#combat-tracker")
        ?? root.querySelector("ol.combat-tracker")
        ?? root.querySelector("#combat-tracker")
        ?? root.querySelector(".combat-tracker.directory-list")
        ?? root.querySelector("ol.directory-list")
        ?? root.querySelector(".directory-list");
}

export function getStoredSideId(combatant) {
    const sideId = combatant?.flags?.[MODULE_ID]?.sideId;
    return typeof sideId === "string" && sideId.trim() ? sideId.trim() : "";
}

function getCombatantTokenDocument(combatant) {
    return combatant?.token?.object?.document
        ?? combatant?.token?.document
        ?? combatant?.scene?.tokens?.get?.(combatant?.tokenId)
        ?? game.scenes?.get?.(combatant?.sceneId ?? game.combat?.scene?.id)?.tokens?.get?.(combatant?.tokenId)
        ?? canvas?.scene?.tokens?.get?.(combatant?.tokenId)
        ?? null;
}

function deriveDefaultSideId(combatant) {
    const tokenDocument = getCombatantTokenDocument(combatant);
    const disposition = tokenDocument?.disposition
        ?? combatant?.token?.object?.document?.disposition
        ?? combatant?.token?.disposition
        ?? combatant?.actor?.token?.disposition
        ?? combatant?.actor?.prototypeToken?.disposition
        ?? null;

    if (Number(disposition) > 0) return "team-1";
    if (Number(disposition) < 0) return "team-2";
    if (combatantIsPlayer(combatant)) return "team-1";
    return "team-2";
}

// A player character: owned by a player, OR not an explicit MONSTER type — so a
// GM-owned PC, and a freshly-made chargen actor whose TypeDropdown isn't stored
// yet (reads ""), both count. Mirrors the codebase convention that any non-Player
// TypeDropdown is a monster (changeset-drop-hook / tier-display). Used for both
// the disposition default and the two+ players split.
function combatantIsPlayer(combatant) {
    if (combatant?.actor?.hasPlayerOwner === true) return true;
    const type = String(combatant?.actor?.system?.props?.TypeDropdown ?? "").trim();
    return !MONSTER_TYPES.has(type);
}

export function resolveCombatantSideId(combatant) {
    return getStoredSideId(combatant) || deriveDefaultSideId(combatant);
}

export function getSideLabel(sideId) {
    const normalized = String(sideId ?? "").trim();
    if (!normalized) return "Unassigned";
    const match = normalized.match(/^team-(\d+)$/i);
    if (match) return `Team ${match[1]}`;
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function getAvailableTeamIds(combat, orderedCombatants = []) {
    const storedOrder = Array.isArray(combat?.flags?.[MODULE_ID]?.sideOrder)
        ? combat.flags[MODULE_ID].sideOrder.filter((value) => typeof value === "string" && value.trim())
        : [];
    const storedSides = combat?.flags?.[MODULE_ID]?.sides && typeof combat.flags[MODULE_ID].sides === "object"
        ? Object.keys(combat.flags[MODULE_ID].sides).filter((value) => typeof value === "string" && value.trim())
        : [];
    const encountered = [];
    // Stored side order is authoritative (it carries the fixed 3d6 side-initiative
    // result); DEFAULT_TEAM_IDS only fill in sides not yet ordered. Seeding the
    // defaults first would pin team-1 ahead of team-2 and silently override the
    // initiative ordering.
    for (const sideId of [...storedOrder, ...DEFAULT_TEAM_IDS, ...storedSides]) {
        if (sideId && !encountered.includes(sideId)) encountered.push(sideId);
    }
    for (const combatant of orderedCombatants) {
        const sideId = resolveCombatantSideId(combatant);
        if (sideId && !encountered.includes(sideId)) encountered.push(sideId);
    }
    return encountered;
}

function getNextTeamId(combat, orderedCombatants = []) {
    const teamIds = getAvailableTeamIds(combat, orderedCombatants);
    let maxIndex = 1;
    for (const sideId of teamIds) {
        const match = String(sideId).match(/^team-(\d+)$/i);
        if (match) maxIndex = Math.max(maxIndex, Number(match[1]) || 1);
    }
    return `team-${maxIndex + 1}`;
}

async function addTeam(combat, app) {
    const orderedCombatants = getOrderedCombatants(combat);
    const nextTeamId = getNextTeamId(combat, orderedCombatants);
    const currentOrder = getResolvedSideOrder(combat, orderedCombatants);
    const nextOrder = currentOrder.includes(nextTeamId) ? currentOrder : [...currentOrder, nextTeamId];
    await combat.setFlag(MODULE_ID, "sideOrder", nextOrder);
    await persistCombatSideState(combat);
    app?.render?.(true);
    ui.notifications?.info?.(`${getSideLabel(nextTeamId)} added to the encounter.`);
}

export function getOrderedCombatants(combat) {
    return Array.from(combat?.turns ?? combat?.combatants?.contents ?? []);
}

export function getActiveSideId(combat, orderedCombatants) {
    const stored = combat?.flags?.[MODULE_ID]?.activeSideId;
    if (typeof stored === "string" && stored.trim()) return stored.trim();
    const currentCombatant = orderedCombatants[Number(combat?.turn) || 0] ?? orderedCombatants[0] ?? null;
    return currentCombatant ? resolveCombatantSideId(currentCombatant) : "";
}

export function getResolvedSideOrder(combat, orderedCombatants) {
    const stored = getAvailableTeamIds(combat, orderedCombatants);
    const encountered = [];
    for (const combatant of orderedCombatants) {
        const sideId = resolveCombatantSideId(combatant);
        if (sideId && !encountered.includes(sideId)) encountered.push(sideId);
    }
    for (const sideId of encountered) {
        if (!stored.includes(sideId)) stored.push(sideId);
    }
    return stored.length ? stored : encountered;
}

function buildSidesMap(combatants, sideOrder) {
    return sideOrder.reduce((map, sideId) => {
        map[sideId] = {
            id: sideId,
            label: getSideLabel(sideId),
            combatantIds: combatants.filter((combatant) => resolveCombatantSideId(combatant) === sideId).map((combatant) => combatant.id),
        };
        return map;
    }, {});
}

export function buildCombatSideState(combat, orderedCombatants) {
    const sideOrder = getResolvedSideOrder(combat, orderedCombatants);
    const activeSideId = getActiveSideId(combat, orderedCombatants) || sideOrder[0] || "";
    return {
        sideOrder,
        activeSideId,
        roundNumber: Number(combat?.round) || 1,
        sides: buildSidesMap(orderedCombatants, sideOrder),
    };
}

export async function persistCombatSideState(combat) {
    // Combat-state flags are GM-authoritative. These run from document hooks that
    // fire on every client, so non-GMs must not attempt the write (Foundry denies
    // it; the flag changes propagate to players via the GM's update).
    if (!game.user?.isGM) return;
    const orderedCombatants = getOrderedCombatants(combat);
    const sideState = buildCombatSideState(combat, orderedCombatants);
    await combat.setFlag(MODULE_ID, "sideOrder", sideState.sideOrder);
    await combat.setFlag(MODULE_ID, "activeSideId", sideState.activeSideId);
    await combat.setFlag(MODULE_ID, "roundNumber", sideState.roundNumber);
    await combat.setFlag(MODULE_ID, "sides", sideState.sides);
}

/**
 * Restore the once-per-turn resources for every (non-defeated) member of a side
 * when that side's window begins: refill `MovementRemaining` to the movement
 * budget, and re-enable `FullTurnAvailable` (spent when a full-turn maneuver
 * commits). GM-authoritative; each actor gets at most one update with only the
 * fields that actually changed. No-ops gracefully for actors that don't define
 * a movement budget. The per-move decrement lives in
 * combat/movement-reactions.js.
 */
export async function resetSideTurnState(combat, sideId) {
    if (!game.user?.isGM || !combat || !sideId) return;
    for (const combatant of getOrderedCombatants(combat)) {
        if (combatant?.defeated) continue;
        if (resolveCombatantSideId(combatant) !== sideId) continue;
        const actor = combatant.actor;
        if (!actor) continue;
        const props = actor.system?.props ?? {};
        const update = {};

        const budget = getMovementBudget(actor);
        if (Number.isFinite(budget) && budget > 0 && Number(props.MovementRemaining) !== budget) {
            update["system.props.MovementRemaining"] = budget;
        }
        // A fresh turn restores the full-turn action. Stored as a boolean
        // (planCommitFullTurnManeuver writes `false`); only write when not already on.
        if (props.FullTurnAvailable !== true) {
            update["system.props.FullTurnAvailable"] = true;
        }

        if (Object.keys(update).length) await actor.update(update);
    }
}

/**
 * Zero every combatant's leftover RiskPoints when combat ends (battle-flow
 * spec §"Crit and Fumble Rules": remaining RiskPoints are set to 0). GM
 * only; skips actors that already read 0.
 */
async function clearCombatRiskPoints(combat) {
    if (!game.user?.isGM || !combat) return;
    for (const combatant of getOrderedCombatants(combat)) {
        const actor = combatant?.actor;
        if (!actor) continue;
        if (!Number(actor.system?.props?.RiskPoints)) continue;
        await actor.update({ "system.props.RiskPoints": 0 });
    }
}

/**
 * Realign the authoritative active-side flag with Foundry's combat cursor
 * when native turn/round navigation (the tracker's Next/Previous arrows)
 * moves the cursor onto a different side. Without this the highlighted side,
 * the off-turn facing lock, and movement refill would desync from `combat.turn`.
 * GM-authoritative; only writes when the cursor side actually differs from the
 * stored flag (so it never fights the Side-Ready advance, which sets both).
 */
async function syncActiveSideToCursor(combat) {
    if (!game.user?.isGM || !combat?.started) return;
    const ordered = getOrderedCombatants(combat);
    const cursor = ordered[Number(combat.turn) || 0] ?? ordered[0] ?? null;
    if (!cursor) return;
    const cursorSideId = resolveCombatantSideId(cursor);
    if (!cursorSideId) return;
    if (cursorSideId === combat.flags?.[MODULE_ID]?.activeSideId) return;
    await combat.setFlag(MODULE_ID, "activeSideId", cursorSideId);
    await persistCombatSideState(combat);
    await resetSideTurnState(combat, cursorSideId);
}

function ensureCombatantSideChip(row, sideId) {
    const header = row.querySelector(".token-name") ?? row.querySelector("h4") ?? row.querySelector(".combatant-name") ?? row.querySelector(".name") ?? row;
    if (!header) return;
    let chip = row.querySelector(".combatant-side-chip[data-side-chip]");
    if (!chip) {
        chip = document.createElement("span");
        chip.className = "combatant-side-chip";
        chip.dataset.sideChip = "true";
        header.appendChild(chip);
    }
    chip.textContent = getSideLabel(sideId);
}

function buildSideHeader(sideId, count, isActive) {
    const header = document.createElement("li");
    header.className = "directory-item combat-side-header" + (isActive ? " is-active-side" : "");
    header.dataset.sideId = sideId;
    header.innerHTML = "<div class=\"combat-side-header__row\"><span class=\"combat-side-header__label\">" + escapeHtml(getSideLabel(sideId)) + "</span><span class=\"combat-side-header__meta\">" + count + " member" + (count === 1 ? "" : "s") + "</span></div>";
    return header;
}

function buildTrackerToolbar(app, combat) {
    const wrapper = document.createElement("div");
    wrapper.className = "combat-side-toolbar";
    const orderedCombatants = getOrderedCombatants(combat);
    const activeSideId = getActiveSideId(combat, orderedCombatants);
    wrapper.innerHTML = "<div class=\"combat-side-toolbar__status\">Active Side: <strong>" + escapeHtml(getSideLabel(activeSideId || "")) + "</strong></div>" +
        "<button type=\"button\" class=\"combat-side-toolbar__button\" data-side-assignment>Assign Teams</button>";
    const button = wrapper.querySelector("[data-side-assignment]");
    button?.addEventListener("click", () => void showTeamAssignmentDialog(combat, app));
    return wrapper;
}

function upsertTrackerToolbar(root, app, combat) {
    const header = root.querySelector("header.directory-header") ?? root.querySelector("header");
    if (!header) return;
    const existing = root.querySelector(".combat-side-toolbar[data-side-toolbar]");
    existing?.remove();
    const toolbar = buildTrackerToolbar(app, combat);
    toolbar.dataset.sideToolbar = "true";
    header.insertAdjacentElement("afterend", toolbar);
}

function decorateCombatTracker(app, html) {
    const root = html?.[0] ?? html;
    const combat = app?.viewed ?? game.combat;
    if (!root || !combat) return;

    upsertTrackerToolbar(root, app, combat);

    const list = getTrackerList(root);
    if (!list) return;

    const rows = getCombatantRows(list);
    if (!rows.length) return;

    const orderedCombatants = getOrderedCombatants(combat);
    const rowById = new Map(rows.map((row) => [getCombatantRowId(row), row]).filter(([id]) => id));
    const presentCombatants = orderedCombatants.filter((combatant) => rowById.has(String(combatant?.id ?? "")));
    if (!presentCombatants.length) return;

    const sideOrder = getResolvedSideOrder(combat, presentCombatants);
    const activeSideId = getActiveSideId(combat, presentCombatants);
    const grouped = new Map();

    for (const combatant of presentCombatants) {
        const sideId = resolveCombatantSideId(combatant);
        if (!grouped.has(sideId)) grouped.set(sideId, []);
        grouped.get(sideId).push(combatant);
    }

    const fragment = document.createDocumentFragment();
    for (const sideId of sideOrder) {
        const members = grouped.get(sideId) ?? [];
        if (!members.length) continue;
        fragment.appendChild(buildSideHeader(sideId, members.length, sideId === activeSideId));
        for (const combatant of members) {
            const row = rowById.get(String(combatant.id));
            if (!row) continue;
            row.dataset.sideId = sideId;
            row.classList.toggle("is-active-side-member", sideId === activeSideId);
            ensureCombatantSideChip(row, sideId);
            fragment.appendChild(row);
        }
    }

    list.replaceChildren(fragment);
    list.dataset.activeSideId = activeSideId || "";
}

function buildTeamAssignmentContent(combat, combatants) {
    return `
        <form class="combat-side-assignment-form">
            <p class="notes">Assign each combatant to a side. Defaults are seeded from disposition.</p>
            <div class="combat-side-assignment-list">
                ${combatants.map((combatant) => {
                    const sideId = resolveCombatantSideId(combatant);
                    const options = getAvailableTeamIds(combat, combatants).map((teamId) => {
                        const selected = teamId === sideId ? "selected" : "";
                        return `<option value="${escapeHtml(teamId)}" ${selected}>${escapeHtml(getSideLabel(teamId))}</option>`;
                    }).join("");
                    return `<div class="combat-side-assignment-row"><label>${escapeHtml(combatant.name || combatant.actor?.name || "Combatant")}</label><select name="combatant-${escapeHtml(combatant.id)}">${options}</select></div>`;
                }).join("")}
            </div>
        </form>
    `;
}

async function saveTeamAssignments(combat, html) {
    const orderedCombatants = getOrderedCombatants(combat);
    for (const combatant of orderedCombatants) {
        const input = html.find(`[name="combatant-${combatant.id}"]`)[0];
        const nextSideId = String(input?.value ?? deriveDefaultSideId(combatant)).trim() || "team-2";
        await combatant.setFlag(MODULE_ID, "sideId", nextSideId);
    }
    await persistCombatSideState(combat);
}

async function showTeamAssignmentDialog(combat, app) {
    const combatants = getOrderedCombatants(combat);
    const dialog = new Dialog({
        title: "Assign Combat Teams",
        content: buildTeamAssignmentContent(combat, combatants),
        buttons: {
            save: {
                icon: '<i class="fas fa-users"></i>',
                label: "Save Teams",
                callback: async (html) => {
                    await saveTeamAssignments(combat, html);
                    app?.render?.(true);
                },
            },
            cancel: {
                label: "Cancel",
            },
        },
        default: "save",
    });
    dialog.render(true);
}

function combatantOwnerUserIds(combatant) {
    const actor = combatant?.actor;
    if (!actor) return [];
    const users = game.users?.filter?.(
        (user) => user && !user.isGM && actor.testUserPermission?.(user, "OWNER")
    ) ?? [];
    return users.map((user) => user.id);
}

function combatantDisposition(combatant) {
    const tokenDocument = getCombatantTokenDocument(combatant);
    return tokenDocument?.disposition
        ?? combatant?.token?.object?.document?.disposition
        ?? combatant?.token?.disposition
        ?? combatant?.actor?.token?.disposition
        ?? combatant?.actor?.prototypeToken?.disposition
        ?? null;
}

async function roll3d6Total() {
    const roll = await new Roll("3d6").evaluate();
    return Number(roll.total) || 0;
}

// Roll 3d6 per side, then re-roll tied sides (a roll-off) until every side has a
// distinct total, so the fixed turn order is unambiguous. Capped to avoid an
// infinite loop in the vanishingly unlikely event rolls keep colliding.
async function rollSideInitiative(sideIds) {
    const rollsBySide = new Map();
    for (const sideId of sideIds) rollsBySide.set(sideId, await roll3d6Total());
    for (let attempt = 0; attempt < 50; attempt += 1) {
        const byTotal = new Map();
        for (const [sideId, total] of rollsBySide) {
            const group = byTotal.get(total) ?? [];
            group.push(sideId);
            byTotal.set(total, group);
        }
        const tied = [...byTotal.values()].filter((group) => group.length > 1).flat();
        if (!tied.length) break;
        for (const sideId of tied) rollsBySide.set(sideId, await roll3d6Total());
    }
    return rollsBySide;
}

async function postSideInitiativeMessage(sideOrder, rollsBySide) {
    try {
        const rows = sideOrder.map((sideId, index) =>
            `<li><strong>${index + 1}. ${escapeHtml(getSideLabel(sideId))}</strong> — 3d6: ${rollsBySide.get(sideId) ?? "?"}</li>`
        ).join("");
        const content = `<div class="onefivefourseven-side-initiative"><h3>Side Initiative</h3><ol>${rows}</ol></div>`;
        const publicMode = globalThis.CONST?.DICE_ROLL_MODES?.PUBLIC ?? "publicroll";
        await ChatMessage.create({ content, rollMode: publicMode });
    } catch (error) {
        console.error(`${MODULE_ID} | side-initiative chat message failed`, error);
    }
}

/**
 * Apply the side-assignment rule across all combatants (GM-authoritative):
 * assignSides splits two+ players (players-only -> opposing sides; mixed ->
 * party together, NPCs by disposition). Runs as combatants are ADDED so two
 * players split the moment the second joins — not only at Begin Combat.
 * Combatants the rule doesn't cover keep their existing/derived side.
 */
export async function applyAutoSideAssignment(combat) {
    if (!game.user?.isGM || !combat) return;
    const orderedCombatants = getOrderedCombatants(combat);
    if (!orderedCombatants.length) return;
    const assignment = assignSides(orderedCombatants.map((combatant) => ({
        id: combatant.id,
        isPlayer: combatantIsPlayer(combatant),
        ownerUserIds: combatantOwnerUserIds(combatant),
        disposition: combatantDisposition(combatant),
    })));
    for (const combatant of orderedCombatants) {
        const sideId = assignment.get(combatant.id) ?? resolveCombatantSideId(combatant);
        if (getStoredSideId(combatant) !== sideId) {
            await combatant.setFlag(MODULE_ID, "sideId", sideId);
        }
    }
}

/**
 * Run once when combat starts (GM-authoritative). Enforces two rules:
 *   1. Side assignment (see applyAutoSideAssignment) — two+ players never
 *      share a side.
 *   2. Each side rolls 3d6 group initiative; the result fixes the side turn
 *      order (highest first) for the rest of the combat.
 * Guarded by a flag so a re-fired combatStart never re-rolls or re-assigns.
 */
export async function applyCombatStartSidesAndInitiative(combat) {
    if (!game.user?.isGM || !combat) return;
    if (combat.getFlag(MODULE_ID, "sideInitiativeRolled")) return;

    const orderedCombatants = getOrderedCombatants(combat);
    if (!orderedCombatants.length) return;

    // 1) Side assignment — two+ players never share a side.
    await applyAutoSideAssignment(combat);

    // 2) 3d6 side initiative — roll per side, order high-first (fixed).
    const sideIds = [];
    for (const combatant of orderedCombatants) {
        const sideId = resolveCombatantSideId(combatant);
        if (sideId && !sideIds.includes(sideId)) sideIds.push(sideId);
    }
    const rollsBySide = await rollSideInitiative(sideIds);
    const sideOrder = orderSidesByInitiative(sideIds, rollsBySide);

    await combat.setFlag(MODULE_ID, "sideOrder", sideOrder);
    await combat.setFlag(MODULE_ID, "activeSideId", sideOrder[0] ?? "");
    await combat.setFlag(MODULE_ID, "sideInitiativeRolled", true);
    await persistCombatSideState(combat);
    await postSideInitiativeMessage(sideOrder, rollsBySide);
}

export function register1547CombatTrackerSideGroups() {
    Hooks.on("createCombat", (combat) => {
        void persistCombatSideState(combat);
    });
    Hooks.on("combatStart", (combat) => {
        void applyCombatStartSidesAndInitiative(combat);
    });
    Hooks.on("createCombatant", (combatant) => {
        const combat = combatant.combat;
        if (!combat || !game.user?.isGM) return;
        void (async () => {
            // Before combat starts, re-run the group assignment so two players
            // split onto opposing sides as soon as the second is added. Once
            // combat is live the sides are fixed — just give the newcomer a side.
            if (combat.started) {
                await combatant.setFlag(MODULE_ID, "sideId", resolveCombatantSideId(combatant));
            } else {
                await applyAutoSideAssignment(combat);
            }
            await persistCombatSideState(combat);
        })();
    });
    Hooks.on("deleteCombatant", (combatant) => {
        if (combatant.combat) void persistCombatSideState(combatant.combat);
    });
    Hooks.on("updateCombatant", (combatant) => {
        if (combatant.combat) void persistCombatSideState(combatant.combat);
    });
    Hooks.on("updateCombat", (combat, changes) => {
        // Native turn/round navigation only — flag-only updates (our own
        // setFlag writes) carry no turn/round change, so this never loops.
        if (!changes || !("turn" in changes || "round" in changes)) return;
        void syncActiveSideToCursor(combat);
    });
    Hooks.on("deleteCombat", (combat) => {
        void clearCombatRiskPoints(combat);
    });
    Hooks.on("renderCombatTracker", (app, html) => {
        try {
            decorateCombatTracker(app, html);
        } catch (error) {
            console.error(`${MODULE_ID} | register1547CombatTrackerSideGroups failed`, error);
        }
    });
}

