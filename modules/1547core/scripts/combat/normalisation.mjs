/**
 * combat/normalisation.mjs
 *
 * Pure transforms that map raw Foundry/CSB documents into the descriptor
 * shapes the rest of the combat pipeline consumes. No mutation, no
 * `game`, no `Hooks`, no `fromUuid` — everything here can be unit-tested
 * with literal fixtures.
 *
 * Owns the canonical shape of: maneuvers, weapons, ammo, armor, and the
 * range-band math that joins them.
 *
 * Replaces duplicated copies that previously lived in both
 * combat-resolver-service.js and (the original)
 * services/maneuver-legality-service.js (since moved to
 * combat/maneuver-legality.mjs). Where the two old copies differed in
 * field set, this module takes the SUPERSET so both callers get the
 * richer descriptor (extra fields are harmless for callers that don't
 * read them).
 *
 * Where the two old copies differed in null-handling (normalizeWeapon),
 * this module follows the legality-service contract: returns `null` for
 * a missing input. The combat-resolver orchestrator is responsible for
 * the unarmed-default fallback.
 */

const MODULE_ID = "1547core";
const SOURCE_FLAG_SCOPE = "1547Core";
const ACTIVE_ATTACK_PROFILE_KEYS = ["Attack", "AttackB", "AttackC"];

// ────────────────────────────────────────────────────────── Generic parsers ──

export function parseJsonString(value, fallback = null) {
    if (typeof value !== "string" || value.trim() === "") return fallback;
    try { return JSON.parse(value); } catch { return fallback; }
}

export function parseCommaList(value) {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value !== "string") return [];
    return value.split(",").map((entry) => entry.trim()).filter(Boolean);
}

export function isTruthyLike(value) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value > 0;
    const normalized = String(value ?? "").trim().toLowerCase();
    return ["true", "yes", "y", "1", "override"].includes(normalized);
}

export function firstFiniteNumber(values) {
    if (!Array.isArray(values)) return null;
    for (const v of values) {
        const n = Number(v);
        if (Number.isFinite(n)) return n;
    }
    return null;
}

export function hasUsableRangeBands(rangeBands = {}) {
    return [rangeBands.shortRange, rangeBands.longRange, rangeBands.maxRange]
        .some((value) => Number.isFinite(Number(value)) && Number(value) > 0);
}

// ─────────────────────────────────────────────────────── Weapon-type helpers ──

export function inferWeaponAttackType(source = {}, props = {}, sourceProfile = null) {
    const explicitType = String(sourceProfile?.attackType ?? "").trim().toLowerCase();
    if (explicitType) return explicitType;

    const groups = Array.isArray(source?.groups)
        ? source.groups.map((entry) => String(entry ?? "").trim().toLowerCase())
        : [];
    const category = String(source?.category ?? props?.WeaponType ?? "").trim().toLowerCase();
    const usesAmmo = isTruthyLike(props?.UsesAmmo) || source?.usesAmmo === true;

    if (category === "thrown" || groups.includes("thrownweapon")) return "thrown";
    if (usesAmmo || groups.includes("rangedweapon") || ["bow", "crossbow", "firearm"].includes(category)) return "ranged";
    return "melee";
}

/**
 * Pick the active attack profile for a normalised weapon. Returns the
 * explicitly-passed profile, an id match, the active-key slot's profile,
 * or the first profile. `null` when the weapon has no profiles at all.
 */
