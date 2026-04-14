import { COMBAT_EVENTS, emitCombatEvent } from "./combat-events.js";
import { evaluateManeuverLegality, getLegalManeuvers } from "./maneuver-legality-service.js";

const MODULE_ID = "1547core";
const SOURCE_FLAG_SCOPE = "1547Core";
const PENDING_ATTACK_KIND = "1547core.pendingAttack";

export function registerCombatResolverService() {
    const module = game.modules.get(MODULE_ID);
    if (!module) return;

    module.api = {
        ...(module.api ?? {}),
        combat: {
            ...(module.api?.combat ?? {}),
            buildPendingAttack,
            buildPendingMove,
            declareAttack,
            declareMovement,
            loadWeaponAmmo,
            resolveAttackOutcome,
            swapLoadedAmmo,
        },
    };
}

export function buildPendingAttack({
    actor,
    target = null,
    targets = null,
    weapon,
    profileId = null,
    profile = null,
    selectedPreManeuvers = [],
    ...context
} = {}) {
    const normalizedWeapon = normalizeWeapon(weapon, actor);
    if (!actor) throw new Error("Missing actor.");
    if (!normalizedWeapon) throw new Error("Missing weapon.");

    const selectedProfile = resolveSelectedWeaponProfile(normalizedWeapon, {
        profile,
        profileId,
    });

    if (!selectedProfile) {
        throw new Error(`${normalizedWeapon.name} does not have a legal attack profile.`);
    }

    const ammoState = resolveLoadedAmmoForAttack({
        actor,
        weapon: normalizedWeapon,
        profile: selectedProfile,
    });

    const legalPreManeuvers = getLegalManeuvers({
        actor,
        weapon: normalizedWeapon,
        profile: selectedProfile,
        target,
        targets,
        timingType: "pre",
        triggerType: "attack-declared",
        ...context,
    });

    const selected = selectedPreManeuvers
        .map(normalizeManeuver)
        .filter(Boolean);

    const selectedEvaluations = selected.map((maneuver) =>
        evaluateManeuverLegality(maneuver, {
            actor,
            weapon: normalizedWeapon,
            profile: selectedProfile,
            target,
            targets,
            timingType: "pre",
            triggerType: "attack-declared",
            ...context,
        })
    );

    const illegalSelections = selectedEvaluations.filter((entry) => !entry.legal);
    if (illegalSelections.length) {
        const summary = illegalSelections
            .map((entry) => `${entry.maneuver?.name}: ${entry.reasons.join(" ")}`)
            .join("; ");
        throw new Error(`Illegal pre-maneuver selection. ${summary}`);
    }

    return {
        kind: PENDING_ATTACK_KIND,
        actor,
        target,
        targets: Array.isArray(targets) && targets.length ? targets : [target].filter(Boolean),
        weapon: normalizedWeapon,
        profile: selectedProfile,
        loadedAmmo: ammoState.loadedAmmo,
        triggerType: "attack-declared",
        safeAttack: selected.some((maneuver) => createsSafeAttack(maneuver)),
        selectedPreManeuvers: selected,
        legalPreManeuvers,
        reactionCandidates: buildAttackReactionCandidates({
            attacker: actor,
            defender: target,
            pendingWeapon: normalizedWeapon,
            pendingProfile: selectedProfile,
            context,
        }),
        reservedCosts: collectReservedCosts(selected),
        mergedModifiers: mergeManeuverEffects(selected),
        metadata: context,
        committed: false,
    };
}

export function buildPendingMove({
    actor,
    path = [],
    selectedPreManeuvers = [],
    ...context
} = {}) {
    if (!actor) throw new Error("Missing actor.");

    const selected = selectedPreManeuvers
        .map(normalizeManeuver)
        .filter(Boolean);

    const selectedEvaluations = selected.map((maneuver) =>
        evaluateManeuverLegality(maneuver, {
            actor,
            timingType: "pre",
            triggerType: "move-declared",
            ...context,
        })
    );

    const illegalSelections = selectedEvaluations.filter((entry) => !entry.legal);
    if (illegalSelections.length) {
        const summary = illegalSelections
            .map((entry) => `${entry.maneuver?.name}: ${entry.reasons.join(" ")}`)
            .join("; ");
        throw new Error(`Illegal movement pre-maneuver selection. ${summary}`);
    }

    return {
        actor,
        path: Array.isArray(path) ? path : [],
        triggerType: "move-declared",
        selectedPreManeuvers: selected,
        reservedCosts: collectReservedCosts(selected),
        mergedModifiers: mergeManeuverEffects(selected),
        metadata: context,
        committed: false,
    };
}

