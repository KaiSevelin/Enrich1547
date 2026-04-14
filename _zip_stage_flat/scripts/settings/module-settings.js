const MODULE_ID = "1547core";
const SOURCE_FLAG_SCOPE = "1547Core";
const TEMPLATE_FILES = {
    maneuver: "fvtt-Item-maneuvertemplate-4owc4YQBlp94GbGs.json",
    weapon: "fvtt-Item-weapontemplate-qZCfLEYQ7egbm1B9.json",
    armor: "fvtt-Item-armor-uLlgZXz3GlXPFtsj.json",
    ammo: "fvtt-Item-unequippabletemplate-389uqkKKn8M1SKux.json"
};
const VALID_FOUNDRY_ID = /^[A-Za-z0-9]{16}$/;

function getModuleBasePath() {
    const modulePath = game.modules.get(MODULE_ID)?.path ?? game.modules.get(SOURCE_FLAG_SCOPE)?.path ?? "";
    const normalizedPath = String(modulePath).replace(/\\/g, "/");
    const folderName = normalizedPath.split("/").filter(Boolean).pop();
    return folderName ? `modules/${folderName}` : `modules/${MODULE_ID}`;
}

function isValidFoundryId(value) {
    return VALID_FOUNDRY_ID.test(String(value ?? ""));
}

function deriveFoundryIdFromText(text) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let hashA = 2166136261;
    let hashB = 16777619;
    const source = String(text ?? "1547CoreItem");
    for (const ch of source) {
        const code = ch.charCodeAt(0);
        hashA ^= code;
        hashA = Math.imul(hashA, 16777619) >>> 0;
        hashB = (Math.imul(hashB ^ code, 2246822519) + 3266489917) >>> 0;
    }

    let output = "";
    for (let i = 0; i < 16; i += 1) {
        hashA = (Math.imul(hashA ^ (hashB >>> (i % 8)), 1664525) + 1013904223) >>> 0;
        output += alphabet[hashA % alphabet.length];
    }
    return output;
}

function normalizeSourceEntry(source, kind) {
    const normalized = foundry.utils.deepClone(source);
    let nextId = normalized._id;
    const uuidSuffix = typeof normalized.uuid === "string" ? normalized.uuid.split(".").pop() : "";

    if (!isValidFoundryId(nextId)) {
        if (isValidFoundryId(normalized.id)) {
            nextId = normalized.id;
        } else if (isValidFoundryId(uuidSuffix)) {
            nextId = uuidSuffix;
        } else {
            nextId = deriveFoundryIdFromText(`${kind}:${normalized.name}:${normalized.uuid ?? ""}`);
        }
    }

    normalized._id = nextId;
    normalized.id = nextId;
    normalized.uuid = `Item.${nextId}`;
    return normalized;
}

function cloneTemplateSystem(template) {
    return {
        body: foundry.utils.deepClone(template.system.body),
        display: foundry.utils.deepClone(template.system.display),
        header: foundry.utils.deepClone(template.system.header),
        hidden: foundry.utils.deepClone(template.system.hidden ?? []),
        modifiers: [],
        template: template._id,
        templateSystemUniqueVersion: template.system.templateSystemUniqueVersion,
        props: {}
    };
}

function normalizeTraitKey(value) {
    return String(value ?? "").replace(/[^A-Za-z0-9]/g, "");
}

