/**
 * Boost service for the monster-maker.
 *
 * Provides:
 *   boostActor(actorId)   — roll on the configured boost RollTable, preview, apply on accept
 *   unboostActor(actorId) — remove the most recently added Boost-group ChangeSet from the actor
 *
 * Configured via the world setting "boostRollTableUuid" (1547core module setting).
 * Registered on game.modules.get("1547core").api so CSB label rollMessages can call it.
 */

const MODULE_ID = "1547core";
const CHANGESET_TEMPLATE_ID = "b7A1z6cSZO4dYTKT";
const WEAPON_TEMPLATE_ID = "qZCfLEYQ7egbm1B9";
const ARMOR_TEMPLATE_ID = "uLlgZXz3GlXPFtsj";
const STANDARD_BOOST_TABLE_NAME = "Standard Boost";
const WEAPON_DIE_BOOST_ID = "BoBWpDUv00000001";
const ARMOR_DIE_BOOST_ID = "BoBArDUv00000001";
const BUTTON_CLASS = "boost-button-1547core";

async function resolveBoostRollTable() {
    const uuid = game.settings.get(MODULE_ID, "boostRollTableUuid");
    if (uuid) {
        try {
            const table = await fromUuid(uuid);
            if (table?.documentName === "RollTable") return table;
        } catch (error) {
            console.warn(`${MODULE_ID} | Failed to resolve configured boost Roll Table`, error);
        }
    }
    // Fallback: find the Standard Boost table by name in world OR compendium.
    const { findTable } = await import("./content-registry.js");
    const fallback = findTable((t) => t.name === STANDARD_BOOST_TABLE_NAME);
    if (fallback) return fallback;
    ui.notifications.error(`1547 Core: No boost Roll Table found. Run module setup or configure boostRollTableUuid.`);
    return null;
}

function findActorNaturalWeapon(actor) {
    for (const item of actor.items ?? []) {
        if (item.system?.template !== WEAPON_TEMPLATE_ID) continue;
        const sourceData = item.flags?.["1547Core"]?.sourceData ?? {};
        const srcGroups = Array.isArray(sourceData.groups) ? sourceData.groups : [];
        const isNatural = srcGroups.includes("NaturalWeapon") || sourceData.folder === "Natural Weapons";
        if (isNatural) return item;
    }
    return null;
}

function findActorNaturalArmor(actor) {
    for (const item of actor.items ?? []) {
        if (item.system?.template !== ARMOR_TEMPLATE_ID) continue;
        const sourceData = item.flags?.["1547Core"]?.sourceData ?? {};
        const srcTraits = Array.isArray(sourceData.traits) ? sourceData.traits : [];
        const isNatural = srcTraits.includes("NaturalArmor") || sourceData.folder === "Natural Armor";
        if (isNatural) return item;
    }
    return null;
}

async function mutateNaturalWeaponDice(weaponItem) {
    const sourceData = weaponItem.flags?.["1547Core"]?.sourceData ?? {};
    const profileSource = sourceData.attackProfiles?.[0];
    const currentDice = Array.isArray(profileSource?.dice) ? profileSource.dice.slice() : null;
    if (!currentDice) return false;
    currentDice.push("Heavy");
    const newSourceData = foundry.utils.deepClone(sourceData);
    newSourceData.attackProfiles[0].dice = currentDice;
    await weaponItem.update({ "flags.1547Core.sourceData": newSourceData });
    return true;
}

async function mutateNaturalArmorDice(armorItem) {
    const sourceData = armorItem.flags?.["1547Core"]?.sourceData ?? {};
    const currentDice = Array.isArray(sourceData.defenseDice) ? sourceData.defenseDice.slice() : null;
    if (!currentDice) return false;
    currentDice.push("Armor");
    const newSourceData = foundry.utils.deepClone(sourceData);
    newSourceData.defenseDice = currentDice;
    await armorItem.update({ "flags.1547Core.sourceData": newSourceData });
    return true;
}

