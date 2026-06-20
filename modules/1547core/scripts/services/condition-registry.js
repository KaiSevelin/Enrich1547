import { MODULE_ID } from "../lib/constants.mjs";
/**
 * Condition registry. Makes the formalized afflictions (status-effects-guide)
 * machine-readable so they impose their roll effects, in one place.
 *
 * A condition lives on an actor as an ActiveEffect whose NAME is the condition
 * (matching how the rest of the system reads conditions). The registry maps each
 * name to its roll rule, and the shared stat-pool helper consults it.
 *
 * Rule fields:
 *   disadvantage : "all" | "physical" | [stat,...]   — pools that lose a die
 *   blocksAdvantage : true                            — advantage dice are ignored
 *   supersedes : [name,...]                           — replaces those (no stacking)
 *
 * Wired into the stat-check pools (disease / spell / contest). Combat conditions
 * (Locked, Prone, …) remain handled by the combat pipeline.
 */

const PHYSICAL = ["Strength", "Stamina", "Dexterity"];

export const CONDITIONS = {
    Weakened: { disadvantage: "physical" },
    Exhausted: { disadvantage: "all", blocksAdvantage: true, supersedes: ["Weakened"] },
    Cursed: { disadvantage: "all" },
    Doomed: { blocksAdvantage: true },
    Restless: {},   // blocks rest/recovery — handled outside the dice
    Marked: {},      // grants trackers advantage against the actor — not a self-modifier
    Silenced: { noVerbal: true }, // prevents spoken/verbal actions — situational legality
    // Combat grapples/knockdowns — each imposes disadvantage on the held/downed
    // combatant's attack and defence rolls (one Risk die via conditionCombatDisadvantage).
    // `escape` describes how the held combatant breaks free: an opposed roll of one
    // of `stat` (their pick) vs the inflictor's `vs` stat, optionally at disadvantage;
    // `manual: true` is a no-roll "stand up". Escape is a free reaction (one per round).
    Locked: { combat: true, escape: { stat: ["Strength"], vs: "Strength" } },
    Prone: { combat: true, attackersAdvantage: 1, escape: { manual: true, note: "Stand up — forgo your movement this turn." } },
    Grappled: { combat: true, escape: { stat: ["Strength", "Dexterity"], vs: "Strength" } },
    "Choking Hold": {
        combat: true,
        blocksAdvantage: true, // severe: also cancels advantage
        inflictorAttackEachRound: "unarmed", // the choker gets a free unarmed attack each round
        escape: { stat: ["Strength"], vs: "Strength", disadvantage: true }
    }
};

