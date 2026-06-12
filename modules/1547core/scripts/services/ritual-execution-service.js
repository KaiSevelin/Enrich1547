/**
 * Ritual execution service. Turns an assembled ritual into a playable race
 * board: one Working track whose boxes are the ritual's steps, with a header
 * row that labels each step (icon + tooltip).
 * See docs/specs/ritual-execution-spec-v1.md.
 *
 *   - openRitualBoard(spell) — assemble the ritual's steps and open the board
 *
 * Each step's column icon/tooltip uses the step's authored Icon / Tooltip when
 * set, else derives a default from the step type (STEP_TYPE_ICON) and its
 * difficulty. All icons below are FontAwesome 6 *Free* solid.
 */

import { generateRitualStepsFromSpell } from "./ritual-generation-service.js";

const MODULE_ID = "1547core";
const SPELL_TEMPLATE_ID = "2kiWw3Cv5Zk1lZxn";
const SPELL_PACK = "1547core.spells";

// Specific free FontAwesome solid icon per ritual step type. Unknown types fall
// back to GENERIC_STEP_ICON. Mirror any additions in the data migration too.
const STEP_TYPE_ICON = {
    StaticSkill: "fa-graduation-cap",
    Skill: "fa-dice-d20",
    AlchemicalOperation: "fa-flask",
    HerbalPreparation: "fa-leaf",
    Craft: "fa-hammer",
    Material: "fa-cube",
    RareMaterial: "fa-gem",
    CeremonialDiagram: "fa-draw-polygon",
    BoundaryWork: "fa-ring",
    Writing: "fa-pen-nib",
    TrueName: "fa-signature",
    Performance: "fa-music",
    ComplexPerformance: "fa-masks-theater",
    CorpseWork: "fa-skull",
    DivinatoryFocus: "fa-eye",
    Witness: "fa-users",
    Assistance: "fa-handshake-angle",
    Defense: "fa-shield-halved",
    Resistance: "fa-hand-fist",
    Purification: "fa-hands-bubbles",
    Purity: "fa-dove",
    ExactTiming: "fa-clock",
    LongVigil: "fa-hourglass-half",
    Isolation: "fa-door-closed",
    Placement: "fa-location-dot",
    OathBurden: "fa-file-signature",
    Environment: "fa-mountain-sun"
};
const GENERIC_STEP_ICON = "fa-wand-magic-sparkles";

// General difficulty names by opposing-d6 count. Ritual steps express difficulty
// as a bare count ("2") or dice ("2d6"); both resolve here.
const GENERAL_DIFFICULTY = { 1: "trivial", 2: "easy", 3: "average", 4: "hard", 5: "rough" };

function isSpellItem(item) {
    return item?.system?.template === SPELL_TEMPLATE_ID;
}

function stepIcon(stepType) {
    return STEP_TYPE_ICON[String(stepType ?? "").trim()] ?? GENERIC_STEP_ICON;
}

function difficultyName(raw) {
    const s = String(raw ?? "").trim();
    if (!s) return "";
    const m = s.match(/(\d+)\s*d6/i) ?? s.match(/^(\d+)$/);
    if (m) {
        const name = GENERAL_DIFFICULTY[Number(m[1])];
        if (name) return name;
    }
    return s.toLowerCase();
}

function humanizeStepType(stepType) {
    return String(stepType ?? "").replace(/([a-z])([A-Z])/g, "$1 $2").trim();
}

// One race-board column header per step. Authored Icon/Tooltip win; otherwise
// derive a step-type icon and a "Step text (difficulty)" tooltip.
function ritualColumn(step) {
    const icon = String(step.icon ?? "").trim() || stepIcon(step.stepType);
    let tooltip = String(step.tooltip ?? "").trim();
    if (!tooltip) {
        const text = String(step.stepText ?? "").trim() || humanizeStepType(step.stepType) || "Step";
        const diff = difficultyName(step.difficulty);
        tooltip = diff ? `${text} (${diff})` : text;
    }
    return { icon, tooltip };
}

async function resolveSpell(spellOrName) {
    if (spellOrName && typeof spellOrName === "object") return spellOrName;
    const name = String(spellOrName ?? "").trim();
    if (!name) return null;
    const world = game.items?.find((i) => i.name === name && isSpellItem(i));
    if (world) return world;
    const pack = game.packs?.get(SPELL_PACK);
    if (pack) {
        const index = await pack.getIndex();
        const entry = [...index].find((e) => e.name === name);
        if (entry) return await pack.getDocument(entry._id);
    }
    return null;
}

/**
 * Assemble a spell's ritual steps and open them as a race board, one box per
 * step with a labelled header row.
 * @param {Item|string} spellOrName  A spell item or its name.
 * @param {object} [options]         { label } to override the track label.
 */
async function openRitualBoard(spellOrName, options = {}) {
    const spell = await resolveSpell(spellOrName);
    if (!spell || !isSpellItem(spell)) {
        ui.notifications?.warn("Open Ritual Board needs a valid spell.");
        return null;
    }
    const generated = await generateRitualStepsFromSpell(spell);
    const steps = generated.allSteps ?? [];
    if (!steps.length) {
        ui.notifications?.warn(`${spell.name} produced no ritual steps.`);
        return null;
    }

    const columns = steps.map(ritualColumn);
    const label = String(options.label ?? `${spell.name} — Ritual`);
    const state = {
        rows: [{ label, filled: 0, total: steps.length }],
        announcedWinners: [],
        columns
    };
    globalThis.RaceBoard?.openState?.(state, { show: true });
    return { spell, steps, total: steps.length, columns };
}

function addOpenRitualBoardHeaderButton(app, buttons) {
    const item = app?.object;
    if (!isSpellItem(item)) return;
    buttons.unshift({
        class: "open-ritual-board",
        icon: "fas fa-flag-checkered",
        label: "Ritual Board",
        onclick: () => {
            void openRitualBoard(item).catch((error) => {
                console.error(`${MODULE_ID} | Failed to open ritual board`, error);
                ui.notifications.error(`1547 Core: failed to open ritual board. ${error.message}`);
            });
        }
    });
}

export function registerRitualExecutionService() {
    Hooks.on("getItemSheetHeaderButtons", (app, buttons) => {
        addOpenRitualBoardHeaderButton(app, buttons);
    });

    const moduleApi = game.modules.get(MODULE_ID);
    if (moduleApi) {
        moduleApi.api = moduleApi.api ?? {};
        moduleApi.api.openRitualBoard = openRitualBoard;
    }
    globalThis.Ritual1547 = { openRitualBoard };
}
