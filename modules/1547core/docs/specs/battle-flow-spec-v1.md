# Battle Flow Spec v1 — the whole combat loop

**Status: Reference (as-built).** This describes how a fight actually runs in `1547core`
today — the round/side model, the attack lifecycle, maneuvers, reactions, dice, positioning,
defense, damage, and critical points — and how the pieces wire together across files and
across clients. It is descriptive (what the code does), with a final section listing the
**known gaps and fragilities** that explain the live-test issues. Companion specs go deeper on
individual areas (facing, cross-client reactions, maneuver schema, dice resolution); this is
the map that connects them.

---

## 1. Components at a glance

| Concern | Where it lives |
|---|---|
| Round / side initiative | `combat-tracker/side-tracker.js`, `hud/actor-hud.js` (Side Ready) |
| Turn cues | `combat/turn-cues.js` |
| Attack lifecycle (pure) | `combat/lifecycle-flow.mjs` (`declareAttackPhased`, `resolveAttackOutcomePhased`, `executeResolvedReactionPhased`) |
| Attack orchestration (live) | `services/combat-resolver-service.js` (`declareAttack`, `resolveAttackOutcome`, `runPhases`) |
| HUD attack action | `hud/hud-actions.js` (`executeWeaponAttackAction`) |
| Maneuver legality | `combat/maneuver-legality.mjs` (`getLegalManeuvers`, `evaluateManeuverLegality`) |
| Reaction candidates | `combat/reaction-candidates.mjs` |
| Reaction window + relay | `services/reaction-service.js`, `services/remote-window-relay.js` |
| Post-maneuver relay | `combat/post-maneuver-relay.js` |
| Defense summary | `combat/defense-summary.js` |
| Dice (custom terms + totals) | `dice/*.js`, `dice/dice1547.js` (`accumulateDice1547Totals`, `computeDice1547Totals`) |
| Pools | `combat/pool-builder.mjs` |
| Positioning / facing | `lib/positioning.mjs`, `combat/facing.mjs` |
| Damage / HP | `combat/hp-state.mjs` |
| Conditions | `services/condition-registry.js` |
| Event bus (local, in-memory) | `services/event-bus.js`, `services/combat-events.js` |

**Two execution layers.** The *pure* layer (`combat/*.mjs`) computes patches and emits events
through an injected `run(...)`; it never touches Foundry directly. The *orchestration* layer
(`services/combat-resolver-service.js`) supplies `runPhases` — it applies patches via the
dispatcher and emits combat events. This keeps the math unit-testable and the Foundry glue thin.

**The event bus is local.** `emitCombatEvent` (`combat-events.js`) runs handlers **in-process on
the acting client only**, and it **awaits each async handler in order** (`event-bus.js` `emit`).
Nothing crosses the socket by itself — cross-client behaviour is added explicitly by the relay
(§7). This single fact drives most of the cross-client design.

---

## 2. The round / side model (side-based initiative)

Combat is **side-based**: combatants belong to a *side* (team), and a whole side activates at
once. Standard per-combatant initiative order is **not** used to sequence turns.

- **Side membership** — `combatant.flags.1547core.sideId` (`getStoredSideId`); defaults derived
  from token disposition (`deriveDefaultSideId`: friendly→`team-1`, hostile→`team-2`). The GM can
  override via **Assign Teams** (`showTeamAssignmentDialog`). `DEFAULT_TEAM_IDS = ["team-1","team-2"]`.
- **Active side** — `combat.flags.1547core.activeSideId` (`getActiveSideId`), with `sideOrder`
  and `roundNumber` flags. `combat.turn` is pointed at the **first non-defeated combatant of the
  active side** (`getFirstCombatantIndexForSide`); `combat.round` is the Foundry round.
- **Side Ready** ends a side's activation (`announceSideReady` → `getNextStoredSideTurnState` →
  `advanceCombatToNextSide`): it sets `combat.turn`/`round` and writes the side flags. The next
  side is the next entry in `sideOrder` **that has a non-defeated member**; wrapping increments
  the round.
