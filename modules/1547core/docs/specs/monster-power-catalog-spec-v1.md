# Monster Power Catalog Spec v1

This document defines the first shared catalog of reusable monster power
concepts for `1547Core`.

It exists to keep monster magical actions, lures, auras, curses, and eldritch
pressures reusable across families instead of re-authoring one-off named powers
for every creature.

It should be read alongside:

- `effect-subtype-catalog-spec-v1.md`
- `change-carrier-schema-spec-v1.md`
- `usage-effect-action-resolver-spec-v1.md`
- `monster-maker-spec-v1.md`

## Purpose

A monster power is a granted action, triggered feature, aura, or occult ability
that carries one or more `UsageEffect` payloads.

A good monster power answers:

- what does this monster do that is more than a normal attack?
- what gameplay pattern does it create?
- which `EffectType` and `EffectSubtype` does it rely on?
- is it direct, ambient, social, spatial, or spiritual?

## Core Rule

Monster powers should usually be granted through:

- `GrantActionItem`
- `GrantPowerItem`

Power names may vary by monster, but the underlying power concept should be
reused whenever possible.

Example:

- `Lead Astray`
  - forest spirit
  - hidden folk guide
  - zone stalker variant

The wording, resistance, and rider details can change while the core concept
stays shared.

## Reuse Rule

The default design goal is:

- reuse the underlying power concept
- customize the payload, flavor, and restrictions per family when needed

Good reuse candidates:

- `Dread Aura`
- `Lead Astray`
- `Tempting Whisper`
- `Binding Word`
- `Dream Visitation`
- `Soul Drain`
- `Threshold Ward`

## Shared Power Catalog

### `Dread Aura`

- purpose:
  - the creature's presence weakens courage or resolve
- likely effect patterns:
  - `Influence / Fear`
  - `Status / Afraid`
- typical families:
  - `Undead`
  - `TheUnseen`
  - `Zone`
  - `Unnatural`

### `Lead Astray`

- purpose:
  - misdirects targets away from safety, road, group, or purpose
- likely effect patterns:
  - `Movement / LeadAstray`
  - `Status / Confused`
- typical families:
  - `NatureSpirit`
  - `HiddenFolk`
  - `Zone`

### `Tempting Whisper`

- purpose:
  - urges corruption, surrender, vanity, appetite, or false agreement
- likely effect patterns:
  - `Influence / Temptation`
  - `Influence / Suggestion`
- typical families:
  - `Unnatural`
  - `TheUnseen`
  - `HiddenFolk`

### `Binding Word`

- purpose:
  - compels, restrains, or fixes a target through old law or named command
- likely effect patterns:
  - `Binding / BindByName`
  - `Binding / BindByOath`
  - `Influence / Obedience`
- typical families:
  - `TheUnseen`
  - `Unnatural`

### `Dream Visitation`

- purpose:
  - reaches the target through sleep, omen, or nightmare
- likely effect patterns:
  - `Possession / DreamRiding`
  - `Revelation / DreamMessage`
  - `Influence / Fear`
- typical families:
  - `Unnatural`
  - `Undead`
  - `Zone`

### `Soul Drain`

- purpose:
  - harms life force, spirit, or animating self
- likely effect patterns:
  - `Protection` interaction target
  - `DamageType: Soul`
  - `Status / Weakened`
- typical families:
  - `Undead`
  - `Unnatural`
  - `Zone`

### `Possess Host`

- purpose:
  - enters, rides, or partially controls a target body
- likely effect patterns:
  - `Possession / AttachSpirit`
  - `Possession / FullControl`
- typical families:
  - `Unnatural`
  - `Undead`

### `Threshold Ward`

- purpose:
  - marks or protects a line, home, chamber, or sacred boundary
- likely effect patterns:
  - `Ward / Threshold`
  - `Ward / Seal`
  - `Ward / Alarm`
- typical families:
  - `NatureSpirit`
  - `TheUnseen`
  - `Unnatural`

### `Curse Glance`

- purpose:
  - marks, weakens, or begins a curse through sight or attention
- likely effect patterns:
  - `Status / Cursed`
  - `Trait / CurseText`
  - `Influence / Fear`
- typical families:
  - `Cursed`
  - `TheUnseen`
  - `Unnatural`

### `Drowning Grip`

- purpose:
  - drags a target toward water, suffocation, or submersion
- likely effect patterns:
  - `Movement / DragUnder`
  - `Status / Weakened`
- typical families:
  - `NatureSpirit`
  - `Undead`

### `Omen Manifestation`

- purpose:
  - announces a coming event through sign, sound, beast-shape, or apparition
- likely effect patterns:
  - `Revelation / Omen`
  - `Descriptive / Manifestation`
- typical families:
  - `TheUnseen`
  - `Zone`
  - `Undead`

### `Zone Pressure`

- purpose:
  - makes the area itself feel wrong, watched, or unsafe
- likely effect patterns:
  - `Influence / Fear`
  - `Movement / LeadAstray`
  - `Descriptive / Omen`
- typical families:
  - `Zone`
  - `ZoneColossus`

## Power Families By Gameplay Shape

For authoring, monster powers usually fall into one of these shapes:

- direct hostile action
  - example: `Soul Drain`
- social or mental pressure
  - example: `Tempting Whisper`
- spatial control
  - example: `Lead Astray`
- persistent aura
  - example: `Dread Aura`
- occult bond or intrusion
  - example: `Binding Word`, `Possess Host`
- omen or scene-pressure ability
  - example: `Omen Manifestation`, `Zone Pressure`

This is useful because many monsters need one power from several shapes, not
three versions of the same shape.

## When To Use A Natural Weapon Instead

Do not author a monster power when the action is mainly bodily harm through the
monster's frame.

Use the natural-weapons catalog for:

- bite
- claw
- gore
- slam
- trample
- constriction

Use a power when the effect is primarily magical, spiritual, social, or
environmental.

## First-Pass Implementation Goal

The first practical monster power library should include:

- `Dread Aura`
- `Lead Astray`
- `Tempting Whisper`
- `Binding Word`
- `Dream Visitation`
- `Soul Drain`
- `Possess Host`
- `Threshold Ward`
- `Curse Glance`
- `Drowning Grip`
- `Omen Manifestation`
- `Zone Pressure`

That is enough to cover most first-wave eerie, supernatural, and folkloric
monsters without overfitting each power to one named creature.
