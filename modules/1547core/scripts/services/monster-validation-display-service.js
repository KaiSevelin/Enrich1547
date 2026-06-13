/**
 * Monster validation display.
 *
 * Surfaces the validateMonster() violations in two places:
 *   - A warning badge injected on the actor sheet (above CompositionPanel)
 *     whenever the actor has at least one violation. Re-renders are
 *     idempotent — the badge is removed and re-added on each render.
 *   - A one-line console audit on `ready`, summarising how many world
 *     actors have violations and naming any monsters missing a Base
 *     chassis. Quiet when everything checks out.
 *
 * Both consume `validateMonster()` from changeset-drop-hook.js — the same
 * function the API already exposes via game.modules.get("1547core").api.
 */

import { validateMonster } from "./changeset-drop-hook.js";
import { MODULE_ID } from "../lib/constants.mjs";

const BADGE_CLASS = "monster-validation-1547core";

function findCompositionPanelElement(root) {
    if (!root?.querySelector) return null;
    return root.querySelector('[data-key="CompositionPanel"]')
        ?? root.querySelector('[data-name="CompositionPanel"]')
        ?? root.querySelector('.composition-panel')
        ?? null;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function buildBadge(violations) {
    const badge = document.createElement("div");
    badge.className = BADGE_CLASS;
    const count = violations.length;
    const summary = count === 1 ? "1 issue" : `${count} issues`;
    const lines = violations.map((v) => `<li>${escapeHtml(v.message)}</li>`).join("");
    badge.innerHTML = `<strong>⚠ Chassis validation: ${summary}</strong><ul style="margin: 4px 0 0 18px; padding: 0;">${lines}</ul>`;
    badge.style.cssText = "padding: 6px 10px; margin: 0 0 8px 0; border: 1px solid #b07a2a; border-radius: 4px; background: rgba(176, 122, 42, 0.1); color: #b07a2a; font-size: 0.85em;";
    badge.dataset.module = MODULE_ID;
    return badge;
}

export function injectValidationBadge(actor, html) {
    const root = html?.[0] ?? html;
    if (!root?.querySelector) return false;

    // Always clear stale badges first so re-renders don't accumulate.
    for (const stale of root.querySelectorAll(`.${BADGE_CLASS}`)) {
        stale.remove();
    }

    const violations = validateMonster(actor);
    if (!violations.length) return false;

    const target = findCompositionPanelElement(root);
    if (!target) return false;
    target.parentElement?.insertBefore(buildBadge(violations), target);
    return true;
}

// Single-pass audit over all world actors. Returns a Map of actorId →
// violations[] for everything that fails. Empty when the world is clean.
export function auditAllMonsters() {
    const out = new Map();
    for (const actor of game.actors ?? []) {
        const violations = validateMonster(actor);
        if (violations.length) out.set(actor.id, violations);
    }
    return out;
}

function logStartupAudit() {
    const audit = auditAllMonsters();
    if (audit.size === 0) return;
    const missingBaseNames = [];
    for (const [actorId, violations] of audit) {
        if (violations.some((v) => v.kind === "missing-base")) {
            const actor = game.actors?.get?.(actorId);
            missingBaseNames.push(actor?.name ?? actorId);
        }
    }
    const summary = `${MODULE_ID} | validateMonster: ${audit.size} actor(s) with violations`;
    const detail = missingBaseNames.length
        ? ` (missing Base: ${missingBaseNames.join(", ")})`
        : "";
    console.info(summary + detail);
}

export function registerMonsterValidationDisplay() {
    Hooks.on("renderActorSheet", (app, html) => {
        const actor = app?.actor ?? app?.object;
        if (!actor || actor.documentName !== "Actor") return;
        if (actor.type === "_template") return;
        try {
            injectValidationBadge(actor, html);
        } catch (error) {
            console.error(`${MODULE_ID} | injectValidationBadge failed`, error);
        }
    });

    try {
        logStartupAudit();
    } catch (error) {
        console.error(`${MODULE_ID} | startup validation audit failed`, error);
    }

    const moduleApi = game.modules.get(MODULE_ID);
    if (!moduleApi) {
        console.warn(`${MODULE_ID} | registerMonsterValidationDisplay: module not found`);
        return;
    }
    moduleApi.api = moduleApi.api ?? {};
    moduleApi.api.auditAllMonsters = auditAllMonsters;
}
