/**
 * Composition Pipeline Service
 *
 * Manages the ChangeSet composition pipeline for monster/NPC creation.
 * Walks attached ChangeSets in deterministic pipeline order and derives
 * effective actor state.
 *
 * Provides:
 *   deriveEffectiveActor(actor)         — re-derive effective.* from base.* + applied ChangeSets
 *   getEffectiveActorCached(actor)      — retrieve cached derived state
 *   invalidateEffectiveActorCache(actor) — clear cached state
 *   evaluateRequirement(actor, req)     — check a single requirement predicate
 *   applyChange(actor, change)          — apply a single change to effective state
 */

import { getContainerChildItems, firstRefId } from "./csb-container-helpers.mjs";
import { MODULE_ID, CHANGESET_TEMPLATE_ID, CHANGE_TEMPLATE_ID, REQUIREMENT_TEMPLATE_ID } from "../lib/constants.mjs";

const CACHE_KEY = "_1547core_effectiveCache";
const APPLIED_CHANGES_KEY = "_1547core_appliedChanges";

const CHANGE_CONTAINER_KEY = "ChangeDisplayer";
const REQUIREMENT_CONTAINER_KEY = "RequirementsDisplayer";

// Base sits first so chassis Tags/Traits/Powers populate the cumulative state
// before any layered customization (Role, Domain, etc.) reads from it.
const PIPELINE_ORDER = ["Base", "Role", "Domain", "Motivation", "Loadout", "Quirk", "Boost"];

// ============================================================================
// Requirement Evaluation
// ============================================================================

/**
 * Evaluate a single Requirement predicate against actor state.
 * @param {Actor} actor
 * @param {object} requirement — { PredicateType, Negate, ...fields }
 * @param {object} cumulativeState — the effective state at this point in the pipeline
 * @returns {boolean} true if the requirement is satisfied
 */
export function evaluateRequirement(actor, requirement, cumulativeState = {}) {
    if (!requirement) return true;

    const type = String(requirement.system?.props?.PredicateType ?? "").trim();
    const negate = requirement.system?.props?.Negate === true;
    let result = false;

    switch (type) {
        case "GroupPresent":
            result = evaluateGroupPresent(actor, requirement, cumulativeState);
            break;
        case "HasTag":
            result = evaluateHasTag(actor, requirement, cumulativeState);
            break;
        case "StatAtLeast":
            result = evaluateStatAtLeast(actor, requirement, cumulativeState);
            break;
        case "PrimaryStatAtLeast":
            result = evaluatePrimaryStatAtLeast(actor, requirement, cumulativeState);
            break;
        case "HasSkill":
            result = evaluateHasSkill(actor, requirement, cumulativeState);
            break;
        default:
            result = true;
    }

    return negate ? !result : result;
}

function evaluateGroupPresent(actor, requirement, cumulativeState) {
    const groupTarget = String(requirement.system?.props?.GroupTarget ?? "").trim();
    if (!groupTarget) return false;

    const applicableChangeSets = cumulativeState.applicableChangeSets ?? {};
    return applicableChangeSets[groupTarget] != null;
}

function evaluateHasTag(actor, requirement, cumulativeState) {
    const tagName = String(requirement.system?.props?.TagName ?? "").trim();
    if (!tagName) return false;

    const appliedTags = cumulativeState.appliedTags ?? new Set();
    return appliedTags.has(tagName);
}

function evaluateStatAtLeast(actor, requirement, cumulativeState) {
    const statTarget = String(requirement.system?.props?.StatTarget ?? "").trim();
    const threshold = Number(requirement.system?.props?.StatThreshold ?? 0) || 0;

    if (!statTarget) return false;

    const effectiveProps = cumulativeState.effectiveProps ?? actor.system?.props ?? {};
    const currentValue = Number(effectiveProps[statTarget] ?? 0) || 0;
    return currentValue >= threshold;
}

