/**
 * combat/post-maneuver-effects.mjs (ADR-0004, extracted from the orchestrator)
 *
 * The post-maneuver effect interpreter: runs a committed critical maneuver's
 * effectData — condition apply, rotate-target, push-with-wall-stop, Core
 * Restore, Convert (crit → damage), follow-up safe attack. Phased per
 * ADR-0003: all Foundry writes go through `run({phase, patches})`; the pure
 * fragments (push path stepping, rotation arithmetic, Convert re-match math,
 * the card describer) are exported for direct unit tests.
 *
 * Ruling 2026-07-11: rotate-target and push are automated (the easy subset);
 * disarm, swallow, place-adjacent and choose-one stay "(GM applies)".
 *
 * Foundry-glue deps (ADR-0002 DI convention), injected by the orchestrator:
 *   postCard(actor, content)             — chat card with actor speaker
 *   applyDamageAwaited(target, amount)   — planApplyDamage + awaitRemote apply;
 *                                          returns the plan result (Convert's
 *                                          card reads HP from it)
 *   declareAttack(args)                  — follow-up safe attack
 *   getActorActiveTokenDocument(actor)   — token doc on the active scene
 *   gridSize()                           — canvas grid px
 *   buildCollisionTester(tokenDoc)       — (fromCenter, toCenter) → blocked?
 */

export function postManeuverConditionName(effect = {}) {
    return String(effect.applyCondition ?? effect.upgradeCondition ?? "").trim();
}

export function describePostManeuverEffect(effect = {}) {
    const parts = [];
    if (effect.createSecondSafeAttack || effect.createFreeSafeAttack) parts.push("Follow-up safe attack");
    const condition = postManeuverConditionName(effect);
    if (condition) parts.push(`Applies condition: <strong>${condition}</strong>`);
    if (Number(effect.addDisadvantage ?? 0) > 0) parts.push(`+${effect.addDisadvantage} disadvantage`);
    if (Number(effect.addDisadvantageToTargetAttack ?? 0) > 0) parts.push(`+${effect.addDisadvantageToTargetAttack} disadvantage to target's attacks`);
    if (Number(effect.addDisadvantageToTargetDefense ?? 0) > 0) parts.push(`+${effect.addDisadvantageToTargetDefense} disadvantage to target's defence`);
    if (Number(effect.addMainDice ?? 0) > 0) parts.push(`+${effect.addMainDice} main die`);
    if (Number(effect.addDamage ?? 0) > 0) parts.push(`+${effect.addDamage} damage`);
    if (Number(effect.recoverCorePoints ?? 0) > 0) parts.push(`Recover ${effect.recoverCorePoints} Core point`);
    const ongoing = String(effect.ongoingDamagePerTurn ?? "").trim();
    if (ongoing) parts.push(`Ongoing damage: ${ongoing}/turn (GM applies)`);
    if (effect.disarmWeapon) parts.push(`Disarm — drop ${Number(effect.placeDroppedWeaponSquares ?? 0) || 0} sq away (GM applies)`);
    if (Number(effect.pushTargetSquares ?? 0) > 0) parts.push(`Push ${effect.pushTargetSquares} sq ${String(effect.direction ?? "").replace(/-/g, " ")}`);
    if (effect.placeTargetAdjacent) parts.push("Place target adjacent (GM applies)");
    if (Number(effect.rotateTargetFacingSteps ?? 0) > 0) parts.push(`Rotate target facing ${effect.rotateTargetFacingSteps} step`);
    if (Array.isArray(effect.chooseOne) && effect.chooseOne.length) parts.push(`Choose one: ${effect.chooseOne.map((c) => String(c).replace(/-/g, " ")).join(" / ")} (GM applies)`);
    if (effect.swallowTarget) parts.push("Swallow target (GM applies)");
    return parts.join("; ");
}

/** Facing is 8-way, 45° per step (lib/positioning.mjs). */
export function nextFacingRotation(currentRotation, steps) {
    return (((Number(currentRotation) || 0) + (Number(steps) || 0) * 45) % 360 + 360) % 360;
}

