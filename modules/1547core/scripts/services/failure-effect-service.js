/**
 * Failure-effect service. Applies the `effect` carried by a rolled spell-failure
 * table entry (see spell-failure-roll-tables.json).
 *
 * Auto-applied (mechanical):
 *   - Bio                  → appends a line to the actor's Biography (chargen bio mechanism).
 *   - Drive                → prompts a new drive via the chargen drive prompt (reused).
 *   - Grant/ConditionItem  → grants the named Supernatural Mark item to the actor.
 *   - Disease/Contract     → contracts the named disease via the disease service.
 *   - Status               → applies the formalized affliction via the condition registry.
 *
 * GM-resolved (posted as a chat note): stat changes, Binding, Pact, Grant/BoundEntity,
 * Battlefield/Breach, and any unresolved status / mark / disease.
 */

import { promptAddDrive } from "../chargen/drive-prompts.js";
import { applyCondition, CONDITIONS } from "./condition-registry.js";
import { MODULE_ID } from "../lib/constants.mjs";
import { escapeHtml } from "../lib/foundry-utils.mjs";

const MARK_PACK = "1547core.supernatural-marks";

async function appendBiography(actor, html) {
    const existing = String(actor.system?.props?.Biography ?? "");
    await actor.update({ "system.props.Biography": existing ? `${existing}\n${html}` : html });
}

async function postGmNote(actor, effect) {
    const speaker = ChatMessage.getSpeaker({ actor });
    const label = `${effect.type ?? "Effect"}${effect.subtype ? ` / ${effect.subtype}` : ""}`;
    const val = effect.payloadValue ? `: ${escapeHtml(effect.payloadValue)}` : "";
    const note = effect.payloadNotes ?? effect.notes;
    const noteHtml = note ? `<p><em>${escapeHtml(note)}</em></p>` : "";
    await ChatMessage.create({
        speaker,
        flavor: "Failure effect — GM resolves",
        content: `<p><strong>${escapeHtml(label)}</strong>${val}</p>${noteHtml}`
    });
}

async function resolveItemByName(name, packName) {
    const n = String(name ?? "").trim();
    if (!n) return null;
    const world = game.items?.find((i) => i.name === n);
    if (world) return world;
    const pack = game.packs?.get(packName);
    if (pack) {
        const index = await pack.getIndex();
        const entry = [...index].find((e) => e.name === n);
        if (entry) return await pack.getDocument(entry._id);
    }
    return null;
}

async function grantMark(actor, markName) {
    const mark = await resolveItemByName(markName, MARK_PACK);
    if (!mark) return false;
    const data = mark.toObject();
    delete data._id;
    delete data._key;
    await actor.createEmbeddedDocuments("Item", [data]);
    const speaker = ChatMessage.getSpeaker({ actor });
    await ChatMessage.create({ speaker, flavor: "Failure effect", content: `<p><strong>${escapeHtml(actor.name)}</strong> is marked: <strong>${escapeHtml(mark.name)}</strong>.</p>` });
    return true;
}

/**
 * Apply a single failure-table effect object to an actor.
 * Returns { handled, kind } — handled=false means it was posted for GM resolution.
 */
export async function applyFailureEffect(actorOrToken, effect) {
    const actor = actorOrToken?.actor ?? actorOrToken;
    if (!actor || !effect || typeof effect !== "object") return { handled: false, kind: "none" };

    switch (effect.type) {
        case "Bio":
            await appendBiography(actor, `<p><em>${escapeHtml(effect.payloadValue || "A mark of a failed working.")}</em></p>`);
            return { handled: true, kind: "bio" };
        case "Drive":
            // Reuse the chargen drive prompt; the effect subtype names the drive category.
            await promptAddDrive(actor, effect.subtype || "Compulsion");
            return { handled: true, kind: "drive" };
        case "Grant":
            // Curse / Supernatural Mark → grant the named mark item. Other Grants
            // (BoundEntity, Pact) stay GM-resolved.
            if (effect.subtype === "ConditionItem" && await grantMark(actor, effect.payloadValue)) {
                return { handled: true, kind: "mark" };
            }
            await postGmNote(actor, effect);
            return { handled: false, kind: "gm-note" };
        case "Disease":
            // Contract a real disease via the disease service (grants the disease item at
            // Incubation). Falls back to a GM note if the name does not resolve.
            if (effect.subtype === "Contract") {
                const diseaseApi = game.modules.get(MODULE_ID)?.api?.disease;
                const contracted = diseaseApi?.contractDisease
                    ? await diseaseApi.contractDisease(actor, effect.payloadValue)
                    : null;
                if (contracted) return { handled: true, kind: "disease" };
            }
            await postGmNote(actor, effect);
            return { handled: false, kind: "gm-note" };
        case "Status":
            // Formalized afflictions → apply as a condition (the registry imposes its
            // disadvantage on rolls). Unknown statuses fall back to a GM note.
            if (CONDITIONS[effect.subtype]) {
                await applyCondition(actor, effect.subtype, { durationType: effect.durationType ?? "" });
                const speaker = ChatMessage.getSpeaker({ actor });
                await ChatMessage.create({ speaker, flavor: "Failure effect", content: `<p><strong>${escapeHtml(actor.name)}</strong> is afflicted: <strong>${escapeHtml(effect.subtype)}</strong>.</p>` });
                return { handled: true, kind: "condition" };
            }
            await postGmNote(actor, effect);
            return { handled: false, kind: "gm-note" };
        default:
            // Stat / Binding / Pact / Battlefield / Trait / Movement → GM-resolved.
            await postGmNote(actor, effect);
            return { handled: false, kind: "gm-note" };
    }
}

export function registerFailureEffectService() {
    const coreModule = game.modules.get(MODULE_ID);
    if (coreModule) {
        coreModule.api = coreModule.api ?? {};
        coreModule.api.failureEffect = { applyFailureEffect };
    }
}