function evaluatePrimaryStatAtLeast(actor, requirement, cumulativeState) {
    const primaryStatTarget = String(requirement.system?.props?.PrimaryStatRequirementTarget ?? "").trim();
    const minDice = Number(requirement.system?.props?.PrimaryStatRequirementDice ?? 1) || 1;
    const minMod = Number(requirement.system?.props?.PrimaryStatRequirementMod ?? 0) || 0;

    if (!primaryStatTarget) return false;

    const effectivePrimaryStats = cumulativeState.effectivePrimaryStats ?? actor.system?.props ?? {};
    const currentDice = Number(effectivePrimaryStats[`${primaryStatTarget}Dice`] ?? 0) || 0;
    const currentMod = Number(effectivePrimaryStats[`${primaryStatTarget}Mod`] ?? 0) || 0;

    if (currentDice < minDice) return false;
    if (currentDice === minDice && currentMod < minMod) return false;
    return true;
}

function evaluateHasSkill(actor, requirement, cumulativeState) {
    const skillRefId = firstRefId(requirement.system?.props?.RequirementSkillRef);
    const minLevel = Number(requirement.system?.props?.SkillMinLevel ?? 0) || 0;

    if (!skillRefId) return false;

    const skill = actor.items?.get?.(skillRefId);
    if (!skill) return false;

    const currentLevel = Number(skill.system?.props?.Level ?? 0) || 0;
    return currentLevel >= minLevel;
}

// ============================================================================
// Change Application
// ============================================================================

/**
 * Apply a single Change to the cumulative effective state.
 * @param {Actor} actor
 * @param {object} change — { Kind, ...fields }
 * @param {object} cumulativeState — mutable state object to update
 */
export function applyChange(actor, change, cumulativeState = {}) {
    if (!change) return;

    const kind = String(change.system?.props?.Kind ?? "").trim();

    switch (kind) {
        case "Stat":
            applyStatChange(actor, change, cumulativeState);
            break;
        case "PrimaryStat":
            applyPrimaryStatChange(actor, change, cumulativeState);
            break;
        case "Skill":
            applySkillChange(actor, change, cumulativeState);
            break;
        case "Text":
            applyTextChange(actor, change, cumulativeState);
            break;
        case "ItemGrant":
            applyItemGrantChange(actor, change, cumulativeState);
            break;
        case "Tag":
            applyTagChange(actor, change, cumulativeState);
            break;
        case "Trait":
            applyTraitChange(actor, change, cumulativeState);
            break;
        default:
            // Unknown change kind; silently skip
    }
}

function applyStatChange(actor, change, cumulativeState) {
    const statTarget = String(change.system?.props?.StatTarget ?? "").trim();
    const operation = String(change.system?.props?.StatOp ?? "Add").trim();
    const value = Number(change.system?.props?.StatValue ?? 0) || 0;

    if (!statTarget) return;

    cumulativeState.effectiveProps = cumulativeState.effectiveProps ?? {};
    const current = Number(cumulativeState.effectiveProps[statTarget] ?? 0) || 0;

    switch (operation) {
        case "Add":
            cumulativeState.effectiveProps[statTarget] = current + value;
            break;
        case "Multiply":
            cumulativeState.effectiveProps[statTarget] = current * value;
            break;
        case "Override":
            cumulativeState.effectiveProps[statTarget] = value;
            break;
        default:
            // Unknown operation
    }
}

function applyPrimaryStatChange(actor, change, cumulativeState) {
    const primaryStatTarget = String(change.system?.props?.PrimaryStatTarget ?? "").trim();
    const operation = String(change.system?.props?.PrimaryStatOp ?? "Step").trim();

    if (!primaryStatTarget) return;

    cumulativeState.effectivePrimaryStats = cumulativeState.effectivePrimaryStats ?? {};

    if (operation === "Step") {
        const steps = Number(change.system?.props?.PrimaryStatSteps ?? 0) || 0;
        const currentDice = Number(cumulativeState.effectivePrimaryStats[`${primaryStatTarget}Dice`] ?? 1) || 1;
        const currentMod = Number(cumulativeState.effectivePrimaryStats[`${primaryStatTarget}Mod`] ?? 0) || 0;

        // Step up/down on the d6 ladder: 1d6+0, 1d6+1, 1d6+2, 1d6+3, 2d6+0, 2d6+1, ...
        let newDice = currentDice;
        let newMod = currentMod + steps;

        while (newMod > 3) {
            newDice += 1;
            newMod -= 4;
        }
        while (newMod < 0) {
            newDice -= 1;
            newMod += 4;
        }

        newDice = Math.max(1, newDice);
        cumulativeState.effectivePrimaryStats[`${primaryStatTarget}Dice`] = newDice;
        cumulativeState.effectivePrimaryStats[`${primaryStatTarget}Mod`] = newMod;
    } else if (operation === "Set") {
        const dice = Number(change.system?.props?.PrimaryStatSetDice ?? 1) || 1;
        const mod = Number(change.system?.props?.PrimaryStatSetMod ?? 0) || 0;
        cumulativeState.effectivePrimaryStats[`${primaryStatTarget}Dice`] = dice;
        cumulativeState.effectivePrimaryStats[`${primaryStatTarget}Mod`] = mod;
    }
}

