# Change Carrier Schema Spec v1

This document defines how `Change` records should deliver behavior in `1547Core`.

## Core Principle

A `Change` should not usually be the behavior payload itself.

Instead:

- `ChangeSet` is the authored package.
- `Change` applies one building block.
- granted items carry named behavior.
- `UsageEffect` carries the concrete outcome payload.

This keeps actor composition, ritual content, and monster powers aligned.

## Preferred Change Carriers

### RuleFeature

Use `RuleFeature` as an authoring convenience when a rule naturally wants both a
machine-readable tag and readable trait text.

`RuleFeature` should normalize into separate `Tag` and `Trait` changes at
application or import time.

Typical fields:

- `TagKey`
- `TraitName`
- `TraitText`
- `Visible`
- `DurationType`
- `DurationValue`
- `RemovalMethod`
- `SuppressedBy`

Example:

```yaml
ChangeType: RuleFeature
Operation: Add
TagKey: ImmuneNormalWeapons
TraitName: Untouched by Common Iron
TraitText: Takes no harm from ordinary weapons unless the blow is blessed, silvered, cold iron, or magical.
Visible: true
DurationType: Permanent
```

Normalized output:

```yaml
- ChangeType: Tag
  Operation: Add
  Value: ImmuneNormalWeapons

- ChangeType: Trait
  Operation: Add
  Name: Untouched by Common Iron
  Text: Takes no harm from ordinary weapons unless the blow is blessed, silvered, cold iron, or magical.
```

Best for:

- immunities
- vulnerabilities
- folklore bindings
- supernatural senses
- passive monster rules
- blessings and curses with both automation and readable text

Do not force `RuleFeature` when:

- only a tag exists
- only trait text exists
- one trait maps to several tags
- tag and trait need different lifetimes

### Stat

Use `Stat` for direct numeric changes on the target.

Examples:

- `HP +3`
- `MoveGround +2`
- `MoveFly = 6`
- `Power +1`

### Tag

Use `Tag` for machine-readable rule facts.

Examples:

- `FearAura`
- `SunlightSensitive`
- `ImmuneNormalWeapons`
- `ThresholdBound`

### Trait

Use `Trait` for readable rules text.

Examples:

- `Dreadful Presence`
- `Bound to Custom`
- `Untouched by Common Iron`

### ItemGrant

Use `ItemGrant` when a change should add a discrete content object.

This is the preferred carrier for reusable behavior.

## ItemGrant Subtypes

### GrantPowerItem

Use when granting a persistent supernatural feature or reusable magical ability.

Best for:

- monster auras
- pact boons
- inherited magical gifts
- recurring occult triggers

Typical owned content:

- `Power` item containing one or more `UsageEffect`s

### GrantSpell

Use when granting access to a ritual working.

Best for:

- learned ritual access
- pact-granted rites
- powers that permit a specific spell

Typical owned content:

- `Spell` item

### GrantPact

Use when a change creates or attaches a pact relationship.

Best for:

- failed ritual consequences
- inherited blood pacts
- formal bargains

Typical owned content:

- `Pact` item

### GrantActionItem

Use when granting a named monster move, action, attack, or triggered feature.

Best for:

- `Cold Hand`
- `Lead Astray`
- `Drowning Grip`
- `Fear Aura Pulse`

Typical owned content:

- `Power` item or equivalent action item containing `UsageEffect`s

### GrantBoundEntity

Use when a change creates a persistent spirit, demon, familiar, or linked occult presence.

Best for:

- possession
- familiars
- bound spirits in vessels
- enchanted objects carrying beings

Typical owned content:

- bound entity record or item

### GrantWardAnchor

Use when a change creates a persistent ward attached to an object, threshold, or place.

Best for:

- threshold wards
- sealed doors
- alarm wards
- anti-possession circles

Typical owned content:

- ward anchor item

## Optional Carrier

### GrantUsageEffect

This carrier should be rare.

Use only when:

- the outcome is extremely small
- there is no need for a named power or spell item
- a whole granted item would be unnecessary overhead

Examples:

- a very small recurring omen trigger
- a simple domain rider effect

Avoid using `GrantUsageEffect` for:

- monster signature actions
- spells
- pacts
- anything needing more than one effect or its own identity

## Recommended Delivery Chain

The preferred implementation chain is:

1. `ChangeSet`
2. `Change`
3. granted item
4. `UsageEffect`

Examples:

- `Domain: Wood` -> `GrantActionItem: Lead Astray` -> `UsageEffect: Movement / LeadAstray`
- `Pact Boon` -> `GrantSpell: Night Riding`
- `Fear Aura` -> `GrantPowerItem: Fear Aura Pulse` -> `UsageEffect: Status / Afraid`

For passive rules, the preferred implementation chain may instead be:

1. `ChangeSet`
2. `RuleFeature`
3. normalized `Tag + Trait`

## Why This Split

This pattern keeps:

- authored packages readable
- named behaviors inspectable on sheets
- outcomes reusable across monsters and magic
- automation layered cleanly below content

It also avoids overloading the `Change` type with too much runtime meaning.
