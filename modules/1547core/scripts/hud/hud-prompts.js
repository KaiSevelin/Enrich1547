export function buildReactionPrompt(deps = {}) {
    const {
        getActiveReactionWindow,
        getReactionCountdownText,
        getSelectedReactionChoiceId,
        normalizeReactionChoiceId,
        getManeuverCostSummary,
        getManeuverEffectSummary,
        getManeuverTimingSummary,
        buildManeuverDetailLine,
        escapeHtml,
    } = deps;

    const reactionWindow = getActiveReactionWindow?.();
    if (!reactionWindow) return "";

    const actorName = reactionWindow.actor?.name ?? "";
    const targetName = reactionWindow.target?.name ?? "";
    let actorTargetSummary = "";
    if (actorName && targetName) {
        actorTargetSummary = `${actorName} -> ${targetName}`;
    } else if (actorName) {
        actorTargetSummary = actorName;
    } else if (targetName) {
        actorTargetSummary = targetName;
    }

    const summaryParts = [
        reactionWindow.trigger === "attack" ? "Attack Reaction" : "Threat Reaction",
        actorTargetSummary,
        `Closes in ${getReactionCountdownText?.(reactionWindow) ?? "0.0s"}`,
        Array.isArray(reactionWindow.candidates) && reactionWindow.candidates.length ? `${reactionWindow.candidates.length} option${reactionWindow.candidates.length === 1 ? "" : "s"}` : ""
    ].filter(Boolean);

    const selectedId = getSelectedReactionChoiceId?.();
    const candidateButtons = (Array.isArray(reactionWindow.candidates) ? reactionWindow.candidates : []).map((candidate) => {
        const choiceId = normalizeReactionChoiceId?.(candidate) ?? "";
        const label = candidate?.name || choiceId || "Reaction";
        const isDisabled = candidate?.legal === false;
        const isSelected = selectedId === choiceId;
        const activeClass = isSelected ? " is-active" : "";
        const disabledAttr = isDisabled ? " disabled" : "";
        const firstReason = Array.isArray(candidate?.reasons) ? String(candidate.reasons[0] ?? "").trim() : "";
        const subtitleParts = [
            getManeuverCostSummary?.(candidate),
            getManeuverEffectSummary?.(candidate),
            [candidate?.usage, candidate?.type].filter(Boolean).join(" - ")
        ].filter(Boolean);
        const subtitle = subtitleParts.join(" | ") || (isDisabled ? firstReason : getManeuverTimingSummary?.(candidate) || "");
        const detail = buildManeuverDetailLine?.(candidate) || "";
        const tooltip = [firstReason, subtitle, detail].filter(Boolean).join(" | ");
        return `
            <button
                type="button"
                class="hud-mini-button${activeClass}"
                data-hud-reaction-choice="${escapeHtml(choiceId)}"
                title="${escapeHtml(tooltip)}"
                aria-pressed="${isSelected ? "true" : "false"}"
                ${disabledAttr}
            >
                ${escapeHtml(label)}
                <span class="hud-mini-button-sub">${escapeHtml(subtitle)}</span>
                ${detail ? `<span class="hud-mini-button-sub">${escapeHtml(detail)}</span>` : ""}
            </button>
        `;
    }).join("");

    return `
        <section class="hud-tree-block hud-reaction-banner">
            <div class="hud-section-title">Reaction Window</div>
            <div class="hud-row-main">${escapeHtml(summaryParts[0] ?? "Reaction")}</div>
            <div class="hud-row-sub">${escapeHtml(summaryParts.slice(1).join(" - "))}</div>
            <div class="hud-chip-row hud-reaction-actions">
                ${candidateButtons ? candidateButtons : '<span class="hud-empty-pill">No legal reactions</span>'}
                ${selectedId ? '<button type="button" class="hud-mini-button is-active" data-hud-reaction-commit>Commit</button>' : ''}
                <button type="button" class="hud-mini-button" data-hud-reaction-pass>Pass</button>
            </div>
        </section>
    `;
}

