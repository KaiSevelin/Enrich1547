import { MODULE_ID } from "../lib/constants.mjs";
const FLAG_SCOPE = "1547Core";
const SCHEMA_MIGRATION_SETTING = "schemaMigrationVersion";
const SCHEMA_MIGRATION_CURRENT_VERSION = 1;

const CANONICAL_DICE = [
  "Balanced",
  "Grace",
  "Heavy",
  "Penetration",
  "Lethality",
  "Control",
  "Armor",
  "Evade",
  "Risk",
  "Multiplier"
];

const CANONICAL_WEAPON_TRAITS = [
  "Aiming",
  "Armor Breaking",
  "Bracing",
  "Charging",
  "Control",
  "Disarming",
  "Fast",
  "Fragile",
  "Heavy",
  "Hooking",
  "Narrow",
  "Parrying",
  "Point Blank",
  "Receiving",
  "Reloading",
  "Shield",
  "Small Shield",
  "Tactical"
];

export function inferItemType(item) {
  if (!item) return null;
  const flags = item.flags ?? {};
  const sourceData = flags[FLAG_SCOPE]?.sourceData ?? flags[MODULE_ID]?.sourceData ?? {};
  const props = item?.system?.props ?? item?.props ?? {};
  const typeCandidate = sourceData.itemType ?? item?.type ?? item?.system?.itemType ?? null;
  if (typeCandidate) return String(typeCandidate).toLowerCase();
  if (props.WeaponType !== undefined) return "weapon";
  if (props.AmmoType !== undefined) return "ammo";
  if (item?.folder?.name === "Weapons") return "weapon";
  if (item?.folder?.name === "Armors" || item?.folder?.name === "Armor") return "armor";
  if (item?.folder?.name === "Ammo") return "ammo";
  return null;
}

function isEquipmentItem(item) {
  const type = inferItemType(item);
  return type === "weapon" || type === "ammo" || type === "armor";
}

function cleanDiceArray(arr) {
  if (!Array.isArray(arr)) return arr;
  return arr.filter(d => CANONICAL_DICE.includes(d));
}

function cleanTraits(arr) {
  if (!Array.isArray(arr)) return arr;
  return arr.filter(t => CANONICAL_WEAPON_TRAITS.includes(t));
}

