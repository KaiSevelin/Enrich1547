# Spell Failure Roll Tables Spec v1

This document defines the first-pass roll tables used when a spell cast fails.

## Purpose

- give every spell a real failure table through `FailureProfile`
- let `Cast Spell` resolve failure automatically without bespoke spell logic
- keep the first pass historical, folkloric, and system-light

## Shared Tables

Current shared tables:

- `SpellFailure_Minor`
- `SpellFailure_Major`
- `SpellFailure_Catastrophic`

Authoritative source data:

- `foundry/Templates/spell-failure-roll-tables.json`

## Spell Link Rule

If a spell does not explicitly set `FailureTable`, its runtime and exported
props default to:

- `FailureProfile: Minor` -> `FailureTable: SpellFailure_Minor`
- `FailureProfile: Major` -> `FailureTable: SpellFailure_Major`
- `FailureProfile: Catastrophic` -> `FailureTable: SpellFailure_Catastrophic`

## Runtime Use

The `Cast Spell` action:

1. checks the spell's static skill gates
2. resolves success effects if those gates pass
3. rolls the linked failure table automatically if they fail

This is intentionally conservative:

- it uses `StaticRitualSteps` as the cast gate
- it does not yet model a richer casting-roll contest
- it provides a complete playable loop now

## Authoring Guidance

- `Minor` should cover fizzle, omen, spoiled materials, mild strain, and
  short-lived magical inconvenience.
- `Major` should cover backlash, misfire, mark, spiritual attention,
  blighted place, or redirected effect.
- `Catastrophic` should cover inversion, breach, lasting curse, wrong binding,
  severe collapse, or uncontrolled manifestation.

## Future Expansion

Likely next layers:

- school-specific failure tables
- spell-specific failure overrides
- escalation-table chaining
- stronger links between failure results and `Supernatural Mark`, `Pact`, or
  `Monster Magic` creation