export function buildDamageTakenPrompt(deps = {}) {
    const {
        getActiveDamageTakenWindow,
        escapeHtml,
    } = deps;

    const damageWindow = getActiveDamageTakenWindow?.();
    if (!damageWindow) return "";

    const attackerName = damageWindow.pendingAttack?.actor?.name ?? "";
    const defenderName = damageWindow.pendingAttack?.target?.name ?? "";
    const summaryParts = [
        "Damage Taken",
        attackerName && defenderName ? `${attackerName} -> ${defenderName}` : (attackerName || defenderName),
        Number.isFinite(Number(damageWindow.damageApplied)) ? `Damage ${damageWindow.damageApplied}` : "",
        Number.isFinite(Number(damageWindow.hitPointUpdate?.currentHitPoints))
            ? `HP ${damageWindow.hitPointUpdate.currentHitPoints}`
            : ""
    ].filter(Boolean);

    const defenseSummary = [
        Number(damageWindow.defenseModifiers?.addArmorDice ?? 0) > 0 ? `+${damageWindow.defenseModifiers.addArmorDice} armor` : "",
        Number(damageWindow.defenseModifiers?.reduceDamageTaken ?? 0) > 0 ? `-${damageWindow.defenseModifiers.reduceDamageTaken} damage` : "",
        damageWindow.defenseModifiers?.safeCounterattack ? "Safe counterattack" : "",
        String(damageWindow.defenseFollowUpState?.lockedParryingWeaponUntil ?? "").trim() ? `Parry lock: ${damageWindow.defenseFollowUpState.lockedParryingWeaponUntil}` : ""
    ].filter(Boolean).join(" | ");

    const selectedReactionName = damageWindow.selectedReaction?.name ?? damageWindow.defenseReaction?.name ?? "";

    return `
        <section class="hud-tree-block hud-reaction-banner">
            <div class="hud-section-title">Defense Summary</div>
            <div class="hud-row-main">${escapeHtml(summaryParts[0] ?? "Defense")}</div>
            <div class="hud-row-sub">${escapeHtml(summaryParts.slice(1).join(" - "))}</div>
            ${selectedReactionName ? `<div class="hud-row-sub">${escapeHtml(selectedReactionName)}</div>` : ""}
            ${defenseSummary ? `<div class="hud-row-sub">${escapeHtml(defenseSummary)}</div>` : ""}
            <div class="hud-chip-row hud-reaction-actions">
                ${damageWindow.defenseModifiers?.safeCounterattack && typeof damageWindow.commitSafeCounterattack === "function" ? `<button type="button" class="hud-mini-button is-active" data-hud-safe-counterattack>Safe Counterattack</button>` : ""}
                <button type="button" class="hud-mini-button" data-hud-damage-taken-close>Close</button>
            </div>
        </section>
    `;
}

export function buildPostManeuverPrompt(deps = {}) {
    const {
        getActivePostManeuverWindow,
        getSelectedPostManeuverId,
        normalizePostManeuverChoiceId,
        buildManeuverSummaryLine,
        buildManeuverDetailLine,
        escapeHtml,
    } = deps;

    const postWindow = getActivePostManeuverWindow?.();
    if (!postWindow) return "";

    const actorName = postWindow.actor?.name ?? "";
    const targetName = postWindow.target?.name ?? "";
    const summaryParts = [
        postWindow.side === "defender" ? "Defender Post Maneuver" : "Attacker Post Maneuver",
        actorName && targetName ? `${actorName} -> ${targetName}` : (actorName || targetName),
        Number.isFinite(Number(postWindow.currentCriticalPoints)) ? `Crit ${postWindow.currentCriticalPoints}` : ""
    ].filter(Boolean);

    const selectedId = getSelectedPostManeuverId?.(postWindow.id);
    const choiceButtons = (Array.isArray(postWindow.legalPostManeuvers) ? postWindow.legalPostManeuvers : []).map((candidate) => {
        const choiceId = normalizePostManeuverChoiceId?.(candidate) ?? "";
        const activeClass = selectedId === choiceId ? " is-active" : "";
        const subtitle = buildManeuverSummaryLine?.(candidate) || "";
        const detail = buildManeuverDetailLine?.(candidate) || "";
        return `
            <button
                type="button"
                class="hud-mini-button${activeClass}"
                data-hud-post-choice="${escapeHtml(choiceId)}"
            >
                ${escapeHtml((candidate?.name ?? choiceId) || "Post Maneuver")}
                <span class="hud-mini-button-sub">${escapeHtml(subtitle)}</span>
                ${detail ? `<span class="hud-mini-button-sub">${escapeHtml(detail)}</span>` : ""}
            </button>
        `;
    }).join("");

    return `
        <section class="hud-tree-block hud-reaction-banner">
            <div class="hud-section-title">Post Maneuver Window</div>
            <div class="hud-row-main">${escapeHtml(summaryParts[0] ?? "Post Maneuver")}</div>
            <div class="hud-row-sub">${escapeHtml(summaryParts.slice(1).join(" - "))}</div>
            <div class="hud-chip-row hud-reaction-actions">
                ${choiceButtons || '<span class="hud-empty-pill">No legal post maneuvers</span>'}
                ${selectedId ? '<button type="button" class="hud-mini-button is-active" data-hud-post-commit>Commit</button>' : ''}
                <button type="button" class="hud-mini-button" data-hud-post-pass>Pass</button>
            </div>
        </section>
    `;
}
