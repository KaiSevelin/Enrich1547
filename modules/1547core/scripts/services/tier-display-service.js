/**
 * Tier display for the actor sheet.
 *
 * Tier is derived: it equals the number of Boost-group ChangeSets attached
 * to the actor (per monster-maker-spec-v1.md). The composition-service
 * already exposes the count via the pipeline; this module renders it on
 * the rendered actor sheet, inside the BoostControls panel.
 *
 * Injection is done via the `renderActorSheet` hook with a defensive
 * selector cascade — if CSB's DOM conventions shift the target panel,
 * the feature degrades silently rather than throwing.
 */

const MODULE_ID = "1547core";
const CHANGESET_TEMPLATE_ID = "b7A1z6cSZO4dYTKT";
const BADGE_CLASS = "tier-display-1547core";

export function computeBoostTier(actor) {
    if (!actor?.items) return 0;
    let count = 0;
    for (const item of actor.items) {
        if (item?.system?.template !== CHANGESET_TEMPLATE_ID) continue;
        if (String(item?.system?.props?.Group ?? "").trim() !== "Boost") continue;
        count += 1;
    }
    return count;
}

function findBoostControlsElement(root) {
    if (!root?.querySelector) return null;
    return root.querySelector('[data-key="BoostControls"]')
        ?? root.querySelector('[data-name="BoostControls"]')
        ?? root.querySelector('.boost-controls')
        ?? null;
}

function buildBadge(tier) {
    const badge = document.createElement("div");
    badge.className = BADGE_CLASS;
    badge.style.cssText = "text-align: center; font-weight: bold; padding: 4px 6px; margin: 0 0 4px 0; border: 1px solid rgba(0,0,0,0.2); border-radius: 3px; background: rgba(0,0,0,0.05);";
    badge.textContent = `Tier: ${tier}`;
    badge.dataset.module = MODULE_ID;
    return badge;
}

export function injectTierBadge(actor, html) {
    const root = html?.[0] ?? html;
    const target = findBoostControlsElement(root);
    if (!target) return false;

    for (const stale of target.querySelectorAll(`:scope > .${BADGE_CLASS}`)) {
        stale.remove();
    }

    target.prepend(buildBadge(computeBoostTier(actor)));
    return true;
}

export function registerTierDisplay() {
    Hooks.on("renderActorSheet", (app, html) => {
        const actor = app?.actor ?? app?.object;
        if (!actor || actor.documentName !== "Actor") return;
        if (actor.type === "_template") return;
        injectTierBadge(actor, html);
    });

    const moduleApi = game.modules.get(MODULE_ID);
    if (!moduleApi) {
        console.warn(`${MODULE_ID} | registerTierDisplay: module not found`);
        return;
    }
    moduleApi.api = moduleApi.api ?? {};
    moduleApi.api.computeBoostTier = computeBoostTier;
}
