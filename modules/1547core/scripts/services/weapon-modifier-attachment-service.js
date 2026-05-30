const MODULE_ID = "1547core";
const SOURCE_FLAG_SCOPE = "1547Core";
const MODIFIER_TEMPLATE_ID = "WmP9Ld3Qs7Nk2FvR";
const WEAPON_TEMPLATE_ID = "qZCfLEYQ7egbm1B9";
const AMMO_TEMPLATE_ID = "389uqkKKn8M1SKux";
const ATTACH_GUARD = `${MODULE_ID}.weaponModifierAttachGuard`;

function readSourceData(doc) {
    return doc?.flags?.[SOURCE_FLAG_SCOPE]?.sourceData ?? doc?.flags?.[MODULE_ID]?.sourceData ?? doc ?? {};
}

export function getAttachedModifierIds(item) {
    const raw = item?.flags?.[SOURCE_FLAG_SCOPE]?.attachedModifierIds
        ?? item?.flags?.[MODULE_ID]?.attachedModifierIds
        ?? item?.system?.props?.AttachedModifierIds
        ?? readSourceData(item)?.attachedModifierIds
        ?? [];
    if (Array.isArray(raw)) {
        return raw.map((entry) => String(entry ?? "").trim()).filter(Boolean);
    }
    const text = String(raw ?? "").trim();
    if (!text) return [];
    try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
            return parsed.map((entry) => String(entry ?? "").trim()).filter(Boolean);
        }
    } catch {
        // Fall through to CSV parsing.
    }
    return text.split(",").map((entry) => entry.trim()).filter(Boolean);
}

export function isWeaponModifierItem(item) {
    if (!item) return false;
    const source = readSourceData(item);
    return item?.system?.template === MODIFIER_TEMPLATE_ID
        || source?.itemType === "weaponModifier";
}

export function isAttachableModifierTarget(item) {
    if (!item) return false;
    return item?.system?.template === WEAPON_TEMPLATE_ID
        || item?.system?.template === AMMO_TEMPLATE_ID;
}

function getModifierStackKey(item) {
    const source = readSourceData(item);
    return String(source?.stackKey ?? item?.system?.props?.StackKey ?? "").trim();
}

// Effective remaining uses for a "uses"-type modifier. Prefers the live
// `flags.1547Core.usesRemaining` (decremented on each fire) and falls back to
// the source data's initial `durationValue` for freshly-attached modifiers.
// Returns null when the modifier has no use-based duration.
export function getEffectiveUsesRemaining(modifierItem) {
    const source = readSourceData(modifierItem);
    const durationType = String(source?.durationType ?? modifierItem?.system?.props?.DurationType ?? "").trim().toLowerCase();
    if (durationType !== "uses") return null;
    const stored = Number(modifierItem?.flags?.[SOURCE_FLAG_SCOPE]?.usesRemaining);
    if (Number.isFinite(stored)) return Math.max(0, stored);
    const initial = Number(source?.durationValue ?? modifierItem?.system?.props?.DurationValue ?? 0);
    return Number.isFinite(initial) ? Math.max(0, initial) : null;
}

// Build the comma-joined "Name (N uses)" summary string that gets mirrored
// into `system.props.AttachedModifierSummary` so CSB can render it on the
// item sheet (CSB only renders system.props.*, not flags).
export function buildAttachedModifierSummary(actor, ids) {
    if (!actor?.items?.get) return "";
    const parts = [];
    for (const id of (Array.isArray(ids) ? ids : [])) {
        const modifierItem = actor.items.get(id);
        if (!modifierItem) continue;
        const name = String(modifierItem.name ?? "").trim() || "Unknown";
        const uses = getEffectiveUsesRemaining(modifierItem);
        if (uses !== null) {
            parts.push(`${name} (${uses} ${uses === 1 ? "use" : "uses"})`);
        } else {
            parts.push(name);
        }
    }
    return parts.join(", ");
}

function getDropContainerTargetId(item) {
    return String(
        item?.system?.container
        ?? item?.flags?.[SOURCE_FLAG_SCOPE]?.dropTargetItemId
        ?? item?.flags?.[MODULE_ID]?.dropTargetItemId
        ?? ""
    ).trim();
}

