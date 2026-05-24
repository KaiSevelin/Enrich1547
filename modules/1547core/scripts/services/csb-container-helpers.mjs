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
    const linkage = set?.system?.props?.[containerKey];
    if (!linkage || typeof linkage !== "object") return [];
    const ids = Array.isArray(linkage) ? linkage : Object.keys(linkage);
    const out = [];
    for (const id of ids) {
        if (!id || typeof id !== "string") continue;
        const item = actor?.items?.get?.(id) ?? null;
        if (!item) continue;
        if (expectedTemplateId && item.system?.template !== expectedTemplateId) continue;
        out.push(item);
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
