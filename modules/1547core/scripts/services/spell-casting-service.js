const MODULE_ID = "1547core";
const SOURCE_FLAG_SCOPE = "1547Core";
const SPELL_TEMPLATE_ID = "2kiWw3Cv5Zk1lZxn";

function readSourceData(doc) {
    return doc?.flags?.[SOURCE_FLAG_SCOPE]?.sourceData ?? doc?.flags?.[MODULE_ID]?.sourceData ?? doc ?? {};
}

function getSpellProps(spell) {
    return spell?.system?.props ?? readSourceData(spell) ?? {};
}

function isSpellItem(item) {
    return item?.system?.template === SPELL_TEMPLATE_ID;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function getDefaultSourceTokenForActor(actor) {
    if (!actor) return null;
    const controlled = (canvas?.tokens?.controlled ?? []).find((token) => token?.actor?.id === actor.id);
    if (controlled?.document) return controlled.document;
    const active = actor.getActiveTokens?.(true, true)?.[0] ?? actor.getActiveTokens?.()[0] ?? null;
    if (active?.documentName === "Token") return active;
    if (active?.document?.documentName === "Token") return active.document;
    return null;
}

function resolveSourceTokenForSpell(spell, explicitSourceToken = null) {
    if (explicitSourceToken?.documentName === "Token") return explicitSourceToken;
    if (explicitSourceToken?.document?.documentName === "Token") return explicitSourceToken.document;

    const actor = spell?.parent?.documentName === "Actor" ? spell.parent : null;
    if (actor) {
        const actorToken = getDefaultSourceTokenForActor(actor);
        if (actorToken) return actorToken;
    }

    const controlled = canvas?.tokens?.controlled ?? [];
    if (controlled.length === 1) {
        return controlled[0]?.document ?? null;
    }
    return null;
}

function normalizeStaticStep(step, index) {
    return {
        id: String(step?.id ?? `step-${index + 1}`),
        scope: String(step?.StepScope ?? "Mandatory").trim() || "Mandatory",
        alternativeGroup: String(step?.AlternativeGroup ?? "").trim(),
        stepType: String(step?.StepType ?? "").trim(),
        stepText: String(step?.StepText ?? "").trim(),
        skillCheck: String(step?.SkillCheck ?? "").trim(),
        difficulty: Number.parseInt(String(step?.Difficulty ?? "").trim(), 10) || 0,
        stepNotes: String(step?.StepNotes ?? "").trim()
    };
}

function skillNameToPropKey(skillName) {
    const compact = String(skillName ?? "").replace(/[^A-Za-z0-9]+/g, "");
    return compact ? `Skills_${compact}` : "";
}

function parseSkillAlternatives(skillCheck) {
    return String(skillCheck ?? "")
        .split(/\s+or\s+/i)
        .map((entry) => String(entry ?? "").trim())
        .filter(Boolean);
}

function getActorSkillLevel(actor, skillName) {
    const propKey = skillNameToPropKey(skillName);
    if (!propKey) return 0;
    const raw = actor?.system?.props?.[propKey];
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof raw === "string" && raw.trim() !== "" && Number.isFinite(Number(raw))) return Number(raw);
    return 0;
}

function evaluateSkillAlternatives(actor, skillCheck, difficulty) {
    const alternatives = parseSkillAlternatives(skillCheck);
    const ranked = alternatives.map((skillName) => ({
        skillName,
        propKey: skillNameToPropKey(skillName),
        level: getActorSkillLevel(actor, skillName)
    })).sort((a, b) => b.level - a.level);
    const best = ranked[0] ?? { skillName: "", propKey: "", level: 0 };
    return {
        alternatives: ranked,
        chosenSkill: best.skillName,
        chosenPropKey: best.propKey,
        chosenLevel: best.level,
        difficulty,
        passed: best.level >= difficulty
    };
}

function evaluateCastingRequirements(spell, actor) {
    const props = getSpellProps(spell);
    const staticSteps = Array.isArray(props.StaticRitualSteps)
        ? props.StaticRitualSteps.map(normalizeStaticStep)
        : [];
    const relevant = staticSteps.filter((step) =>
        step.scope !== "Optional"
        && step.skillCheck
        && step.difficulty > 0
    );

    const mandatoryResults = [];
    const alternativeGroups = new Map();

    for (const step of relevant) {
        const evaluation = evaluateSkillAlternatives(actor, step.skillCheck, step.difficulty);
        const result = {
            stepId: step.id,
            stepType: step.stepType,
            stepText: step.stepText,
            alternativeGroup: step.scope === "Alternative" ? (step.alternativeGroup || "Alternative") : "",
            ...evaluation
        };
        if (step.scope === "Alternative") {
            const key = result.alternativeGroup;
            const group = alternativeGroups.get(key) ?? [];
            group.push(result);
            alternativeGroups.set(key, group);
        } else {
            mandatoryResults.push(result);
        }
    }

    const alternativeResults = Array.from(alternativeGroups.entries()).map(([groupName, entries]) => {
        const chosen = [...entries].sort((a, b) => {
            if (a.passed !== b.passed) return a.passed ? -1 : 1;
            return b.chosenLevel - a.chosenLevel;
        })[0] ?? null;
        return {
            groupName,
            entries,
            chosen,
            passed: Boolean(chosen?.passed)
        };
    });

    const passed = mandatoryResults.every((entry) => entry.passed) && alternativeResults.every((entry) => entry.passed);
    return {
        passed,
        mandatoryResults,
        alternativeResults
    };
}

