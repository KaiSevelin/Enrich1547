# Ritual Execution & Race Board Spec v1

**Status: Draft proposal — under discussion.** Core mechanics agreed; balancing
deferred; several parameters still open (see *Open Questions*).

## Purpose

Define how a generated ritual is *executed* and *visualized*, turning the existing
ritual data (steps, the bound entity nature, protective borders) into a playable,
automatable procedure driven by the **race board**. This covers what is rolled, what
fills the board, how a ritual succeeds or fails, and how borders reduce the cost of
failure.

It does **not** redefine ritual *generation* (random step drawing), which is already
covered by `ritual-step-roll-tables-spec-v1.md` and
`ritual-generation-service.js`.

## Design goal

Use the race board (`scripts/raceboard/`) to visualize the automated execution of a
ritual: a single progress track the caster races to fill. The board already supports
everything required — a track with `filled`/`total` boxes, ticking up and down, and a
winner splash on completion — so no new board mechanics are needed.

## Core model

- **One track.** A single race-board row represents the ritual's progress.
  Reaching the target (`filled` = `total`) = **ritual succeeds**. Failing to reach it
  (run out of steps, or abort) = **ritual fails**. The board *is* the rite — there is no
  separate danger resolution running alongside it.
- **No special dice, no live-entity rolls.** The combat symbol-dice (Grace, Heavy, Risk,
  Multiplier, …) are not used; rituals resolve on plain opposed d6 checks. Those checks
  are always against **fixed difficulty pools**, never against a live monster's stats — a
  ritual must run without pre-generating the entity it concerns.
- **Risk lives on the steps, and is fully visible.** All steps and their difficulties
  are shown up front. There is no hidden risk and no scouting by re-running a rite.
- **Protection is external, specific, and rank-gated.** The only protection from a failed
  rite is a **border** matched to the spell's bound entity nature (one of: the Unseen,
  Undead, Unnatural, Nature Spirits). For a high-rank working only one premium border
  works per nature. A rite bound to no entity has nothing hostile to defend against (see
  *Borders*).

## Resolution mechanic (opposed rolls)

Grounded in the existing contest code
([`spell-casting-service.js:243-303`](../../scripts/services/spell-casting-service.js)):

- A stat rolls `Stats_<Stat>Dice` d6 `+ Stats_<Stat>Mod`.
- **Advantage adds dice** to the pool (each die ≈ +3.5 to the sum).
- A check **succeeds when the roller's total strictly exceeds** the opposing total
  (ties go to the opposition).
- **Difficulty is expressed as an opposing dice pool** of `N`d6, where `N` scales with
  the step's `Difficulty` ("a skill roll against another roll, a number of dice
  depending on difficulty").
- **Fixed difficulties only.** Both the Working-step rolls and the failure defence are
  rolled against fixed difficulty pools. Spells that target a creature *already present*
  on the scene (e.g. Banish vs a token in play) are a separate case and out of scope for
  ritual execution.

This gives two native tuning levers per check: number of **dice** and a flat **mod**.

## Ritual structure (from existing schema)

Steps use the `Ritual Step` template
([`magic-schema-spec-v1.md`](magic-schema-spec-v1.md)): `StepType`, `StepScope`,
`SkillCheck`, `Difficulty`, `RequiredItem`, `FailureConsequence`, `StepEffects`.

For execution, steps serve one role: **Working steps** that advance the track.

Each Working step is an opposed roll: the caster's magic pool vs the step's difficulty
pool.

- **Success** → advance the track by one box.
- **Failure** → no advance (the step is spent; see *Open Questions* on retries).

The ritual fails if the caster cannot reach the target before running out of steps.

## Bound entity nature

Every working that can produce hostile fallout is **statically bound to exactly one
entity nature**, drawn from a closed set of four:

**the Unseen · Undead · Unnatural · Nature Spirits**

- A single `EntityNature` field on the spell holds that value — or `None`, for workings
  (alchemy, divination, abstract rites) that concern no entity.
- This **supersedes** the earlier static-plus-random nature design: the nature is a fixed
  property of the spell, not drawn at generation, and there is **no roll against the
  entity itself** (which would require pre-generating a monster).
