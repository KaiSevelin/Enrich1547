# Unnatural Base Starter Spec v1

This document defines a concrete first-pass content draft for the `Unnatural Base`
monster chassis.

It is intended as the reusable root actor for beings such as devils, demons,
angels, and similar outsider entities that do not belong to the ordinary natural
order before more specific domain, motivation, loadout, and quirk ChangeSets are
layered on top.

Unnaturals are beings from another existence, usually brought into the world by
summoning, breach, invitation, or unlawful passage. They are divided into
hierarchic factions that seek to control humans and the earth as part of a
millennial war. Some are unique powers, such as the Devil, while others are
recurring archetypal servants, tempters, possessors, familiars, soul-drinkers,
or messengers.

## Design Goals

The base Unnatural should be:

- clearly outsider in origin
- dangerous through temptation, possession, command, corruption, or spiritual predation rather than only physical violence
- hierarchic and factional rather than solitary or folkloric
- able to unsettle, recruit, dominate, or spiritually compromise mortals
- distinct from `The Unseen`, which belong to the Hidden Folk's parallel civilization, by feeling invasive and alien to both mortal life and the hidden order
- broad enough to support devils, demons, angels, and similar beings without yet being specialized into faction, rank, or battlefield role variants

It should feel like a being that does not properly belong to the mortal order,
but has entered it with purpose. Whether terrifying, glorious, seductive, or
seemingly righteous, it should feel like part of a larger war and hierarchy
rather than a local mythic power.

Unnaturals are not usually beings one fights in ordinary circumstances. They are
more often encountered through summoning, temptation, haunting influence,
possession, service, command, or slow corruption.

## Base Stats

Recommended actor-side base values:

```yaml
TypeDropdown: Unnatural
MoveGround: 5
MoveFly: 0
MoveSwim: 0
MoveBurrow: 0
MoveClimb: 0

Stats_StrengthDice: 1
Stats_StrengthMod: 1
Stats_DexterityDice: 1
Stats_DexterityMod: 1
Stats_StaminaDice: 2
Stats_StaminaMod: 0
Stats_IntelligenceDice: 2
Stats_IntelligenceMod: 0
Stats_FaithDice: 2
Stats_FaithMod: 1
Stats_CharismaDice: 2
Stats_CharismaMod: 1
Stats_PowerDice: 2
Stats_PowerMod: 1
```

This corresponds to:

- moderate Strength
- moderate Dexterity
- good Stamina
- good Intelligence
- strong Faith
- strong Charisma
- strong Power

## Passive Rule Changes

These are the concrete passive changes the base monster should receive.

### Summoned Outsider

```yaml
- _id: UnnaturalBaseOtherworldlyTag
  name: Unnatural Base - Summoned Outsider Tag
  kind: Tag
  tagName: Otherworldly
  notes: The being does not properly belong to the world and has entered it from elsewhere.

- _id: UnnaturalBaseOtherworldlyTrait
  name: Unnatural Base - Summoned Outsider Trait
  kind: Trait
  traitName: Summoned Outsider
  traitDescription: It is not merely strange, foreign, or magical, but a being from another existence brought or loosed into the world by summoning, breach, invitation, or unlawful passage.
  notes: Core origin trait for Unnaturals.
```

### Factional Pressure

```yaml
- _id: UnnaturalBasePressureTag
  name: Unnatural Base - Factional Pressure Tag
  kind: Tag
  tagName: UnsettlingPresence
  notes: Contact with the being puts pressure on conscience, desire, allegiance, fear, or faith.

- _id: UnnaturalBasePressureTrait
  name: Unnatural Base - Factional Pressure Trait
  kind: Trait
  traitName: Factional Pressure
  traitDescription: Its presence brings temptation, dread, zeal, condemnation, or spiritual pressure because every encounter with it is entangled in a larger factional struggle for souls, service, and allegiance.
  notes: Core emotional and spiritual pressure trait for Unnaturals as war agents rather than isolated beings.
```

### Bound to Hierarchy

```yaml
- _id: UnnaturalBasePurposeTag
  name: Unnatural Base - Bound to Hierarchy Tag
  kind: Tag
  tagName: OathBound
  notes: The being acts according to hierarchy, doctrine, command, hunger, law, or factional purpose.

- _id: UnnaturalBasePurposeTrait
  name: Unnatural Base - Bound to Hierarchy Trait
  kind: Trait
  traitName: Bound to Hierarchy
  traitDescription: It is not merely capricious. Even when seductive, merciful, or destructive, it acts under a factional order of rank, doctrine, command, or appetite that reaches beyond the mortal world.
  notes: Core hierarchy trait for Unnaturals.
```

## Granted Power Items

The base monster should own the following named powers.

### Presence of the Outer War

Suggested power identity:

```yaml
name: Presence of the Outer War
type: Power
description: The being's mere nearness presses mortals toward dread, compromise, zeal, or submission.
```

Suggested primary usage effect:

```yaml
Description: The being's mere nearness presses mortals toward dread, compromise, zeal, or submission.
ApplicationMode: CreateActiveEffect
EffectType: Influence
EffectSubtype: Fear
Visible: true
TargetType: Actor
TargetCount: "1"
TargetRange: "Sight or felt presence"
TargetFilter: ""
TargetDescription: A mortal or lesser being that confronts the Unnatural directly.
CheckType: Contest
CheckFormula: source Power
ResistanceType: Faith
ResistanceFormula: target Faith
OnPartial: Target hesitates, falters, or feels the pressure of unwanted spiritual attention.
OnFailure: Target is overcome by dread, awe, temptation, zeal, or disorientation.
PayloadTarget: Status
PayloadOperation: Apply
PayloadValue: Afraid
PayloadDice: ""
PayloadTag: ""
PayloadTraitName: ""
PayloadTraitText: ""
GrantedItemTemplate: ""
GrantedItemName: ""
PayloadNotes: Variants may shift toward Shame, Obedience, Doubt, Fascination, or Zeal depending on faction and role.
DurationType: Scene
DurationValue: ""
ExpiryTrigger: Leave the presence, scene ends, or pressure is ritually broken.
RemovalMethod: Blessing, ward, command, withdrawal
SuppressedBy: ""
```