- **GM-authoritative writes.** `persistCombatSideState` and `advanceCombatToNextSide` write the
  Combat doc, which only the GM may do (`persistCombatSideState` early-returns for non-GMs). A
  player's Side Ready therefore **emits a socket request** (`side-advance-request`) and the GM
  performs the advance; the player builds the chat announcement from the local preview.
- **Turn cues** (`turn-cues.js`) are socket-free: every client watches `updateCombat`, reads the
  propagated `activeSideId`, and a **player** is nudged "Your side's turn" when their side becomes
  active (deduped per combat; the GM is not nudged).
- **Initiative rolls** are forced public (`combat/public-initiative.js` wraps
  `Combat#rollInitiative` with `rollMode: public`) so both GM and players see them. Initiative
  rolls do not sequence side turns; they exist only if the table uses them for ordering.

> **Edge case — a fully-defeated side.** `getNextStoredSideTurnState` filters out defeated
> combatants, so if the opposing side is entirely defeated it is skipped and the search **wraps
> back to the surviving side** (round +1). Side Ready then reports "now: \<same side\>". This is
> as-coded, not a routing failure. See §12.

---

## 3. Action economy (per side activation)

Within a side's activation an actor may take **pre-maneuvers**, one **attack** (or a
**full-turn** action), **movement**, and **reactions** when others act. Budgets are passed into
legality as context (`fullTurnAvailable`, `attacksRemaining`, `movementBudgetRemaining`):

- `full-turn` maneuvers require `fullTurnAvailable !== false`.
- `attack-declared` pre-maneuvers require `attacksRemaining > 0` (when a finite budget is given).
- `move-declared` maneuvers require `movementBudgetRemaining > 0` (when given).

> **Reactions are NOT budget-gated today.** `passesActionEconomyGate` only checks attack/movement
> budgets, and the reaction path passes neither — so reactions are never "used up" and there is no
> per-turn reaction reset. (This is why a "new turn" does not restore a reaction: there is nothing
> consumed to restore.) See §12.

---

## 4. Maneuvers

A maneuver is a learned item (folder `Maneuvers`, normalized by `normalizeManeuver`) with:
`type` (timing), `triggerType`, `CostType`/`CostAmount`, `effectData`, `requirements`,
`usageLimit`, `tags`, `handlerId`, `targetRules`, `persistence`.

**Timing types** (the windows they appear in):

| `type` | Offered… | Trigger | Cost |
|---|---|---|---|
| `pre` | at attack/move declaration | `attack-declared` / `move-declared` | stat points (reserved on select, spent on commit) |
| `reaction` | in a reaction window | `attack-declared`, `threat-zone-entered`, `damage-taken`, … | usually none / stat points |
| `post` | after damage, in the post-maneuver window | `post-attack` | **CriticalPoints only** |
| `full-turn` | when declaring a full-turn action | `full-turn-activation` | consumes move+attack; may create a persistent effect (e.g. overwatch) |

**Legality** — `getLegalManeuvers({actor, …context})` → `evaluateManeuverLegality` runs ordered
gates and keeps only `legal` ones: timing → trigger (`matchesTrigger`, honours `alternateTriggers`)
→ usage limit → action economy → actor-state (conditions; e.g. Evade blocked in medium+ armour) →
defense follow-up (parry lock) → weapon → profile (`appliesTo` melee/ranged) → range → target-state
(target conditions, flanking/adjacent ally) → resource (cost pool, incl. `CriticalPoints` for
`post`). Returned candidates are bare maneuver objects (no `.actor`) — relevant to reaction
routing (§7).

