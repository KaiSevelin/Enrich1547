# Magic Schema Spec v1

This document defines the current structured schema split for `1547Core`
magic content.

Authoritative source note:

- [`magic-source-outline-spec-v1.md`](C:/temp/Enrich%201547/modules/1547core/docs/specs/magic-source-outline-spec-v1.md)
  is the source-aligned outline derived from the uploaded `Magic.md`.
- The human spell catalog in `foundry/Templates/spells.json` should stay aligned
  with that outline's spell list.

## Core Types

- `Supernatural Mark`: a persistent or long-term magical state such as a
  blessing, curse, inherited sign, mutation, or favor.
- `Monster Magic`: a thin carrier for active monster occult abilities, auras,
  pressures, touches, and signs.
- `Spell`: the named magical working and its canonical outcome.
- `Ritual`: a generated or authored execution of a spell after ritual steps
  have been assembled.
- `Ritual Step`: one reusable procedural step that can be assembled into a
  ritual or used in step-generation tables.
- `Pact`: an ongoing contract with a human or supernatural patron.
- `Usage effect`: the payload item used to express success, failure, boon,
  price, strain, and monster action effects.

## Design Rules

- `Supernatural Mark` is for blessings, curses, inherited marks, pact-granted
  gifts, miracles, and long-term occult alterations.
- `Monster Magic` is for monster-owned magic that is not itself a blessing or
  curse on a bearer.
- `Spell` is not the ritual procedure itself. It defines the named working,
  prerequisites, strength, schools, and canonical outcome.
- `Spell` should point to ritual-generation tables rather than storing full
  ritual procedures directly.
- `Ritual` is the enriched execution artifact created from a spell by
  assembling steps, constraints, and modifiers.
- `Ritual Step` is the reusable authored unit for one procedural requirement,
  action, timing, offering, defense, or danger within a ritual.
- `Failure` for spells should be roll-table-driven rather than embedded as one
  fixed item list.
- `Pact` is stateful and must carry patron, obligation, tension, and status
  progression.
- `Usage effect` remains the shared low-level outcome payload for
  automation-friendly effects.

## Supernatural Mark Template

Template ID: `Item.w9ky0ZTDvXDs5Ce7`

Fields:

- `MarkNature`
- `MarkSource`
- `Potency`
- `Visibility`
- `SocialStanding`
- `VisibleTell`
- `MarkScope`
- `MarkEffects` item container
- `GrantedSpells` item container
- `MarkTriggerTable`
- `RemovalConditions`
- `TransmissionNotes`
- `SocialConsequences`
- `BearerNotes`

Authoring intent:

- Use `MarkEffects` for persistent bonuses, penalties, conditions, and passive
  magical consequences.
- Use `GrantedSpells` when a mark permits limited use of a ritual working.
- Use `MarkTriggerTable` for recurring or situational activation notes.

## Monster Magic Template

Template ID: `Item.M0nMgk7Yp2RsT5Vu`

Fields:

- `MagicKind`
- `UseMode`
- `TriggerText`
- `RangeText`
- `CostText`
- `FamilyNotes`
- `MagicEffects` item container
- `MagicNotes`

Authoring intent:

- Keep this template thin.
- Use it for named monster actions, auras, pressures, touches, or signs.
- Put the actual magical payload in `MagicEffects`.
- Do not use this template for persistent blessings or curses on a bearer. Use
  `Supernatural Mark` for those.

## Spell Template

Template ID: `Item.2kiWw3Cv5Zk1lZxn`

Fields:

- `SpellKind`
- `Strength`
- `Complexity`
- `RitualProfile`
- `SchoolRequirementMode`
- `SchoolRequirementsTable`
- `FailureProfile`
- `RandomOutcome`
- `SpellNotes`
- school checkboxes:
  - `Alchemy`
  - `Astrology`
  - `Divination`
  - `Grimoire`
  - `Knot`
  - `Necromancy`
  - `Religion`
  - `Wards`
- `PrerequisitesTable`
- `StaticRitualSteps`
- `SuccessEffects` item container
- `RitualStrengthTable`
- `RandomStepRollFormula`
- `RitualStepTable`
- `RitualModifierTable`
- `RitualAssemblyNotes`
- `FailureTable`
- `FailureEscalationTable`
- `FailureNotes`

