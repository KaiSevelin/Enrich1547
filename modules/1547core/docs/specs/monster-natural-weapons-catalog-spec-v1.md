# Monster Natural Weapons Catalog Spec v1

This document defines the first shared catalog of reusable natural-weapon
concepts for monsters in `1547Core`.

It exists to prevent each monster family from inventing its own ad hoc bite,
claw, horn, slam, or trample items.

It should be read alongside:

- `damage-type-catalog-spec-v1.md`
- `equipment-and-dice-schema-spec-v1.md`
- `monster-maker-spec-v1.md`
- `change-carrier-schema-spec-v1.md`

## Purpose

Natural weapons are monster attacks that come from body shape rather than
crafted equipment.

A natural-weapon entry should answer:

- what bodily attack form is this?
- what primary `DamageType` does it use?
- should it always carry the `NaturalWeapon` qualifier?
- what play pattern does it imply?

Natural weapons should be authored as reusable item patterns, usually granted by
monster ChangeSets through `GrantActionItem`.

## Core Rule

All natural weapons should use:

- one primary `damageType`
- `damageQualifiers: ["NaturalWeapon"]`

Add extra qualifiers only when a real rule cares about them.

Examples:

- wolf bite: `Piercing` + `NaturalWeapon`
- bear claw: `Slashing` + `NaturalWeapon`
- trampling impact: `Blunt` + `NaturalWeapon`

Do not use `Weapon` for ordinary claws, teeth, hooves, or body slams.

## Authoring Shape

Recommended first-pass natural-weapon item shape:

```yaml
ItemType: Power
AttackProfile:
  id: default
  attackType: melee
  damageType: Piercing
  damageQualifiers:
    - NaturalWeapon
  dice:
    - Balanced
    - Grace
    - Control
```

The exact dice profile should vary by creature, but the damage model should
stay consistent.

## Reuse Rule

Natural-weapon concepts should be shared whenever the bodily attack pattern is
the same.

Good reuse:

- `Bite`
- `Claw`
- `Talons`
- `Gore`
- `Trample`

Then let monster family, stats, and granted riders change the expression.

Examples:

- `Bite`
  - wolf
  - dog
  - cursed beast
  - basilisk
- `Claw`
  - bear
  - great cat
  - revenant with rending hands
  - demon animal-servitor

## Shared Natural Weapon Catalog

### `Bite`

- primary use:
  - jaws, fangs, snapping mouths
- default `damageType`:
  - `Piercing`
- default qualifiers:
  - `NaturalWeapon`
- common follow-up riders:
  - `Poison`
  - `Corruption`
  - `Grab`
  - curse transmission

### `Rending Bite`

- primary use:
  - larger predators, cursed jaws, tearing maws
- default `damageType`:
  - `Piercing`
- default qualifiers:
  - `NaturalWeapon`
- common follow-up riders:
  - extra injury
  - bleeding
  - drag or knockdown

### `Claw`

- primary use:
  - paws, hooked fingers, ripping forelimbs
- default `damageType`:
  - `Slashing`
- default qualifiers:
  - `NaturalWeapon`
- common follow-up riders:
  - grapple pressure
  - tearing armor or clothing

### `Talons`

- primary use:
  - birds, flying horrors, grasping feet
- default `damageType`:
  - `Slashing`
- default qualifiers:
  - `NaturalWeapon`
- common follow-up riders:
  - lift
  - snatch
  - pin

### `Gore`

- primary use:
  - horns, tusks, antlers, forward-driving points
- default `damageType`:
  - `Piercing`
- default qualifiers:
  - `NaturalWeapon`
- common follow-up riders:
  - charge bonus
  - shove
  - impale fiction

### `Slam`

- primary use:
  - fists, limbs, roots, tails, heavy appendages
- default `damageType`:
  - `Blunt`
- default qualifiers:
  - `NaturalWeapon`
- common follow-up riders:
  - knockback
  - stagger
  - structural damage

### `Trample`

- primary use:
  - hooves, crushing mass, colossal footfall
- default `damageType`:
  - `Blunt`
- default qualifiers:
  - `NaturalWeapon`
- common follow-up riders:
  - knockdown
  - multi-target pressure
  - hazard-like ground effect

### `Tail Lash`

- primary use:
  - tails used to batter, sweep, or smash
- default `damageType`:
  - `Blunt`
- default qualifiers:
  - `NaturalWeapon`
- common follow-up riders:
  - sweep
  - push
  - area denial

### `Constriction`

- primary use:
  - coils, gripping roots, crushing embrace
- default `damageType`:
  - `Blunt`
- default qualifiers:
  - `NaturalWeapon`
- common follow-up riders:
  - immobilize
  - ongoing pressure
  - drowning or suffocation setup

### `Touch`

- primary use:
  - corpse-cold hands, spirit contact, corrupting brush
- default `damageType`:
  - `Soul`, `Corruption`, or `Cold`
- default qualifiers:
  - `NaturalWeapon`
- note:
  - use only when the body itself is the delivery method
  - if the effect is mainly magical, author it as a monster power instead

## Family Guidance

Typical families most likely to use these:

- `Beast`
  - `Bite`, `Claw`, `Gore`, `Trample`
- `Cursed`
  - `Bite`, `Claw`, `Touch`, `Tail Lash`
- `Undead`
  - `Claw`, `Slam`, `Touch`
- `Colossal`
  - `Bite`, `Slam`, `Tail Lash`, `Trample`
- `Construct`
  - `Slam`, `Crushing Grip`, `Tail Lash` style variants if body-built

## When To Use A Power Instead

Do not force every monster action into the natural-weapons catalog.

Use a monster power item instead when the effect is mainly:

- magical
- social or mental
- area-based omen or dread
- a triggered curse
- a possession, binding, or lure effect

Examples that should usually be powers, not natural weapons:

- `Lead Astray`
- `Dread Gaze`
- `Dream Riding`
- `Soul Drink`
- `Word of Binding`

## First-Pass Implementation Goal

The first practical target should be a small reusable attack library:

- `Bite`
- `Rending Bite`
- `Claw`
- `Talons`
- `Gore`
- `Slam`
- `Trample`
- `Tail Lash`
- `Constriction`
- `Touch`

That is enough to cover most first-wave monsters without inventing custom
attacks for every actor.