**`effectData` vocabulary** (consumed by `normalizeAppliedAttackModifiers` /
`normalizeDefenseModifiers` and the resolver): pool mods (`addMainDice`, `addDisadvantage`,
`addMultiplierDice`, `addRiskDice`, `addMoveSquares`); attack shape (`safeAttack`,
`createFreeSafeAttack`, `createFreeSafeCounterattack`, …); defense (`addArmorDice`,
`reduceDamageTaken`, `lockParryingWeaponUntil`); facing (`facingFace`); gating (`appliesTo`,
`useMaxRange`). The resolver only **branches the lifecycle** on `createFreeSafeAttack` /
`createFreeSafeCounterattack` (§5, §6); all other defense effects are applied as *modifiers* to an
attack that still resolves normally.

**HUD selection state** (`hud-state.js`): per-actor selected pre-maneuvers and one full-turn
maneuver; a FIFO `postManeuverQueue` of post-maneuver windows; the active `reactionWindow` /
`damageTakenWindow`.

---

## 5. The attack lifecycle (phase by phase)

Entry point: `executeWeaponAttackAction` (`hud/hud-actions.js`). It runs **on the attacker's
client** (usually the GM). Sequence:

1. **Legality / reach** — `refreshedAttackState` must be `valid`; otherwise it warns and aborts.
   Reach uses `getChebyshevDistanceSquares` (token-center Chebyshev, diagonal = 1) against the
   weapon's `minReach`/`maxReach` (melee default 1,1) or range bands.
2. **Auto-face + positioning** — `autoFaceAttacker` rotates the attacker to face the target;
   `getAttackPositioning` detects surprise / rear / faceable (§8). The positional result is passed
   into the declaration so the reaction window can offer **Face**.
3. **Declare** — `declareAttack(...)` → `declareAttackPhased` emits `ATTACK_DECLARED`. This is the
   **reaction seam** (§6): `reaction-service` may open a reaction window here and block until it
   resolves. `declareAttack` returns `{ pendingAttack, cancelled, reactionResolution }`.
   - If `cancelled` (a *replacing* reaction — free safe attack/counterattack) → the HUD stops; the
     reaction-resolution path takes over (§6).
4. **Apply positional advantage (post-reaction)** — the rear **+1** is computed **now**, after the
   window: if the defender took **Face** (`reactionResolution.reaction.effectData.facingFace`), the
   advantage is dropped (they turned to meet the blow); otherwise the detected advantage stands.
   The attack formula is rebuilt with the advantage die.
5. **Attack roll** — `rollFormulaToChatAndSummarize` evaluates the pool, posts the roll **public**
   (so both clients animate it), and reads totals **directly from the evaluated roll**
   (`computeRollTotals`), with the Dice So Nice flag/hook as fallback. (Reading totals only from the
   DSN completion hook used to break resolution — see §12.)
6. **Defense roll** — the defender's armour pool (`buildDefenseRollFormula` → `buildDefenderPool`,
   default three Evade dice) is rolled the same way. Always rolled on the non-replacing path.
7. **Resolve** — `resolveAttackOutcome({ pendingAttack, attackRoll, defenseRoll, defenseReaction })`
   → `resolveAttackOutcomePhased`: normalize rolls, apply multiplier, apply the chosen
   **defenseReaction** modifiers (`addArmorDice`, `reduceDamageTaken`), compute damage (§9), emit
   `DAMAGE_APPLIED`, build **post-maneuver windows** (§10), emit `ACTION_COMMITTED`.
8. **Cards** — a public **Attack Result** chat card is posted; a **defense summary** window is
   pushed to the defender's client (`defense-summary.js`, §7).

Phases 5–7 sit *after* the reaction window: the window opens between formula-build and roll, which
is the seam the +1 timing and the defenseReaction both respect.

---

## 6. Reactions

A reaction lets the **defender** (or a threatened actor) respond when something is declared.

- **Trigger** — `reaction-service.handleReactionTrigger` listens for `ATTACK_DECLARED` and
  `THREAT_ZONE_ENTERED`. It builds candidates (`buildAttackReactionCandidates` →
  `getLegalManeuvers` for `triggerType:"attack-declared"`), and — when the shot is a **faceable
  rear** hit — prepends the synthetic **Face Attacker** candidate (`buildFaceReactionCandidate`,
  `effectData:{facingFace:true}`).
