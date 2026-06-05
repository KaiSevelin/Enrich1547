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

function attachTooltipAttrs(el, item) {
    if (!el || !item) return;
    if (el.dataset.hoverCard1547Bound === "1") return; // idempotent
    el.dataset.hoverCard1547Bound = "1";
    let cached = null;
    // Lazy-enrich on first hover so we don't pay enrichHTML cost for every
    // item in a long inventory list at render time.
    const handler = async () => {
        if (cached) return;
        cached = await buildHoverCardHtml(item);
        el.dataset.tooltipHtml = cached;
        el.dataset.tooltipClass = TOOLTIP_CLASS;
        el.dataset.tooltipDirection = "RIGHT";
    };
    el.addEventListener("pointerenter", handler);
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
    if (!root?.querySelectorAll) return;
    const candidates = root.querySelectorAll(
        "[data-item-id], [data-document-id], [data-hud-weapon-profile], [data-hud-weapon-attack], [data-hud-item-equip], [data-hud-item-unequip]"
    );
    for (const el of candidates) {
        const item = findItemForElement(el, actor);
        if (item) attachTooltipAttrs(el, item);
    }
}

export function registerItemHoverCardService() {
    Hooks.on("renderActorSheet", (app, html) => {
        const root = html?.[0] ?? html;
        const actor = app?.actor ?? app?.object;
        decorateRoot(root, actor);
    });

    Hooks.on("renderApplication", (app, html) => {
        // Catches the 1547core HUD (which is a non-ActorSheet ApplicationV2)
        // and other item lists that don't go through renderActorSheet.
        const root = html?.[0] ?? html;
        const actor = app?.actor ?? app?.object?.actor ?? null;
        if (!root) return;
        decorateRoot(root, actor);
    });

    Hooks.on("renderCompendium", (_app, html) => {
        const root = html?.[0] ?? html;
        decorateRoot(root, null);
    });

    Hooks.on("renderItemDirectory", (_app, html) => {
        const root = html?.[0] ?? html;
        decorateRoot(root, null);
    });

    const moduleApi = game.modules?.get(MODULE_ID);
    if (moduleApi) {
        moduleApi.api = moduleApi.api ?? {};
        moduleApi.api.buildItemHoverCardHtml = buildHoverCardHtml;
    }
}