function buildWeaponProps(weapon) {
    const traitKeys = [
        "Aiming", "ArmorBreaking", "Bracing", "Charging", "Control",
        "Disarming", "Fast", "Fragile", "Heavy", "Hooking",
        "Narrow", "Parrying", "PointBlank", "RigidBlade",
        "Receiving", "Reloading", "Shield", "SmallShield", "Tactical"
    ];
    const normalizedTraits = new Set((weapon.traits ?? []).map(normalizeTraitKey));
    const [a, b, c] = weapon.attackProfiles ?? [];

    const profileText = (profile) => {
        if (!profile) return "";
        const diceText = Array.isArray(profile.dice) ? profile.dice.join(", ") : "";
        return profile.name && profile.name !== "Default"
            ? `${profile.name}: ${diceText}`
            : diceText;
    };

    const profileAmmoText = (profile) => {
        if (!profile || !weapon.usesAmmo) return "";
        const allowedAmmoTypes = Array.isArray(profile.allowedAmmoTypes) && profile.allowedAmmoTypes.length > 0
            ? profile.allowedAmmoTypes
            : (weapon.ammoType ? [weapon.ammoType] : []);
        return allowedAmmoTypes.join(", ");
    };

    const availableProfiles = [a, b, c]
        .map((profile, index) => profile ? ["Attack", "AttackB", "AttackC"][index] : null)
        .filter(Boolean);
    const sourceActiveProfile = String(weapon.activeAttackProfile ?? "").trim();
    const activeAttackProfile = availableProfiles.includes(sourceActiveProfile)
        ? sourceActiveProfile
        : (availableProfiles[0] ?? "Attack");

    const props = {
        Description: "",
        Weight: weapon.weight ?? 0,
        Value: weapon.value ?? 0,
        Equipped: Boolean(weapon.equipped),
        Ready: Boolean(weapon.ready),
        WeaponType: weapon.category ?? "Blade",
        MinReach: weapon.minReach ?? "",
        MaxReach: weapon.maxReach ?? "",
        ShortRange: weapon.shortRange ?? "",
        LongRange: weapon.longRange ?? "",
        MaxRange: weapon.maxRange ?? "",
        UsesAmmo: Boolean(weapon.usesAmmo),
        AmmoType: weapon.ammoType ?? "",
        AmmoCapacity: weapon.ammoCapacity ?? 0,
        AmmoLoaded: weapon.ammoLoaded ?? 0,
        LoadedAmmoId: weapon.loadedAmmoId ?? "",
        ReloadTime: weapon.reloadTime ?? 0,
        ReloadProgress: weapon.reloadProgress ?? 0,
        Attack: profileText(a),
        AttackAmmo: profileAmmoText(a),
        AttackB: profileText(b),
        AttackBAmmo: profileAmmoText(b),
        AttackC: profileText(c),
        AttackCAmmo: profileAmmoText(c),
        ActiveAttackProfile: activeAttackProfile
    };

    for (const key of traitKeys) {
        props[`Traits_${key}`] = normalizedTraits.has(key);
    }

    return props;
}

function buildArmorProps(armor) {
    const traitKeys = ["Concealable", "Encumbering", "Flexible", "Noisy", "Soft", "Resistance", "VerySoft"];
    const normalizedTraits = new Set((armor.traits ?? []).map(normalizeTraitKey));
    const props = {
        Description: "",
        Weight: armor.weight ?? 0,
        Value: armor.value ?? 0,
        Equipped: Boolean(armor.equipped),
        ArmorType: armor.armorClass ?? "Light",
        Defense: Array.isArray(armor.defenseDice) ? armor.defenseDice.join(", ") : ""
    };

    for (const key of traitKeys) {
        props[`Traits_${key}`] = normalizedTraits.has(key);
    }

    return props;
}

function buildAmmoProps(ammo) {
    const addDice = Array.isArray(ammo.addDice) ? ammo.addDice.join(", ") : "";
    const tags = Array.isArray(ammo.tags) ? ammo.tags.join(", ") : "";
    const range = ammo.range
        ?? (ammo.rangeOverride ? { mode: "override", ...ammo.rangeOverride } : null)
        ?? (ammo.rangeModifier ? { mode: "modify", ...ammo.rangeModifier } : null)
        ?? null;
    return {
        Description: ammo.description ?? "",
        Weight: ammo.weight ?? 0,
        Value: ammo.value ?? 0,
        Quantity: ammo.quantity ?? 1,
        AmmoType: ammo.ammoType ?? ammo.name ?? "",
        AddDice: addDice,
        AddDiceSummary: addDice,
        Tags: tags,
        TagsSummary: tags,
        RangeModeOverride: String(range?.mode ?? "modify").trim().toLowerCase() === "override",
        RangeShort: range?.shortRange ?? 0,
        RangeMedium: range?.longRange ?? 0,
        RangeLong: range?.maxRange ?? 0,
        Range: range ? JSON.stringify(range, null, 2) : "",
        ResultModifiers: JSON.stringify(ammo.resultModifiers ?? [], null, 2)
    };
}

