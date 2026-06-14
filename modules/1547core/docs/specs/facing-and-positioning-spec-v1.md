# Facing & Positioning Spec v1

**Status: Source design — drafted from a design discussion with the project owner.
Implementation is pending.** This is the canonical design for melee facing, flanking,
and "attacks from behind." It is deliberately small: one persistent property (token
facing) plus the existing reaction economy, with no stealth or surprise subsystem.

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
- **GM-assisted, not enforced.** The engine *detects and suggests*; it never forces the
  advantage or auto-spends a reaction. It is a tool, not a straitjacket.

## Core rules

1. **Guarded front; attacking faces your target.** A combatant's facing is its token
   rotation (snapped to 8 directions). The front cone — the same tiles as its
   `getThreatTiles` reach cone — is *guarded*; attacks from the guarded front are defended
   normally. **Whenever you attack a target, you automatically turn to face it** — you
   cannot strike what you are not facing. Committing to an attack therefore sets your facing
   and **exposes your own rear arc** to anyone positioned behind you.

2. **Rear attacks gain a flat +1.** An attack whose attacker stands on one of the
   defender's **vulnerability tiles** — the rear arc, the three tiles mirroring the front
   cone (`getVulnerabilityTiles`) — grants the attacker **+1 advantage die**. This is the
   only positional bonus and it **never stacks higher** than +1. The two pure-flank tiles
   (directly to either side) are neither guarded nor vulnerable — **neutral, no bonus** — so
   the bonus requires actually getting *behind* the target, not merely adjacent.

3. **Face attacker — a reaction that cancels the hit's bonus.** When you are struck from a
   vulnerability tile, you are offered a **"Face attacker"** option in that attack's
   **reaction window**. Taking it turns you to face the attacker *before the blow lands*, so
   you are no longer hit from behind: the **+1 is cancelled for that attack**, and you stay
   facing them afterward. It costs your **reaction for the round**, so it is available **once
   per round**.
   - Facing is otherwise just the token's rotation, set freely as part of moving on your own
     turn. The Face reaction is the only mid-combat facing interaction.
   - The Face reaction is **unavailable when you have no reaction to spend** — because you
     are not in the combat yet (rule 4), you already spent your reaction this round, or the
     attacker is Hidden (rule 5). In those cases the +1 stands. **This is the whole point:
     the +1 only bites when you cannot react-face it.**

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
| Flank/rear tile(s) | Derived (`getVulnerabilityTiles` / "not in front cone") | No |
| Reaction spent this round | Per-combatant round flag in the reaction economy | Reuse — reactions already gate per round |
| In active combat | Foundry combat tracker (`token.combatant` / `game.combat`) | No — built-in; this is the surprise trigger |
| Hidden | `token.document.hidden` | No — Foundry built-in |

The only genuinely new behaviour is the *rule* binding facing changes to the reaction
economy. No new persistent schema fields are required.

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
  combat), test `onVulnerabilityTile(defender, attacker)` and attach a `rearAdvantage` hint
  to the pending attack.
- **Reaction window** — when the pending attack carries `rearAdvantage` and the defender has
  a reaction (and the attacker is not Hidden), present the **Face attacker** option among
  the defender's reaction candidates (`scripts/combat/reaction-candidates.mjs`). Choosing it
  rotates the defender toward the attacker, **clears `rearAdvantage` for this attack**, and
  consumes the reaction.
- **HUD surface** — the attack/advantage block (see `hud-render.js` advantage sections)
  shows the "rear +1" hint and a one-click apply toggle for the attacker.

## Edge cases & rulings

- **Ranged attacks.** A target cannot meaningfully "guard" against ranged fire by facing;
  v1 applies the rear +1 to **melee only**. Ranged uses the existing range bands.
- **Flanks are neutral.** Only the three rear (vulnerability) tiles give +1. The two pure
  side tiles give nothing — being merely adjacent is not enough; you must get behind.
- **No grid / theatre-of-mind.** With no grid, facing geometry can't be auto-derived; the
  rule degrades to a GM call ("are you behind them? +1, may they Face you?"). The mechanic
  still reads cleanly.
- **Token rotation not used by the table.** The whole model assumes players orient tokens.
  If a group never rotates tokens, facing is undefined and the feature is effectively off —
  acceptable, since it is opt-in by play style (the overlay already assumes rotation).
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
2. **One-click apply.** Let the GM/attacker accept the hint to add the +1 die to the pool.
3. **Face reaction.** Add the defender "Face attacker" option in the reaction window when a
   rear attack lands: rotate to face, clear the attack's +1, consume the reaction
   (once/round), with the not-in-combat and Hidden exclusions (rules 4–5).
4. **(Optional, later)** Brace/Guard all-around stance.

## Out of scope (v1)

- Any stealth, perception, awareness, or surprise-round tracking.
- Automatic, enforced application of the bonus (kept GM-assisted by design).
- Facing affecting ranged attacks, line-of-sight, or cover (cover is a separate concern).
- Per-creature variable cone widths (all combatants use the same front cone for now).
