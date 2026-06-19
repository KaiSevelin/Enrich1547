import { getItemById, resolveTableByNameOrId } from "./content-registry.js";
import { MODULE_ID, SOURCE_FLAG_SCOPE, RITUAL_TEMPLATE_ID } from "../lib/constants.mjs";
import { readSourceData, isSpellItem, getProps as getSpellProps } from "../lib/foundry-utils.mjs";

// Maps a spell's casting school to the skill rolled for the final cast.
const SCHOOL_SKILL = {
    Alchemy: "Learning Expertise Alchemy",
    Astrology: "Learning Expertise Astrology",
    Divination: "Pagan Expertise Divination",
    Grimoire: "Learning Expertise Occult",
    Knot: "Pagan Expertise Knot",
    Necromancy: "Pagan Expertise Necromancy",
    Religion: "Learning Expertise Religion",
    Wards: "Pagan Expertise Warding"
};

// The final box on every ritual: the actual casting, rolled against the spell's
// school requirements. Satisfiable by ANY one listed school at its level
// (e.g. Blood Border → "Necromancy (2) or Warding (1)").
function buildFinalCastingStep(spell, props) {
    let reqs = Array.isArray(props.SchoolRequirementsTable) ? props.SchoolRequirementsTable : null;
    if (!reqs || !reqs.length) {
        const sd = spell?.flags?.[SOURCE_FLAG_SCOPE]?.sourceData ?? spell?.flags?.[MODULE_ID]?.sourceData;
        if (Array.isArray(sd?.schoolRequirements)) reqs = sd.schoolRequirements;
    }
    const options = (reqs ?? []).map((r) => {
        const skill = SCHOOL_SKILL[String(r?.School ?? "").trim()] ?? String(r?.School ?? "").trim();
        if (!skill) return null;
        const lvl = r?.Level;
        if (lvl !== undefined && lvl !== null && lvl !== "") return `${skill} (${lvl}) (${lvl}d6)`;
        return skill;
    }).filter(Boolean);
    return {
        id: "final-cast",
        sourceKind: "final",
        stepScope: "Mandatory",
        stepType: "FinalCasting",
        stepText: "Complete the working — the final casting.",
        skillCheck: options.join(" or "),
        difficulty: "",
        requiredItem: "",
        timingConstraint: "",
        contactRestriction: "",
        dangerTag: "",
        repeatable: false,
        failureConsequence: "",
        stepNotes: "",
        icon: "fa-hat-wizard",
        tooltip: "",
        required: true
    };
}

function isActorOwnedItem(item) {
    return item?.parent?.documentName === "Actor";
}

export function parseRandomStepRollFormula(formula) {
    const text = String(formula ?? "").trim();
    // Accept "NdM" plus an optional flat modifier, e.g. "1d3+1" or "1d3 - 1".
    const match = /^(\d+)\s*d\s*(\d+)\s*([+-]\s*\d+)?$/i.exec(text);
    if (!match) return null;
    return {
        count: Number.parseInt(match[1], 10),
        faces: Number.parseInt(match[2], 10),
        mod: match[3] ? Number.parseInt(match[3].replace(/\s+/g, ""), 10) : 0
    };
}

// Step types where two requirements would contradict (you can't time a rite to
// both the new and full moon, or perform it in two places). Keep only the first
// of each in a single ritual.
const EXCLUSIVE_STEP_TYPES = new Set(["Environment", "ExactTiming"]);
function dedupeExclusiveSteps(steps) {
    const seen = new Set();
    return steps.filter((step) => {
        const type = step?.stepType;
        if (!EXCLUSIVE_STEP_TYPES.has(type)) return true;
        if (seen.has(type)) return false;
        seen.add(type);
        return true;
    });
}

