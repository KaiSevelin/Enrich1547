# Facing & Positioning Spec v1

**Status: Source design — drafted from a design discussion with the project owner (rev 2:
design rulings folded in). Implementation is pending.** This is the canonical design for
facing, flanking, and "attacks from behind" — melee **and** ranged. It is deliberately
small: one persistent property (token facing) plus the existing reaction economy, with no
stealth or surprise subsystem.

## Connections

- **Facing geometry already exists.** `scripts/hud/actor-hud.js` derives an 8-way facing
  from token rotation (`getFacingDirection`), computes the front threat cone within weapon
  reach (`getThreatTiles`), and the rear "vulnerability" tile (`getVulnerabilityTiles`).
  Today these are **visual overlays only** (drawn on hover/select in `renderThreatOverlay`)
  with no mechanical effect. See [`hud-spec-v1.md`](hud-spec-v1.md).
- **Advantage dice** are the bonus currency. Attack pools are built in
  `scripts/combat/pool-builder.mjs` (`advantageCount`); advantage is surfaced/edited in the
  HUD. See [`hud-action-system-spec-v1.md`](hud-action-system-spec-v1.md).
- **The reaction economy** is the limiter that makes flanking matter and re-facing costly.
  Defenders/reactors are resolved in `scripts/combat/reaction-candidates.mjs`; the exchange
  flow is in [`combat-resolution-loop-spec-v1.md`](combat-resolution-loop-spec-v1.md) and
  `scripts/combat/attack-lifecycle.mjs` / `lifecycle-flow.mjs`.
- **Initiative / combat membership** is side-based; "surprise" is simply an attack on a
  target **not yet in the encounter** — the opening strike — not a tracked state. See
  [`foundry-side-initiative-encounter-spec-v1.md`](foundry-side-initiative-encounter-spec-v1.md).
- **The Hidden lever** reuses Foundry's built-in token `hidden` flag — no new data.
- **Visualization & automation** — the rear-cone marker and rear +1 are surfaced via the
  ranged-shot overlay; see [`ranged-shot-visualization-spec-v1.md`](ranged-shot-visualization-spec-v1.md).

---

## Goal & design principles

Give positioning real strategic weight while avoiding two known failure modes:

1. **The treadmill** — if "attack from behind = advantage" is purely geometric and cheap to
   set up, every fight degenerates into circling for the back each round.
2. **Surprise blindness** — a rule that auto-faces a defender toward their first attacker
   wrongly lets a target "face" an ambusher they could not possibly have seen.

The fix is to stop treating the bonus as pure geometry and tie re-orientation to the
**reaction economy**, and to let **facing persist between turns**. Surprise then falls out
of a state you already have — whether the target is in the combat encounter yet. Net new
tracking: zero.

Design constraints:

- **No stealth/perception subsystem.** Surprise is initiative + persistent facing.
- **Reuse existing tech** (facing math, advantage dice, reactions, the Hidden flag).
- **Assisted where it's a judgement, enforced where it's deterministic.** The engine
  *suggests* the +1 and never auto-spends a reaction — those stay GM/player choices. It
  *does* enforce the parts with no judgement in them: auto-facing your target on attack, and
  the off-turn rotation/movement lock.

## Core rules

1. **Guarded front; attacking faces your target.** A combatant's facing is its token
   rotation (snapped to 8 directions). The front cone — the same tiles as its
   `getThreatTiles` reach cone — is *guarded*; attacks from the guarded front are defended
   normally. **Whenever you attack a target, you automatically turn to face it** — you
   cannot strike what you are not facing. Committing to an attack therefore sets your facing
   and **exposes your own rear arc** to anyone positioned behind you. Facing changes at only
   three moments: **freely on your own side's turn** (as you move), **automatically when you
   attack**, and via the **Face reaction** (rule 3). While it is **not your side's turn**,
   the engine **locks your token's rotation and movement** during combat, so off-turn facing
   cannot be nudged — forced movement, the Face reaction, and the GM bypass the lock.

