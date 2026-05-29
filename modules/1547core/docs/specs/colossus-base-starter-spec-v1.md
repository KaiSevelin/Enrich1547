# Colossus Base Starter Spec v1

This document defines a concrete first-pass content draft for the `Colossus Base`
monster chassis.

It is intended as the reusable root actor for rare immense beings such as
dragons, kraken, leviathans, and other creatures whose danger is defined
primarily by overwhelming scale, force, dormancy, hunger, and catastrophic
presence before more specific domain, motivation, loadout, and quirk ChangeSets
are layered on top.

Colossals are extremely rare great beasts most often spoken of in remote
wilderness, mountain fastness, uncharted seas, and half-believed reports from
the edge of the known world. They are not usually rulers, peoples, or schemers,
but dormant catastrophic creatures driven first by feeding, waking, migration,
and enormous bodily need. A few grow old and sly enough to show a terrible form
of intelligence, but hunger and ruin should remain the family center.

## Design Goals

The base Colossus should be:

- enormous
- physically overwhelming
- extremely rare
- more at home in remote or uncharted places than in settled land
- able to alter the fight or scene simply by moving, surfacing, landing, feeding, or waking
- dangerous through scale, reach, durability, appetite, and fear rather than through social domination or intricate spellcraft
- broad enough to support dragons, leviathans, kraken, and other great beasts without yet being specialized into sky, sea, fire, abyssal, or ancient-cunning variants

It should feel like a rare, catastrophic creature rather than merely a larger
Beast, a social sovereign like `The Unseen`, or an outsider power like
`Unnatural`.

Colossals are beings one might fight in legend or at the climax of a disaster,
but they should be used sparingly. Many encounters with them should begin with
signs, wreckage, missing ships, ravaged herds, scorched ground, or the terror
of realizing something immense has awakened nearby.

## Base Stats

Recommended actor-side base values:

```yaml
TypeDropdown: Colossal
MoveGround: 5
MoveFly: 0
MoveSwim: 0
MoveBurrow: 0
MoveClimb: 0

Stats_StrengthDice: 3
Stats_StrengthMod: 0
Stats_DexterityDice: 1
Stats_DexterityMod: 1
Stats_StaminaDice: 3
Stats_StaminaMod: 0
Stats_IntelligenceDice: 1
Stats_IntelligenceMod: 1
Stats_FaithDice: 1
Stats_FaithMod: 0
Stats_CharismaDice: 2
Stats_CharismaMod: 0
Stats_PowerDice: 2
Stats_PowerMod: 0
```

This corresponds to:

- very high Strength
- low to moderate Dexterity
- very high Stamina
- low to moderate Intelligence
- low Faith
- moderate Charisma
- good Power

The moderate Charisma and Power here should not imply social subtlety or
civilized magic by default. They represent force of presence, mythic weight,
and the ability of a Colossal to dominate a scene simply by being there.

## Passive Rule Changes

These are the concrete passive changes the base monster should receive.

### Vast Bulk

```yaml
- _id: ColossusBaseBulkTag
  name: Colossus Base - Vast Bulk Tag
  kind: Tag
  tagName: Massive
  notes: The being's sheer scale changes how it occupies space and threatens others.

- _id: ColossusBaseBulkTrait
  name: Colossus Base - Vast Bulk Trait
  kind: Trait
  traitName: Vast Bulk
  traitDescription: Its body is so large that movement, presence, and simple force can break lines, crush obstacles, capsize vessels, or dominate ordinary creatures.
  notes: Core scale trait for Colossi.
```

### Hard to Bring Down

```yaml
- _id: ColossusBaseDurableTag
  name: Colossus Base - Hard to Bring Down Tag
  kind: Tag
  tagName: Durable
  notes: The being is difficult to stop through ordinary force.

- _id: ColossusBaseDurableTrait
  name: Colossus Base - Hard to Bring Down Trait
  kind: Trait
  traitName: Hard to Bring Down
  traitDescription: It can absorb punishment that would stop ordinary creatures, and lesser blows may matter more as irritation than injury unless they are well-placed, blessed, or desperate.
  notes: Core endurance trait for Colossi.
```

