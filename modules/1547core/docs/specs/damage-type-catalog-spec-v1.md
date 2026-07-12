# Damage Type Catalog Spec v1

## Purpose

This document defines the canonical vocabulary for classifying harm in
`1547Core`.

It exists so monster resistances, immunities, vulnerabilities, weapon attacks,
natural attacks, spells, and usage effects can all refer to the same stable
damage model.

## Core Principle

Damage classification uses two layers:

- `DamageType`
- `DamageQualifiers`

`DamageType` answers:

- what kind of harm is this at its core?

`DamageQualifiers` answer:

- what source, substance, blessing, curse, or delivery method matters for rule
  interactions?

Do not try to force both questions into one field.

## Why Two Layers

Many important monster defenses in this setting are not about broad elemental
damage categories alone.

Examples:

- silver harms some beings regardless of whether the attack is `Piercing` or
  `Slashing`
- cold iron matters as a folklore counter, not as its own bodily harm pattern
- sunlight may suppress or burn a creature without behaving like a normal weapon
- a bite and a sword slash may both be `Piercing` or `Slashing`, but only one
  may count as `NaturalWeapon`

Because of this, the canonical model is:

- one primary `DamageType`
- zero or more `DamageQualifiers`

## Canonical Damage Types

Every damaging attack, spell, hazard, or usage effect should use one primary
type from this list unless a later spec explicitly allows a composite payload.

### Physical

- `Blunt`
- `Piercing`
- `Slashing`

Use these for most ordinary combat harm from weapons, claws, teeth, falls, and
physical impacts.

### Elemental

- `Fire`
- `Cold`
- `Lightning`

Use these for heat, freezing, storm force, burning breath, magical flame,
unnatural frost, and similar harms.

### Corruptive And Internal

- `Poison`
- `Corruption`

Use `Poison` for venom, toxic bites, tainted fumes, or ingested toxins.

Use `Corruption` for spiritually or supernaturally defiling harm that is not
best modeled as heat, cold, impact, or poison. This includes draining,
withering, or blighting effects when the harmful force is magical or unclean in
nature.

### Vital And Spirit Harm

- `Soul`

Use `Soul` when the attack directly harms life force, spirit, identity, or the
animating self rather than primarily injuring the body.

This is useful for:

- soul drinkers
- ghosts
- possession-related attacks
- certain Zone or Unnatural effects

## Canonical Damage Qualifiers

Qualifiers are optional rule facts attached to a damaging instance. They are
not replacements for `DamageType`.

Recommended first-pass qualifiers:

### Delivery And Source

- `Weapon`
- `NaturalWeapon`
- `Spell`
- `Power`
- `Hazard`

### Folklore And Material Counters

- `NormalWeapon`
- `Blessed`
- `ColdIron`
- `Silver`
- `Sunlight`

### Special Origin

- `Zone`
- `Infernal`
- `Angelic`

Use qualifiers only when some rule, resistance, immunity, vulnerability, or
requirement will actually query them.

## Authoring Rules

### Always choose one primary `DamageType`

Good:

- spear thrust: `Piercing`
- torch strike: `Fire`
- rusalka draining kiss: `Soul`

Bad:

- spear thrust: `Weapon`
- silver knife: `Silver`
- holy water: `Blessed` unless the harm itself is sacred rather than physical

### Add qualifiers only when they matter

Good:

- wolf bite: `Piercing` + `NaturalWeapon`
- blessed arrow: `Piercing` + `Weapon` + `Blessed`
- sunlight exposure: `Fire` + `Sunlight` or `Blessed` + `Sunlight`, depending
  on the authored rule meaning

Bad:

- every ordinary sword strike automatically carrying five source tags no rule
  ever checks

### Prefer bodily type over tool identity

The primary type should describe the harm suffered, not the object used.

Examples:

- mace hit: `Blunt`
- sword cut: `Slashing`
- arrow shot: `Piercing`

### Prefer qualifier for bypass logic

If a creature is vulnerable to silver, cold iron, sunlight, or blessed weapons,
that should usually be modeled through qualifiers or tags, not by inventing new
physical damage types.

## Recommended Damage Modeling By Content Type

### Weapons

Weapon attack profiles should eventually author:

- `DamageType`
- optional `DamageQualifiers`

