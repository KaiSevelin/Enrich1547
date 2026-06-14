/**
 * Social Battle (Lean MVP).
 *
 * A structured debate resolved as an opposed-roll contest. Each side has a
 * pool of "marks" (2 + stat dice + situational); each exchange both sides roll
 * a stat (Nd6 + Mod) and the loser of the comparison takes a mark — two on a
 * "critical" (rolling more than double the opponent), none on a tie. When a
 * side's marks fill, that side loses and the GM may apply a consequence.
 *
 * Reuses the game's own pieces:
 *   - stats are read straight off the actor (Stats_<Name>Dice / _Mod),
 *   - advantage/disadvantage is a fluent, GM-set ±dice adjustment per roll,
 *   - a lost battle grants a Drive (or a Mood) via the SAME chargen model
 *     (system.props.Drives, "[Category] text" lines) — see chargen/drive-prompts.
 *
 * Launch: a GM-only Scene Controls tool (token group). See Social Battle Light.
 */

import { MODULE_ID } from "../lib/constants.mjs";
import { promptAddDrive } from "../chargen/drive-prompts.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

// The seven stats a social battle can be fought with, matching the actor's
// Stats_<Name>Dice / Stats_<Name>Mod props. Order mirrors the rules draft.
const STATS = ["Strength", "Dexterity", "Stamina", "Intelligence", "Faith", "Charisma", "Power"];

const DRIVE_PROP = "system.props.Drives";
const SOCIAL_DRIVE_CATEGORY = "Social Battle";

/* ---------------------------------------- */
/*  Small helpers                           */
/* ---------------------------------------- */

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function actorProps(actor) { return actor?.system?.props ?? {}; }
function statDice(actor, stat) { return Number(actorProps(actor)[`Stats_${stat}Dice`] ?? 0) || 0; }
function statMod(actor, stat) { return Number(actorProps(actor)[`Stats_${stat}Mod`] ?? 0) || 0; }
function actorOf(side) { return side?.actorUuid ? fromUuidSync(side.actorUuid) : null; }

function statOptions(selected) {
    return STATS.map((s) => `<option value="${s}" ${s === selected ? "selected" : ""}>${s}</option>`).join("");
}
function tokenOptions(tokens, selectedId) {
    return tokens.map((t) => `<option value="${t.id}" ${t.id === selectedId ? "selected" : ""}>${escapeHtml(t.name)}</option>`).join("");
}

// Marks the loser of an exchange takes: 0 on a tie, 2 when the winner rolled
// more than double the loser (a critical), else 1.
function marksFromExchange(winnerTotal, loserTotal) {
    if (winnerTotal <= loserTotal) return 0;
    return winnerTotal > 2 * loserTotal ? 2 : 1;
}

/* ---------------------------------------- */
/*  Rolling                                 */
/* ---------------------------------------- */

async function rollStat(actor, stat, advantage) {
    const dice = Math.max(0, statDice(actor, stat) + (Number(advantage) || 0));
    const mod = statMod(actor, stat);
    const formula = dice > 0 ? (mod ? `${dice}d6 + ${mod}` : `${dice}d6`) : String(mod || 0);
    const roll = await new Roll(formula).evaluate();
    if (game.dice3d?.showForRoll) { try { await game.dice3d.showForRoll(roll, game.user, true); } catch { /* non-fatal */ } }
    return { roll, total: Number(roll.total) || 0, formula };
}

/* ---------------------------------------- */
/*  Dialogs                                 */
/* ---------------------------------------- */

