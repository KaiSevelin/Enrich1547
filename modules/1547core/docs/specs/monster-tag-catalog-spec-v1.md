# Monster Tag Catalog Spec V1

## Purpose

This document defines the canonical actor-side movement fields, automation tags,
and base trait authoring conventions for monsters and other non-player actors in
`1547Core`.

The goal is to prevent ad hoc tag growth and to separate:

- movement mode data
- machine-readable automation hooks
- human-readable trait text

## Actor Movement Fields

Movement modes are **numeric actor fields**, not tags.

Canonical actor movement fields:

- `MoveGround`
- `MoveFly`
- `MoveSwim`
- `MoveBurrow`
- `MoveClimb`
- `MovementRemaining`

Rules:

- `MoveGround` is the default authored movement budget in squares.
- `MovementRemaining` is the mutable runtime-facing budget tracker shown on the
  sheet. By default it mirrors `MoveGround`.
- A creature can use a movement mode only when that field is greater than `0`.
- Do **not** author tags such as `Flight`, `Swimmer`, or `Burrower` to express
  basic locomotion.

Movement-specific special rules should instead be expressed as:

- the relevant `Move*` numeric field
- an optional trait entry if special wording is needed

Example:

- A bat-winged spirit uses `MoveFly: 6`
- A water-being that can breathe both air and water uses `MoveSwim: 5` plus the
  tag `Amphibious`

## Actor Tag Storage

Base actor tags are authored in the actor template's `ActorTagTable`.

Each row stores one tag from the canonical list below. Authors should not invent
new tags without updating this spec and the actor template.

Tags from ChangeSets should use the same vocabulary.

## Base Trait Storage

Base actor traits are authored in the actor template's `BaseTraitTable`.

Each row contains:

- `TraitName`
- `TraitDescription`

Traits are explanatory text for humans. They do not replace tags when
automation is expected.

## Canonical Allowed Tags

### Presence and perception

- `DreamIntrusion`
- `FearAura`
- `Glamour`
- `SeeInvisible`
- `SenseLiving`
- `ThresholdAware`
- `UnsettlingPresence`

### Folklore bindings and obligations

- `BarrowBound`
- `HearthBound`
- `NameBound`
- `OfferingBound`
- `OathBound`
- `ThresholdBound`
- `WaterBound`

### Defenses and immunities

- `ImmuneMissiles`
- `ImmuneNormalWeapons`
- `Incorporeal`
- `NoBleeding`
- `NoPoison`
- `ResistNormalWeapons`

### Vulnerabilities and counters

- `BlessedVulnerable`
- `ColdIronVulnerable`
- `FireVulnerable`
- `SilverVulnerable`
- `SunlightSensitive`

### Special nature

- `Amphibious`
- `Regeneration`

## Conventions

### Use a movement field when

- the rule changes squares moved
- the rule enables a movement mode
- the rule changes pathing or traversal

### Use a tag when

- automation needs to query the rule
- a ChangeSet requirement may depend on the rule
- combat resolution may suppress, reduce, or alter damage because of the rule

### Use a trait when

- a GM or player needs readable rule text
- the rule has folklore flavor or conditional wording

### Use tag and trait together when

- the rule is both mechanically important and player-facing

Examples:

- `ImmuneNormalWeapons` + trait text explaining the bypass conditions
- `SunlightSensitive` + trait text explaining what sunlight suppresses or harms
- `ThresholdBound` + trait text explaining exactly how thresholds constrain the creature

## Non-canonical Examples

These should **not** be added as tags:

- `Flight`
- `Swimmer`
- `Burrower`
- `Climber`
- `HiddenFolk`
- `Undead`
- `Beast`

Why:

- movement belongs in `Move*`
- lineage already belongs in `TypeDropdown`

## Cross-references

- `monster-maker-spec-v1.md`
- `monster-creation-guide.md`
- `combat-spec-v2.md`
