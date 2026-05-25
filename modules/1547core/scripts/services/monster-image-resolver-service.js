const MODULE_ID = "1547core";
const DEFAULT_IMAGE = "icons/svg/mystery-man.svg";

/**
 * Resolve the portrait/image used for a composed monster actor.
 *
 * Current policy:
 * - Image is derived, not granted by Change items.
 * - The actor's authored/base image remains the default resolved image.
 * - Future resolver layers may inspect composition state (type, domain, role,
 *   visual theme hints) before falling back to the base actor image.
 */
export function resolveMonsterImage(actor, { state = null } = {}) {
    if (!actor) return DEFAULT_IMAGE;

    const resolvedState = state
        ?? game.modules.get(MODULE_ID)?.api?.composition?.getEffectiveActorCached?.(actor)
        ?? null;

    const portraitOverride = String(actor.flags?.[MODULE_ID]?.portraitOverride ?? "").trim();
    if (portraitOverride) return portraitOverride;

    const portraitKey = String(resolvedState?.effectiveProps?.PortraitKey ?? "").trim();
    const visualTheme = String(resolvedState?.effectiveProps?.VisualTheme ?? "").trim();

    // Reserved for future lookup expansion.
    void portraitKey;
    void visualTheme;

    return actor.img || DEFAULT_IMAGE;
}

export function registerMonsterImageResolverService() {
    const moduleApi = game.modules.get(MODULE_ID);
    if (!moduleApi) {
        console.warn(`${MODULE_ID} | registerMonsterImageResolverService: module not found`);
        return;
    }

    moduleApi.api = moduleApi.api ?? {};
    moduleApi.api.imageResolver = {
        resolveMonsterImage
    };
}

export default {
    registerMonsterImageResolverService,
    resolveMonsterImage
};
