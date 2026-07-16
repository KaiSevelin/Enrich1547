/**
 * Derived-composition display service.
 *
 * The composition pipeline (composition-service) derives a monster's effective
 * Tags and Traits from its ChangeSets, but only as an in-memory computed view —
 * the CSB sheet can't read it. This service mirrors that composed output into
 * two persisted, read-only props (`DerivedTags`, `DerivedTraits`) so a panel on
 * the monster sheet can show what the ChangeSets actually produced.
 *
 * Runs only for monster-type actors (TypeDropdown != Player), GM/owner-only,
 * and writes only when the formatted value changed (no update storm).
 */

import { MODULE_ID, CHANGESET_TEMPLATE_ID, CHANGE_TEMPLATE_ID } from "../lib/constants.mjs";
import { getEffectiveActorCached, invalidateEffectiveActorCache } from "./composition-service.mjs";

function isMonster(actor) {
    return String(actor?.system?.props?.TypeDropdown ?? "").trim() !== "Player";
}

function isCompositionItem(item) {
    const template = item?.system?.template;
    return template === CHANGESET_TEMPLATE_ID || template === CHANGE_TEMPLATE_ID;
}

// Single-writer guard: the active GM if there is one, otherwise the lowest-id
// active owner of this actor. Prevents every client writing the same props.
function isResponsibleForActor(actor) {
    const game = globalThis.game;
    const activeGM = game?.users?.activeGM;
    if (activeGM) return !!game.user?.isGM && activeGM.id === game.user.id;
    if (game?.user?.isGM) return true;
    if (!actor?.isOwner) return false;
    const owners = Array.from(game?.users ?? [])
        .filter((u) => u.active && actor.testUserPermission?.(u, "OWNER"))
        .sort((a, b) => String(a.id).localeCompare(String(b.id)));
    return owners[0]?.id === game?.user?.id;
}

function formatTags(state) {
    return Array.from(state?.appliedTags ?? []).map((t) => String(t).trim()).filter(Boolean).sort().join(", ");
}

function formatTraits(state) {
    return (state?.appliedTraits ?? [])
        .map((t) => {
            const name = String(t?.name ?? "").trim();
            const description = String(t?.description ?? "").trim();
            if (!name) return "";
            return description ? `${name} — ${description}` : name;
        })
        .filter(Boolean)
        .join("\n");
}

/**
 * Recompute a monster's composed Tags/Traits and persist them to the display
 * props if they changed. Idempotent; safe to call repeatedly.
 */
export async function refreshDerivedComposition(actor) {
    if (actor?.documentName !== "Actor") return;
    if (!isMonster(actor)) return;
    if (!isResponsibleForActor(actor)) return;

    invalidateEffectiveActorCache(actor);
    const state = getEffectiveActorCached(actor);
    const tags = formatTags(state);
    const traits = formatTraits(state);

    const props = actor.system?.props ?? {};
    const update = {};
    if (String(props.DerivedTags ?? "") !== tags) update["system.props.DerivedTags"] = tags;
    if (String(props.DerivedTraits ?? "") !== traits) update["system.props.DerivedTraits"] = traits;
    if (Object.keys(update).length) await actor.update(update);
}

export function registerDerivedCompositionService() {
    const onCompositionItemChange = (item) => {
        if (!isCompositionItem(item)) return;
        const actor = item?.parent;
        if (actor?.documentName === "Actor") void refreshDerivedComposition(actor);
    };
    Hooks.on("createItem", onCompositionItemChange);
    Hooks.on("updateItem", onCompositionItemChange);
    Hooks.on("deleteItem", onCompositionItemChange);

    const moduleApi = globalThis.game?.modules?.get?.(MODULE_ID);
    if (moduleApi) {
        moduleApi.api = moduleApi.api ?? {};
        moduleApi.api.refreshDerivedComposition = refreshDerivedComposition;
    }
}
