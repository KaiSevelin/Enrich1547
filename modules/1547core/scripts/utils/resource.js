const RESOURCE_NAME_MAP = {
    core: "Core",
    corepoints: "Core",
    critical: "Critical",
    advantage: "Advantage",
    risk: "Risk",
};

// Pools are stored on the actor template in PREFIX form
// (Reserved<Name>Points / Spent<Name>Points / Max<Name>Points), so the
// adjustment prop is built as `${field}${resourceName}Points`.
const RESOURCE_ACTIONS = {
    reserve: { field: "Reserved", deltaSign: 1 },
    release: { field: "Reserved", deltaSign: -1 },
    spend: { field: "Spent", deltaSign: 1 },
    recover: { field: "Spent", deltaSign: -1 },
};

export async function adjustResource({
    action,
    resource,
    amount = 1,
    actorUuid = null,
    actor = null,
    notify = true,
    capacity = null,
    capacityPath = null,
} = {}) {
    const targetActor = actor ?? await getActorFromContext(actorUuid);
    const resourceName = normalizeResourceName(resource);
    const normalizedAmount = normalizeAmount(amount);
    const adjustment = getResourceAdjustment({
        actor: targetActor,
        action,
        resource: resourceName,
        amount: normalizedAmount,
        capacity,
        capacityPath,
    });

    await targetActor.update({
        [`system.props.${adjustment.prop}`]: adjustment.next,
    });

    if (notify) {
        ui.notifications?.info(
            `${targetActor.name}: ${adjustment.prop} ${adjustment.current} -> ${adjustment.next}`
        );
    }

    return {
        actor: targetActor,
        prop: adjustment.prop,
        previous: adjustment.current,
        next: adjustment.next,
        budget: adjustment.budget,
    };
}

export function getResourceAdjustment({
    actor,
    action,
    resource,
    amount = 1,
    capacity = null,
    capacityPath = null,
} = {}) {
    if (!actor) throw new Error("Missing actor.");

    const resourceName = normalizeResourceName(resource);
    const normalizedAmount = normalizeAmount(amount);
    const actionConfig = getResourceActionConfig(action);
    const prop = `${actionConfig.field}${resourceName}Points`;
    const current = getNumericProp(actor.system?.props?.[prop]);
    const next = Math.max(0, current + actionConfig.deltaSign * normalizedAmount);
    const budget = getResourceBudget(actor, resourceName, {
        capacity,
        capacityPath,
    });

    validateAdjustmentAgainstBudget({
        action,
        resource: resourceName,
        amount: normalizedAmount,
        budget,
    });

    return { prop, current, next, budget };
}

export function getResourceTotals(actor, resource) {
    if (!actor) throw new Error("Missing actor.");

    const resourceName = normalizeResourceName(resource);
    const props = actor.system?.props ?? {};

    return {
        resource: resourceName,
        reserved: getNumericProp(props[`Reserved${resourceName}Points`]),
        spent: getNumericProp(props[`Spent${resourceName}Points`]),
    };
}

export function getResourceBudget(
    actor,
    resource,
    { capacity = null, capacityPath = null } = {}
) {
    if (!actor) throw new Error("Missing actor.");

    const resourceName = normalizeResourceName(resource);
    const totals = getResourceTotals(actor, resourceName);
    const total = resolveResourceCapacity(actor, resourceName, {
        capacity,
        capacityPath,
    });
    const committed = totals.reserved + totals.spent;

    return {
        resource: resourceName,
        total,
        reserved: totals.reserved,
        spent: totals.spent,
        committed,
        available: Math.max(0, total - committed),
    };
}

export function canAdjustResource({
    actor,
    action,
    resource,
    amount = 1,
    capacity = null,
    capacityPath = null,
} = {}) {
    const resourceName = normalizeResourceName(resource);
    const normalizedAmount = normalizeAmount(amount);
    const budget = getResourceBudget(actor, resourceName, {
        capacity,
        capacityPath,
    });

    try {
        validateAdjustmentAgainstBudget({
            action,
            resource: resourceName,
            amount: normalizedAmount,
            budget,
        });
        return true;
    } catch {
        return false;
    }
}

export async function reserveManeuverCost({
    item,
    actor = null,
    actorUuid = null,
    notify = true,
    capacity = null,
    capacityPath = null,
} = {}) {
    const cost = getItemResourceCost(item);

    return adjustResource({
        action: "reserve",
        resource: cost.resource,
        amount: cost.amount,
        actor: actor ?? item?.actor ?? null,
        actorUuid,
        notify,
        capacity,
        capacityPath,
    });
}

export async function releaseManeuverCost({
    item,
    actor = null,
    actorUuid = null,
    notify = true,
    capacity = null,
    capacityPath = null,
} = {}) {
    const cost = getItemResourceCost(item);

    return adjustResource({
        action: "release",
        resource: cost.resource,
        amount: cost.amount,
        actor: actor ?? item?.actor ?? null,
        actorUuid,
        notify,
        capacity,
        capacityPath,
    });
}