- The bound nature determines two things: **what a failure does** (the failure result is
  nature-specific) and **which border can protect against it** (see *Borders*).

## Working rank

A working's **rank** is a single three-step axis. In the spell data `Strength` and
`Complexity` are **perfectly correlated** — they are the same axis under two names (every
Easy spell is Strength 1, every Medium is Strength 2, every Hard is Strength 3):

| Rank | `Strength` | `Complexity` | Spell count | Random steps drawn |
|---|---|---|---|---|
| Low | 1 | Easy | 26 | `1d2` |
| Mid | 2 | Medium | 50 | `1d3` |
| High | 3 | Hard | 26 | `1d6` |

Rank is read from `Strength` (equivalently `Complexity`); no new field is needed.
**High rank = Strength 3 / Hard** — the tier at which only a nature's premium border
protects. Low and mid rank accept the common borders. Because `Complexity` already drives
the random step count, rank also correlates with ritual length: high-rank rites are both
longer *and* the ones that demand the premium border.

## Failure and its consequences

A ritual can fail in exactly one way: **the race board is not filled** — the caster runs
out of Working steps short of the target, or aborts (including simply letting the rite
lapse by waiting too long). There is no per-step danger roll.

What a failure *costs* depends on the spell's `FailureProfile` and its bound `EntityNature`:

- **No failure** (`FailureProfile: None`) → failing has no consequence beyond *not getting
  the effect*. **All borders** are in this category — a failed border simply gives no
  protection — as are selected very-easy spells.
- **Entity-less fallout** (`EntityNature: None`, with a real `FailureProfile`) → roll the
  generic `SpellFailure_<rank>` table (fizzle, backlash, blight…). No being is involved, so
  no border applies.
- **Entity-bound** (`EntityNature` is one of the four) → the half-finished rite leaves that
  kind of being loosed or angered. Resolve a **nature-specific failure result**, and a
  **border** is the only protection (see *Defence check* and *Borders*).

> The earlier per-step `DangerTag` taxonomy is **dropped**. Protection and fallout are
> keyed to the bound entity nature, not to a danger tag. Three of the old tags survive as
> their own mechanics: `Fatigue` → **Strain**, `Spoilage` → **Material quality**, `Delay`
> → just an over-long abort.

### Failure outcomes by nature

Severity is **not a separate axis** — in the data it is identical to rank: every existing
`Minor` failure is a low-rank (Strength 1 / Easy) spell, every `Major` is mid (Strength 2 /
Medium), every `Catastrophic` is high (Strength 3 / Hard). So a failure outcome is fully
described by **(bound nature × rank)** — there is no third dimension.

- **`None` / no-failure** → as above: nothing, or the generic `SpellFailure_<rank>` table.
- **Low-rank entity-bound** failures use the **shared generic `SpellFailure_Minor`** table —
  a low-rank slip is nature-agnostic (a fizzle is a fizzle, whatever the rite concerned).
- **Mid- and high-rank entity-bound** failures use a **per-nature** table keyed by
  `EntityNature`. The nature colours *what* goes wrong; rank sets *how badly*.

So only **eight** new tables are needed (4 natures × {Mid, High}). This is the
"school-specific failure tables" layer the failure spec already anticipated — keyed to
entity nature rather than school. The current `Catastrophic` table is already a nature
grab-bag (Manifestation, Loss-of-name, RitualBlight, WrongBinding, Breach) and can be
**sorted to seed the high tier** rather than written from scratch.

Flavour spine (grounded in the current entries + folklore), to be authored:

| Nature | Mid rank | High rank (the being manifests) |
|---|---|---|
| Undead | a shade takes notice; corpse-taint clings | the dead walk — a revenant or hungry shade is loosed |
| the Unseen | something follows; a name or voice is clouded | a breach — something crosses and takes a name, shadow, or voice |
| Unnatural | the rite fastens to the wrong target; the caster is marked | an unnatural thing manifests, or binds permanently into the wrong vessel |
| Nature Spirits | the place turns troubled; helpers confused | the ground or threshold turns hostile or claimed; the caster is lost to the wild |

The **matching border** is what lets the caster avoid or soften this result at the defence
check (see *Defence check* and *Borders*).

