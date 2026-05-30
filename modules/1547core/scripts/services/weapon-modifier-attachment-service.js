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
    if (JSON.stringify(currentIds) === JSON.stringify(nextIds)) return true;

    await targetItem.update({
        [`flags.${SOURCE_FLAG_SCOPE}.attachedModifierIds`]: nextIds,
    }, {
        [ATTACH_GUARD]: true,
    });
    return true;
}

function shouldHandleModifierCreate(item, options) {
    if (options?.[ATTACH_GUARD]) return false;
    if (!isWeaponModifierItem(item)) return false;
    return item?.parent?.documentName === "Actor";
}

async function handleModifierCreate(item, options) {
    if (!shouldHandleModifierCreate(item, options)) return;
    const targetItem = inferModifierAttachmentTarget(item);
    if (!targetItem) return;
    await attachWeaponModifierToItem(targetItem, item);
}

// CSB renders only system.props fields defined on the template, so the
// flag-stored attached modifier list never appears on the weapon/ammo sheet.
// Inject a read-only notice so testers/GMs can verify attachments at a glance.
const ATTACHED_NOTICE_ATTR = "data-1547core-attached-modifiers";

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function renderAttachedModifiersNotice(app, html) {
    const item = app?.object;
    if (!isAttachableModifierTarget(item)) return;
    const actor = item?.parent;
    const names = getAttachedModifierIds(item)
        .map((id) => actor?.items?.get?.(id)?.name)
        .filter(Boolean);
    if (!names.length) return;

    const root = html instanceof HTMLElement ? html : html?.[0];
    if (!root?.querySelector) return;
    root.querySelector(`[${ATTACHED_NOTICE_ATTR}]`)?.remove();

    const notice = document.createElement("div");
    notice.setAttribute(ATTACHED_NOTICE_ATTR, "true");
    notice.style.cssText = "margin:6px 8px; padding:6px 10px; border:1px solid var(--color-border-light-tertiary, #888); border-radius:4px; background:rgba(0,0,0,0.04);";
    notice.innerHTML = `<strong>Attached modifiers:</strong> ${escapeHtml(names.join(", "))}`;
    const target = root.querySelector(".window-content") ?? root;
    target.insertBefore(notice, target.firstChild);
}

export function registerWeaponModifierAttachmentService() {
    Hooks.on("createItem", (item, options) => {
        void handleModifierCreate(item, options);
    });

    // v1 sheets fire renderItemSheet; v2 sheets (Foundry v12+/v13 with
    // ApplicationV2-based sheet classes, which CSB may use) fire
    // renderItemSheetV2. Register both so the notice appears regardless of
    // which API the active item sheet uses. The render is idempotent (any
    // prior notice is removed first), so double-firing is harmless.
    const onSheetRender = (app, html) => {
        try {
            renderAttachedModifiersNotice(app, html);
        } catch (error) {
            console.error(`${MODULE_ID} | renderAttachedModifiersNotice failed`, error);
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
