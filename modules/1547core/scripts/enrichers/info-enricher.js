// Inline "info" enricher: turns @info[type:key]{label} (and the @stat[...] /
// @condition[...] aliases) in any enriched text into a hoverable chip showing
// the same description the HUD tooltips use. Works anywhere Foundry enriches
// HTML — chat, journals, item/table descriptions, the chargen biography, etc.
//
// Examples:
//   @stat[Strength]                 -> "Strength" chip, hover for the stat text
//   @condition[Prone]{prone}        -> "prone" chip, hover for the condition text
//   @info[stat:Power]{the uncanny}  -> custom label, Power tooltip

import { getStatTooltip } from "../hud/stat-info.js";
import { getConditionDescription } from "../services/condition-registry.js";
import { getHumourTooltip, canonicalHumour } from "../services/humour-info.js";
import { getSocialStatusTooltip } from "../services/social-info.js";
import { getLuckTooltip } from "../services/luck-info.js";

// type -> (key) => { label, tooltip, known }. Add drive/power/etc. here later.
const INFO_RESOLVERS = {
    stat: (key) => ({ label: key, tooltip: getStatTooltip(key), known: true }),
    condition: (key) => {
        const desc = getConditionDescription(key);
        return { label: key, tooltip: desc ? `${key} — ${desc}` : "", known: Boolean(desc) };
    },
    humour: (key) => {
        const tip = getHumourTooltip(key);
        return { label: canonicalHumour(key) || key, tooltip: tip, known: Boolean(tip) };
    },
    social: (key) => {
        const n = Number(key);
        const tip = getSocialStatusTooltip(Number.isFinite(n) ? n : undefined);
        const label = Number.isFinite(n) ? `Social Status ${n >= 0 ? "+" : ""}${n}` : "Social Status";
        return { label, tooltip: tip, known: Boolean(tip) };
    },
    luck: (key) => ({ label: "Lucky streak", tooltip: getLuckTooltip(key), known: true })
};

/**
 * Reduce inline info refs to their visible labels — @t[key]{label} -> label,
 * @t[key] -> key. Lets prefix checks (e.g. the bio mechanical-line filter) work
 * on lines that begin with a tagged term.
 */
export function stripInfoRefs(text) {
    return String(text ?? "")
        .replace(/@[a-z]+\[[^\]]+\]\{([^}]*)\}/gi, "$1")
        .replace(/@[a-z]+\[([^\]]+)\]/gi, "$1");
}

/**
 * Pure resolution of an info reference to display fields. Exported for tests and
 * reuse; no DOM access. Returns { type, key, label, tooltip, known }.
 */
export function resolveInfo(type, key, label) {
    const t = String(type ?? "").trim().toLowerCase();
    const k = String(key ?? "").trim();
    const resolver = INFO_RESOLVERS[t];
    const resolved = resolver ? resolver(k) : { label: k, tooltip: "", known: false };
    const chosenLabel = String(label ?? "").trim() || String(resolved.label ?? k);
    return {
        type: t,
        key: k,
        label: chosenLabel,
        tooltip: String(resolved.tooltip ?? "").trim(),
        known: Boolean(resolved.known)
    };
}

/**
 * Emit the enricher source text for a reference, for writing into bio lines,
 * chat, etc. e.g. statRef("Strength") -> "@stat[Strength]{Strength}". Keys with
 * a `]` or `}` are left as plain text (they can't be expressed safely).
 */
function infoRef(type, key, label) {
    const k = String(key ?? "").trim();
    const shown = String(label ?? k).trim() || k;
    if (!k || /[\]}]/.test(k) || /[}]/.test(shown)) return shown;
    return `@${type}[${k}]{${shown}}`;
}
export const statRef = (name, label) => infoRef("stat", name, label);
export const conditionRef = (name, label) => infoRef("condition", name, label);
export const humourRef = (name, label) => infoRef("humour", name, label);
export const powerRef = (name, label) => infoRef("power", name, label);
export const maneuverRef = (name, label) => infoRef("maneuver", name, label);
export const itemRef = (name, label) => infoRef("item", name, label);
export const skillRef = (name, label) => infoRef("skill", name, label);
export const socialRef = (name, label) => infoRef("social", name, label);
export const luckRef = (name, label) => infoRef("luck", name, label);

