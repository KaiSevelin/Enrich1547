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

import { generateRitualStepsFromSpell, createRitualFromSpell } from "./ritual-generation-service.js";
import { emitDomainEvent, DOMAIN_EVENTS } from "./domain-events.js";

import { MODULE_ID, SOURCE_FLAG_SCOPE, SPELL_TEMPLATE_ID, RITUAL_TEMPLATE_ID, SPELL_PACK } from "../lib/constants.mjs";
import { isSpellItem } from "../lib/foundry-utils.mjs";

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
// Build a concrete, multi-line tooltip for a ritual step: what it is, the roll
// (skill/stat + difficulty) or that it's a condition, and any component needed.
function ritualColumn(step) {
    const icon = String(step.icon ?? "").trim() || stepIcon(step.stepType);
    const text = String(step.stepText ?? step.tooltip ?? "").trim()
        || humanizeStepType(step.stepType) || "Ritual step";
    const lines = [text];

    const skill = String(step.skillCheck ?? "").trim();
    const diff = String(step.difficulty ?? "").trim(); // raw dice pool, e.g. "2d6"
    const item = String(step.requiredItem ?? "").trim();
    if (skill) lines.push(`Roll: ${skill}${diff ? ` (${diff})` : ""}`);
    else if (item && !diff) lines.push("Provide the component (no roll)");
    else if (diff) lines.push(`Difficulty: ${diff}`);
    if (item) lines.push(`Component: ${item}`);

    return { icon, tooltip: lines.join("\n") };
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
        columns,
        resolver: { kind: "ritual", spellName: spell.name, spellUuid: spell.uuid },
        resolution: { state: 0 }
    };
    globalThis.RaceBoard?.openState?.(state, { show: true });
    return { spell, steps, total: steps.length, columns };
}

/**
 * Open the race board for an already-generated ritual item, using the steps
 * baked into it at generation time (so the random draws stay fixed).
 */
async function openRitualBoardFromRitual(ritualOrUuid) {
    const ritual = (ritualOrUuid && typeof ritualOrUuid === "object")
        ? ritualOrUuid
        : await fromUuid(ritualOrUuid).catch(() => null);
    if (!ritual) {
        ui.notifications?.warn("Open Ritual Board needs a valid ritual item.");
        return null;
    }
    let steps = ritual.flags?.[SOURCE_FLAG_SCOPE]?.generatedSteps;
    if (!Array.isArray(steps) || !steps.length) {
        // Fallback to the displayed RitualStepsTable rows.
        const rows = ritual.system?.props?.RitualStepsTable;
        steps = Array.isArray(rows) ? rows.map((r) => ({
            stepType: r.StepType, stepText: r.StepText, skillCheck: r.SkillCheck, difficulty: r.Difficulty, icon: r.Icon, tooltip: r.Tooltip
        })) : [];
    }
    if (!steps.length) {
        ui.notifications?.warn(`${ritual.name} has no ritual steps.`);
        return null;
    }
    const columns = steps.map(ritualColumn);
    const flags = ritual.flags?.[SOURCE_FLAG_SCOPE] ?? {};
    const state = {
        rows: [{ label: ritual.name, filled: 0, total: steps.length }],
        announcedWinners: [],
        columns,
        resolver: {
            kind: "ritual",
            spellName: flags.generatedFromSpellName ?? ritual.name,
            spellId: flags.generatedFromSpellId ?? null
        },
        resolution: { state: 0 }
    };
    globalThis.RaceBoard?.openState?.(state, { show: true });
    return { ritual, steps, total: steps.length };
}

/* -------------------------------------------------- */
/*  Board resolution (success / failure)              */
/*  Registered as the "ritual" RaceBoard resolver.     */
/* -------------------------------------------------- */

async function resolveSpellForResolver(resolver) {
    if (resolver?.spellUuid) {
        const d = await fromUuid(resolver.spellUuid).catch(() => null);
        if (isSpellItem(d)) return d;
    }
    if (resolver?.spellId) {
        const w = game.items?.get(resolver.spellId);
        if (isSpellItem(w)) return w;
    }
    return await resolveSpell(resolver?.spellName);
}

async function ritualResolver({ outcome, resolver, options = {} }) {
    const spell = await resolveSpellForResolver(resolver);
    if (!spell) {
        ui.notifications?.warn("1547 Core: couldn't resolve the spell for this ritual board.");
        return null;
    }
    const api = game.modules.get(MODULE_ID)?.api ?? {};
    if (typeof api.effectuateSpellOutcome !== "function") {
        ui.notifications?.warn("1547 Core: spell outcome API is unavailable.");
        return null;
    }
    const sourceToken = canvas?.tokens?.controlled?.[0] ?? null;
    const result = await api.effectuateSpellOutcome(spell, {
        outcome,
        apply: !!options.apply,
        announce: options.announce !== false,
        sourceToken
    });
    // Announce the resolution so any domain can react. Producer stays ignorant
    // of listeners (none today). Alarm is GM-manual and intentionally not driven.
    await emitDomainEvent(DOMAIN_EVENTS.RITUAL_RESOLVED, { outcome, spell, resolver, result });
    ui.notifications?.info(`1547 Core: ritual resolved as ${outcome === "failure" ? "failure" : "success"}.`);
    return result;
}

/* -------------------------------------------------- */
/*  Right-click context menu                          */
/*  v13 CSB sheets don't fire the header-button hook   */
/*  (and won't fire label clicks on locked compendium  */
/*  sheets), so the directory/compendium context menu  */
/*  is the reliable entry point.                       */
/*    spell  → Generate Ritual (creates a ritual item) */
/*    ritual → Open Ritual Board                       */
/* -------------------------------------------------- */

