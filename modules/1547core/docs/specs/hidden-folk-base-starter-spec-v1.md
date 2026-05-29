# Hidden Folk Base Starter Spec v1

This document defines a concrete first-pass content draft for the `Hidden Folk Base`
monster chassis.

It is intended as the first reusable Hidden Folk root actor before domain,
motivation, loadout, and quirk ChangeSets are layered on top.

Hidden Folk are the magical remnants of those who inhabited the land before
human settlement. They occupy the same regions as human life, but hidden in
parallel rather than in open common possession.

## Design Goals

The base Hidden Folk should be:

- intelligent
- evasive
- magical by nature
- proud
- place-aware
- able to live in parallel with human settlement rather than wholly apart from it
- more dangerous through influence than brute violence
- guided by their own alien purposes rather than by human morality or convenience
- uncanny without yet being specialized into mound, hearth, wood, water, or courtly variants

Hidden Folk are not usually monsters fought openly. They are more often
encountered through concealment, testing, transformation, bargains, seduction,
misdirection, or reprisal after offense.

## Base Stats

Recommended actor-side base values:

```yaml
TypeDropdown: HiddenFolk
MoveGround: 5
MoveFly: 0
MoveSwim: 0
MoveBurrow: 0
MoveClimb: 0

Stats_StrengthDice: 1
Stats_StrengthMod: 0
Stats_DexterityDice: 2
Stats_DexterityMod: 0
Stats_StaminaDice: 1
Stats_StaminaMod: 2
Stats_IntelligenceDice: 1
Stats_IntelligenceMod: 2
Stats_FaithDice: 2
Stats_FaithMod: 0
Stats_CharismaDice: 2
Stats_CharismaMod: 0
Stats_PowerDice: 1
Stats_PowerMod: 1
```

This corresponds to:

- low Strength
- good Dexterity
- moderate Stamina
- moderate Intelligence
- good Faith
- good Charisma
- low to moderate Power

## Passive Rule Changes

These are the concrete passive changes the base monster should receive.

### Half-Seen

```yaml
- _id: HfBaseHalfSeenTag
  name: Hidden Folk Base - Half-Seen Tag
  kind: Tag
  tagName: Glamour
  notes: Hidden Folk are difficult to clearly perceive.

- _id: HfBaseHalfSeenTrait
  name: Hidden Folk Base - Half-Seen Trait
  kind: Trait
  traitName: Half-Seen
  traitDescription: The being is difficult to clearly make out because it dwells partly in hidden parallel to ordinary human sight, revealing itself only by choice, pressure, or failure of concealment.
  notes: Paired with the Glamour tag.
```

### Bound to Custom

```yaml
- _id: HfBaseBoundToCustomTag
  name: Hidden Folk Base - Bound to Custom Tag
  kind: Tag
  tagName: ThresholdAware
  notes: Hidden Folk react to trespass and broken custom.

- _id: HfBaseBoundToCustomTrait
  name: Hidden Folk Base - Bound to Custom Trait
  kind: Trait
  traitName: Bound to Custom
  traitDescription: It reacts strongly to trespass, insult, theft, broken hospitality, oath-breaking, and other violations of the older rules by which its people deal with the world.
  notes: Core folklore-law rule for Hidden Folk.
```

### Elder Parallel People

```yaml
- _id: HfBaseParallelPeopleTrait
  name: Hidden Folk Base - Elder Parallel People
  kind: Trait
  traitName: Elder Parallel People
  traitDescription: It belongs to an older hidden people that still occupies the land beside humanity, with pride, memory, and purposes that do not center human needs.
  notes: Tone-setting trait for Hidden Folk as a parallel elder nation rather than a mere local oddity.
```

## Granted Power Items

The base monster should own the following named powers.

### Brush of Glamour

Suggested power identity:

```yaml
name: Brush of Glamour
type: Power
description: Clouds judgment with uncertainty, hesitation, and false impressions.
```

Suggested primary usage effect:

```yaml
Description: Clouds the target's judgment with uncertainty and false impressions.
ApplicationMode: CreateActiveEffect
EffectType: Influence
EffectSubtype: Doubt
Visible: false
TargetType: Actor
TargetCount: "1"
TargetRange: "Sight or voice"
TargetFilter: ""
TargetDescription: A mortal who meets its gaze, hears its call, or lingers in its presence.
CheckType: Contest
CheckFormula: source Power
ResistanceType: Faith or Intelligence
ResistanceFormula: target Faith or Intelligence
OnPartial: Target hesitates and second-guesses.
OnFailure: Target is filled with doubt and false confidence.
PayloadTarget: Judgment / perception
PayloadOperation: Apply
PayloadValue: Doubt
PayloadDice: ""
PayloadTag: ""
PayloadTraitName: ""
PayloadTraitText: ""
GrantedItemTemplate: ""
GrantedItemName: ""
PayloadNotes: Use for uncertainty, second-guessing, false safety, glamour haze, or the difficulty of judging what is truly present when dealing with Hidden Folk.
DurationType: Scene
DurationValue: ""
ExpiryTrigger: Leave the scene, receive trusted guidance, or break the glamour.
RemovalMethod: Blessing, iron token, trusted guidance
SuppressedBy: ""
```

