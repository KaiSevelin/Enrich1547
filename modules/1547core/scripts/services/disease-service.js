/**
 * Disease service. Turns the disease items (Disease template) into three live
 * capabilities:
 *   - rollContraction(actor, disease, opts)  — automate the contraction save
 *   - contractDisease(actor, disease)        — grant the affliction at phase 1
 *   - advanceDiseasePhase(actor, affliction) — step the phase clock
 *   - openTreatmentBoard(actor, affliction)  — build the cure race board
 *
 * Disease definitions and active afflictions share the Disease template; an
 * active affliction is the disease item granted onto the actor, whose
 * CurrentPhase / PhaseDaysElapsed / CureBoxesFilled props track the live case.
 * See docs/specs/disease-system-spec-v1.md.
 */

import { applyConditionDiceModifier, applyCondition, removeCondition } from "./condition-registry.js";
import { emitDomainEvent, DOMAIN_EVENTS } from "./domain-events.js";
import { MODULE_ID, DISEASE_TEMPLATE_ID } from "../lib/constants.mjs";

const DISEASE_PACK = "1547core.diseases";
const PHASE_CONDITION = { Weak: "Weakened", Exhausted: "Exhausted" };

const HUMOUR_PROP = {
    Blood: "Humour_Blood",
    YellowBile: "Humour_YellowBile",
    BlackBile: "Humour_BlackBile",
    Phlegm: "Humour_Phlegm"
};
const PHASE_BEFORE_CRISIS = new Set(["Incubation", "Symptoms", "Onset"]);

/* ---------------------------------------- */
/*  Small readers                           */
/* ---------------------------------------- */

function props(doc) { return doc?.system?.props ?? {}; }
function statDice(actor, stat) { return Number(props(actor)[`Stats_${stat}Dice`] ?? 0); }
function statMod(actor, stat) { return Number(props(actor)[`Stats_${stat}Mod`] ?? 0); }
function faithDice(actor) { return statDice(actor, "Faith"); }
function isHumourDominant(actor, humourKey) { return props(actor)[HUMOUR_PROP[humourKey]] === true; }
function dominantHumours(actor) { return Object.keys(HUMOUR_PROP).filter((h) => isHumourDominant(actor, h)); }

