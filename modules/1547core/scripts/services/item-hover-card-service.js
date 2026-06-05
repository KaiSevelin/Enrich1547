/**
 * Universal item hover-card service.
 *
 * Decorates item DOM elements with `data-tooltip-html` so Foundry's
 * TooltipManager shows a uniformly-styled info panel on hover: image +
 * name + category + enriched description, plus a small stats line when
 * the item carries weight/value/range/dice fields.
 *
 * Read-only enrichment: descriptions run through `TextEditor.enrichHTML`
 * so `@1547[...]` and `@UUID[...]` etc. render formatted. Clicking inside
 * a tooltip doesn't fire — Foundry default tooltips dismiss on mouse-leave.
 * Roll interactions live on the actor sheet / HUD, not in the tooltip.
 *
 * Contexts walked:
 *   - renderActorSheet:  embedded items via `[data-item-id]` (CSB grid)
 *   - 1547core HUD:      data-hud-* item attrs (weapon, armor, gear rows)
 *   - renderCompendium / renderItemDirectory: items by document id
 */

const MODULE_ID = "1547core";
const TOOLTIP_CLASS = "hover-card-1547core";

// CSB Item template ids → display labels for the category line.
const TEMPLATE_LABELS = {
    "qZCfLEYQ7egbm1B9": "Weapon",
    "uLlgZXz3GlXPFtsj": "Armor",
    "389uqkKKn8M1SKux": "Ammunition",
    "WmP9Ld3Qs7Nk2FvR": "Weapon Modifier",
    "2kiWw3Cv5Zk1lZxn": "Spell",
    "M0nMgk7Yp2RsT5Vu": "Monster Power",
    "4owc4YQBlp94GbGs": "Maneuver",
    "w9ky0ZTDvXDs5Ce7": "Supernatural Mark",
    "HPYYc2P0Ouagicmr": "Pact",
    "Qv6pN2Lm8R4tY1Ks": "Ritual",
    "R7sTu4Qn2Lp8Vx5K": "Ritual Step",
    "mwPqEYUoOfzXpyT9": "Usage Effect",
    "b7A1z6cSZO4dYTKT": "Change Set",
    "WsrkfjBmudnIhvEK": "Change",
    "L4ujYgqhGBGcoo2P": "Requirement",
    "OnH1tEffectTmpl0": "On-Hit Effect",
    "eCIZRFXbcQVZKqEr": "Equipment"
};