export async function declareAttack(options = {}) {
    const pendingAttack = buildPendingAttack(options);
    const event = await emitCombatEvent(COMBAT_EVENTS.ATTACK_DECLARED, pendingAttack);

    const declarationCommitted = !event.cancelled || event.reason === "reaction-triggered";
    if (declarationCommitted && !pendingAttack.committed) {
        await consumeLoadedAmmo({
            actor: pendingAttack.actor,
            weapon: pendingAttack.weapon,
            loadedAmmo: pendingAttack.loadedAmmo,
        });
        pendingAttack.committed = true;
    }

    return {
        pendingAttack,
        event,
        cancelled: event.cancelled,
        reactionResolution: findReactionResolution(event),
    };
}

export async function declareMovement({
    threatEvents = [],
    ...options
} = {}) {
    const pendingMove = buildPendingMove(options);
    const movementEvent = await emitCombatEvent(COMBAT_EVENTS.MOVEMENT_STARTED, pendingMove);
    const reactionResolutions = [];

    for (const threatEvent of threatEvents) {
        const threatPayload = {
            ...pendingMove,
            ...threatEvent,
            mover: pendingMove.actor,
            path: pendingMove.path,
        };
        const enteredEvent = await emitCombatEvent(COMBAT_EVENTS.THREAT_ZONE_ENTERED, threatPayload);
        const resolution = findReactionResolution(enteredEvent);
        if (resolution) {
            reactionResolutions.push(resolution);
        }
    }

    return {
        pendingMove,
        event: movementEvent,
        reactionResolutions,
    };
}

function buildAttackReactionCandidates({
    attacker,
    defender,
    pendingWeapon,
    pendingProfile,
    context = {},
} = {}) {
    if (!defender) return [];

    const reactionWeapon = getActorReactionWeapon(defender);
    const reactionProfile = resolveSelectedWeaponProfile(reactionWeapon, {});

    return getLegalManeuvers({
        actor: defender,
        weapon: reactionWeapon,
        profile: reactionProfile,
        target: attacker,
        timingType: "reaction",
        triggerType: "attack-declared",
        distanceSquares: context.distanceSquares,
        rangeSquares: context.rangeSquares,
        actorConditions: context.targetConditions,
        targetConditions: context.actorConditions,
        incomingAttack: {
            weapon: pendingWeapon,
            profile: pendingProfile,
        },
    });
}

