/**
 * Skill-tree service (migrated from the standalone `skilltreehelper` module
 * in 0.2.93). Owns the world-level skill-graph data, validation engine,
 * and graph editor UI.
 *
 * Settings namespace remains "skilltreehelper" for back-compat with existing
 * worlds (graphJSON setting key + actor flag namespace), so player data
 * does not need to migrate when this consolidation lands.
 *
 * Consumers like chargen1547_v2 continue to read `globalThis.SkillTree`.
 */

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
        const raw = game.settings.get(LEGACY_NAMESPACE, "graphJSON");
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

    // Register the world setting under the legacy namespace so existing
    // worlds and the chargen1547_v2 dependency continue working unchanged.
    game.settings.register(LEGACY_NAMESPACE, "graphJSON", {
        name: "SkillTree Graph JSON",
        hint: "World-level graph configuration for item prerequisites.",
        scope: "world",
        config: false,
        type: String,
        default: "{}"
    });

    game.settings.registerMenu(LEGACY_NAMESPACE, "node-editor", {
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
            if (item.getFlag(LEGACY_NAMESPACE, "nodeId")) return;

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
