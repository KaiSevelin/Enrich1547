/**
 * Defense-side rolling for an Exchange (ADR-0004).
 *
 * The ONE home for: equipped-armor → defense-dice extraction (previously
 * copied 3× across hud-actions and the resolver), the defense-pool formula
 * (armor dice + condition Risk dice + reaction Multiplier dice), and the
 * defender's public defense roll. The Exchange pipeline receives
 * rollDefenseForActor as an injected dep.
 *
 * Foundry-adjacent glue (.js): reads condition state and posts chat via
 * roll-chat; the dice/pool math itself stays in pool-builder.
 */
import { buildDefenderPool, toFoundryFormula } from "./pool-builder.mjs";
import { isTruthyLike } from "./normalisation.mjs";
import { conditionCombatDisadvantage, conditionDisadvantageSources } from "../services/condition-registry.js";
import { rollToChat } from "../lib/roll-chat.mjs";
import { escapeHtml } from "../lib/foundry-utils.mjs";

// Itemised advantage/disadvantage breakdown for a roll's chat flavor — names
// each source (Prone, Locked, …) so extra Risk/advantage dice aren't a mystery.
export function formatRollModifiers({ advantage = [], disadvantage = [] } = {}) {
    const fmt = (list) => list.map((s) => `${s.name} (+${s.dice})`).join(", ");
    const parts = [];
    if (disadvantage.length) parts.push(`Disadvantage: ${fmt(disadvantage)}`);
    if (advantage.length) parts.push(`Advantage: ${fmt(advantage)}`);
    return parts.join(" · ");
}

/**
 * First equipped armor's defense dice, else the unprotected default pool.
 * Returns `{ defenseDice, defense, name }`.
 */
export function buildDefenderArmorSummary(actor) {
    return (actor?.items?.contents ?? actor?.items ?? [])
        .map((item) => {
            const props = item?.system?.props ?? {};
            const sourceData = item?.flags?.["1547Core"]?.sourceData ?? item?.flags?.["1547core"]?.sourceData ?? {};
            // Same equipped predicate as attack-lifecycle's actorHasEquippedArmor
            // (isTruthyLike) — the old narrow true/1/'true' check disagreed with
            // it, so an armor with Equipped: 'yes' counted as armored on one
            // half of the exchange and Unprotected on the other.
            if (!(isTruthyLike(props.Equipped) || sourceData?.equipped === true)) return null;
            const defenseDice = Array.isArray(sourceData?.defenseDice)
                ? [...sourceData.defenseDice]
                : String(props.Defense ?? "").split(",").map((entry) => entry.trim()).filter(Boolean);
            return defenseDice.length ? { defenseDice, defense: defenseDice.join(", "), name: item.name } : null;
        })
        .filter(Boolean)[0] ?? {
            defenseDice: buildDefenderPool(undefined),
            defense: buildDefenderPool(undefined).join(", "),
            name: "Unprotected",
        };
}

/**
 * The defense-pool formula: armor dice + condition Risk dice (Locked,
 * Weakened, … — Prone is attack-only) + reaction Multiplier dice (Core
 * Defense multiplies the defence result rather than adding flat protection).
 */
export function buildDefenseRollFormula(armorSummary, defender = null, { addMultiplierDice = 0 } = {}) {
    const pool = buildDefenderPool(Array.isArray(armorSummary?.defenseDice) ? armorSummary.defenseDice : undefined);
    const disadvantage = defender ? conditionCombatDisadvantage(defender, "defense") : 0;
    for (let i = 0; i < disadvantage; i += 1) pool.push("Risk");
    for (let i = 0; i < Math.max(0, Number(addMultiplierDice) || 0); i += 1) pool.push("Multiplier");
    return toFoundryFormula(pool);
}

/**
 * Roll the defender's public defense and return the totals summary (or null
 * when the defender yields no formula — the resolution then substitutes the
 * unprotected default via buildDefaultDefenseRollSummary).
 */
export async function rollDefenseForActor(actor, token = null, { addMultiplierDice = 0 } = {}) {
    if (!actor) return null;
    const formula = buildDefenseRollFormula(buildDefenderArmorSummary(actor), actor, { addMultiplierDice });
    if (!formula) return null;
    const ChatMessageCls = globalThis.ChatMessage;
    const resolvedToken = token ?? actor.getActiveTokens?.(true)?.[0] ?? null;
    const speaker = ChatMessageCls.getSpeaker({ actor, token: resolvedToken?.document ?? resolvedToken ?? undefined });
    const modifierNote = formatRollModifiers({ disadvantage: conditionDisadvantageSources(actor, "defense") });
    const rolled = await rollToChat({
        formula,
        speaker,
        flavor: `Defense Roll<br>Defender: ${escapeHtml(actor?.name ?? "Target")}`
            + (modifierNote ? `<br><em>${escapeHtml(modifierNote)}</em>` : ""),
    });
    return rolled?.totals ?? null;
}
