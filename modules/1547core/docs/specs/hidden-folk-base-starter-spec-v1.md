# Hidden Folk Base Starter Spec v1

This document defines a concrete first-pass content draft for the `Hidden Folk Base`
monster chassis.

It is intended as the first reusable Hidden Folk root actor before domain,
motivation, loadout, and quirk ChangeSets are layered on top.

## Design Goals

The base Hidden Folk should be:

- intelligent
- evasive
- place-aware
- more dangerous through influence than brute violence
- uncanny without yet being specialized into mound, hearth, wood, or water variants

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
  traitDescription: The being is difficult to clearly make out unless it chooses to reveal itself, is cornered, or the conditions of its place are broken.
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
  traitDescription: It reacts strongly to trespass, insult, theft, broken hospitality, and oath-breaking.
  notes: Core folklore-law rule for Hidden Folk.
```

### Near but Not Friendly

```yaml
- _id: HfBaseNearNotFriendlyTrait
  name: Hidden Folk Base - Near but Not Friendly
  kind: Trait
  traitName: Near but Not Friendly
  traitDescription: It lives beside human life rather than wholly apart from it, and usually tests, watches, or misleads before acting openly.
  notes: Tone-setting trait for encounter play.
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
PayloadNotes: Use for uncertainty, second-guessing, false safety, or glamour haze.
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
PayloadNotes: Use to justify slipping behind cover, breaking line of sight, or resisting immediate reprisal.
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
  - `Near but Not Friendly`
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
  - Near but Not Friendly trait
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
behavior that the base intentionally leaves open.