async function resolveTableResultToItem(result) {
    if (!result) return null;
    const docTypes = CONST?.TABLE_RESULT_TYPES ?? {};
    const documentType = docTypes.DOCUMENT ?? 1;
    const compendiumType = docTypes.COMPENDIUM ?? 2;

    if (result.type === documentType) {
        const collection = game[result.documentCollection];
        return collection?.get?.(result.documentId) ?? null;
    }
    if (result.type === compendiumType) {
        const pack = game.packs.get(result.documentCollection);
        return pack ? await pack.getDocument(result.documentId) : null;
    }
    return null;
}

async function rollOnBoostTable(table) {
    const tableRoll = await table.roll();
    const results = Array.isArray(tableRoll.results) ? tableRoll.results : [tableRoll.results];
    if (!results.length) return null;
    return await resolveTableResultToItem(results[0]);
}

function isChangeSet(item) {
    return item?.system?.template === "b7A1z6cSZO4dYTKT"
        || item?.system?.templateSystemUniqueVersion !== undefined && item?.flags?.["custom-system-builder"];
}

async function drawOneBoost(table) {
    const tableRoll = await table.roll();
    const results = Array.isArray(tableRoll.results) ? tableRoll.results : [tableRoll.results];
    if (!results.length) return null;
    const result = results[0];
    if (!result) return null;
    return await resolveTableResultToItem(result);
}

function isWeaponDieResult(result) {
    const id = result?.documentId ?? result?._source?.documentId;
    return id === WEAPON_DIE_BOOST_ID;
}

function isArmorDieResult(result) {
    const id = result?.documentId ?? result?._source?.documentId;
    return id === ARMOR_DIE_BOOST_ID;
}

async function pickRandomStatBoost(table) {
    const all = table.results?.contents ?? [...(table.results ?? [])];
    const stats = all.filter((r) => !isWeaponDieResult(r) && !isArmorDieResult(r));
    if (!stats.length) return null;
    const pick = stats[Math.floor(Math.random() * stats.length)];
    return await resolveTableResultToItem(pick);
}

export async function boostActor(actorId) {
    if (!game.user.isGM) {
        ui.notifications.warn("Only the GM can boost monsters.");
        return;
    }

    const actor = game.actors.get(actorId);
    if (!actor) {
        ui.notifications.error("1547 Core: Actor not found.");
        return;
    }

    const table = await resolveBoostRollTable();
    if (!table) return;

    // Roll once. If the outcome is a Weapon-Die or Armor-Die boost and the actor lacks
    // the required natural weapon/armor, substitute a random stat boost from the same
    // table (preserves the table's stat-distribution weighting).
    let rolledItem = await drawOneBoost(table);
    let mutationKind = null; // "weapon" | "armor" | null
    let targetItem = null;
    let substituted = false;

    if (rolledItem) {
        const rolledId = rolledItem.id ?? rolledItem._id;
        if (rolledId === WEAPON_DIE_BOOST_ID) {
            const weapon = findActorNaturalWeapon(actor);
            if (weapon) {
                mutationKind = "weapon";
                targetItem = weapon;
            } else {
                rolledItem = await pickRandomStatBoost(table);
                substituted = true;
            }
        } else if (rolledId === ARMOR_DIE_BOOST_ID) {
            const armor = findActorNaturalArmor(actor);
            if (armor) {
                mutationKind = "armor";
                targetItem = armor;
            } else {
                rolledItem = await pickRandomStatBoost(table);
                substituted = true;
            }
        }
    }

    if (!rolledItem) {
        ui.notifications.warn(`1547 Core: no applicable boost available (table may be empty or misconfigured).`);
        return;
    }

    const mutationNote = mutationKind === "weapon"
        ? `<p>Will add a <strong>Heavy</strong> die to <strong>${targetItem.name}</strong>.</p>`
        : mutationKind === "armor"
        ? `<p>Will add an <strong>Armor</strong> die to <strong>${targetItem.name}</strong>.</p>`
        : "";
    const substituteNote = substituted
        ? `<p><em>Original roll required a natural weapon/armor this actor doesn't have — substituted with a random stat boost.</em></p>`
        : "";

    const accept = await Dialog.confirm({
        title: `Apply Boost: ${rolledItem.name}?`,
        content: `<p>Rolled <strong>${rolledItem.name}</strong>.</p>${mutationNote}${substituteNote}<p>Apply to <strong>${actor.name}</strong>?</p>`,
        defaultYes: true
    });
    if (!accept) return;

    // Apply the ChangeSet to the actor (record of the boost).
    const itemData = rolledItem.toObject();
    if (itemData.system?.props) {
        itemData.system.props.Group = "Boost";
    } else if (itemData.system) {
        itemData.system.props = { Group: "Boost" };
    }
    delete itemData._id;
    await actor.createEmbeddedDocuments("Item", [itemData]);

    // For weapon/armor die boosts, also mutate the target item.
    if (mutationKind === "weapon") await mutateNaturalWeaponDice(targetItem);
    if (mutationKind === "armor") await mutateNaturalArmorDice(targetItem);

    const summary = mutationKind === "weapon"
        ? `Boosted ${actor.name}: ${rolledItem.name} (+1 Heavy on ${targetItem.name})`
        : mutationKind === "armor"
        ? `Boosted ${actor.name}: ${rolledItem.name} (+1 Armor on ${targetItem.name})`
        : `Boosted ${actor.name}: ${rolledItem.name}`;
    ui.notifications.info(summary);
}