// Resolve the id/uuid from a right-clicked directory/compendium entry. v13
// entries vary in which dataset key they expose, so read several.
function getEntryRef(li) {
    const el = li instanceof HTMLElement ? li : li?.[0];
    const d = el?.dataset ?? {};
    return {
        id: d.entryId ?? d.documentId ?? d.itemId ?? null,
        uuid: d.uuid ?? d.entryUuid ?? d.documentUuid ?? null,
        el
    };
}

// World spell item, or any entry in the 1547core.spells compendium.
function isSpellEntry(li) {
    const { id, uuid } = getEntryRef(li);
    if (uuid && uuid.includes(`.${SPELL_PACK}.`)) return true;
    if (!id) return false;
    const world = game.items?.get(id);
    if (world) return world.system?.template === SPELL_TEMPLATE_ID;
    return !!game.packs?.get(SPELL_PACK)?.index?.get(id);
}

async function resolveSpellEntry(li) {
    const { id, uuid } = getEntryRef(li);
    if (uuid) {
        const d = await fromUuid(uuid).catch(() => null);
        if (isSpellItem(d)) return d;
    }
    if (id) {
        const world = game.items?.get(id);
        if (isSpellItem(world)) return world;
        const pack = game.packs?.get(SPELL_PACK);
        if (pack) {
            const doc = await pack.getDocument(id).catch(() => null);
            if (isSpellItem(doc)) return doc;
        }
    }
    return null;
}

// Ritual items are always world items (created by Generate Ritual).
function isRitualEntry(li) {
    const { id, uuid } = getEntryRef(li);
    const ritual = (id && game.items?.get(id)) || (uuid ? fromUuidSync?.(uuid) : null);
    return ritual?.system?.template === RITUAL_TEMPLATE_ID;
}

async function getOrCreateRitualsFolder() {
    let folder = game.folders?.find((f) => f.type === "Item" && f.name === "Rituals");
    if (!folder) folder = await Folder.create({ name: "Rituals", type: "Item", color: "#6d4b8c" });
    return folder;
}

async function generateRitualFromEntry(li) {
    const spell = await resolveSpellEntry(li);
    if (!spell) {
        console.warn(`${MODULE_ID} | Generate Ritual: could not resolve a spell from entry`, getEntryRef(li));
        ui.notifications?.warn("1547 Core: couldn't resolve the spell for this entry — see console (F12).");
        return;
    }
    try {
        const folder = await getOrCreateRitualsFolder();
        const ritual = await createRitualFromSpell(spell, { folderId: folder.id });
        ritual?.sheet?.render(true); // open it so the GM sees / can act on it
        ui.notifications?.info(`1547 Core: created '${ritual?.name ?? `${spell.name} Ritual`}' in the "Rituals" folder — right-click it → Open Ritual Board.`);
    } catch (error) {
        console.error(`${MODULE_ID} | Failed to generate ritual`, error);
        ui.notifications?.error(`1547 Core: failed to generate ritual. ${error.message}`);
    }
}

async function openBoardFromRitualEntry(li) {
    const { id, uuid } = getEntryRef(li);
    const ritual = (id && game.items?.get(id)) || (uuid ? await fromUuid(uuid).catch(() => null) : null);
    if (ritual) await openRitualBoardFromRitual(ritual);
}

function addRitualContextOptions(options) {
    if (!Array.isArray(options) || options.__ritualOptionsInjected) return;
    options.__ritualOptionsInjected = true;
    options.push({
        name: "Generate Ritual",
        icon: '<i class="fa-solid fa-wand-sparkles"></i>',
        condition: (li) => isSpellEntry(li),
        callback: (li) => generateRitualFromEntry(li)
    });
    options.push({
        name: "Open Ritual Board",
        icon: '<i class="fa-solid fa-flag-checkered"></i>',
        condition: (li) => isRitualEntry(li),
        callback: (li) => openBoardFromRitualEntry(li)
    });
}

function registerRitualContextMenu() {
    const handler = (a, b) => {
        const options = Array.isArray(b) ? b : (Array.isArray(a) ? a : null);
        if (options) addRitualContextOptions(options);
    };
    for (const hook of [
        "getItemContextOptions",
        "getItemDirectoryEntryContext",
        "getCompendiumEntryContext",
        "getCompendiumDirectoryEntryContext"
    ]) {
        Hooks.on(hook, handler);
    }
}

export function registerRitualExecutionService() {
    registerRitualContextMenu();

    // RaceBoard.registerResolver is attached at `ready` (refreshRaceboardApi),
    // which runs before this ready hook. Fail loudly if that ever changes, so
    // ritual board resolution doesn't silently stop working.
    Hooks.once("ready", () => {
        const rb = globalThis.RaceBoard;
        if (typeof rb?.registerResolver === "function") {
            rb.registerResolver("ritual", ritualResolver);
        } else {
            console.warn(`${MODULE_ID} | RaceBoard.registerResolver unavailable at ready — ritual board success/failure resolution is disabled.`);
        }
    });

    const moduleApi = game.modules.get(MODULE_ID);
    if (moduleApi) {
        moduleApi.api = moduleApi.api ?? {};
        moduleApi.api.openRitualBoard = openRitualBoard;
        moduleApi.api.openRitualBoardFromRitual = openRitualBoardFromRitual;
    }
    globalThis.Ritual1547 = { openRitualBoard, openRitualBoardFromRitual };
}