function slug(name) { return String(name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }
function effectList(actor) { return actor?.effects?.contents ?? actor?.effects ?? []; }

// Match conditions by slug so casing/spacing differences (the maneuvers emit
// "locked"/"choking-hold", the registry keys are "Locked"/"Choking Hold") still
// resolve to the canonical rule.
const CONDITION_BY_SLUG = Object.fromEntries(Object.keys(CONDITIONS).map((key) => [slug(key), key]));

/** Active condition names the registry knows about, with supersession resolved. */
export function getActiveConditions(actor) {
    const names = new Set();
    for (const ef of effectList(actor)) {
        const canonical = ef?.name ? CONDITION_BY_SLUG[slug(ef.name)] : null;
        if (canonical && !ef.disabled) names.add(canonical);
    }
    for (const n of [...names]) {
        for (const s of (CONDITIONS[n]?.supersedes ?? [])) names.delete(s);
    }
    return [...names];
}

/** Number of disadvantage dice the actor's conditions impose on a roll of `statLabel`. */
export function conditionDisadvantage(actor, statLabel) {
    let d = 0;
    for (const n of getActiveConditions(actor)) {
        const rule = CONDITIONS[n]?.disadvantage;
        if (rule === "all") d += 1;
        else if (rule === "physical" && PHYSICAL.includes(statLabel)) d += 1;
        else if (Array.isArray(rule) && rule.includes(statLabel)) d += 1;
    }
    return d;
}

export function conditionBlocksAdvantage(actor) {
    return getActiveConditions(actor).some((n) => CONDITIONS[n]?.blocksAdvantage);
}

/**
 * Combat-roll disadvantage (extra Risk dice) from the actor's conditions. Combat is
 * a physical domain, so "physical" and "all" disadvantage apply, plus combat-only
 * conditions (Locked). Returns a count of disadvantage/Risk dice.
 */
export function conditionCombatDisadvantage(actor) {
    let d = 0;
    for (const n of getActiveConditions(actor)) {
        const r = CONDITIONS[n];
        if (!r) continue;
        if (r.disadvantage === "all" || r.disadvantage === "physical" || r.combat) d += 1;
    }
    return d;
}

/**
 * Resolve a final dice count for a stat pool, accounting for advantage and the
 * actor's conditions. Disadvantage removes dice (min one if any remained); a
 * blocking condition (Exhausted, Doomed) cancels advantage dice.
 */
export function applyConditionDiceModifier(actor, statLabel, baseDice, advantageDice = 0) {
    const adv = conditionBlocksAdvantage(actor) ? 0 : Math.max(0, Number(advantageDice) || 0);
    let dice = Math.max(0, Number(baseDice || 0) + adv);
    const disadv = conditionDisadvantage(actor, statLabel);
    if (dice > 0 && disadv > 0) dice = Math.max(1, dice - disadv);
    return dice;
}

/** Apply a named condition as an ActiveEffect (idempotent). `inflictorId` records
 *  who applied it (the grappler/choker) so an opposed escape can roll against them. */
export async function applyCondition(actor, name, { durationType = "", durationValue = "", inflictorId = "" } = {}) {
    const target = actor?.actor ?? actor;
    if (!target?.createEmbeddedDocuments || !name) return null;
    if (effectList(target).some((e) => slug(e?.name) === slug(name))) return null;
    const data = {
        name,
        img: "icons/svg/aura.svg",
        statuses: [slug(name)],
        changes: [],
        disabled: false,
        flags: { [MODULE_ID]: { condition: name, durationType, durationValue, inflictorId } }
    };
    const [created] = await target.createEmbeddedDocuments("ActiveEffect", [data]);
    return created ?? null;
}

/**
 * Escapable conditions currently on the actor, with the canonical rule + who
 * applied each. The HUD shows an "Escape" reaction per entry; the opposed roll
 * uses `escape.stat` (held) vs the inflictor's `escape.vs` stat.
 */
export function getEscapableConditions(actor) {
    const target = actor?.actor ?? actor;
    const out = [];
    for (const ef of effectList(target)) {
        if (ef?.disabled) continue;
        const canonical = ef?.name ? CONDITION_BY_SLUG[slug(ef.name)] : null;
        const escape = canonical ? CONDITIONS[canonical]?.escape : null;
        if (!escape) continue;
        out.push({
            name: canonical,
            effectId: ef.id ?? null,
            escape,
            inflictorId: ef.flags?.[MODULE_ID]?.inflictorId ?? null,
        });
    }
    return out;
}

/** Remove a named condition if present. */
export async function removeCondition(actor, name) {
    const target = actor?.actor ?? actor;
    const ef = effectList(target).find((e) => e?.name === name);
    if (ef) await ef.delete();
}

export function registerConditionRegistry() {
    const coreModule = game.modules.get(MODULE_ID);
    if (coreModule) {
        coreModule.api = coreModule.api ?? {};
        coreModule.api.condition = {
            CONDITIONS, getActiveConditions, conditionDisadvantage, conditionBlocksAdvantage,
            conditionCombatDisadvantage, applyConditionDiceModifier, applyCondition, removeCondition,
            getEscapableConditions
        };
    }
}
