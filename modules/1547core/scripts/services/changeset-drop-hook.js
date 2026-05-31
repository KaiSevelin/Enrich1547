/**
 * ChangeSet drop validation hook for the monster-maker.
 *
 * Enforces at item-drop time:
 *   - ForType: actor's TypeDropdown must match the set's allow-list (unless ForTypeAny)
 *   - Cardinality: at most one ChangeSet per actor for Size / Role / Domain
 *   - Requirements: all child Requirement predicates must hold (AND-ed)
 *
 * Drops onto CSB `_template` actors skip validation.
 *
 * Also exposes validateMonster(actor) for auditing already-applied sets,
 * registered on game.modules.get("1547core").api.
 */

import { evaluateRequirement, getEffectiveActorCached } from "./composition-service.mjs";
import { getContainerChildItems } from "./csb-container-helpers.mjs";

const MODULE_ID = "1547core";
const CHANGESET_TEMPLATE_ID = "b7A1z6cSZO4dYTKT";
const REQUIREMENT_TEMPLATE_ID = "L4ujYgqhGBGcoo2P";
const REQUIREMENT_CONTAINER_KEY = "RequirementsDisplayer";
// Base is at-most-one (enforced here); a well-formed monster also has
// exactly-one, which validateMonster reports separately as a missing-base
// warning. Drop time can't enforce the lower bound — a freshly-created
// actor legitimately starts with zero.
const SINGLETON_GROUPS = new Set(["Base", "Role", "Domain"]);

function isChangeSet(item) {
    return item?.system?.template === CHANGESET_TEMPLATE_ID;
}

function isRequirement(item) {
    return item?.system?.template === REQUIREMENT_TEMPLATE_ID;
}

function checkForType(props, actor) {
    if (props?.ForTypeAny !== false) return { ok: true };

    const actorType = String(actor.system?.props?.TypeDropdown ?? "").trim();
    if (!actorType) {
        return {
            ok: false,
            reason: `ChangeSet restricts to specific TypeDropdown values but actor has none set.`
        };
    }
    if (props?.[`ForType_${actorType}`] === true) return { ok: true };
    return {
        ok: false,
        reason: `ChangeSet is not valid for actor type "${actorType}".`
    };
}

function checkCardinality(props, actor, ignoreItemId = null) {
    const group = String(props?.Group ?? "").trim();
    if (!SINGLETON_GROUPS.has(group)) return { ok: true };

    const existing = actor.items?.filter((item) => {
        if (item.id === ignoreItemId) return false;
        if (!isChangeSet(item)) return false;
        return String(item.system?.props?.Group ?? "").trim() === group;
    }) ?? [];

    if (existing.length === 0) return { ok: true };
    return {
        ok: false,
        reason: `Actor already has a ${group} ChangeSet ("${existing[0].name}"). Remove it first.`
    };
}

function checkRequirements(childRequirementSources, actor) {
    // NOTE: evaluates against the actor's full cached cumulative state.
    // The spec calls for partial state up to this set's group position; the
    // full-state approximation is lenient in one direction (a Requirement that
    // depends on a later group will spuriously pass at drop time). The runtime
    // composition pipeline still silently skips the set if it actually fails,
    // so derived state remains correct.
    const state = getEffectiveActorCached(actor) ?? {};

    for (const reqSource of childRequirementSources) {
        const reqLike = { system: reqSource.system };
        if (!evaluateRequirement(actor, reqLike, state)) {
            const predicateType = reqSource.system?.props?.PredicateType ?? "?";
            return {
                ok: false,
                reason: `Requirement "${predicateType}" not satisfied.`
            };
        }
    }
    return { ok: true };
}

function notifyAndReject(reason) {
    ui.notifications?.warn(`1547 Core: ${reason}`);
    return false;
}

export function validateChangeSetDrop(document, data, _options, _userId) {
    if (!isChangeSet(document)) return true;

    const actor = document.parent;
    if (!actor || actor.documentName !== "Actor") return true;
    if (actor.type === "_template") return true;

    const props = data?.system?.props ?? document.system?.props ?? {};

    const forType = checkForType(props, actor);
    if (!forType.ok) return notifyAndReject(forType.reason);

    const cardinality = checkCardinality(props, actor);
    if (!cardinality.ok) return notifyAndReject(cardinality.reason);

    const childRequirements = (data?.items ?? []).filter(isRequirement);
    const requirements = checkRequirements(childRequirements, actor);
    if (!requirements.ok) return notifyAndReject(requirements.reason);

    return true;
}

export function validateMonster(actor) {
    if (!actor || actor.documentName !== "Actor") return [];
    if (actor.type === "_template") return [];

    const violations = [];
    const changeSets = actor.items?.filter(isChangeSet) ?? [];

    const groupCounts = {};
    for (const set of changeSets) {
        const group = String(set.system?.props?.Group ?? "").trim();
        groupCounts[group] = (groupCounts[group] ?? 0) + 1;
    }
    for (const group of SINGLETON_GROUPS) {
        if ((groupCounts[group] ?? 0) > 1) {
            violations.push({
                kind: "cardinality",
                group,
                count: groupCounts[group],
                message: `${group} has ${groupCounts[group]} ChangeSets (max 1).`
            });
        }
    }

    // A monster (any non-Player TypeDropdown) is expected to have exactly one
    // Base ChangeSet — its chassis. Drop time can't enforce the lower bound
    // (a freshly-created actor legitimately starts with zero), so it surfaces
    // here as an audit warning. PCs and untyped actors are skipped.
    const actorType = String(actor.system?.props?.TypeDropdown ?? "").trim();
    if (actorType && actorType !== "Player" && (groupCounts.Base ?? 0) === 0) {
        violations.push({
            kind: "missing-base",
            group: "Base",
            count: 0,
            message: `${actorType} has no Base ChangeSet (chassis). Attach one before treating this actor as a finished monster.`
        });
    }

    for (const set of changeSets) {
        const props = set.system?.props ?? {};
        const forType = checkForType(props, actor);
        if (!forType.ok) {
            violations.push({
                kind: "forType",
                changeSetId: set.id,
                changeSetName: set.name,
                message: `"${set.name}": ${forType.reason}`
            });
        }
    }

    const state = getEffectiveActorCached(actor) ?? {};
    for (const set of changeSets) {
        const requirements = getContainerChildItems(set, actor, REQUIREMENT_CONTAINER_KEY, REQUIREMENT_TEMPLATE_ID);
        for (const req of requirements) {
            if (!evaluateRequirement(actor, req, state)) {
                const predicateType = req.system?.props?.PredicateType ?? "?";
                violations.push({
                    kind: "requirement",
                    changeSetId: set.id,
                    changeSetName: set.name,
                    predicateType,
                    message: `"${set.name}": Requirement "${predicateType}" not satisfied.`
                });
            }
        }
    }

    return violations;
}

export function registerChangeSetDropHook() {
    Hooks.on("preCreateItem", validateChangeSetDrop);

    const moduleApi = game.modules.get(MODULE_ID);
    if (!moduleApi) {
        console.warn(`${MODULE_ID} | registerChangeSetDropHook: module not found`);
        return;
    }
    moduleApi.api = moduleApi.api ?? {};
    moduleApi.api.validateMonster = validateMonster;
}