function inferManeuverEffectFamily(maneuver) {
    const tags = new Set(maneuver.tags ?? []);
    if (maneuver.name === "Overwatch") return "prepared-effect";
    if (maneuver.name === "Suppressing Fire") return "battlefield-effect";
    if (tags.has("persistent")) return "prepared-effect";
    if (tags.has("safe-attack")) return "safe-attack";
    if (tags.has("movement")) return "movement";
    if (tags.has("control")) return "control";
    if (tags.has("condition")) return "condition";
    if (tags.has("utility")) return "utility";
    return tags.has("attack-modifier") ? "attack-modifier" : "utility";
}

function inferManeuverPersistentEffectType(maneuver) {
    if (maneuver.name === "Aim") return "aimed";
    if (maneuver.name === "Brace" || maneuver.name === "Brace Firearm") return "braced";
    if (maneuver.name === "Overwatch") return "overwatch";
    if (maneuver.name === "Lock") return "locked";
    if (maneuver.name === "Choke") return "choking-hold";
    return "";
}

function inferManeuverBattlefieldEffectType(maneuver) {
    if (maneuver.name === "Suppressing Fire") return "suppressing-fire";
    return "";
}

function inferManeuverTargetType(maneuver) {
    const effectData = maneuver.effectData ?? {};
    if (effectData.area) return "area";
    if (effectData.target === "visible-ally") return "ally";
    if (effectData.target === "self") return "self";
    if (effectData.target && String(effectData.target).includes("ally")) return "ally";
    if (maneuver.tags?.includes("support")) return "ally";
    return "enemy";
}

function inferManeuverRollType(maneuver) {
    if (maneuver.triggerType === "move-declared" || maneuver.tags?.includes("movement")) return "movement";
    if (maneuver.tags?.includes("defense") || maneuver.triggerType === "damage-taken") return "defense";
    if (maneuver.name === "Grapple Break") return "escape";
    return "attack";
}

function buildManeuverProps(maneuver) {
    const requirements = maneuver.requirements ?? {};
    const usageLimit = maneuver.usageLimit?.maxUses ?? 1;
    const effectFamily = inferManeuverEffectFamily(maneuver);
    const persistentEffectType = inferManeuverPersistentEffectType(maneuver);
    const battlefieldEffectType = inferManeuverBattlefieldEffectType(maneuver);
    const requiredTagParts = [];
    if (Array.isArray(requirements.requiredWeaponTraits) && requirements.requiredWeaponTraits.length > 0) {
        requiredTagParts.push(...requirements.requiredWeaponTraits);
    }
    if (Array.isArray(requirements.requiredWeaponGroups) && requirements.requiredWeaponGroups.length > 0) {
        requiredTagParts.push(...requirements.requiredWeaponGroups);
    }
    if (Array.isArray(requirements.requiredWeaponTags) && requirements.requiredWeaponTags.length > 0) {
        requiredTagParts.push(...requirements.requiredWeaponTags);
    } else if (requirements.requiredWeaponTags) {
        requiredTagParts.push(requirements.requiredWeaponTags);
    }
    const requiredWeaponTags = requiredTagParts.join(", ");
    const excludedWeaponTags = Array.isArray(requirements.excludedWeaponTags)
        ? requirements.excludedWeaponTags.join(", ")
        : (requirements.excludedWeaponTags ?? "");

    return {
        SkillRequirement: requirements.skill ?? "",
        RequirementText: requirements.text ?? "",
        TargetRequirement: requirements.target ?? "",
        RequiredWeaponTags: requiredWeaponTags,
        ExcludedWeaponTags: excludedWeaponTags,
        UsageLimit: usageLimit,
        EffectFamily: effectFamily,
        CreatesPersistentEffect: Boolean(persistentEffectType),
        PersistentEffectType: persistentEffectType,
        CreatesBattlefieldEffect: Boolean(battlefieldEffectType),
        BattlefieldEffectType: battlefieldEffectType,
        EffectData: JSON.stringify(maneuver.effectData ?? {}, null, 2),
        Automated: Boolean(maneuver.automated),
        HandlerId: maneuver.handlerId ?? "",
        Description: "",
        Usage: maneuver.type ?? "pre",
        Trigger: maneuver.triggerType ?? "attack-declared",
        CostType: maneuver.CostType ?? "null",
        CostAmount: maneuver.CostAmount ?? 0,
        TargetType: inferManeuverTargetType(maneuver),
        RollType: inferManeuverRollType(maneuver)
    };
}