function escapeHtml(s) {
    return String(s ?? "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function getCategoryLabel(item) {
    const props = item?.system?.props ?? {};
    if (typeof props.Category === "string" && props.Category.trim()) return props.Category.trim();
    if (typeof props.Group === "string" && props.Group.trim()) return props.Group.trim();
    const templateId = item?.system?.template;
    if (templateId && TEMPLATE_LABELS[templateId]) return TEMPLATE_LABELS[templateId];
    return item?.type ?? "Item";
}

function getDescriptionHtml(item) {
    const props = item?.system?.props ?? {};
    const flagSrc = item?.flags?.["1547Core"]?.sourceData ?? {};
    return String(
        props.Description ?? props.Notes ?? flagSrc.description ?? flagSrc.notes ?? ""
    ).trim();
}

// Pull a few useful per-template stats. Universal but lightweight — extend
// here as more fields earn a spot in the hover card.
function buildStatsLine(item) {
    const p = item?.system?.props ?? {};
    const parts = [];
    if (p.Weight !== undefined && p.Weight !== null && p.Weight !== 0) parts.push(`Weight ${p.Weight}`);
    if (p.Value !== undefined && p.Value !== null && p.Value !== 0) parts.push(`Value ${p.Value}`);
    if (p.WeaponType) parts.push(p.WeaponType);
    if (p.ArmorType) parts.push(p.ArmorType);
    if (p.Attack) parts.push(p.Attack);
    if (p.Defense) parts.push(p.Defense);
    if (p.MaxRange) parts.push(`Range ${p.MaxRange}`);
    if (p.UsageLimit) parts.push(`${p.UsageLimit}×/turn`);
    if (p.Complexity) parts.push(`${p.Complexity} ritual`);
    if (p.MagicKind) parts.push(p.MagicKind);
    if (p.MarkNature && p.MarkScope) parts.push(`${p.MarkScope} ${p.MarkNature}`);
    if (p.PactType) parts.push(p.PactType);
    return parts.join(" · ");
}

async function buildHoverCardHtml(item) {
    if (!item) return "";
    const img = escapeHtml(item.img ?? "icons/svg/item-bag.svg");
    const name = escapeHtml(item.name ?? "Item");
    const category = escapeHtml(getCategoryLabel(item));
    const descRaw = getDescriptionHtml(item);
    let desc = "";
    if (descRaw) {
        try {
            desc = await foundry.applications?.ux?.TextEditor?.implementation?.enrichHTML?.(descRaw, { async: true })
                ?? await TextEditor.enrichHTML(descRaw, { async: true });
        } catch {
            desc = descRaw;
        }
    }
    const stats = escapeHtml(buildStatsLine(item));
    return `
        <div class="hc-head">
            <img class="hc-img" src="${img}" alt="" />
            <div class="hc-meta">
                <div class="hc-name">${name}</div>
                <div class="hc-category">${category}</div>
            </div>
        </div>
        ${desc ? `<div class="hc-divider"></div><div class="hc-desc">${desc}</div>` : ""}
        ${stats ? `<div class="hc-divider"></div><div class="hc-stats">${stats}</div>` : ""}
    `.trim();
}

function getTooltipManager() {
    // v12+: game.tooltip is a TooltipManager singleton with activate/deactivate.
    return globalThis.game?.tooltip ?? null;
}

function attachTooltipAttrs(el, item) {
    if (!el || !item) return;
    if (el.dataset.hoverCard1547Bound === "1") return; // idempotent
    el.dataset.hoverCard1547Bound = "1";
    // Visual cue that the element is interactive (and confirms our service
    // bound to it — useful for diagnosing "no tooltip appearing" reports).
    el.style.cursor = el.style.cursor || "pointer";

    let cachedHtml = null;
    let inFlight = null;

    const enter = async (event) => {
        const tooltip = getTooltipManager();
        if (!tooltip?.activate) return;
        if (!cachedHtml) {
            if (!inFlight) inFlight = buildHoverCardHtml(item);
            cachedHtml = await inFlight;
        }
        // If the user moved away during enrichment, don't pop the tooltip.
        if (!el.matches?.(":hover")) return;
        try {
            tooltip.activate(el, {
                html: cachedHtml,
                cssClass: TOOLTIP_CLASS,
                direction: "RIGHT"
            });
        } catch (err) {
            console.warn(`${MODULE_ID} | hover-card activate failed`, err);
        }
    };

    const leave = () => {
        const tooltip = getTooltipManager();
        if (!tooltip) return;
        // v13 dropped `deactivate` in favor of `dismiss`. Try both.
        try {
            tooltip.deactivate?.();
            tooltip.dismiss?.();
        } catch { /* non-fatal */ }
    };

    el.addEventListener("pointerenter", enter);
    el.addEventListener("pointerleave", leave);
}

function findItemForElement(el, actor) {
    const id = el.dataset.itemId
        ?? el.dataset.documentId
        ?? el.dataset.hudWeaponProfile
        ?? el.dataset.hudWeaponAttack
        ?? el.dataset.hudItemEquip
        ?? el.dataset.hudItemUnequip;
    if (!id) return null;
    if (actor?.items?.get) {
        const fromActor = actor.items.get(id);
        if (fromActor) return fromActor;
    }
    return game.items?.get?.(id) ?? null;
}

function decorateRoot(root, actor) {
    if (!root?.querySelectorAll) return 0;
    const candidates = root.querySelectorAll(
        "[data-item-id], [data-document-id], [data-hud-weapon-profile], [data-hud-weapon-attack], [data-hud-item-equip], [data-hud-item-unequip]"
    );
    let decorated = 0;
    for (const el of candidates) {
        const item = findItemForElement(el, actor);
        if (item) {
            attachTooltipAttrs(el, item);
            decorated++;
        }
    }
    if (globalThis.HoverCard1547_DEBUG && candidates.length > 0) {
        console.log(`${MODULE_ID} | hover-card: scanned ${candidates.length} item-shaped elements, decorated ${decorated}`);
    }
    return decorated;
}

function normalizeRoot(html) {
    // jQuery render hooks pass html as a jQuery object — html[0] is the element.
    // ApplicationV2 render hooks pass an HTMLElement directly.
    if (!html) return null;
    if (html instanceof HTMLElement) return html;
    if (html?.[0] instanceof HTMLElement) return html[0];
    if (typeof html === "object" && typeof html.querySelectorAll === "function") return html;
    return null;
}

function findActor(app) {
    return app?.actor ?? app?.object?.actor ?? app?.document?.parent ?? null;
}

export function registerItemHoverCardService() {
    const handler = (app, html) => {
        const root = normalizeRoot(html);
        if (!root) return;
        decorateRoot(root, findActor(app));
    };

    // v1 Application hooks
    Hooks.on("renderActorSheet", handler);
    Hooks.on("renderApplication", handler);
    Hooks.on("renderCompendium", handler);
    Hooks.on("renderItemDirectory", handler);

    // v2 ApplicationV2 hook — fires for any v2 application (CSB sheets in
    // v13, the HUD, settings menus, etc.).
    Hooks.on("renderApplicationV2", handler);

    console.log(`${MODULE_ID} | item-hover-card service registered`);

    const moduleApi = game.modules?.get(MODULE_ID);
    if (moduleApi) {
        moduleApi.api = moduleApi.api ?? {};
        moduleApi.api.buildItemHoverCardHtml = buildHoverCardHtml;
        // Manual rescan API so you can run game.modules.get("1547core").api.hoverCard.rescan()
        // in the console to verify decoration counts without needing to re-open a sheet.
        moduleApi.api.hoverCard = {
            rescan: (rootEl = document.body) => decorateRoot(rootEl, null),
            enableDebug: () => { globalThis.HoverCard1547_DEBUG = true; },
            disableDebug: () => { globalThis.HoverCard1547_DEBUG = false; }
        };
    }
}
