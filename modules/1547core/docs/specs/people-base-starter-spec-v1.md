# People Base Starter Spec v1

This document defines a concrete first-pass content draft for the `People Base`
monster chassis.

It is intended as the reusable root actor for human opposition built as monster
archetypes rather than full player-character sheets, such as guards, commoners,
men-at-arms, knights, raiders, and similar mortal opponents before more
specific domain, motivation, loadout, and quirk ChangeSets are layered on top.

## Design Goals

The base People should be:

- human
- socially legible
- broadly competent enough to support common combat or scene opposition
- easier to author and maintain than building full player-style characters for every NPC enemy
- broad enough to support peasants, guards, brigands, soldiers, retainers, and lesser nobles without yet being specialized into exact profession, class, or battlefield role

It should feel like a mortal person who can fight, flee, obey, panic, or hold
their place, not like a supernatural creature or a fully bespoke hero sheet.

## Base Stats

Recommended actor-side base values:

```yaml
TypeDropdown: People
MoveGround: 5
MoveFly: 0
MoveSwim: 0
MoveBurrow: 0
MoveClimb: 0

Stats_StrengthDice: 1
Stats_StrengthMod: 1
Stats_DexterityDice: 1
Stats_DexterityMod: 1
Stats_StaminaDice: 1
Stats_StaminaMod: 1
Stats_IntelligenceDice: 1
Stats_IntelligenceMod: 1
Stats_FaithDice: 1
Stats_FaithMod: 1
Stats_CharismaDice: 1
Stats_CharismaMod: 1
Stats_PowerDice: 1
Stats_PowerMod: 0
```

This corresponds to:

- modest Strength
- modest Dexterity
- modest Stamina
- modest Intelligence
- modest Faith
- modest Charisma
- low Power

## Passive Rule Changes

These are the concrete passive changes the base monster should receive.

### Mortal Person

```yaml
- _id: PeopleBaseMortalTag
  name: People Base - Mortal Person Tag
  kind: Tag
  tagName: LivingCreature
  notes: The being is an ordinary mortal person rather than a supernatural entity.

- _id: PeopleBaseMortalTrait
  name: People Base - Mortal Person Trait
  kind: Trait
  traitName: Mortal Person
  traitDescription: This is a human being shaped by ordinary needs, loyalties, fear, training, and social position rather than by monstrous or supernatural nature.
  notes: Core identity trait for People.
```

### Holds a Place in the World

```yaml
- _id: PeopleBaseSocialTag
  name: People Base - Holds a Place in the World Tag
  kind: Tag
  tagName: SocialCreature
  notes: The person belongs to a household, watch, levy, road, band, or local order.

- _id: PeopleBaseSocialTrait
  name: People Base - Holds a Place in the World Trait
  kind: Trait
  traitName: Holds a Place in the World
  traitDescription: The person is understandable in human terms: they answer to custom, fear, pay, hunger, faith, authority, kinship, and immediate danger.
  notes: Core social-legibility trait for People.
```

### Mortal Nerve

```yaml
- _id: PeopleBaseNerveTag
  name: People Base - Mortal Nerve Tag
  kind: Tag
  tagName: BreakableMorale
  notes: However armed or trained, the person can still be shaken, routed, or overawed.

- _id: PeopleBaseNerveTrait
  name: People Base - Mortal Nerve Trait
  kind: Trait
  traitName: Mortal Nerve
  traitDescription: The person can stand, panic, retreat, or break depending on pressure, leadership, injury, and what they believe they are facing.
  notes: Core morale trait for People.
```

## Granted Power Items

The base monster should own the following named powers.

### Press the Fight

Suggested power identity:

```yaml
name: Press the Fight
type: Power
description: The person commits to immediate action, closing distance or holding pressure.
```

Suggested primary usage effect:

```yaml
Description: The person commits to immediate action, closing distance or holding pressure.
ApplicationMode: CreateActiveEffect
EffectType: Protection
EffectSubtype: Momentum
Visible: true
TargetType: Self
TargetCount: "1"
TargetRange: "Self"
TargetFilter: ""
TargetDescription: The person themselves.
CheckType: None
CheckFormula: ""
ResistanceType: ""
ResistanceFormula: ""
OnPartial: ""
OnFailure: ""
PayloadTarget: Action / pressure
PayloadOperation: Apply
PayloadValue: Momentum
PayloadDice: ""
PayloadTag: ""
PayloadTraitName: ""
PayloadTraitText: ""
GrantedItemTemplate: ""
GrantedItemName: ""
PayloadNotes: Use for advancing with intent, seizing initiative, stepping into a strike, or maintaining formation pressure.
DurationType: Scene
DurationValue: ""
ExpiryTrigger: After the push resolves or the scene changes.
RemovalMethod: ""
SuppressedBy: Panic, exhaustion, command failure, severe injury
```

### Armed Strike

Suggested power identity:

```yaml
name: Armed Strike
type: Power
description: A straightforward human attack using weapon, tool, fist, or shield.
```

Suggested primary usage effect:

