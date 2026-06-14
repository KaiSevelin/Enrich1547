/**
 * Social Battle (Lean MVP).
 *
 * A structured debate resolved as an opposed-roll contest. Each side has a
 * pool of "marks" (2 + battle-stat dice + situational); each exchange both
 * sides roll (a stat OR a skill, Nd6 + Mod) and the loser of the comparison
 * takes a mark — two on a "critical" (rolling more than double the opponent),
 * none on a tie. When a side's marks fill, that side loses and the GM may apply
 * a consequence.
 *
 * All exchange controls live inline in the window (no popup): per side a
 * stat/skill toggle with two dropdowns, an advantage radio (-2..+2), and a
 * stack of "use secret" checkboxes (each ticked secret = +1 advantage die).
 *
 * Reuses the game's own pieces:
 *   - stats read straight off the actor (Stats_<Name>Dice / _Mod),
 *   - skills roll as base-stat dice + the skill's level dice-shift (mirrors the
 *     actor HUD's skill maths),
 *   - a lost battle grants a Drive (or Mood) via the SAME chargen model
 *     (system.props.Drives, "[Category] text" lines) — see chargen/drive-prompts.
 *
 * Launch: a GM-only Scene Controls tool (token group). See Social Battle Light.
 */

import { MODULE_ID } from "../lib/constants.mjs";
import { promptAddDrive } from "../chargen/drive-prompts.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

// The seven stats, matching the actor's Stats_<Name>Dice / _Mod props.
const STATS = ["Strength", "Dexterity", "Stamina", "Intelligence", "Faith", "Charisma", "Power"];
// CSB template id for skill items (the SkillDisplayer filter).
const SKILL_TEMPLATE_ID = "BbwVnEJobtCR5oOf";
// Advantage/disadvantage steps offered per side.
const ADV_STEPS = [-2, -1, 0, 1, 2];
const MIN_MARKS = 1;
const MAX_MARKS = 24;

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