function applySkillChange(actor, change, cumulativeState) {
    const skillRefId = firstRefId(change.system?.props?.SkillRef);
    const delta = Number(change.system?.props?.SkillDelta ?? 0) || 0;

    if (!skillRefId) return;

    cumulativeState.skillDeltas = cumulativeState.skillDeltas ?? {};
    const current = Number(cumulativeState.skillDeltas[skillRefId] ?? 0) || 0;
    cumulativeState.skillDeltas[skillRefId] = current + delta;
}

function applyTextChange(actor, change, cumulativeState) {
    const textTarget = String(change.system?.props?.TextTarget ?? "").trim();
    const operation = String(change.system?.props?.TextOp ?? "Append").trim();
    const textValue = String(change.system?.props?.TextValue ?? "").trim();

    if (!textTarget) return;

    cumulativeState.textFields = cumulativeState.textFields ?? {};
    const current = String(cumulativeState.textFields[textTarget] ?? "");

    switch (operation) {
        case "Append":
            cumulativeState.textFields[textTarget] = current + textValue;
            break;
        case "Prepend":
            cumulativeState.textFields[textTarget] = textValue + current;
            break;
        case "Replace":
            cumulativeState.textFields[textTarget] = textValue;
            break;
        default:
            // Unknown operation
    }
}

function applyItemGrantChange(actor, change, cumulativeState) {
    const grantMode = String(change.system?.props?.ItemGrantMode ?? "Direct").trim();

    if (grantMode === "Direct") {
        const itemRefId = firstRefId(change.system?.props?.ItemGrantRef);
        if (itemRefId) {
            cumulativeState.grantedItems = cumulativeState.grantedItems ?? [];
            cumulativeState.grantedItems.push(itemRefId);
        }
    } else if (grantMode === "RollTable") {
        const cachedSourceId = change.flags?.[MODULE_ID]?.rolledResult?.sourceItemId;
        if (cachedSourceId) {
            cumulativeState.grantedItems = cumulativeState.grantedItems ?? [];
            cumulativeState.grantedItems.push(cachedSourceId);
            return;
        }
        const rollTableUuid = String(change.system?.props?.ItemGrantRollTable ?? "").trim();
        if (rollTableUuid) {
            cumulativeState.pendingRollTableItems = cumulativeState.pendingRollTableItems ?? [];
            cumulativeState.pendingRollTableItems.push(rollTableUuid);
        }
    }
}

function applyTagChange(actor, change, cumulativeState) {
    const tagName = String(change.system?.props?.TagName ?? "").trim();
    if (tagName) {
        cumulativeState.appliedTags = cumulativeState.appliedTags ?? new Set();
        cumulativeState.appliedTags.add(tagName);
    }
}

function applyTraitChange(actor, change, cumulativeState) {
    const traitName = String(change.system?.props?.TraitName ?? "").trim();
    const traitDescription = String(change.system?.props?.TraitDescription ?? "").trim();

    if (traitName) {
        cumulativeState.appliedTraits = cumulativeState.appliedTraits ?? [];
        cumulativeState.appliedTraits.push({ name: traitName, description: traitDescription });
    }
}

// ============================================================================
// Pipeline Walker
// ============================================================================

/**
 * Determine if a ChangeSet is applicable to this actor type.
 */
function isChangeSetApplicableToActorType(changeSet, actor) {
    const forTypeAny = changeSet.system?.props?.ForTypeAny !== false;
    if (forTypeAny) return true;

    const actorType = String(actor.system?.props?.TypeDropdown ?? "").trim();
    const forTypeKey = `ForType_${actorType}`;
    return changeSet.system?.props?.[forTypeKey] === true;
}

/**
 * Determine if a ChangeSet is applicable at this stage in the pipeline.
 */
