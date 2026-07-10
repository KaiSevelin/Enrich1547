import { MODULE_ID } from "../lib/constants.mjs";
import {
    getGraphData,
    setGraphData,
    enrichDefaultGraphData,
} from "../services/skill-tree/node-logic.js";

const GRAPH_MIGRATION_SETTING = "skillTreeGraphMigration";
const LEGACY_NAMESPACE = "skilltreehelper";

/**
 * Read the raw value of the legacy `skilltreehelper.graphJSON` world setting.
 * It is no longer registered (the registration moved to the 1547core module
 * id), so we read it straight from the world-settings storage rather than via
 * game.settings.get (which throws for unregistered settings). Best-effort and
 * version-tolerant — returns null on any failure.
 */
function readLegacyGraphRaw() {
    try {
        const store = game.settings?.storage?.get?.("world");
        if (!store) return null;
        const key = `${LEGACY_NAMESPACE}.graphJSON`;
        let doc = null;
        if (typeof store.getSetting === "function") doc = store.getSetting(key);
        if (!doc && typeof store.find === "function") doc = store.find((s) => s?.key === key);
        if (!doc && Array.isArray(store.contents)) doc = store.contents.find((s) => s?.key === key);
        return doc?.value ?? null;
    } catch {
        return null;
    }
}

/**
 * Pure reconciliation: given the world graph and the module default, return
 * `{ next, changed }` where MANEUVER nodes are brought in line with the
 * default — drop maneuver nodes the default no longer has (e.g. maneuvers a
 * rework removed, like Counter Attack / "Counter Strike") and add maneuver
 * nodes the default introduced (only when their prerequisite nodes already
 * exist, so we never create a dangling requirement). Skill nodes and any
 * GM-authored custom nodes are left untouched.
 */
export function reconcileManeuverGraph(world = {}, def = {}) {
    const defManeuver = Object.entries(def).filter(([, node]) => node?.kind === "maneuver");
    const defManeuverIds = new Set(defManeuver.map(([id]) => id));

    const next = { ...world };
    let changed = false;

    // Remove stale maneuver nodes. Maneuvers are leaf nodes (nothing requires
    // them), so removal can't dangle another node's prerequisites.
    for (const [id, node] of Object.entries(world)) {
        if (node?.kind === "maneuver" && !defManeuverIds.has(id)) {
            delete next[id];
            changed = true;
        }
    }

    // Add maneuver nodes the default introduced, but only when every one of
    // their prerequisite nodes already exists in the graph.
    const presentIds = new Set(Object.keys(next));
    for (const [id, node] of defManeuver) {
        if (next[id]) continue;
        const reqIds = [
            ...(node.requirements ?? []).map((r) => r?.nodeId),
            ...(node.anyOf ?? []).flatMap((group) => (group?.options ?? []).map((o) => o?.nodeId)),
        ].filter(Boolean);
        if (reqIds.every((rid) => presentIds.has(rid))) {
            next[id] = node;
            presentIds.add(id);
            changed = true;
        }
    }

    return { next, changed };
}

async function reconcileManeuverNodes() {
    const world = await getGraphData();
    const def = await enrichDefaultGraphData();
    const { next, changed } = reconcileManeuverGraph(world, def);
    if (changed) await setGraphData(next);
    return changed;
}

/**
 * On-ready skill-tree migration (GM only):
 *  1. Carry the graph value from the legacy "skilltreehelper" settings scope
 *     to "1547core" (one-time, idempotent — only when the new one is empty).
 *  2. Reconcile maneuver nodes with the module default, once per module
 *     version, so existing worlds pick up added/removed maneuvers without a
 *     manual "Load Default".
 */
export async function runSkillTreeGraphMigration() {
    if (!game.user?.isGM) return;

    // 1) Namespace value migration.
    try {
        const current = String(game.settings.get(MODULE_ID, "graphJSON") ?? "{}").trim();
        if (!current || current === "{}") {
            const legacy = String(readLegacyGraphRaw() ?? "").trim();
            if (legacy && legacy !== "{}") {
                await game.settings.set(MODULE_ID, "graphJSON", legacy);
            }
        }
    } catch (err) {
        console.warn(`${MODULE_ID} | skill-tree settings namespace migration skipped`, err);
    }

    // 2) Maneuver-node reconciliation — once per version.
    const version = String(game.modules.get(MODULE_ID)?.version ?? "");
    const applied = String(game.settings.get(MODULE_ID, GRAPH_MIGRATION_SETTING) ?? "");
    if (applied === version) return;
    try {
        await reconcileManeuverNodes();
    } catch (err) {
        console.warn(
            `${MODULE_ID} | skill-tree maneuver reconciliation failed; open the Skill Tree editor and "Load Default" to align it manually`,
            err
        );
    }
    await game.settings.set(MODULE_ID, GRAPH_MIGRATION_SETTING, version);
}
