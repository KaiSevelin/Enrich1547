# Maneuver Master List

> **Working design document.** Editable source-of-truth *for design* — one row per maneuver with its cost, timing, and effect. This revision reflects the **Core Points consolidation** (decisions locked below). Once the design settles, we reconcile it back into the runtime data (`foundry/Templates/maneuvers.json`), the legality/resource code, chargen, and the skill tree.
>
> Derived from `foundry/Templates/maneuvers.json`. Post-consolidation count: **59 maneuvers** (71 original − 17 removed + 5 new Core maneuvers; Catch Breath → Core Restore).

## Design decisions (locked)

1. **One pool.** The seven stat-point pools (Str/Sta/Dex/Cha/Int/Faith/Power) are removed and replaced by a single **Core Points** pool. Stats themselves survive as roll attributes (used for checks like Str-vs-Str escapes and to compute the pool).
2. **Core Points max = sum of stat dice.** Every stat is *dice + modifier* (e.g. `Dexterity 1d6+3`); each **die** contributes 1 Core Point (the modifier is irrelevant). `MaxCorePoints = Σ (dice count) across all seven stats`. Raising a stat to `2d6` adds a point; dropping a die removes one. It is a **scarce campaign resource**: no per-combat refill, no passive regeneration. It is restored only by **Core Restore** (a post maneuver) and by GM intervention.
   - **Derived pool (data model).** Persist only `SpentCorePoints`; derive `MaxCorePoints` from the stats; `CurrentCorePoints = Max − Spent`. A stat-die increase recomputes Max → +1, and since Spent is unchanged Current rises with it automatically — a die gain hands you a point, a die loss takes one, with no migration logic. Fits the existing `Reserved/Spent/Available` pool pattern on the actor sheet.