export async function resolveAttackOutcome({
    pendingAttack,
    attackRoll,
    defenseRoll,
    defenderPostChoice = null,
    attackerPostChoice = null,
    currentCriticalPoints = null,
    currentDamageTakenReaction = null,
} = {}) {
    if (!pendingAttack) throw new Error("Missing pending attack.");
    if (!isPendingAttack(pendingAttack)) {
        throw new Error("Pending attack must be created through buildPendingAttack.");
    }

    const normalizedAttackRoll = applyMultiplier(normalizeRollSummary(attackRoll));
    const normalizedDefenseRoll = applyMultiplier(normalizeRollSummary(defenseRoll));
    const damageApplied = Math.max(
        0,
        normalizedAttackRoll.damage - normalizedDefenseRoll.protection
    );

    const criticalPoints =
        currentCriticalPoints ??
        Math.max(0, normalizedAttackRoll.crit) +
            Math.max(0, normalizedDefenseRoll.crit);

    const damageWindow = await emitCombatEvent(COMBAT_EVENTS.DAMAGE_APPLIED, {
        pendingAttack,
        attackRoll: normalizedAttackRoll,
        defenseRoll: normalizedDefenseRoll,
        damageApplied,
    });

    const damageTakenWindow = await emitCombatEvent(
        COMBAT_EVENTS.DAMAGE_TAKEN_WINDOW_OPENED,
        {
            pendingAttack,
            damageApplied,
            selectedReaction: currentDamageTakenReaction,
        }
    );

    const defenderPostOptions = getLegalManeuvers({
        actor: pendingAttack.target,
        maneuvers: pendingAttack.target ? undefined : [],
        weapon: pendingAttack.weapon,
        profile: pendingAttack.profile,
        target: pendingAttack.actor,
        timingType: "post",
        triggerType: "post-attack",
        currentCriticalPoints: criticalPoints,
        actorConditions: pendingAttack.metadata?.targetConditions,
        targetConditions: pendingAttack.metadata?.actorConditions,
    });

    const attackerPostOptions = getLegalManeuvers({
        actor: pendingAttack.actor,
        weapon: pendingAttack.weapon,
        profile: pendingAttack.profile,
        target: pendingAttack.target,
        timingType: "post",
        triggerType: "post-attack",
        currentCriticalPoints: criticalPoints,
        actorConditions: pendingAttack.metadata?.actorConditions,
        targetConditions: pendingAttack.metadata?.targetConditions,
    });

    const defenderPostWindow = await emitCombatEvent(
        COMBAT_EVENTS.POST_MANEUVER_WINDOW_OPENED,
        {
            side: "defender",
            pendingAttack,
            currentCriticalPoints: criticalPoints,
            legalPostManeuvers: defenderPostOptions,
            selectedPostManeuver: defenderPostChoice,
        }
    );

    const attackerPostWindow = await emitCombatEvent(
        COMBAT_EVENTS.POST_MANEUVER_WINDOW_OPENED,
        {
            side: "attacker",
            pendingAttack,
            currentCriticalPoints: criticalPoints,
            legalPostManeuvers: attackerPostOptions,
            selectedPostManeuver: attackerPostChoice,
        }
    );

    if (!pendingAttack.committed) {
        await consumeLoadedAmmo({
            actor: pendingAttack.actor,
            weapon: pendingAttack.weapon,
            loadedAmmo: pendingAttack.loadedAmmo,
        });
        pendingAttack.committed = true;
    }
    const commitEvent = await emitCombatEvent(COMBAT_EVENTS.ACTION_COMMITTED, {
        type: "attack",
        pendingAttack,
        damageApplied,
    });

    return {
        pendingAttack,
        attackRoll: normalizedAttackRoll,
        defenseRoll: normalizedDefenseRoll,
        damageApplied,
        currentCriticalPoints: criticalPoints,
        defenderPostOptions,
        attackerPostOptions,
        events: {
            damageWindow,
            damageTakenWindow,
            defenderPostWindow,
            attackerPostWindow,
            commitEvent,
        },
    };
}

export async function loadWeaponAmmo({
    actor,
    weapon,
    ammoItem,
    ammoItemId = null,
    profile = null,
    profileId = null,
} = {}) {
    const normalizedWeapon = normalizeWeapon(weapon, actor);
    if (!actor) throw new Error("Missing actor.");
    if (!normalizedWeapon) throw new Error("Missing weapon.");

    const selectedProfile = resolveSelectedWeaponProfile(normalizedWeapon, {
        profile,
        profileId,
    });

    const resolvedAmmo = normalizeAmmoItem(ammoItem ?? actor?.items?.get?.(ammoItemId) ?? null);
    if (!resolvedAmmo) throw new Error("Missing ammunition.");

    const validation = validateAmmoCompatibility({
        actor,
        weapon: normalizedWeapon,
        profile: selectedProfile,
        ammo: resolvedAmmo,
        requireQuantity: true,
    });

    if (!validation.valid) {
        throw new Error(validation.reason);
    }

    const weaponItem = normalizedWeapon.itemDocument;
    const ammoDocument = resolvedAmmo.itemDocument ?? actor?.items?.get?.(resolvedAmmo._id) ?? null;
    if (!weaponItem?.update) {
        throw new Error("Weapon item is not an updatable actor item.");
    }
    if (!ammoDocument?.update) {
        throw new Error("Ammunition item is not an updatable actor item.");
    }

    const currentQuantity = firstFiniteNumber([
        ammoDocument.system?.props?.Quantity,
        resolvedAmmo.quantity,
    ]) ?? 0;
    if (currentQuantity < 1) {
        throw new Error(`${resolvedAmmo.name || "Ammunition"} is out of ammunition.`);
    }

    const nextQuantity = Math.max(0, currentQuantity - 1);
    const nextLoaded = Math.min(Math.max(1, normalizedWeapon.ammoCapacity ?? 1), 1);

    await ammoDocument.update({
        "system.props.Quantity": nextQuantity,
    });

    await weaponItem.update({
        "system.props.LoadedAmmoId": resolvedAmmo._id,
        "system.props.AmmoLoaded": nextLoaded,
    });

    return {
        weaponId: normalizedWeapon._id,
        loadedAmmoId: resolvedAmmo._id,
        ammoLoaded: nextLoaded,
        remainingQuantity: nextQuantity,
    };
}

