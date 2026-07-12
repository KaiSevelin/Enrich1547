/**
 * combat-tracker/side-turn-flow.js (ADR-0004, extracted from hud/actor-hud.js)
 *
 * The Side-Ready turn flow: compute the next side turn state, advance the
 * Combat doc (GM-only write; players request it over the module socket),
 * and the Side Ready announcement + confirmation dialog. Lives next to
 * side-tracker.js because this IS the side domain - the HUD merely hosts
 * the button that calls announceSideReady.
 */
import { MODULE_ID } from "../lib/constants.mjs";
import { escapeHtml } from "../lib/foundry-utils.mjs";
import {
    getOrderedCombatants,
    resolveCombatantSideId,
    getSideLabel,
    getActiveSideId,
    getResolvedSideOrder,
    persistCombatSideState,
    resetSideTurnState,
} from "./side-tracker.js";

const SIDE_READY_CONFIRM_SETTING = "showSideReadyConfirmation";

function getFirstCombatantIndexForSide(combat, sideId) {
    const turns = Array.isArray(combat?.turns) ? combat.turns : [];
    return turns.findIndex((combatant) => !combatant?.defeated && resolveCombatantSideId(combatant) === sideId);
}

export function getNextStoredSideTurnState(combat) {
    const orderedCombatants = getOrderedCombatants(combat).filter((combatant) => !combatant?.defeated);
    if (!orderedCombatants.length) return null;

    const sideOrder = getResolvedSideOrder(combat, orderedCombatants);
    if (!sideOrder.length) return null;

    const currentSideId = getActiveSideId(combat, orderedCombatants) || sideOrder[0] || "";
    const currentIndex = Math.max(0, sideOrder.indexOf(currentSideId));

    for (let offset = 1; offset <= sideOrder.length; offset += 1) {
        const sideIndex = (currentIndex + offset) % sideOrder.length;
        const nextSideId = sideOrder[sideIndex];
        const nextCombatant = orderedCombatants.find((combatant) => resolveCombatantSideId(combatant) === nextSideId) ?? null;
        const nextTurnIndex = getFirstCombatantIndexForSide(combat, nextSideId);
        if (!nextCombatant || nextTurnIndex < 0) continue;
        return {
            activeSideId: nextSideId,
            sideLabel: getSideLabel(nextSideId),
            combatant: nextCombatant,
            turn: nextTurnIndex,
            round: sideIndex <= currentIndex ? (Number(combat.round) || 1) + 1 : (Number(combat.round) || 1),
            wrapped: sideIndex <= currentIndex,
        };
    }

    return null;
}

export async function advanceCombatToNextSide(combat) {
    if (!combat?.update) return null;
    const nextState = getNextStoredSideTurnState(combat);
    if (!nextState) return null;
    await combat.update({
        round: nextState.round,
        turn: nextState.turn,
    });
    await combat.setFlag(MODULE_ID, "activeSideId", nextState.activeSideId);
    await combat.setFlag(MODULE_ID, "roundNumber", nextState.round);
    await persistCombatSideState(combat);
    // The side whose window just opened restores its per-turn resources
    // (movement budget + full-turn action).
    await resetSideTurnState(combat, nextState.activeSideId);
    return nextState;
}

