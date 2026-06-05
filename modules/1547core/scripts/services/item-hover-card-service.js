/**
 * Universal item hover-card service.
 *
 * On hover over an item row in an actor sheet or compendium, opens a styled
 * info panel via Foundry's TooltipManager.
 *
 * 0.3.13: defanged after a regression where HUD elements got pointerenter
 * handlers and tooltip activation interfered with HUD click behaviour.
 * This pass restricts decoration to true item rows on actor sheets and
 * compendiums; HUD-specific selectors are removed.
 */

const MODULE_ID = "1547core";
const TOOLTIP_CLASS = "hover-card-1547core";

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
            const enricher = globalThis.foundry?.applications?.ux?.TextEditor?.implementation?.enrichHTML
                ?? globalThis.TextEditor?.enrichHTML;
            if (enricher) desc = await enricher(descRaw, { async: true });
            else desc = descRaw;
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
    return globalThis.game?.tooltip ?? null;
}

function attachTooltipHandlers(el, item) {
    if (!el || !item) return;
    if (el.dataset.hoverCard1547Bound === "1") return;
    el.dataset.hoverCard1547Bound = "1";

    let cachedHtml = null;
    let inFlight = null;

    el.addEventListener("pointerenter", async () => {
        try {
            const tooltip = getTooltipManager();
            if (!tooltip?.activate) return;
            if (!cachedHtml) {
                if (!inFlight) inFlight = buildHoverCardHtml(item);
                cachedHtml = await inFlight;
            }
            if (!el.matches?.(":hover")) return;
            tooltip.activate(el, {
                html: cachedHtml,
                cssClass: TOOLTIP_CLASS,
                direction: "RIGHT"
            });
        } catch (err) {
            console.warn(`${MODULE_ID} | hover-card enter failed`, err);
        }
    });

    el.addEventListener("pointerleave", () => {
        try {
            const tooltip = getTooltipManager();
            if (!tooltip) return;
            tooltip.deactivate?.();
            tooltip.dismiss?.();
        } catch { /* non-fatal */ }
    });
}

function findItemForElement(el, actor) {
    // Restricted to true item rows. The previous HUD-specific selectors
    // (data-hud-weapon-profile etc.) were dropped — they live on HUD action
    // buttons and pointerenter handlers there interfered with HUD UX.
    const id = el.dataset?.itemId ?? el.dataset?.documentId;
    if (!id) return null;
    if (actor?.items?.get) {
        const fromActor = actor.items.get(id);
        if (fromActor) return fromActor;
    }
    return globalThis.game?.items?.get?.(id) ?? null;
}

function decorateRoot(root, actor) {
    try {
        if (!root?.querySelectorAll) return 0;
        const candidates = root.querySelectorAll("[data-item-id], [data-document-id]");
        let decorated = 0;
        for (const el of candidates) {
            try {
                const item = findItemForElement(el, actor);
                if (item) {
                    attachTooltipHandlers(el, item);
                    decorated++;
                }
            } catch (err) {
                console.warn(`${MODULE_ID} | hover-card per-element failure`, err);
            }
        }
        if (globalThis.HoverCard1547_DEBUG && candidates.length > 0) {
            console.log(`${MODULE_ID} | hover-card: scanned ${candidates.length} item-shaped elements, decorated ${decorated}`);
        }
        return decorated;
    } catch (err) {
        console.warn(`${MODULE_ID} | hover-card decorateRoot failed`, err);
        return 0;
    }
}

function normalizeRoot(html) {
    if (!html) return null;
    if (typeof HTMLElement !== "undefined" && html instanceof HTMLElement) return html;
    if (html?.[0] && typeof html[0].querySelectorAll === "function") return html[0];
    if (typeof html === "object" && typeof html.querySelectorAll === "function") return html;
    return null;
}

function findActor(app) {
    return app?.actor ?? app?.object?.actor ?? app?.document?.parent ?? null;
}

export function registerItemHoverCardService() {
    const handler = (app, html) => {
        try {
            const root = normalizeRoot(html);
            if (!root) return;
            decorateRoot(root, findActor(app));
        } catch (err) {
            console.warn(`${MODULE_ID} | hover-card render-hook failed`, err);
        }
    };

    Hooks.on("renderActorSheet", handler);
    Hooks.on("renderApplication", handler);
    Hooks.on("renderApplicationV2", handler);
    Hooks.on("renderCompendium", handler);
    Hooks.on("renderItemDirectory", handler);

    console.log(`${MODULE_ID} | item-hover-card service registered`);

    // Always-on global so you can verify the service loaded even if module.api
    // hasn't been attached yet by some race condition.
    globalThis.HoverCard1547 = {
        rescan: (rootEl) => decorateRoot(rootEl ?? document.body, null),
        enableDebug: () => { globalThis.HoverCard1547_DEBUG = true; console.log(`${MODULE_ID} | hover-card debug ON`); },
        disableDebug: () => { globalThis.HoverCard1547_DEBUG = false; console.log(`${MODULE_ID} | hover-card debug OFF`); },
        buildHtml: buildHoverCardHtml
    };

    try {
        const moduleApi = globalThis.game?.modules?.get?.(MODULE_ID);
        if (moduleApi) {
            moduleApi.api = moduleApi.api ?? {};
            moduleApi.api.hoverCard = globalThis.HoverCard1547;
        }
    } catch (err) {
        console.warn(`${MODULE_ID} | hover-card api attach failed`, err);
    }
}