function makeItemDoc(source, template, img, propsBuilder, folderId) {
    return {
        _id: source._id,
        name: source.name,
        type: "equippableItem",
        img,
        system: {
            ...cloneTemplateSystem(template),
            props: propsBuilder(source)
        },
        effects: [],
        folder: folderId ?? null,
        flags: {
            "custom-system-builder": {
                version: template.flags?.["custom-system-builder"]?.version ?? "5.2.0"
            },
            [SOURCE_FLAG_SCOPE]: {
                folderHint: source.folder ?? null,
                sourceData: source
            }
        },
        items: [],
        ownership: { default: 0 }
    };
}

function makeTemplateDoc(template) {
    return {
        _id: template._id,
        name: template.name,
        type: template.type,
        img: template.img,
        system: foundry.utils.deepClone(template.system),
        effects: foundry.utils.deepClone(template.effects ?? []),
        folder: template.folder ?? null,
        flags: foundry.utils.deepClone(template.flags ?? {}),
        items: foundry.utils.deepClone(template.items ?? []),
        ownership: foundry.utils.deepClone(template.ownership ?? { default: 0 })
    };
}

async function upsertWorldItems(docs) {
    const sourceIds = new Set(docs.map((doc) => doc._id));
    const existingById = new Map(
        game.items.filter((item) => sourceIds.has(item.id)).map((item) => [item.id, item])
    );

    const toCreate = [];
    const toUpdate = [];

    for (const doc of docs) {
        const existing = existingById.get(doc._id);
        if (existing) {
            toUpdate.push({
                ...doc,
                _id: existing.id
            });
        } else {
            toCreate.push(doc);
        }
    }

    if (toCreate.length > 0) {
        await Item.createDocuments(toCreate);
    }

    if (toUpdate.length > 0) {
        await Item.updateDocuments(toUpdate);
    }

    return {
        created: toCreate.length,
        updated: toUpdate.length
    };
}

async function pruneManagedFolderItems({ folderId, validIds, templateId, folderHint }) {
    if (!folderId || !(validIds instanceof Set) || validIds.size === 0) {
        return { removed: 0 };
    }

    const staleIds = game.items
        .filter((item) => item.folder?.id === folderId)
        .filter((item) => {
            const sourceFlag = item.flags?.[SOURCE_FLAG_SCOPE] ?? {};
            const itemFolderHint = sourceFlag.folderHint ?? sourceFlag.sourceData?.folder ?? null;
            const usesManagedTemplate = item.system?.template === templateId;
            const isManaged = itemFolderHint === folderHint || usesManagedTemplate;
            return isManaged && !validIds.has(item.id);
        })
        .map((item) => item.id);

    if (staleIds.length > 0) {
        await Item.deleteDocuments(staleIds);
    }

    return { removed: staleIds.length };
}

export function register1547ModuleSettings() {
    game.settings.register(MODULE_ID, "maneuverData", {
        name: "Maneuver Data",
        scope: "world",
        config: false,
        type: Object,
        default: []
    });

    game.settings.register(MODULE_ID, "weaponData", {
        name: "Weapon Data",
        scope: "world",
        config: false,
        type: Object,
        default: []
    });

    game.settings.register(MODULE_ID, "armorData", {
        name: "Armor Data",
        scope: "world",
        config: false,
        type: Object,
        default: []
    });

    game.settings.register(MODULE_ID, "ammoData", {
        name: "Ammunition Data",
        scope: "world",
        config: false,
        type: Object,
        default: []
    });

    game.settings.register(MODULE_ID, "lastDataSetupAt", {
        name: "Last Data Setup",
        scope: "world",
        config: false,
        type: String,
        default: ""
    });

    game.settings.register(MODULE_ID, "reactionWindowSeconds", {
        name: "Reaction Window Seconds",
        hint: "How many seconds a reaction window stays open before it automatically passes.",
        scope: "world",
        config: true,
        type: Number,
        range: {
            min: 0,
            max: 30,
            step: 1
        },
        default: 10
    });

    game.settings.register(MODULE_ID, "showSideReadyConfirmation", {
        name: "Show Side Ready Confirmation",
        hint: "Show a confirmation dialog before Side Ready ends the turn for the whole active side.",
        scope: "client",
        config: true,
        type: Boolean,
        default: true
    });

    const moduleSetupFormType = createModuleSetupFormApplicationClass();
    if (moduleSetupFormType) {
        game.settings.registerMenu(MODULE_ID, "moduleSetup", {
            name: "1547 Core Setup",
            label: "Open Setup",
            hint: "Open the 1547 Core setup dialog and load module data into this world.",
            icon: "fas fa-gears",
            type: moduleSetupFormType,
            restricted: true
        });
    } else {
        console.warn(`${MODULE_ID} | Module setup menu unavailable because FormApplication is not defined on this Foundry runtime.`);
    }
}

