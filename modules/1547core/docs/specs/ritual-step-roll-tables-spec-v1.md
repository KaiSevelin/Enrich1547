# Ritual Step Roll Tables Spec v1

This document defines the first shared random ritual-step pools used when a
`Spell` is enriched into a concrete `Ritual`.

Authoritative source data:

- `foundry/Templates/ritual-step-roll-tables.json`

## Purpose

These tables provide the variable procedural burden of a ritual.

They are used after:

1. the spell's `StaticRitualSteps` have been applied
2. the spell's `Complexity` has been read
3. the spell's `RandomStepRollFormula` has been rolled

The result is one generated ritual procedure made of:

- static spell-specific steps
- random drawn steps from one shared complexity pool

## Design Rules

- Static ritual steps always live on the spell directly.
- Random ritual steps are drawn from one of three shared complexity pools:
  - `RitualSteps_Easy`
  - `RitualSteps_Medium`
  - `RitualSteps_Hard`
- These pools are intentionally generic and cross-tradition.
- Environmental requirements are pure prerequisites, not checks.
- Learned and pagan skills may both appear in the tables and may be used
  interchangeably where the spell or tradition allows it.
- The draw mode is currently `distinct`, meaning a ritual should not draw the
  same random step twice from the same table unless a later rule explicitly
  changes that.

## Table Mapping

- `Easy`
  - table id: `RitualSteps_Easy`
  - draw formula: `1d2`
  - intended use: charms, household wards, simple divinations, light knot work
- `Medium`
  - table id: `RitualSteps_Medium`
  - draw formula: `1d3`
  - intended use: stronger wards, spite work, healing, corpse-contact, more
    exacting crafted rites
- `Hard`
  - table id: `RitualSteps_Hard`
  - draw formula: `1d6`
  - intended use: bindings, summonings, transformations, grave power,
    dangerous grimoire work, full ceremonial operations

## Step Categories

The current tables use these broad step categories:

- `Material`
- `Craft`
- `Performance`
- `Environment`
- `Purification` / `Purity`
- `Writing`
- `Placement`
- `DivinatoryFocus`
- `Witness`
- `Resistance`
- `Naming`
- `Isolation`
- `CorpseWork`
- `Alchemy`
- `Boundary`
- `Oath`

These categories are not schools of magic. They are authoring aids for the
kind of burden or requirement a ritual step adds.

## Easy Table

The easy pool focuses on light added burdens such as:

- small personal foci
- minor crafted tokens
- short recitations or songs
- simple fitting locations
- light washing or purification
- copying a short sign
- placing a token in the right location
- fixing a question through an omen focus

This pool should make rituals more specific without making them feel
ceremonially heavy.

## Medium Table

The medium pool adds stronger procedural demands such as:

- sympathetic traces tied to a target
- more exact craft or alchemical preparation
- sustained performance
- significant time or place conditions
- short fasting or silence
- witnesses, helpers, or kin
- longer signs, seals, or written formulae
- proper boundary making
- herbal preparation
- endurance against a first degree of backlash

This pool is where most substantial low-magic rituals should live.

## Hard Table

The hard pool adds full ceremonial or dangerous demands such as:

- true names
- circles, seals, or full diagrams
- exacting alchemical operations
- planetary or celestial timing
- vigils
- difficult sustained performance
- rare or hazardous components
- corpse handling
- isolation from ordinary human life
- coordinated assistants
- resistance against hostile occult pressure
- oath-burdens or self-binding consequences

This pool should feel costly, serious, and hard to improvise.

## Authoring Guidance

- Prefer broadly reusable steps over one-off spell-specific lines.
- Keep spell-specific identity in `StaticRitualSteps`.
- Use the random pools to vary burden, atmosphere, and practical obstacles.
- Put target-specific or tradition-specific details in:
  - `requiredItem`
  - `timingConstraint`
  - `contactRestriction`
  - `stepNotes`
- If a step represents danger rather than procedure, mark that through
  `dangerTag` and `failureConsequence`.

## Current Data Shape

Each roll table entry in `ritual-step-roll-tables.json` currently carries:

- `id`
- `stepScope`
- `stepType`
- `traditionTag`
- `stepText`
- `skillCheck`
- `difficulty`
- `requiredItem`
- `timingConstraint`
- `contactRestriction`
- `dangerTag`
- `repeatable`
- `failureConsequence`
- `stepNotes`

This mirrors the `Ritual Step` template closely enough that future enrichment
can either:

- instantiate reusable `Ritual Step` items from the table results
- or copy the entry data directly into a generated `Ritual`

## Current Counts

The first authored version contains:

- `RitualSteps_Easy`: 8 entries
- `RitualSteps_Medium`: 10 entries
- `RitualSteps_Hard`: 12 entries

These are starter pools and are expected to grow as more ritual play is
authored.