2. **Rear attacks gain a flat +1.** An attack gains **+1 advantage die** when the attacker
   stands inside the defender's **rear cone** — the backward mirror of the threat cone,
   extended to the attacker's own weapon distance: melee **reach** for a melee weapon, or the
   weapon's **range band** for a ranged weapon (reversed `getThreatTiles` for melee,
   `getRangeBandTiles` for ranged). So a reach-2 polearm two tiles behind, *and* an archer
   shooting a turned back, both qualify. The cone is a **wedge** that widens with distance —
   the **pure-flank** tiles beside the target are **neutral, no bonus** — so you must be
   *behind*, not merely to the side. For larger tokens the cone springs from the **back
   edge**: the back edge plus one tile on each flank, so a 1×1 has 3 rear tiles at reach 1,
   a 2×2 has 4. The positional bonus is **exactly one die**: it never scales with distance,
   and while it adds to advantage from other sources (maneuvers, etc.), the positional
   component itself is always just that single die.

3. **Face attacker — your defense against a rear hit (and it cancels the +1).** When you are
   struck from your **rear cone** (rule 2 — melee or ranged), you are offered a **"Face
   attacker"** option in that attack's **reaction window**. Taking it **is your defense** against that attack — you turn
   to meet the blow and roll your normal defense as usual — and because you are no longer hit
   from behind by the time it lands, the **+1 is cancelled** and you stay facing the attacker
   afterward. It uses the **same reaction your defense already uses**; it is not an extra
   action layered on top of defending.
   - Because it *is* your normal defense reaction, the "no Face available" cases are exactly
     your existing reaction economy (which refreshes each **full round**): you cannot Face
     when you are not in the combat yet (rule 4), have already spent your reaction this round,
     or the attacker is Hidden (rule 5). In those cases the +1 stands. **That is the whole
     point: the +1 only bites when you cannot react-face it.**
   - Facing is otherwise just the token's rotation, set on your own turn (rule 1).

4. **No combat = no guard (this is the surprise rule).** A combatant has a guarded front
   only while it is **in the active combat encounter**. An attack on a target who is **not
   yet in combat** — the strike that *opens* the fight — is automatically **unguarded (the
   rear +1 applies)**, and the target has **no reaction** to Face or defend with. Resolving
   that opening attack is what brings both sides into the encounter; from
   the target's first turn onward, normal facing (rules 1–3) applies. That is the entire
   surprise mechanic: you ambush by striking *before initiative exists*. No stealth roll, no
   awareness state — just "were they in the fight yet?"

5. **Hidden attackers cannot be faced (optional, mid-combat lever).** For the rarer case of
   a striker who breaks off and re-hides *during* a fight, you may **not** Face an attacker
   whose token is **Hidden** (Foundry's built-in `hidden` flag, the eye-slash the GM already
   toggles), even with a reaction available — you do not know where they are. Their rear +1
   stands; striking typically reveals them (clear the flag), after which
   normal rules resume. This is optional spice on top of rule 4, not required for surprise.

### Optional stance (future, not core)

A **Brace/Guard** action that widens the guarded cone to all-around for one round, traded
against offense (no attack, or reduced offense that round). Gives an explicit answer to
being flanked. Out of scope for v1; listed so the core leaves room for it.

## Why this satisfies the constraints

- **No treadmill.** A lone, known attacker who circles to your back triggers your Face
  reaction, which cancels the +1 outright. So 1-v-1 backstabbing is *not* a free per-round
  win. What remains is a fair trade: the attacker burns movement to reach your rear each
  round, you burn your reaction to face them — and the +1 only connects once you are out of
  reactions or already facing someone else.
- **Flanking rewards teamwork, not footwork.** Two attackers on your rear arc: you can Face
  only one (one reaction/round), so the **other's +1 lands**. You cannot react-face both.
  The interesting decision is "split the angles with your team so they can't face us both,"
  which requires coordination — not a conga line.