// Setup: choose the two combatants, each side's stat, and any situational marks.
function promptSetup(tokens, aTok, bTok) {
    return new Promise((resolve) => {
        let settled = false;
        const finish = (v) => { if (!settled) { settled = true; resolve(v); } };
        new Dialog({
            title: "Start Social Battle",
            content: `
        <div class="sb-setup">
          <p class="sb-hint">Each side's marks = 2 + the chosen stat's dice (+ any situational marks the GM grants).</p>
          <div class="sb-setup-side">
            <h3>Side A</h3>
            <label>Combatant <select name="aTok">${tokenOptions(tokens, aTok?.id)}</select></label>
            <label>Stat <select name="aStat">${statOptions("Charisma")}</select></label>
            <label>Situational marks <input type="number" name="aSit" value="0" min="0" max="3" step="1"></label>
          </div>
          <div class="sb-setup-side">
            <h3>Side B</h3>
            <label>Combatant <select name="bTok">${tokenOptions(tokens, bTok?.id)}</select></label>
            <label>Stat <select name="bStat">${statOptions("Stamina")}</select></label>
            <label>Situational marks <input type="number" name="bSit" value="0" min="0" max="3" step="1"></label>
          </div>
        </div>`,
            buttons: {
                start: {
                    label: "Begin",
                    callback: (html) => finish({
                        a: { tokenId: html.find("[name=aTok]").val(), stat: html.find("[name=aStat]").val(), situational: Number(html.find("[name=aSit]").val()) || 0 },
                        b: { tokenId: html.find("[name=bTok]").val(), stat: html.find("[name=bStat]").val(), situational: Number(html.find("[name=bSit]").val()) || 0 }
                    })
                },
                cancel: { label: "Cancel", callback: () => finish(null) }
            },
            default: "start",
            close: () => finish(null)
        }, { width: 520, classes: ["social-battle-dialog"] }).render(true);
    });
}

// One exchange: each side declares a stat and the GM sets advantage/disadvantage
// dice (positive = advantage, negative = disadvantage) — the fluent lever for
// clever arguments, secrets, drives and skill swaps.
function promptExchange(sides) {
    const [A, B] = sides;
    return new Promise((resolve) => {
        let settled = false;
        const finish = (v) => { if (!settled) { settled = true; resolve(v); } };
        new Dialog({
            title: "Exchange",
            content: `
        <div class="sb-exchange">
          <div class="sb-exchange-side">
            <h3>${escapeHtml(A.name)}</h3>
            <label>Stat <select name="aStat">${statOptions(A.stat)}</select></label>
            <label>± dice <input type="number" name="aAdv" value="0" step="1"></label>
          </div>
          <div class="sb-exchange-side">
            <h3>${escapeHtml(B.name)}</h3>
            <label>Stat <select name="bStat">${statOptions(B.stat)}</select></label>
            <label>± dice <input type="number" name="bAdv" value="0" step="1"></label>
          </div>
          <p class="sb-hint">± dice: positive for advantage, negative for disadvantage — the GM's call (secrets, drives, clever vs. weak arguments, skills).</p>
        </div>`,
            buttons: {
                roll: {
                    label: "Roll Exchange",
                    callback: (html) => finish({
                        a: { stat: html.find("[name=aStat]").val(), adv: Number(html.find("[name=aAdv]").val()) || 0 },
                        b: { stat: html.find("[name=bStat]").val(), adv: Number(html.find("[name=bAdv]").val()) || 0 }
                    })
                },
                cancel: { label: "Cancel", callback: () => finish(null) }
            },
            default: "roll",
            close: () => finish(null)
        }, { width: 460, classes: ["social-battle-dialog"] }).render(true);
    });
}

// Mood = a Drive cleared on rest. Stored as a "[Mood] text" line in the same
// Drives prop, so it shares the chargen model and display.
function grantMood(actor) {
    return new Promise((resolve) => {
        let settled = false;
        const finish = (v) => { if (!settled) { settled = true; resolve(v); } };
        new Dialog({
            title: "Grant Mood",
            content: `
        <div class="sb-mood">
          <p class="sb-hint">A mood behaves like a drive but is cleared on a rest.</p>
          <label>Mood <textarea name="mood" rows="3" placeholder="e.g. Angry at the guard"></textarea></label>
        </div>`,
            buttons: {
                add: {
                    label: "Add Mood",
                    callback: async (html) => {
                        const text = String(html.find("[name=mood]").val() ?? "").trim();
                        if (!text) return finish(false);
                        const existing = String(actorProps(actor).Drives ?? "").trim();
                        const line = `[Mood] ${text}`;
                        await actor.update({ [DRIVE_PROP]: existing ? `${existing}\n${line}` : line });
                        finish(true);
                    }
                },
                skip: { label: "Skip", callback: () => finish(false) }
            },
            default: "add",
            close: () => finish(false)
        }, { width: 480, classes: ["social-battle-dialog"] }).render(true);
    });
}

