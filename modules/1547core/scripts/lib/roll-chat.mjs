/**
 * The one roll→chat→totals path (ADR-0004 "Roll-chat helper").
 *
 * Every subsystem that evaluates a formula and posts it to chat goes through
 * rollToChat — previously this sequence existed as ~8 independent copies
 * (hud-actions' rollFormulaToChatAndSummarize, the resolver's rollPublicTotals,
 * dice tabs, counter-roll, spell casting, social battle, …).
 *
 * Foundry-side lib: reads globalThis.Roll / CONST / game / Hooks directly —
 * this is glue, not a pure module. The Exchange pipeline receives it as an
 * injected dep and never news a Roll itself.
 */

const MODULE_ID = "1547core";

function normalizeTotals(totals) {
    if (!totals) return null;
    return {
        damage: Number(totals.damage ?? 0) || 0,
        protection: Number(totals.protection ?? 0) || 0,
        crit: Number(totals.crit ?? 0) || 0,
        fumble: Number(totals.fumble ?? 0) || 0,
        multiplier: Number.isFinite(Number(totals.multiplier)) ? Number(totals.multiplier) : 1,
    };
}

function extractDice1547Totals(message) {
    const game = globalThis.game;
    const result = game?.modules?.get?.(MODULE_ID)?.api?.getRollResult?.(message?.id ?? message);
    return normalizeTotals(result?.totals ?? null);
}

function waitForDice1547HookResult(message, { timeoutMs = 5000 } = {}) {
    const messageId = String(message?.id ?? message ?? "").trim();
    const Hooks = globalThis.Hooks;
    if (!messageId || !Hooks?.on) return Promise.resolve(null);
    return new Promise((resolve) => {
        let settled = false;
        let hookId = null;
        const finish = (result) => {
            if (settled) return;
            settled = true;
            if (hookId != null) Hooks.off("dice1547RollResult", hookId);
            resolve(normalizeTotals(result?.totals ?? null));
        };
        hookId = Hooks.on("dice1547RollResult", (result, hookMessage) => {
            if (String(hookMessage?.id ?? "").trim() !== messageId) return;
            finish(result);
        });
        setTimeout(() => finish(null), timeoutMs);
    });
}

// Dice So Nice fallback: totals arrive via the dice1547RollResult hook or the
// stored roll-result flag, whichever lands first within the timeout.
async function waitForDice1547Totals(message, { timeoutMs = 5000, intervalMs = 50 } = {}) {
    const immediate = extractDice1547Totals(message);
    if (immediate) return immediate;

    const hookPromise = waitForDice1547HookResult(message, { timeoutMs });
    const pollPromise = (async () => {
        const startedAt = Date.now();
        while ((Date.now() - startedAt) < timeoutMs) {
            const totals = extractDice1547Totals(message);
            if (totals) return totals;
            await new Promise((resolve) => setTimeout(resolve, intervalMs));
        }
        return extractDice1547Totals(message);
    })();

    const [hookResult, polledResult] = await Promise.all([hookPromise, pollPromise]);
    return hookResult ?? polledResult ?? null;
}

/**
 * Evaluate `formula`, post it to chat, and (optionally) read the 1547 dice
 * totals. Returns `{ roll, message, totals }`, or `null` when `formula` is
 * empty. `totals` is null for plain-d6 rolls or when `waitForTotals: false`.
 *
 * - `rollMode: "public"` (default) forces a public roll so both clients see
 *   the dice — otherwise the GM's chat roll-mode setting (e.g. "Private GM
 *   Roll") would hide combat rolls from the player. Pass `rollMode: "default"`
 *   to honour the user's setting (stat/skill/utility rolls).
 * - Totals are read straight from the evaluated roll via computeRollTotals so
 *   resolution never hinges on Dice So Nice completing its animation; the DSN
 *   flag/hook remains as fallback.
 */
export async function rollToChat({ formula, speaker, flavor, rollMode = "public", waitForTotals = true } = {}) {
    if (!formula) return null;
    const RollCls = globalThis.Roll;
    const roll = await new RollCls(formula).evaluate();
    const messageOptions = rollMode === "public"
        ? { rollMode: globalThis.CONST?.DICE_ROLL_MODES?.PUBLIC ?? "publicroll" }
        : {};
    // flavor may be a function of the evaluated roll — for cards whose text
    // needs the result (e.g. the counter-roll's success/failure line).
    const flavorText = typeof flavor === "function" ? flavor(roll) : flavor;
    const message = await roll.toMessage({ speaker, flavor: flavorText }, messageOptions);
    if (!waitForTotals) return { roll, message, totals: null };
    const direct = globalThis.game?.modules?.get?.(MODULE_ID)?.api?.computeRollTotals?.([roll]);
    const totals = normalizeTotals(direct) ?? await waitForDice1547Totals(message);
    return { roll, message, totals };
}
