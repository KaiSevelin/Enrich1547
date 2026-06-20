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
    // Escaping them is its own granted maneuver (see foundry/Templates/maneuvers.json).
    Locked: { combat: true, img: "icons/svg/net.svg" },
    // Prone: disadvantage on your ATTACKS only (you can still defend normally), and
    // anyone attacking you gets one advantage die.
    Prone: { combat: true, combatDisadvantage: "attack", attackersAdvantage: 1, img: "icons/svg/falling.svg" },
    Grappled: { combat: true, img: "icons/svg/trap.svg" },
    // Choking Hold is severe: also cancels advantage, and the choker gets a free
    // unarmed attack each round (inflictorAttackEachRound).
    "Choking Hold": { combat: true, blocksAdvantage: true, inflictorAttackEachRound: "unarmed", img: "icons/svg/terror.svg" }
};

// Default icons for the registry's afflictions so they read clearly in the token
// status menu (see registerConditionStatusEffects). Combat conditions carry their
// own img above; these cover the rest.
const CONDITION_IMG = {
    Weakened: "icons/svg/downgrade.svg",
    Exhausted: "icons/svg/unconscious.svg",
    Cursed: "icons/svg/hazard.svg",
    Doomed: "icons/svg/skull.svg",
    Restless: "icons/svg/daze.svg",
    Marked: "icons/svg/target.svg",
    Silenced: "icons/svg/deaf.svg",
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
/** Per-condition combat disadvantage contributions [{ name, dice }] for a roll type. */
export function conditionDisadvantageSources(actor, rollType = "both") {
    const out = [];
    for (const n of getActiveConditions(actor)) {
        const r = CONDITIONS[n];
        if (!r) continue;
        let applies = false;
        // General afflictions (Weakened/Cursed/Exhausted) hit every combat roll.
        if (r.disadvantage === "all" || r.disadvantage === "physical") applies = true;
        // Combat grapples/knockdowns: `combatDisadvantage` ("attack"|"defense"|"both",
        // default "both") scopes which rolls they hit — e.g. Prone hits attacks only.
        else if (r.combat) {
            const scope = r.combatDisadvantage ?? "both";
            applies = rollType === "both" || scope === "both" || scope === rollType;
        }
        if (applies) out.push({ name: n, dice: 1 });
    }
    return out;
}

export function conditionCombatDisadvantage(actor, rollType = "both") {
    return conditionDisadvantageSources(actor, rollType).reduce((sum, s) => sum + s.dice, 0);
}

/** Per-condition advantage [{ name, dice }] anyone attacking this actor gains (e.g. Prone). */
export function conditionAttackersAdvantageSources(actor) {
    const out = [];
    for (const n of getActiveConditions(actor)) {
        const dice = Number(CONDITIONS[n]?.attackersAdvantage ?? 0) || 0;
        if (dice > 0) out.push({ name: n, dice });
    }
    return out;
}

export function conditionAttackersAdvantage(actor) {
    return conditionAttackersAdvantageSources(actor).reduce((sum, s) => sum + s.dice, 0);
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

/** The icon for a condition (canonical), for both programmatic apply and the menu. */
function conditionImg(canonicalName) {
    return CONDITIONS[canonicalName]?.img ?? CONDITION_IMG[canonicalName] ?? "icons/svg/aura.svg";
}

/** Apply a named condition as an ActiveEffect (idempotent). The name is canonicalised
 *  so a programmatic apply and a token-menu toggle produce an identical effect.
 *  `inflictorId` records who applied it (e.g. the choker) for round-effect use. */
export async function applyCondition(actor, name, { durationType = "", durationValue = "", inflictorId = "" } = {}) {
    const target = actor?.actor ?? actor;
    if (!target?.createEmbeddedDocuments || !name) return null;
    const canonical = CONDITION_BY_SLUG[slug(name)] ?? String(name);
    if (effectList(target).some((e) => slug(e?.name) === slug(canonical))) return null;
    const data = {
        name: canonical,
        img: conditionImg(canonical),
        statuses: [slug(canonical)],
        changes: [],
        disabled: false,
        flags: { [MODULE_ID]: { condition: canonical, durationType, durationValue, inflictorId } }
    };
    const [created] = await target.createEmbeddedDocuments("ActiveEffect", [data]);
    return created ?? null;
}

/**
 * Add the registry's conditions to CONFIG.statusEffects so the GM (and owners) can
 * toggle Grappled/Locked/Prone/etc. from the token's status menu, with icons. The
 * resulting ActiveEffect's name matches a registry key, so the combat automation
 * picks it up exactly like a maneuver-applied one. Call once at init.
 */
export function registerConditionStatusEffects() {
    const list = globalThis.CONFIG?.statusEffects;
    if (!Array.isArray(list)) return;
    for (const name of Object.keys(CONDITIONS)) {
        const id = slug(name);
        if (!id || list.some((s) => s?.id === id)) continue;
        list.push({ id, name, img: conditionImg(name) });
    }
}

/** Remove a named condition if present. */
export async function removeCondition(actor, name) {
    const target = actor?.actor ?? actor;
    const ef = effectList(target).find((e) => slug(e?.name) === slug(name));
    if (ef) await ef.delete();
}

export function registerConditionRegistry() {
    registerConditionStatusEffects();
    const coreModule = game.modules.get(MODULE_ID);
    if (coreModule) {
        coreModule.api = coreModule.api ?? {};
        coreModule.api.condition = {
            CONDITIONS, getActiveConditions, conditionDisadvantage, conditionBlocksAdvantage,
            conditionCombatDisadvantage, conditionDisadvantageSources,
            conditionAttackersAdvantage, conditionAttackersAdvantageSources,
            applyConditionDiceModifier, applyCondition, removeCondition, registerConditionStatusEffects
        };
    }
}
