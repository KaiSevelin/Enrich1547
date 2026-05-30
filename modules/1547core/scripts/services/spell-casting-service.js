import { isManualSpellItem } from "./spell-manual-support.js";

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

function slugify(value) {
    return String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
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

function buildCastingSummaryHtml(spell, sourceToken, evaluation, outcome, detailText = "") {
    const requirementItems = [
        ...evaluation.mandatoryResults.map((entry) =>
            `<li>${escapeHtml(entry.stepText || entry.chosenSkill || "Requirement")}: <strong>${escapeHtml(entry.chosenSkill || "Unknown skill")}</strong> ${entry.chosenLevel}/${entry.difficulty} ${entry.passed ? "pass" : "fail"}</li>`
        ),
        ...evaluation.alternativeResults.map((group) =>
            `<li>${escapeHtml(group.groupName)}: <strong>${escapeHtml(group.chosen?.chosenSkill || "No valid skill")}</strong> ${group.chosen?.chosenLevel ?? 0}/${group.chosen?.difficulty ?? 0} ${group.passed ? "pass" : "fail"}</li>`
        )
    ].join("");

    const detailBlock = detailText
        ? `<p><strong>Details:</strong> ${escapeHtml(detailText)}</p>`
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
                ${detailBlock}
            </div>
        </div>
    `;
}

async function postCastingSummaryToChat(spell, sourceToken, evaluation, outcome, detailText = "") {
    const speaker = ChatMessage.getSpeaker({ actor: sourceToken?.actor ?? spell.parent ?? null, token: sourceToken ?? null });
    await ChatMessage.create({
        speaker,
        flavor: `${spell.name} - Cast Spell`,
        content: buildCastingSummaryHtml(spell, sourceToken, evaluation, outcome, detailText)
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

function getPrimaryStatFormula(actor, statLabel, bonusDice = 0) {
    const props = actor?.system?.props ?? {};
    const safeLabel = String(statLabel ?? "").trim();
    const diceKey = `Stats_${safeLabel}Dice`;
    const modKey = `Stats_${safeLabel}Mod`;
    const dice = Math.max(0, Number(props?.[diceKey] ?? 0) + Math.max(0, Number(bonusDice) || 0));
    const mod = Number(props?.[modKey] ?? 0);
    if (dice <= 0 && mod === 0) return "0";
    if (mod === 0) return `${dice}d6`;
    return `${dice}d6 + ${mod}`;
}

async function evaluateRollFormula(formula) {
    const safeFormula = String(formula ?? "").trim() || "0";
    const roll = await new Roll(safeFormula).evaluate({ async: true });
    return {
        formula: safeFormula,
        total: Number(roll.total ?? 0) || 0,
        roll,
    };
}

function getSelectedTargetTokens(options = {}) {
    if (Array.isArray(options.targetTokens) && options.targetTokens.length) {
        return options.targetTokens
            .map((token) => token?.documentName === "Token" ? token : token?.document)
            .filter((token) => token?.documentName === "Token");
    }
    return Array.from(game.user?.targets ?? [])
        .map((token) => token?.documentName === "Token" ? token : token?.document)
        .filter((token) => token?.documentName === "Token");
}

function requireTargetToken(spell, options = {}) {
    const targetToken = getSelectedTargetTokens(options)[0] ?? null;
    if (!targetToken?.actor) {
        throw new Error(`Select a target token before casting '${spell.name}'.`);
    }
    return targetToken;
}

async function rollManualContest({
    sourceActor,
    targetActor = null,
    sourceStat = "Power",
    sourceBonusDice = 0,
    targetStat = "Power",
    targetFormula = "",
}) {
    const sourceFormula = getPrimaryStatFormula(sourceActor, sourceStat, sourceBonusDice);
    const resolvedTargetFormula = String(targetFormula ?? "").trim() || getPrimaryStatFormula(targetActor, targetStat, 0);
    const [sourceRoll, defendingRoll] = await Promise.all([
        evaluateRollFormula(sourceFormula),
        evaluateRollFormula(resolvedTargetFormula),
    ]);
    return {
        sourceRoll,
        targetRoll: defendingRoll,
        success: sourceRoll.total > defendingRoll.total,
    };
}

async function resolveSupportTable(tableRef) {
    const ref = String(tableRef ?? "").trim();
    if (!ref) return null;
    return game.tables.get(ref)
        ?? game.tables.find((table) => table.flags?.[SOURCE_FLAG_SCOPE]?.sourceKey === ref)
        ?? game.tables.find((table) => table.name === ref)
        ?? await fromUuid(ref).catch(() => null);
}

async function rollSupportTable(tableRef) {
    const table = await resolveSupportTable(tableRef);
    if (!table) {
        return {
            ok: false,
            text: `No support table '${tableRef}' could be found.`,
            table: null,
        };
    }
    const rollResult = await table.roll();
    const result = Array.isArray(rollResult.results) ? rollResult.results[0] : rollResult.results;
    const text = String(result?.text ?? "").trim() || "The table returned no text.";
    return {
        ok: true,
        text,
        table,
        rollResult,
    };
}

function buildEmptySpellEffectData(spell, effectSubtype, targetDoc, durationType = "", durationValue = "") {
    const duration = !durationType || /^instant$/i.test(durationType)
        ? {}
        : {
            startTime: game?.time?.worldTime ?? 0,
            label: durationValue ? `${durationType} ${durationValue}` : durationType
        };

    return {
        name: `${spell.name}: ${effectSubtype}`,
        img: spell.img ?? "icons/svg/aura.svg",
        origin: spell.uuid ?? null,
        disabled: false,
        duration,
        statuses: [slugify(effectSubtype)],
        flags: {
            [MODULE_ID]: {
                usageEffect: {
                    EffectType: "Status",
                    EffectSubtype: effectSubtype,
                    Description: effectSubtype,
                    DurationType: durationType,
                    DurationValue: durationValue,
                    Visible: true,
                },
                sourceItemId: spell.id ?? null,
                sourceItemName: spell.name ?? "",
                sourceActorId: spell.parent?.id ?? null,
                targetActorId: targetDoc?.documentName === "Actor" ? (targetDoc.id ?? null) : null,
                targetItemId: targetDoc?.documentName === "Item" ? (targetDoc.id ?? null) : null,
                targetDocumentType: targetDoc?.documentName ?? null,
                appliedOutcome: "success",
                effectType: "Status",
                effectSubtype,
            }
        },
        changes: [],
    };
}

async function applyEmptySpellEffectShell(spell, targetDoc, effectSubtype, durationType = "", durationValue = "") {
    if (!targetDoc?.createEmbeddedDocuments) {
        return { applied: false, note: `${targetDoc?.name ?? "Target"} cannot receive active effects.` };
    }
    const effectData = buildEmptySpellEffectData(spell, effectSubtype, targetDoc, durationType, durationValue);
    await targetDoc.createEmbeddedDocuments("ActiveEffect", [effectData]);
    return { applied: true, note: `Applied empty effect shell '${effectSubtype}'.` };
}

async function applyNumericPropDelta(targetDoc, path, delta) {
    const current = Number(foundry.utils.getProperty(targetDoc, path) ?? 0);
    const next = Math.max(0, current + delta);
    await targetDoc.update({ [path]: next });
    return next;
}

function formatContestResultText(label, contest, successText, failureText) {
    const base = `${label}: ${contest.sourceRoll.formula} = ${contest.sourceRoll.total} vs ${contest.targetRoll.formula} = ${contest.targetRoll.total}.`;
    return `${base} ${contest.success ? successText : failureText}`;
}

async function resolveManualSpell(spell, sourceToken, options = {}) {
    const props = getSpellProps(spell);
    const sourceActor = sourceToken.actor;
    switch (spell.name) {
        case "Angelic Boon": {
            const supportTableRef = String(props.SupportRollTable ?? "").trim();
            const support = await rollSupportTable(supportTableRef);
            return {
                ok: support.ok,
                outcome: "manual",
                detailText: support.ok
                    ? `Rolled on ${support.table?.name ?? supportTableRef}: ${support.text}`
                    : support.text,
                manualResolved: true,
            };
        }
        case "Auspicious Timing":
            return {
                ok: true,
                outcome: "manual",
                detailText: "Resolve this blessing manually. It grants advantage during a chosen turn or moment.",
                manualResolved: true,
            };
        case "Banish":
        case "Bind":
        case "Command":
        case "Exorcism": {
            const targetToken = requireTargetToken(spell, options);
            const sourceBonusDice = ["Banish", "Command"].includes(spell.name) ? 2 : 1;
            const contest = await rollManualContest({
                sourceActor,
                targetActor: targetToken.actor,
                sourceStat: "Power",
                sourceBonusDice,
                targetStat: "Power",
            });
            const detailText = formatContestResultText(
                spell.name,
                contest,
                "The spell takes hold; apply the supernatural consequence manually.",
                "The target resists the spell."
            );
            return {
                ok: true,
                outcome: "manual",
                detailText,
                manualResolved: true,
            };
        }
        case "Black Sleep":
            return {
                ok: true,
                outcome: "manual",
                detailText: "Keep this spell manual for now. Apply sleep or torpor effects by table judgment.",
                manualResolved: true,
            };
        case "Curse of Withering": {
            const targetToken = requireTargetToken(spell, options);
            const nextMax = await applyNumericPropDelta(targetToken.actor, "system.props.MaxHitPoints", -1);
            const shell = await applyEmptySpellEffectShell(spell, targetToken.actor, "Withering", "Permanent");
            return {
                ok: true,
                outcome: "manual",
                detailText: `Reduced Max Hit Points to ${nextMax}. ${shell.note} Further recurring decay is manual.`,
                manualResolved: true,
            };
        }
        case "Death Knots": {
            const targetToken = requireTargetToken(spell, options);
            const nextMax = await applyNumericPropDelta(targetToken.actor, "system.props.MaxHitPoints", -1);
            const shell = await applyEmptySpellEffectShell(spell, targetToken.actor, "Doomed", "Permanent");
            return {
                ok: true,
                outcome: "manual",
                detailText: `Reduced Max Hit Points to ${nextMax}. ${shell.note} Later deductions or doom consequences are manual.`,
                manualResolved: true,
            };
        }
        case "Evil Eye": {
            const targetToken = requireTargetToken(spell, options);
            const contest = await rollManualContest({
                sourceActor,
                targetActor: targetToken.actor,
                sourceStat: "Power",
                targetStat: "Power",
            });
            if (!contest.success) {
                return {
                    ok: true,
                    outcome: "manual",
                    detailText: formatContestResultText("Evil Eye", contest, "The curse takes hold.", "The target resists the curse."),
                    manualResolved: true,
                };
            }
            const damageRoll = await evaluateRollFormula("1d3");
            const nextHp = await applyNumericPropDelta(targetToken.actor, "system.props.CurrentHitPoints", -damageRoll.total);
            return {
                ok: true,
                outcome: "manual",
                detailText: `${formatContestResultText("Evil Eye", contest, "The curse bites.", "The target resists.")} Target loses ${damageRoll.total} HP and is now at ${nextHp}.`,
                manualResolved: true,
            };
        }
        case "Faith Manipulation": {
            const targetToken = requireTargetToken(spell, options);
            const lossRoll = await evaluateRollFormula("1d3");
            const nextSpent = await applyNumericPropDelta(targetToken.actor, "system.props.SpentFaithPoints", lossRoll.total);
            const available = Number(targetToken.actor.system?.props?.AvailableFaithPoints ?? 0);
            return {
                ok: true,
                outcome: "manual",
                detailText: `Target loses ${lossRoll.total} Faith Points. Spent Faith Points is now ${nextSpent}; available faith now reads ${available}.`,
                manualResolved: true,
            };
        }
        case "Humoral Rebalancing":
            return {
                ok: true,
                outcome: "manual",
                detailText: "Resolve the cleansing manually by removing the relevant harmful effects.",
                manualResolved: true,
            };
        case "Limbsnare":
            return {
                ok: true,
                outcome: "manual",
                detailText: "Resolve the restraint manually for now. No direct data or active-effect payload is applied in this pass.",
                manualResolved: true,
            };
        case "Night Riding": {
            const targetToken = requireTargetToken(spell, options);
            const contest = await rollManualContest({
                sourceActor,
                targetActor: targetToken.actor,
                sourceStat: "Power",
                sourceBonusDice: 1,
                targetStat: "Faith",
            });
            if (!contest.success) {
                return {
                    ok: true,
                    outcome: "manual",
                    detailText: formatContestResultText("Night Riding", contest, "The nightly oppression takes hold.", "The target resists the nightly oppression."),
                    manualResolved: true,
                };
            }
            const damageRoll = await evaluateRollFormula("1d3");
            const nextHp = await applyNumericPropDelta(targetToken.actor, "system.props.CurrentHitPoints", -damageRoll.total);
            return {
                ok: true,
                outcome: "manual",
                detailText: `${formatContestResultText("Night Riding", contest, "The nightly oppression takes hold.", "The target resists.")} Target loses ${damageRoll.total} HP and is now at ${nextHp}. Later oppression is manual.`,
                manualResolved: true,
            };
        }
        case "Nigredo": {
            return {
                ok: true,
                outcome: "manual",
                detailText: "Nigredo remains manual in this pass. Apply the step losses by judgment or in a later automation pass.",
                manualResolved: true,
            };
        }
        case "Possess": {
            const targetToken = requireTargetToken(spell, options);
            const contest = await rollManualContest({
                sourceActor,
                targetActor: targetToken.actor,
                sourceStat: "Power",
                targetStat: "Faith",
            });
            if (!contest.success) {
                return {
                    ok: true,
                    outcome: "manual",
                    detailText: formatContestResultText("Possess", contest, "Possession takes hold.", "The target resists possession."),
                    manualResolved: true,
                };
            }
            const shell = await applyEmptySpellEffectShell(spell, targetToken.actor, "Possessed", "Scene", "");
            return {
                ok: true,
                outcome: "manual",
                detailText: `${formatContestResultText("Possess", contest, "Possession takes hold.", "The target resists possession.")} ${shell.note} Control remains manual.`,
                manualResolved: true,
            };
        }
        case "Refusal Rite":
            return {
                ok: true,
                outcome: "manual",
                detailText: "Keep this rite manual for now. Resolve the refusal or severance by table judgment.",
                manualResolved: true,
            };
        case "Witch's Ladder":
            return {
                ok: true,
                outcome: "manual",
                detailText: "This is a manual combo spell for now. Use it to justify or combine knot effects at the table.",
                manualResolved: true,
            };
        default:
            return {
                ok: true,
                outcome: "manual",
                detailText: "This spell is marked manual and does not resolve usage effects in this pass.",
                manualResolved: true,
            };
    }
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

    if (isManualSpellItem(spell)) {
        const manualResolution = await resolveManualSpell(spell, sourceToken, options);
        await postCastingSummaryToChat(spell, sourceToken, evaluation, "Success", manualResolution.detailText ?? "");
        return {
            ok: manualResolution.ok,
            outcome: "success",
            sourceTokenId: sourceToken.id ?? null,
            evaluation,
            manualResolution,
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