export function inferModifierAttachmentTarget(modifierItem) {
    if (!isWeaponModifierItem(modifierItem)) return null;
    const actor = modifierItem?.parent;
    if (actor?.documentName !== "Actor") return null;
    const targetId = getDropContainerTargetId(modifierItem);
    if (!targetId) return null;
    const targetItem = actor.items?.get?.(targetId) ?? null;
    return isAttachableModifierTarget(targetItem) ? targetItem : null;
}

export function computeAttachedModifierIds({ actor, targetItem, modifierItem } = {}) {
    if (actor?.documentName !== "Actor") return [];
    if (!isAttachableModifierTarget(targetItem) || !isWeaponModifierItem(modifierItem)) return [];

    const currentIds = getAttachedModifierIds(targetItem);
    const modifierId = String(modifierItem.id ?? modifierItem._id ?? "").trim();
    if (!modifierId) return currentIds;

    const stackKey = getModifierStackKey(modifierItem);
    const filteredIds = currentIds.filter((attachedId) => {
        if (attachedId === modifierId) return false;
        if (!stackKey) return true;
        const attachedItem = actor.items?.get?.(attachedId) ?? null;
        return getModifierStackKey(attachedItem) !== stackKey;
    });

    return [...filteredIds, modifierId];
}

export async function attachWeaponModifierToItem(targetItem, modifierItem) {
    const actor = targetItem?.parent;
    if (actor?.documentName !== "Actor") return false;
    const nextIds = computeAttachedModifierIds({ actor, targetItem, modifierItem });
    if (!nextIds.length) return false;

    const currentIds = getAttachedModifierIds(targetItem);
    const currentSummary = String(targetItem?.system?.props?.AttachedModifierSummary ?? "");
    const nextSummary = buildAttachedModifierSummary(actor, nextIds);
    if (JSON.stringify(currentIds) === JSON.stringify(nextIds) && currentSummary === nextSummary) return true;

    await targetItem.update({
        [`flags.${SOURCE_FLAG_SCOPE}.attachedModifierIds`]: nextIds,
        "system.props.AttachedModifierSummary": nextSummary,
    }, {
        [ATTACH_GUARD]: true,
    });
    return true;
}

// When the consume path (planConsumeTriggeredModifier) writes new
// attachedModifierIds OR a modifier's usesRemaining, the summary in
// system.props.AttachedModifierSummary goes stale. This hook keeps it in
// sync without coupling the lifecycle code to the attachment service.
async function refreshSummaryForItem(targetItem) {
    if (!targetItem?.update) return;
    const actor = targetItem?.parent;
    if (actor?.documentName !== "Actor") return;
    const summary = buildAttachedModifierSummary(actor, getAttachedModifierIds(targetItem));
    const current = String(targetItem?.system?.props?.AttachedModifierSummary ?? "");
    if (current === summary) return;
    await targetItem.update({ "system.props.AttachedModifierSummary": summary }, { [ATTACH_GUARD]: true });
}

async function handleItemUpdated(item, changes, options) {
    if (options?.[ATTACH_GUARD]) return;
    const actor = item?.parent;
    if (actor?.documentName !== "Actor") return;

    // Case A: the updated item is the parent (weapon/ammo) and its attached
    // modifier list changed → refresh that item's summary.
    const attachedChanged = changes?.flags?.[SOURCE_FLAG_SCOPE]?.attachedModifierIds !== undefined;
    if (attachedChanged && isAttachableModifierTarget(item)) {
        await refreshSummaryForItem(item);
        return;
    }

    // Case B: the updated item is a modifier whose remaining uses changed →
    // recompute summaries on every weapon/ammo on the same actor that has
    // this modifier attached.
    const usesChanged = changes?.flags?.[SOURCE_FLAG_SCOPE]?.usesRemaining !== undefined;
    if (usesChanged && isWeaponModifierItem(item)) {
        const items = actor.items?.contents ?? Array.from(actor.items ?? []);
        for (const candidate of items) {
            if (!isAttachableModifierTarget(candidate)) continue;
            if (!getAttachedModifierIds(candidate).includes(item.id)) continue;
            await refreshSummaryForItem(candidate);
        }
    }
}

function shouldHandleModifierCreate(item, options) {
    if (options?.[ATTACH_GUARD]) return false;
    if (!isWeaponModifierItem(item)) return false;
    return item?.parent?.documentName === "Actor";
}

