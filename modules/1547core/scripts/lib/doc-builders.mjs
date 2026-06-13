// Shared document-body builders for item/actor docs. Imported by both
// build-packs.mjs (compile) and module-settings.js (world seeding). Only the
// computed *body* (system / flags / merged actor parts) is shared — each caller
// keeps its own envelope literal (the CLI compile form adds `_key`/`sort`; the
// runtime seed form sets `folder`/`items`), preserving exact key order.

import { deepClone, cloneTemplateSystem, mergeDeep } from "./build-helpers.mjs";
import { SOURCE_FLAG_SCOPE } from "./constants.mjs";

/**
 * The shared system + flags for a CSB instance item built from a template.
 * `type` ("equippableItem") and the rest of the envelope stay with the caller.
 */
export function csbItemBody(template, source, propsBuilder, folderHint) {
    return {
        system: {
            ...cloneTemplateSystem(template),
            props: propsBuilder(source)
        },
        flags: {
            "custom-system-builder": {
                version: template.flags?.["custom-system-builder"]?.version ?? "5.2.0"
            },
            [SOURCE_FLAG_SCOPE]: {
                folderHint: folderHint ?? source.folder ?? null,
                sourceData: source
            }
        }
    };
}

/**
 * Merge an actor template's system + prototypeToken with a source actor's
 * (source wins), via the Node-safe mergeDeep so build and seed match exactly.
 */
export function mergeActorParts(source, actorTemplate) {
    const system = actorTemplate?.system
        ? mergeDeep(deepClone(actorTemplate.system), source.system ?? {})
        : deepClone(source.system ?? {});
    const prototypeToken = actorTemplate?.prototypeToken
        ? mergeDeep(deepClone(actorTemplate.prototypeToken ?? {}), source.prototypeToken ?? {})
        : deepClone(source.prototypeToken ?? {});
    return { system, prototypeToken };
}