/* ---------------------------------------- */
/*  Chat                                    */
/* ---------------------------------------- */

async function postExchangeCard(battle, params, ra, rb, line) {
    const [A, B] = battle.sides;
    const loser = battle.over ? battle.sides.find((s) => s.key === battle.loserKey) : null;
    const content = `
    <div class="sb-card">
      <h3 style="margin:.1rem 0;">Social Battle — Exchange</h3>
      <p style="margin:.1rem 0;">${escapeHtml(A.name)} <em>(${escapeHtml(params.a.stat)})</em>: <strong>${ra.total}</strong> <span style="opacity:.65">[${escapeHtml(ra.formula)}]</span></p>
      <p style="margin:.1rem 0;">${escapeHtml(B.name)} <em>(${escapeHtml(params.b.stat)})</em>: <strong>${rb.total}</strong> <span style="opacity:.65">[${escapeHtml(rb.formula)}]</span></p>
      <p style="margin:.25rem 0 .1rem;">${escapeHtml(line)}</p>
      <p style="margin:.1rem 0;opacity:.8;">${escapeHtml(A.name)} ${A.taken}/${A.total} &middot; ${escapeHtml(B.name)} ${B.taken}/${B.total}</p>
      ${loser ? `<p style="margin:.25rem 0 0;color:#b3261e;"><strong>${escapeHtml(loser.name)} loses the battle.</strong></p>` : ""}
    </div>`;
    await ChatMessage.create({ speaker: { alias: "Social Battle" }, content });
}

/* ---------------------------------------- */
/*  The window                              */
/* ---------------------------------------- */

export class SocialBattleApp extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(options = {}) {
        super(options);
        this._battle = options.battle;
    }

    static DEFAULT_OPTIONS = {
        id: "social-battle-{id}",
        classes: ["social-battle-app"],
        tag: "section",
        window: { title: "Social Battle", icon: "fa-solid fa-comments", resizable: true },
        position: { width: 460, height: "auto" },
        actions: {
            "exchange": function () { return this._onExchange(); },
            "grant-drive": function () { return this._onGrant(false); },
            "grant-mood": function () { return this._onGrant(true); },
            "reset": function () { return this._onReset(); }
        }
    };

    static PARTS = {
        body: { template: "modules/1547core/templates/social/social-battle.hbs" }
    };

    async _prepareContext() {
        const b = this._battle;
        const sides = b.sides.map((s) => ({
            name: s.name,
            stat: s.stat,
            taken: s.taken,
            total: s.total,
            pips: Array.from({ length: s.total }, (_, i) => i < s.taken),
            isLoser: b.over && b.loserKey === s.key,
            isWinner: b.over && b.loserKey && b.loserKey !== s.key
        }));
        return {
            sides,
            over: b.over,
            loser: b.over ? b.sides.find((s) => s.key === b.loserKey) : null,
            log: b.log.slice(-8).reverse()
        };
    }

    async _onExchange() {
        const b = this._battle;
        if (b.over) return;
        const params = await promptExchange(b.sides);
        if (!params) return;

        const [A, B] = b.sides;
        const ra = await rollStat(actorOf(A), params.a.stat, params.a.adv);
        const rb = await rollStat(actorOf(B), params.b.stat, params.b.adv);

        let line;
        if (ra.total === rb.total) {
            line = `Tie at ${ra.total} — no marks.`;
        } else if (ra.total > rb.total) {
            const m = marksFromExchange(ra.total, rb.total);
            B.taken = Math.min(B.total, B.taken + m);
            line = `${A.name} wins ${ra.total} vs ${rb.total} → ${B.name} takes ${m} mark${m > 1 ? "s (critical)" : ""}.`;
        } else {
            const m = marksFromExchange(rb.total, ra.total);
            A.taken = Math.min(A.total, A.taken + m);
            line = `${B.name} wins ${rb.total} vs ${ra.total} → ${A.name} takes ${m} mark${m > 1 ? "s (critical)" : ""}.`;
        }
        b.log.push(line);

        for (const s of b.sides) {
            if (s.taken >= s.total) { b.over = true; b.loserKey = s.key; }
        }

        await postExchangeCard(b, params, ra, rb, line);
        this.render();
    }

    async _onGrant(mood) {
        const b = this._battle;
        if (!b.over) return;
        const loser = b.sides.find((s) => s.key === b.loserKey);
        const actor = actorOf(loser);
        if (!actor) { ui.notifications?.warn("1547 Core: couldn't resolve the losing actor to apply the outcome."); return; }
        if (mood) await grantMood(actor);
        else await promptAddDrive(actor, SOCIAL_DRIVE_CATEGORY);
    }

    async _onReset() {
        const b = this._battle;
        for (const s of b.sides) s.taken = 0;
        b.over = false;
        b.loserKey = null;
        b.log = [];
        this.render();
    }
}