- **Engaging commits you.** Because attacking auto-faces your target (rule 1), you cannot
  strike one foe while keeping your guard toward another — turning to attack A bares your
  rear to B. *Whom* you choose to attack is itself a positional decision, and diving on a
  lone target in a melee can leave your own back open.
- **Surprise needs no tracking.** A target who is not in the combat yet has no guarded
  front and no reaction, so the opening strike — the one that *starts* the fight — is an
  unguarded hit by definition (rule 4). Ambush = attack before initiative exists. No
  stealth, perception, or surprise-round state to maintain.
- **The Hidden lever covers the mid-combat case.** A striker who breaks off and re-hides
  *during* a fight is un-faceable while Hidden — using a flag the GM already sets, with no
  new bookkeeping.

## Data model

| Datum | Where it lives | New? |
| --- | --- | --- |
| Facing direction | Token rotation (`token.document.rotation`) | No — already used by the HUD overlay |
| Front cone tiles | Derived (`getThreatTiles`) | No |
| Rear cone (by weapon reach/range) | Derived (reversed `getThreatTiles` / `getRangeBandTiles`, generalised by token size) | No |
| Reaction / defense spent this round | The existing reaction economy (refreshes per **full round**) | Reuse |
| In active combat | Foundry combat tracker (`token.combatant` / `game.combat`) | No — built-in; this is the surprise trigger |
| Active side / whose turn | `game.combat` turn (drives the off-turn rotation/movement lock) | No — built-in |
| Hidden | `token.document.hidden` | No — Foundry built-in |

The genuinely new behaviour is (a) the **off-turn rotation/movement lock** and (b) binding
the **Face reaction to the existing defense reaction**. No new persistent schema fields are
required.

## Engine mapping (auto vs. GM)

- **Auto-detected (suggestion only):** at attack resolution, first check combat membership —
  if the defender is **not in the active `game.combat`**, flag the attack as a
  surprise/opening strike (rear +1, no reaction available). Otherwise test whether the
  attacker stands on a **vulnerability tile** (`getVulnerabilityTiles`); if so, flag
  **"rear — +1 available"** and, if the defender still has a reaction (and the attacker is
  not Hidden), offer the **Face attacker** reaction. The geometry helpers already exist;
  this is a read, not a new computation.
- **GM/player choice:** whether to apply the +1; whether the defender takes the Face
  reaction; whether a token is Hidden. Each is a single click. The system never auto-applies
  the +1 or auto-spends the reaction.

Suggested insertion points:

- **Auto-face (the one thing applied automatically)** — when an attack is declared, rotate
  the **attacker's** token to face the defender. Deterministic, not a judgment call, so it
  can just happen; it also keeps the threat/vulnerability overlays honest.
- **Surprise check** — in the attack lifecycle (`scripts/combat/attack-lifecycle.mjs`),
  before the geometry, if the defender has no combatant in the active `game.combat`, mark
  the attack as an opening/surprise strike (rear +1, no reaction).
- **Rear check** — when an attacker→defender pair is established (and the defender is in
  combat), test whether the attacker lies inside the defender's **rear cone at the
  attacker's weapon distance** (reversed `getThreatTiles` out to melee reach, or
  `getRangeBandTiles` for ranged); if so, attach a `rearAdvantage` hint to the pending
  attack.
- **Reaction window** — when the pending attack carries `rearAdvantage` and the defender has
  their defense reaction available (and the attacker is not Hidden), the **Face attacker**
  option *is* the defender's defense for this attack
  (`scripts/combat/reaction-candidates.mjs`): choosing it rotates the defender toward the
  attacker, **clears `rearAdvantage`**, resolves the normal defense, and consumes the one
  reaction (no extra cost).
- **Off-turn lock** — a `preUpdateToken` hook that, **during combat**, vetoes `rotation` /
  `x` / `y` changes to a token whose side is **not the active side**. Bypassed when the GM
  makes the change, when the update carries an internal flag (the Face reaction, forced
  movement / knockback), or when no combat is active. This is what makes "facing changes
  only on your turn" enforced rather than trusted.