function createModuleSetupFormApplicationClass() {
    const BaseFormApplication = globalThis.FormApplication;
    if (typeof BaseFormApplication !== "function") {
        return null;
    }

    return class ModuleSetupFormApplication extends BaseFormApplication {
        static get defaultOptions() {
            return foundry.utils.mergeObject(super.defaultOptions, {
                id: `${MODULE_ID}-module-setup`,
                title: "1547 Core Setup",
                template: `${getModuleBasePath()}/templates/module-setup.hbs`,
                width: 520,
                height: "auto",
                closeOnSubmit: false,
                submitOnChange: false,
                submitOnClose: false
            });
        }

        async getData() {
            const storedManeuvers = game.settings.get(MODULE_ID, "maneuverData") ?? [];
            const storedWeapons = game.settings.get(MODULE_ID, "weaponData") ?? [];
            const storedArmors = game.settings.get(MODULE_ID, "armorData") ?? [];
            const storedAmmunition = game.settings.get(MODULE_ID, "ammoData") ?? [];
            const lastDataSetupAt = game.settings.get(MODULE_ID, "lastDataSetupAt") || "";

            return {
                moduleVersion: game.modules.get(MODULE_ID)?.version ?? "unknown",
                storedManeuverCount: Array.isArray(storedManeuvers) ? storedManeuvers.length : 0,
                storedWeaponCount: Array.isArray(storedWeapons) ? storedWeapons.length : 0,
                storedArmorCount: Array.isArray(storedArmors) ? storedArmors.length : 0,
                storedAmmoCount: Array.isArray(storedAmmunition) ? storedAmmunition.length : 0,
                lastDataSetupAt
            };
        }

        activateListeners(html) {
            super.activateListeners(html);

            html.find("[data-action='setup-data']").on("click", async (event) => {
                event.preventDefault();
                await this.#setupData();
            });
        }

        async _updateObject() {
            return;
        }

        async #setupData() {
            try {
                const { maneuvers, weapons, armors, ammunition } = await this.#loadSourceBackedData();

                await this.#importItemsFromData({ maneuvers, weapons, armors, ammunition });

                ui.notifications.info(
                    `1547 Core: stored and synced ${maneuvers.length} maneuvers, ${weapons.length} weapons, ${armors.length} armors, and ${ammunition.length} ammunition items from source data.`
                );
                this.render(false);
            } catch (error) {
                console.error(`${MODULE_ID} | Failed to setup data`, error);
                ui.notifications.error(`1547 Core: failed to setup data. ${error.message}`);
            }
        }

        async #loadDataset(fileName) {
            const versionTag = encodeURIComponent(game.modules.get(MODULE_ID)?.version ?? Date.now());
            const response = await fetch(`${getModuleBasePath()}/foundry/${fileName}?v=${versionTag}`, { cache: "no-store" });
            if (!response.ok) {
                throw new Error(`Failed to load ${fileName} (${response.status})`);
            }

            const data = await response.json();
            if (!Array.isArray(data)) {
                throw new Error(`${fileName} did not contain an array.`);
            }

            return data;
        }

        async #loadTemplate(fileName) {
            const versionTag = encodeURIComponent(game.modules.get(MODULE_ID)?.version ?? Date.now());
            const response = await fetch(`${getModuleBasePath()}/foundry/${fileName}?v=${versionTag}`, { cache: "no-store" });
            if (!response.ok) {
                throw new Error(`Failed to load ${fileName} (${response.status})`);
            }

            return await response.json();
        }

        async #loadSourceBackedData() {
            const [maneuvers, weapons, armors, ammunition] = await Promise.all([
                this.#loadDataset("maneuvers.json"),
                this.#loadDataset("weapons.json"),
                this.#loadDataset("armors.json"),
                this.#loadDataset("ammunition.json")
            ]);

            await Promise.all([
                game.settings.set(MODULE_ID, "maneuverData", maneuvers),
                game.settings.set(MODULE_ID, "weaponData", weapons),
                game.settings.set(MODULE_ID, "armorData", armors),
                game.settings.set(MODULE_ID, "ammoData", ammunition),
                game.settings.set(MODULE_ID, "lastDataSetupAt", new Date().toISOString())
            ]);

            return { maneuvers, weapons, armors, ammunition };
        }

        async #getOrCreateFolder(folderName) {
            let folder = game.folders?.find((entry) => entry.type === "Item" && entry.name === folderName);
            if (!folder) {
                folder = await Folder.create({
                    name: folderName,
                    type: "Item",
                    color: "#7a7a7a"
                });
            }

            return folder;
        }

        async #importItemsFromData({ maneuvers, weapons, armors, ammunition }) {
            const [maneuverTemplate, weaponTemplate, armorTemplate, ammoTemplate] = await Promise.all([
                this.#loadTemplate(TEMPLATE_FILES.maneuver),
                this.#loadTemplate(TEMPLATE_FILES.weapon),
                this.#loadTemplate(TEMPLATE_FILES.armor),
                this.#loadTemplate(TEMPLATE_FILES.ammo)
            ]);

            await upsertWorldItems([
                makeTemplateDoc(weaponTemplate),
                makeTemplateDoc(armorTemplate),
                makeTemplateDoc(maneuverTemplate),
                makeTemplateDoc(ammoTemplate)
            ]);

            const [maneuverFolder, weaponFolder, armorFolder, ammoFolder] = await Promise.all([
                this.#getOrCreateFolder("Maneuvers"),
                this.#getOrCreateFolder("Weapons"),
                this.#getOrCreateFolder("Armor"),
                this.#getOrCreateFolder("Ammunition")
            ]);

            const maneuverDocs = maneuvers.map((maneuver) =>
                makeItemDoc(normalizeSourceEntry(maneuver, "maneuver"), maneuverTemplate, maneuver.img ?? maneuverTemplate.img ?? "icons/svg/combat.svg", buildManeuverProps, maneuverFolder.id)
            );
            const weaponDocs = weapons.map((weapon) =>
                makeItemDoc(normalizeSourceEntry(weapon, "weapon"), weaponTemplate, weapon.img ?? weaponTemplate.img ?? "icons/svg/sword.svg", buildWeaponProps, weaponFolder.id)
            );
            const armorDocs = armors.map((armor) =>
                makeItemDoc(normalizeSourceEntry(armor, "armor"), armorTemplate, armor.img ?? armorTemplate.img ?? "icons/svg/holy-shield.svg", buildArmorProps, armorFolder.id)
            );
            const ammoDocs = ammunition.map((ammo) =>
                makeItemDoc(normalizeSourceEntry(ammo, "ammo"), ammoTemplate, ammo.img ?? ammoTemplate.img ?? "icons/svg/item-bag.svg", buildAmmoProps, ammoFolder.id)
            );

            await pruneManagedFolderItems({
                folderId: maneuverFolder.id,
                validIds: new Set(maneuverDocs.map((doc) => doc._id)),
                templateId: maneuverTemplate._id,
                folderHint: "Maneuvers"
            });
            await pruneManagedFolderItems({
                folderId: weaponFolder.id,
                validIds: new Set(weaponDocs.map((doc) => doc._id)),
                templateId: weaponTemplate._id,
                folderHint: "Weapons"
            });
            await pruneManagedFolderItems({
                folderId: armorFolder.id,
                validIds: new Set(armorDocs.map((doc) => doc._id)),
                templateId: armorTemplate._id,
                folderHint: "Armor"
            });
            await pruneManagedFolderItems({
                folderId: ammoFolder.id,
                validIds: new Set(ammoDocs.map((doc) => doc._id)),
                templateId: ammoTemplate._id,
                folderHint: "Ammunition"
            });

            const docs = [
                ...maneuverDocs,
                ...weaponDocs,
                ...armorDocs,
                ...ammoDocs
            ];
            const result = await upsertWorldItems(docs);

            return {
                total: docs.length,
                created: result.created,
                updated: result.updated
            };
        }
    };
}



