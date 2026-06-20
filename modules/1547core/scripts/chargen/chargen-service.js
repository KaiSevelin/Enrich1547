/**
 * Chargen service (migrated from the standalone `chargen1547_v2` module
 * in 0.3.0). Owns the character-generator UI and its world-side helpers.
 *
 * Settings namespace remains "chargen1547_v2" for back-compat with
 * existing worlds (so settings + flags survive the consolidation).
 *
 * Consumers continue to use `globalThis.SkillTreeChargen` / `globalThis.chargen1547_v2`.
 */

import { SkillTreeChargenApp } from "./chargen.js";
import { importWorldContent } from "./import-world-content.js";
import { getChargenSettings, registerChargenSettings } from "./settings.js";

const LEGACY_NAMESPACE = "chargen1547_v2";

function buildSkillTreeChargenApi() {
    return {
        open: async (opts = {}) => {
            try {
                const settings = getChargenSettings();
                return await SkillTreeChargenApp.open({
                    ...opts,
                    startingTable: String(opts.startingTable ?? "").trim() || settings.startingTable
                });
            } catch (err) {
                console.error("SkillTreeChargen.open failed:", err);
                ui.notifications.error(err?.message ?? "Chargen failed to load. See console (F12).");
            }
        },
        simulate: async (opts = {}) => {
            try {
                const settings = getChargenSettings();
                const report = await SkillTreeChargenApp.runBatchSimulation({
                    ...opts,
                    startingTable: String(opts.startingTable ?? "").trim() || settings.startingTable
                });
                ui.notifications.info(
                    `Chargen simulation complete: ${report.summary.totalRuns} run(s), drive rate ${(report.summary.driveRate * 100).toFixed(1)}%, premature career end rate ${(report.summary.prematureCareerEndRate * 100).toFixed(1)}%. See console.`
                );
                return report;
            } catch (err) {
                console.error("SkillTreeChargen.simulate failed:", err);
                ui.notifications.error(err?.message ?? "Simulation failed. See console (F12).");
                throw err;
            }
        },
        validate: async (opts = {}) => {
            try {
                const settings = getChargenSettings();
                const report = await SkillTreeChargenApp.validateEnvironment({
                    ...opts,
                    startingTable: String(opts.startingTable ?? "").trim() || settings.startingTable
                });
                const status = report.ok ? "OK" : "FAILED";
                console.group(`SkillTreeChargen.validate: ${status}`);
                console.log("Errors:", report.errors.length);
                console.log("Warnings:", report.warnings.length);
                if (report.errors.length) console.table(report.errors);
                if (report.warnings.length) console.table(report.warnings);
                if (report.careerValidation) {
                    console.log("Visited career tables:", report.careerValidation.visited?.length ?? 0);
                    console.log("Career edges:", report.careerValidation.edges?.length ?? 0);
                    console.log("Auxiliary refs:", report.careerValidation.auxiliaryRefs?.length ?? 0);
                    console.log("Terminal entries:", report.careerValidation.terminalResults?.length ?? 0);
                }
                console.groupEnd();
                ui.notifications[report.ok ? "info" : "error"](
                    `Chargen validation ${report.ok ? "passed" : "failed"} (${report.errors.length} error(s), ${report.warnings.length} warning(s)). See console.`
                );
                return report;
            } catch (err) {
                console.error("SkillTreeChargen.validate failed:", err);
                ui.notifications.error(err?.message ?? "Validation failed. See console (F12).");
                throw err;
            }
        },
        validateInstall: async (opts = {}) => {
            try {
                const settings = getChargenSettings();
                const report = await SkillTreeChargenApp.validateInstallInterfaces({
                    ...opts,
                    rootFolderName: String(opts.rootFolderName ?? "").trim() || settings.contentFolderName
                });
                console.group(`SkillTreeChargen.validateInstall: ${report.ok ? "OK" : "FAILED"}`);
                console.log("Managed RollTables:", report.summary.managedRolltables);
                console.log("Managed Items:", report.summary.managedItems);
                console.log("Errors:", report.errors.length);
                console.log("Warnings:", report.warnings.length);
                if (report.errors.length) console.table(report.errors);
                if (report.warnings.length) console.table(report.warnings);
                console.groupEnd();
                ui.notifications[report.ok ? "info" : "warn"](
                    `Install validation ${report.ok ? "passed" : "has issues"} (${report.errors.length} error(s), ${report.warnings.length} warning(s)). See console.`
                );
                return report;
            } catch (err) {
                console.error("SkillTreeChargen.validateInstall failed:", err);
                ui.notifications.error(err?.message ?? "Install validation failed. See console (F12).");
                throw err;
            }
        },
        validateFolder: async (folderUuid, opts = {}) => {
            try {
                const report = await SkillTreeChargenApp.validateAndClassifyTablesInFolder(folderUuid, opts);
                const byTypeText = Object.entries(report.byType ?? {})
                    .map(([k, v]) => `${k}:${v}`)
                    .join(", ");
                const issueCount = (report.reports ?? []).reduce(
                    (sum, entry) => sum + Number(entry.validation?.issueCount ?? 0),
                    0
                );
                ui.notifications[report.ok ? "info" : "warn"](
                    `Folder validation ${report.ok ? "passed" : "has issues"} (${report.tableCount} tables, ${issueCount} issue(s)). ${byTypeText}`
                );
                return report;
            } catch (err) {
                console.error("SkillTreeChargen.validateFolder failed:", err);
                ui.notifications.error(err?.message ?? "Folder validation failed. See console (F12).");
                throw err;
            }
        },
        listTables: async (opts = {}) => {
            try {
                return await SkillTreeChargenApp.listRollTablesForValidation(opts);
            } catch (err) {
                console.error("SkillTreeChargen.listTables failed:", err);
                ui.notifications.error(err?.message ?? "List tables failed. See console (F12).");
                throw err;
            }
        },
        showTableList: async (opts = {}) => {
            try {
                return await SkillTreeChargenApp.showRollTableValidationList(opts);
            } catch (err) {
                console.error("SkillTreeChargen.showTableList failed:", err);
                ui.notifications.error(err?.message ?? "Show table list failed. See console (F12).");
                throw err;
            }
        },
        importWorldContent: async (opts = {}) => {
            try {
                const report = await importWorldContent(opts);
                const settings = getChargenSettings();
                const installValidation = await SkillTreeChargenApp.validateInstallInterfaces({
                    rootFolderName: String(opts.rootFolderName ?? "").trim() || settings.contentFolderName
                });
                ui.notifications.info(
                    `Imported chargen content: ${report.items.created + report.items.updated} items, ${report.rolltables.created + report.rolltables.updated} rolltables.`
                );
                console.group("SkillTreeChargen.importWorldContent");
                console.log(report);
                console.log("Install validation:", installValidation);
                console.groupEnd();
                return {
                    ...report,
                    installValidation
                };
            } catch (err) {
                console.error("SkillTreeChargen.importWorldContent failed:", err);
                ui.notifications.error(err?.message ?? "World content import failed. See console (F12).");
                throw err;
            }
        }
    };
}