### Word of Temptation or Command

Suggested power identity:

```yaml
name: Word of Temptation or Command
type: Power
description: The being speaks with force that seduces, recruits, condemns, or binds.
```

Suggested primary usage effect:

```yaml
Description: The being speaks with force that seduces, recruits, condemns, or binds.
ApplicationMode: CreateActiveEffect
EffectType: Influence
EffectSubtype: Obedience
Visible: true
TargetType: Actor
TargetCount: "1"
TargetRange: "Voice"
TargetFilter: ""
TargetDescription: A target that can hear and understand the being.
CheckType: Contest
CheckFormula: source Power or Charisma
ResistanceType: Faith or Charisma
ResistanceFormula: target Faith or Charisma
OnPartial: Target struggles, delays, or inwardly resists.
OnFailure: Target yields to command, condemnation, bargain, seduction, or recruitment pressure.
PayloadTarget: Will / obedience
PayloadOperation: Apply
PayloadValue: Obedience
PayloadDice: ""
PayloadTag: ""
PayloadTraitName: ""
PayloadTraitText: ""
GrantedItemTemplate: ""
GrantedItemName: ""
PayloadNotes: Angelic variants may feel judicial or doctrinal; infernal ones contractual; demonic ones corruptive, possessive, or predatory.
DurationType: Scene
DurationValue: ""
ExpiryTrigger: Command fulfilled, scene ends, or stronger authority intervenes.
RemovalMethod: Counter-command, sacred resistance, broken pact
SuppressedBy: ""
```

### Enter Unbidden

Suggested power identity:

```yaml
name: Enter Unbidden
type: Power
description: The being crosses boundary, ward, or ordinary placement in a way that should not be possible.
```

Suggested usage effect:

```yaml
Description: The being crosses boundary, ward, or ordinary placement in a way that should not be possible.
ApplicationMode: CreateActiveEffect
EffectType: Protection
EffectSubtype: SafePassage
Visible: false
TargetType: Self
TargetCount: "1"
TargetRange: "Self"
TargetFilter: ""
TargetDescription: The Unnatural itself.
CheckType: None
CheckFormula: ""
ResistanceType: ""
ResistanceFormula: ""
OnPartial: ""
OnFailure: ""
PayloadTarget: Passage / boundary interaction
PayloadOperation: Apply
PayloadValue: Safe Passage
PayloadDice: ""
PayloadTag: ""
PayloadTraitName: ""
PayloadTraitText: ""
GrantedItemTemplate: ""
GrantedItemName: ""
PayloadNotes: Use for unlawful entry, slipping through weakened wards, appearing where summoned, entering by invitation, or withdrawing from ordinary reach.
DurationType: Scene
DurationValue: ""
ExpiryTrigger: The being remains plainly present, is strongly warded, or the scene changes.
RemovalMethod: Consecration, exorcism, true-name binding, stronger ward
SuppressedBy: A proper ward, true prohibition, or law that specifically bars its kind
```

## Concrete Starter Package

The `Unnatural Base` should therefore include:

- passive tag/trait changes:
  - `Summoned Outsider`
  - `Factional Pressure`
  - `Bound to Hierarchy`
- owned power items:
  - `Presence of the Outer War`
  - `Word of Temptation or Command`
  - `Enter Unbidden`

## Actor Source Draft

This is the recommended authored shape for a future `monsters.json` entry once
actor seeding is expanded to support fully-authored embedded power items.

```yaml
name: Unnatural Base
type: character
img: icons/svg/mystery-man.svg
system:
  template: Tgs09eTiTp63Cp7u
  props:
    TypeDropdown: Unnatural
    MoveGround: 5
    MoveFly: 0
    MoveSwim: 0
    MoveBurrow: 0
    MoveClimb: 0
    Stats_StrengthDice: 1
    Stats_StrengthMod: 1
    Stats_DexterityDice: 1
    Stats_DexterityMod: 1
    Stats_StaminaDice: 2
    Stats_StaminaMod: 0
    Stats_IntelligenceDice: 2
    Stats_IntelligenceMod: 0
    Stats_FaithDice: 2
    Stats_FaithMod: 1
    Stats_CharismaDice: 2
    Stats_CharismaMod: 1
    Stats_PowerDice: 2
    Stats_PowerMod: 1
items:
  - Summoned Outsider rule feature
  - Factional Pressure rule feature
  - Bound to Hierarchy rule feature
  - Presence of the Outer War power
  - Word of Temptation or Command power
  - Enter Unbidden power
```

## Recommended Next Layer

The first layers to stack onto this base should distinguish faction, rank, and
role in the outsider war, for example:

- `Angelic`
- `Infernal`
- `Demonic`
- `Tempter`
- `Possessor`
- `Familiar`
- `Soul Drinker`
- `Messenger`
- `Commander`

Those should add the exact factional allegiance, vulnerabilities, iconography,
summoning pattern, possession logic, corruption or blessing style, and
subtype-specific powers that the base intentionally leaves open.