Authoring intent:

- A spell defines the canonical magical effect, its strength, and its risk
  profile.
- Static ritual steps live on the spell directly rather than being randomly
  generated.
- `Complexity` is an explicit spell property and drives how many random ritual
  steps are drawn.
- The default complexity mapping is:
  - `Easy` -> `1d2`
  - `Medium` -> `1d3`
  - `Hard` -> `1d6`
- The three random step pools are:
  - `RitualSteps_Easy`
  - `RitualSteps_Medium`
  - `RitualSteps_Hard`
- `RitualStepTable` should point at the pool that matches the spell's
  complexity unless a later authored exception says otherwise.
- `SchoolRequirementMode` is `Any` unless the source explicitly requires
  schools with `and`, in which case it is `All`.
- Environmental requirements belong to generated ritual steps or
  prerequisites; they are pure requirements rather than skill checks.
- Learned and pagan ritual skills may be treated as interchangeable where the
  casting tradition allows it.
- A spell stores ritual-generation table references instead of one baked ritual
  procedure.
- Use `SuccessEffects` for the canonical magical outcome.
- Use the ritual generation fields when creating or enriching a ritual from the
  spell.
- Use the failure fields to resolve roll-table-driven fallout.

## Ritual Template

Template ID: `Item.Qv6pN2Lm8R4tY1Ks`

Fields:

- `BaseSpell`
- `SpellStrength`
- `Tradition`
- `RitualLineage`
- `Reliability`
- `GeneratedFromTable`
- `RitualStepsTable`
- `TimingConstraint`
- `ContactRestriction`
- `WitnessRequirement`
- `FailureTableUsed`
- `OutcomeModifier`

Authoring intent:

- Each ritual is one executable ritual instance derived from a spell.
- `RitualStepsTable` holds the assembled procedure after enrichment.
- `GeneratedFromTable` records which ritual-generation table or profile
  produced it.
- `FailureTableUsed` records which failure table applies to this assembled
  ritual.
- `OutcomeModifier` records how the ritual changes randomness, duration, or
  strength without redefining the spell.

## Ritual Step Template

Template ID: `Item.R7sTu4Qn2Lp8Vx5K`

Fields:

- `StepType`
- `StepScope`
- `StepText`
- `TraditionTag`
- `SkillCheck`
- `Difficulty`
- `RequiredItem`
- `TimingConstraint`
- `ContactRestriction`
- `DangerTag`
- `Repeatable`
- `FailureConsequence`
- `StepNotes`
- `StepEffects` item container

Authoring intent:

- Use `Ritual Step` for reusable authored steps rather than embedding every
  step as plain text inside a ritual.
- `StepScope` distinguishes mandatory, optional, alternative, and escalation
  steps.
- When used as generated ritual steps, environmental requirements should be
  modeled as pure constraints rather than checks.
- `TraditionTag` helps one spell resolve differently across grimoires,
  folk-traditions, church rites, or alchemical schools.
- `StepEffects` is reserved for later automation where a step itself can
  create a condition, risk, modifier, or contest.

## Ritual Step Roll Tables

See:

- [`ritual-step-roll-tables-spec-v1.md`](C:/temp/Enrich%201547/modules/1547core/docs/specs/ritual-step-roll-tables-spec-v1.md)

Current shared pools:

- `RitualSteps_Easy`
- `RitualSteps_Medium`
- `RitualSteps_Hard`

Authoritative data source:

- `foundry/Templates/ritual-step-roll-tables.json`

## Spell Failure Roll Tables

See:

- [`spell-failure-roll-tables-spec-v1.md`](C:/temp/Enrich%201547/modules/1547core/docs/specs/spell-failure-roll-tables-spec-v1.md)

Current shared pools:

- `SpellFailure_Minor`
- `SpellFailure_Major`
- `SpellFailure_Catastrophic`

Authoritative data source:

- `foundry/Templates/spell-failure-roll-tables.json`

## Pact Template

Template ID: `Item.HPYYc2P0Ouagicmr`

Fields:

- `PactType`
- `Patron`
- `CurrentStatus`
- `Tension`
- `BoonText`
- `PriceText`
- `ObligationText`
- `FulfillmentText`
- `BreakText`
- `GrantedPowers` item container
- `BoonEffects` item container
- `PriceEffects` item container
- `StrainEffects` item container
- `BrokenEffects` item container
- state descriptions:
  - `DormantState`
  - `ActiveState`
  - `StrainedState`
  - `BrokenState`
  - `FulfilledState`

Authoring intent:

- Use `GrantedPowers` for persistent pact gifts.
- Use effect containers for automation-friendly consequences at each stage.
- Use state description fields to record the narrative and procedural meaning
  of each status.

## Disease Template

Template ID: `Item.DZ7sK2mLp9Qx4TvR` *(provisional — minted for this template)*

A disease is authored as an item. The **same item is granted onto an actor when contracted**;
the actor's copy carries the live `CurrentPhase` / `PhaseDaysElapsed` / `CureBoxesFilled`
state, so one template serves both as the canonical definition and as the on-sheet
affliction. See [`disease-system-spec-v1.md`](disease-system-spec-v1.md) for the rules.

Fields — **definition**:

- `Description`
- `DiseaseCause` — select: `Humour`, `AstralMiasma`, `EnglishMiasma`, `StaleMiasma`,
  `MarshMiasma`, `Spirit`, `Unnatural`
- `AssociatedHumour` — select: `None`, `Blood`, `YellowBile`, `BlackBile`, `Phlegm`
- `ContagionStat` — select: `Stamina`, `Faith`, `Power`
- `ContagionDifficulty` — text formula (`3d6`, or `SpiritPower` for a vs-spirit contest)
- `ImmunityRule` — select: `None`, `OnlyHumour` (only the associated humour can contract),
  `BalancedImmune` (no dominant humour → immune), `FaithExceedsSpirit`
- `ResistanceRule` — select: `None`, `NotHumour` (advantage when not dominated by a humour),
  `FaithDiceAtLeast` (advantage when Faith dice ≥ value)
- `ResistanceValue` — number/text param for the resistance rule
- `Phases` — dynamic table: `Phase` (Incubation/Symptoms/Onset/Crisis/Resolution/
  Convalescence) · `Duration` (text formula, e.g. `1d3 days`, `NA`) · `Condition`
  (None/Weak/Exhausted) · `Effect` (narrative + permanent stat steps)
- `CureBoard` — dynamic table: `Phase` (OnsetAndBefore/Onset/Crisis/All) · `Role`
  (Physician/Barber-Surgeon/Apothecary/Cleric/Player) · `Action` (text) · `Skill`
  (Medicine/Surgeon/Herbalism/Apothecary/Alchemy/Religion/Stamina) · `Difficulty` (text formula). One row per
  cure-board box.
- text fields: `ResolutionText`, `Prevention`, `Diagnosis`, `Cure`, `Convalescence`

Fields — **live affliction state** (populated on the actor's copy):

- `CurrentPhase` — select (the phase enum)
- `PhaseDaysElapsed` — number
- `CureBoxesFilled` — text/JSON list of filled cure-board box ids for the current phase

Authoring intent:

- The `disease-service` reads `ContagionStat` / `ContagionDifficulty` / `ImmunityRule` /
  `ResistanceRule` to automate the contraction check against `Humour_*`, Faith dice, or a
  spirit's Power.
- On contraction it grants the disease item to the actor and sets `CurrentPhase` to the
  first timed phase.
- It advances `CurrentPhase` when `PhaseDaysElapsed` exceeds the phase `Duration`.
- It builds the treatment race board from the `CureBoard` rows whose `Phase` matches
  `CurrentPhase` (boxes = those rows), resetting `CureBoxesFilled` on phase advance.

## Usage Effect Placement

Use `usage-effect` items in the container that reflects outcome role:

- `MarkEffects` for long-term blessings, curses, and marks
- `MagicEffects` for monster magic
- `SuccessEffects` for spells
- `BoonEffects`, `PriceEffects`, `StrainEffects`, and `BrokenEffects` for
  pacts

This keeps one effect payload model while preserving the higher-level meaning
of the magic system.