- **The reactor** is the **defender** — for an attack that is `reactionWindow.target` (the
  declaration's `actor` is the *attacker*). Because normal maneuver candidates carry no `.actor`,
  the reactor is resolved trigger-aware: `attack → target`, `threat-zone → actor`.
- **Selection** — a single-settle controller (`createReactionSelectionController`) resolves to the
  chosen candidate (or null on pass/timeout, default 10 s). Resolution emits `REACTION_RESOLVED`.
- **What a reaction does to the attack:**
  - **Free safe attack / counterattack** → `handleReactionTrigger` **cancels** the declaration;
    `executeResolvedReactionPhased` (wired via `onCombatEvent(REACTION_RESOLVED)` in
    `combat-resolver-service`) re-resolves it as the counter.
  - **Plain defense reaction** (Desperate Defense, Evade, …) → **does NOT cancel**; the attack
    resolves normally and the reaction's `effectData` modifiers are applied in `resolveAttackOutcome`
    via `defenseReaction`.
  - **Face** → does not cancel; `registerFacingService` (on `REACTION_RESOLVED`) rotates the
    defender to meet the attacker, and the HUD drops the rear +1 (§5 step 4).

> Only free safe attack/counterattack reactions take the cancel-and-re-resolve path. Everything
> else is a *modifier* on an attack that still rolls and posts a card. (Cancelling those was the
> bug behind "Evade voided the whole attack".)

### Cross-client routing (§7 is the transport)

Because the bus is local, the reaction prompt is **relayed** to the reactor's owner and mirrored
for the GM:

- **GM attacks a player** → window shown on **both** the GM (mirror) and the player (relay);
  first response wins (single-settle); resolving on one closes the other.
- **Player attacks a GM NPC** → window shown **only on the GM** (the attacking player never sees
  the NPC's options).
- Rule in code: the acting client opens the window locally when **it is not relaying** (it owns the
  reactor) **or it is the GM**.

---

## 7. Cross-client architecture

The generic hub is `services/remote-window-relay.js`:

- `relayRemoteWindow({ kind, windowId, responderActor, request, timeoutMs, onResolve, expectsResponse })`
  picks responder users (`pickResponders`: controlling players, else the GM when a player can't
  decide), sends a socket request on `module.1547core`, shows a persistent "waiting…" indicator,
  and resolves via `onResolve(candidateId|null)`; `closeRelayedWindow` / first-wins close /
  `userConnected` re-send are built in.
- `registerRemoteWindowPresenter(kind, present)` — the responder side renders the window and
  returns `{promise, close}` (or nothing for an informational window).

Consumers: **reactions** (`reaction-service`, HUD reaction prompt with dialog fallback),
**defender post-maneuver windows** (`post-maneuver-relay`, dialog; the acting client still runs
`commitPostManeuver` so combat writes stay GM-authoritative), and the informational
**defense-summary** window (`defense-summary`, pushed to the defender's HUD). The side-advance
request (§2) rides the same channel.

**Authority** stays on the acting/GM client: it owns the timeout, the resolution, and all combat
writes. Only the *prompt and the choice* are delegated.

---

## 8. Positioning & facing

Pure geometry in `lib/positioning.mjs`; live glue in `combat/facing.mjs`.

- **Token descriptor** — `{col,row,w,h,rotation}` from `doc.x/y/width/height/rotation` over the
  grid size. Distance for reach/positioning is **Chebyshev on token centers** (diagonal counts as
  one square).
- **Rear cone** — `rearConeTiles(defender, maxDist)` is the arc behind the defender's facing out to
  `maxDist` (1×1 at reach 1 = 3 tiles; 2×2 = 4). `isInRearCone(defender, attacker)` tests the
  attacker's footprint against it.
- **`computePositionalAdvantage`** → `{ surprise, rear, advantage(0|1), faceable }`:
  - target **not in combat** → **surprise** (+1, not faceable);
  - else **rear** = attacker in the defender's rear cone → +1, **faceable** unless the attacker is
    Hidden.
- **Auto-face** turns the *attacker* to face the target on every attack (tagged `facingAutoFace`).
- **Face reaction** turns the *defender* to face the attacker; the +1 is recomputed/dropped at HUD
  step 4. Surprise / Hidden +1 are auto-applied and never reach a faceable window.

> Reach and rear both depend on the **defender's current facing**, which **persists** (there is no
> off-turn rotation lock yet, §12). So after a defender Faces attacker A, a later attack by A from
> the same tile is *frontal* (correctly no Face). Whether Face is offered is purely "is the attacker
> in the defender's current rear cone", not a function of turns.

---

## 9. Dice, defense, damage

### Custom dice (6 faces each; `accumulateDice1547Totals`)

| Die (code) | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| Armor `a` | fumble | – | prot+1 | prot+2 | prot+4 | crit |
| Balanced `b` | fumble | – | dmg+1 | dmg+1 | dmg+2 | crit |
| Control `c` | fumble | – | – | dmg+1 | crit | crit |
| Evade `e` | fumble | – | prot+1 | prot+2 | crit | crit |
| Finesse `g` | – | – | dmg+1 | dmg+1 | crit | crit |
| Heavy `h` | fumble | fumble | dmg+1 | dmg+2 | dmg+4 | crit |
| Lethality `l` | fumble | fumble | dmg+2 | dmg+3 | dmg+5 | crit |
| Multiplier `x` | mult×0 | – | – | mult+1 | mult+1 | mult+2 |
| Penetration `p` | fumble | – | dmg+1 | dmg+1 | dmg+3 | crit |
| Risk `r` | mult×0 | fumble | fumble | – | dmg+2 | crit |

Totals shape: `{ damage, protection, crit, fumble, multiplier }`. `multiplier = multiply ×
multiplyFail` (a Multiplier/Risk "1" zeroes the multiplier). Totals are computed **from the
evaluated roll** (`computeDice1547Totals`); the Dice So Nice completion hook keeps a flag + result
card as a secondary path.

### Pools (`pool-builder.mjs`)

- **Attack** — `buildAttackPool(baseDice, {advantageCount, addMainDice, addMultiplierDice,
  addRiskDice, extraDice, ammoAddDice})`. Advantage **prepends** copies of the first die;
  disadvantage adds **Risk** dice. `toFoundryFormula` maps names → terms (`Balanced→db`, etc.).
- **Defense** — `buildDefenderPool(defenseDice)`; **fallback three Evade** when unarmoured.
  Conditions add Risk dice (`buildDefenseRollFormula` + `conditionCombatDisadvantage`).

### Resolution math (`resolveAttackOutcomePhased`)

1. Normalize both rolls; **apply multiplier** to damage/protection/crit.
2. `protection += defenseModifiers.addArmorDice` (from the chosen `defenseReaction`).
3. `baseDamage = max(0, attack.damage − defense.protection − reduceDamageTaken)`.
4. Secondary/on-hit effects (gated by trigger mode, base-damage-passed, save/contest) add to
   `secondaryDamage`. `damageApplied = base + secondary`.
5. **Critical points** = `attack.crit + defense.crit` (both sides) → feed post-maneuvers.

### Damage / HP (`hp-state.mjs`)

`planApplyDamage` writes `system.props.CurrentHitPoints` and toggles status effects: `dead`
(+`defeated`) when HP ≤ 0, `unconscious` when 0 < HP ≤ 1.

### Conditions (`condition-registry.js`)

Weakened (physical −1), Exhausted (all −1, blocks advantage), Cursed (all −1), Doomed (blocks
advantage), Locked (combat disadvantage on attack & defense). `conditionCombatDisadvantage` →
Risk-die count added to combat pools; `blocksAdvantage` zeroes advantage dice.

---

## 10. Critical points & post-maneuvers

After damage, both sides may spend **critical points** (the summed crit faces of the exchange) on
`post` maneuvers. `resolveAttackOutcomePhased` builds `defenderPostOptions` and `attackerPostOptions`
(`getLegalManeuvers` with `timingType:"post"`, `triggerType:"post-attack"`, `currentCriticalPoints`)
and emits a `POST_MANEUVER_WINDOW_OPENED` per non-empty window (**defender first, then attacker**).
Each window carries a `commitPostManeuver(selection)` closure (the actual combat write) and is
queued in the HUD; a defender window owned by a remote player is **relayed** to them (§7) while the
acting client executes the chosen maneuver. Unspent crits are cleared when the window closes.

---

## 11. One full exchange (worked example)

1. GM selects an attacker, targets a player's PC, clicks the weapon attack.
2. Reach OK; attacker auto-faces; positioning detects a **faceable rear** hit.
3. `ATTACK_DECLARED` → reaction window opens with **Face Attacker** + any legal defenses; it shows
   on the GM (mirror) **and** the player (relay); GM sees "waiting…".
4. Player picks **Face** → defender rotates; first-wins closes the GM mirror.
5. Back on the GM: the rear +1 is **dropped** (Face); the attack pool is built without it.
6. Attack and defense rolls fire **public** (both clients animate); totals read from the rolls.
7. `resolveAttackOutcome` subtracts protection, applies any defense-reaction modifiers, computes
   damage, writes HP, posts the **Attack Result** card, pushes a **defense summary** to the player.
8. If the exchange produced crits, defender then attacker get **post-maneuver** windows (relayed to
   the player as needed).
9. When the side is done, **Side Ready** advances to the other side (player → socket → GM).

---

## 12. Known gaps & fragilities (the live-test backlog)

1. **Off-turn facing/movement lock — not implemented** (facing spec Part B). Token facing persists
   across turns, so "Face isn't offered again" is usually correct geometry (defender already faces
   the attacker), not a turn bug. If a lock is wanted, add a `preUpdateToken` veto that allows only
   `facingAutoFace`/forced updates on a side's own activation.
2. **No reaction economy / reset.** Reactions are not budget-gated, so there is nothing to consume
   or reset on a new turn. If "one reaction per side activation" is intended, add a reaction budget
   to the action-economy gate and reset it on side advance.
3. **Reach measurement is center-to-center Chebyshev.** Correct for 1×1 tokens (diagonal = 1) but
   can misjudge **larger tokens** or off-grid placement (it ignores footprint edges). The recurring
   "diagonal out of reach" is most likely a token-size/placement case — switch reach to
   footprint-edge distance (min Chebyshev between attacker and defender tiles) to harden it.
4. **Fully-defeated opposing side wraps** (§2). Side Ready loops back to the surviving side instead
   of ending combat. Decide: end combat, or surface "the opposing side is defeated".
5. **Dice totals once depended on Dice So Nice.** Now read from the evaluated roll
   (`computeRollTotals`) with the DSN hook as fallback — keep new combat math off the animation hook.
6. **Multiplier flag path** writes `multiplier` via `buildResultPayload(multiplier × multiplyFail)`;
   the direct `computeDice1547Totals` path is authoritative. Ensure both agree if the flag is read.
7. **Face does not yet roll a separate defense** — it cancels the rear +1 and turns the defender; if
   Face should also let a normal defense roll, thread it like the other defense reactions.

---

## Companion specs
- `facing-and-positioning-spec-v1.md`, `facing-implementation-spec-v1.md` — rules + Face/lock plan.
- `cross-client-reaction-spec-v1.md` — the relay transport (now generalised to all windows).
- `maneuver-schema-spec-v1.md`, `maneuver-legality-and-filtering-spec-v1.md`, `maneuver-rules-guide.md`.
- `dice-resolution-spec-v1.md`, `combat-resolution-loop-spec-v1.md`, `combat-state-machine-v1.md`.
- `cover-spec-v1.md`, `ranged-shot-visualization-spec-v1.md` — not-yet-built ranged work.
