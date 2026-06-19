import { MODULE_ID, CHANGESET_TEMPLATE_ID } from "../lib/constants.mjs";
/**
 * Tier display for the actor sheet.
 *
 * Tier is derived: it equals the number of Boost-group ChangeSets attached
 * to the actor (per monster-maker-spec-v1.md). Displays a header line plus a
 * compact summary of which boosts were applied, grouped by name with counts.
 *
 * Injection is done via the `renderActorSheet` hook with a defensive
 * selector cascade — if CSB's DOM conventions shift the target panel,
 * the feature degrades silently rather than throwing.
 */

const BADGE_CLASS = "tier-display-1547core";

function isBoostChangeSet(item) {
    if (item?.system?.template !== CHANGESET_TEMPLATE_ID) return false;
    return String(item?.system?.props?.Group ?? "").trim() === "Boost";
}

export function computeBoostTier(actor) {
    if (!actor?.items) return 0;
    let count = 0;
    for (const item of actor.items) {
        if (isBoostChangeSet(item)) count += 1;
    }
    return count;
}

/**
 * Returns an ordered array of { name, count } for each unique Boost item
 * attached to the actor — preserving original creation order of first
 * occurrence so the display reads chronologically.
 */
export function computeBoostSummary(actor) {
    if (!actor?.items) return [];
    const order = [];
    const counts = new Map();
    for (const item of actor.items) {
        if (!isBoostChangeSet(item)) continue;
        const name = String(item.name ?? "Boost").replace(/^Boost:\s*/i, "").trim() || "Boost";
        if (!counts.has(name)) {
            order.push(name);
            counts.set(name, 0);
        }
        counts.set(name, counts.get(name) + 1);
    }
    return order.map((name) => ({ name, count: counts.get(name) }));
}

function findBoostControlsElement(root) {
    if (!root?.querySelector) return null;
    return root.querySelector('[data-key="BoostControls"]')
        ?? root.querySelector('[data-name="BoostControls"]')
        ?? root.querySelector('.boost-controls')
        ?? null;
}

function buildBadge(tier, summary) {
    const wrapper = document.createElement("div");
    wrapper.className = BADGE_CLASS;
    wrapper.style.cssText = "padding: 4px 6px; margin: 0 0 4px 0; border: 1px solid rgba(0,0,0,0.2); border-radius: 3px; background: rgba(0,0,0,0.05); font-size: 0.9em;";
    wrapper.dataset.module = MODULE_ID;

    const header = document.createElement("div");
    header.style.cssText = "text-align: center; font-weight: bold; margin-bottom: 2px;";
    header.textContent = `Tier: ${tier}`;
    wrapper.appendChild(header);

    if (summary.length === 0) {
        return wrapper;
    }

    const body = document.createElement("div");
    body.style.cssText = "text-align: center; opacity: 0.85; line-height: 1.3;";
    body.textContent = summary
        .map(({ name, count }) => count > 1 ? `${name} ×${count}` : name)
        .join(" · ");
    wrapper.appendChild(body);

    return wrapper;
}

export function injectTierBadge(actor, html) {
    const root = html?.[0] ?? html;
    const target = findBoostControlsElement(root);
    if (!target) return false;

    for (const stale of target.querySelectorAll(`:scope > .${BADGE_CLASS}`)) {
        stale.remove();
    }

    target.prepend(buildBadge(computeBoostTier(actor), computeBoostSummary(actor)));
    return true;
}

export function registerTierDisplay() {
    Hooks.on("renderActorSheet", (app, html) => {
        const actor = app?.actor ?? app?.object;
        if (!actor || actor.documentName !== "Actor") return;
        if (actor.type === "_template") return;
        // The tier/composition badge is a monster-maker concept (Boost tier). Hide
        // it on player characters (TypeDropdown "Player") and on untyped actors —
        // only typed monsters get a composition tier.
        const type = String(actor.system?.props?.TypeDropdown ?? "").trim();
        if (!type || type === "Player") return;
        injectTierBadge(actor, html);
    });

    const moduleApi = game.modules.get(MODULE_ID);
    if (!moduleApi) {
        console.warn(`${MODULE_ID} | registerTierDisplay: module not found`);
        return;
    }
    moduleApi.api = moduleApi.api ?? {};
    moduleApi.api.computeBoostTier = computeBoostTier;
    moduleApi.api.computeBoostSummary = computeBoostSummary;
}