function deepClone(value) {
  if (typeof foundry !== "undefined" && foundry?.utils?.deepClone) {
    return foundry.utils.deepClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

export function buildMigrationData(item) {
  if (!isEquipmentItem(item)) return null;

  const updateData = {};
  const flags = item.flags ?? {};
  const itemFlags = flags[FLAG_SCOPE] ?? flags[MODULE_ID] ?? {};
  const sourceData = itemFlags.sourceData ?? {};

  // schemaVersion handling
  const existingVersion = Number(itemFlags.schemaVersion ?? 0) || 0;

  let changed = false;

  // Weapon-specific sanitization
  const itemType = inferItemType(item);

  if (itemType === "weapon") {
    const system = item.system ?? {};

    // traits
    const traits = system.traits ?? item?.system?.traits ?? item?.traits ?? [];
    const cleanedTraits = cleanTraits(traits);
    if (JSON.stringify(cleanedTraits) !== JSON.stringify(traits)) {
      updateData["system.traits"] = cleanedTraits;
      changed = true;
      console.warn(`${MODULE_ID} migration: dropped unknown traits for item ${item.id}`);
    }

    // attackProfiles.dice
    const profiles = item?.system?.attackProfiles ?? item?.attackProfiles ?? [];
    const nextProfiles = Array.isArray(profiles) ? profiles.map(p => {
      const next = deepClone(p);
      if (Array.isArray(next.dice)) {
        const cleaned = cleanDiceArray(next.dice);
        if (JSON.stringify(cleaned) !== JSON.stringify(next.dice)) {
          next.dice = cleaned;
          changed = true;
          console.warn(`${MODULE_ID} migration: dropped unsupported dice in profile for item ${item.id}`);
        }
      }
      // remove legacy roll formula fields if present
      if (next.rollFormula !== undefined) {
        delete next.rollFormula;
        changed = true;
      }
      if (next.diceFormula !== undefined) {
        delete next.diceFormula;
        changed = true;
      }
      return next;
    }) : profiles;

    if (JSON.stringify(nextProfiles) !== JSON.stringify(profiles)) {
      updateData["system.attackProfiles"] = nextProfiles;
    }

    // defaults for a few known fields
    if (system.usesAmmo === undefined) {
      updateData["system.usesAmmo"] = false;
      changed = true;
    }
    if (system.ammoType === undefined) {
      updateData["system.ammoType"] = "";
      changed = true;
    }
    if (system.ammoCapacity === undefined) {
      updateData["system.ammoCapacity"] = 0;
      changed = true;
    }
    if (system.ammoLoaded === undefined) {
      updateData["system.ammoLoaded"] = 0;
      changed = true;
    }
    if (system.loadedAmmoId === undefined) {
      updateData["system.loadedAmmoId"] = null;
      changed = true;
    }
    if (system.reloadTime === undefined) {
      updateData["system.reloadTime"] = 0;
      changed = true;
    }
    if (system.reloadProgress === undefined) {
      updateData["system.reloadProgress"] = 0;
      changed = true;
    }
  }

  // Ammo-specific sanitization
  if (itemType === "ammo") {
    const system = item.system ?? {};
    const addDice = system.addDice ?? [];
    const cleaned = cleanDiceArray(addDice);
    if (JSON.stringify(cleaned) !== JSON.stringify(addDice)) {
      updateData["system.addDice"] = cleaned;
      changed = true;
      console.warn(`${MODULE_ID} migration: dropped unsupported ammo addDice for item ${item.id}`);
    }
    if (system.quantity === undefined) {
      updateData["system.quantity"] = 0;
      changed = true;
    }
  }

  // Armor-specific sanitization
  if (itemType === "armor") {
    const system = item.system ?? {};
    const defenseDice = system.defenseDice ?? [];
    const cleaned = cleanDiceArray(defenseDice);
    if (JSON.stringify(cleaned) !== JSON.stringify(defenseDice)) {
      updateData["system.defenseDice"] = cleaned;
      changed = true;
      console.warn(`${MODULE_ID} migration: dropped unsupported armor defenseDice for item ${item.id}`);
    }
    if (system.armorClass === undefined) {
      updateData["system.armorClass"] = "Light";
      changed = true;
    }
  }

  // Remove legacy runtime roll formulas if present at top-level system or flags
  if (item.system && item.system.rollFormula !== undefined) {
    updateData["system.-=rollFormula"] = null;
    changed = true;
    console.warn(`${MODULE_ID} migration: removed legacy system.rollFormula from item ${item.id}`);
  }
  if (item.flags && item.flags[FLAG_SCOPE] && item.flags[FLAG_SCOPE].rollFormula !== undefined) {
    updateData[`flags.${FLAG_SCOPE}.-=rollFormula`] = null;
    changed = true;
    console.warn(`${MODULE_ID} migration: removed legacy flags rollFormula from item ${item.id}`);
  }

  // Set schemaVersion if missing or older
  if (existingVersion < SCHEMA_MIGRATION_CURRENT_VERSION) {
    updateData[`flags.${FLAG_SCOPE}.schemaVersion`] = SCHEMA_MIGRATION_CURRENT_VERSION;
    changed = true;
  }

  return changed ? updateData : null;
}

async function migrateCollection(items) {
  for (const item of items) {
    try {
      const updateData = buildMigrationData(item);
      if (!updateData) continue;
      await item.update(updateData);
    } catch (err) {
      console.error(`${MODULE_ID} migration: failed to migrate item ${item.id}`, err);
    }
  }
}

export async function runSchemaMigrations() {
  if (!game.user?.isGM) return;

  // World-version gate (mirrors reach-migration): skip the O(actors × items)
  // scan entirely once the current schema version has been applied, instead of
  // re-walking and re-stringifying every item on every world load.
  const appliedVersion = Number(game.settings?.get?.(MODULE_ID, SCHEMA_MIGRATION_SETTING) ?? 0) || 0;
  if (appliedVersion >= SCHEMA_MIGRATION_CURRENT_VERSION) return;

  await migrateCollection(game.items.contents ?? game.items ?? []);

  for (const actor of game.actors.contents ?? game.actors ?? []) {
    await migrateCollection(actor.items.contents ?? actor.items ?? []);
  }

  await game.settings?.set?.(MODULE_ID, SCHEMA_MIGRATION_SETTING, SCHEMA_MIGRATION_CURRENT_VERSION);
}
