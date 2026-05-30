/**
 * One-time backfill so existing flag-based modifier attachments populate the
 * native CSB container relationship + the new UsesRemaining prop column.
 *
 * Before 0.2.19, weapon-modifier attachments were tracked via
 *   `flags["1547Core"].attachedModifierIds` on the weapon/ammo
 * with the modifier's `flags["1547Core"].usesRemaining` (when applicable).
 *
 * 0.2.19 introduces an `itemContainer` component on WeaponTemplate /
 * AmmunitionTemplate that renders modifiers via `modifier.system.container ===
 * weapon.id`, and a `UsesRemaining` numberField on WeaponModifierTemplate that
 * the container surfaces as a column. This migration sets those fields on
 * existing data; it's idempotent (skips items already in the new shape).
 *
 * Combat lifecycle continues to read from the flag for the moment — this is
 * a Phase-A backfill; the deeper flag → container switch and code cleanup
 * ship in a later release once this is verified in worlds.
 */

const MODULE_ID = "1547core";
const SOURCE_FLAG_SCOPE = "1547Core";
const WEAPON_TEMPLATE_ID = "qZCfLEYQ7egbm1B9";
const AMMO_TEMPLATE_ID = "389uqkKKn8M1SKux";
const MODIFIER_TEMPLATE_ID = "WmP9Ld3Qs7Nk2FvR";

function isAttachableTarget(item) {
    const tpl = item?.system?.template;
    return tpl === WEAPON_TEMPLATE_ID || tpl === AMMO_TEMPLATE_ID;
}

function isWeaponModifier(item) {
    return item?.system?.template === MODIFIER_TEMPLATE_ID;
}

function getAttachedModifierIds(item) {
    const raw = item?.flags?.[SOURCE_FLAG_SCOPE]?.attachedModifierIds
        ?? item?.flags?.[MODULE_ID]?.attachedModifierIds
        ?? [];
    if (!Array.isArray(raw)) return [];
    return raw.map((entry) => String(entry ?? "").trim()).filter(Boolean);
}

function getEffectiveUsesRemaining(modifier) {
    const source = modifier?.flags?.[SOURCE_FLAG_SCOPE]?.sourceData ?? {};
    if (String(source.durationType ?? "").toLowerCase() !== "uses") return null;
    const stored = Number(modifier?.flags?.[SOURCE_FLAG_SCOPE]?.usesRemaining);
    if (Number.isFinite(stored)) return Math.max(0, stored);
    const initial = Number(source.durationValue ?? 0);
    return Number.isFinite(initial) ? Math.max(0, initial) : null;
}

export async function runContainerMigration() {
    if (!game.user?.isGM) return { modifierUpdates: 0, actorsTouched: 0 };

    let modifierUpdates = 0;
    let actorsTouched = 0;

    for (const actor of game.actors ?? []) {
        const items = actor.items?.contents ?? Array.from(actor.items ?? []);
        const updates = [];
        for (const weapon of items) {
            if (!isAttachableTarget(weapon)) continue;
            const attachedIds = getAttachedModifierIds(weapon);
            if (!attachedIds.length) continue;

            for (const id of attachedIds) {
                const modifier = actor.items.get?.(id);
                if (!modifier || !isWeaponModifier(modifier)) continue;

                const data = { _id: modifier.id };
                const containerCurrent = String(modifier.system?.container ?? "");
                if (containerCurrent !== weapon.id) {
                    data["system.container"] = weapon.id;
                }
                const usesTarget = getEffectiveUsesRemaining(modifier);
                const usesCurrent = Number(modifier.system?.props?.UsesRemaining);
                if (usesTarget !== null && (!Number.isFinite(usesCurrent) || usesCurrent !== usesTarget)) {
                    data["system.props.UsesRemaining"] = usesTarget;
                }
                if (Object.keys(data).length > 1) updates.push(data);
            }
        }
        if (updates.length && actor.updateEmbeddedDocuments) {
            await actor.updateEmbeddedDocuments("Item", updates);
            modifierUpdates += updates.length;
            actorsTouched += 1;
        }
    }

    if (modifierUpdates > 0) {
        console.log(`${MODULE_ID} | container migration: backfilled ${modifierUpdates} modifier(s) on ${actorsTouched} actor(s)`);
    }
    return { modifierUpdates, actorsTouched };
}