async function handleModifierCreate(item, options) {
    if (!shouldHandleModifierCreate(item, options)) return;

    // Seed the UsesRemaining prop from the source's initial durationValue so
    // the CSB itemContainer column shows the right count from the first render.
    const source = readSourceData(item);
    if (String(source?.durationType ?? "").toLowerCase() === "uses") {
        const initial = Number(source?.durationValue ?? 0);
        const current = Number(item?.system?.props?.UsesRemaining);
        if (Number.isFinite(initial) && initial > 0 && (!Number.isFinite(current) || current === 0)) {
            await item.update({ "system.props.UsesRemaining": initial }, { [ATTACH_GUARD]: true });
        }
    }

    const targetItem = inferModifierAttachmentTarget(item);
    if (!targetItem) return;
    await attachWeaponModifierToItem(targetItem, item);
}

// CSB renders the attached-modifier flag through the AttachedModifierSummary
// textArea on the weapon/ammo sheet. Find that textArea after CSB renders
// the sheet and swap it for a clickable <ul> — each entry opens the modifier
// item's sheet on click. If the CSB-rendered textArea isn't found (selector
// drift, alternate sheet), the plain-text summary stays visible as fallback.
function renderAttachedModifiersList(app, html) {
    // v1 ItemSheet exposes the doc as `app.object`; v2 ApplicationV2-based
    // sheets (e.g. CSB's EquippableItemSheetV2) expose it as `app.document`.
    const item = app?.document ?? app?.object ?? null;
    if (!isAttachableModifierTarget(item)) return;
    const actor = item?.parent;
    if (!actor) return;
    const ids = getAttachedModifierIds(item);
    if (!ids.length) return;

    const root = html instanceof HTMLElement ? html : html?.[0];
    if (!root?.querySelector) return;
    const textarea = root.querySelector('textarea[name="system.props.AttachedModifierSummary"]');
    if (!textarea) return;

    const list = document.createElement("ul");
    list.style.cssText = "list-style:none; padding:6px 10px; margin:0; border:1px solid var(--color-border-light-tertiary,#888); border-radius:4px; background:rgba(0,0,0,0.04);";

    for (const id of ids) {
        const modifierItem = actor.items?.get?.(id);
        if (!modifierItem) continue;
        const uses = getEffectiveUsesRemaining(modifierItem);
        const usesText = uses !== null ? ` (${uses} ${uses === 1 ? "use" : "uses"})` : "";

        const li = document.createElement("li");
        li.style.cssText = "padding:3px 0;";
        const link = document.createElement("a");
        link.textContent = (modifierItem.name ?? "Unknown") + usesText;
        link.title = `Open ${modifierItem.name ?? "modifier"} sheet`;
        link.style.cssText = "cursor:pointer; text-decoration:underline;";
        link.addEventListener("click", (event) => {
            event.preventDefault();
            modifierItem.sheet?.render(true);
        });
        li.appendChild(link);
        list.appendChild(li);
    }

    // Swap out the surrounding label/form-group too so we don't leave an
    // empty wrapper around the new list; fall back to the textarea alone.
    const wrapper = textarea.closest("label, .form-group, .csb-textarea") ?? textarea;
    wrapper.replaceWith(list);
}

export function registerWeaponModifierAttachmentService() {
    Hooks.on("createItem", (item, options) => {
        void handleModifierCreate(item, options);
    });

    Hooks.on("updateItem", (item, changes, options) => {
        void handleItemUpdated(item, changes, options);
    });

    // v1 sheets fire renderItemSheet; v2 sheets (Foundry v12+/v13 with
    // ApplicationV2-based sheet classes, which CSB may use) fire
    // renderItemSheetV2. Register both so the notice appears regardless of
    // which API the active item sheet uses. The render is idempotent (any
    // prior notice is removed first), so double-firing is harmless.
    const onSheetRender = (app, html) => {
        try {
            renderAttachedModifiersList(app, html);
        } catch (error) {
            console.error(`${MODULE_ID} | renderAttachedModifiersList failed`, error);
        }
    };
    Hooks.on("renderItemSheet", onSheetRender);
    Hooks.on("renderItemSheetV2", onSheetRender);

    const moduleApi = game.modules.get(MODULE_ID);
    if (!moduleApi) {
        console.warn(`${MODULE_ID} | registerWeaponModifierAttachmentService: module not found`);
        return;
    }
    moduleApi.api = moduleApi.api ?? {};
    moduleApi.api.attachWeaponModifierToItem = attachWeaponModifierToItem;
    moduleApi.api.computeAttachedModifierIds = computeAttachedModifierIds;
}