### Making failure effects concrete

Today, failure is **narrative only** — `rollSpellFailure` posts the rolled entry's
`resultText` to chat; entries carry no mechanical payload (just `resultText` / `resultTag` /
`resultNotes`). Success, by contrast, applies real usage-effects. To let the defence check
*gate* something, the per-nature failure entries must carry **authored usage-effects** from
the controlled vocabulary in
[`effect-subtype-catalog-spec-v1.md`](effect-subtype-catalog-spec-v1.md).

No new schema is needed for the defence check: the effect payload already has the hooks —
**`ResistanceFormula`** (the difficulty the magic-skill save rolls against),
**`OnFailure`** (what a failed save applies), and **`OnPartial`** (a downgraded outcome).
The border modifies the save roll. So a single authored effect fully expresses "save,
difficulty, negate-or-downgrade."

Starter mapping from the current `resultTag`s to concrete catalog effects (the existing
`resultNotes` already point at most of these):

| Tier | Tag | Concrete effect (`Type / Subtype`) |
|---|---|---|
| Minor | Fizzle / Omen / CloudedOmen / Notice | none, or `Descriptive / Omen` (stay narrative) |
| Minor | Fatigue | `Stat / Resource` → Stamina − |
| Minor | Delay | `Tag / ConditionTag` (spell lockout) |
| Minor | IllLuck | `Status / IllLuck` |
| Minor | Taint | `Trait / VisibleTell` (on the focus/vessel) |
| Major | Backlash | `Status / Weakened` (`PayloadDice`) or `Stat / PrimaryStat` − |
| Major | Misfire / FalseRevelation | `Hybrid` redirect of `SuccessEffects`; `Revelation / Omen` (deceptive) |
| Major | Attention / Marked | `Status / Marked` |
| Major | BlightedPlace | `Binding / BindToPlace` |
| Major | SchoolStrain | `Stat / Threshold` (later rites harder) |
| Catastrophic | Manifestation | `Grant / BoundEntity` — the being is loosed |
| Catastrophic | Inversion | `Hybrid` invert `SuccessEffects` |
| Catastrophic | LastingCurse | `Status / Cursed` or `Grant / ConditionItem` (a Supernatural Mark) |
| Catastrophic | RitualBlight | `Binding / BindToPlace` |
| Catastrophic | Loss | `Stat / PrimaryStat` − (permanent) or `Remove / Trait` |
| Catastrophic | Collapse | `Stat / Resource` HP damage + `Status / Wounded` |
| Catastrophic | WrongBinding | `Binding / BindToItem` or `BindToActor` |
| Catastrophic | Breach | `Tag / NatureTag` (place thinned) + `Descriptive / Manifestation` |

This is content-authoring work (the eight Mid/High per-nature tables, plus deciding which
Minor entries stay purely narrative). It does not block the mechanics design.

### Strain (the cost of casting)

Working a ritual takes something out of the caster, paid in **stat points** (the magic
stat):

- **Tough steps** cost stat points **whether they succeed or fail** — the act itself is
  draining.
- **Ordinary steps** cost stat points **only on failure** — a clean success is free.

Some borders also carry a stat cost (the **Blood border** costs **stamina**; see
*Borders*). Strain runs alongside the race as attrition. (Open: which stat is drained, the
amounts, how a step is flagged "tough", and whether running dry forces an abort.)

### Material quality (Spoilage)

Steps that consume a `RequiredItem` depend on the **quality** of that component. Spoiled,
substituted, or unclean materials make the step harder or cause it to fail outright.
(Open: how component quality is represented on items.)

## Execution flow

1. **Assemble** the ritual (existing generation): static + randomly drawn steps, all
   visible, each with its difficulty. The bound `EntityNature` is read from the spell.
1. **Open the race board** with one track; `total` = the success target.
1. **Walk the Working steps** in order. Each is an opposed roll; success ticks the track
   up. Pay strain as steps resolve. The board animates progress live.
1. **Completion** — track reaches target → **success**. Resolve `SuccessEffects` via the
   existing `resolveUsageEffectsFromCarrier` path (the same one "Ready" spells use).