function rollFormulaCount(formulaText) {
    const parsed = parseRandomStepRollFormula(formulaText);
    if (!parsed) return 0;
    let total = 0;
    for (let index = 0; index < parsed.count; index += 1) {
        total += Math.floor(Math.random() * parsed.faces) + 1;
    }
    total += parsed.mod ?? 0;
    return Math.max(0, total);
}

function normalizeStaticStep(step, index) {
    const scope = String(step?.StepScope ?? "Mandatory").trim() || "Mandatory";
    return {
        id: String(step?.id ?? `static-${index + 1}`),
        sourceKind: "static",
        stepScope: scope,
        stepType: String(step?.StepType ?? "StaticSkill").trim() || "StaticSkill",
        stepText: String(step?.StepText ?? "").trim(),
        skillCheck: String(step?.SkillCheck ?? "").trim(),
        difficulty: String(step?.Difficulty ?? "").trim(),
        requiredItem: String(step?.RequiredItem ?? "").trim(),
        timingConstraint: String(step?.TimingConstraint ?? "").trim(),
        contactRestriction: String(step?.ContactRestriction ?? "").trim(),
        dangerTag: String(step?.DangerTag ?? "").trim(),
        repeatable: Boolean(step?.Repeatable),
        failureConsequence: String(step?.FailureConsequence ?? "").trim(),
        stepNotes: String(step?.StepNotes ?? "").trim(),
        icon: String(step?.Icon ?? "").trim(),
        tooltip: String(step?.Tooltip ?? "").trim(),
        required: scope !== "Optional"
    };
}

function normalizeRandomStep(step, index) {
    const scope = String(step?.stepScope ?? "Optional").trim() || "Optional";
    return {
        id: String(step?.id ?? `rolled-${index + 1}`),
        sourceKind: "rolled",
        stepScope: scope,
        stepType: String(step?.stepType ?? "Random").trim() || "Random",
        stepText: String(step?.stepText ?? "").trim(),
        skillCheck: String(step?.skillCheck ?? "").trim(),
        difficulty: String(step?.difficulty ?? "").trim(),
        requiredItem: String(step?.requiredItem ?? "").trim(),
        timingConstraint: String(step?.timingConstraint ?? "").trim(),
        contactRestriction: String(step?.contactRestriction ?? "").trim(),
        dangerTag: String(step?.dangerTag ?? "").trim(),
        repeatable: Boolean(step?.repeatable),
        failureConsequence: String(step?.failureConsequence ?? "").trim(),
        stepNotes: String(step?.stepNotes ?? "").trim(),
        icon: String(step?.icon ?? "").trim(),
        tooltip: String(step?.tooltip ?? "").trim(),
        required: true
    };
}

export function buildRitualTableRowsFromSteps(steps) {
    return steps.map((step) => ({
        StepType: step.stepType || "Random",
        StepText: step.stepText || "",
        SkillCheck: step.skillCheck || "",
        Difficulty: step.difficulty || "",
        Required: step.required !== false,
        FailureConsequence: step.failureConsequence || ""
    }));
}

function extractConstraintList(steps, key) {
    return steps
        .map((step) => String(step?.[key] ?? "").trim())
        .filter(Boolean)
        .filter((value, index, arr) => arr.indexOf(value) === index);
}

function rollDicePoolSum(parsed) {
    let total = 0;
    for (let index = 0; index < parsed.count; index += 1) {
        total += Math.floor(Math.random() * parsed.faces) + 1;
    }
    return total + (parsed.mod ?? 0);
}

function entryForRoll(pool, sum) {
    return pool.find((entry) => sum >= entry.pickRange[0] && sum <= entry.pickRange[1]) ?? null;
}

