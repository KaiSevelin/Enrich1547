# Magic Schema Spec v1

This document defines the first structured schema split for `1547Core` magic content.

## Core Types

- `Power`: a persistent or long-term magical state on an actor, item, or bloodline.
- `Spell`: the named magical working and its canonical outcome.
- `Recipe`: one concrete way to perform a spell.
- `Pact`: an ongoing contract with a human or supernatural patron.
- `Usage effect`: the payload item used to express success, failure, boon, price, and strain effects.

## Design Rules

- `Power` is for blessings, curses, miracles, inherited marks, pact-granted gifts, and long-term occult alterations.
- `Spell` is not the ritual procedure itself. It defines the named working, prerequisites, complexity, schools, and core outcome.
- `Recipe` is the ritual procedure. Multiple recipes may exist for the same spell.
- `Pact` is stateful and must carry patron, obligation, tension, and status progression.
- `Usage effect` remains the shared low-level outcome payload for automation-friendly effects.

## Power Template

Template ID: `Item.w9ky0ZTDvXDs5Ce7`

Fields:

- `PowerType`
- `PowerSource`
- `Severity`
- `SocialStatus`
- `VisibleTell`
- `PowerScope`
- `PowerEffects` item container
- `GrantedSpells` item container
- `TriggerTable`
- `RemovalConditions`
- `InheritanceNotes`
- `SocialConsequences`

Authoring intent:

- Use `PowerEffects` for persistent bonuses, penalties, conditions, and passive magical consequences.
- Use `GrantedSpells` when a power permits limited use of a ritual working.
- Use `TriggerTable` for recurring or situational activation notes.

## Spell Template

Template ID: `Item.2kiWw3Cv5Zk1lZxn`

Fields:

- `SpellKind`
- `Complexity`
- `FailureProfile`
- `FailureTable`
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
- `DefaultComponentsTable`
- `SuccessEffects` item container
- `FailureEffects` item container
- `Recipes` item container

Authoring intent:

- A spell defines the canonical magical effect and its risk profile.
- Use `DefaultComponentsTable` only for parts every recipe should respect.
- Store recipe-specific steps in child `Recipe` items.

## Recipe Template

Template ID: `Item.Qv6pN2Lm8R4tY1Ks`

Fields:

- `Tradition`
- `RecipeLineage`
- `Reliability`
- `ComplexityAdjustment`
- `RitualStepsTable`
- `RandomStepPoolTable`
- `TimingConstraint`
- `ContactRestriction`
- `WitnessRequirement`
- `OutcomeModifier`

Authoring intent:

- Each recipe is one executable ritual script for a spell.
- `RitualStepsTable` holds fixed procedure.
- `RandomStepPoolTable` holds optional or generated steps used to vary executions by complexity or lineage.
- `OutcomeModifier` records how the recipe changes randomness, duration, or strength without redefining the spell.

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
- Use state description fields to record the narrative and procedural meaning of each status.

## Usage Effect Placement

Use `usage-effect` items in the container that reflects outcome role:

- `PowerEffects` for long-term powers
- `SuccessEffects` and `FailureEffects` for spells
- `BoonEffects`, `PriceEffects`, `StrainEffects`, and `BrokenEffects` for pacts

This keeps one effect payload model while preserving the higher-level meaning of the magic system.
