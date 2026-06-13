// Shared build/seed helpers — dependency-neutral so BOTH the Node build
// (build-packs.mjs) and the Foundry runtime seeder (module-settings.js) can
// import them. No fs / Foundry-CLI / Foundry-global imports at module scope.

export const ACTOR_TYPES = ["Player", "HiddenFolk", "TheUnseen", "Beast", "Undead", "Colossal", "Unnatural", "Construct", "Zone", "People"];

// A valid Foundry document id: 16 alphanumerics.
export const VALID_FOUNDRY_ID = /^[A-Za-z0-9]{16}$/;

// Deep clone that works in Node (build) and in Foundry (runtime).
export function deepClone(value) {
    if (globalThis.foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
    return JSON.parse(JSON.stringify(value));
}

// Recursive object merge (source wins; arrays/primitives overwrite, nested
// plain objects merge). Node-safe — used in the build where foundry.utils
// isn't available, and shared so seeding merges identically.
export function mergeDeep(target, source) {
    const out = { ...(target ?? {}) };
    for (const [key, value] of Object.entries(source ?? {})) {
        if (value && typeof value === "object" && !Array.isArray(value)
            && out[key] && typeof out[key] === "object" && !Array.isArray(out[key])) {
            out[key] = mergeDeep(out[key], value);
        } else {
            out[key] = deepClone(value);
        }
    }
    return out;
}

export function isValidFoundryId(value) {
    return VALID_FOUNDRY_ID.test(String(value ?? ""));
}

export function deriveFoundryIdFromText(text) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let hashA = 2166136261;
    let hashB = 16777619;
    const source = String(text ?? "1547CoreItem");
    for (const ch of source) {
        const code = ch.charCodeAt(0);
        hashA ^= code;
        hashA = Math.imul(hashA, 16777619) >>> 0;
        hashB = (Math.imul(hashB ^ code, 2246822519) + 3266489917) >>> 0;
    }
    let output = "";
    for (let i = 0; i < 16; i += 1) {
        hashA = (Math.imul(hashA ^ (hashB >>> (i % 8)), 1664525) + 1013904223) >>> 0;
        output += alphabet[hashA % alphabet.length];
    }
    return output;
}

export function normalizeTraitKey(value) {
    return String(value ?? "").replace(/[^A-Za-z0-9]/g, "");
}

export function normalizeTypeList(values) {
    if (Array.isArray(values)) return values.map((e) => String(e ?? "").trim()).filter(Boolean);
    if (typeof values === "string" && values.trim()) return [values.trim()];
    return [];
}

export function normalizeSourceEntry(source, kind, documentType = "Item") {
    const normalized = deepClone(source);
    let nextId = normalized._id;
    const uuidSuffix = typeof normalized.uuid === "string" ? normalized.uuid.split(".").pop() : "";
    if (!isValidFoundryId(nextId)) {
        if (isValidFoundryId(normalized.id)) nextId = normalized.id;
        else if (isValidFoundryId(uuidSuffix)) nextId = uuidSuffix;
        else nextId = deriveFoundryIdFromText(`${kind}:${normalized.name}:${normalized.uuid ?? ""}`);
    }
    normalized._id = nextId;
    normalized.id = nextId;
    normalized.uuid = `${documentType}.${nextId}`;
    return normalized;
}

export function mergeDefinedProps(baseProps, overrideProps) {
    const merged = { ...(baseProps ?? {}) };
    for (const [key, value] of Object.entries(overrideProps ?? {})) {
        if (value !== undefined) merged[key] = value;
    }
    return merged;
}

export function cloneTemplateSystem(template) {
    return {
        body: deepClone(template.system?.body),
        display: deepClone(template.system?.display),
        header: deepClone(template.system?.header),
        hidden: deepClone(template.system?.hidden ?? []),
        modifiers: [],
        template: template._id,
        templateSystemUniqueVersion: template.system?.templateSystemUniqueVersion,
        props: {}
    };
}