function humourLabel(key) { return String(key ?? "").replace(/([a-z])([A-Z])/g, "$1 $2"); }
function phaseLabel(key) { return humourLabel(key); }
function escapeHtml(s) { return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

function statFormula(actor, stat, bonusDice = 0) {
    const dice = applyConditionDiceModifier(actor, stat, statDice(actor, stat), Number(bonusDice) || 0);
    const mod = statMod(actor, stat);
    if (dice <= 0 && mod === 0) return "0";
    return mod === 0 ? `${dice}d6` : `${dice}d6 + ${mod}`;
}

async function rollTotal(formula) {
    const safe = String(formula ?? "0").trim() || "0";
    const roll = await new Roll(safe).evaluate({ async: true });
    return { total: Number(roll.total ?? 0) || 0, formula: safe, roll };
}

/* ---------------------------------------- */
/*  Disease resolution                      */
/* ---------------------------------------- */

async function resolveDisease(diseaseOrName) {
    if (diseaseOrName && typeof diseaseOrName === "object") return diseaseOrName;
    const name = String(diseaseOrName ?? "").trim();
    if (!name) return null;
    const world = game.items?.find((i) => i.name === name && Array.isArray(props(i).Phases));
    if (world) return world;
    const pack = game.packs?.get(DISEASE_PACK);
    if (pack) {
        const index = await pack.getIndex();
        const entry = [...index].find((e) => e.name === name);
        if (entry) return await pack.getDocument(entry._id);
    }
    return null;
}

function spiritPowerDice(opts) {
    if (opts.spirit) return statDice(opts.spirit, "Power");
    if (opts.spiritPowerDice != null) return Number(opts.spiritPowerDice);
    return null;
}

/* ---------------------------------------- */
/*  Contraction                             */
/* ---------------------------------------- */

// Returns a reason string if the actor is immune, else null.
function immunityReason(actor, disease, opts) {
    const p = props(disease);
    switch (p.ImmunityRule) {
        case "OnlyHumour": {
            const h = p.AssociatedHumour;
            return isHumourDominant(actor, h) ? null : `immune — not dominated by ${humourLabel(h)}`;
        }
        case "BalancedImmune":
            return dominantHumours(actor).length === 0 ? "immune — humours are balanced" : null;
        case "FaithExceedsSpirit": {
            const sp = spiritPowerDice(opts);
            if (sp == null) return null;
            return faithDice(actor) > sp ? "immune — Faith exceeds the spirit's Power" : null;
        }
        default:
            return null;
    }
}

// Advantage dice the actor gains on the contagion save (resistance).
function resistanceAdvantage(actor, disease) {
    const p = props(disease);
    if (p.ResistanceRule === "NotHumour") {
        const h = String(p.ResistanceValue ?? "").replace(/[^A-Za-z0-9]/g, "");
        return h && !isHumourDominant(actor, h) ? 1 : 0;
    }
    if (p.ResistanceRule === "FaithDiceAtLeast") {
        return faithDice(actor) >= Number(p.ResistanceValue ?? 0) ? 1 : 0;
    }
    return 0;
}

function contagionDifficultyFormula(disease, opts) {
    const diff = String(props(disease).ContagionDifficulty ?? "").trim();
    if (/^SpiritPower$/i.test(diff)) {
        if (opts.spirit) return statFormula(opts.spirit, "Power");
        if (opts.spiritPowerFormula) return String(opts.spiritPowerFormula);
        return "3d6";
    }
    return diff || "3d6";
}

async function rollContraction(actorOrToken, diseaseOrName, opts = {}) {
    const actor = actorOrToken?.actor ?? actorOrToken;
    const disease = await resolveDisease(diseaseOrName);
    if (!actor || !disease) {
        ui.notifications?.warn("Disease contraction needs a valid actor and disease.");
        return null;
    }
    const p = props(disease);

    const immune = immunityReason(actor, disease, opts);
    if (immune) {
        await postChat(actor, disease, `<p><strong>${escapeHtml(actor.name)}</strong> is ${escapeHtml(immune)}.</p>`);
        return { immune: true, contracted: false, reason: immune };
    }

    const advantage = resistanceAdvantage(actor, disease);
    const stat = p.ContagionStat || "Stamina";
    const save = await rollTotal(statFormula(actor, stat, advantage));
    const diff = await rollTotal(contagionDifficultyFormula(disease, opts));
    const contracted = !(save.total > diff.total); // save success (>) avoids; tie/below contracts

    let created = null;
    if (contracted) created = await contractDisease(actor, disease);

    const advNote = advantage ? ` (with +${advantage} resistance die)` : "";
    await postChat(actor, disease,
        `<p><strong>Contagion — ${escapeHtml(disease.name)}</strong></p>` +
        `<p>${escapeHtml(stat)} save${advNote}: <strong>${save.total}</strong> (${escapeHtml(save.formula)}) vs <strong>${diff.total}</strong> (${escapeHtml(diff.formula)})</p>` +
        `<p>${contracted ? `<strong>Contracted.</strong> ${escapeHtml(actor.name)} now carries ${escapeHtml(disease.name)} (Incubation).` : `<strong>Resisted.</strong> No disease.`}</p>`
    );
    return { immune: false, contracted, save, diff, advantage, affliction: created };
}

/* ---------------------------------------- */
/*  Contraction → affliction item           */
/* ---------------------------------------- */

async function contractDisease(actorOrToken, diseaseOrName) {
    const actor = actorOrToken?.actor ?? actorOrToken;
    const disease = await resolveDisease(diseaseOrName);
    if (!actor || !disease) return null;
    const p = props(disease);
    const firstPhase = p.Phases?.[0]?.Phase ?? "Incubation";

    const data = disease.toObject();
    delete data._id;
    delete data._key;
    foundry.utils.setProperty(data, "system.props.CurrentPhase", firstPhase);
    foundry.utils.setProperty(data, "system.props.PhaseDaysElapsed", 0);
    foundry.utils.setProperty(data, "system.props.CureBoxesFilled", "");

    const [created] = await actor.createEmbeddedDocuments("Item", [data]);
    await notePhase(actor, created, firstPhase);
    await emitDomainEvent(DOMAIN_EVENTS.DISEASE_CONTRACTED, { actor, disease: created, phase: firstPhase });
    return created ?? null;
}

/* ---------------------------------------- */
/*  Phase tracking                          */
/* ---------------------------------------- */

function phaseList(affliction) { return (props(affliction).Phases ?? []).map((x) => x.Phase); }
function phaseEntry(affliction, phase) { return (props(affliction).Phases ?? []).find((x) => x.Phase === phase) ?? null; }

async function advanceDiseasePhase(affliction) {
    if (!affliction) return null;
    const phases = phaseList(affliction);
    const current = props(affliction).CurrentPhase;
    const idx = phases.indexOf(current);
    const next = idx >= 0 && idx + 1 < phases.length ? phases[idx + 1] : null;
    if (!next) {
        ui.notifications?.info(`${affliction.name} has no further phase (${phaseLabel(current)} is terminal).`);
        return null;
    }
    await affliction.update({
        "system.props.CurrentPhase": next,
        "system.props.PhaseDaysElapsed": 0,
        "system.props.CureBoxesFilled": ""
    });
    await notePhase(affliction.parent ?? null, affliction, next);
    await emitDomainEvent(DOMAIN_EVENTS.DISEASE_ADVANCED, { actor: affliction.parent ?? null, disease: affliction, phase: next });
    return next;
}

async function notePhase(actor, affliction, phase) {
    const entry = phaseEntry(affliction, phase);
    const cond = entry?.Condition && entry.Condition !== "None" ? ` — patient is <strong>${escapeHtml(entry.Condition)}</strong>` : "";
    const effect = entry?.Effect ? `<p>${escapeHtml(entry.Effect)}</p>` : "";
    await postChat(actor, affliction,
        `<p><strong>${escapeHtml(affliction.name)}</strong> enters <strong>${escapeHtml(phaseLabel(phase))}</strong>${cond}.</p>${effect}`
    );
    // Apply the phase's condition (Weak → Weakened, Exhausted → Exhausted) via the
    // condition registry, clearing the previous phase's condition first.
    const carrier = actor?.actor ?? actor;
    if (carrier) {
        await removeCondition(carrier, "Weakened");
        await removeCondition(carrier, "Exhausted");
        const mapped = PHASE_CONDITION[entry?.Condition];
        if (mapped) await applyCondition(carrier, mapped, { durationType: "Disease" });
    }
}

/* ---------------------------------------- */
/*  Treatment race board                    */
/* ---------------------------------------- */

// Cure-board column header icons by medical Role. All FontAwesome 6 *Free*
// solid icons. Unknown roles fall back to a generic medical kit.
const ROLE_ICON = {
    "Physician": "fa-user-doctor",
    "Barber-Surgeon": "fa-scissors",
    "BarberSurgeon": "fa-scissors",
    "Apothecary": "fa-tablets",
    "Cleric": "fa-hands-praying",
    "Player": "fa-user"
};

// General difficulty names by opposing-d6 count (Trivial 1 … Rough 5), matching
// the HUD's general-check scale. Used to render "2d6" as "(easy)" in tooltips.
const GENERAL_DIFFICULTY = { 1: "Trivial", 2: "Easy", 3: "Average", 4: "Hard", 5: "Rough" };

function roleIcon(role) {
    return ROLE_ICON[String(role ?? "").trim()] ?? "fa-kit-medical";
}

function difficultyName(raw) {
    const s = String(raw ?? "").trim();
    const m = s.match(/(\d+)\s*d6/i);
    if (m) {
        const name = GENERAL_DIFFICULTY[Number(m[1])];
        if (name) return name.toLowerCase();
    }
    return s.toLowerCase();
}

// One race-board column header per cure box. Uses the box's authored Icon /
// Tooltip when present, else derives defaults (Role icon + "Action (difficulty)").
function cureColumn(box) {
    const authoredIcon = String(box.Icon ?? "").trim();
    const authoredTooltip = String(box.Tooltip ?? "").trim();
    const action = String(box.Action ?? "").trim() || humourLabel(box.Role) || "Step";
    const diff = difficultyName(box.Difficulty);
    return {
        icon: authoredIcon || roleIcon(box.Role),
        tooltip: authoredTooltip || (diff ? `${action} (${diff})` : action)
    };
}

function cureRowsForPhase(affliction, phase) {
    const rows = props(affliction).CureBoard ?? [];
    return rows.filter((r) => {
        if (r.Phase === phase) return true;
        if (r.Phase === "All") return true;
        if (r.Phase === "OnsetAndBefore") return PHASE_BEFORE_CRISIS.has(phase);
        return false;
    });
}

async function openTreatmentBoard(actorOrToken, afflictionOrId) {
    const actor = actorOrToken?.actor ?? actorOrToken;
    const affliction = typeof afflictionOrId === "string"
        ? actor?.items?.get(afflictionOrId)
        : afflictionOrId;
    if (!affliction) {
        ui.notifications?.warn("No affliction item to treat.");
        return null;
    }
    const phase = props(affliction).CurrentPhase ?? "Onset";
    const boxes = cureRowsForPhase(affliction, phase);
    if (!boxes.length) {
        ui.notifications?.warn(`${affliction.name} has no cure board for the ${phaseLabel(phase)} phase.`);
        return null;
    }

    const label = `${affliction.name} — ${phaseLabel(phase)}`;
    const state = {
        rows: [{ label, filled: 0, total: boxes.length }],
        announcedWinners: [],
        // Label each box with the treatment step it represents (icon + tooltip).
        columns: boxes.map(cureColumn),
        // Resolve controls: Success cures (removes) the affliction, Failure
        // announces that it persists. Handled by the "disease" resolver below.
        resolver: {
            kind: "disease",
            afflictionUuid: affliction.uuid,
            afflictionName: affliction.name,
            actorUuid: actor?.uuid ?? null,
            phase,
            applyLabel: "Remove the cured affliction from the patient"
        },
        resolution: { state: 0 }
    };
    globalThis.RaceBoard?.openState?.(state, { show: true });

    const rowHtml = boxes.map((b) =>
        `<li><strong>${escapeHtml(humourLabel(b.Role))}</strong> — ${escapeHtml(b.Action)} ` +
        `<em>(${escapeHtml(b.Skill)})</em> vs <strong>${escapeHtml(b.Difficulty)}</strong></li>`
    ).join("");
    await postChat(actor, affliction,
        `<p><strong>Treatment — ${escapeHtml(affliction.name)} (${escapeHtml(phaseLabel(phase))})</strong></p>` +
        `<p>Fill all ${boxes.length} boxes to cure. Each attempt takes the stated treatment time, win or lose; failures keep filled boxes and cost time.</p>` +
        `<ol>${rowHtml}</ol>`
    );
    return { boxes, total: boxes.length };
}

/* ---------------------------------------- */
/*  Treatment-board resolution (cure / fail) */
/* ---------------------------------------- */

async function postTreatmentOutcome(actor, diseaseName, isCured, detail, announce) {
    const speaker = ChatMessage.getSpeaker({ actor: actor ?? null });
    const icon = isCured ? "fa-heart-pulse" : "fa-circle-xmark";
    const color = isCured ? "#2e7d32" : "#b3261e";
    const heading = isCured ? "Cured" : "Treatment Failed";
    const content = `<div class="rb-outcome-card">`
        + `<h3 style="margin:0 0 .25rem;color:${color};"><i class="fa-solid ${icon}"></i> ${escapeHtml(diseaseName)} — ${heading}</h3>`
        + (detail ? `<p style="margin:.15rem 0;">${escapeHtml(detail)}</p>` : "")
        + `</div>`;
    const data = { speaker, flavor: `Disease — ${diseaseName} (${heading})`, content };
    if (!announce) data.whisper = ChatMessage.getWhisperRecipients("GM").map((u) => u.id);
    await ChatMessage.create(data);
}

// RaceBoard "disease" resolver: invoked when the GM resolves a treatment board.
//   success → optionally remove (cure) the affliction, post a card, emit disease:cured
//   failure → announce the affliction persists
async function diseaseResolver({ outcome, resolver, options = {} }) {
    const affliction = resolver?.afflictionUuid ? await fromUuid(resolver.afflictionUuid).catch(() => null) : null;
    const actor = affliction?.parent
        ?? (resolver?.actorUuid ? await fromUuid(resolver.actorUuid).catch(() => null) : null);
    const name = resolver?.afflictionName ?? affliction?.name ?? "the affliction";
    const announce = options.announce !== false;

    if (outcome === "failure") {
        await postTreatmentOutcome(actor, name, false, "The treatment fails — the affliction persists.", announce);
        return { outcome: "failure" };
    }

    let detail = "The patient recovers.";
    if (options.apply) {
        if (affliction) {
            await affliction.delete();
            detail = `${name} is cured and cleared from ${actor?.name ?? "the patient"}.`;
        } else {
            detail = "Could not find the affliction to remove — clear it manually.";
        }
    }
    await postTreatmentOutcome(actor, name, true, detail, announce);
    await emitDomainEvent(DOMAIN_EVENTS.DISEASE_CURED, { actor, diseaseName: name, affliction: affliction ?? null });
    return { outcome: "success" };
}

/* ---------------------------------------- */
/*  Chat helper + registration              */
/* ---------------------------------------- */

async function postChat(actor, carrier, content) {
    const speaker = ChatMessage.getSpeaker({ actor: actor ?? carrier?.parent ?? null });
    await ChatMessage.create({ speaker, flavor: carrier?.name ? `Disease — ${carrier.name}` : "Disease", content });
}

// Add a "Treat" button to an actor-owned disease (affliction) item sheet that
// opens the cure race board for its current phase. Only shown on afflictions
// carried by an actor — not on world/compendium disease definitions.
function addTreatmentHeaderButton(app, buttons) {
    const item = app?.object;
    if (item?.system?.template !== DISEASE_TEMPLATE_ID) return;
    if (item?.parent?.documentName !== "Actor") return;
    buttons.unshift({
        class: "open-treatment-board",
        icon: "fas fa-kit-medical",
        label: "Treat",
        onclick: () => {
            void openTreatmentBoard(item.parent, item).catch((error) => {
                console.error(`${MODULE_ID} | Failed to open treatment board`, error);
                ui.notifications.error(`1547 Core: failed to open treatment board. ${error.message}`);
            });
        }
    });
}

export function registerDiseaseService() {
    Hooks.on("getItemSheetHeaderButtons", (app, buttons) => {
        addTreatmentHeaderButton(app, buttons);
    });

    // Register the treatment-board resolver once RaceBoard's API is up (ready).
    Hooks.once("ready", () => {
        const rb = globalThis.RaceBoard;
        if (typeof rb?.registerResolver === "function") {
            rb.registerResolver("disease", diseaseResolver);
        } else {
            console.warn(`${MODULE_ID} | RaceBoard.registerResolver unavailable at ready — disease cure resolution is disabled.`);
        }
    });

    const api = { rollContraction, contractDisease, advanceDiseasePhase, openTreatmentBoard, resolveDisease };
    const coreModule = game.modules.get(MODULE_ID);
    if (coreModule) {
        coreModule.api = coreModule.api ?? {};
        coreModule.api.disease = api;
    }
    globalThis.Disease1547 = api;
}