1. **Shortfall or abort** — the caster runs out of steps short of target, or breaks off.
   The ritual fails. If the spell is bound to an entity nature, this triggers a **defence
   check**; otherwise the effect simply does not occur.

## Defence check (surviving a loosed being)

A defence check happens **only when a failed/aborted rite is bound to an entity nature**
and an **effective border** has been laid (see *Borders*). The border is what gives the
caster a save at all; with no effective border, the authored failure effect lands in full.

The check has **no global difficulty formula — its stakes come from the authored effect it
defends against.** Each per-nature failure entry carries its own effect through the usage-
effect pipeline (the same one as `SuccessEffects` /
[`usage-effect-action-resolver`](../../scripts/services/usage-effect-action-resolver.js)),
and that authored effect supplies:

- the difficulty the caster's **magical skill** is rolled against, and
- what a **pass** does — fully negate the effect, or merely downgrade it — versus what a
  **fail** applies.

The border modifies the roll (advantage die and/or flat mod). So the *mechanism* is fixed
(a magic-skill save, border-modified, never against a live entity) while the *stakes* live
in content, next to the effect being defended against — different natures and ranks can be
as punishing or as forgiving as their authored effects say.

## Borders (the only failure protection)

A border is the circle that keeps a loosed being from reaching the caster. Each border is
keyed to an entity nature, and its effectiveness is **rank-gated**: cheaper, common borders
suffice against low- and mid-rank workings, but a **high-rank** working can be defended by
only one specific premium border per nature.

| Entity nature | Low / mid-rank border(s) | High-rank — the *only* effective border | Cost / notes |
|---|---|---|---|
| Undead | Salt, Grave-dirt | **Grave-dirt** | |
| Unnatural | Chalk, Blood | **Blood** | Blood border costs **stamina** |
| Nature Spirits | **Iron** (new spell) | **Silver** (new spell) | Iron is the lower-rank ward |
| the Unseen | Salt | **Silver** (new spell) | Silver covers both Unseen and Nature Spirits at high rank |

Premium borders (Grave-dirt, Blood, Silver) remain valid at **every** rank; only the
common borders (salt, chalk, iron) are limited to low and mid rank.

New content required:

- an **Iron border** spell — ward vs Nature Spirits (lower rank);
- a **Silver border** spell — the high-rank ward vs **both** Nature Spirits and the Unseen.

Existing **Blood** and **Grave-dirt / Salt** borders are reused; the **Blood border** gains
a **stamina cost**.

A matching, rank-appropriate border enables the defence check and modifies it with the two
native levers the content already uses: a bonus **die** ("with advantage", e.g. Grave Soil
& Salt Border) and/or a flat **mod**. Bringing the wrong border — or a low-rank border to a
high-rank rite — gives no protection at all. Each border declares which nature(s) it
counters and at which rank (a `CountersNatures` / rank field on the border spell).

**Out of scope:** spells like Empty Mirror or Dream Warding protect against a *specific
consequence* (possession, dream-intrusion) rather than the being itself. They are not part
of this mechanic and remain ordinary spells handled elsewhere.

**A border's own failure is benign.** Laying a border is itself a low-stakes working with
`FailureProfile: None` — if its casting fails, the circle simply provides no protection.
Borders never produce fallout of their own.

**Content cleanup:** Protective Border and Protective Circle read as generic duplicates of
the material borders and should be merged into them or removed, so "border" means one clear
thing.

## Race board visualization

- The **single Working track** maps directly to one race-board row, filling as steps
  succeed; winner splash on completion.
- **Borders are not a race** — a border is pre-ritual preparation and a modifier to the
  defence check, so it lives as context beside the board rather than as a racing row.
- Open: whether to surface the defence check / applicable border on the board UI at the
  moment of failure, or only in chat.

## Integration points (existing code)

- **Resolution**: opposed-roll helpers in
  [`spell-casting-service.js`](../../scripts/services/spell-casting-service.js)
  (`getPrimaryStatFormula`, `evaluateRollFormula`). The failure defence rolls vs a
  difficulty carried by the authored effect, not the `rollManualContest` target-stat path.
