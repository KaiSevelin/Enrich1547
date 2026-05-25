# Effect Authoring Guide

This guide defines when to use `Stat`, `Tag`, `Trait`, `ItemGrant`, and `UsageEffect`
across monsters, powers, spells, and pacts.

## Core Rule

- `Stat` changes a numeric value.
- `Tag` exposes a machine-readable rule fact.
- `Trait` explains a rule to a human reader.
- `ItemGrant` gives the actor a discrete content object.
- `UsageEffect` applies, resolves, or triggers an outcome.

## Authoring Decisions

Ask these in order:

1. Is this always true about the actor or item?
2. Is this a discrete thing the actor should own?
3. Is this an outcome being applied right now?

Preferred mapping:

- always true: `Stat`, `Tag`, `Trait`
- owned thing: `ItemGrant`
- applied outcome: `UsageEffect`

## Use `Stat`

Use `Stat` when the rule is arithmetic or sheet-native.

Examples:

- `HP +3`
- `MoveGround = 5`
- `MoveFly = 6`
- `Power +1`

## Use `Tag`

Use `Tag` when automation or runtime checks need a yes/no rule fact.

Examples:

- `ImmuneNormalWeapons`
- `SunlightSensitive`
- `ThresholdBound`
- `FearAura`
- `Glamour`

## Use `Trait`

Use `Trait` when the user must read the rule in plain language.

Examples:

- `Untouched by Common Iron`
- `Bound to Custom`
- `Fades in Direct Sunlight`

## Use `ItemGrant`

Use `ItemGrant` when the target gains a spell, power, pact, action, or other
inspectable content object.

Examples:

- gain the `Night Riding` spell
- gain a `Pact`
- gain a monster power item

## Use `UsageEffect`

Use `UsageEffect` when something is applied, triggered, resisted, timed, or removed.

Examples:

- apply fear
- reduce movement this scene
- reveal a true name
- apply a curse
- remove possession

Use `EffectType` together with a controlled subtype from
`effect-subtype-catalog-spec-v1.md`.

## Monsters

- passive monster rules: `Tag + Trait`, sometimes `Stat`
- monster actions and triggered features: `ItemGrant + UsageEffect`

Examples:

- `ImmuneNormalWeapons`: `Tag + Trait`
- `Fear Aura`: `Tag + Trait + UsageEffect`
- `Cold Hand`: action item with `UsageEffect`

## Powers

- persistent state: `Stat`, `Tag`, `Trait`
- granted ritual access or gifts: `ItemGrant`
- episodic triggers: `UsageEffect`

## Spells

- `Spell` defines the named magical working
- `Recipe` defines procedure
- `UsageEffect` defines success or failure outcome

## Pacts

- `Pact` defines patron, obligation, and state
- `ItemGrant` carries pact gifts as powers
- `UsageEffect` carries boon, price, strain, and broken consequences

## Usage Effect Application Modes

Every `UsageEffect` should choose one application mode:

- `CreateActiveEffect`
- `DirectDataChange`
- `GrantItem`
- `NarrativeOnly`
- `Hybrid`

Recommended use:

- temporary current condition: `CreateActiveEffect`
- permanent actor change: `DirectDataChange`
- grants spell/power/pact/object: `GrantItem`
- revelation or fiction-only consequence: `NarrativeOnly`
- structural state plus live penalty/bonus: `Hybrid`
