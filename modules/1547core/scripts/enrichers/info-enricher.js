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
    }
};

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

function buildInfoElement(type, key, label) {
    const info = resolveInfo(type, key, label);
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
}