### Cold Hand

Suggested power identity:

```yaml
name: Cold Hand
type: Power
description: A numbing touch that chills flesh and weakens resolve.
```

Suggested primary usage effect:

```yaml
Description: A numbing touch that chills flesh and weakens resolve.
ApplicationMode: CreateActiveEffect
EffectType: Status
EffectSubtype: Weakened
Visible: true
TargetType: Actor
TargetCount: "1"
TargetRange: "Touch"
TargetFilter: ""
TargetDescription: A target within reach.
CheckType: Contest
CheckFormula: source Dexterity or Power
ResistanceType: Stamina
ResistanceFormula: target Stamina
OnPartial: Target is chilled and unsettled.
OnFailure: Target is weakened by grave-cold or glamour-cold.
PayloadTarget: Status
PayloadOperation: Apply
PayloadValue: Weakened
PayloadDice: ""
PayloadTag: ""
PayloadTraitName: ""
PayloadTraitText: ""
GrantedItemTemplate: ""
GrantedItemName: ""
PayloadNotes: Use for numbness, trembling, fear-laced chill, or slowed reactions.
DurationType: Scene
DurationValue: ""
ExpiryTrigger: End of scene or warmth/restoration
RemovalMethod: Fire, warmth, blessing, recovery
SuppressedBy: ""
```

Optional secondary direct-harm effect:

```yaml
Description: The touch inflicts minor direct harm.
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
PayloadDice: 1d6-2
DurationType: Instant
DurationValue: ""
ExpiryTrigger: ""
RemovalMethod: ""
SuppressedBy: ""
```

### Slip Aside

Suggested power identity:

```yaml
name: Slip Aside
type: Power
description: Withdraws into shadow, angle, or half-seen confusion.
```

Suggested usage effect:

```yaml
Description: The being withdraws into shadow, confusion, or a half-seen angle.
ApplicationMode: CreateActiveEffect
EffectType: Protection
EffectSubtype: Concealment
Visible: false
TargetType: Self
TargetCount: "1"
TargetRange: "Self"
TargetFilter: ""
TargetDescription: The Hidden Folk itself.
CheckType: None
CheckFormula: ""
ResistanceType: ""
ResistanceFormula: ""
OnPartial: ""
OnFailure: ""
PayloadTarget: Detectability / retaliation
PayloadOperation: Apply
PayloadValue: Concealed
PayloadDice: ""
PayloadTag: ""
PayloadTraitName: ""
PayloadTraitText: ""
GrantedItemTemplate: ""
GrantedItemName: ""
PayloadNotes: Use to justify slipping behind cover, stepping partly out of ordinary sight, breaking line of sight, or resisting immediate reprisal.
DurationType: Scene
DurationValue: ""
ExpiryTrigger: Reveals itself, attacks openly, or concealment is broken
RemovalMethod: Sunlight, cornering, holy sign, direct reveal
SuppressedBy: Direct sunlight
```

## Concrete Starter Package

The `Hidden Folk Base` should therefore include:

- passive tag/trait changes:
  - `Half-Seen`
  - `Bound to Custom`
  - `Elder Parallel People`
- owned power items:
  - `Brush of Glamour`
  - `Cold Hand`
  - `Slip Aside`

## Actor Source Draft

This is the recommended authored shape for a future `monsters.json` entry once
actor seeding is expanded to support fully-authored embedded power items.

```yaml
name: Hidden Folk Base
type: character
img: icons/svg/mystery-man.svg
system:
  template: Tgs09eTiTp63Cp7u
  props:
    TypeDropdown: HiddenFolk
    MoveGround: 5
    MoveFly: 0
    MoveSwim: 0
    MoveBurrow: 0
    MoveClimb: 0
    Stats_StrengthDice: 1
    Stats_StrengthMod: 0
    Stats_DexterityDice: 2
    Stats_DexterityMod: 0
    Stats_StaminaDice: 1
    Stats_StaminaMod: 2
    Stats_IntelligenceDice: 1
    Stats_IntelligenceMod: 2
    Stats_FaithDice: 2
    Stats_FaithMod: 0
    Stats_CharismaDice: 2
    Stats_CharismaMod: 0
    Stats_PowerDice: 1
    Stats_PowerMod: 1
items:
  - Half-Seen rule feature
  - Bound to Custom rule feature
  - Elder Parallel People trait
  - Brush of Glamour power
  - Cold Hand power
  - Slip Aside power
```

## Recommended Next Layer

The first domain sets to stack onto this base should be:

- `Hill` or `Barrow`
- `Hearth` or `Farmstead`
- `Wood`
- `Water`

Those should add the stronger folklore identity, vulnerabilities, and location-bound
behavior, parallel territorial logic, and hidden social purpose that the base
intentionally leaves open.