- **Success**: `resolveUsageEffectsFromCarrier` (spell `SuccessEffects`).
- **Failure**: `rollSpellFailure` → nature-specific `FailureTable`; the defence check gates
  the entry's effect through
  [`usage-effect-action-resolver`](../../scripts/services/usage-effect-action-resolver.js).
- **Board**: `globalThis.RaceBoard` / `scripts/raceboard/` (ephemeral or document-backed
  track, GM-driven, broadcasts to players).
- **Generation** (unchanged): `ritual-generation-service.js`.

## Rejected alternatives (and why)

- **Combat symbol-dice for crits** — "crit" in 1547 is a symbol tally on the combat
  dice, not a numeric threshold; importing a "natural 6 = crit" rule would contradict the
  system, and the skill dice (Grace, Heavy, …) model martial skill, not ritual fate.
- **Risk + Multiplier "fate" dice** — closest thematic fit, but mapping their combat
  semantics (`damage`, `x0`) onto a ritual step felt forced/unnatural.
- **Progress-vs-Backlash two-track race** — replaced by a single track; clean success/fail
  with a defence check is simpler and aligns with the existing success/failure-table code.
- **Hidden step risk** — rejected in favour of fully visible steps.
- **In-ritual "safeguard steps" with a weakest-link rule** — collided with the existing
  protection-spell family. Borders own the safety role.
- **`DangerTag` → ward matching** — the 8-tag taxonomy mixed unlike things. Fallout and
  protection are now keyed to the bound entity nature; the "mundane" tags became their own
  mechanics (strain, material quality, abort).
- **Rolling the defence against the entity's own stats** — would force pre-generating the
  monster the rite concerns; replaced by a fixed-difficulty check gated by an effective
  border.
- **Static-plus-random / multi-nature entity model** — narrowed to a single static nature
  from the closed four-nature set.
- **Consequence-specific wards in scope** (Empty Mirror, Dream Warding) — guard a specific
  outcome, not the being; out of scope.

## Open questions / not yet decided

1. **Low/mid-rank commons** — settled: salt → Unseen, salt/grave-dirt → Undead,
   chalk → Unnatural, iron → Nature Spirits, with premium borders valid at every rank.
   Remaining: whether any common border serves more than one nature at low rank.
1. **Failure table authoring** — structure settled (severity = rank; no-failure & Low-rank
   entity-bound use the generic tables; only Mid/High are per-nature → 8 new tables, seeded
   from the current Catastrophic grab-bag). Remaining: write those entries, and confirm
   `FailureProfile: None` as the no-failure flag (default for all borders, plus chosen
   very-easy spells).
1. **Defence check stakes** — settled: a border-enabled magic-skill save whose difficulty
   and pass/fail consequences are carried by the authored failure effect via the existing
   `ResistanceFormula` / `OnFailure` / `OnPartial` payload fields — no new schema. Remaining
   is authoring, not design.
1. **Border costs** — the Blood border's stamina amount, and whether the other premium
   borders (Grave-dirt, Silver) carry costs too.
1. **Magical skill** — which stat the Working rolls and defence check use.
1. **Strain details** — which stat is drained, point amounts, how a step is flagged
   "tough", whether running dry forces an abort.
1. **Material quality** — how component quality (`RequiredItem`) is represented.
1. **Track win condition** — fill *all* steps, or *T of S* with slack? (Simulation strongly
   favours slack; "all must succeed" collapses to single-digit success rates.)
1. **Failed Working step / retries / abort cost** — stall vs cost vs hard-stop; re-attempts;
   any penalty for breaking off beyond the defence check.
1. **Output form** — throwaway prototype driving the real board first, or a wired-in
   `ritual-execution-service` in `1547core`.

## Balance notes (deferred)

Per decision, tuning is deferred. Findings from an opposed-roll Monte-Carlo to carry
into balancing:

- Because advantage **adds dice to a sum**, each advantage die is worth ≈ +3.5 — a large
  swing. Rank-gating to a single effective border keeps this naturally bounded.
- **"Every step must succeed" is unplayable** — per-step odds multiply, collapsing
  multi-step rituals to single-digit success. A *T-of-S* slack model is required.
- Suggested tuning target (to revisit): a prepared, competent caster ≈ 60–70% success;
  unprepared notably lower; harder rituals (more difficulty dice) shift the curve down.