/**
 * Step a push square-by-square along (stepX, stepY), stopping at the first
 * blocked step. `collides(fromCenter, toCenter)` is the injected wall test —
 * this keeps the stepping table-testable with a literal predicate.
 * Returns `{ x, y, movedSquares }` (start position when fully blocked).
 */
export function planPushPath({
    startX = 0,
    startY = 0,
    stepX = 0,
    stepY = 0,
    gridPx = 100,
    squares = 0,
    tokenWidth = 1,
    tokenHeight = 1,
    collides = () => false,
} = {}) {
    const centerOf = (px, py) => ({
        x: px + ((Number(tokenWidth) || 1) * gridPx) / 2,
        y: py + ((Number(tokenHeight) || 1) * gridPx) / 2,
    });
    let x = Number(startX) || 0;
    let y = Number(startY) || 0;
    let movedSquares = 0;
    for (let i = 0; i < Math.max(0, Number(squares) || 0); i += 1) {
        const nextX = x + stepX * gridPx;
        const nextY = y + stepY * gridPx;
        let blocked = false;
        try {
            blocked = collides(centerOf(x, y), centerOf(nextX, nextY)) ?? false;
        } catch (_e) {
            blocked = true;
        }
        if (blocked) break;
        x = nextX;
        y = nextY;
        movedSquares += 1;
    }
    return { x, y, movedSquares };
}

/**
 * Convert's re-match math: converted damage is added to the attack's raw
 * damage and re-matched against protection — only the extra that now gets
 * THROUGH (over what the base attack already dealt) is applied.
 * e.g. 1 dmg + 1 crit vs 2 defence = 0 through.
 */
export function computeConvertBreakdown({ critCount = 0, rate = 0, rawDamage = 0, protection = 0 } = {}) {
    const crits = Math.max(0, Number(critCount) || 0);
    const convertedDamage = (Number(rate) || 0) * crits;
    const raw = Number(rawDamage) || 0;
    const prot = Number(protection) || 0;
    const alreadyThrough = Math.max(0, raw - prot);
    const nowThrough = Math.max(0, raw + convertedDamage - prot);
    return {
        critCount: crits,
        convertedDamage,
        additionalDamage: Math.max(0, nowThrough - alreadyThrough),
    };
}

function escapeEffectHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => (
        { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]
    ));
}