function numProp(props, key) {
    const v = props?.[key];
    if (v === undefined || v === null || v === "") return null;
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
}
// Mirrors the actor HUD's getSkillDiceShift: explicit DiceShift, else the
// shift for the skill's CurrentLevel.
function skillDiceShift(props) {
    const explicit = numProp(props, "DiceShift");
    if (explicit !== null) return explicit;
    const lvl = numProp(props, "CurrentLevel") ?? 0;
    return numProp(props, `Level${lvl}DiceShift`) ?? 0;
}
function actorSkills(actor) {
    return [...(actor?.items ?? [])]
        .filter((i) => i.system?.template === SKILL_TEMPLATE_ID)
        .map((i) => ({ id: i.id, name: i.name }))
        .sort((a, b) => a.name.localeCompare(b.name));
}
function drivesTooltip(actor) {
    const lines = String(actorProps(actor).Drives ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
    return lines.length ? `Drives:\n${lines.join("\n")}` : "No drives.";
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

async function rollPool(dice, mod) {
    const d = Math.max(0, Number(dice) || 0);
    const m = Number(mod) || 0;
    const formula = d > 0 ? (m ? `${d}d6 + ${m}` : `${d}d6`) : String(m || 0);
    const roll = await new Roll(formula).evaluate();
    if (game.dice3d?.showForRoll) { try { await game.dice3d.showForRoll(roll, game.user, true); } catch { /* non-fatal */ } }
    return { roll, total: Number(roll.total) || 0, formula };
}

// Resolve a side's chosen action into a concrete dice pool for this exchange.
function sidePool(side) {
    const actor = actorOf(side);
    const secrets = side.secret ? 1 : 0;
    const adv = Number(side.advantage) || 0;

    let baseStat;
    let diceShift = 0;
    let label;
    if (side.mode === "skill" && side.selSkill) {
        const skill = actor?.items?.get(side.selSkill);
        const sp = skill?.system?.props ?? {};
        baseStat = String(sp.Group ?? "").trim() || side.selStat || side.stat;
        diceShift = skillDiceShift(sp);
        label = skill?.name ? `${skill.name} (${baseStat})` : baseStat;
    } else {
        baseStat = side.selStat || side.stat;
        label = baseStat;
    }

    const dice = statDice(actor, baseStat) + diceShift + adv + secrets;
    const mod = statMod(actor, baseStat);
    return { actor, baseStat, label, dice: Math.max(0, dice), mod, secrets, adv };
}

/* ---------------------------------------- */
/*  Outcome dialogs (mood) + chat           */
/* ---------------------------------------- */

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

async function postExchangeCard(battle, pa, pb, ra, rb, line) {
    const [A, B] = battle.sides;
    const loser = battle.over ? battle.sides.find((s) => s.key === battle.loserKey) : null;
    const tag = (p) => `${p.secrets ? ` +${p.secrets} secret` : ""}${p.adv ? ` ${p.adv > 0 ? "+" : ""}${p.adv} adv` : ""}`;
    const content = `
    <div class="sb-card">
      <h3 style="margin:.1rem 0;">Social Battle — Exchange</h3>
      <p style="margin:.1rem 0;">${escapeHtml(A.name)} <em>(${escapeHtml(pa.label)}${escapeHtml(tag(pa))})</em>: <strong>${ra.total}</strong> <span style="opacity:.65">[${escapeHtml(ra.formula)}]</span></p>
      <p style="margin:.1rem 0;">${escapeHtml(B.name)} <em>(${escapeHtml(pb.label)}${escapeHtml(tag(pb))})</em>: <strong>${rb.total}</strong> <span style="opacity:.65">[${escapeHtml(rb.formula)}]</span></p>
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
        position: { width: 620, height: "auto" },
        actions: {
            "exchange": function () { return this._onExchange(); },
            "mark-add": function (event, target) { return this._onMark(target.dataset.side, 1); },
            "mark-remove": function (event, target) { return this._onMark(target.dataset.side, -1); },
            "grant-drive": function () { return this._onGrant(false); },
            "grant-mood": function () { return this._onGrant(true); },
            "reset": function () { return this._onReset(); }
        }
    };

    static PARTS = {
        body: { template: "modules/1547core/templates/social/social-battle.hbs" }
    };

    // Read the inline controls back into battle state so they survive re-render.
    _captureForm() {
        const root = this.element;
        if (!root) return;
        for (const s of this._battle.sides) {
            const mode = root.querySelector(`input[name="mode-${s.key}"]:checked`)?.value;
            if (mode) s.mode = mode;
            const stat = root.querySelector(`select[name="stat-${s.key}"]`)?.value;
            if (stat) s.selStat = stat;
            const skill = root.querySelector(`select[name="skill-${s.key}"]`);
            if (skill) s.selSkill = skill.value;
            const adv = root.querySelector(`input[name="adv-${s.key}"]:checked`)?.value;
            if (adv !== undefined) s.advantage = Number(adv) || 0;
            s.secret = !!root.querySelector(`input[name="secret-${s.key}"]`)?.checked;
        }
    }

    async _prepareContext() {
        const b = this._battle;
        const sides = b.sides.map((s) => {
            const actor = actorOf(s);
            return {
                key: s.key,
                name: s.name,
                stat: s.stat,
                drivesTooltip: drivesTooltip(actor),
                taken: s.taken,
                total: s.total,
                pips: Array.from({ length: s.total }, (_, i) => i < s.taken),
                isLoser: b.over && b.loserKey === s.key,
                isWinner: b.over && b.loserKey && b.loserKey !== s.key,
                isStat: s.mode !== "skill",
                isSkill: s.mode === "skill",
                statOptions: STATS.map((st) => ({ value: st, selected: st === s.selStat })),
                skillOptions: actorSkills(actor).map((sk) => ({ value: sk.id, name: sk.name, selected: sk.id === s.selSkill })),
                advOptions: ADV_STEPS.map((v) => ({ value: v, label: v > 0 ? `+${v}` : String(v), checked: v === (Number(s.advantage) || 0) })),
                secret: !!s.secret
            };
        });
        return {
            sides,
            over: b.over,
            loser: b.over ? b.sides.find((x) => x.key === b.loserKey) : null,
            log: b.log.slice(-8).reverse()
        };
    }

    // Adjust a side's mark boxes mid-battle, mirroring the race board's per-row
    // box +/-. Recomputes the win/loss state so adding boxes can revive a side
    // and removing them can end the battle.
    async _onMark(key, delta) {
        this._captureForm();
        const b = this._battle;
        const side = b.sides.find((s) => s.key === key);
        if (!side) return;
        side.total = Math.max(MIN_MARKS, Math.min(MAX_MARKS, side.total + delta));
        side.taken = Math.min(side.taken, side.total);
        b.over = false;
        b.loserKey = null;
        for (const s of b.sides) {
            if (s.taken >= s.total) { b.over = true; b.loserKey = s.key; }
        }
        this.render();
    }

    async _onExchange() {
        const b = this._battle;
        if (b.over) return;
        this._captureForm();

        const [A, B] = b.sides;
        const pa = sidePool(A);
        const pb = sidePool(B);
        const ra = await rollPool(pa.dice, pa.mod);
        const rb = await rollPool(pb.dice, pb.mod);

        let line;
        let crit = false;
        if (ra.total === rb.total) {
            line = `Tie at ${ra.total} — no marks.`;
        } else if (ra.total > rb.total) {
            const m = marksFromExchange(ra.total, rb.total);
            crit = m === 2;
            B.taken = Math.min(B.total, B.taken + m);
            line = `${A.name} wins ${ra.total} vs ${rb.total} → ${B.name} takes ${m} mark${m > 1 ? "s (critical)" : ""}.`;
        } else {
            const m = marksFromExchange(rb.total, ra.total);
            crit = m === 2;
            A.taken = Math.min(A.total, A.taken + m);
            line = `${B.name} wins ${rb.total} vs ${ra.total} → ${A.name} takes ${m} mark${m > 1 ? "s (critical)" : ""}.`;
        }
        b.log.push(line);

        for (const s of b.sides) {
            if (s.taken >= s.total) { b.over = true; b.loserKey = s.key; }
        }

        await postExchangeCard(b, pa, pb, ra, rb, line);
        await this.render();
        if (crit) this._flashCrit();
    }

    _flashCrit() {
        const el = this.element;
        if (!el) return;
        el.classList.remove("sb-crit-flash");
        // Reflow so re-adding the class restarts the animation.
        void el.offsetWidth;
        el.classList.add("sb-crit-flash");
        setTimeout(() => el.classList.remove("sb-crit-flash"), 850);
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
        this._captureForm();
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

function statOptions(selected) {
    return STATS.map((s) => `<option value="${s}" ${s === selected ? "selected" : ""}>${s}</option>`).join("");
}
function tokenOptions(tokens, selectedId) {
    return tokens.map((t) => `<option value="${t.id}" ${t.id === selectedId ? "selected" : ""}>${escapeHtml(t.name)}</option>`).join("");
}

// Setup: choose the two combatants, each side's battle stat, and situational marks.
function promptSetup(tokens, aTok, bTok) {
    return new Promise((resolve) => {
        let settled = false;
        const finish = (v) => { if (!settled) { settled = true; resolve(v); } };
        new Dialog({
            title: "Start Social Battle",
            content: `
        <div class="sb-setup">
          <p class="sb-hint">Each side's marks = 2 + the chosen battle stat's dice (+ any situational marks the GM grants).</p>
          <div class="sb-setup-side">
            <h3>Side A</h3>
            <label>Combatant <select name="aTok">${tokenOptions(tokens, aTok?.id)}</select></label>
            <label>Battle stat <select name="aStat">${statOptions("Charisma")}</select></label>
            <label>Situational marks <input type="number" name="aSit" value="0" min="0" max="3" step="1"></label>
          </div>
          <div class="sb-setup-side">
            <h3>Side B</h3>
            <label>Combatant <select name="bTok">${tokenOptions(tokens, bTok?.id)}</select></label>
            <label>Battle stat <select name="bStat">${statOptions("Stamina")}</select></label>
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

function buildSide(key, sel) {
    const tok = canvas?.tokens?.get(sel.tokenId);
    const actor = tok?.actor;
    if (!actor) return null;
    const dice = statDice(actor, sel.stat);
    return {
        key,
        name: tok.name,
        actorUuid: actor.uuid,
        stat: sel.stat,                 // battle stat: sets marks
        total: 2 + dice + (Number(sel.situational) || 0),
        taken: 0,
        // Per-exchange control state (inline form).
        mode: "stat",
        selStat: sel.stat,
        selSkill: "",
        advantage: 0,
        secret: false      // single "use secret" toggle (+1 die when ticked)
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
