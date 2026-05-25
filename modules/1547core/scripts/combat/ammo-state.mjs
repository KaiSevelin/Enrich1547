/**
 * combat/ammo-state.mjs
 *
 * Patch-returner module for ammunition state on an actor's weapons.
 *
 * Two families of exports:
 *
 *   PURE HELPERS — given normalised weapon/profile/ammo descriptors,
 *   answer questions: what ammo types are allowed? Is this ammo
 *   compatible? What's the loaded ammo for an upcoming attack?
 *
 *     getAllowedAmmoTypes(weapon, profile) -> string[]
 *     validateAmmoCompatibility({ weapon, profile, ammo, requireQuantity }) -> { valid, reason, allowedAmmoTypes }
 *     resolveLoadedAmmoForAttack({ actor, weapon, profile }) -> { loadedAmmo, allowedAmmoTypes } (throws on missing/invalid)
 *
 *   PATCH-RETURNERS — compute the Foundry mutations needed to load /
 *   spend / consume ammo, without performing them. The orchestrator
 *   (combat-resolver-service.js) applies the patches via its
 *   applyPatch dispatcher.
 *
 *     planLoadWeaponAmmo({ actor, weapon, ammoItem, ammoItemId, profile, profileId }) -> { patches, result }
 *     planConsumeLoadedAmmo({ actor, weapon, loadedAmmo }) -> { patches, result }
 *     planSpendLoadedAmmo({ actor, weapon, loadedAmmo }) -> { patches, result }
 *
 * Patch shape (per ADR-0001 / CONTEXT.md):
 *   { kind: "item.update", actorId, itemId, data: {...} }
 *
 * No game.*, no Hooks, no async — every function in this file is
 * synchronous and side-effect free.
 */

import {
    normalizeWeapon,
    normalizeAmmoItem,
    firstFiniteNumber,
} from "./normalisation.mjs";

const ACTIVE_ATTACK_PROFILE_KEYS = ["Attack", "AttackB", "AttackC"];

// ───────────────────────────────────────────────────────────── Pure helpers ──

export function getAllowedAmmoTypes(weapon, profile) {
    const profileAllowed = Array.isArray(profile?.allowedAmmoTypes)
        ? profile.allowedAmmoTypes.filter(Boolean)
        : [];
    if (profileAllowed.length) return profileAllowed;

    const weaponAmmoType = String(weapon?.ammoType ?? "").trim();
    return weaponAmmoType ? [weaponAmmoType] : [];
}

export function validateAmmoCompatibility({ weapon, profile, ammo, requireQuantity = true }) {
    const allowedAmmoTypes = getAllowedAmmoTypes(weapon, profile);
    if (!ammo) {
        return {
            valid: false,
            reason: `${weapon?.name ?? "Weapon"} is missing ammunition.`,
            allowedAmmoTypes,
        };
    }
    if (requireQuantity && (ammo.quantity ?? 0) < 1) {
        return {
            valid: false,
            reason: `${ammo.name || "Loaded ammunition"} is out of ammunition.`,
            allowedAmmoTypes,
        };
    }
    if (!allowedAmmoTypes.length) {
        return {
            valid: false,
            reason: `${weapon?.name ?? "Weapon"} does not define any compatible ammunition types.`,
            allowedAmmoTypes,
        };
    }
    if (!allowedAmmoTypes.includes(ammo.ammoType)) {
        return {
            valid: false,
            reason: `${ammo.name || "Loaded ammunition"} is not compatible with ${weapon?.name ?? "this weapon"}.`,
            allowedAmmoTypes,
        };
    }
    return { valid: true, reason: "", allowedAmmoTypes };
}

export function resolveLoadedAmmoForAttack({ actor, weapon, profile }) {
    if (!weapon?.usesAmmo) {
        return {
            loadedAmmo: null,
            allowedAmmoTypes: getAllowedAmmoTypes(weapon, profile),
        };
    }

    const loadedAmmoId = String(weapon.loadedAmmoId ?? "").trim();
    if (!loadedAmmoId) {
        throw new Error(`${weapon.name} requires loaded ammunition.`);
    }

    const ammoItem = actor?.items?.get?.(loadedAmmoId) ?? null;
    const loadedAmmo = normalizeAmmoItem(ammoItem);
    if (!loadedAmmo) {
        throw new Error(`${weapon.name} does not have a valid loaded ammunition item.`);
    }

    const validation = validateAmmoCompatibility({
        weapon,
        profile,
        ammo: loadedAmmo,
        requireQuantity: false,
    });
    if (!validation.valid) {
        throw new Error(validation.reason);
    }

    return {
        loadedAmmo,
        allowedAmmoTypes: validation.allowedAmmoTypes,
    };
}

// ─────────────────────────────────────────────────────────── Patch-returners ──

function resolveSelectedWeaponProfile(weapon, { profile = null, profileId = null } = {}) {
    if (profile) return profile;
    const attackProfiles = Array.isArray(weapon?.attackProfiles) ? weapon.attackProfiles : [];
    if (!attackProfiles.length) return null;
    if (profileId) {
        const explicit = attackProfiles.find((entry) => entry?.id === profileId);
        if (explicit) return explicit;
    }
    const idx = ACTIVE_ATTACK_PROFILE_KEYS.indexOf(String(weapon?.activeAttackProfileKey ?? "").trim());
    return (idx >= 0 ? attackProfiles[idx] : null) ?? attackProfiles[0] ?? null;
}