Examples:

- arming sword: `Slashing`, qualifiers `Weapon`
- war hammer: `Blunt`, qualifiers `Weapon`
- dagger thrust profile: `Piercing`, qualifiers `Weapon`

### Natural Weapons

Monster natural attacks should use the same model as ordinary weapons.

Examples:

- wolf bite: `Piercing`, qualifiers `NaturalWeapon`
- bear claw: `Slashing`, qualifiers `NaturalWeapon`
- basilisk bite: `Piercing`, qualifiers `NaturalWeapon`, with separate poison or
  curse effects if needed

### Spells And Powers

Damaging spells and powers should still choose one primary type.

Examples:

- witchfire: `Fire`, qualifiers `Spell`
- deathly chill: `Cold`, qualifiers `Power`
- soul draining nightmare: `Soul`, qualifiers `Power`
- infernal lash: `Unholy`, qualifiers `Power`, `Infernal`

### Hazards

Scene hazards should use the same vocabulary.

Examples:

- burning roof: `Fire`, qualifiers `Hazard`
- falling masonry: `Blunt`, qualifiers `Hazard`
- cursed mire: `Corruption`, qualifiers `Hazard`

## Resistance, Immunity, And Vulnerability Authoring

`Protection / DamageResistance` and `Protection / DamageImmunity` should
reference this catalog.

Recommended interpretation:

- resist or block a `DamageType`
- resist or block a specific qualifier
- resist a combined authored expression when a later runtime contract supports
  it

Examples:

- fire-resistant spirit:
  - resist `DamageType: Fire`
- ghost immune to ordinary arms:
  - immunity or defense rule against qualifier `NormalWeapon`
- werewolf vulnerable to silver:
  - vulnerability against qualifier `Silver`
- demon resistant to blessed flame only:
  - combine `DamageType: Fire` with qualifier `Blessed` when the runtime later
    supports pair-specific checks

## Relationship To Existing Monster Tags

This catalog does not replace all current monster tags immediately.

Current tags such as:

- `ImmuneNormalWeapons`
- `ResistNormalWeapons`
- `ColdIronVulnerable`
- `SilverVulnerable`
- `BlessedVulnerable`
- `SunlightSensitive`

remain valid authoring shortcuts for monster rules.

However, future item, attack, and effect authoring should prefer this damage
catalog so those tags can be interpreted through a more structured model.

Suggested mapping direction:

- `ImmuneNormalWeapons` -> immunity against qualifier `NormalWeapon`
- `ResistNormalWeapons` -> resistance against qualifier `NormalWeapon`
- `ColdIronVulnerable` -> vulnerability against qualifier `ColdIron`
- `SilverVulnerable` -> vulnerability against qualifier `Silver`
- `BlessedVulnerable` -> vulnerability against qualifier `Blessed`
- `SunlightSensitive` -> vulnerability or suppression rule keyed by qualifier
  `Sunlight`

## First-Pass Authoring Examples

### Ordinary sword

```yaml
DamageType: Slashing
DamageQualifiers:
  - Weapon
  - NormalWeapon
```

### Blessed spear

```yaml
DamageType: Piercing
DamageQualifiers:
  - Weapon
  - Blessed
```

### Wolf bite

```yaml
DamageType: Piercing
DamageQualifiers:
  - NaturalWeapon
```

### Dragon breath

```yaml
DamageType: Fire
DamageQualifiers:
  - NaturalWeapon
```

### Mare's draining touch

```yaml
DamageType: Soul
DamageQualifiers:
  - Unholy
  - Power
```

### Sunlight against a vampire-like being

```yaml
DamageType: Fire
DamageQualifiers:
  - Sunlight
```

## Non-Goals In V1

This catalog does not yet standardize:

- exact runtime field names on weapon items
- pairwise resistance matching syntax
- damage-over-time storage format
- whether poison is always direct damage versus sometimes a separate status
- whether disease should ever count as damage instead of status or condition

Those can be added once the attack item model and effect application model are
ready.

## Cross-References

- `combat-spec-v2.md`
- `equipment-and-dice-schema-spec-v1.md`
- `effect-subtype-catalog-spec-v1.md`
- `monster-tag-catalog-spec-v1.md`
- `monster-creation-guide.md`