```yaml
Description: A straightforward human attack using weapon, tool, fist, or shield.
ApplicationMode: CreateActiveEffect
EffectType: Status
EffectSubtype: Weakened
Visible: true
TargetType: Actor
TargetCount: "1"
TargetRange: "Touch"
TargetFilter: ""
TargetDescription: A target within reach of the attacker's current armament.
CheckType: Contest
CheckFormula: source Strength or Dexterity
ResistanceType: Stamina
ResistanceFormula: target Stamina
OnPartial: Target is rattled, bruised, or forced off balance.
OnFailure: Target is struck solidly and weakened.
PayloadTarget: Status
PayloadOperation: Apply
PayloadValue: Weakened
PayloadDice: ""
PayloadTag: ""
PayloadTraitName: ""
PayloadTraitText: ""
GrantedItemTemplate: ""
GrantedItemName: ""
PayloadNotes: Role and loadout variants should restyle this into spear-thrust, cudgel blow, sword-cut, shield-bash, knife strike, and similar human attacks.
DurationType: Scene
DurationValue: ""
ExpiryTrigger: End of scene or recovery
RemovalMethod: First aid, rest, rally
SuppressedBy: ""
```

Optional secondary direct-harm effect:

```yaml
Description: The attack inflicts direct physical harm.
ApplicationMode: DirectDataChange
EffectType: Stat
EffectSubtype: Resource
Visible: true
TargetType: Actor
TargetCount: "1"
TargetRange: "Touch"
TargetDescription: A target struck by ordinary human violence.
CheckType: None
CheckFormula: ""
ResistanceType: ""
ResistanceFormula: ""
OnPartial: ""
OnFailure: ""
PayloadTarget: HP
PayloadOperation: Decrease
PayloadValue: ""
PayloadDice: 1d6-2
DurationType: Instant
DurationValue: ""
ExpiryTrigger: ""
RemovalMethod: ""
SuppressedBy: ""
```

### Fall Back or Hold

Suggested power identity:

```yaml
name: Fall Back or Hold
type: Power
description: The person either braces under pressure or disengages before collapse.
```

Suggested usage effect:

```yaml
Description: The person either braces under pressure or disengages before collapse.
ApplicationMode: CreateActiveEffect
EffectType: Protection
EffectSubtype: Concealment
Visible: false
TargetType: Self
TargetCount: "1"
TargetRange: "Self"
TargetFilter: ""
TargetDescription: The person themselves.
CheckType: None
CheckFormula: ""
ResistanceType: ""
ResistanceFormula: ""
OnPartial: ""
OnFailure: ""
PayloadTarget: Defense / retreat / repositioning
PayloadOperation: Apply
PayloadValue: Concealed
PayloadDice: ""
PayloadTag: ""
PayloadTraitName: ""
PayloadTraitText: ""
GrantedItemTemplate: ""
GrantedItemName: ""
PayloadNotes: Use for taking cover, backing off, bracing behind allies, slipping through a doorway, or staying alive by discipline rather than supernatural escape.
DurationType: Scene
DurationValue: ""
ExpiryTrigger: Reveals themselves, recommits to the fight, or runs out of cover.
RemovalMethod: Cornering, breakthrough, rout
SuppressedBy: Encirclement or loss of escape route
```

## Concrete Starter Package

The `People Base` should therefore include:

- passive tag/trait changes:
  - `Mortal Person`
  - `Holds a Place in the World`
  - `Mortal Nerve`
- owned power items:
  - `Press the Fight`
  - `Armed Strike`
  - `Fall Back or Hold`

## Actor Source Draft

This is the recommended authored shape for a future `monsters.json` entry once
actor seeding is expanded to support fully-authored embedded power items.

```yaml
name: People Base
type: character
img: icons/svg/mystery-man.svg
system:
  template: Tgs09eTiTp63Cp7u
  props:
    TypeDropdown: People
    MoveGround: 5
    MoveFly: 0
    MoveSwim: 0
    MoveBurrow: 0
    MoveClimb: 0
    Stats_StrengthDice: 1
    Stats_StrengthMod: 1
    Stats_DexterityDice: 1
    Stats_DexterityMod: 1
    Stats_StaminaDice: 1
    Stats_StaminaMod: 1
    Stats_IntelligenceDice: 1
    Stats_IntelligenceMod: 1
    Stats_FaithDice: 1
    Stats_FaithMod: 1
    Stats_CharismaDice: 1
    Stats_CharismaMod: 1
    Stats_PowerDice: 1
    Stats_PowerMod: 0
items:
  - Mortal Person rule feature
  - Holds a Place in the World rule feature
  - Mortal Nerve rule feature
  - Press the Fight power
  - Armed Strike power
  - Fall Back or Hold power
```

## Recommended Next Layer

The first layers to stack onto this base should distinguish social and martial
archetype, for example:

- `Commoner`
- `Guard`
- `Raider`
- `Man-at-Arms`
- `Knight`

Those should add the exact equipment, training, morale profile, authority,
formation discipline, and scene role that the base intentionally leaves open.
