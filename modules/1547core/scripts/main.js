import { register1547ModuleSettings } from "./settings/module-settings.js";

const MODULE_ID = "1547core";

function runModuleStep(label, fn) {
    try {
        return fn();
    } catch (error) {
        console.error(`${MODULE_ID} | ${label} failed`, error);
    }
}

async function runImportedModuleStep(label, importer, runner) {
    try {
        const module = await importer();
        return runner(module);
    } catch (error) {
        console.error(`${MODULE_ID} | ${label} failed`, error);
    }
}

Hooks.once("init", () => {
    runModuleStep("register1547ModuleSettings", () => register1547ModuleSettings());
    void runImportedModuleStep(
        "register1547Enricher",
        () => import("./enrichers/dice-enricher.js"),
        (module) => module.register1547Enricher()
    );
    void runImportedModuleStep(
        "registerReactionService",
        () => import("./services/reaction-service.js"),
        (module) => module.registerReactionService()
    );
    void runImportedModuleStep(
        "registerManeuverLegalityService",
        () => import("./combat/maneuver-legality.mjs"),
        (module) => module.registerManeuverLegalityService()
    );
    void runImportedModuleStep(
        "registerCombatResolverService",
        () => import("./services/combat-resolver-service.js"),
        (module) => module.registerCombatResolverService()
    );
    void runImportedModuleStep(
        "registerBoostService",
        () => import("./services/boost-service.js"),
        (module) => module.registerBoostService()
    );
    void runImportedModuleStep(
        "registerCompositionService",
        () => import("./services/composition-service.mjs"),
        (module) => module.registerCompositionService()
    );
    void runImportedModuleStep(
        "registerMonsterImageResolverService",
        () => import("./services/monster-image-resolver-service.js"),
        (module) => module.registerMonsterImageResolverService()
    );
    void runImportedModuleStep(
        "registerChangeSetDropHook",
        () => import("./services/changeset-drop-hook.js"),
        (module) => module.registerChangeSetDropHook()
    );
    void runImportedModuleStep(
        "registerItemGrantService",
        () => import("./services/item-grant-service.js"),
        (module) => module.registerItemGrantService()
    );
    void runImportedModuleStep(
        "registerWeaponModifierAttachmentService",
        () => import("./services/weapon-modifier-attachment-service.js"),
        (module) => module.registerWeaponModifierAttachmentService()
    );
    void runImportedModuleStep(
        "registerRollTableResolutionService",
        () => import("./services/rolltable-resolution-service.js"),
        (module) => module.registerRollTableResolutionService()
    );
    void runImportedModuleStep(
        "registerRitualGenerationService",
        () => import("./services/ritual-generation-service.js"),
        (module) => module.registerRitualGenerationService()
    );
    void runImportedModuleStep(
        "registerUsageEffectActionResolver",
        () => import("./services/usage-effect-action-resolver.js"),
        (module) => module.registerUsageEffectActionResolver()
    );
    void runImportedModuleStep(
        "registerSpellCastingService",
        () => import("./services/spell-casting-service.js"),
        (module) => module.registerSpellCastingService()
    );
    void runImportedModuleStep(
        "registerDiagnosticsService",
        () => import("./services/diagnostics-service.js"),
        (module) => module.registerDiagnosticsService()
    );
});

Hooks.once("ready", () => {
    void runImportedModuleStep(
        "runReachMigration",
        () => import("./migrations/reach-migration.js"),
        (module) => void module.runReachMigration()
    );
    void runImportedModuleStep(
        "runSchemaMigrations",
        () => import("./migrations/schema-migration.js"),
        (module) => module.runSchemaMigrations()
    );
    void runImportedModuleStep(
        "runContainerMigration",
        () => import("./migrations/container-migration.js"),
        (module) => module.runContainerMigration()
    );
    void runImportedModuleStep(
        "register1547ActorHud",
        () => import("./hud/actor-hud.js"),
        (module) => module.register1547ActorHud()
    );
    void runImportedModuleStep(
        "registerTierDisplay",
        () => import("./services/tier-display-service.js"),
        (module) => module.registerTierDisplay()
    );
    void runImportedModuleStep(
        "register1547CombatTrackerSideGroups",
        () => import("./combat-tracker/side-tracker.js"),
        (module) => module.register1547CombatTrackerSideGroups()
    );
    void runImportedModuleStep(
        "activate1547EnricherListeners",
        () => import("./enrichers/dice-enricher.js"),
        (module) => module.activate1547EnricherListeners(document.body)
    );
    void runImportedModuleStep(
        "register1547DialogHooks",
        () => import("./dialogs/roll-dialog.js"),
        (module) => module.register1547DialogHooks()
    );
});
