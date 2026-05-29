const MODULE_ID = "1547core";
const SOURCE_FLAG_SCOPE = "1547Core";

function parseManeuverJson(value, fallback = null) {
    if (typeof value !== "string" || value.trim() === "") return fallback;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function buildManeuverSource(item, sourceData = {}, itemProps = {}, getNumericProp) {
    const rawTiming = sourceData.type ?? sourceData.timing ?? itemProps.Type ?? itemProps.Timing ?? sourceData.usage ?? itemProps.Usage ?? "";
    const rawTrigger = sourceData.triggerType ?? itemProps.TriggerType ?? itemProps.Trigger ?? "";
    const sourceRequirements = sourceData.requirements ?? {};
    const parsedEffectData = parseManeuverJson(itemProps.EffectData, null);
    const parsedUsageLimit = parseManeuverJson(itemProps.UsageLimitData, null);
    const maxUses = getNumericProp(itemProps, ["UsageLimit", "MaxUses"]);
    const tags = Array.isArray(sourceData.tags)
        ? [...sourceData.tags]
        : String(itemProps.Tags ?? "").split(",").map((entry) => entry.trim()).filter(Boolean);


    return {
        ...sourceData,
        _id: sourceData._id ?? sourceData.id ?? item.id,
        id: sourceData.id ?? sourceData._id ?? item.id,
        name: sourceData.name ?? item.name ?? "",
        folder: sourceData.folder ?? "Maneuvers",
        type: String(rawTiming ?? "").trim().toLowerCase(),
        triggerType: String(rawTrigger ?? "").trim().toLowerCase(),
        CostType: sourceData.CostType ?? itemProps.CostType ?? null,
        CostAmount: sourceData.CostAmount ?? getNumericProp(itemProps, ["CostAmount"]) ?? 0,
        requirements: {
            ...sourceRequirements,
            skill: sourceRequirements.skill ?? (String(itemProps.SkillRequirement ?? "").trim() || undefined),
            text: sourceRequirements.text ?? (String(itemProps.RequirementText ?? "").trim() || ""),
            targetText: sourceRequirements.targetText ?? (String(itemProps.TargetRequirement ?? "").trim() || undefined),
            requiredWeaponTags: Array.isArray(sourceRequirements.requiredWeaponTags)
                ? sourceRequirements.requiredWeaponTags
                : String(itemProps.RequiredWeaponTags ?? "").split(",").map((entry) => entry.trim()).filter(Boolean),
            excludedWeaponTags: Array.isArray(sourceRequirements.excludedWeaponTags)
                ? sourceRequirements.excludedWeaponTags
                : String(itemProps.ExcludedWeaponTags ?? "").split(",").map((entry) => entry.trim()).filter(Boolean),
        },
        effectData: sourceData.effectData ?? parsedEffectData ?? {},
        usageLimit: sourceData.usageLimit ?? parsedUsageLimit ?? (maxUses != null ? { maxUses } : {}),
        tags,
    };
}

function summarizeManeuverEffects(maneuvers) {
    return (Array.isArray(maneuvers) ? maneuvers : []).reduce((summary, maneuver) => {
        const effect = maneuver?.effectData ?? {};
        summary.addMainDice += Number(effect.addMainDice ?? 0) || 0;
        summary.addMultiplierDice += Number(effect.addMultiplierDice ?? 0) || 0;
        summary.addRiskDice += Number(effect.addRiskDice ?? 0) || 0;
        summary.addDisadvantage += Number(effect.addDisadvantage ?? 0) || 0;
        return summary;
    }, {
        addMainDice: 0,
        addMultiplierDice: 0,
        addRiskDice: 0,
        addDisadvantage: 0,
    });
}

function buildWeaponRollContext(summary, maneuverEffects = {}) {
    const base = summary?.weaponRollContext ?? summary?.rollContext ?? { advantageDice: 0, riskDice: 0 };
    return {
        ...base,
        addMainDice: Math.max(0, Number(base.addMainDice ?? 0) + Number(maneuverEffects.addMainDice ?? 0)),
        addMultiplierDice: Math.max(0, Number(base.addMultiplierDice ?? 0) + Number(maneuverEffects.addMultiplierDice ?? 0)),
        riskDice: Math.max(0, Number(base.riskDice ?? 0) + Number(maneuverEffects.addRiskDice ?? 0) + Number(maneuverEffects.addDisadvantage ?? 0)),
        ammoAddDice: Array.isArray(base.ammoAddDice) ? base.ammoAddDice.slice() : []
    };
}

function getAmmoAddDice(item, getStringProp) {
    const itemProps = item?.system?.props ?? {};
    const sourceData = item?.flags?.[SOURCE_FLAG_SCOPE]?.sourceData ?? item?.flags?.[MODULE_ID]?.sourceData ?? {};
    if (Array.isArray(sourceData?.addDice)) {
        return sourceData.addDice.filter((die) => typeof die === "string" && die.trim()).map((die) => die.trim());
    }
    const addDiceString = getStringProp(itemProps, ["AddDice", "AddDiceSummary"]);
    if (!addDiceString) return [];
    return addDiceString.split(",").map((entry) => String(entry ?? "").trim()).filter(Boolean);
}
function getPlayerFacingManeuverReason(reason, maneuver, context = {}) {
    const text = String(reason ?? "").trim();
    if (!text) return "";
    if (text.startsWith("Trigger mismatch:")) {
        const trigger = String(maneuver?.triggerType ?? "").trim().toLowerCase();
        if (trigger === "attack-declared") return "Use this by selecting it before declaring an attack.";
        if (trigger === "full-turn-activation") return "Use this as a full-turn maneuver before taking other actions.";
        if (trigger === "move-declared") return "This maneuver is used as part of movement, not the current attack flow.";
        if (trigger === "post-attack") return "This maneuver is only available after an attack resolves.";
        return "This maneuver is not available in the current action step.";
    }
    if (text === "Action economy does not allow this maneuver.") {
        if (maneuver?.type === "full-turn") return "A full turn must be available to use this maneuver.";
        return "No matching action is currently available for this maneuver.";
    }
    return text;
}
function getStoredDefaultDatasetEntry(game, MODULE_ID, settingKey, name) {
    const dataset = game?.settings?.get?.(MODULE_ID, settingKey) ?? [];
    if (!Array.isArray(dataset)) return null;
    return dataset.find((entry) => String(entry?.name ?? "").trim().toLowerCase() === String(name ?? "").trim().toLowerCase()) ?? null;
}

function buildDefaultUnarmedWeaponSummary(game, MODULE_ID, getWeaponAttackState, formatRangeSummary, token, primaryTarget, targetCount, attacksRemaining) {
    const source = getStoredDefaultDatasetEntry(game, MODULE_ID, "weaponData", "Unarmed") ?? {
        _id: "default-unarmed",
        id: "default-unarmed",
        name: "Unarmed",
        category: "Unarmed",
        minReach: 1,
        maxReach: 1,
        usesAmmo: false,
        ammoType: "",
        ammoCapacity: 0,
        ammoLoaded: 0,
        attackProfiles: [
            {
                id: "default",
                name: "Default",
                attackType: "melee",
                dice: ["Control", "Control", "Control"],
                tags: []
            }
        ]
    };
    const attackProfiles = (Array.isArray(source.attackProfiles) ? source.attackProfiles : []).map((profile, index) => ({
        key: index === 0 ? "Attack" : (index === 1 ? "AttackB" : `Attack${String.fromCharCode(65 + index)}`),
        index,
        label: profile?.name ?? (index === 0 ? "Default" : `Alternative ${index}`),
        formula: Array.isArray(profile?.dice) ? profile.dice.join(", ") : "",
        dice: Array.isArray(profile?.dice) ? [...profile.dice] : [],
        attackType: profile?.attackType ?? "melee",
        profileId: profile?.id ?? null,
        allowedAmmoTypes: Array.isArray(profile?.allowedAmmoTypes) ? [...profile.allowedAmmoTypes] : [],
        allowedAmmoText: Array.isArray(profile?.allowedAmmoTypes) ? profile.allowedAmmoTypes.join(", ") : ""
    }));
    const activeAttackProfile = attackProfiles[0] ?? null;
    const weaponSummary = {
        id: "__default-unarmed__",
        sourceId: source._id ?? source.id ?? "default-unarmed",
        name: source.name ?? "Unarmed",
        equipped: true,
        isVirtualDefault: true,
        itemDocument: null,
        type: source.category ?? "Unarmed",
        minReach: source.minReach ?? 1,
        maxReach: source.maxReach ?? 1,
        shortRange: source.shortRange ?? null,
        longRange: source.longRange ?? null,
        maxRange: source.maxRange ?? null,
        rangeSummary: formatRangeSummary({
            shortRange: source.shortRange ?? null,
            longRange: source.longRange ?? null,
            maxRange: source.maxRange ?? null,
        }),
        usesAmmo: false,
        ammoLoaded: 0,
        loadedAmmoId: null,
        loadedAmmoName: "",
        loadedAmmoType: "",
        loadedAmmoSummary: "",
        loadedAmmoQuantity: 0,
        selectedAmmoId: null,
        attackProfiles,
        activeAttackProfile: activeAttackProfile?.key ?? "Attack",
        activeAttackFormula: activeAttackProfile?.formula ?? "",
        activeAttackType: activeAttackProfile?.attackType ?? "melee",
        activeAttackProfileId: activeAttackProfile?.profileId ?? null,
        activeAttackAmmoText: "",
        activeAttackAllowedAmmoTypes: [],
        activeAttackProfileData: activeAttackProfile ? { ...activeAttackProfile } : null,
        canTargetMultiple: false,
        compatibleAmmo: [],
        traits: Array.isArray(source.traits) ? [...source.traits] : [],
    };
    weaponSummary.attackState = getWeaponAttackState(weaponSummary, {
        token,
        primaryTarget,
        targetCount,
        attacksRemaining,
    });
    return weaponSummary;
}

function buildDefaultUnprotectedArmorSummary(game, MODULE_ID) {
    const source = getStoredDefaultDatasetEntry(game, MODULE_ID, "armorData", "Unprotected") ?? {
        _id: "default-unprotected",
        id: "default-unprotected",
        name: "Unprotected",
        armorClass: "Unprotected",
        defenseDice: ["Evade", "Evade", "Evade"],
        traits: [],
    };
    const defenseDice = Array.isArray(source.defenseDice) ? [...source.defenseDice] : ["Evade", "Evade", "Evade"];
    return {
        id: "__default-unprotected__",
        sourceId: source._id ?? source.id ?? "default-unprotected",
        name: source.name ?? "Unprotected",
        equipped: true,
        isVirtualDefault: true,
        defense: defenseDice.join(", "),
        defenseDice,
        type: source.armorClass ?? "Unprotected",
        traits: Array.isArray(source.traits) ? [...source.traits] : [],
    };
}

function getAttachedModifierIds(item) {
    const sourceData = item?.flags?.[SOURCE_FLAG_SCOPE]?.sourceData ?? item?.flags?.[MODULE_ID]?.sourceData ?? {};
    const raw = item?.flags?.[SOURCE_FLAG_SCOPE]?.attachedModifierIds
        ?? item?.flags?.[MODULE_ID]?.attachedModifierIds
        ?? item?.system?.props?.AttachedModifierIds
        ?? sourceData?.attachedModifierIds
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

function getAttachedModifierNames(item, allItems = []) {
    const modifierIds = getAttachedModifierIds(item);
    if (!modifierIds.length) return [];
    return modifierIds
        .map((id) => allItems.find((entry) => entry?.id === id) ?? null)
        .filter(Boolean)
        .map((entry) => String(entry.name ?? "").trim())
        .filter(Boolean);
}

// Pure helpers exported for unit testing (no behavioural change to the runtime).
export {
    parseManeuverJson,
    summarizeManeuverEffects,
    buildWeaponRollContext,
    getAmmoAddDice,
    getAttachedModifierIds,
    getAttachedModifierNames,
};

function resolveActorPortrait(actor, token, MODULE_ID, game) {
    const tokenImage = token?.document?.texture?.src;
    if (tokenImage) return tokenImage;

    const resolver = game.modules.get(MODULE_ID)?.api?.imageResolver?.resolveMonsterImage;
    if (typeof resolver === "function") {
        return resolver(actor);
    }

    return actor?.img || "icons/svg/mystery-man.svg";
}


export function summarizeActor(actor, token, deps = {}) {
    const {
        MODULE_ID,
        SOURCE_FLAG_SCOPE,
        HUD_STATE,
        canvas,
        game,
        getActorProps,
        getNumericProp,
        getStringProp,
        isWeaponItem,
        isArmorItem,
        isAmmoItem,
        getCsbItemKind,
        getWeaponAttackProfiles,
        getWeaponActiveAttackProfile,
        getWeaponRangeBands,
        getWeaponReach,
        formatRangeSummary,
        getAmmoType,
        getAmmoQuantity,
        getAmmoSummary,
        getWeaponAttackState,
        getSelectedPreManeuverIds,
        setSelectedPreManeuverIds,
        getSelectedFullTurnManeuverId,
        clearSelectedFullTurnManeuver,
        getIgnoredCostManeuverIds,
        applyIgnoredCostOverride,
        buildReservedResourceTotals,
        getChebyshevDistanceSquares,
        isTruthyLike,
        normalizeManeuverTimingKey,
        formatManeuverTimingLabel,
        buildManeuverTooltip,
        getManeuverCostSummary,
        getManeuverEffectSummary,
        buildManeuverSummaryLine,
        buildManeuverDetailLine,
        getPlayerFacingItemGroup,
        isConsumableItem,
        getResourceSummary,
        formatCurrentMax,
        buildRollFormula,
        getSkillDiceShift,
        buildSkillRollData,
        getActivePersistentEffectsForActor,
        getActiveDefenseStateForActor,
        getDiceTabAttackSelection,
        getPendingNextAttackDice,
        getDiceTabSkillDice,
        getPendingNextSkillDice,
        getAttackDiceTabOptions,
        formatAttackDiceSelectionLabel,
        formatSkillD6SelectionLabel,
    } = deps;
    const props = getActorProps(actor);
    const items = actor?.items?.contents ?? actor?.items ?? [];
    const effects = actor?.effects?.contents ?? actor?.effects ?? [];
    const targetedTokens = Array.from(game.user?.targets ?? []);
    const primaryTarget = targetedTokens[0] ?? null;
    const attacksRemaining = getNumericProp(props, ["AttacksRemaining", "AttackRemaining", "attacksRemaining"]);
    const isCombatActive = Boolean(game.combat?.started);
    const weaponItems = items.filter(isWeaponItem);
    const armorItems = items.filter(isArmorItem);
    const ammoItems = items.filter(isAmmoItem);
    const maneuverItems = items.filter((item) => getCsbItemKind(item) === "maneuver");
    const supernaturalMarkItems = items.filter((item) => getCsbItemKind(item) === "supernatural-mark");
    const monsterMagicItems = items.filter((item) => getCsbItemKind(item) === "monster-magic");
    const skillItems = items.filter((item) => getCsbItemKind(item) === "skill");
    const inventoryItems = items.filter((item) => {
        const kind = getCsbItemKind(item);
        return !["maneuver", "skill", "pact", "supernatural-mark", "monster-magic", "spell", "usage-effect"].includes(kind);
    });

    let equippedWeapons = weaponItems.map((item) => {
        const itemProps = item.system?.props ?? {};
        const sourceData = item.flags?.[SOURCE_FLAG_SCOPE]?.sourceData ?? item.flags?.[MODULE_ID]?.sourceData ?? {};
        const attackProfiles = getWeaponAttackProfiles(item);
        const activeAttackProfile = getWeaponActiveAttackProfile(item);
        const rangeBands = getWeaponRangeBands(item);
        const reach = getWeaponReach(item);
        const usesAmmo = Boolean(itemProps.UsesAmmo);
        const loadedAmmoId = String(itemProps.LoadedAmmoId ?? "").trim();
        const loadedAmmo = ammoItems.find((ammo) => ammo.id === loadedAmmoId) ?? null;
        const compatibleAmmo = usesAmmo
            ? ammoItems.filter((ammo) => {
                const ammoType = getAmmoType(ammo);
                if (!ammoType || getAmmoQuantity(ammo) < 1) return false;
                if (activeAttackProfile?.allowedAmmoTypes?.length) {
                    return activeAttackProfile.allowedAmmoTypes.includes(ammoType);
                }
                const weaponAmmoType = String(itemProps.AmmoType ?? "").trim();
                return weaponAmmoType ? weaponAmmoType === ammoType : true;
            })
            : [];
        const selectedAmmoId = compatibleAmmo.some((ammo) => ammo.id === HUD_STATE.selectedAmmoByWeapon?.[item.id])
            ? HUD_STATE.selectedAmmoByWeapon[item.id]
            : (loadedAmmoId || null);
        if (usesAmmo && selectedAmmoId) {
            HUD_STATE.selectedAmmoByWeapon[item.id] = selectedAmmoId;
        }
        const selectedAmmo = selectedAmmoId ? ammoItems.find((ammo) => ammo.id === selectedAmmoId) ?? null : null;
        const weaponModifierNames = getAttachedModifierNames(item, items);
        const ammoModifierNames = selectedAmmo ? getAttachedModifierNames(selectedAmmo, items) : [];
        const weaponSummary = {
            id: item.id,
            name: item.name,
            equipped: Boolean(itemProps.Equipped),
            type: itemProps.WeaponType ?? sourceData.category ?? sourceData.type ?? "",
            minReach: reach.minReach,
            maxReach: reach.maxReach,
            shortRange: rangeBands.shortRange,
            longRange: rangeBands.longRange,
            maxRange: rangeBands.maxRange,
            rangeSummary: formatRangeSummary(rangeBands),
            usesAmmo,
            ammoLoaded: getNumericProp(itemProps, ["AmmoLoaded"]) ?? 0,
            loadedAmmoId: selectedAmmo?.id ?? null,
            loadedAmmoName: selectedAmmo?.name ?? "",
            loadedAmmoType: selectedAmmo ? getAmmoType(selectedAmmo) : "",
            loadedAmmoSummary: selectedAmmo ? getAmmoSummary(selectedAmmo) : "",
            loadedAmmoQuantity: selectedAmmo ? getAmmoQuantity(selectedAmmo) : 0,
            weaponModifierNames,
            weaponModifierSummary: weaponModifierNames.join(", "),
            ammoModifierNames,
            ammoModifierSummary: ammoModifierNames.join(", "),
            selectedAmmoId,
            loadedAmmoAddDice: selectedAmmo ? getAmmoAddDice(selectedAmmo, getStringProp) : [],
            attackProfiles,
            activeAttackProfile: activeAttackProfile?.key ?? "Attack",
            activeAttackFormula: activeAttackProfile?.formula ?? "",
            activeAttackType: activeAttackProfile?.attackType ?? null,
            activeAttackProfileId: activeAttackProfile?.profileId ?? null,
            activeAttackAmmoText: activeAttackProfile?.allowedAmmoText ?? "",
            activeAttackAllowedAmmoTypes: Array.isArray(activeAttackProfile?.allowedAmmoTypes) ? [...activeAttackProfile.allowedAmmoTypes] : [],
            activeAttackProfileData: activeAttackProfile ? { ...activeAttackProfile } : null,
            canTargetMultiple: Number(activeAttackProfile?.targetCount ?? 1) > 1,
            compatibleAmmo: compatibleAmmo.map((ammo) => ({
                id: ammo.id,
                name: ammo.name,
                ammoType: getAmmoType(ammo),
                quantity: getAmmoQuantity(ammo),
                summary: getAmmoSummary(ammo)
            }))
        };
        weaponSummary.attackState = getWeaponAttackState(weaponSummary, {
            token,
            primaryTarget,
            targetCount: targetedTokens.length,
            attacksRemaining: isCombatActive ? attacksRemaining : null
        });
        return weaponSummary;
    }).filter((item) => item.equipped);

    if (!equippedWeapons.length) {
        equippedWeapons = [buildDefaultUnarmedWeaponSummary(game, MODULE_ID, getWeaponAttackState, formatRangeSummary, token, primaryTarget, targetedTokens.length, attacksRemaining)];
    }

    let equippedArmor = armorItems.map((item) => {
        const itemProps = item.system?.props ?? {};
        const sourceData = item.flags?.[SOURCE_FLAG_SCOPE]?.sourceData ?? item.flags?.[MODULE_ID]?.sourceData ?? {};
        return {
            id: item.id,
            name: item.name,
            equipped: Boolean(itemProps.Equipped),
            defense: itemProps.Defense ?? "",
            type: itemProps.ArmorType ?? sourceData.armorClass ?? sourceData.type ?? "armor"
        };
    }).filter((item) => item.equipped);

    if (!equippedArmor.length) {
        equippedArmor = [buildDefaultUnprotectedArmorSummary(game, MODULE_ID)];
    }

    const fullTurnAvailable = getStringProp(props, ["FullTurnAvailable", "fullTurnAvailable"]) || "Unknown";
    const activeWeaponSummary = equippedWeapons[0] ?? null;
    const activeWeaponItem = activeWeaponSummary ? (activeWeaponSummary.itemDocument ?? actor.items?.get?.(activeWeaponSummary.id) ?? activeWeaponSummary) : null;
    const combatApi = game.modules.get(MODULE_ID)?.api?.combat ?? {};
    const evaluateManeuverLegality = combatApi?.evaluateManeuverLegality;
    const getStoredManeuverData = combatApi?.getStoredManeuverData;
    const actorConditions = effects.map((effect) => effect.name).filter(Boolean);
    const targetConditions = (primaryTarget?.actor?.effects?.contents ?? primaryTarget?.actor?.effects ?? []).map((effect) => effect.name).filter(Boolean);
    const maneuverEntries = maneuverItems.map((item) => {
        const sourceData = item.flags?.[SOURCE_FLAG_SCOPE]?.sourceData ?? item.flags?.[MODULE_ID]?.sourceData ?? {};
        const itemProps = item.system?.props ?? {};
        const source = buildManeuverSource(item, sourceData, itemProps, getNumericProp);
        const timingKey = normalizeManeuverTimingKey(source.type);
        return {
            item,
            source,
            itemId: item.id,
            sourceId: source._id ?? source.id ?? item.id,
            name: item.name,
            timingKey,
            timing: formatManeuverTimingLabel(timingKey)
        };
    });
    const storedManeuverEntries = typeof getStoredManeuverData === "function"
        ? (getStoredManeuverData() ?? []).map((source) => {
            const timingKey = normalizeManeuverTimingKey(source?.type);
            const sourceId = source?._id ?? source?.id ?? source?.name ?? null;
            return sourceId ? {
                item: null,
                source,
                itemId: sourceId,
                sourceId,
                name: source?.name ?? sourceId,
                timingKey,
                timing: formatManeuverTimingLabel(timingKey)
            } : null;
        }).filter(Boolean)
        : [];
    const learnedSourceIds = new Set(maneuverEntries.map((entry) => entry.sourceId));
    const fallbackPreEntries = storedManeuverEntries.filter((entry) => entry.timingKey === "pre" && !learnedSourceIds.has(entry.sourceId));
    const fallbackFullTurnEntries = storedManeuverEntries.filter((entry) => entry.timingKey === "full-turn" && !learnedSourceIds.has(entry.sourceId));
    const preManeuverEntries = [
        ...maneuverEntries.filter((entry) => entry.timingKey === "pre" && String(entry.source?.triggerType ?? "").trim().toLowerCase() === "attack-declared"),
        ...fallbackPreEntries
    ];
    const fullTurnManeuverEntries = [
        ...maneuverEntries.filter((entry) => entry.timingKey === "full-turn"),
        ...fallbackFullTurnEntries
    ];
    const selectedPreIds = getSelectedPreManeuverIds(actor.id).filter((id) => preManeuverEntries.some((entry) => entry.itemId === id));
    setSelectedPreManeuverIds(actor.id, selectedPreIds);
    const selectedPreEntries = preManeuverEntries.filter((entry) => selectedPreIds.includes(entry.itemId));
    const selectedPreSourceIds = selectedPreEntries.map((entry) => entry.source._id ?? entry.source.id ?? entry.source.name).filter(Boolean);
    const ignoredCostIds = new Set(getIgnoredCostManeuverIds(actor.id));
    const selectedFullTurnId = getSelectedFullTurnManeuverId(actor.id);
    const selectedFullTurnEntry = fullTurnManeuverEntries.find((entry) => entry.itemId === selectedFullTurnId) ?? null;
    if (selectedFullTurnId && !selectedFullTurnEntry) {
        clearSelectedFullTurnManeuver(actor.id);
    }
    const usedManeuvers = [];
    const hasVisibleAlly = Boolean(canvas?.tokens?.placeables?.some((placeable) => {
        const otherActorId = placeable?.actor?.id;
        if (!otherActorId || otherActorId === actor.id) return false;
        if (placeable.document?.hidden) return false;
        return Number(placeable.document?.disposition) === Number(token?.document?.disposition);
    }));
    const reservedManeuverSources = [
        ...selectedPreEntries.map((entry) => applyIgnoredCostOverride(entry.source, ignoredCostIds.has(entry.itemId))),
        ...(selectedFullTurnEntry ? [applyIgnoredCostOverride(selectedFullTurnEntry.source, ignoredCostIds.has(selectedFullTurnEntry.itemId))] : []),
    ];
    const reservedResources = buildReservedResourceTotals(reservedManeuverSources);
    const preContext = {
        actor,
        armors: armorItems,
        weapon: activeWeaponItem,
        profile: activeWeaponSummary?.activeAttackProfileData ?? null,
        target: primaryTarget?.actor ?? null,
        targets: primaryTarget?.actor ? [primaryTarget.actor] : [],
        timingType: "pre",
        triggerType: "attack-declared",
        distanceSquares: getChebyshevDistanceSquares(token, primaryTarget),
        rangeSquares: getChebyshevDistanceSquares(token, primaryTarget),
        attacksRemaining: isCombatActive ? attacksRemaining : null,
        fullTurnAvailable: isCombatActive ? isTruthyLike(fullTurnAvailable) : true,
        actorConditions,
        targetConditions,
        hasVisibleAlly,
        usedManeuvers,
        reservedResources,
        selectedManeuverIds: selectedPreSourceIds,
        currentCriticalPoints: getNumericProp(props, ["CriticalPoints", "CurrentCriticalPoints"]) ?? 0
    };
    const maneuvers = preManeuverEntries.map((entry) => {
        const evaluation = typeof evaluateManeuverLegality === "function"
            ? evaluateManeuverLegality(entry.source, preContext)
            : { legal: true, reasons: [] };
        const selected = selectedPreIds.includes(entry.itemId);
        const state = !evaluation.legal ? "disabled" : (selected ? "selected" : "enabled");
        const reason = getPlayerFacingManeuverReason(evaluation.reasons?.[0] ?? "", entry.source, preContext);
        return {
            id: entry.itemId,
            sourceId: entry.sourceId,
            name: entry.name,
            timing: entry.timing,
            timingKey: entry.timingKey,
            type: entry.timingKey,
            state,
            selected,
            disabled: state === "disabled",
            usable: state !== "disabled",
            selectable: true,
            tooltip: buildManeuverTooltip(entry.source, reason),
            reason,
            costSummary: ignoredCostIds.has(entry.itemId) ? `${getManeuverCostSummary(entry.source)} ignored` : getManeuverCostSummary(entry.source),
            effectSummary: getManeuverEffectSummary(entry.source),
            summaryLine: buildManeuverSummaryLine(entry.source),
            detailLine: buildManeuverDetailLine(entry.source),
            source: applyIgnoredCostOverride(entry.source, ignoredCostIds.has(entry.itemId)),
            item: entry.item
        };
    });
    const fullTurnContext = {
        actor,
        armors: armorItems,
        weapon: activeWeaponItem,
        profile: activeWeaponSummary?.activeAttackProfileData ?? null,
        target: primaryTarget?.actor ?? null,
        targets: primaryTarget?.actor ? [primaryTarget.actor] : [],
        timingType: "full-turn",
        triggerType: "full-turn-activation",
        distanceSquares: getChebyshevDistanceSquares(token, primaryTarget),
        rangeSquares: getChebyshevDistanceSquares(token, primaryTarget),
        attacksRemaining,
        fullTurnAvailable: isCombatActive ? isTruthyLike(fullTurnAvailable) : true,
        actorConditions,
        targetConditions,
        hasVisibleAlly,
        usedManeuvers,
        reservedResources,
        selectedManeuverIds: selectedFullTurnEntry ? [selectedFullTurnEntry.sourceId] : [],
        currentCriticalPoints: getNumericProp(props, ["CriticalPoints", "CurrentCriticalPoints"]) ?? 0
    };
    const fullTurnManeuvers = fullTurnManeuverEntries.map((entry) => {
        const evaluation = typeof evaluateManeuverLegality === "function"
            ? evaluateManeuverLegality(entry.source, fullTurnContext)
            : { legal: true, reasons: [] };
        const selected = selectedFullTurnEntry?.itemId === entry.itemId;
        const state = !evaluation.legal ? "disabled" : (selected ? "selected" : "enabled");
        const reason = getPlayerFacingManeuverReason(evaluation.reasons?.[0] ?? "", entry.source, fullTurnContext);
        return {
            id: entry.itemId,
            sourceId: entry.sourceId,
            name: entry.name,
            timing: entry.timing,
            timingKey: entry.timingKey,
            type: entry.timingKey,
            state,
            selected,
            disabled: state === "disabled",
            usable: state !== "disabled",
            selectable: true,
            tooltip: buildManeuverTooltip(entry.source, reason),
            reason,
            costSummary: ignoredCostIds.has(entry.itemId) ? `${getManeuverCostSummary(entry.source)} ignored` : getManeuverCostSummary(entry.source),
            effectSummary: getManeuverEffectSummary(entry.source),
            summaryLine: buildManeuverSummaryLine(entry.source),
            detailLine: buildManeuverDetailLine(entry.source),
            source: applyIgnoredCostOverride(entry.source, ignoredCostIds.has(entry.itemId)),
            item: entry.item,
            weaponId: activeWeaponItem?.id ?? null,
            profileId: activeWeaponSummary?.activeAttackProfileId ?? null,
            distanceSquares: getChebyshevDistanceSquares(token, primaryTarget)
        };
    });
    const selectedPreManeuvers = maneuvers.filter((maneuver) => maneuver.selected).map((maneuver) => maneuver.source);
    const selectedFullTurnManeuver = fullTurnManeuvers.find((maneuver) => maneuver.selected) ?? null;
    const inventory = inventoryItems.map((item) => {
        const sourceData = item.flags?.[SOURCE_FLAG_SCOPE]?.sourceData ?? item.flags?.[MODULE_ID]?.sourceData ?? {};
        const itemProps = item.system?.props ?? {};
        return {
            id: item.id,
            name: item.name,
            group: getPlayerFacingItemGroup(item),
            equipped: Boolean(itemProps.Equipped),
            consumable: isConsumableItem(item),
            itemKind: getCsbItemKind(item),
            templateId: item.system?.template ?? "",
            type: itemProps.WeaponType ?? itemProps.ArmorType ?? sourceData.category ?? sourceData.armorClass ?? sourceData.type ?? ""
        };
    });

    const equippedInventory = inventory.filter((item) => item.equipped);
    const stowedInventory = inventory.filter((item) => !item.equipped);
    const summarizeMagicCarrier = (item, itemKind) => {
        const itemProps = item.system?.props ?? {};
        const sourceData = item.flags?.[SOURCE_FLAG_SCOPE]?.sourceData ?? item.flags?.[MODULE_ID]?.sourceData ?? {};
        const rawDescription = String(itemProps.Description ?? sourceData.description ?? sourceData.Description ?? "").trim();
        const description = rawDescription
            ? rawDescription.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)[0] ?? ""
            : "";
        return {
            id: item.id,
            name: item.name,
            description,
            itemKind
        };
    };
    const supernaturalMarks = supernaturalMarkItems.map((item) => summarizeMagicCarrier(item, "supernatural-mark"));
    const monsterMagic = monsterMagicItems.map((item) => summarizeMagicCarrier(item, "monster-magic"));
    const pointPools = [
        { label: "STR", key: "StrengthPoints" },
        { label: "STA", key: "StaminaPoints" },
        { label: "DEX", key: "DexterityPoints" },
        { label: "INT", key: "IntelligencePoints" },
        { label: "FTH", key: "FaithPoints" },
        { label: "CHA", key: "CharismaPoints" },
        { label: "POW", key: "PowerPoints" }
    ].map((entry) => {
        const summary = getResourceSummary(props, entry.key);
        const reserved = Math.max(0, Number(reservedResources[entry.key] ?? 0) || 0);
        const available = summary.current === null ? null : Math.max(0, summary.current - reserved);
        return {
            label: entry.label,
            key: entry.key,
            current: available,
            max: summary.max,
            reserved,
            display: formatCurrentMax(available, summary.max)
        };
    }).filter((entry) => entry.current !== null || entry.max !== null);

    const riskAndCritical = [
        { label: "RISK", key: "RiskPoints" },
        { label: "CRIT", key: "CriticalPoints" }
    ].map((entry) => {
        const summary = getResourceSummary(props, entry.key);
        const reserved = Math.max(0, Number(reservedResources[entry.key] ?? 0) || 0);
        const available = summary.current === null ? null : Math.max(0, summary.current - reserved);
        return {
            label: entry.label,
            key: entry.key,
            current: available,
            max: summary.max,
            reserved,
            display: formatCurrentMax(available, summary.max)
        };
    }).filter((entry) => entry.current !== null || entry.max !== null);


    const statDefinitions = [
        "Strength",
        "Stamina",
        "Dexterity",
        "Charisma",
        "Intelligence",
        "Faith",
        "Power"
    ];

    const stats = statDefinitions.map((label) => {
        const dice = getNumericProp(props, [`Stats_${label}Dice`, `${label}Dice`]);
        const mod = getNumericProp(props, [`Stats_${label}Mod`, `${label}Mod`]) ?? 0;
        if (dice === null && mod === null) return null;
        return {
            label,
            dice: Math.max(0, dice ?? 0),
            mod: Math.max(0, mod ?? 0),
            formula: buildRollFormula(dice ?? 0, mod ?? 0)
        };
    }).filter(Boolean);

    const statMap = new Map(stats.map((stat) => [stat.label, stat]));

    const skills = skillItems.map((item) => {
        const sourceData = item.flags?.[SOURCE_FLAG_SCOPE]?.sourceData ?? item.flags?.[MODULE_ID]?.sourceData ?? {};
        const itemProps = item.system?.props ?? {};
        const statLabel = itemProps.Stat ?? sourceData.linkedStat ?? itemProps.LinkedStat ?? "";
        const baseStat = statMap.get(statLabel) ?? null;
        const currentLevel = getNumericProp(itemProps, ["CurrentLevel"]) ?? 0;
        const diceShift = getSkillDiceShift(itemProps);
        const rollData = buildSkillRollData(baseStat, diceShift, 0, 0);
        return {
            id: item.id,
            name: item.name,
            group: sourceData.group ?? itemProps.Group ?? "",
            linkedStat: statLabel,
            currentLevel,
            diceShift,
            canRoll: Boolean(itemProps.CanRoll),
            formula: baseStat ? rollData.formula : "",
            baseFormula: baseStat?.formula ?? "",
            finalDice: rollData.dice,
            finalMod: rollData.mod,
            usedFallback: rollData.usedFallback
        };
    });

    const hitPointSummary = {
        current: getNumericProp(props, ["CurrentHitPoints", "HitPoints", "HP", "CurrentHP"]),
        max: getNumericProp(props, ["MaxHitPoints", "HitPointsMax", "HPMax", "MaximumHitPoints"])
    };

    const rollContext = {
        advantageDice: getNumericProp(props, ["AvailableAdvantageDice", "AdvantageDice", "Advantage"]) ?? 0,
        riskDice: getNumericProp(props, ["AvailableRiskDice", "RiskDice"]) ?? 0,
        extraD6: getPendingNextSkillDice(actor.id),
    };
    const attackDiceSelection = getDiceTabAttackSelection(actor.id);
    const pendingAttackDice = getPendingNextAttackDice(actor.id);
    const selectedSkillDice = getDiceTabSkillDice(actor.id);
    const pendingSkillDice = getPendingNextSkillDice(actor.id);
    const attackDiceOptions = getAttackDiceTabOptions();

    const activePersistentEffects = [
        ...getActivePersistentEffectsForActor(actor, {
            isCombatActive,
            fullTurnAvailable: isCombatActive ? isTruthyLike(fullTurnAvailable) : true,
        }),
        ...getActiveDefenseStateForActor(actor)
    ];
    const aimedEffectActive = activePersistentEffects.some((entry) => entry.effectType === "aimed");
    const bracedEffectActive = activePersistentEffects.some((entry) => entry.effectType === "braced");
    const weaponRollContext = {
        ...rollContext,
        advantageDice: rollContext.advantageDice + (aimedEffectActive ? 1 : 0),
        addMainDice: 0,
        addMultiplierDice: bracedEffectActive ? 1 : 0,
        extraDiceCounts: pendingAttackDice,
    };

    const maneuverEffects = summarizeManeuverEffects(selectedPreManeuvers);
    const effectiveWeaponRollContext = buildWeaponRollContext({ weaponRollContext, rollContext }, maneuverEffects);
    const diceTab = {
        attackOptions: attackDiceOptions.map((option) => ({
            ...option,
            selectedCount: Math.max(0, Number(attackDiceSelection?.[option.key] ?? 0) || 0),
            pendingCount: Math.max(0, Number(pendingAttackDice?.[option.key] ?? 0) || 0),
        })),
        attackSelectionLabel: formatAttackDiceSelectionLabel(attackDiceSelection),
        pendingAttackLabel: formatAttackDiceSelectionLabel(pendingAttackDice),
        hasAttackSelection: Object.keys(attackDiceSelection ?? {}).length > 0,
        hasPendingAttackDice: Object.keys(pendingAttackDice ?? {}).length > 0,
        selectedSkillDice,
        pendingSkillDice,
        skillSelectionLabel: formatSkillD6SelectionLabel(selectedSkillDice),
        pendingSkillLabel: formatSkillD6SelectionLabel(pendingSkillDice),
        hasSkillSelection: selectedSkillDice > 0,
        hasPendingSkillDice: pendingSkillDice > 0,
    };

    return {
        actorId: actor.id,
        actorName: actor.name,
        tokenName: token?.name ?? actor.name,
        actorImg: resolveActorPortrait(actor, token, MODULE_ID, game),
        hitPoints: hitPointSummary.current,
        maxHitPoints: hitPointSummary.max,
        movement: getNumericProp(props, ["MovementRemaining", "MoveRemaining", "movementRemaining"]),
        attacks: attacksRemaining,
        attacksRemaining,
        fullTurnAvailable,
        readyState: getStringProp(props, ["Done", "done"]) || "Unknown",
        stats,
        pointPools,
        riskAndCritical,
        rollContext,
        weaponRollContext: effectiveWeaponRollContext,
        diceTab,
        activePersistentEffects,
        conditions: effects.map((effect) => effect.name).filter(Boolean),
        equippedWeapons,
        equippedArmor,
        maneuvers,
        fullTurnManeuvers,
        selectedPreManeuvers,
        selectedFullTurnManeuver,
        reservedResources,
        usedManeuvers,
        targetConditions,
        hasVisibleAlly,
        skills,
        supernaturalMarks,
        monsterMagic,
        inventory: stowedInventory,
        equippedInventory,
        maneuverCount: maneuvers.length + fullTurnManeuvers.length,
        isCombatActive,
        round: game.combat?.round ?? null
    };
}