export async function swapLoadedAmmo(options = {}) {
    return loadWeaponAmmo(options);
}

function parseJsonString(value, fallback = null) {
    if (typeof value !== "string" || value.trim() === "") return fallback;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function parseCommaList(value) {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value !== "string") return [];
    return value.split(",").map((entry) => entry.trim()).filter(Boolean);
}

function isTruthyLike(value) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value > 0;
    const normalized = String(value ?? "").trim().toLowerCase();
    return ["true", "yes", "y", "1", "override"].includes(normalized);
}
function resolveAmmoRangeSpec(source = {}, props = {}) {
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
            maxRange: Number(props?.RangeLong)
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
            maxRange: Number(range.maxRange)
        };
    }

    if (legacyOverride && typeof legacyOverride === "object") {
        return {
            mode: "override",
            shortRange: Number(legacyOverride.shortRange),
            longRange: Number(legacyOverride.longRange),
            maxRange: Number(legacyOverride.maxRange)
        };
    }

    if (legacyModifier && typeof legacyModifier === "object") {
        return {
            mode: "modify",
            shortRange: Number(legacyModifier.shortRange),
            longRange: Number(legacyModifier.longRange),
            maxRange: Number(legacyModifier.maxRange)
        };
    }

    return null;
}

function normalizeManeuver(maneuver) {
    return maneuver?.flags?.[SOURCE_FLAG_SCOPE]?.sourceData ?? maneuver?.flags?.[MODULE_ID]?.sourceData ?? maneuver ?? null;
}

