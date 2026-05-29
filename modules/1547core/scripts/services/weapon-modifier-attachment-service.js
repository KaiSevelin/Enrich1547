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

export function registerWeaponModifierAttachmentService() {
    Hooks.on("createItem", (item, options) => {
        void handleModifierCreate(item, options);
    });

    const moduleApi = game.modules.get(MODULE_ID);
    if (!moduleApi) {
        console.warn(`${MODULE_ID} | registerWeaponModifierAttachmentService: module not found`);
        return;
    }
    moduleApi.api = moduleApi.api ?? {};
    moduleApi.api.attachWeaponModifierToItem = attachWeaponModifierToItem;
    moduleApi.api.computeAttachedModifierIds = computeAttachedModifierIds;
}