// Big d6-pool draw: roll the table's Xd6 sum (pickFormula) and read the entry
// whose `pickRange` band contains it, so common steps on the heavy central
// rolls come up often and rare steps on the tails seldom. Mirrors the compiled
// RollTable exactly. Draws are distinct (a duplicate roll is re-rolled).
function pickDistinctEntries(entries, count, pickFormula) {
    const all = Array.isArray(entries) ? entries : [];
    const pool = all.filter((entry) => Array.isArray(entry?.pickRange) && entry.pickRange.length === 2);
    const parsed = parseRandomStepRollFormula(pickFormula);
    const limit = Math.min(count, pool.length || all.length);

    // Fallback to a uniform draw if the table has no Xd6 ranges/formula.
    if (!parsed || !pool.length) {
        const rest = [...all];
        const picked = [];
        while (rest.length > 0 && picked.length < limit) {
            picked.push(rest.splice(Math.floor(Math.random() * rest.length), 1)[0]);
        }
        return picked;
    }

    const picked = [];
    const used = new Set();
    let guard = 0;
    while (picked.length < limit && guard < 10000) {
        guard += 1;
        const entry = entryForRoll(pool, rollDicePoolSum(parsed));
        if (!entry || used.has(entry)) continue;
        used.add(entry);
        picked.push(entry);
    }
    // Pathological exhaustion: top up with any remaining entries.
    if (picked.length < limit) {
        for (const entry of pool) {
            if (picked.length >= limit) break;
            if (!used.has(entry)) { used.add(entry); picked.push(entry); }
        }
    }
    return picked;
}

export async function generateRitualStepsFromSpell(spell) {
    if (!isSpellItem(spell)) {
        throw new Error("generateRitualStepsFromSpell requires a spell item.");
    }

    const props = getSpellProps(spell);
    // Static steps are authored in props.StaticRitualSteps, but the spell sheet
    // declares that key as an itemContainer, so CSB empties it at runtime. The
    // raw authored array survives in the 1547Core sourceData flag, so fall back
    // to it — otherwise rituals would lose their static (school-requirement) steps.
    let staticData = (Array.isArray(props.StaticRitualSteps) && props.StaticRitualSteps.length)
        ? props.StaticRitualSteps
        : null;
    if (!staticData) {
        const sd = spell?.flags?.[SOURCE_FLAG_SCOPE]?.sourceData
            ?? spell?.flags?.[MODULE_ID]?.sourceData;
        if (Array.isArray(sd?.staticRitualSteps)) staticData = sd.staticRitualSteps;
    }
    const staticSteps = (staticData ?? []).map(normalizeStaticStep);
    const tableRef = String(props.RitualStepTable ?? "").trim();
    const drawFormula = String(props.RandomStepRollFormula ?? "").trim();

    let rolledSteps = [];
    let drawCount = 0;
    if (tableRef && drawFormula) {
        const drawTable = await resolveTableByNameOrId(tableRef);
        if (!drawTable) {
            throw new Error(`Could not resolve ritual step roll table '${tableRef}'.`);
        }
        const tableSource = drawTable.flags?.[SOURCE_FLAG_SCOPE]?.sourceData ?? {};
        const sourceEntries = Array.isArray(tableSource.entries) ? tableSource.entries : [];
        const pickFormula = String(tableSource.pickFormula ?? "").trim();
        drawCount = rollFormulaCount(drawFormula);
        rolledSteps = pickDistinctEntries(sourceEntries, drawCount, pickFormula).map(normalizeRandomStep);
        rolledSteps = dedupeExclusiveSteps(rolledSteps);
    }

    return {
        tableRef,
        drawFormula,
        drawCount,
        // Static steps are the spell's school-casting requirements — a
        // prerequisite to attempt the rite, not a board step. Returned for
        // reference only; the ritual's steps and race board use the random draw.
        staticSteps,
        rolledSteps,
        // Random draws first, then the final casting roll as the last box.
        allSteps: [...rolledSteps, buildFinalCastingStep(spell, props)]
    };
}

function buildGeneratedRitualName(spell) {
    return `${spell.name} Ritual`;
}

