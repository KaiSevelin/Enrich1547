import { buildMigrationData } from "./schema-migration.js";

const samples = [
  {
    id: "weapon-legacy",
    flags: {
      "1547Core": {
        sourceData: { itemType: "weapon" },
        schemaVersion: 0
      }
    },
    system: {
      traits: ["Fast", "Unknown Trait"],
      attackProfiles: [
        {
          id: "default",
          dice: ["Balanced", "1dx", "Grace"],
          rollFormula: "1db + 1df"
        }
      ],
      usesAmmo: true,
      ammoType: "Arrow",
      ammoCapacity: 1,
      ammoLoaded: 1,
      loadedAmmoId: "ammo-broadhead-arrow"
    }
  },
  {
    id: "ammo-legacy",
    flags: {
      "1547Core": {
        sourceData: { itemType: "ammo" }
      }
    },
    system: {
      addDice: ["Penetration", "LegacyDie"],
      quantity: 10
    }
  },
  {
    id: "armor-legacy",
    flags: {
      "1547Core": {
        sourceData: { itemType: "armor" }
      }
    },
    system: {
      defenseDice: ["Armor", "InvalidDie"],
      armorClass: "Heavy"
    }
  }
];

for (const sample of samples) {
  const result = buildMigrationData(sample);
  console.log(`\nItem: ${sample.id}`);
  console.log(JSON.stringify(result, null, 2));
}