function normalizeRangeBands(rangeBands) {
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

function applyAmmoRangeEffects(rangeBands, ammo) {
    const range = ammo?.range ?? null;
    if (range && typeof range === "object") {
        if (range.mode === "override") {
            return normalizeRangeBands({
                shortRange: range.shortRange,
                longRange: range.longRange,
                maxRange: range.maxRange
            });
        }
        return normalizeRangeBands({
            shortRange: (rangeBands.shortRange ?? 0) + (Number(range.shortRange) || 0),
            longRange: (rangeBands.longRange ?? rangeBands.shortRange ?? 0) + (Number(range.longRange) || 0),
            maxRange: (rangeBands.maxRange ?? rangeBands.longRange ?? 0) + (Number(range.maxRange) || 0)
        });
    }
    return normalizeRangeBands(rangeBands);
}

function normalizeWeapon(weapon, actor = null) {
    if (!weapon) return null;
    const source = weapon.flags?.[SOURCE_FLAG_SCOPE]?.sourceData ?? weapon.flags?.[MODULE_ID]?.sourceData ?? weapon;
    const loadedAmmoId = String(
        weapon.system?.props?.LoadedAmmoId ??
        weapon.loadedAmmoId ??
        source.loadedAmmoId ??
        ""
    ).trim() || null;
    const loadedAmmoItem = loadedAmmoId ? (actor?.items?.get?.(loadedAmmoId) ?? weapon.parent?.items?.get?.(loadedAmmoId) ?? null) : null;
    const loadedAmmo = normalizeAmmoItem(loadedAmmoItem);
    const baseRangeBands = {
        shortRange: firstFiniteNumber([weapon.system?.props?.ShortRange, weapon.shortRange, source.shortRange]),
        longRange: firstFiniteNumber([weapon.system?.props?.LongRange, weapon.longRange, source.longRange]),
        maxRange: firstFiniteNumber([weapon.system?.props?.MaxRange, weapon.maxRange, source.maxRange])
    };
    const effectiveRangeBands = applyAmmoRangeEffects(baseRangeBands, loadedAmmo);
    return {
        ...source,
        _id: weapon.id ?? weapon._id ?? source._id ?? null,
        name: source.name ?? weapon.name ?? "",
        attackProfiles: Array.isArray(source.attackProfiles) ? source.attackProfiles : [],
        ammoType:
            weapon.system?.props?.AmmoType ??
            weapon.ammoType ??
            source.ammoType ??
            "",
        ammoCapacity:
            firstFiniteNumber([
                weapon.system?.props?.AmmoCapacity,
                weapon.ammoCapacity,
                source.ammoCapacity,
            ]) ?? 0,
        ammoLoaded:
            firstFiniteNumber([
                weapon.system?.props?.AmmoLoaded,
                weapon.ammoLoaded,
                source.ammoLoaded,
            ]) ?? 0,
        activeAttackProfileKey:
            String(
                weapon.system?.props?.ActiveAttackProfile ??
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
            weapon.system?.props?.UsesAmmo ??
            weapon.usesAmmo ??
            source.usesAmmo ??
            false,
        ready:
            weapon.system?.props?.Ready ??
            weapon.ready ??
            source.ready ??
            false,
        itemDocument: weapon,
    };
}

function getActorReactionWeapon(actor) {
    const items = actor?.items?.contents ?? actor?.items ?? [];
    const weapons = items
        .filter((item) => isWeaponSource(item.flags?.[SOURCE_FLAG_SCOPE]?.sourceData ?? item.flags?.[MODULE_ID]?.sourceData ?? item))
        .map(normalizeWeapon)
        .filter(Boolean);

    const readyWeapon = weapons.find((weapon) => weapon.ready);
    if (readyWeapon) return readyWeapon;

    return weapons[0] ?? null;
}

function isWeaponSource(source) {
    if (!source) return false;
    if (source.itemType === "weapon") return true;
    return source.folder === "Weapons";
}

function normalizeAmmoItem(ammo) {
    if (!ammo) return null;
    const source = ammo.flags?.[SOURCE_FLAG_SCOPE]?.sourceData ?? ammo.flags?.[MODULE_ID]?.sourceData ?? ammo;
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
        itemDocument: ammo,
    };
}

function resolveSelectedWeaponProfile(weapon, { profile = null, profileId = null } = {}) {
    if (profile) return profile;

    const attackProfiles = Array.isArray(weapon?.attackProfiles) ? weapon.attackProfiles : [];
    if (!attackProfiles.length) return null;

    if (profileId) {
        const explicitProfile = attackProfiles.find((entry) => entry?.id === profileId);
        if (explicitProfile) return explicitProfile;
    }

    const activeProfile = getProfileFromActiveKey(attackProfiles, weapon?.activeAttackProfileKey);
    return activeProfile ?? attackProfiles[0] ?? null;
}

function getProfileFromActiveKey(attackProfiles, activeKey) {
    const profileIndex = ACTIVE_ATTACK_PROFILE_KEYS.indexOf(String(activeKey ?? "").trim());
    if (profileIndex < 0) return null;
    return attackProfiles[profileIndex] ?? null;
}

function resolveLoadedAmmoForAttack({ actor, weapon, profile }) {
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
        actor,
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

function validateAmmoCompatibility({ weapon, profile, ammo, requireQuantity = true }) {
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

    return {
        valid: true,
        reason: "",
        allowedAmmoTypes,
    };
}

function getAllowedAmmoTypes(weapon, profile) {
    const profileAllowed = Array.isArray(profile?.allowedAmmoTypes)
        ? profile.allowedAmmoTypes.filter(Boolean)
        : [];
    if (profileAllowed.length) return profileAllowed;

    const weaponAmmoType = String(weapon?.ammoType ?? "").trim();
    return weaponAmmoType ? [weaponAmmoType] : [];
}

async function consumeLoadedAmmo({ actor, weapon, loadedAmmo }) {
    if (!weapon?.usesAmmo) return null;

    const weaponItem = weapon.itemDocument ?? actor?.items?.get?.(weapon._id) ?? null;
    if (!weaponItem?.update) return null;

    const currentLoaded = firstFiniteNumber([
        weaponItem.system?.props?.AmmoLoaded,
        weapon.ammoLoaded,
    ]) ?? 0;
    const nextLoaded = Math.max(0, currentLoaded - 1);

    await weaponItem.update({
        "system.props.AmmoLoaded": nextLoaded,
        "system.props.LoadedAmmoId": nextLoaded > 0 ? (loadedAmmo?._id ?? "") : "",
    });

    return {
        ammoItemId: loadedAmmo?._id ?? null,
        remainingQuantity: loadedAmmo?.quantity ?? null,
        ammoLoaded: nextLoaded,
    };
}

function createsSafeAttack(maneuver) {
    const effect = maneuver?.effectData ?? {};
    return Boolean(
        effect.createFreeSafeAttack ||
        effect.createSecondSafeAttack ||
        effect.createFreeSafeCounterattack ||
        effect.ifEscapeSucceedsCreateFreeSafeAttack
    );
}

function collectReservedCosts(maneuvers) {
    return maneuvers
        .filter((maneuver) => maneuver?.CostType && maneuver.CostType !== "null")
        .map((maneuver) => ({
            maneuverId: maneuver._id ?? maneuver.id ?? maneuver.name,
            costType: maneuver.CostType,
            costAmount: Number(maneuver.CostAmount ?? 0),
        }));
}

function mergeManeuverEffects(maneuvers) {
    return maneuvers.reduce(
        (summary, maneuver) => {
            const effect = maneuver?.effectData ?? {};
            summary.addMainDice += Number(effect.addMainDice ?? 0);
            summary.addDisadvantage += Number(effect.addDisadvantage ?? 0);
            summary.addMultiplierDice += Number(effect.addMultiplierDice ?? 0);
            summary.addRiskDice += Number(effect.addRiskDice ?? 0);
            summary.addMoveSquares += Number(effect.addMoveSquares ?? 0);
            summary.safeAttack = summary.safeAttack || createsSafeAttack(maneuver);
            return summary;
        },
        {
            addMainDice: 0,
            addDisadvantage: 0,
            addMultiplierDice: 0,
            addRiskDice: 0,
            addMoveSquares: 0,
            safeAttack: false,
        }
    );
}

function normalizeRollSummary(roll) {
    const summary = roll ?? {};
    return {
        damage: Number(summary.damage ?? 0),
        protection: Number(summary.protection ?? 0),
        crit: Number(summary.crit ?? 0),
        fumble: Number(summary.fumble ?? 0),
        multiplier: Number(summary.multiplier ?? 1),
    };
}

function applyMultiplier(roll) {
    const multiplier = Number.isFinite(roll.multiplier) && roll.multiplier > 0
        ? roll.multiplier
        : 1;

    return {
        ...roll,
        damage: roll.damage * multiplier,
        protection: roll.protection * multiplier,
        crit: roll.crit * multiplier,
    };
}

function findReactionResolution(event) {
    return event?.results?.find(
        (entry) => entry?.value?.reaction || entry?.value?.trigger
    )?.value ?? null;
}

function isPendingAttack(value) {
    return value?.kind === PENDING_ATTACK_KIND;
}

function firstFiniteNumber(values) {
    for (const value of values) {
        const numeric = Number(value);
        if (Number.isFinite(numeric) && numeric >= 0) return numeric;
    }
    return null;
}

const ACTIVE_ATTACK_PROFILE_KEYS = ["Attack", "AttackB", "AttackC"];