async function confirmSideReady(nextState) {
    const showConfirmation = game.settings.get(MODULE_ID, SIDE_READY_CONFIRM_SETTING) !== false;
    if (!showConfirmation) return true;

    return await new Promise((resolve) => {
        let settled = false;
        const content = "<form class=\"combat-side-ready-confirm\">"
            + "<div class=\"combat-side-ready-confirm__eyebrow\">Side Transition</div>"
            + "<div class=\"combat-side-ready-confirm__title\">This ends the turn for the whole side.</div>"
            + "<div class=\"combat-side-ready-confirm__body\">Any actor on the currently active side will lose the rest of this side activation.</div>"
            + "<div class=\"combat-side-ready-confirm__next\"><span class=\"combat-side-ready-confirm__next-label\">Next active side</span><strong>" + escapeHtml(nextState?.sideLabel || nextState?.combatant?.name || "Next side") + "</strong></div>"
            + "<label class=\"combat-side-ready-confirm__toggle\">"
            + "<input type=\"checkbox\" name=\"hideAgain\" />"
            + "<span>Do not show again</span>"
            + "</label>"
            + "</form>";
        const dialog = new Dialog({
            title: "End Whole Side Turn?",
            content,
            buttons: {
                confirm: {
                    icon: '<i class="fas fa-check"></i>',
                    label: "End Side Turn",
                    callback: async (html) => {
                        const hideAgain = html.find('[name="hideAgain"]')[0]?.checked === true;
                        if (hideAgain) {
                            await game.settings.set(MODULE_ID, SIDE_READY_CONFIRM_SETTING, false);
                        }
                        settled = true;
                        resolve(true);
                    },
                },
                cancel: {
                    label: "Cancel",
                    callback: () => {
                        settled = true;
                        resolve(false);
                    },
                },
            },
            default: "cancel",
            close: () => {
                if (!settled) resolve(false);
            },
        });
        dialog.render(true);
    });
}

export async function announceSideReady(actor, token) {
    if (!game.combat?.started) {
        ui.notifications?.warn?.("Combat is not active.");
        return;
    }

    const nextPreview = getNextStoredSideTurnState(game.combat);
    if (!nextPreview) {
        ui.notifications?.warn?.("No next side could be resolved.");
        return;
    }

    const confirmed = await confirmSideReady(nextPreview);
    if (!confirmed) return;

    const speaker = ChatMessage.getSpeaker({ actor, token: token?.document });
    const callerName = game.user?.name || "A player";
    const actorName = token?.name || actor?.name || "Selected actor";
    const targetCount = Array.from(game.user?.targets ?? []).length;
    const targetText = targetCount > 0
        ? "<br>Current targets marked in Foundry: " + escapeHtml(targetCount)
        : "";

    const nextName = nextPreview?.sideLabel || nextPreview?.combatant?.name || nextPreview?.combatant?.actor?.name || "next side";
    const roundText = nextPreview?.wrapped ? "<br>Combat advances to a new round." : "";
    const sideText = "<br><strong>Next active side:</strong> " + escapeHtml(nextName);

    await ChatMessage.create({
        speaker,
        content: "<strong>" + escapeHtml(callerName) + "</strong> calls <strong>Side Ready</strong> for " + escapeHtml(actorName) + "." + targetText + sideText + roundText
    });

    // Advancing the combat writes to the Combat doc, which only the GM may do.
    // The GM does it directly; a player asks the GM over the socket.
    if (game.user?.isGM) {
        await advanceCombatToNextSide(game.combat);
    } else {
        game.socket?.emit(`module.${MODULE_ID}`, { type: "side-advance-request", userId: game.user?.id });
    }
}

// GM-side listener: a player asked to advance the side (they can't write the
// Combat doc themselves). Only the GM acts on it.
let sideAdvanceSocketBound = false;
export function bindSideAdvanceSocket() {
    if (sideAdvanceSocketBound || !game?.socket) return;
    sideAdvanceSocketBound = true;
    game.socket.on(`module.${MODULE_ID}`, (msg) => {
        if (msg?.type !== "side-advance-request" || !game.user?.isGM) return;
        if (!game.combat?.started) return;
        void (async () => {
            const who = game.users?.get(msg.userId)?.name || "A player";
            try {
                const next = await advanceCombatToNextSide(game.combat);
                if (next) ui.notifications?.info?.(`${who} called Side Ready — now: ${next.sideLabel || "next side"}.`);
                else ui.notifications?.warn?.(`${who} called Side Ready but no next side could be resolved.`);
            } catch (err) {
                ui.notifications?.error?.(`Could not advance the side for ${who}.`);
                console.error("1547core | side-advance failed", err);
            }
        })();
    });
}