function isChangeSetApplicable(changeSet, actor, cumulativeState) {
    if (!isChangeSetApplicableToActorType(changeSet, actor)) return false;

    // Evaluate all Requirements; they must all be satisfied (AND logic).
    // Requirements live as actor-owned items linked via the ChangeSet's
    // RequirementsDisplayer container.
    const requirements = getContainerChildItems(
        changeSet,
        actor,
        REQUIREMENT_CONTAINER_KEY,
        REQUIREMENT_TEMPLATE_ID
    );

    for (const requirement of requirements) {
        if (!evaluateRequirement(actor, requirement, cumulativeState)) {
            return false;
        }
    }

    return true;
}

/**
 * Walk the pipeline and derive effective state from applied ChangeSets.
 * @param {Actor} actor
 * @returns {object} cumulativeState — contains effectiveProps, effectivePrimaryStats, etc.
 */
function deriveEffectiveActorState(actor) {
    const cumulativeState = {
        effectiveProps: Object.assign({}, actor.system?.props ?? {}),
        effectivePrimaryStats: Object.assign({}, actor.system?.props ?? {}),
        textFields: {},
        skillDeltas: {},
        grantedItems: [],
        pendingRollTableItems: [],
        appliedTags: new Set(),
        appliedTraits: [],
        applicableChangeSets: {}
    };

    // Walk the pipeline in order
    for (const group of PIPELINE_ORDER) {
        const groupChangeSets = actor.items?.filter((item) => {
            const template = item.system?.template ?? item.system?.templateSystemUniqueVersion;
            return template === CHANGESET_TEMPLATE_ID && String(item.system?.props?.Group ?? "").trim() === group;
        }) ?? [];

        for (const changeSet of groupChangeSets) {
            if (isChangeSetApplicable(changeSet, actor, cumulativeState)) {
                // Mark this group slot as filled
                cumulativeState.applicableChangeSets[group] = changeSet.id;

                // Apply all Changes within the set. Changes live as
                // actor-owned items linked via the ChangeSet's
                // ChangeDisplayer container.
                const changes = getContainerChildItems(
                    changeSet,
                    actor,
                    CHANGE_CONTAINER_KEY,
                    CHANGE_TEMPLATE_ID
                );

                for (const change of changes) {
                    applyChange(actor, change, cumulativeState);
                }
            }
        }
    }

    return cumulativeState;
}

// ============================================================================
// Caching
// ============================================================================

/**
 * Get cached effective state, or derive it if not cached.
 */
export function getEffectiveActorCached(actor) {
    if (!actor) return null;

    // Check if cache is valid
    const cache = actor[CACHE_KEY];
    if (cache && cache.version === actor._stats?.modifiedTime) {
        return cache.state;
    }

    // Derive fresh state
    const state = deriveEffectiveActorState(actor);
    actor[CACHE_KEY] = {
        version: actor._stats?.modifiedTime,
        state
    };

    return state;
}

/**
 * Invalidate the cached effective state.
 */
export function invalidateEffectiveActorCache(actor) {
    if (actor) {
        delete actor[CACHE_KEY];
    }
}

// ============================================================================
// Service Registration
// ============================================================================

export function registerCompositionService() {
    const moduleApi = game.modules.get(MODULE_ID);
    if (!moduleApi) {
        console.warn(`${MODULE_ID} | registerCompositionService: module not found`);
        return;
    }

    moduleApi.api = moduleApi.api ?? {};
    moduleApi.api.composition = {
        deriveEffectiveActor: getEffectiveActorCached,
        getEffectiveActorCached,
        invalidateEffectiveActorCache,
        evaluateRequirement,
        applyChange
    };

    // Hook into item updates to invalidate cache
    Hooks.on("createItem", (item) => {
        const actor = item.parent;
        if (actor?.isOwner) {
            invalidateEffectiveActorCache(actor);
        }
    });

    Hooks.on("updateItem", (item) => {
        const actor = item.parent;
        if (actor?.isOwner) {
            invalidateEffectiveActorCache(actor);
        }
    });

    Hooks.on("deleteItem", (item) => {
        const actor = item.parent;
        if (actor?.isOwner) {
            invalidateEffectiveActorCache(actor);
        }
    });

    console.log(`${MODULE_ID} | Composition service registered`);
}

export default {
    registerCompositionService,
    evaluateRequirement,
    applyChange,
    getEffectiveActorCached,
    invalidateEffectiveActorCache
};
