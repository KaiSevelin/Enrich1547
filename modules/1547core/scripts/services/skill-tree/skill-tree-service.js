/**
 * Skill-tree service (migrated from the standalone `skilltreehelper` module
 * in 0.2.93). Owns the world-level skill-graph data, validation engine,
 * and graph editor UI.
 *
 * World SETTINGS (graphJSON + the graph-editor menu) now live under the
 * active "1547core" module id, so they show under 1547core in the settings
 * UI instead of an unmapped legacy namespace. Document FLAGS (actor/item
 * nodeId) stay under "skilltreehelper" so existing player progress survives
 * without a per-document migration. The graphJSON value is carried across
 * namespaces on ready by migrations/skill-tree-migration.js.
 *
 * Consumers like chargen1547_v2 continue to read `globalThis.SkillTree`.
 */

import { MODULE_ID } from "../../lib/constants.mjs";
import { SkillTreeNodeEditor } from "./node-editor.js";
import {
    buildSkillGraph,
    detectCycles,
    validateGraphData,
    getGraphData,
    setGraphData,
    getActorNodeLevels,
    resolveNodeIdForItem,
    bindItemToNode,
    ensureActorItemNodeRef,
    ensureActorNodeRefs,
    validateActorUnlock,
    evaluateGraphForActor,
    enrichGraphDataMetadata,
    enrichDefaultGraphData,
    listAvailableNodeIncreases,
    getAvailableManeuvers,
    getFirstGrantableNode,
    getFirstGrantableNodeFromWorldGraph,
    grantFirstAvailableNode,
    normalizeGraphData,
    exportGraphData,
    importGraphData,
    setNodeLevel,
    setSkillLevel
} from "./node-logic.js";

const LEGACY_NAMESPACE = "skilltreehelper";

function readGraphDataSync() {
    try {
        const raw = game.settings.get(MODULE_ID, "graphJSON");
        return normalizeGraphData(JSON.parse(String(raw ?? "{}")));
    } catch {
        return {};
    }
}

function createSkillTreeApi() {
    const api = {
        buildSkillGraph,
        detectCycles,
        validateGraphData,
        getGraphData,
        setGraphData,
        getActorNodeLevels,
        resolveNodeIdForItem,
        bindItemToNode,
        ensureActorItemNodeRef,
        ensureActorNodeRefs,
        validateActorUnlock,
        evaluateGraphForActor,
        enrichGraphDataMetadata,
        enrichDefaultGraphData,
        listAvailableNodeIncreases,
        getAvailableManeuvers,
        getFirstGrantableNode,
        getFirstGrantableNodeFromWorldGraph,
        grantFirstAvailableNode,
        normalizeGraphData,
        exportGraphData,
        importGraphData,
        setNodeLevel,
        setSkillLevel,
        nextStepToward(actor, nodeId, targetLevel = 1, graphData = null) {
            const resolvedGraph = graphData ?? readGraphDataSync();
            return getFirstGrantableNode(actor, nodeId, targetLevel, resolvedGraph);
        }
    };

    Object.defineProperty(api, "NODES", {
        configurable: true,
        enumerable: true,
        get() {
            return buildSkillGraph(readGraphDataSync()).nodes;
        }
    });

    return api;
}

export function registerSkillTreeService() {
    globalThis.SkillTree = createSkillTreeApi();

    // World settings live under the active module id so they group under
    // 1547core in the settings UI. The stored value is migrated across from
    // the legacy namespace on ready (migrations/skill-tree-migration.js).
    game.settings.register(MODULE_ID, "graphJSON", {
        name: "SkillTree Graph JSON",
        hint: "World-level graph configuration for item prerequisites.",
        scope: "world",
        config: false,
        type: String,
        default: "{}"
    });

    game.settings.registerMenu(MODULE_ID, "node-editor", {
        name: "SkillTree Graph Editor",
        label: "Open Editor",
        hint: "Edit world-level item prerequisite graph.",
        icon: "fas fa-project-diagram",
        type: SkillTreeNodeEditor,
        restricted: true
    });

    Hooks.on("createItem", async (item) => {
        try {
            if (!item?.parent || item.parent.documentName !== "Actor") return;
            // The hook fires on every client, but ensureActorItemNodeRef WRITES the
            // item — only the owner may. A non-owner (e.g. a player when a GM-owned
            // token gains an item mid-combat) must skip, or the write throws a
            // permission error. The owner's client does it.
            if (!item.isOwner) return;
            // Read directly: getFlag throws when the legacy "skilltreehelper"
            // module isn't active in this world (see node-logic flag helpers).
            if (foundry.utils.getProperty(item.flags ?? {}, `${LEGACY_NAMESPACE}.nodeId`)) return;

            const graph = await getGraphData();
            await ensureActorItemNodeRef(item, graph);
        } catch (error) {
            console.warn("1547core | SkillTree createItem bind failed", error);
        }
    });
}

export function refreshSkillTreeApi() {
    globalThis.SkillTree = createSkillTreeApi();
    console.log("1547core | SkillTree ready:", globalThis.SkillTree);
}