function buildCastingSummaryHtml(spell, sourceToken, evaluation, outcome, failureResultText = "") {
    const requirementItems = [
        ...evaluation.mandatoryResults.map((entry) =>
            `<li>${escapeHtml(entry.stepText || entry.chosenSkill || "Requirement")}: <strong>${escapeHtml(entry.chosenSkill || "Unknown skill")}</strong> ${entry.chosenLevel}/${entry.difficulty} ${entry.passed ? "pass" : "fail"}</li>`
        ),
        ...evaluation.alternativeResults.map((group) =>
            `<li>${escapeHtml(group.groupName)}: <strong>${escapeHtml(group.chosen?.chosenSkill || "No valid skill")}</strong> ${group.chosen?.chosenLevel ?? 0}/${group.chosen?.difficulty ?? 0} ${group.passed ? "pass" : "fail"}</li>`
        )
    ].join("");

    const failureBlock = failureResultText
        ? `<p><strong>Failure:</strong> ${escapeHtml(failureResultText)}</p>`
        : "";

    return `
        <div class="chat-card">
            <header class="card-header">
                <h3>${escapeHtml(spell.name)}</h3>
            </header>
            <div class="card-content">
                <p><strong>Caster:</strong> ${escapeHtml(sourceToken?.name ?? spell.parent?.name ?? "Unknown")}</p>
                <p><strong>Cast Result:</strong> ${escapeHtml(outcome)}</p>
                <ul>${requirementItems || "<li>No static skill gates.</li>"}</ul>
                ${failureBlock}
            </div>
        </div>
    `;
}

async function postCastingSummaryToChat(spell, sourceToken, evaluation, outcome, failureResultText = "") {
    const speaker = ChatMessage.getSpeaker({ actor: sourceToken?.actor ?? spell.parent ?? null, token: sourceToken ?? null });
    await ChatMessage.create({
        speaker,
        flavor: `${spell.name} - Cast Spell`,
        content: buildCastingSummaryHtml(spell, sourceToken, evaluation, outcome, failureResultText)
    });
}

async function resolveFailureTable(tableRef) {
    const ref = String(tableRef ?? "").trim();
    if (!ref) return null;
    return game.tables.get(ref)
        ?? game.tables.find((table) => table.flags?.[SOURCE_FLAG_SCOPE]?.sourceKey === ref)
        ?? game.tables.find((table) => table.name === ref)
        ?? await fromUuid(ref).catch(() => null);
}

async function rollSpellFailure(spell) {
    const props = getSpellProps(spell);
    const failureProfile = String(props.FailureProfile ?? "Minor").trim() || "Minor";
    const failureTableRef = String(props.FailureTable ?? `SpellFailure_${failureProfile}`).trim();
    const table = await resolveFailureTable(failureTableRef);
    if (!table) {
        return {
            ok: false,
            failureProfile,
            failureTableRef,
            text: `No failure table '${failureTableRef}' could be found.`
        };
    }
    const rollResult = await table.roll();
    const result = Array.isArray(rollResult.results) ? rollResult.results[0] : rollResult.results;
    const text = String(result?.text ?? "").trim() || "The spell fails, but the table returned no text.";
    return {
        ok: true,
        failureProfile,
        failureTableRef,
        text,
        table,
        rollResult
    };
}

export async function castSpellItem(spell, options = {}) {
    if (!isSpellItem(spell)) {
        throw new Error("castSpellItem requires a spell item.");
    }

    const sourceToken = resolveSourceTokenForSpell(spell, options.sourceToken);
    if (!sourceToken?.actor) {
        throw new Error("Select or control a source token before casting this spell.");
    }

    const evaluation = evaluateCastingRequirements(spell, sourceToken.actor);
    if (!evaluation.passed) {
        const failure = await rollSpellFailure(spell);
        await postCastingSummaryToChat(spell, sourceToken, evaluation, "Failure", failure.text);
        return {
            ok: false,
            outcome: "failure",
            sourceTokenId: sourceToken.id ?? null,
            evaluation,
            failure
        };
    }

    const moduleApi = game.modules.get(MODULE_ID)?.api ?? {};
    if (typeof moduleApi.resolveUsageEffectsFromCarrier !== "function") {
        throw new Error("Usage-effect resolver API is not available.");
    }

    const resolution = await moduleApi.resolveUsageEffectsFromCarrier(spell, {
        sourceToken,
        targetTokens: options.targetTokens,
        targetItems: options.targetItems,
        targetItem: options.targetItem
    });
    await postCastingSummaryToChat(spell, sourceToken, evaluation, "Success");
    return {
        ok: resolution.ok,
        outcome: "success",
        sourceTokenId: sourceToken.id ?? null,
        evaluation,
        resolution
    };
}

async function handleCastSpellClick(item) {
    const result = await castSpellItem(item);
    if (result.outcome === "success") {
        ui.notifications.info(`1547 Core: cast '${item.name}'.`);
        return;
    }
    ui.notifications.warn(`1547 Core: '${item.name}' failed and rolled on its failure table.`);
}

function addCastSpellHeaderButton(app, buttons) {
    const item = app?.object;
    if (!isSpellItem(item)) return;
    buttons.unshift({
        class: "cast-spell",
        icon: "fas fa-hat-wizard",
        label: "Cast Spell",
        onclick: () => {
            void handleCastSpellClick(item).catch((error) => {
                console.error(`${MODULE_ID} | Failed to cast spell`, error);
                ui.notifications.error(`1547 Core: failed to cast spell. ${error.message}`);
            });
        }
    });
}

export function registerSpellCastingService() {
    Hooks.on("getItemSheetHeaderButtons", (app, buttons) => {
        addCastSpellHeaderButton(app, buttons);
    });

    const moduleApi = game.modules.get(MODULE_ID);
    if (!moduleApi) {
        console.warn(`${MODULE_ID} | registerSpellCastingService: module not found`);
        return;
    }
    moduleApi.api = moduleApi.api ?? {};
    moduleApi.api.castSpellItem = castSpellItem;
}
