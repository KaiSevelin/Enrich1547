import { MODULE_ID } from "./lib/constants.mjs";
import { register1547ModuleSettings } from "./settings/module-settings.js";


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
        "register1547InfoEnricher",
        () => import("./enrichers/info-enricher.js"),
        (module) => module.register1547InfoEnricher()
    );
    void runImportedModuleStep(
        "registerReactionService",
        () => import("./services/reaction-service.js"),
        (module) => module.registerReactionService()
    );
    void runImportedModuleStep(
        "registerPostManeuverRelay",
        () => import("./combat/post-maneuver-relay.js"),
        (module) => module.registerPostManeuverRelay()
    );
    void runImportedModuleStep(
        "registerDefenseSummaryRelay",
        () => import("./combat/defense-summary.js"),
        (module) => module.registerDefenseSummaryRelay()
    );
    void runImportedModuleStep(
        "registerSafeCounterattackRelay",
        () => import("./combat/safe-counterattack.js"),
        (module) => module.registerSafeCounterattackRelay()
    );
    void runImportedModuleStep(
        "registerMovementReactions",
        () => import("./combat/movement-reactions.js"),
        (module) => module.registerMovementReactions()
    );
    void runImportedModuleStep(
        "registerTurnCues",
        () => import("./combat/turn-cues.js"),
        (module) => module.registerTurnCues()
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
        "registerFacingService",
        () => import("./combat/facing.mjs"),
        (module) => { module.registerFacingService(); module.registerFacingLock(); }
    );
    void runImportedModuleStep(
        "registerBoostService",
        () => import("./services/boost-service.js"),
        (module) => module.registerBoostService()
    );
    void runImportedModuleStep(
        "registerMonsterWizard",
        () => import("./services/monster-wizard-service.js"),
        (module) => module.registerMonsterWizard()
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
        "registerCompendiumImportHook",
        () => import("./services/compendium-import-hook.js"),
        (module) => module.registerCompendiumImportHook()
    );
    void runImportedModuleStep(
        "registerChangeSetCascadeService",
        () => import("./services/changeset-cascade-service.js"),
        (module) => module.registerChangeSetCascadeService()
    );
    void runImportedModuleStep(
        "registerBaseAutoApply",
        () => import("./services/base-autoapply-service.js"),
        (module) => module.registerBaseAutoApply()
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
        "registerRitualExecutionService",
        () => import("./services/ritual-execution-service.js"),
        (module) => module.registerRitualExecutionService()
    );
    void runImportedModuleStep(
        "registerUsageEffectActionResolver",
        () => import("./services/usage-effect-action-resolver.js"),
        (module) => module.registerUsageEffectActionResolver()
    );
    void runImportedModuleStep(
        "registerConditionRegistry",
        () => import("./services/condition-registry.js"),
        (module) => module.registerConditionRegistry()
    );
    void runImportedModuleStep(
        "registerSpellCastingService",
        () => import("./services/spell-casting-service.js"),
        (module) => module.registerSpellCastingService()
    );
    void runImportedModuleStep(
        "registerDiseaseService",
        () => import("./services/disease-service.js"),
        (module) => module.registerDiseaseService()
    );
    void runImportedModuleStep(
        "registerFailureEffectService",
        () => import("./services/failure-effect-service.js"),
        (module) => module.registerFailureEffectService()
    );
    void runImportedModuleStep(
        "registerDiagnosticsService",
        () => import("./services/diagnostics-service.js"),
        (module) => module.registerDiagnosticsService()
    );
    void runImportedModuleStep(
        "registerSkillTreeService",
        () => import("./services/skill-tree/skill-tree-service.js"),
        (module) => module.registerSkillTreeService()
    );
    void runImportedModuleStep(
        "registerItemHoverCardService",
        () => import("./services/item-hover-card-service.js"),
        (module) => module.registerItemHoverCardService()
    );
    void runImportedModuleStep(
        "register1547Dice",
        () => import("./dice/dice1547.js"),
        (module) => module.register1547Dice()
    );
    void runImportedModuleStep(
        "registerChargenService",
        () => import("./chargen/chargen-service.js"),
        (module) => module.registerChargenService()
    );
    void runImportedModuleStep(
        "registerRaceboardService",
        () => import("./raceboard/raceboard-service.js"),
        (module) => module.registerRaceboardService()
    );
    void runImportedModuleStep(
        "registerSocialBattleService",
        () => import("./social/social-battle.js"),
        (module) => module.registerSocialBattleService()
    );
});

Hooks.once("ready", () => {
    void runImportedModuleStep(
        "registerContentRegistry",
        () => import("./services/content-registry.js"),
        (module) => module.registerContentRegistry()
    );
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
        "runSkillTreeGraphMigration",
        () => import("./migrations/skill-tree-migration.js"),
        (module) => void module.runSkillTreeGraphMigration()
    );
    void runImportedModuleStep(
        "register1547ActorHud",
        () => import("./hud/actor-hud.js"),
        (module) => module.register1547ActorHud()
    );
    void runImportedModuleStep(
        "registerPublicInitiative",
        () => import("./combat/public-initiative.js"),
        (module) => module.registerPublicInitiative()
    );
    void runImportedModuleStep(
        "registerTierDisplay",
        () => import("./services/tier-display-service.js"),
        (module) => module.registerTierDisplay()
    );
    void runImportedModuleStep(
        "registerMonsterValidationDisplay",
        () => import("./services/monster-validation-display-service.js"),
        (module) => module.registerMonsterValidationDisplay()
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
    void runImportedModuleStep(
        "refreshSkillTreeApi",
        () => import("./services/skill-tree/skill-tree-service.js"),
        (module) => module.refreshSkillTreeApi()
    );
    void runImportedModuleStep(
        "refreshChargenApi",
        () => import("./chargen/chargen-service.js"),
        (module) => module.refreshChargenApi()
    );
    void runImportedModuleStep(
        "refreshRaceboardApi",
        () => import("./raceboard/raceboard-service.js"),
        (module) => module.refreshRaceboardApi()
    );
});