export async function setManeuverInUse({
    item,
    enabled,
    actor = null,
    actorUuid = null,
    notify = true,
    capacity = null,
    capacityPath = null,
} = {}) {
    if (!item) throw new Error("Missing item.");

    const nextEnabled = Boolean(enabled);
    const currentEnabled = Boolean(item.system?.props?.InUse);
    const targetActor = actor ?? item.actor ?? null;

    if (currentEnabled === nextEnabled) {
        return {
            item,
            actor: targetActor,
            changed: false,
            inUse: currentEnabled,
        };
    }

    const resourceResult = nextEnabled
        ? await reserveManeuverCost({
            item,
            actor: targetActor,
            actorUuid,
            notify,
            capacity,
            capacityPath,
        })
        : await releaseManeuverCost({
            item,
            actor: targetActor,
            actorUuid,
            notify,
            capacity,
            capacityPath,
        });

    await item.update({
        "system.props.InUse": nextEnabled,
    });

    return {
        item,
        actor: resourceResult.actor,
        changed: true,
        inUse: nextEnabled,
        resource: resourceResult,
    };
}

export function canReserveManeuverCost({
    item,
    actor = null,
    capacity = null,
    capacityPath = null,
} = {}) {
    const targetActor = actor ?? item?.actor ?? null;
    const cost = getItemResourceCost(item);

    return canAdjustResource({
        actor: targetActor,
        action: "reserve",
        resource: cost.resource,
        amount: cost.amount,
        capacity,
        capacityPath,
    });
}

export function getItemResourceCost(item) {
    if (!item) throw new Error("Missing item.");

    const itemName = item.name ?? "Unnamed Item";
    const costType = item.system?.props?.CostType ?? null;
    const costAmount = item.system?.props?.CostAmount ?? null;

    if (!costType) {
        throw new Error(`${itemName} is missing CostType.`);
    }

    return {
        resource: normalizeResourceName(costType),
        amount: normalizeAmount(costAmount),
    };
}

export function normalizeResourceName(name) {
    if (!name) throw new Error("Missing resource name.");

    const normalized = RESOURCE_NAME_MAP[String(name).trim().toLowerCase()];
    if (!normalized) {
        throw new Error(`Unknown resource "${name}".`);
    }

    return normalized;
}

export async function getActorFromContext(actorUuid = null) {
    if (actorUuid) {
        const actor = await fromUuid(actorUuid);
        if (actor?.documentName === "Actor") return actor;

        throw new Error(`Could not resolve actor from UUID "${actorUuid}".`);
    }

    const actor =
        canvas.tokens?.controlled?.[0]?.actor ??
        game.user.character ??
        null;

    if (!actor) {
        throw new Error(
            "No actor found. Select a token, assign a character, or pass actorUuid."
        );
    }

    return actor;
}

function getResourceActionConfig(action) {
    const key = String(action ?? "").trim().toLowerCase();
    const config = RESOURCE_ACTIONS[key];

    if (!config) {
        throw new Error(
            `Unknown action "${action}". Use reserve, spend, release, or recover.`
        );
    }

    return config;
}

function normalizeAmount(amount) {
    const normalized = Number(amount);
    if (!Number.isFinite(normalized) || normalized <= 0) {
        throw new Error("Amount must be greater than 0.");
    }

    return normalized;
}

function getNumericProp(value) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : 0;
}

function validateAdjustmentAgainstBudget({ action, resource, amount, budget }) {
    const normalizedAction = String(action ?? "").trim().toLowerCase();
    const { reserved, spent, available } = budget;

    if (normalizedAction === "reserve" || normalizedAction === "spend") {
        if (amount > available) {
            throw new Error(
                `${resource} does not have enough available points. Requested ${amount}, available ${available}.`
            );
        }
    }

    if (normalizedAction === "release" && amount > reserved) {
        throw new Error(
            `${resource} only has ${reserved} reserved points to release.`
        );
    }

    if (normalizedAction === "recover" && amount > spent) {
        throw new Error(
            `${resource} only has ${spent} spent points to recover.`
        );
    }
}

function resolveResourceCapacity(
    actor,
    resource,
    { capacity = null, capacityPath = null } = {}
) {
    if (capacity != null) {
        return normalizeCapacity(capacity, resource);
    }

    const props = actor.system?.props ?? {};
    const system = actor.system ?? {};
    const explicitCapacity = capacityPath
        ? foundry.utils.getProperty(actor, capacityPath)
        : null;

    const candidates = [
        explicitCapacity,
        props[`Max${resource}Points`],
        props[`${resource}Points`],
        props[`${resource}PointsMax`],
        props[`${resource}MaxPoints`],
        props[`${resource}Pool`],
        props[`${resource}PoolMax`],
        system[`Max${resource}Points`],
        system[`${resource}Points`],
        system[`${resource}PointsMax`],
        system[`${resource}MaxPoints`],
        system[`${resource}Pool`],
        system[`${resource}PoolMax`],
    ];

    for (const candidate of candidates) {
        const normalized = Number(candidate);
        if (Number.isFinite(normalized) && normalized >= 0) {
            return normalized;
        }
    }

    throw new Error(
        `No total pool found for ${resource}. Pass "capacity", set "capacityPath", or store one of the standard fields on actor.system.props.`
    );
}

function normalizeCapacity(capacity, resource) {
    const normalized = Number(capacity);
    if (!Number.isFinite(normalized) || normalized < 0) {
        throw new Error(`Invalid capacity for ${resource}.`);
    }

    return normalized;
}