export async function unboostActor(actorId) {
    if (!game.user.isGM) {
        ui.notifications.warn("Only the GM can unboost monsters.");
        return;
    }

    const actor = game.actors.get(actorId);
    if (!actor) {
        ui.notifications.error("1547 Core: Actor not found.");
        return;
    }

    const boosts = actor.items
        .filter((item) => item.system?.props?.Group === "Boost")
        .sort((a, b) => {
            const aTime = Number(a._stats?.createdTime ?? 0);
            const bTime = Number(b._stats?.createdTime ?? 0);
            return bTime - aTime;
        });

    if (boosts.length === 0) {
        ui.notifications.warn("No boosts to remove.");
        return;
    }

    const mostRecent = boosts[0];
    const confirm = await Dialog.confirm({
        title: "Remove last boost?",
        content: `<p>Remove <strong>${mostRecent.name}</strong> from <strong>${actor.name}</strong>?</p>`,
        defaultYes: true
    });
    if (!confirm) return;

    await actor.deleteEmbeddedDocuments("Item", [mostRecent.id]);
    ui.notifications.info(`Removed boost: ${mostRecent.name}`);
}

function findBoostControlsElement(root) {
    if (!root?.querySelector) return null;
    return root.querySelector('[data-key="BoostControls"]')
        ?? root.querySelector('[data-name="BoostControls"]')
        ?? root.querySelector('.boost-controls')
        ?? null;
}

function buildBoostButton(actor) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = BUTTON_CLASS;
    button.style.cssText = "display: block; width: 100%; padding: 6px; margin: 0 0 4px 0; cursor: pointer; background: #6d635b; color: #fff; border: 1px solid rgba(0,0,0,0.25); border-radius: 3px; font-weight: bold;";
    button.textContent = "Roll Boost";
    button.dataset.module = MODULE_ID;
    button.addEventListener("click", async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        button.disabled = true;
        try {
            await boostActor(actor.id);
        } catch (err) {
            console.error(`${MODULE_ID} | boostActor failed`, err);
            ui.notifications.error("1547 Core: boost roll failed — see console.");
        } finally {
            button.disabled = false;
        }
    });
    return button;
}

function injectBoostButton(actor, html) {
    const root = html?.[0] ?? html;
    const target = findBoostControlsElement(root);
    if (!target) return false;
    for (const stale of target.querySelectorAll(`:scope > .${BUTTON_CLASS}`)) {
        stale.remove();
    }
    target.prepend(buildBoostButton(actor));
    return true;
}

export function registerBoostService() {
    Hooks.on("renderActorSheet", (app, html) => {
        const actor = app?.actor ?? app?.object;
        if (!actor || actor.documentName !== "Actor") return;
        if (actor.type === "_template") return;
        if (!game.user.isGM) return;
        injectBoostButton(actor, html);
    });

    const moduleApi = game.modules.get(MODULE_ID);
    if (!moduleApi) {
        console.warn(`${MODULE_ID} | registerBoostService: module not found`);
        return;
    }
    moduleApi.api = moduleApi.api ?? {};
    moduleApi.api.boostActor = boostActor;
    moduleApi.api.unboostActor = unboostActor;
}
