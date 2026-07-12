/**
 * Social Battle (Lean MVP).
 *
 * A structured debate resolved as an opposed-roll contest. Each side has a row
 * of mark boxes (2 + battle-stat dice + situational); each exchange both sides
 * roll (a stat OR a skill, Nd6 + Mod, floored at 1d6) and the loser of the
 * comparison takes a mark — two on a "critical" (rolling more than double the
 * opponent), none on a tie. When a side's boxes fill, that side loses and the
 * GM may apply a consequence.
 *
 * The mark boxes borrow the race board's look and behaviour: square boxes,
 * left-click to tick, right-click to cycle an event-step colour (red/amber),
 * per-side +/- to add/remove boxes, plus a board-level alarm meter and a
 * reveal-to-players control (socket-mirrored, read-only, for the players).
 *
 * Reuses the game's own pieces: stats off the actor (Stats_<Name>Dice / _Mod);
 * skills roll as base-stat dice + the skill's level dice-shift (mirrors the HUD);
 * a lost battle grants a Drive/Mood via the chargen model (system.props.Drives).
 *
 * Launch: a GM-only Scene Controls tool (token group). See Social Battle Light.
 */

import { MODULE_ID, SOURCE_FLAG_SCOPE } from "../lib/constants.mjs";
import { statDice, statMod, escapeHtml } from "../lib/foundry-utils.mjs";
import { numProp, skillDiceShift, marksFromExchange, socialPoolFormula } from "./social-math.mjs";
import { promptAddDrive } from "../chargen/drive-prompts.js";
import {
    buildAlarmContext, defaultAlarm, ALARM_MAX_LEVEL,
    buildVisibilityOptions, normalizeVisibility, VISIBILITY_HIDDEN, VISIBILITY_ALL
} from "../raceboard/raceboard-data.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const STATS = ["Strength", "Dexterity", "Stamina", "Intelligence", "Faith", "Charisma", "Power"];
const SKILL_TEMPLATE_ID = "BbwVnEJobtCR5oOf";
const ADV_STEPS = [-2, -1, 0, 1, 2];
const MIN_MARKS = 1;
const MAX_MARKS = 24;
const EVENT_STATE_COUNT = 3;       // none → red(1) → amber(2) → none

const DRIVE_PROP = "system.props.Drives";
const SOCIAL_DRIVE_CATEGORY = "Social Battle";

// Read-only player mirrors, keyed by battle id, kept in sync over the socket.
const sbMirrors = new Map();

/* ---------------------------------------- */
/*  Small helpers                           */
/* ---------------------------------------- */

function actorProps(actor) { return actor?.system?.props ?? {}; }
function activeParticipant(side) { return side?.participants?.[side?.activeIdx ?? 0] ?? null; }
function activeName(side) { return activeParticipant(side)?.name ?? "?"; }
function actorOf(side) {
    const uuid = activeParticipant(side)?.actorUuid;
    return uuid ? fromUuidSync(uuid) : null;
}

// numProp / skillDiceShift / marksFromExchange / socialPoolFormula moved to
// social-math.mjs (pure, unit-tested) — imported at the top of this file.
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
/* ---------------------------------------- */
/*  Rolling                                 */
/* ---------------------------------------- */

// The lowest possible roll is 1d6 with no modifier — a 0-or-negative pool
// (untrained, heavy disadvantage) still rolls a single die, never a flat 0.
async function rollPool(dice, mod) {
    const formula = socialPoolFormula(dice, mod);
    const roll = await new Roll(formula).evaluate();
    if (game.dice3d?.showForRoll) { try { await game.dice3d.showForRoll(roll, game.user, true); } catch { /* non-fatal */ } }
    return { roll, total: Number(roll.total) || 0, formula };
}

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
        const sd = skill?.flags?.[SOURCE_FLAG_SCOPE]?.sourceData ?? skill?.flags?.[MODULE_ID]?.sourceData ?? {};
        // A skill's base stat is its linked Stat (mirrors the HUD), NOT its Group.
        baseStat = String(sp.Stat ?? sd.linkedStat ?? sp.LinkedStat ?? "").trim() || side.selStat || side.stat;
        diceShift = skillDiceShift(sp);
        label = skill?.name ? `${skill.name} (${baseStat})` : baseStat;
    } else {
        baseStat = side.selStat || side.stat;
        label = baseStat;
    }

    const dice = statDice(actor, baseStat) + diceShift + adv + secrets;
    const mod = statMod(actor, baseStat);
    return { actor, baseStat, label, dice, mod, secrets, adv };
}