/**
 * Compute the patches required to load `ammoItem` into `weapon`.
 * Throws if the configuration is invalid (missing actor/weapon, no
 * ammo, incompatible ammo, etc.) — caller catches and surfaces.
 */
export function planLoadWeaponAmmo({
    actor,
    weapon,
    ammoItem,
    ammoItemId = null,
    profile = null,
    profileId = null,
} = {}) {
    if (!actor) throw new Error("Missing actor.");
    const normalizedWeapon = normalizeWeapon(weapon, actor);
    if (!normalizedWeapon) throw new Error("Missing weapon.");

    const selectedProfile = resolveSelectedWeaponProfile(normalizedWeapon, { profile, profileId });

    const resolvedAmmo = normalizeAmmoItem(ammoItem ?? actor?.items?.get?.(ammoItemId) ?? null);
    if (!resolvedAmmo) throw new Error("Missing ammunition.");

    const validation = validateAmmoCompatibility({
        weapon: normalizedWeapon,
        profile: selectedProfile,
        ammo: resolvedAmmo,
        requireQuantity: true,
    });
    if (!validation.valid) throw new Error(validation.reason);

    const weaponItem = normalizedWeapon.itemDocument;
    const ammoDocument = resolvedAmmo.itemDocument ?? actor?.items?.get?.(resolvedAmmo._id) ?? null;
    if (!weaponItem?.id) throw new Error("Weapon item is not an updatable actor item.");
    if (!ammoDocument?.id) throw new Error("Ammunition item is not an updatable actor item.");

    const currentQuantity = firstFiniteNumber([
        ammoDocument.system?.props?.Quantity,
        resolvedAmmo.quantity,
    ]) ?? 0;
    if (currentQuantity < 1) {
        throw new Error(`${resolvedAmmo.name || "Ammunition"} is out of ammunition.`);
    }

    const nextQuantity = Math.max(0, currentQuantity - 1);
    const nextLoaded = Math.min(Math.max(1, normalizedWeapon.ammoCapacity ?? 1), 1);

    const patches = [
        {
            kind: "item.update",
            actorId: actor.id,
            itemId: ammoDocument.id,
            data: { "system.props.Quantity": nextQuantity },
        },
        {
            kind: "item.update",
            actorId: actor.id,
            itemId: weaponItem.id,
            data: {
                "system.props.LoadedAmmoId": resolvedAmmo._id,
                "system.props.AmmoLoaded": nextLoaded,
            },
        },
    ];

    return {
        patches,
        result: {
            weaponId: normalizedWeapon._id,
            loadedAmmoId: resolvedAmmo._id,
            ammoLoaded: nextLoaded,
            remainingQuantity: nextQuantity,
        },
    };
}

/**
 * Patches to decrement the currently-loaded ammo by one shot.
 * Returns `{ patches: [], result: null }` if the weapon doesn't use
 * ammo or no weapon item exists (no-op rather than throw, to match
 * the original `consumeLoadedAmmo` permissiveness).
 */
export function planConsumeLoadedAmmo({ actor, weapon, loadedAmmo } = {}) {
    if (!weapon?.usesAmmo) return { patches: [], result: null };

    const weaponItem = weapon.itemDocument ?? actor?.items?.get?.(weapon._id) ?? null;
    if (!weaponItem?.id) return { patches: [], result: null };

    const currentLoaded = firstFiniteNumber([
        weaponItem.system?.props?.AmmoLoaded,
        weapon.ammoLoaded,
    ]) ?? 0;
    const nextLoaded = Math.max(0, currentLoaded - 1);

    const patches = [
        {
            kind: "item.update",
            actorId: actor?.id,
            itemId: weaponItem.id,
            data: {
                "system.props.AmmoLoaded": nextLoaded,
                "system.props.LoadedAmmoId": nextLoaded > 0 ? (loadedAmmo?._id ?? "") : "",
            },
        },
    ];

    return {
        patches,
        result: {
            ammoItemId: loadedAmmo?._id ?? null,
            remainingQuantity: loadedAmmo?.quantity ?? null,
            ammoLoaded: nextLoaded,
        },
    };
}

/**
 * spendLoadedAmmo's pre-resolution + consume planning, in one step.
 */
export function planSpendLoadedAmmo({ actor, weapon, loadedAmmo = null } = {}) {
    const normalizedWeapon = normalizeWeapon(weapon, actor);
    if (!normalizedWeapon) return { patches: [], result: null };

    const resolvedLoadedAmmo = loadedAmmo ?? normalizeAmmoItem(
        actor?.items?.get?.(normalizedWeapon.loadedAmmoId ?? "")
        ?? weapon?.parent?.items?.get?.(normalizedWeapon.loadedAmmoId ?? "")
        ?? null
    );

    return planConsumeLoadedAmmo({
        actor,
        weapon: normalizedWeapon,
        loadedAmmo: resolvedLoadedAmmo,
    });
}