### Dormant Hunger

```yaml
- _id: ColossusBaseTerrorTag
  name: Colossus Base - Dormant Hunger Tag
  kind: Tag
  tagName: Ravenous
  notes: The being's waking, feeding, or approach is driven more by immense appetite than by politics or doctrine.

- _id: ColossusBaseTerrorTrait
  name: Colossus Base - Dormant Hunger Trait
  kind: Trait
  traitName: Dormant Hunger
  traitDescription: It spends long stretches in sleep, depth, lair, or half-waking stillness, but once stirred, starved, or roused, it moves with the terrible simplicity of a feeding catastrophe.
  notes: Core motive trait for Colossi as great beasts rather than rulers.
```

## Granted Power Items

The base monster should own the following named powers.

### Crushing Advance

Suggested power identity:

```yaml
name: Crushing Advance
type: Power
description: The being forces ground, line, and formation to yield before its movement.
```

Suggested primary usage effect:

```yaml
Description: The being forces ground, line, and formation to yield before its movement.
ApplicationMode: CreateActiveEffect
EffectType: Protection
EffectSubtype: Momentum
Visible: true
TargetType: Self
TargetCount: "1"
TargetRange: "Self"
TargetFilter: ""
TargetDescription: The Colossus itself.
CheckType: None
CheckFormula: ""
ResistanceType: ""
ResistanceFormula: ""
OnPartial: ""
OnFailure: ""
PayloadTarget: Movement / formation pressure
PayloadOperation: Apply
PayloadValue: Momentum
PayloadDice: ""
PayloadTag: ""
PayloadTraitName: ""
PayloadTraitText: ""
GrantedItemTemplate: ""
GrantedItemName: ""
PayloadNotes: Use for trampling advance, driving through a line, breaching a hull, scattering lesser foes, or forcing retreat by sheer mass.
DurationType: Scene
DurationValue: ""
ExpiryTrigger: After the advance resolves or the scene changes.
RemovalMethod: ""
SuppressedBy: Severe confinement, immobilization, or terrain that truly bars such mass
```

### Titanic Blow

Suggested power identity:

```yaml
name: Titanic Blow
type: Power
description: A single immense strike that batters, crushes, or hurls a target aside.
```

Suggested primary usage effect:

```yaml
Description: A single immense strike batters, crushes, or hurls a target aside.
ApplicationMode: CreateActiveEffect
EffectType: Status
EffectSubtype: Weakened
Visible: true
TargetType: Actor
TargetCount: "1"
TargetRange: "Reach"
TargetFilter: ""
TargetDescription: A target struck by the Colossus's body, limb, tail, tentacle, or other massive force.
CheckType: Contest
CheckFormula: source Strength
ResistanceType: Stamina
ResistanceFormula: target Stamina
OnPartial: Target is staggered, driven back, or nearly broken.
OnFailure: Target is struck down and weakened by overwhelming force.
PayloadTarget: Status
PayloadOperation: Apply
PayloadValue: Weakened
PayloadDice: ""
PayloadTag: ""
PayloadTraitName: ""
PayloadTraitText: ""
GrantedItemTemplate: ""
GrantedItemName: ""
PayloadNotes: Variants may style this as claw, bite, tail, tentacle, wing, slam, surge, or body-check.
DurationType: Scene
DurationValue: ""
ExpiryTrigger: End of scene or recovery
RemovalMethod: Rest, treatment, magical healing, regrouping
SuppressedBy: ""
```

Optional secondary direct-harm effect:

```yaml
Description: The strike inflicts devastating direct harm.
ApplicationMode: DirectDataChange
EffectType: Stat
EffectSubtype: Resource
Visible: true
TargetType: Actor
TargetCount: "1"
TargetRange: "Reach"
TargetDescription: A target struck by overwhelming force.
CheckType: None
CheckFormula: ""
ResistanceType: ""
ResistanceFormula: ""
OnPartial: ""
OnFailure: ""
PayloadTarget: HP
PayloadOperation: Decrease
PayloadValue: ""
PayloadDice: 2d6
DurationType: Instant
DurationValue: ""
ExpiryTrigger: ""
RemovalMethod: ""
SuppressedBy: ""
```

### Roar or Surge of Dread

Suggested power identity:

```yaml
name: Roar or Surge of Dread
type: Power
description: The being's voice, movement, or emergence shatters nerve.
```

Suggested usage effect:

```yaml
Description: The being's voice, movement, or emergence shatters nerve.
ApplicationMode: CreateActiveEffect
EffectType: Influence
EffectSubtype: Fear
Visible: true
TargetType: Actor
TargetCount: "1"
TargetRange: "Sight or hearing"
TargetFilter: ""
TargetDescription: A mortal or lesser being that witnesses the Colossus plainly.
CheckType: Contest
CheckFormula: source Power or Charisma
ResistanceType: Faith
ResistanceFormula: target Faith
OnPartial: Target hesitates, falters, or loses formation.
OnFailure: Target is overcome by fear or awe at the being's scale.
PayloadTarget: Status
PayloadOperation: Apply
PayloadValue: Afraid
PayloadDice: ""
PayloadTag: ""
PayloadTraitName: ""
PayloadTraitText: ""
GrantedItemTemplate: ""
GrantedItemName: ""
PayloadNotes: Use for dragon-roar, kraken emergence, the sight of a leviathan breaking the water, or the sudden realization that something enormous is awake and near.
DurationType: Scene
DurationValue: ""
ExpiryTrigger: Leave the presence, regroup, or the scene changes.
RemovalMethod: Rally, command, blessing, hard cover
SuppressedBy: ""
```

## Concrete Starter Package

The `Colossus Base` should therefore include:

- passive tag/trait changes:
  - `Vast Bulk`
  - `Hard to Bring Down`
  - `Dormant Hunger`
- owned power items:
  - `Crushing Advance`
  - `Titanic Blow`
  - `Roar or Surge of Dread`

## Actor Source Draft

This is the recommended authored shape for a future `monsters.json` entry once
actor seeding is expanded to support fully-authored embedded power items.

```yaml
name: Colossus Base
type: character
img: icons/svg/mystery-man.svg
system:
  template: Tgs09eTiTp63Cp7u
  props:
    TypeDropdown: Colossal
    MoveGround: 5
    MoveFly: 0
    MoveSwim: 0
    MoveBurrow: 0
    MoveClimb: 0
    Stats_StrengthDice: 3
    Stats_StrengthMod: 0
    Stats_DexterityDice: 1
    Stats_DexterityMod: 1
    Stats_StaminaDice: 3
    Stats_StaminaMod: 0
    Stats_IntelligenceDice: 1
    Stats_IntelligenceMod: 1
    Stats_FaithDice: 1
    Stats_FaithMod: 0
    Stats_CharismaDice: 2
    Stats_CharismaMod: 0
    Stats_PowerDice: 2
    Stats_PowerMod: 0
items:
  - Vast Bulk rule feature
  - Hard to Bring Down rule feature
  - Dormant Hunger rule feature
  - Crushing Advance power
  - Titanic Blow power
  - Roar or Surge of Dread power
```

## Recommended Next Layer

The first layers to stack onto this base should distinguish the kind of immense
being and how its scale is expressed, for example:

- `Dragon`
- `Sea Colossus`
- `Abyssal Colossus`
- `Ancient Cunning`

Those should add the defining movement profile, elemental or environmental
authority, exact body plan, special attacks, remote habitat, and ancient
intelligence or animal ferocity that the base intentionally leaves open.