export function resolveSelectedWeaponProfile(weapon, { profile = null, profileId = null } = {}) {
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

export function buildAttackProfilesFromWeaponProps(source = {}, props = {}) {
    const sourceProfiles = Array.isArray(source?.attackProfiles) ? source.attackProfiles : [];
    return ACTIVE_ATTACK_PROFILE_KEYS.map((key, index) => {
        const formula = String(props?.[key] ?? "").trim();
        if (!formula) return null;
        const sourceProfile = sourceProfiles[index] ?? null;
        const allowedAmmoText = String(props?.[key + "Ammo"] ?? "").trim();
        return {
            id: sourceProfile?.id ?? (index === 0 ? "default" : key.toLowerCase()),
            name: sourceProfile?.name ?? (index === 0 ? "Default" : "Alternative " + index),
            attackType: inferWeaponAttackType(source, props, sourceProfile),
            dice: Array.isArray(sourceProfile?.dice) ? [...sourceProfile.dice] : [],
            tags: Array.isArray(sourceProfile?.tags) ? [...sourceProfile.tags] : [],
            allowedAmmoTypes: Array.isArray(sourceProfile?.allowedAmmoTypes)
                ? [...sourceProfile.allowedAmmoTypes]
                : (allowedAmmoText ? allowedAmmoText.split(",").map((entry) => entry.trim()).filter(Boolean) : []),
            targetCount: Number(sourceProfile?.targetCount ?? 1) || 1,
        };
    }).filter(Boolean);
}

// ────────────────────────────────────────────────────────── Range bands & ammo ──

export function resolveAmmoRangeSpec(source = {}, props = {}) {
    const sourceRange = source?.range;
    const propRange = parseJsonString(props?.Range, null);
    const explicitRange = (
        props?.RangeShort !== undefined
        || props?.RangeMedium !== undefined
        || props?.RangeLong !== undefined
    )
        ? {
            mode: isTruthyLike(props?.RangeModeOverride) ? "override" : "modify",
            shortRange: Number(props?.RangeShort),
            longRange: Number(props?.RangeMedium),
            maxRange: Number(props?.RangeLong),
        }
        : null;
    const legacyOverride = source?.rangeOverride ?? parseJsonString(props?.RangeOverride, null);
    const legacyModifier = source?.rangeModifier ?? parseJsonString(props?.RangeModifier, null);

    const range = sourceRange ?? explicitRange ?? propRange;
    if (range && typeof range === "object") {
        const mode = String(range.mode ?? "modify").trim().toLowerCase();
        return {
            mode: mode === "override" ? "override" : "modify",
            shortRange: Number(range.shortRange),
            longRange: Number(range.longRange),
            maxRange: Number(range.maxRange),
        };
    }

    if (legacyOverride && typeof legacyOverride === "object") {
        return {
            mode: "override",
            shortRange: Number(legacyOverride.shortRange),
            longRange: Number(legacyOverride.longRange),
            maxRange: Number(legacyOverride.maxRange),
        };
    }

    if (legacyModifier && typeof legacyModifier === "object") {
        return {
            mode: "modify",
            shortRange: Number(legacyModifier.shortRange),
            longRange: Number(legacyModifier.longRange),
            maxRange: Number(legacyModifier.maxRange),
        };
    }

    return null;
}

export function normalizeRangeBands(rangeBands) {
    let shortRange = firstFiniteNumber([rangeBands.shortRange]);
    let longRange = firstFiniteNumber([rangeBands.longRange]);
    let maxRange = firstFiniteNumber([rangeBands.maxRange]);
    shortRange = shortRange == null ? null : Math.max(0, shortRange);
    longRange = longRange == null ? null : Math.max(0, longRange);
    maxRange = maxRange == null ? null : Math.max(0, maxRange);
    if (shortRange != null && longRange != null && longRange < shortRange) longRange = shortRange;
    if (longRange != null && maxRange != null && maxRange < longRange) maxRange = longRange;
    if (longRange == null && shortRange != null) longRange = shortRange;
    if (maxRange == null && longRange != null) maxRange = longRange;
    return { shortRange, longRange, maxRange };
}

export function applyAmmoRangeEffects(rangeBands, ammo) {
    const range = ammo?.range ?? null;
    if (range && typeof range === "object") {
        if (range.mode === "override") {
            return normalizeRangeBands({
                shortRange: range.shortRange,
                longRange: range.longRange,
                maxRange: range.maxRange,
            });
        }
        return normalizeRangeBands({
            shortRange: (rangeBands.shortRange ?? 0) + (Number(range.shortRange) || 0),
            longRange: (rangeBands.longRange ?? rangeBands.shortRange ?? 0) + (Number(range.longRange) || 0),
            maxRange: (rangeBands.maxRange ?? rangeBands.longRange ?? 0) + (Number(range.maxRange) || 0),
        });
    }
    return normalizeRangeBands(rangeBands);
}

// ────────────────────────────────────────────────────── Document normalisers ──

function readSourceData(doc) {
    return doc?.flags?.[SOURCE_FLAG_SCOPE]?.sourceData ?? doc?.flags?.[MODULE_ID]?.sourceData ?? doc;
}

function readAttachedModifierIds(doc, source = {}) {
    const runtimeAttached = doc?.flags?.[SOURCE_FLAG_SCOPE]?.attachedModifierIds
        ?? doc?.flags?.[MODULE_ID]?.attachedModifierIds
        ?? doc?.system?.props?.AttachedModifierIds
        ?? source?.attachedModifierIds
        ?? [];
    if (Array.isArray(runtimeAttached)) {
        return runtimeAttached.map((entry) => String(entry ?? "").trim()).filter(Boolean);
    }
    const parsed = parseJsonString(runtimeAttached, null);
    if (Array.isArray(parsed)) {
        return parsed.map((entry) => String(entry ?? "").trim()).filter(Boolean);
    }
    return parseCommaList(runtimeAttached);
}

export function normalizeManeuver(maneuver) {
    if (!maneuver) return null;
    const source = readSourceData(maneuver) ?? {};
    const props = maneuver.system?.props ?? {};
    const rawTiming = source.type ?? source.timing ?? props.Type ?? props.Timing ?? source.usage ?? props.Usage ?? "";
    const rawTrigger = source.triggerType ?? props.TriggerType ?? props.Trigger ?? "";
    const sourceRequirements = source.requirements ?? {};
    const parsedEffectData = parseJsonString(props.EffectData, null);
    const parsedUsageLimit = parseJsonString(props.UsageLimitData, null);
    const maxUses = Number(props.UsageLimit);
    return {
        ...source,
        _id: source._id ?? source.id ?? maneuver.id ?? maneuver._id ?? null,
        id: source.id ?? source._id ?? maneuver.id ?? maneuver._id ?? null,
        name: source.name ?? maneuver.name ?? "",
        folder: source.folder ?? maneuver.folder?.name ?? maneuver.folder ?? "Maneuvers",
        type: String(rawTiming ?? "").trim().toLowerCase(),
        triggerType: String(rawTrigger ?? "").trim().toLowerCase(),
        CostType: source.CostType ?? props.CostType ?? null,
        CostAmount: source.CostAmount ?? (Number.isFinite(Number(props.CostAmount)) ? Number(props.CostAmount) : 0),
        requirements: {
            ...sourceRequirements,
            skill: sourceRequirements.skill ?? (String(props.SkillRequirement ?? "").trim() || undefined),
            text: sourceRequirements.text ?? (String(props.RequirementText ?? "").trim() || ""),
            targetText: sourceRequirements.targetText ?? (String(props.TargetRequirement ?? "").trim() || undefined),
            requiredWeaponTags: Array.isArray(sourceRequirements.requiredWeaponTags)
                ? sourceRequirements.requiredWeaponTags
                : String(props.RequiredWeaponTags ?? "").split(",").map((entry) => entry.trim()).filter(Boolean),
            excludedWeaponTags: Array.isArray(sourceRequirements.excludedWeaponTags)
                ? sourceRequirements.excludedWeaponTags
                : String(props.ExcludedWeaponTags ?? "").split(",").map((entry) => entry.trim()).filter(Boolean),
        },
        effectData: source.effectData ?? parsedEffectData ?? {},
        usageLimit: source.usageLimit ?? parsedUsageLimit ?? (Number.isFinite(maxUses) ? { maxUses } : {}),
        tags: Array.isArray(source.tags) ? source.tags : String(props.Tags ?? "").split(",").map((entry) => entry.trim()).filter(Boolean),
    };
}

export function normalizeAmmoItem(ammo) {
    if (!ammo) return null;
    const source = readSourceData(ammo);
    const props = ammo.system?.props ?? {};
    return {
        ...source,
        _id: ammo.id ?? ammo._id ?? source._id ?? null,
        name: source.name ?? ammo.name ?? "",
        ammoType:
            props.AmmoType ??
            ammo.ammoType ??
            source.ammoType ??
            "",
        quantity:
            firstFiniteNumber([
                props.Quantity,
                ammo.quantity,
                source.quantity,
            ]) ?? 0,
        addDice: Array.isArray(source.addDice) && source.addDice.length
            ? source.addDice
            : parseCommaList(props.AddDiceSummary ?? props.AddDice),
        tags: Array.isArray(source.tags) && source.tags.length
            ? source.tags
            : parseCommaList(props.TagsSummary ?? props.Tags),
        resultModifiers: Array.isArray(source.resultModifiers) && source.resultModifiers.length
            ? source.resultModifiers
            : (parseJsonString(props.ResultModifiers, []) ?? []),
        range: resolveAmmoRangeSpec(source, props),
        attachedModifierIds: readAttachedModifierIds(ammo, source),
        itemDocument: ammo,
    };
}

export function normalizeWeaponModifier(modifier) {
    if (!modifier) return null;
    const source = readSourceData(modifier) ?? {};
    const props = modifier.system?.props ?? {};
    return {
        ...source,
        _id: modifier.id ?? modifier._id ?? source._id ?? source.id ?? null,
        id: modifier.id ?? modifier._id ?? source.id ?? source._id ?? null,
        name: source.name ?? modifier.name ?? "",
        itemType: source.itemType ?? "weaponModifier",
        modifierType: source.modifierType ?? props.ModifierType ?? "",
        targetKinds: Array.isArray(source.targetKinds)
            ? [...source.targetKinds]
            : parseCommaList(props.TargetKinds),
        addDamageQualifiers: Array.isArray(source.addDamageQualifiers)
            ? [...source.addDamageQualifiers]
            : parseCommaList(props.AddDamageQualifiers),
        removeDamageQualifiers: Array.isArray(source.removeDamageQualifiers)
            ? [...source.removeDamageQualifiers]
            : parseCommaList(props.RemoveDamageQualifiers),
        overrideDamageType: source.overrideDamageType ?? (String(props.OverrideDamageType ?? "").trim() || null),
        addDice: Array.isArray(source.addDice)
            ? [...source.addDice]
            : parseCommaList(props.AddDice),
        removeDice: Array.isArray(source.removeDice)
            ? [...source.removeDice]
            : parseCommaList(props.RemoveDice),
        resultModifiers: Array.isArray(source.resultModifiers)
            ? [...source.resultModifiers]
            : (parseJsonString(props.ResultModifiers, []) ?? []),
        tags: Array.isArray(source.tags)
            ? [...source.tags]
            : parseCommaList(props.Tags),
        onHitEffects: Array.isArray(source.onHitEffects)
            ? [...source.onHitEffects]
            : (parseJsonString(props.OnHitEffects, []) ?? []),
        appliesToProfiles: Array.isArray(source.appliesToProfiles)
            ? [...source.appliesToProfiles]
            : parseCommaList(props.AppliesToProfiles),
        durationType: source.durationType ?? (String(props.DurationType ?? "").trim() || "Permanent"),
        durationValue: firstFiniteNumber([
            source.durationValue,
            props.DurationValue,
        ]),
        stackKey: source.stackKey ?? (String(props.StackKey ?? "").trim() || ""),
        stackMode: source.stackMode ?? (String(props.StackMode ?? "").trim() || "stack"),
        requirements: source.requirements ?? (parseJsonString(props.Requirements, {}) ?? {}),
        description: source.description ?? String(props.Description ?? "").trim(),
        itemDocument: modifier,
    };
}

/**
 * Returns null when `weapon` is null/undefined. Callers that need an
 * unarmed default (combat-resolver-service) must apply it themselves.
 */
export function normalizeWeapon(weapon, actor = null) {
    if (!weapon) return null;
    const source = readSourceData(weapon);
    const props = weapon.system?.props ?? {};
    const loadedAmmoId = String(
        props.LoadedAmmoId ??
        weapon.loadedAmmoId ??
        source.loadedAmmoId ??
        ""
    ).trim() || null;
    const loadedAmmoItem = loadedAmmoId
        ? (actor?.items?.get?.(loadedAmmoId) ?? weapon.parent?.items?.get?.(loadedAmmoId) ?? null)
        : null;
    const loadedAmmo = normalizeAmmoItem(loadedAmmoItem);
    const propRangeBands = {
        shortRange: firstFiniteNumber([props.ShortRange]),
        longRange: firstFiniteNumber([props.LongRange]),
        maxRange: firstFiniteNumber([props.MaxRange]),
    };
    const sourceRangeBands = {
        shortRange: firstFiniteNumber([weapon.shortRange, source.shortRange]),
        longRange: firstFiniteNumber([weapon.longRange, source.longRange]),
        maxRange: firstFiniteNumber([weapon.maxRange, source.maxRange]),
    };
    const baseRangeBands = hasUsableRangeBands(propRangeBands)
        ? propRangeBands
        : (hasUsableRangeBands(sourceRangeBands) ? sourceRangeBands : {
            shortRange: null,
            longRange: null,
            maxRange: null,
        });
    const effectiveRangeBands = applyAmmoRangeEffects(baseRangeBands, loadedAmmo);
    const attackProfiles = Array.isArray(source.attackProfiles) && source.attackProfiles.length
        ? source.attackProfiles
        : buildAttackProfilesFromWeaponProps(source, props);
    return {
        ...source,
        _id: weapon.id ?? weapon._id ?? source._id ?? null,
        name: source.name ?? weapon.name ?? "",
        traits: Array.isArray(source.traits) ? source.traits : [],
        groups: Array.isArray(source.groups) ? source.groups : [],
        attackProfiles,
        ammoType:
            props.AmmoType ??
            weapon.ammoType ??
            source.ammoType ??
            "",
        ammoCapacity:
            firstFiniteNumber([
                props.AmmoCapacity,
                weapon.ammoCapacity,
                source.ammoCapacity,
            ]) ?? 0,
        ammoLoaded:
            firstFiniteNumber([
                props.AmmoLoaded,
                weapon.ammoLoaded,
                source.ammoLoaded,
            ]) ?? 0,
        activeAttackProfileKey:
            String(
                props.ActiveAttackProfile ??
                weapon.activeAttackProfile ??
                source.activeAttackProfile ??
                ""
            ).trim() || "Attack",
        loadedAmmoId,
        loadedAmmo,
        shortRange: effectiveRangeBands.shortRange,
        longRange: effectiveRangeBands.longRange,
        maxRange: effectiveRangeBands.maxRange,
        usesAmmo:
            props.UsesAmmo ??
            weapon.usesAmmo ??
            source.usesAmmo ??
            false,
        attachedModifierIds: readAttachedModifierIds(weapon, source),
        equipped:
            props.Equipped ??
            weapon.equipped ??
            source.equipped ??
            false,
        itemDocument: weapon,
    };
}

export function normalizeArmor(armor) {
    if (!armor) return null;
    const source = readSourceData(armor);
    return {
        ...source,
        _id: source._id ?? armor.id ?? armor._id ?? null,
        name: source.name ?? armor.name ?? "",
        traits: Array.isArray(source.traits) ? source.traits : [],
        armorClass:
            armor.system?.props?.ArmorType ??
            source.armorClass ??
            null,
        equipped:
            armor.system?.props?.Equipped ??
            armor.equipped ??
            source.equipped ??
            false,
    };
}