/* ---------------------------------------- */
/*  Outcome dialogs (mood) + chat           */
/* ---------------------------------------- */

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

async function postExchangeCard(battle, an, bn, pa, pb, ra, rb, line) {
    const [A, B] = battle.sides;
    const loserName = battle.over ? activeName(battle.sides.find((s) => s.key === battle.loserKey)) : "";
    const tag = (p) => `${p.secrets ? ` +${p.secrets} secret` : ""}${p.adv ? ` ${p.adv > 0 ? "+" : ""}${p.adv} adv` : ""}`;
    const content = `
    <div class="sb-card">
      <h3 style="margin:.1rem 0;">Social Battle — Exchange</h3>
      <p style="margin:.1rem 0;">${escapeHtml(an)} <em>(${escapeHtml(pa.label)}${escapeHtml(tag(pa))})</em>: <strong>${ra.total}</strong> <span style="opacity:.65">[${escapeHtml(ra.formula)}]</span></p>
      <p style="margin:.1rem 0;">${escapeHtml(bn)} <em>(${escapeHtml(pb.label)}${escapeHtml(tag(pb))})</em>: <strong>${rb.total}</strong> <span style="opacity:.65">[${escapeHtml(rb.formula)}]</span></p>
      <p style="margin:.25rem 0 .1rem;">${escapeHtml(line)}</p>
      <p style="margin:.1rem 0;opacity:.8;">${escapeHtml(an)} ${A.filled}/${A.total} &middot; ${escapeHtml(bn)} ${B.filled}/${B.total}</p>
      ${loserName ? `<p style="margin:.25rem 0 0;color:#b3261e;"><strong>${escapeHtml(loserName)} loses the battle.</strong></p>` : ""}
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
        this._readOnly = !!options.readOnly;
    }

    static DEFAULT_OPTIONS = {
        id: "social-battle-{id}",
        classes: ["social-battle-app"],
        tag: "section",
        window: { title: "Social Battle", icon: "fa-solid fa-comments", resizable: true },
        position: { width: 640, height: "auto" },
        actions: {
            "exchange": function () { return this._onExchange(); },
            "mark-tick": function (event, target) { return this._onTick(target.dataset.side, Number(target.dataset.box)); },
            "mark-add": function (event, target) { return this._onMark(target.dataset.side, 1); },
            "mark-remove": function (event, target) { return this._onMark(target.dataset.side, -1); },
            "alarm-add": function () { return this._onAlarm("add"); },
            "alarm-remove": function () { return this._onAlarm("remove"); },
            "alarm-up": function () { return this._onAlarm("up"); },
            "set-visibility": function (event, target) { return this._onSetVisibility(Number(target.dataset.level)); },
            "grant-drive": function () { return this._onGrant(false); },
            "grant-mood": function () { return this._onGrant(true); },
            "reset": function () { return this._onReset(); },
            "toggle-collapse": function () { return this._onToggleCollapse(); }
        }
    };

    // Collapse/expand to just the title strip via a root class (no re-render, so
    // it survives exchanges/syncs; the icon swaps in CSS).
    _onToggleCollapse() {
        this._collapsed = !this._collapsed;
        this.element?.classList.toggle("is-collapsed", this._collapsed);
    }

    static PARTS = {
        body: { template: "modules/1547core/templates/social/social-battle.hbs" }
    };

    get canEdit() { return !this._readOnly && !!game.user?.isGM; }
    get showExtras() { return this.canEdit || normalizeVisibility(this._battle?.visibility) === VISIBILITY_ALL; }

    // Read the inline controls back into battle state so they survive re-render.
    _captureForm() {
        const root = this.element;
        if (!root || !this.canEdit) return;
        for (const s of this._battle.sides) {
            const active = root.querySelector(`select[name="active-${s.key}"]`);
            if (active) s.activeIdx = Number(active.value) || 0;
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
        const canEdit = this.canEdit;
        const showExtras = this.showExtras;
        const sides = b.sides.map((s) => {
            const actor = canEdit ? actorOf(s) : null;
            const events = s.events || [];
            return {
                key: s.key,
                activeName: activeName(s),
                canPickActive: canEdit && (s.participants?.length ?? 0) > 1,
                participants: (s.participants ?? []).map((p, i) => ({ name: p.name, idx: i, selected: i === s.activeIdx })),
                stat: s.stat,
                drivesTooltip: canEdit ? drivesTooltip(actor) : "",
                filled: s.filled,
                total: s.total,
                boxes: Array.from({ length: s.total }, (_, i) => ({
                    idx: i,
                    checked: i < s.filled,
                    reached: i < s.filled,
                    eventState: showExtras ? (events.find((e) => e.index === i)?.state ?? 0) : 0
                })),
                isLoser: b.over && b.loserKey === s.key,
                isWinner: b.over && b.loserKey && b.loserKey !== s.key,
                isStat: s.mode !== "skill",
                isSkill: s.mode === "skill",
                statOptions: STATS.map((st) => ({ value: st, selected: st === s.selStat })),
                skillOptions: canEdit ? actorSkills(actor).map((sk) => ({ value: sk.id, name: sk.name, selected: sk.id === s.selSkill })) : [],
                advOptions: ADV_STEPS.map((v) => ({ value: v, label: v > 0 ? `+${v}` : String(v), checked: v === (Number(s.advantage) || 0) })),
                secret: !!s.secret
            };
        });
        return {
            sides,
            canEdit,
            over: b.over,
            loser: b.over ? { name: activeName(b.sides.find((x) => x.key === b.loserKey)) } : null,
            log: b.log.slice(-8).reverse(),
            alarm: buildAlarmContext(b.alarm, { showExtras, canControl: canEdit }),
            visibilityOptions: canEdit ? buildVisibilityOptions(b.visibility) : []
        };
    }

    /* ----- mutation + sync ----- */

    // Re-render locally and, if this board is revealed, push the new state to the
    // players' read-only mirrors.
    async _sync() {
        await this.render();
        if (this._readOnly || !game.user?.isGM) return;
        if (normalizeVisibility(this._battle.visibility) === VISIBILITY_HIDDEN) return;
        game.socket.emit(`module.${MODULE_ID}`, { type: "sb-update", id: this._battle.id, state: this._battle });
    }

    _recomputeOutcome() {
        const b = this._battle;
        b.over = false;
        b.loserKey = null;
        for (const s of b.sides) {
            if (s.filled >= s.total) { b.over = true; b.loserKey = s.key; }
        }
    }

    async _onTick(key, boxIdx) {
        if (!this.canEdit || !Number.isInteger(boxIdx)) return;
        const side = this._battle.sides.find((s) => s.key === key);
        if (!side) return;
        if (boxIdx < side.filled) side.filled = Math.max(0, side.filled - 1);
        else side.filled = Math.min(side.total, side.filled + 1);
        this._recomputeOutcome();
        await this._sync();
    }

    // Right-click a box: cycle its event-step marker (none → red → amber → none).
    async _onMarkEvent(key, boxIdx) {
        if (!this.canEdit || !Number.isInteger(boxIdx)) return;
        const side = this._battle.sides.find((s) => s.key === key);
        if (!side) return;
        const events = (side.events ?? []).filter((e) => e.index !== boxIdx);
        const current = (side.events ?? []).find((e) => e.index === boxIdx)?.state ?? 0;
        const next = (current + 1) % EVENT_STATE_COUNT;
        if (next > 0) events.push({ index: boxIdx, state: next });
        events.sort((a, b) => a.index - b.index);
        side.events = events;
        await this._sync();
    }

    async _onMark(key, delta) {
        if (!this.canEdit) return;
        this._captureForm();
        const side = this._battle.sides.find((s) => s.key === key);
        if (!side) return;
        side.total = Math.max(MIN_MARKS, Math.min(MAX_MARKS, side.total + delta));
        side.filled = Math.min(side.filled, side.total);
        side.events = (side.events ?? []).filter((e) => e.index < side.total);
        this._recomputeOutcome();
        await this._sync();
    }

    async _onAlarm(op) {
        if (!this.canEdit) return;
        const b = this._battle;
        const a = b.alarm ?? defaultAlarm();
        if (op === "add") b.alarm = { ...a, enabled: true };
        else if (op === "remove") b.alarm = defaultAlarm();
        else if (op === "up") b.alarm = { ...a, level: Math.min(ALARM_MAX_LEVEL, (a.level ?? 0) + 1) };
        else if (op === "down") b.alarm = { ...a, level: Math.max(0, (a.level ?? 0) - 1) };
        await this._sync();
    }

    async _onSetVisibility(level) {
        if (!this.canEdit) return;
        const next = normalizeVisibility(level);
        const prev = normalizeVisibility(this._battle.visibility);
        if (next === prev) return;
        this._battle.visibility = next;
        if (next === VISIBILITY_HIDDEN) {
            game.socket.emit(`module.${MODULE_ID}`, { type: "sb-hide", id: this._battle.id });
            await this.render();
        } else if (prev === VISIBILITY_HIDDEN) {
            game.socket.emit(`module.${MODULE_ID}`, { type: "sb-show", id: this._battle.id, state: this._battle });
            await this.render();
        } else {
            await this._sync(); // level 1 ↔ 2: refresh the existing mirrors
        }
    }

    async _onExchange() {
        const b = this._battle;
        if (b.over) return;
        this._captureForm();

        const [A, B] = b.sides;
        const an = activeName(A);
        const bn = activeName(B);
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
            B.filled = Math.min(B.total, B.filled + m);
            line = `${an} wins ${ra.total} vs ${rb.total} → ${bn} takes ${m} mark${m > 1 ? "s (critical)" : ""}.`;
        } else {
            const m = marksFromExchange(rb.total, ra.total);
            crit = m === 2;
            A.filled = Math.min(A.total, A.filled + m);
            line = `${bn} wins ${rb.total} vs ${ra.total} → ${an} takes ${m} mark${m > 1 ? "s (critical)" : ""}.`;
        }
        b.log.push(line);
        this._recomputeOutcome();

        await postExchangeCard(b, an, bn, pa, pb, ra, rb, line);
        // Reset each side's controls so advantage/secret/stat choice don't carry
        // over to the next exchange (secrets are spent).
        b.sides.forEach(resetSideControls);
        await this._sync();
        if (crit) this._flashCrit();
    }

    _flashCrit() {
        const el = this.element;
        if (!el) return;
        el.classList.remove("sb-crit-flash");
        void el.offsetWidth;
        el.classList.add("sb-crit-flash");
        setTimeout(() => el.classList.remove("sb-crit-flash"), 850);
    }

    async _onGrant(mood) {
        const b = this._battle;
        if (!b.over || !this.canEdit) return;
        const loser = b.sides.find((s) => s.key === b.loserKey);
        const actor = actorOf(loser);
        if (!actor) { ui.notifications?.warn("1547 Core: couldn't resolve the losing actor to apply the outcome."); return; }
        if (mood) await grantMood(actor);
        else await promptAddDrive(actor, SOCIAL_DRIVE_CATEGORY);
    }

    async _onReset() {
        if (!this.canEdit) return;
        this._captureForm();
        const b = this._battle;
        for (const s of b.sides) { s.filled = 0; s.events = []; }
        b.over = false;
        b.loserKey = null;
        b.log = [];
        await this._sync();
    }

    async _onRender(context, options) {
        await super._onRender?.(context, options);
        if (!this.canEdit) return;
        for (const box of this.element.querySelectorAll('.rb-box[data-action="mark-tick"]')) {
            box.addEventListener("contextmenu", (ev) => { ev.preventDefault(); void this._onMarkEvent(box.dataset.side, Number(box.dataset.box)); });
        }
        const alarmIcon = this.element.querySelector('.rb-alarm-icon[data-action="alarm-up"]');
        alarmIcon?.addEventListener("contextmenu", (ev) => { ev.preventDefault(); void this._onAlarm("down"); });
        // Switching the acting individual re-renders so the stat/skill dropdowns
        // reflect the newly-active actor.
        for (const sel of this.element.querySelectorAll('select[name^="active-"]')) {
            sel.addEventListener("change", () => {
                this._captureForm();
                const side = this._battle.sides.find((s) => s.key === sel.name.slice("active-".length));
                if (side) { side.activeIdx = Number(sel.value) || 0; side.selSkill = ""; side.mode = "stat"; }
                void this._sync();
            });
        }
    }

    async _onClose(options) {
        await super._onClose?.(options);
        if (this._readOnly) {
            sbMirrors.delete(this._battle?.id);
        } else if (game.user?.isGM && normalizeVisibility(this._battle?.visibility) !== VISIBILITY_HIDDEN) {
            // Closing a revealed board hides the players' mirrors too.
            game.socket.emit(`module.${MODULE_ID}`, { type: "sb-hide", id: this._battle.id });
        }
    }
}

/* ---------------------------------------- */
/*  Launch + registration                   */
/* ---------------------------------------- */

function buildSide(key, toks, battleStat) {
    const participants = toks
        .filter((t) => t?.actor)
        .map((t) => ({ name: t.name, actorUuid: t.actor.uuid }));
    if (!participants.length) return null;
    const active = fromUuidSync(participants[0].actorUuid);
    const dice = statDice(active, battleStat);
    return {
        key,
        participants,
        activeIdx: 0,               // the acting individual (their stats/skills roll)
        stat: battleStat,           // battle stat: sets the initial mark count
        filled: 0,
        total: Math.max(MIN_MARKS, 2 + dice),
        events: [],
        // Per-exchange control state (inline form); reset to these after each roll.
        mode: "stat",
        selStat: battleStat,
        selSkill: "",
        advantage: 0,
        secret: false
    };
}

// Reset a side's per-exchange controls to defaults (run after each roll, so the
// advantage, secret and stat/skill choice don't carry over and secrets are spent).
function resetSideControls(side) {
    side.mode = "stat";
    side.selStat = side.stat;
    side.selSkill = "";
    side.advantage = 0;
    side.secret = false;
}

// No setup dialog: Side A is the controlled token, Side B the targeted token
// (falling back to the first two tokens on the scene). Battle stats default to
// Charisma vs Stamina; the GM tunes marks with the per-side +/- and rolls any
// stat/skill per exchange.
export async function startSocialBattle() {
    const tokens = (canvas?.tokens?.placeables ?? []).filter((t) => t.actor);
    if (tokens.length < 2) {
        ui.notifications?.warn("1547 Core: place at least two tokens with actors on the scene to start a social battle.");
        return;
    }
    // Side A = every controlled token; Side B = every targeted token. Fall back
    // to the first two distinct tokens when nothing is selected/targeted. B is
    // de-duped against A so a token can't end up on both sides.
    const controlled = canvas.tokens.controlled.filter((t) => t.actor);
    const targeted = [...(game.user?.targets ?? [])].filter((t) => t.actor);
    const aToks = controlled.length ? controlled : [tokens[0]];
    let bToks = (targeted.length ? targeted : [tokens.find((t) => !aToks.includes(t))])
        .filter((t) => t && !aToks.includes(t));
    if (!bToks.length) bToks = [tokens.find((t) => !aToks.includes(t))].filter(Boolean);

    const sides = [buildSide("a", aToks, "Charisma"), buildSide("b", bToks, "Stamina")];
    if (!sides[0] || !sides[1]) {
        ui.notifications?.warn("1547 Core: both sides need at least one token with an actor.");
        return;
    }
    const battle = {
        id: foundry.utils.randomID(),
        sides,
        log: [],
        over: false,
        loserKey: null,
        alarm: defaultAlarm(),
        visibility: VISIBILITY_HIDDEN
    };
    new SocialBattleApp({ battle }).render(true);
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

// Players receive the GM's reveal/update/hide messages and mirror the board
// read-only. GM clients ignore their own broadcasts.
function registerSocialBattleSocket() {
    game.socket.on(`module.${MODULE_ID}`, (msg) => {
        if (!msg || typeof msg !== "object" || game.user?.isGM) return;
        if (msg.type === "sb-show") {
            let app = sbMirrors.get(msg.id);
            if (!app) {
                app = new SocialBattleApp({ battle: msg.state, readOnly: true });
                sbMirrors.set(msg.id, app);
            } else {
                app._battle = msg.state;
            }
            app.render(true);
        } else if (msg.type === "sb-update") {
            const app = sbMirrors.get(msg.id);
            if (app) { app._battle = msg.state; app.render(); }
        } else if (msg.type === "sb-hide") {
            sbMirrors.get(msg.id)?.close();
        }
    });
}

export function registerSocialBattleService() {
    registerSocialBattleSocket();

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