// Powers, maneuvers, and items are documents, not small in-memory catalogs — so
// @power / @maneuver / @item resolve by name against compendium packs, indexed
// once and cached for the session. The same getIndex fields work for all of them.
const PACK_SETS = {
    power: ["1547core.supernatural-marks", "1547core.monster-magic"],
    maneuver: ["1547core.maneuvers"],
    item: [
        "1547core.equipment", "1547core.weapons", "1547core.armors", "1547core.ammunition",
        "1547core.weapon-modifiers", "1547core.pacts", "1547core.spells", "1547core.diseases",
        "1547core.supernatural-marks", "1547core.monster-magic"
    ]
};
const packMapCache = {};

async function loadPackMap(packIds) {
    const map = new Map();
    const packs = (typeof game !== "undefined" && game?.packs) ? game.packs : null;
    if (!packs) return map;
    for (const packId of packIds) {
        const pack = packs.get(packId);
        if (!pack) continue;
        try {
            const index = await pack.getIndex({
                fields: ["system.props.Description", "flags.1547Core.sourceData.description"]
            });
            for (const entry of index) {
                const name = String(entry?.name ?? "").trim();
                if (!name) continue;
                const key = name.toLowerCase();
                if (map.has(key)) continue; // first pack wins on duplicate names
                const desc = String(
                    foundry.utils.getProperty(entry, "system.props.Description")
                    || foundry.utils.getProperty(entry, "flags.1547Core.sourceData.description")
                    || ""
                ).trim();
                map.set(key, { name, description: desc });
            }
        } catch (err) {
            console.warn(`[1547core] info-enricher: could not index ${packId}`, err);
        }
    }
    return map;
}

function ensurePackMap(type) {
    if (!packMapCache[type]) packMapCache[type] = loadPackMap(PACK_SETS[type] ?? []);
    return packMapCache[type];
}

async function resolvePackInfo(type, key, label) {
    const k = String(key ?? "").trim();
    const found = (await ensurePackMap(type)).get(k.toLowerCase());
    const tooltip = found?.description ? `${found.name} — ${found.description}` : "";
    return {
        type,
        key: k,
        label: String(label ?? "").trim() || found?.name || k,
        tooltip,
        known: Boolean(tooltip)
    };
}

// Skills are items too, referenced by the skill graph (each node key is an
// "Item.<id>" UUID). Resolve @skill by reading the world item's Description, and
// fall back to the node's level range + prerequisites when there's no prose.
const SKILL_GRAPH_PATH = "modules/1547core/data/skill-graph-default.json";
let skillMapPromise = null;

async function loadSkillMap() {
    const map = new Map();
    let graph = {};
    try {
        const route = (typeof foundry !== "undefined" && foundry?.utils?.getRoute)
            ? foundry.utils.getRoute(SKILL_GRAPH_PATH) : SKILL_GRAPH_PATH;
        const res = await fetch(route, { cache: "no-store" });
        if (res.ok) {
            let text = await res.text();
            if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
            graph = JSON.parse(text);
        }
    } catch (err) {
        console.warn("[1547core] info-enricher: could not load skill graph", err);
        return map;
    }

    const idToName = new Map(Object.entries(graph).map(([id, n]) => [id, n?.name ?? id]));
    const worldItems = (typeof game !== "undefined" && game?.items) ? game.items : null;
    for (const [nodeId, node] of Object.entries(graph)) {
        if (!node || node.kind !== "skill") continue;
        const name = String(node.name ?? "").trim();
        if (!name) continue;

        let desc = "";
        const item = worldItems ? worldItems.get(String(nodeId).replace(/^Item\./, "")) : null;
        if (item) {
            const props = item.system?.props ?? {};
            const src = item.flags?.["1547Core"]?.sourceData ?? {};
            desc = String(props.Description ?? src.description ?? src.Description ?? "").trim();
        }
        if (!desc) {
            const fmt = (list) => (list ?? []).map((r) => `${idToName.get(r.nodeId) ?? r.nodeId} ${r.minLevel}+`);
            const prereq = [fmt(node.requirements).join(", "), fmt(node.anyOf).join(" or ")].filter(Boolean).join("; ");
            desc = [
                "Skill",
                (node.minLevel != null && node.maxLevel != null) ? `Levels ${node.minLevel}-${node.maxLevel}` : "",
                prereq ? `Requires ${prereq}` : ""
            ].filter(Boolean).join(" · ");
        }
        map.set(name.toLowerCase(), { name, description: desc });
    }
    return map;
}

