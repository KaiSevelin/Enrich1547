import { MODULE_ID, CHANGESET_TEMPLATE_ID } from "../lib/constants.mjs";
const DEFAULT_IMAGE = "icons/svg/mystery-man.svg";

/**
 * Resolve the portrait/image for an actor by walking the resolution ladder:
 *   1. flags["1547core"].portraitOverride (explicit GM override)
 *   2. PortraitKey lookup in registry (per-actor key set in flags or props)
 *   3. Type:Domain:Role composition lookup
 *   4. Type:Role composition lookup
 *   5. Type:Loadout lookup (first attached Loadout with an entry wins)
 *   6. Type:Domain composition lookup
 *   7. Type composition lookup
 *   8. actor.img (the Foundry portrait field)
 *   9. mystery-man default
 *
 * Registry source: world setting "1547core.portraitRegistry" — a flat map of
 * colon-delimited keys to image paths, populated by Setup Data from
 * `foundry/Templates/portrait-registry.json` ({ registry: { "Beast": ..., ... } }).
 *
 * If the registry is empty or no key matches, the resolver falls back to
 * actor.img then mystery-man — so the system never breaks even without art.
 */

function isChangeSet(item) {
    return item?.system?.template === CHANGESET_TEMPLATE_ID;
}

function extractConceptFromName(name) {
    if (!name) return null;
    const match = String(name).match(/^(.+?)\s*\(/);
    return (match ? match[1] : String(name)).trim() || null;
}

function findGroupConcept(actor, groupName) {
    for (const item of actor.items ?? []) {
        if (!isChangeSet(item)) continue;
        const itemGroup = String(item.system?.props?.Group ?? "").trim();
        if (itemGroup !== groupName) continue;
        return extractConceptFromName(item.name);
    }
    return null;
}

// Unlike Role/Domain, Loadout is not a singleton group — an actor can carry
// several (e.g. Quadruped + Winged). Return every attached concept in item
// order; the ladder takes the first one that has a registry entry.
function findGroupConcepts(actor, groupName) {
    const out = [];
    for (const item of actor.items ?? []) {
        if (!isChangeSet(item)) continue;
        const itemGroup = String(item.system?.props?.Group ?? "").trim();
        if (itemGroup !== groupName) continue;
        const concept = extractConceptFromName(item.name);
        if (concept) out.push(concept);
    }
    return out;
}

function getPortraitRegistry() {
    try {
        return game.settings?.get(MODULE_ID, "portraitRegistry") ?? {};
    } catch (e) {
        return {};
    }
}

function lookupRegistry(registry, ...parts) {
    const filtered = parts.filter(p => typeof p === "string" && p.length > 0);
    if (!filtered.length) return null;
    const key = filtered.join(":");
    const hit = registry?.[key];
    return (typeof hit === "string" && hit.length > 0) ? hit : null;
}

export function resolveMonsterImage(actor) {
    if (!actor) return DEFAULT_IMAGE;

    // Step 1: explicit override
    const portraitOverride = String(actor.flags?.[MODULE_ID]?.portraitOverride ?? "").trim();
    if (portraitOverride) return portraitOverride;

    const registry = getPortraitRegistry();

    // Step 2: PortraitKey (set on actor flags or props for one-off named portraits)
    const portraitKey = String(actor.flags?.[MODULE_ID]?.portraitKey
        ?? actor.system?.props?.PortraitKey
        ?? "").trim();
    if (portraitKey) {
        const direct = lookupRegistry(registry, portraitKey);
        if (direct) return direct;
    }

    // Steps 3-6: composition cascade
    const baseKey = String(actor.system?.props?.TypeDropdown ?? "").trim() || null;
    if (baseKey) {
        const domainKey = findGroupConcept(actor, "Domain");
        const roleKey = findGroupConcept(actor, "Role");

        // 3. Type + Domain + Role (most specific). Guarded on both parts —
        // lookupRegistry drops null segments, so an unguarded call with a
        // missing Role would collapse into a premature Type:Domain lookup
        // and jump the queue past Role/Loadout.
        if (domainKey && roleKey) {
            const tdr = lookupRegistry(registry, baseKey, domainKey, roleKey);
            if (tdr) return tdr;
        }

        // 4. Type + Role
        if (roleKey) {
            const tr = lookupRegistry(registry, baseKey, roleKey);
            if (tr) return tr;
        }

        // 4b. Type + Loadout — body plan (Winged, Constrictor, Mounted, ...)
        // outranks Domain: a winged beast should look winged before it looks
        // "of the woods". First attached loadout with a registry entry wins.
        for (const loadoutKey of findGroupConcepts(actor, "Loadout")) {
            const tl = lookupRegistry(registry, baseKey, loadoutKey);
            if (tl) return tl;
        }

        // 5. Type + Domain
        if (domainKey) {
            const td = lookupRegistry(registry, baseKey, domainKey);
            if (td) return td;
        }

        // 6. Type only
        const t = lookupRegistry(registry, baseKey);
        if (t) return t;
    }

    // Step 7: actor.img (Foundry's default portrait field)
    if (actor.img && actor.img !== DEFAULT_IMAGE) return actor.img;

    // Step 8: mystery-man default — never breaks anything
    return DEFAULT_IMAGE;
}

/**
 * Resolve the portrait for an actor and write it onto `actor.img` and the
 * prototype token texture. Conservative: only fields still on the
 * mystery-man default (or empty) are written, so a portrait the GM set by
 * hand is never clobbered. Returns the resolved path when anything was
 * updated, null otherwise.
 *
 * Called by the monster wizard right after ChangeSets are attached — that's
 * the earliest point where Type + Domain + Role are all present for the
 * registry cascade.
 */
export async function applyResolvedMonsterImage(actor) {
    if (!actor || actor.documentName !== "Actor") return null;

    const resolved = resolveMonsterImage(actor);
    if (!resolved || resolved === DEFAULT_IMAGE) return null;

    const updates = {};
    if (!actor.img || actor.img === DEFAULT_IMAGE) updates.img = resolved;
    const tokenSrc = actor.prototypeToken?.texture?.src;
    if (!tokenSrc || tokenSrc === DEFAULT_IMAGE) updates["prototypeToken.texture.src"] = resolved;
    if (!Object.keys(updates).length) return null;

    await actor.update(updates);
    return resolved;
}

export function registerMonsterImageResolverService() {
    const moduleApi = game.modules.get(MODULE_ID);
    if (!moduleApi) {
        console.warn(`${MODULE_ID} | registerMonsterImageResolverService: module not found`);
        return;
    }

    moduleApi.api = moduleApi.api ?? {};
    moduleApi.api.imageResolver = {
        resolveMonsterImage,
        applyResolvedMonsterImage
    };
}

export default {
    registerMonsterImageResolverService,
    resolveMonsterImage,
    applyResolvedMonsterImage
};
