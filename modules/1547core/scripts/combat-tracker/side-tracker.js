const MODULE_ID = "1547core";
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
    if (combatant?.actor?.hasPlayerOwner === true) return "team-1";
    return "team-2";
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
    for (const sideId of [...DEFAULT_TEAM_IDS, ...storedOrder, ...storedSides]) {
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
    const orderedCombatants = getOrderedCombatants(combat);
    const sideState = buildCombatSideState(combat, orderedCombatants);
    await combat.setFlag(MODULE_ID, "sideOrder", sideState.sideOrder);
    await combat.setFlag(MODULE_ID, "activeSideId", sideState.activeSideId);
    await combat.setFlag(MODULE_ID, "roundNumber", sideState.roundNumber);
    await combat.setFlag(MODULE_ID, "sides", sideState.sides);
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

export function register1547CombatTrackerSideGroups() {
    Hooks.on("createCombat", (combat) => {
        void persistCombatSideState(combat);
    });
    Hooks.on("createCombatant", (combatant) => {
        void combatant.setFlag(MODULE_ID, "sideId", resolveCombatantSideId(combatant));
        if (combatant.combat) void persistCombatSideState(combatant.combat);
    });
    Hooks.on("deleteCombatant", (combatant) => {
        if (combatant.combat) void persistCombatSideState(combatant.combat);
    });
    Hooks.on("updateCombatant", (combatant) => {
        if (combatant.combat) void persistCombatSideState(combatant.combat);
    });
    Hooks.on("renderCombatTracker", (app, html) => {
        try {
            decorateCombatTracker(app, html);
        } catch (error) {
            console.error(`${MODULE_ID} | register1547CombatTrackerSideGroups failed`, error);
        }
    });
}