export async function createRitualFromSpell(spell, options = {}) {
    if (!isSpellItem(spell)) {
        throw new Error("createRitualFromSpell requires a spell item.");
    }

    const ritualTemplate = getItemById(RITUAL_TEMPLATE_ID);
    if (!ritualTemplate) {
        throw new Error("Ritual template item is not loaded.");
    }

    const generated = await generateRitualStepsFromSpell(spell);
    const props = getSpellProps(spell);
    const allSteps = generated.allSteps;
    const timingConstraints = extractConstraintList(allSteps, "timingConstraint");
    const contactRestrictions = extractConstraintList(allSteps, "contactRestriction");
    const witnessLines = allSteps
        .filter((step) => step.stepType === "Witness")
        .map((step) => step.stepText)
        .filter(Boolean);

    const ritualDoc = {
        name: String(options.name ?? buildGeneratedRitualName(spell)).trim() || buildGeneratedRitualName(spell),
        type: "equippableItem",
        img: options.img ?? spell.img ?? ritualTemplate.img,
        system: {
            body: foundry.utils.deepClone(ritualTemplate.system.body),
            display: foundry.utils.deepClone(ritualTemplate.system.display),
            header: foundry.utils.deepClone(ritualTemplate.system.header),
            hidden: foundry.utils.deepClone(ritualTemplate.system.hidden ?? []),
            modifiers: [],
            template: ritualTemplate._id,
            templateSystemUniqueVersion: ritualTemplate.system.templateSystemUniqueVersion,
            props: {
                Description: String(props.Description ?? "").trim(),
                BaseSpell: spell.name,
                SpellStrength: props.Strength ?? 1,
                Tradition: String(options.tradition ?? "").trim(),
                RitualLineage: String(options.ritualLineage ?? "").trim(),
                Reliability: String(options.reliability ?? "Standard").trim() || "Standard",
                GeneratedFromTable: generated.tableRef,
                RitualStepsTable: buildRitualTableRowsFromSteps(allSteps),
                TimingConstraint: timingConstraints.join("\n"),
                ContactRestriction: contactRestrictions.join("\n"),
                WitnessRequirement: witnessLines.join("\n"),
                FailureTableUsed: String(props.FailureTable ?? "").trim(),
                OutcomeModifier: generated.drawFormula
                    ? `Generated from ${generated.tableRef} with ${generated.drawFormula} -> ${generated.drawCount} rolled step(s).`
                    : "No random ritual steps were added."
            }
        },
        effects: [],
        folder: options.folderId ?? spell.folder?.id ?? null,
        flags: {
            "custom-system-builder": {
                version: ritualTemplate.flags?.["custom-system-builder"]?.version ?? "5.2.0"
            },
            [SOURCE_FLAG_SCOPE]: {
                generatedFromSpellId: spell.id,
                generatedFromSpellName: spell.name,
                generatedSteps: foundry.utils.deepClone(allSteps),
                drawCount: generated.drawCount,
                tableRef: generated.tableRef,
                drawFormula: generated.drawFormula
            }
        },
        items: [],
        ownership: { default: 0 }
    };

    if (options.createDocument === false) {
        return ritualDoc;
    }

    if (isActorOwnedItem(spell)) {
        const actor = spell.parent;
        const [created] = await actor.createEmbeddedDocuments("Item", [{ ...ritualDoc, folder: null }]);
        return created;
    }

    const created = await Item.create(ritualDoc);
    return created;
}

export function registerRitualGenerationService() {
    const moduleApi = game.modules.get(MODULE_ID);
    if (!moduleApi) {
        console.warn(`${MODULE_ID} | registerRitualGenerationService: module not found`);
        return;
    }
    moduleApi.api = moduleApi.api ?? {};
    moduleApi.api.parseRandomStepRollFormula = parseRandomStepRollFormula;
    moduleApi.api.generateRitualStepsFromSpell = generateRitualStepsFromSpell;
    moduleApi.api.createRitualFromSpell = createRitualFromSpell;
}