3. **Five Core maneuvers are the entire point economy** (each Core 1). Core Attack / Core Defense / Core Toughness are **repeatable across separate declarations** — one instance per attack/defense/turn, again on the next. (Not multiple stacked onto a single swing — keeps the HUD selection model on/off, no per-maneuver count.) Scarcity is the limiter.
4. **New timing — `passive`.** Auto-applied, always on, free, whenever its prerequisites are met. Consumes no action and no reaction.
5. **Acquisition.** Maneuvers with **no skill requirement are auto-granted to every PC**. Maneuvers **with a skill requirement stay skill-tree-gated** (the tree must be updated to wire maneuvers to their skills). Weapon-trait and state requirements (e.g. *Rigid Blade*, *hidden*, *target locked*) are **in-combat legality**, not acquisition gates, and are retained.
6. **Core Restore** = renamed Catch Breath, converted to a **post maneuver**: spend **2 CriticalPoints → recover 1 Core Point**. Only non-GM source of Core regeneration.
7. **Counter Attack removed.**
8. **Team-buff archetype removed** (Rally, Act of Inspiration, Provoke). **Flanking is the main team maneuver.**
9. **One reaction per actor per turn** — bounds the now-free reaction maneuvers (Opportunity Strike, Riposte, etc.). **Enforced in this rework** as a new global reaction-budget gate (today's usage limits are per-maneuver, not a shared budget). Passives don't count against it.

### Implementation follow-ups (design → code, later)
- **Data model:** drop the seven `<Stat>Points` pools (+ PowerPoints) from the actor template; add `CorePoints` (max/current/spent). Keep CriticalPoints, RiskPoints, HitPoints, AdvantagePoints.
- **Code seams:** rewrite the resource gate in `maneuver-legality.mjs`; update `utils/resource.js` vocabulary; add `passive` to `normalisation.mjs`, legality, and the HUD; relabel HUD point pools.
- **Chargen:** remove the 17 cut maneuvers; auto-grant all no-skill maneuvers to new PCs; finalize Core Points max.
- **Skill tree:** wire the skill-gated maneuvers to their skill nodes.

### Scope confirmed (from implementation planning)
- **Escapes → opposed checks are in scope** for this rework (new opposed Dex/Str roll for Break Grapple / Slip The Lock / Break The Choke; they can now fail).
- **Reaction-budget gate is in scope** (decision #9) — new global one-reaction-per-turn enforcement.
- **Core stacking = repeatable per declaration** (decision #3) — no HUD multiplicity work.
- **Act Of Faith removed** — it was the missing 17th entry (the table previously listed only 16 real removals + a placeholder). Removed table = 17; total stays 59.
- **Housekeeping:** drop the stale `Draw` ref from `default-maneuvers.json`; leave orphaned removed-maneuver copies on existing PCs inert (no cleanup pass).
- **Still open:** where the canonical skill-tree graph lives (committed seed file vs. GM-edited in-world) — determines whether skill-tree wiring is a code change or a data task.
- **Two correctness landmines to honor in code:** `planSpendActorManeuverCost` must increment `SpentCorePoints` (not write a raw pool prop, or the spend is lost); and the resource gate/budget must read `MaxCorePoints` (template prop name), not the `CorePointsMax` it currently looks for.

## How to read this

- **Timing** (`type`): **pre** (rides a declared attack/move), **reaction** (fires in a reaction window), **post** (spent after a successful attack; costs CriticalPoints), **full-turn** (consumes the whole turn), **passive** (always-on, free).
- **Cost**: `Core N` spends Core Points; `Crit N` spends CriticalPoints; `—` = free (gated only by requirements).
- **Requires**: `*skill*`-style entries are **acquisition** gates (skill tree); weapon-trait/state entries are **in-combat legality**.
- Usage limit is `1 per side-based-turn` unless noted (stackable Core maneuvers excepted).

## Point economy at a glance

| Category | # | Notes |
|---|---|---|
| **Core Points spenders** | 5 | Core Attack, Core Speed, Core Escape, Core Toughness, Core Defense |
| **Post (CriticalPoints)** | 12 | Generated per attack from crit dice; spent in the post window |
| **Core Restore** | 1 | Post maneuver; spends 2 Crit → +1 Core (the only Core regen) |
| **Passive** (always-on, free) | 6 | Flank, Quick Reload, Shield Bash, Guard Ally, Shield, Shield Wall |
| **Free** (situational, gated) | 35 | Balanced by weapon/skill/state requirements, not economy |
| **Total** | **59** | |
| *(Removed from prior 71)* | *17* | *See "Removed maneuvers" below* |

The whole point economy now rides on **6 maneuvers** (5 Core spenders + Core Restore). Everything else is free-but-gated or passive.

---

## Core maneuvers (the Core Points economy)

*The generic levers the pool pays for. Core Attack/Defense/Toughness stack (no cap).*

| Maneuver | Timing | Cost | Effect | Requires |
|---|---|---|---|---|
| **Core Attack** | pre (attack) | Core 1 · stack | +1 multiplier die | — |
| **Core Speed** | pre (move) | Core 1 | Double move | — |
| **Core Escape** | escape | Core 1 | Remove **all** held of Grappled / Locked / Choking Hold at once (**not Prone**) | Have one of the conditions |
| **Core Toughness** | reaction (damage-taken) | Core 1 · stack | −1 damage taken *(was Act Of Toughness)* | — |
| **Core Defense** | reaction (attack-declared) | Core 1 · stack | +1 multiplier die to defense | — |
| **Core Restore** | post (post-attack) | Crit 2 | Recover 1 Core Point *(no longer clears RiskPoints — Catch Breath did)* | — |

## Passive maneuvers

*Always on, free — apply automatically when the condition is met. No action, no reaction consumed.*

| Maneuver | Auto-applies when… | Effect | Requires |
|---|---|---|---|
| **Flank** | a flanking ally also threatens the target (melee) | +1 multiplier die | *Combat Melee 2* |
| **Quick Reload** | reloading | Reduce reload time by 1 | *Combat Firearms/Ranged 2*; Reloading |
| **Shield Bash** | a shield attack deals damage | Push target 1 square | *Combat Melee 2*; Shield |
| **Guard Ally** | an adjacent ally is attacked | +1 armor die to that ally's defense | *Combat Melee 1/Tactics*; Shield |
| **Shield** | defending with a shield | +2 armor dice | *Combat Melee 1*; Shield |
| **Shield Wall** | defending with a shield | +1 defense advantage; +1 armor die if adjacent Shield Wall ally | *Tactics*; Shield |

### Passive timing — resolution model

`passive` is a real 5th `type` value, **evaluated by the same legality gates** as every other maneuver — but auto-applied at resolution instead of offered for selection.

- **Reuse the gate machinery.** A passive's condition ("flanking ally," "shield equipped," "adjacent ally is the target") is an ordinary legality gate in `maneuver-legality.mjs`. Passives run through the *same* gate evaluation; only the consumption differs.
- **Auto-apply, don't prompt.** Where pre/reaction maneuvers surface in a HUD window for the player to pick, the resolver gathers every passive whose gates pass at the relevant phase and folds its `effectData` into the roll automatically. The HUD shows passives as *active* (informational), never as a choice.
- **`triggerType` names the phase** it folds in at — `Shield → defending`, `Flank → attack-declared`, `Guard Ally → ally-attacked`, `Quick Reload → reload`, `Shield Bash → attack-deals-damage`. Each resolution phase asks "which passives pass their gates right now?" and applies them.
- **No reaction consumed.** Passives sit outside the one-reaction-per-turn budget (decision #4/#9). Consequence: shield defenders always get their full armor bonus — it's no longer a competing reaction choice.

## Full-turn maneuvers

*Consume the whole turn (no normal attack). All free now.*

| Maneuver | Cost | Effect | Requires |
|---|---|---|---|
| **Aim** | — | Advantage on next legal attack; creates `aimed` | — |
| **Brace Firearm** | — | +1 multiplier die; creates `braced` | Bracing weapon |
| **Reload** | — | Reduce reload time by 1 (**by 2 if Quick Reload known**) | Reloading weapon |
| **Suppressing Fire** | — | Enemy move limit 1 in a 5×5 area (current round); suppressing-fire effect | *Combat Ranged/Firearms 3*; firearm/ranged |
| **Overwatch** | — | +1 main die; creates `overwatch` (5×5, up to 2 targets) | *Combat Ranged/Firearms 3*; firearm/ranged |
| **Disengage** | — | Ignore movement-triggered reactions *(now a full turn)* | — |
| **Advance Under Guard** | — | +2 squares; ignore opportunity strikes *(now a full turn)* | *Combat Melee 2/Tactics*; Shield |

## Pre maneuvers — on an attack (`attack-declared`)

*All free; gated by weapon/skill/state.*

| Maneuver | Cost | Effect | Requires |
|---|---|---|---|
| **Assassinate** | — | +1 multiplier die; lethal-hidden; removes defender reactions | *Subterfuge Stealth 2*; hidden |
| **Bull Charge** | — | +1 multiplier die; **+1 risk die** | *Combat Melee 3*; unmounted, moved 3+ |
| **Charge** | — | +1 main die, +1 multiplier die; **+1 risk die** | *Combat Melee 2, Riding 2*; mounted, moved 3+ |
| **Formation** | — | Advantage per participating ally in formation | *Combat Melee 2*; Tactical; formation partner |
| **Half-Sword** | — | +1 disadvantage; ignore target's highest armor die | *Combat Melee 3*; Rigid Blade |
| **Lock And Strike** | — | +2 main dice; free safe attack | *Combat Unarmed 2*; Control; target locked |
| **Point Blank** | — | Firearm at melee range; +1 multiplier die, +1 risk die | *Combat Firearms 1*; Point Blank |
| **Press** | — | Move 1 toward target if damage; target can't Disengage; ignore reactions on follow-up move | *Combat Melee 2* |
| **Quick Draw** | — | Ready an equipped sidearm, usable this action | *Combat Melee/Firearms 1*; Sidearm |
| **Sap** | — | Nonlethal-hidden; unconscious on success; suppress target reactions | *Subterfuge Stealth 1*; hidden |
| **Arced Shot** | — | +1 risk die; indirect (ignores cover, no rear bonus) | *Combat Ranged/Thrown 1*; arc-capable weapon |
| **Tail Sweep** | — | Rear-arc-adjacent area attack; prone if damage | Tailed *(monster)* |
| **Pounce** | — | If moved 2+: +1 multiplier die, apply prone | Pouncer; quadruped *(monster)* |
| **Wing Buffet** | — | If damage: push 2 squares, apply prone | Winged *(monster)* |

## Pre maneuvers — on a move (`move-declared`)

| Maneuver | Cost | Effect | Requires |
|---|---|---|---|
| **Trample** | — | Pass through smaller creatures, natural damage to each, apply prone | Apex Predator/Massive *(monster)* |

*(Act Of Speed → Core Speed; Disengage & Advance Under Guard → full-turn.)*

## Escapes (`escape`)

*All free, resolved as **opposed checks** (can fail) — built as part of this rework. Core Escape (Core 1) removes **all** held of Grappled/Locked/Choking Hold **automatically** instead (guaranteed, no roll).*

| Maneuver | Cost | Effect | Requires |
|---|---|---|---|
| **Stand Up** | — | Remove Prone (forgo all movement this turn) | Prone |
| **Break Grapple** | — | Remove Grappled — **opposed Dex vs Dex** | Grappled |
| **Slip The Lock** | — | Remove Locked — **opposed Str vs Str** | Locked |
| **Break The Choke** | — | Remove Choking Hold — **opposed Str vs Str** | Choking Hold |

## Reaction maneuvers

*Fire in a reaction window. All free. Remember: one reaction per actor per turn.*

| Maneuver | Trigger | Effect | Requires |
|---|---|---|---|
| **Desperate Defense** | attack-declared | Cancel 1 incoming multiplier die; +1 RiskPoint (self) | — |
| **Evade** | attack-declared | Remove 1 incoming multiplier die | Not medium/heavy armor, not locked/prone |
| **Parry** | attack-declared | +1 armor die; locks parrying weapon until side end | *Combat Melee 2*; Parrying |
| **Hold At Bay** | threat-zone-entered | Stop the entering actor in the entered square | *Combat Melee 2*; Polearm/Spear |
| **Opportunity Strike** | threat-zone-entered | Free safe attack | Any equipped weapon |
| **Receive Charge** | charge-declared | +1 multiplier die; free safe counterattack | *Combat Melee 2*; Receiving |
| **Riposte** | attack-dealt-0-damage | Free safe attack | *Combat Melee 3*; Fast |
| **Resist Hooking** | hook-applied | Cancel the hook's trip/dismount | *Strength Athletics 1* |
| **Grapple Break** | locked / grappled | **On a successful break: advantage on your next attack roll** | *Combat Unarmed 1/Athletics 2* |

*(Act Of Toughness → Core Toughness; Core Defense is a Core maneuver; Bind and Counter Attack removed. Shield / Shield Wall / Guard Ally → passive.)*

## Post maneuvers (`post-attack`)

*Spent after a successful attack, in the post-maneuver window. All cost CriticalPoints. (Core Restore, above, also lives here.)*

| Maneuver | Cost | Effect | Requires |
|---|---|---|---|
| **Convert** | Crit 1 | Convert 1 CriticalPoint into +1 damage | *Combat Melee 1* |
| **Turn** | Crit 1 | Rotate target's facing 1 step | *Combat Melee 2* |
| **Lock** | Crit 1 | Apply Locked; disadvantage on target attack & defense; escape via Str/Dex | *Combat Unarmed 1*; Control |
| **Choke** | Crit 1 | Upgrade Locked → Choking Hold; maintains free safe attack each side | *Combat Unarmed 2*; target locked |
| **Redouble** | Crit 1 | +1 disadvantage; second safe attack | *Combat Melee/Ranged/Unarmed 2*; Fast |
| **Break Armor** | Crit 1 | Add damage based on defender's Shield 1 result | *Combat Melee 3*; Armor Breaking |
| **Push Of Pike** | Crit 1 | Push target 1 square directly away; +1 RiskPoint to target | *Combat Melee 2*; Polearm; polearm ally |
| **Disarm** | Crit 2 | Disarm target's weapon; throw it up to 2 squares | *Combat Melee/Unarmed 2*; Disarming |
| **Hook** | Crit 2 | Choose: trip-prone / dismount-prone / pull 1 square | *Combat Melee 2*; Hooking |
| **Throw** | Crit 2 | Apply Prone; place target adjacent | *Combat Unarmed 3*; Control |
| **Constrict** | Crit 2 | Apply Grappled; 1d3 ongoing damage/turn | Constricting *(monster)* |
| **Swallow Whole** | Crit 3 | Swallow target whole; 1d6 ongoing damage/turn | Apex Predator; much smaller/grappled *(monster)* |

---

## Removed maneuvers (17)

Delete from `maneuvers.json`, chargen grants, and the skill tree.

| Maneuver | Was | Why removed |
|---|---|---|
| **Act Of Strength** | pre, Str 1, +1 main (melee) | Replaced by generic **Core Attack** |
| **Act Of Precision** | pre, Int 1, +1 main (ranged) | Replaced by **Core Attack** |
| **Act Of Heroism** | pre, Faith 1, +1 mult +1 risk | Replaced by **Core Attack** |
| **All-in** | pre, Str 1, +1 mult +2 risk | Replaced by **Core Attack** (stacked) |
| **Feint** | pre, Dex 1, +1 main | Replaced by **Core Attack** |
| **Quick Aim** | pre, Int 1, +1 main | Replaced by **Core Attack** (Brace/Overwatch cover aiming) |
| **Quick Brace Firearm** | pre, Str 1, +1 mult braced | Redundant with **Brace Firearm** (full-turn) |
| **Weak Spot** | pre, Dex 1, ignore highest armor die | Redundant with **Half-Sword** |
| **Act Of Speed** | pre-move, Dex 1, +2 squares | Replaced by **Core Speed** |
| **Act Of Toughness** | reaction, Sta 1, −1 damage | Folded into **Core Toughness** |
| **Bind** | reaction, Str 1, remove all incoming mult dice | Cut (Evade / Desperate Defense / Core Defense cover it) |
| **Counter Attack** | reaction, Dex 1, free safe attack | Cut |
| **Rally** | pre, Cha 1, ally advantage | Team-buff archetype removed |
| **Act Of Inspiration** | full-turn, Cha 1, ally advantage | Team-buff archetype removed |
| **Provoke** | pre, Cha 1, +risk to target | Team-buff archetype removed |
| **Volley Fire** | full-turn, Sta 1, group salvo | Cut |
| **Act Of Faith** | full-turn, Faith 1, +1 mult atk/def | Ascetic/devotional archetype removed; no home in the Core economy |

*(Grapple Break is **kept** — reworked, see Reactions.)*

---

## Effect vocabulary (dice & resources touched)

- **Dice added to your roll:** main die, multiplier die, risk die, armor die
- **Dice removed / cancelled from incoming:** incoming multiplier dice (Evade, Desperate Defense)
- **Advantage / disadvantage:** granted to self/allies or imposed on target
- **Free / safe attacks:** Opportunity Strike, Riposte, Receive Charge, Lock And Strike, Redouble
- **Conditions applied:** prone, locked, choking-hold, grappled, unconscious, disarmed
- **Positioning:** push, pull, place adjacent, rotate facing, stop movement
- **Resource effects:** spend Core Points, spend CriticalPoints, add/clear RiskPoints, recover Core Points, convert CriticalPoint → damage
- **Persistent / battlefield effects:** aimed, braced, overwatch, suppressing-fire
- **Range/movement modifiers:** +move squares, ignore reactions, firearm at melee, indirect, reduce reload time