- **HUD surface** — the attack/advantage block (see `hud-render.js` advantage sections)
  shows the "rear +1" hint and a one-click apply toggle for the attacker.

## Edge cases & rulings

- **Reach & ranged from behind.** The rear cone scales with the attacker's weapon: a reach-2
  polearm claims it from two tiles back, a ranged weapon from anywhere in its range band that
  falls in the rear cone. A rear shot still needs line of sight (Foundry enforces it). Any
  range penalty and the rear +1 simply net out in the pool.
- **Arced / indirect shots get no rear +1.** A lobbed shot (the `indirect` maneuver flag —
  Arced Shot, Volley Fire; see [`cover-spec-v1.md`](cover-spec-v1.md)) falls from above and
  ignores facing entirely: it claims no rear bonus (and is exempt from lane interception).
- **Flanks are neutral.** Only the rear cone gives +1. The pure side tiles give nothing —
  being merely beside the target is not enough; you must get behind.
- **Large / multi-tile tokens.** The vulnerability arc is the row behind the **back edge**:
  the back edge plus one tile on each flank. A 1×1 has 3 rear tiles; a 2×2 has 4; an N-wide
  token has N+2. Front cone scales the same way off the front edge.
- **No grid / theatre-of-mind.** With no grid, facing geometry can't be auto-derived; the
  rule degrades to a GM call ("are you behind them? +1, may they Face you?"). The mechanic
  still reads cleanly; the off-turn lock simply does nothing without a grid.
- **Outside combat.** The off-turn lock only applies during an active encounter — players
  rotate and move freely when not in combat. Facing only *matters* once a fight starts.
- **Token rotation not used by the table.** The model assumes players orient tokens. A group
  that never rotates tokens effectively turns the feature off — acceptable, since it is
  opt-in by play style (the overlay already assumes rotation).
- **Reaction already spent.** A combatant who used their reaction (to defend, or to Face an
  earlier attacker) has none left — a later rear attacker keeps the +1. Intended; it is the
  flanking/outnumbered reward.
- **Face A, then B hits your new rear.** Facing attacker A turns your back toward wherever
  you turned *from*. If B is now on your (new) rear arc and you have already spent your
  reaction on A, B's +1 lands. Turning to meet one foe can expose you to another — the
  positional tension is the point.

## Implementation phases

1. **Detection + suggestion (read-only).** Flag opening strikes on targets not yet in
   combat, and test `onVulnerabilityTile` at attack time for those in combat, surfacing a
   non-binding "surprise" / "rear — +1 available" hint in the HUD. No rule enforcement; pure
   tooling. Lowest risk, immediately useful. (The surprise/membership check is the cheapest
   signal — a single read of `game.combat` — and a fine starting point on its own.)
2. **One-click apply + auto-face.** Let the GM/attacker accept the hint to add the +1 die;
   and rotate the attacker's token to face its target on attack (deterministic, trivial).
3. **Face reaction = rear defense.** Make "Face attacker" the defender's defense option for a
   rear hit in the reaction window: rotate to face, clear the +1, resolve the normal defense,
   consume the one reaction — with the not-in-combat and Hidden exclusions (rules 4–5).
4. **Off-turn lock.** `preUpdateToken` veto of `rotation`/`x`/`y` for non-active sides during
   combat, with GM / Face-reaction / forced-movement bypasses. Independent of the rest — can
   land any time after Phase 1.
5. **(Optional, later)** Brace/Guard all-around stance.

## Out of scope (v1)

- Any stealth, perception, awareness, or surprise-round tracking.
- Automatic, enforced application of the +1 (kept GM-assisted by design).
- Cover modifiers, and line-of-sight beyond what Foundry already enforces — cover is its own
  design; see [`cover-spec-v1.md`](cover-spec-v1.md) (ranged obstacle interception).
- Per-creature variable cone widths (all combatants use the same cone shape for now).