/* ---------------------------------------- */
/*  Launch + registration                   */
/* ---------------------------------------- */

function buildSide(key, sel) {
    const tok = canvas?.tokens?.get(sel.tokenId);
    const actor = tok?.actor;
    if (!actor) return null;
    const dice = statDice(actor, sel.stat);
    return {
        key,
        name: tok.name,
        actorUuid: actor.uuid,
        stat: sel.stat,
        dice,
        total: 2 + dice + (Number(sel.situational) || 0),
        taken: 0
    };
}

export async function startSocialBattle() {
    const tokens = (canvas?.tokens?.placeables ?? []).filter((t) => t.actor);
    if (tokens.length < 2) {
        ui.notifications?.warn("1547 Core: place at least two tokens with actors on the scene to start a social battle.");
        return;
    }
    const controlled = canvas.tokens.controlled.find((t) => t.actor) ?? null;
    const targeted = [...(game.user?.targets ?? [])].find((t) => t.actor) ?? null;
    const aTok = controlled ?? tokens[0];
    const bTok = targeted ?? tokens.find((t) => t !== aTok) ?? tokens[1];

    const params = await promptSetup(tokens, aTok, bTok);
    if (!params) return;

    const sides = [buildSide("a", params.a), buildSide("b", params.b)];
    if (!sides[0] || !sides[1]) {
        ui.notifications?.warn("1547 Core: both sides need a token with an actor.");
        return;
    }
    if (sides[0].actorUuid === sides[1].actorUuid && params.a.tokenId === params.b.tokenId) {
        ui.notifications?.warn("1547 Core: pick two different combatants.");
        return;
    }
    new SocialBattleApp({ battle: { sides, log: [], over: false, loserKey: null } }).render(true);
}

// Strip "[Mood] …" lines from an actor's Drives. No rest system exists yet to
// call this automatically — expose it so a future rest can clear moods.
export async function clearMoods(actorOrToken) {
    const actor = actorOrToken?.actor ?? actorOrToken;
    if (!actor) return 0;
    const lines = String(actorProps(actor).Drives ?? "").split("\n");
    const kept = lines.filter((l) => !/^\s*\[Mood\]/i.test(l));
    if (kept.length === lines.length) return 0;
    await actor.update({ [DRIVE_PROP]: kept.join("\n") });
    return lines.length - kept.length;
}

export function registerSocialBattleService() {
    Hooks.on("getSceneControlButtons", (controls) => {
        if (!game.user?.isGM) return;
        const toolDef = {
            name: "social-battle",
            title: "Social Battle",
            icon: "fa-solid fa-comments",
            button: true,
            onChange: () => void startSocialBattle()
        };
        // v13 passes a record; older patches passed an array. The token tools
        // group is "tokens" in both.
        const group = Array.isArray(controls) ? controls.find((c) => c?.name === "tokens") : controls?.tokens;
        if (!group) return;
        if (Array.isArray(group.tools)) {
            if (!group.tools.some((t) => t?.name === "social-battle")) group.tools.push(toolDef);
        } else if (group.tools && typeof group.tools === "object") {
            group.tools["social-battle"] = toolDef;
        }
    });

    const api = { start: startSocialBattle, clearMoods };
    const mod = game.modules.get(MODULE_ID);
    if (mod) { mod.api = mod.api ?? {}; mod.api.socialBattle = api; }
    globalThis.SocialBattle1547 = api;
}