function installChargenApi() {
    const api = buildSkillTreeChargenApi();
    globalThis.SkillTreeChargen = api;
    globalThis.chargen1547_v2 = api;
    if (typeof window !== "undefined") {
        window.SkillTreeChargen = api;
        window.chargen1547_v2 = api;
    }
    const coreModule = game.modules?.get("1547core");
    if (coreModule) {
        coreModule.api = coreModule.api ?? {};
        coreModule.api.chargen = api;
    }
    try {
        // Foundry macro eval can fail to resolve bare global properties.
        // Create a real global binding so legacy macros using `SkillTreeChargen.*`
        // continue to work.
        (0, eval)("var SkillTreeChargen = globalThis.SkillTreeChargen;");
    } catch (err) {
        console.warn("Unable to create global SkillTreeChargen binding:", err);
    }
    return api;
}

/**
 * Let players run the character generator: chargen's first act is `Actor.create`,
 * which the PLAYER/TRUSTED roles can't do by default. Grant the core ACTOR_CREATE
 * permission to those roles (GM-authoritative, idempotent — only writes when a
 * role is missing). Foundry auto-grants the creating player OWNER on the new
 * actor, so the rest of chargen runs under ownership permissions.
 */
async function ensurePlayerActorCreatePermission() {
    if (!game.user?.isGM) return;
    try {
        const permissions = foundry.utils.deepClone(game.settings.get("core", "permissions") ?? {});
        const roles = Array.isArray(permissions.ACTOR_CREATE) ? [...permissions.ACTOR_CREATE] : [];
        const wanted = [CONST.USER_ROLES.PLAYER, CONST.USER_ROLES.TRUSTED];
        let changed = false;
        for (const role of wanted) {
            if (!roles.includes(role)) { roles.push(role); changed = true; }
        }
        if (!changed) return;
        permissions.ACTOR_CREATE = roles;
        await game.settings.set("core", "permissions", permissions);
        console.log("1547core | granted PLAYER/TRUSTED the ACTOR_CREATE permission for the character generator.");
    } catch (error) {
        console.error("1547core | failed to grant ACTOR_CREATE permission", error);
    }
}

function injectDirectoryButton(html) {
    const root = html?.[0] ?? html;
    if (!root) return;

    const footer = root.querySelector(".directory-footer");
    if (!footer) return;
    if (footer.querySelector(".chargen-directory-launch")) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "chargen-directory-launch";
    button.innerHTML = `<i class="fas fa-scroll"></i> Character Generator`;
    button.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await globalThis.SkillTreeChargen?.open();
    });

    footer.prepend(button);
}

/** Called from 1547core/scripts/main.js during init. */
export function registerChargenService() {
    registerChargenSettings();
    installChargenApi();
    Hooks.on("renderActorDirectory", (app, html) => injectDirectoryButton(html));
}

/** Called from 1547core/scripts/main.js during ready. */
export function refreshChargenApi() {
    installChargenApi();
    void ensurePlayerActorCreatePermission();
    console.log("1547core | SkillTreeChargen registered:", globalThis.SkillTreeChargen);
}
