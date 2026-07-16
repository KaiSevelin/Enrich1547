/**
 * Helpers for reading CSB itemContainer relationships.
 *
 * CSB stores itemContainer children as a property on the parent item:
 *   item.system.props.<ContainerKey> = { "<childItemId>": { name, id, uuid }, ... }
 *
 * The children themselves live as siblings on the parent actor (i.e. in
 * `actor.items`), NOT as `Item.items` (Foundry doesn't support nested
 * embedded Items). The linkage is forward-only from container key → child IDs.
 *
 * Item reference fields (e.g. ItemGrantRef, SkillRef, RequirementSkillRef)
 * use the same object-keyed shape with a single entry per ref.
 */

/**
 * Resolve the child items referenced by a CSB itemContainer on `set`.
 *
 * @param {object} set — parent item (the ChangeSet, typically)
 * @param {object} actor — the actor that owns both `set` and the children
 * @param {string} containerKey — the prop key (e.g. "ChangeDisplayer")
 * @param {string} [expectedTemplateId] — optional template-id guard
 * @returns {object[]} resolved child item documents, in declaration order
 */
export function getContainerChildItems(set, actor, containerKey, expectedTemplateId) {
    const setId = set?.id ?? null;
    const out = [];
    const seen = new Set();

    // Primary: find children by their CSB `system.container` back-pointer among
    // the actor's items. This is the ONLY reliable source on a live actor —
    // CSB's data-prep RECOMPUTES the parent's itemContainer linkage prop
    // (ChangeDisplayer/RequirementsDisplayer) from the actual children and
    // EMPTIES it when it thinks there are none, so reading `set.system.props`
    // returns nothing. `container` is a scalar back-pointer CSB does not touch.
    if (setId != null) {
        for (const item of (actor?.items ?? [])) {
            const container = String(item?.system?.container ?? item?._source?.system?.container ?? "");
            if (container !== String(setId)) continue;
            if (expectedTemplateId && item.system?.template !== expectedTemplateId) continue;
            out.push(item);
            if (item?.id) seen.add(item.id);
        }
    }
    if (out.length) return out;

    // Fallback: the linkage prop (older data, or non-actor contexts). Read
    // `_source` first — the prepared prop is the one CSB empties.
    const linkage = set?._source?.system?.props?.[containerKey] ?? set?.system?.props?.[containerKey];
    if (!linkage || typeof linkage !== "object") return out;
    const ids = Array.isArray(linkage) ? linkage : Object.keys(linkage);
    for (const id of ids) {
        if (!id || typeof id !== "string" || seen.has(id)) continue;
        const item = actor?.items?.get?.(id) ?? null;
        if (!item) continue;
        if (expectedTemplateId && item.system?.template !== expectedTemplateId) continue;
        out.push(item);
        seen.add(id);
    }
    return out;
}

/**
 * Extract the first referenced item id from a CSB ref field.
 * Accepts the object-keyed shape ({ "<id>": {...} }) used by real CSB,
 * and also the array shape ([id, ...]) used by older mock fixtures.
 */
export function firstRefId(refValue) {
    if (!refValue) return null;
    if (Array.isArray(refValue)) {
        const v = refValue[0];
        return typeof v === "string" ? v : null;
    }
    if (typeof refValue === "object") {
        const keys = Object.keys(refValue);
        return keys[0] ?? null;
    }
    return null;
}

/**
 * All referenced item ids from a CSB ref field (a single ref field can hold
 * many, e.g. an ItemGrant that grants Claws + Bite + Natural Armor). Returns
 * them in declaration order.
 */
export function allRefIds(refValue) {
    if (!refValue) return [];
    if (Array.isArray(refValue)) return refValue.filter((v) => typeof v === "string" && v);
    if (typeof refValue === "object") return Object.keys(refValue).filter((k) => typeof k === "string" && k);
    return [];
}