function ensureSkillMap() {
    if (!skillMapPromise) skillMapPromise = loadSkillMap();
    return skillMapPromise;
}

async function resolveSkillInfo(key, label) {
    const k = String(key ?? "").trim();
    const found = (await ensureSkillMap()).get(k.toLowerCase());
    const tooltip = found?.description ? `${found.name} — ${found.description}` : "";
    return {
        type: "skill",
        key: k,
        label: String(label ?? "").trim() || found?.name || k,
        tooltip,
        known: Boolean(tooltip)
    };
}

const ASYNC_PACK_TYPES = new Set(["power", "maneuver", "item"]);

/** Resolve an info reference to { type, key, label, tooltip, known }, async-aware. */
async function resolveInfoAsync(type, key, label) {
    const t = String(type ?? "").trim().toLowerCase();
    if (ASYNC_PACK_TYPES.has(t)) return resolvePackInfo(t, key, label);
    if (t === "skill") return resolveSkillInfo(key, label);
    return resolveInfo(t, key, label);
}

/** Just the tooltip text for a reference — used by prompt options, etc. */
export async function infoTooltip(type, key, label) {
    return (await resolveInfoAsync(type, key, label)).tooltip;
}

async function buildInfoElement(type, key, label) {
    const info = await resolveInfoAsync(type, key, label);
    const span = document.createElement("span");
    span.classList.add("enricher-1547-info");
    span.textContent = info.label;
    span.dataset.infoType = info.type;
    span.dataset.infoKey = info.key;
    if (info.tooltip) {
        // data-tooltip = Foundry's themed tooltip; title = plain fallback.
        span.setAttribute("data-tooltip", info.tooltip);
        span.setAttribute("title", info.tooltip);
        span.classList.add("is-known");
    }
    return span;
}

export function register1547InfoEnricher() {
    const enrichers = CONFIG?.TextEditor?.enrichers;
    if (!Array.isArray(enrichers)) return;

    // Generic form: @info[type:key]{optional label}
    enrichers.push({
        pattern: /@info\[\s*([a-zA-Z]+)\s*:\s*([^\]]+?)\s*\](?:\{([^}]+)\})?/g,
        enricher: async (match) => buildInfoElement(match[1], match[2], match[3]),
        replaceParent: false
    });

    // Convenience aliases for the common types.
    enrichers.push({
        pattern: /@stat\[\s*([^\]]+?)\s*\](?:\{([^}]+)\})?/g,
        enricher: async (match) => buildInfoElement("stat", match[1], match[2]),
        replaceParent: false
    });
    enrichers.push({
        pattern: /@condition\[\s*([^\]]+?)\s*\](?:\{([^}]+)\})?/g,
        enricher: async (match) => buildInfoElement("condition", match[1], match[2]),
        replaceParent: false
    });
    enrichers.push({
        pattern: /@humou?r\[\s*([^\]]+?)\s*\](?:\{([^}]+)\})?/g,
        enricher: async (match) => buildInfoElement("humour", match[1], match[2]),
        replaceParent: false
    });
    enrichers.push({
        pattern: /@power\[\s*([^\]]+?)\s*\](?:\{([^}]+)\})?/g,
        enricher: async (match) => buildInfoElement("power", match[1], match[2]),
        replaceParent: false
    });
    enrichers.push({
        pattern: /@maneuver\[\s*([^\]]+?)\s*\](?:\{([^}]+)\})?/g,
        enricher: async (match) => buildInfoElement("maneuver", match[1], match[2]),
        replaceParent: false
    });
    enrichers.push({
        pattern: /@item\[\s*([^\]]+?)\s*\](?:\{([^}]+)\})?/g,
        enricher: async (match) => buildInfoElement("item", match[1], match[2]),
        replaceParent: false
    });
    enrichers.push({
        pattern: /@skill\[\s*([^\]]+?)\s*\](?:\{([^}]+)\})?/g,
        enricher: async (match) => buildInfoElement("skill", match[1], match[2]),
        replaceParent: false
    });
    enrichers.push({
        pattern: /@social\[\s*([^\]]+?)\s*\](?:\{([^}]+)\})?/g,
        enricher: async (match) => buildInfoElement("social", match[1], match[2]),
        replaceParent: false
    });
    enrichers.push({
        pattern: /@luck\[\s*([^\]]+?)\s*\](?:\{([^}]+)\})?/g,
        enricher: async (match) => buildInfoElement("luck", match[1], match[2]),
        replaceParent: false
    });
}
