# Beast Base Starter Spec v1

This document defines a concrete first-pass content draft for the `Beast Base`
monster chassis.

It is intended as the first reusable Beast root actor for dangerous natural
animals such as wolves, bears, boars, great cats, and similar non-supernatural
creatures before more specific domain, motivation, loadout, and quirk ChangeSets
are layered on top.

## Design Goals

The base Beast should be:

- fully natural rather than supernatural
- dangerous through body, instinct, speed, endurance, and aggression
- driven by hunger, fear, territory, pack behavior, or protective rage rather than folklore law
- able to threaten humans without needing spells, glamour, or social authority
- broad enough to support wolves, bears, and similar predators without yet being specialized into pack-hunter, brute predator, scavenger, or ambush variants

It should feel like a dangerous animal, not a disguised spirit, cursed being,
or mythic monster.

## Base Stats

Recommended actor-side base values:

```yaml
TypeDropdown: Beast
MoveGround: 6
MoveFly: 0
MoveSwim: 0
MoveBurrow: 0
MoveClimb: 0

Stats_StrengthDice: 2
Stats_StrengthMod: 0
Stats_DexterityDice: 2
Stats_DexterityMod: 0
Stats_StaminaDice: 2
Stats_StaminaMod: 0
Stats_IntelligenceDice: 1
Stats_IntelligenceMod: 0
Stats_FaithDice: 1
Stats_FaithMod: 0
Stats_CharismaDice: 1
Stats_CharismaMod: 0
Stats_PowerDice: 1
Stats_PowerMod: 0
```

This corresponds to:

- good Strength
- good Dexterity
- good Stamina
- low Intelligence
- low Faith
- low Charisma
- low Power

## Passive Rule Changes

These are the concrete passive changes the base monster should receive.

### Natural Creature

```yaml
- _id: BeastBaseNaturalTag
  name: Beast Base - Natural Creature Tag
  kind: Tag
  tagName: LivingCreature
  notes: The being is a natural animal, not an inherently supernatural entity.

- _id: BeastBaseNaturalTrait
  name: Beast Base - Natural Creature Trait
  kind: Trait
  traitName: Natural Creature
  traitDescription: This is a living animal shaped by body, instinct, and environment rather than by glamour, curse, or mythic office.
  notes: Core identity trait for Beasts.
```

### Keen Senses

```yaml
- _id: BeastBaseSensesTag
  name: Beast Base - Keen Senses Tag
  kind: Tag
  tagName: SenseLiving
  notes: The animal notices scent, sound, movement, and weakness quickly.

- _id: BeastBaseSensesTrait
  name: Beast Base - Keen Senses Trait
  kind: Trait
  traitName: Keen Senses
  traitDescription: It relies on scent, hearing, movement, and instinctive awareness to track danger, prey, or intrusion.
  notes: Core perception and pursuit trait for Beasts.
```

### Tooth and Claw

```yaml
- _id: BeastBaseToothClawTag
  name: Beast Base - Tooth and Claw Tag
  kind: Tag
  tagName: NaturalWeapons
  notes: The creature's body is itself a weapon.

- _id: BeastBaseToothClawTrait
  name: Beast Base - Tooth and Claw Trait
  kind: Trait
  traitName: Tooth and Claw
  traitDescription: It attacks with bite, claw, horn, tusk, trampling force, or other natural weaponry rather than crafted arms.
  notes: Core attack-shape trait for Beasts.
```

## Granted Power Items

The base monster should own the following named powers.

### Savage Rush

Suggested power identity:

```yaml
name: Savage Rush
type: Power
description: The animal surges forward with sudden speed and violence.
```

Suggested primary usage effect:

```yaml
Description: The animal surges forward with sudden speed and violence.
ApplicationMode: CreateActiveEffect
EffectType: Protection
EffectSubtype: Momentum
Visible: true
TargetType: Self
TargetCount: "1"
TargetRange: "Self"
TargetFilter: ""
TargetDescription: The Beast itself.
CheckType: None
CheckFormula: ""
ResistanceType: ""
ResistanceFormula: ""
OnPartial: ""
OnFailure: ""
PayloadTarget: Movement / charge pressure
PayloadOperation: Apply
PayloadValue: Momentum
PayloadDice: ""
PayloadTag: ""
PayloadTraitName: ""
PayloadTraitText: ""
GrantedItemTemplate: ""
GrantedItemName: ""
PayloadNotes: Use for sudden lunges, closing distance, knocking into a target, or forcing a retreat.
DurationType: Scene
DurationValue: ""
ExpiryTrigger: After the rush resolves or the scene changes.
RemovalMethod: ""
SuppressedBy: Confinement, injury, or hard terrain
```

### Maul

Suggested power identity:

```yaml
name: Maul
type: Power
description: A brutal close attack that weakens, tears, or crushes.
```

Suggested primary usage effect:

```yaml
Description: A brutal close attack that weakens, tears, or crushes.
ApplicationMode: CreateActiveEffect
EffectType: Status
EffectSubtype: Weakened
Visible: true
TargetType: Actor
TargetCount: "1"
TargetRange: "Touch"
TargetFilter: ""
TargetDescription: A target within reach of the Beast's natural weapons.
CheckType: Contest
CheckFormula: source Strength or Dexterity
ResistanceType: Stamina
ResistanceFormula: target Stamina
OnPartial: Target is battered, cut, or driven back.
OnFailure: Target is mauled and weakened.
PayloadTarget: Status
PayloadOperation: Apply
PayloadValue: Weakened
PayloadDice: ""
PayloadTag: ""
PayloadTraitName: ""
PayloadTraitText: ""
GrantedItemTemplate: ""
GrantedItemName: ""
PayloadNotes: Domain or role variants can style this as a bite, clawing, trampling, tusk-gore, or rending hold.
DurationType: Scene
DurationValue: ""
ExpiryTrigger: End of scene or recovery
RemovalMethod: First aid, rest, treatment
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
TargetDescription: A target within reach.
CheckType: None
CheckFormula: ""
ResistanceType: ""
ResistanceFormula: ""
OnPartial: ""
OnFailure: ""
PayloadTarget: HP
PayloadOperation: Decrease
PayloadValue: ""
PayloadDice: 1d6
DurationType: Instant
DurationValue: ""
ExpiryTrigger: ""
RemovalMethod: ""
SuppressedBy: ""
```

### Break Away

Suggested power identity:

```yaml
name: Break Away
type: Power
description: The animal slips free, bolts, or repositions with instinctive speed.
```

Suggested usage effect:

```yaml
Description: The animal slips free, bolts, or repositions with instinctive speed.
ApplicationMode: CreateActiveEffect
EffectType: Protection
EffectSubtype: Concealment
Visible: false
TargetType: Self
TargetCount: "1"
TargetRange: "Self"
TargetFilter: ""
TargetDescription: The Beast itself.
CheckType: None
CheckFormula: ""
ResistanceType: ""
ResistanceFormula: ""
OnPartial: ""
OnFailure: ""
PayloadTarget: Escape / repositioning
PayloadOperation: Apply
PayloadValue: Concealed
PayloadDice: ""
PayloadTag: ""
PayloadTraitName: ""
PayloadTraitText: ""
GrantedItemTemplate: ""
GrantedItemName: ""
PayloadNotes: Use for fleeing into brush, slipping from a hold, circling away, or disappearing into ordinary natural cover.
DurationType: Scene
DurationValue: ""
ExpiryTrigger: Reveals itself, is cornered, or runs out of cover.
RemovalMethod: Cornering, nets, enclosure, or overwhelming pursuit
SuppressedBy: Confinement or lack of cover
```

## Concrete Starter Package

The `Beast Base` should therefore include:

- passive tag/trait changes:
  - `Natural Creature`
  - `Keen Senses`
  - `Tooth and Claw`
- owned power items:
  - `Savage Rush`
  - `Maul`
  - `Break Away`

## Actor Source Draft

This is the recommended authored shape for a future `monsters.json` entry once
actor seeding is expanded to support fully-authored embedded power items.

```yaml
name: Beast Base
type: character
img: icons/svg/mystery-man.svg
system:
  template: Tgs09eTiTp63Cp7u
  props:
    TypeDropdown: Beast
    MoveGround: 6
    MoveFly: 0
    MoveSwim: 0
    MoveBurrow: 0
    MoveClimb: 0
    Stats_StrengthDice: 2
    Stats_StrengthMod: 0
    Stats_DexterityDice: 2
    Stats_DexterityMod: 0
    Stats_StaminaDice: 2
    Stats_StaminaMod: 0
    Stats_IntelligenceDice: 1
    Stats_IntelligenceMod: 0
    Stats_FaithDice: 1
    Stats_FaithMod: 0
    Stats_CharismaDice: 1
    Stats_CharismaMod: 0
    Stats_PowerDice: 1
    Stats_PowerMod: 0
items:
  - Natural Creature rule feature
  - Keen Senses rule feature
  - Tooth and Claw rule feature
  - Savage Rush power
  - Maul power
  - Break Away power
```

## Recommended Next Layer

The first layers to stack onto this base should distinguish body plan and
behavior, for example:

- `Pack Hunter`
- `Brute Predator`
- `Ambush Hunter`
- `Scavenger`

Those should add the more specific attack pattern, movement profile, fear
response, pack logic, and pursuit behavior that the base intentionally leaves
open.
