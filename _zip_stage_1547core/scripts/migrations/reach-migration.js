const MODULE_ID = "1547core";
const SOURCE_FLAG_SCOPE = "1547Core";

function parseReachValue(value) {
    if (value === null || value === undefined || value === "") {
        return { minReach: null, maxReach: null };
    }

    const text = String(value).trim();
    const rangeMatch = text.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
        return {
            minReach: Number(rangeMatch[1]),
            maxReach: Number(rangeMatch[2])
        };
    }

    const singleMatch = text.match(/^(\d+)$/);
    if (singleMatch) {
        const reach = Number(singleMatch[1]);
        return {
            minReach: reach,
            maxReach: reach
        };
    }

    return { minReach: null, maxReach: null };
}

function cloneReachField(field, key, label) {
    const cloned = foundry.utils.deepClone(field);
    cloned.key = key;
    cloned.label = label;
    cloned.defaultValue = "1";
    return cloned;
}

function migrateContents(contents) {
    if (!Array.isArray(contents)) return contents;

    const nextContents = [];
    for (const entry of contents) {
        const nextEntry = foundry.utils.deepClone(entry);
        if (Array.isArray(nextEntry.contents)) {
            nextEntry.contents = migrateContents(nextEntry.contents);
        }

        if (nextEntry.key === "ReachValue") {
            nextContents.push(cloneReachField(nextEntry, "MinReach", "Min Reach:"));
            nextContents.push(cloneReachField(nextEntry, "MaxReach", "Max Reach:"));
            continue;
        }

        nextContents.push(nextEntry);
    }

    return nextContents;
}

function isWeaponDocument(item) {
    const props = item?.system?.props ?? {};
    const sourceData = item?.flags?.[SOURCE_FLAG_SCOPE]?.sourceData ?? item?.flags?.[MODULE_ID]?.sourceData ?? {};
    return sourceData.itemType === "weapon"
        || sourceData.folder === "Weapons"
        || item?.folder?.name === "Weapons"
        || props.WeaponType !== undefined;
}

function buildMigrationData(item) {
    if (!isWeaponDocument(item)) return null;

    const props = item.system?.props ?? {};
    const sourceData = item.flags?.[SOURCE_FLAG_SCOPE]?.sourceData ?? item.flags?.[MODULE_ID]?.sourceData ?? {};
    const rawReach = props.ReachValue ?? sourceData.reach ?? null;
    const { minReach, maxReach } = parseReachValue(rawReach);
    const migratedContents = migrateContents(item.system?.body?.contents ?? []);

    const needsContentsMigration = JSON.stringify(migratedContents) !== JSON.stringify(item.system?.body?.contents ?? []);
    const needsPropMigration = props.MinReach === undefined || props.MaxReach === undefined || props.ReachValue !== undefined;
    const needsSourceMigration = sourceData.minReach === undefined || sourceData.maxReach === undefined || sourceData.reach !== undefined;

    if (!needsContentsMigration && !needsPropMigration && !needsSourceMigration) {
        return null;
    }

    const updateData = {};

    if (needsContentsMigration) {
        updateData["system.body.contents"] = migratedContents;
    }

    if (needsPropMigration) {
        updateData["system.props.MinReach"] = minReach;
        updateData["system.props.MaxReach"] = maxReach;
        if (props.ReachValue !== undefined) {
            updateData["system.props.-=ReachValue"] = null;
        }
    }

    if (needsSourceMigration) {
        updateData["flags.1547Core.sourceData.minReach"] = minReach;
        updateData["flags.1547Core.sourceData.maxReach"] = maxReach;
        if (sourceData.reach !== undefined) {
            updateData["flags.1547Core.sourceData.-=reach"] = null;
        }
    }

    return updateData;
}

async function migrateCollection(items) {
    for (const item of items) {
        const updateData = buildMigrationData(item);
        if (!updateData) continue;
        await item.update(updateData);
    }
}

export async function runReachMigration() {
    await migrateCollection(game.items.contents ?? game.items ?? []);

    for (const actor of game.actors.contents ?? game.actors ?? []) {
        await migrateCollection(actor.items.contents ?? actor.items ?? []);
    }
}