// Run a committed post-maneuver's effect. A follow-up "safe attack" maneuver
// (e.g. Redouble) declares a fresh safe attack; every commit posts a chat card
// so the table sees it landed. Effects we don't auto-apply are named in the
// card for the GM to apply — manual economy.
export async function applyPostManeuverEffectPhased(options = {}, run, deps = {}) {
    const maneuver = options.maneuver ?? null;
    const effect = maneuver?.effectData ?? {};
    const actor = options.actor ?? null;
    const pendingAttack = options.pendingAttack ?? null;
    const target = options.target ?? pendingAttack?.target ?? null;
    const esc = escapeEffectHtml;

    try {
        // detail is built from trusted maneuver effectData (not user input) and
        // contains light markup (<strong>), so it is intentionally not escaped.
        const detail = describePostManeuverEffect(effect);
        await deps.postCard?.(actor,
            `<strong>Critical Maneuver — ${esc(maneuver?.name ?? "Maneuver")}</strong>`
            + `<br>${esc(actor?.name ?? "Combatant")}${target ? ` &rarr; ${esc(target.name ?? "target")}` : ""}`
            + (detail ? `<br>${detail}` : ""));
    } catch (_err) { /* non-fatal */ }

    // Auto-apply the condition to the target (Lock -> locked, Throw -> prone,
    // Constrict -> grappled, Choke -> choking-hold). Routed through the patch
    // dispatcher so it lands even when the acting client can't write the target.
    const conditionName = postManeuverConditionName(effect);
    if (conditionName && target?.id) {
        try {
            // inflictorId = the attacker, so an opposed escape can roll against them.
            await run({
                phase: "applyCondition",
                patches: [{ kind: "actor.applyCondition", actorId: target.id, name: conditionName, inflictorId: actor?.id ?? "" }],
            });
        } catch (err) {
            console.error("1547core | post-maneuver condition apply failed", err);
        }
    }

    // Rotate target facing (ruling 2026-07-11: automated). Routed with the
    // facingAutoFace tag so the off-turn facing lock lets it through.
    const rotateSteps = Number(effect.rotateTargetFacingSteps ?? 0) || 0;
    if (rotateSteps > 0 && target) {
        const tokenDoc = deps.getActorActiveTokenDocument?.(target);
        if (tokenDoc?.id) {
            try {
                await run({
                    phase: "rotateTarget",
                    patches: [{
                        kind: "token.update",
                        tokenId: tokenDoc.id,
                        sceneId: tokenDoc.parent?.id ?? null,
                        data: { rotation: nextFacingRotation(tokenDoc.rotation, rotateSteps) },
                        options: { facingAutoFace: true },
                    }],
                });
            } catch (err) {
                console.error("1547core | post-maneuver rotate-target failed", err);
            }
        }
    }

    // Push target (ruling 2026-07-11: automated). Straight line directly away
    // from the attacker, one square at a time, stopping at the first wall.
    // Skipped (left to the GM) when the tokens overlap — no defined direction —
    // or when either token isn't on the canvas to test walls against.
    const pushSquares = Number(effect.pushTargetSquares ?? 0) || 0;
    if (pushSquares > 0 && target && actor) {
        const targetTokenDoc = deps.getActorActiveTokenDocument?.(target);
        const attackerTokenDoc = deps.getActorActiveTokenDocument?.(actor);
        const collides = targetTokenDoc ? deps.buildCollisionTester?.(targetTokenDoc) : null;
        if (targetTokenDoc?.id && attackerTokenDoc && typeof collides === "function") {
            const gridPx = deps.gridSize?.() ?? 100;
            const stepX = Math.sign(Math.round((targetTokenDoc.x - attackerTokenDoc.x) / gridPx));
            const stepY = Math.sign(Math.round((targetTokenDoc.y - attackerTokenDoc.y) / gridPx));
            if (stepX !== 0 || stepY !== 0) {
                const { x, y, movedSquares } = planPushPath({
                    startX: Number(targetTokenDoc.x) || 0,
                    startY: Number(targetTokenDoc.y) || 0,
                    stepX,
                    stepY,
                    gridPx,
                    squares: pushSquares,
                    tokenWidth: Number(targetTokenDoc.width) || 1,
                    tokenHeight: Number(targetTokenDoc.height) || 1,
                    collides,
                });
                if (movedSquares > 0) {
                    try {
                        // forcedManeuverMove: movement-reactions skips forced
                        // moves — no budget spend, no opportunity attacks.
                        await run({
                            phase: "pushTarget",
                            patches: [{
                                kind: "token.update",
                                tokenId: targetTokenDoc.id,
                                sceneId: targetTokenDoc.parent?.id ?? null,
                                data: { x, y },
                                options: { forcedManeuverMove: true },
                            }],
                        });
                        if (movedSquares < pushSquares) {
                            await deps.postCard?.(actor, `${esc(target.name ?? "Target")} is pushed ${movedSquares}/${pushSquares} squares — stopped by a wall.`);
                        }
                    } catch (err) {
                        console.error("1547core | post-maneuver push failed", err);
                    }
                }
            }
        }
    }

    // Core Restore: recover Core Points on the LIVE `AvailableCorePoints`
    // pool (2026-07-12 — `CorePoints` itself is a CSB computed label, and the
    // old SpentCorePoints field was phantom), clamped to MaxCorePoints. The
    // crit cost was already spent by planCommitPostManeuver.
    const recoverCore = Number(effect.recoverCorePoints ?? 0) || 0;
    if (recoverCore > 0 && actor?.id) {
        const props = actor.system?.props ?? {};
        const current = Number(props.AvailableCorePoints ?? 0) || 0;
        const cap = [props.MaxCorePoints, props.CorePointsMax]
            .map(Number)
            .find((value) => Number.isFinite(value) && value > 0);
        const next = cap != null ? Math.min(current + recoverCore, cap) : current + recoverCore;
        if (next !== current) {
            await run({
                phase: "coreRestore",
                patches: [{ kind: "actor.update", actorId: actor.id, data: { "system.props.AvailableCorePoints": next } }],
            });
        }
    }

    // Convert: turn the attack's critical points into extra damage at
    // `convertCriticalPointsToDamage` per point. Crit points live ONLY in the
    // exchange's window payload (`options.currentCriticalPoints`) — there is no
    // actor prop backing them (ruling 2026-07-11); the window closing after
    // this commit is what consumes the remaining pool.
    const critToDamageRate = Number(effect.convertCriticalPointsToDamage ?? 0) || 0;
    if (critToDamageRate > 0 && actor?.id) {
        // The exchange's crit pool is in-memory (options.currentCriticalPoints,
        // ruling 2026-07-11) — but some tables ALSO track a manual
        // `props.CriticalPoints` pool, which the HUD displays and the full-turn
        // legality gate reads. Converting consumes that pool too, or the same
        // displayed points would pass a later legality check again.
        if (Number(actor.system?.props?.CriticalPoints ?? 0) > 0) {
            await run({
                phase: "convertConsumeManualCrits",
                patches: [{ kind: "actor.update", actorId: actor.id, data: { "system.props.CriticalPoints": 0 } }],
            });
        }
        const { critCount, convertedDamage, additionalDamage } = computeConvertBreakdown({
            critCount: options.currentCriticalPoints,
            rate: critToDamageRate,
            rawDamage: options.attackDamage,
            protection: options.attackProtection,
        });
        if (convertedDamage > 0) {
            const protection = Number(options.attackProtection ?? 0) || 0;
            let hpNote = "";
            if (target?.id && additionalDamage > 0) {
                try {
                    // Awaited apply (remote ack) so the card reflects landed state.
                    const result = await deps.applyDamageAwaited?.(target, additionalDamage);
                    if (result) {
                        hpNote = ` — ${esc(target.name ?? "target")} now ${result.currentHitPoints} HP`
                            + (result.isDead ? " (dead)" : result.isUnconscious ? " (unconscious)" : "");
                    }
                } catch (err) {
                    console.error("1547core | Convert damage apply failed", err);
                }
            } else if (additionalDamage <= 0) {
                hpNote = " — stopped by the defence (nothing gets through)";
            }
            try {
                await deps.postCard?.(actor,
                    `<strong>Convert — ${esc(maneuver?.name ?? "Convert")}</strong>`
                    + `<br>${esc(actor?.name ?? "Combatant")} converts ${critCount} critical point${critCount === 1 ? "" : "s"} into +${convertedDamage} damage`
                    + ` (vs ${protection} defence): <strong>${additionalDamage} through</strong>`
                    + (target ? ` to ${esc(target.name ?? "target")}` : "") + hpNote + ".");
            } catch (_e) { /* non-fatal */ }
        }
    }

    if ((effect.createSecondSafeAttack || effect.createFreeSafeAttack) && actor && target && pendingAttack?.profile) {
        try {
            await deps.declareAttack?.({
                actor,
                target,
                targets: [target],
                weapon: pendingAttack.weapon?.itemDocument ?? pendingAttack.weapon,
                profile: pendingAttack.profile,
                forceSafeAttack: true,
                extraEffectData: effect,
                // Mark it generated so it doesn't itself open a reaction window.
                generatedByReaction: maneuver?.name ?? "post-maneuver",
            });
        } catch (err) {
            console.error("1547core | post-maneuver follow-up attack failed", err);
        }
    }
}
