import { MODULE_ID } from "../lib/constants.mjs";

const LEGACY_NAMESPACE = "chargen1547_v2";
const MIGRATION_SETTING = "chargenSettingsMigration";

// The chargen world settings whose registration moved from the legacy
// "chargen1547_v2" scope to the active "1547core" module id.
const KEYS = [
    "startingTable",
    "contentFolderName",
    "maxRolls",
    "careerStatPicks",
    "careerSkillPicks",
    "careerManeuverPicks",
    "legacyIdMap",
    "packageRegistry",
];

/**
 * Read the raw stored value of a legacy `chargen1547_v2.<key>` world setting.
 * It's no longer registered (registration moved to 1547core), so read it from
 * world-settings storage rather than game.settings.get (which throws for
 * unregistered settings). World settings store JSON-encoded values, so the
 * caller parses. Returns undefined when the setting was never stored (i.e. the
 * value was still at its default — nothing to migrate).
 */
function readLegacyRaw(key) {
    try {
        const store = game.settings?.storage?.get?.("world");
        if (!store) return undefined;
        const settingKey = `${LEGACY_NAMESPACE}.${key}`;
        let doc = null;
        if (typeof store.getSetting === "function") doc = store.getSetting(settingKey);
        if (!doc && typeof store.find === "function") doc = store.find((s) => s?.key === settingKey);
        if (!doc && Array.isArray(store.contents)) doc = store.contents.find((s) => s?.key === settingKey);
        return doc?.value;
    } catch {
        return undefined;
    }
}

/**
 * One-time (GM) migration that carries any explicitly-set chargen settings
 * from the legacy "chargen1547_v2" scope to "1547core", so a GM's prior
 * customizations survive the namespace move. Settings left at their defaults
 * weren't stored, so they're simply skipped (the new registration supplies the
 * same default).
 */
export async function runChargenSettingsMigration() {
    if (!game.user?.isGM) return;
    if (String(game.settings.get(MODULE_ID, MIGRATION_SETTING) ?? "") === "1") return;

    for (const key of KEYS) {
        try {
            const raw = readLegacyRaw(key);
            if (raw === undefined || raw === null) continue;
            let value;
            try { value = JSON.parse(raw); } catch { value = raw; }
            await game.settings.set(MODULE_ID, key, value);
        } catch (err) {
            console.warn(`${MODULE_ID} | chargen setting migration failed for "${key}"`, err);
        }
    }

    await game.settings.set(MODULE_ID, MIGRATION_SETTING, "1");
}
