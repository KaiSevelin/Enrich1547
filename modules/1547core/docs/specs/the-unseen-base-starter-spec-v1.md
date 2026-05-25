# The Unseen Base Starter Spec v1

This document defines a concrete first-pass content draft for the `The Unseen Base`
monster chassis.

It is intended as the reusable root actor for singular, powerful beings such as
Jinn, the Lady of the Lake, Sidhe nobles, the Erlking, Frau Holle, and leaders
of the Wild Hunt.

## Design Goals

The base Unseen should be:

- singular
- mythically significant
- socially and supernaturally dominant
- able to alter the whole scene by presence alone
- powerful without yet being specialized into water, hunt, winter, court, or fire

It should not feel like a stronger `Hidden Folk`, but like a being of rank,
office, and consequence.

## Base Stats

Recommended actor-side base values:

```yaml
TypeDropdown: TheUnseen
MoveGround: 5
MoveFly: 0
MoveSwim: 0
MoveBurrow: 0
MoveClimb: 0

Stats_StrengthDice: 1
Stats_StrengthMod: 2
Stats_DexterityDice: 1
Stats_DexterityMod: 2
Stats_StaminaDice: 2
Stats_StaminaMod: 0
Stats_IntelligenceDice: 2
Stats_IntelligenceMod: 0
Stats_FaithDice: 2
Stats_FaithMod: 0
Stats_CharismaDice: 2
Stats_CharismaMod: 2
Stats_PowerDice: 2
Stats_PowerMod: 2
```

This corresponds to:

- moderate Strength
- moderate Dexterity
- good Stamina
- good Intelligence
- good Faith
- very good Charisma
- high Power

## Passive Rule Changes

These are the concrete passive changes the base monster should receive.

### Of Higher Order

```yaml
- _id: UnseenBaseHigherOrderTrait
  name: The Unseen Base - Of Higher Order
  kind: Trait
  traitName: Of Higher Order
  traitDescription: This is not a local hidden creature but a being of rank, office, or mythic significance.
  notes: Core status trait for singular mythic beings.
```

### Majesty or Dread

```yaml
- _id: UnseenBaseMajestyTag
  name: The Unseen Base - Majesty or Dread Tag
  kind: Tag
  tagName: UnsettlingPresence
  notes: Mortals are unsettled merely by being near the being.

- _id: UnseenBaseMajestyTrait
  name: The Unseen Base - Majesty or Dread Trait
  kind: Trait
  traitName: Majesty or Dread
  traitDescription: Mortals feel awe, fascination, pressure, or terror in its presence even when it is calm.
  notes: Core emotional pressure aura for the Unseen.
```

### Bound by Ancient Law

```yaml
- _id: UnseenBaseAncientLawTag
  name: The Unseen Base - Ancient Law Tag
  kind: Tag
  tagName: OathBound
  notes: The being is powerful through and constrained by old law.

- _id: UnseenBaseAncientLawTrait
  name: The Unseen Base - Bound by Ancient Law
  kind: Trait
  traitName: Bound by Ancient Law
  traitDescription: Bargains, names, invitations, thresholds, and oaths carry real force when dealing with it.
  notes: Core folklore-law rule for powerful singular beings.
```

### Not Meant for Common Company

```yaml
- _id: UnseenBaseSeeInvisibleTag
  name: The Unseen Base - Not Meant for Common Company Tag
  kind: Tag
  tagName: SeeInvisible
  notes: Concealment and ordinary obscurity are less effective before the being.

- _id: UnseenBaseCommonCompanyTrait
  name: The Unseen Base - Not Meant for Common Company
  kind: Trait
  traitName: Not Meant for Common Company
  traitDescription: Prolonged contact with the being disturbs mortal judgment, fortune, sleep, or piety, and concealment is less reliable before it.
  notes: Combines alien presence with superior supernatural perception.
```

## Granted Power Items

The base monster should own the following named powers.

### Sovereign Presence

Suggested power identity:

```yaml
name: Sovereign Presence
type: Power
description: The being's presence imposes awe, dread, and emotional disorientation.
```

Suggested primary usage effect:

```yaml
Description: The being's presence imposes awe, pressure, and emotional disorientation.
ApplicationMode: CreateActiveEffect
EffectType: Influence
EffectSubtype: Fear
Visible: true
TargetType: Actor
TargetCount: "1"
TargetRange: "Sight or courtly presence"
TargetFilter: ""
TargetDescription: A mortal who stands before the being or addresses it directly.
CheckType: Contest
CheckFormula: source Power
ResistanceType: Faith
ResistanceFormula: target Faith
OnPartial: Target hesitates, lowers their gaze, or loses certainty.
OnFailure: Target is overcome by dread or majesty.
PayloadTarget: Status
PayloadOperation: Apply
PayloadValue: Afraid
PayloadDice: ""
PayloadTag: ""
PayloadTraitName: ""
PayloadTraitText: ""
GrantedItemTemplate: ""
GrantedItemName: ""
PayloadNotes: Gentler variants may use Social Favor or Doubt instead of Afraid.
DurationType: Scene
DurationValue: ""
ExpiryTrigger: Leave the presence, scene ends, or the being dismisses the pressure.
RemovalMethod: Blessing, command from higher authority, or withdrawal
SuppressedBy: ""
```

### Word of Binding

Suggested power identity:

```yaml
name: Word of Binding
type: Power
description: The being's spoken command carries supernatural force.
```

Suggested primary usage effect:

```yaml
Description: The being's spoken command carries supernatural force.
ApplicationMode: CreateActiveEffect
EffectType: Influence
EffectSubtype: Obedience
Visible: true
TargetType: Actor
TargetCount: "1"
TargetRange: "Voice"
TargetFilter: ""
TargetDescription: A mortal or lesser being that can hear and understand the command.
CheckType: Contest
CheckFormula: source Power
ResistanceType: Faith or Charisma
ResistanceFormula: target Faith or Charisma
OnPartial: Target struggles, delays, or obeys imperfectly.
OnFailure: Target is compelled to comply.
PayloadTarget: Will / obedience
PayloadOperation: Apply
PayloadValue: Obedience
PayloadDice: ""
PayloadTag: ""
PayloadTraitName: ""
PayloadTraitText: ""
GrantedItemTemplate: ""
GrantedItemName: ""
PayloadNotes: A milder base variant can use TruthPressure instead of direct obedience.
DurationType: Scene
DurationValue: ""
ExpiryTrigger: Command fulfilled, scene ends, or stronger authority intervenes.
RemovalMethod: Counter-command, sacred protection, broken authority
SuppressedBy: ""
```

### Pass Unbarred

Suggested power identity:

```yaml
name: Pass Unbarred
type: Power
description: The being crosses threshold, distance, or barrier in an uncanny manner.
```

Suggested usage effect:

```yaml
Description: The being crosses distance, threshold, or barrier in an uncanny manner.
ApplicationMode: CreateActiveEffect
EffectType: Protection
EffectSubtype: SafePassage
Visible: false
TargetType: Self
TargetCount: "1"
TargetRange: "Self"
TargetFilter: ""
TargetDescription: The Unseen itself.
CheckType: None
CheckFormula: ""
ResistanceType: ""
ResistanceFormula: ""
OnPartial: ""
OnFailure: ""
PayloadTarget: Passage / barrier interaction
PayloadOperation: Apply
PayloadValue: Safe Passage
PayloadDice: ""
PayloadTag: ""
PayloadTraitName: ""
PayloadTraitText: ""
GrantedItemTemplate: ""
GrantedItemName: ""
PayloadNotes: Use for crossing barriers, ignoring common obstruction, or arriving and departing unnaturally.
DurationType: Scene
DurationValue: ""
ExpiryTrigger: The being chooses to remain plainly present, or the scene changes.
RemovalMethod: Powerful ward, true-name binding, stronger threshold
SuppressedBy: A ward specifically strong enough to bar the being
```

### Optional: Bestow or Withhold

Suggested power identity:

```yaml
name: Bestow or Withhold
type: Power
description: The being grants favor or lays displeasure upon a mortal.
```

Suggested usage effect:

```yaml
Description: The being grants favor or lays displeasure upon a mortal.
ApplicationMode: CreateActiveEffect
EffectType: Status
EffectSubtype: Blessed
Visible: true
TargetType: Actor
TargetCount: "1"
TargetRange: "Touch, gift, or spoken judgment"
TargetFilter: ""
TargetDescription: A mortal judged worthy or unworthy.
CheckType: None
CheckFormula: ""
ResistanceType: ""
ResistanceFormula: ""
OnPartial: ""
OnFailure: ""
PayloadTarget: Status
PayloadOperation: Apply
PayloadValue: Blessed
PayloadDice: ""
PayloadTag: ""
PayloadTraitName: ""
PayloadTraitText: ""
GrantedItemTemplate: ""
GrantedItemName: ""
PayloadNotes: In hostile use, swap Blessed for Cursed.
DurationType: Days
DurationValue: "1d6"
ExpiryTrigger: ""
RemovalMethod: Gift returned, offense made, rite completed
SuppressedBy: ""
```

## Concrete Starter Package

The `The Unseen Base` should therefore include:

- passive tag/trait changes:
  - `Of Higher Order`
  - `Majesty or Dread`
  - `Bound by Ancient Law`
  - `Not Meant for Common Company`
- owned power items:
  - `Sovereign Presence`
  - `Word of Binding`
  - `Pass Unbarred`
  - optional `Bestow or Withhold`

## Actor Source Draft

This is the recommended authored shape for a future `monsters.json` entry once
actor seeding is expanded to support fully-authored embedded power items.

```yaml
name: The Unseen Base
type: character
img: icons/svg/mystery-man.svg
system:
  template: Tgs09eTiTp63Cp7u
  props:
    TypeDropdown: TheUnseen
    MoveGround: 5
    MoveFly: 0
    MoveSwim: 0
    MoveBurrow: 0
    MoveClimb: 0
    Stats_StrengthDice: 1
    Stats_StrengthMod: 2
    Stats_DexterityDice: 1
    Stats_DexterityMod: 2
    Stats_StaminaDice: 2
    Stats_StaminaMod: 0
    Stats_IntelligenceDice: 2
    Stats_IntelligenceMod: 0
    Stats_FaithDice: 2
    Stats_FaithMod: 0
    Stats_CharismaDice: 2
    Stats_CharismaMod: 2
    Stats_PowerDice: 2
    Stats_PowerMod: 2
items:
  - Of Higher Order trait
  - Majesty or Dread rule feature
  - Bound by Ancient Law rule feature
  - Not Meant for Common Company rule feature
  - Sovereign Presence power
  - Word of Binding power
  - Pass Unbarred power
  - optional Bestow or Withhold power
```

## Recommended Next Layer

The first specialization sets to stack onto this base should distinguish rank and
office, for example:

- `Courtly` or `Noble`
- `Water Sovereign`
- `Winter Matron`
- `Hunt Master`
- `Smokeless Fire`

Those should add the defining domain, vulnerabilities, mounted or impossible
movement, named retinues, and boon/curse authority that the base intentionally
leaves open.
