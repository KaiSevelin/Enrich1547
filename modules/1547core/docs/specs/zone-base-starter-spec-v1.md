# Zone Base Starter Spec v1

This document defines a concrete first-pass content draft for the `Zone Base`
monster chassis.

It is intended as the reusable root actor for eerie stalking beings tied to the
Zone: warped pockets of reality that spread through the world as places of dread,
wrongness, historical dislocation, and alien pressure. Zone creatures are known
more by signs, disappearances, pursuit, and partial glimpses than by clear
sight before more specific domain, motivation, loadout, and quirk ChangeSets
are layered on top.

The Zone is the one monster category that is not meant to feel historically
grounded in the same way as the rest of the setting. It should instead feel out
of time and out of place: a breach in which memory, sequence, place, and era
have become unsound. Sometimes a Zone may disgorge beings, fragments, or signs
that seem to belong to another century, another campaign, or another order of
history entirely.

## Design Goals

The base Zone creature should be:

- eerie
- alien
- out of time
- out of place
- more apprehended than clearly observed
- a stalking threat to travelers, trespassers, and isolated people
- fundamentally distinct from other monster families by feeling shaped by warped locality, historical dislocation, and rupture rather than by natural life, folklore law, cosmic order, or simple curse
- broad enough to support many kinds of Zone predators or manifestations without yet being specialized into imitation, hunter, echo, or boundary-haunting variants

It should feel like something that belongs to an area of wrongness and knows
how to hunt within it better than mortals know how to survive it.

Zone creatures should not merely feel strange. They should feel wrongly
present: as though they, or the conditions that sustain them, do not belong to
the proper order of the world, the proper order of history, or the proper shape
of place.

## Base Stats

Recommended actor-side base values:

```yaml
TypeDropdown: Zone
MoveGround: 5
MoveFly: 0
MoveSwim: 0
MoveBurrow: 0
MoveClimb: 0

Stats_StrengthDice: 1
Stats_StrengthMod: 1
Stats_DexterityDice: 2
Stats_DexterityMod: 1
Stats_StaminaDice: 2
Stats_StaminaMod: 0
Stats_IntelligenceDice: 1
Stats_IntelligenceMod: 1
Stats_FaithDice: 1
Stats_FaithMod: 0
Stats_CharismaDice: 1
Stats_CharismaMod: 1
Stats_PowerDice: 2
Stats_PowerMod: 1
```

This corresponds to:

- moderate Strength
- strong Dexterity
- good Stamina
- low to moderate Intelligence
- low Faith
- low to moderate Charisma
- strong Power

## Passive Rule Changes

These are the concrete passive changes the base monster should receive.

### Badly Seen

```yaml
- _id: ZoneBaseBadlySeenTag
  name: Zone Base - Badly Seen Tag
  kind: Tag
  tagName: HalfSeen
  notes: The being is difficult to perceive correctly or consistently.

- _id: ZoneBaseBadlySeenTrait
  name: Zone Base - Badly Seen Trait
  kind: Trait
  traitName: Badly Seen
  traitDescription: It is usually known through movement, traces, peripheral glimpses, or the certainty that something is there rather than through clear observation.
  notes: Core perception-distortion trait for Zone creatures.
```

### Zone Stalker

```yaml
- _id: ZoneBaseStalkerTag
  name: Zone Base - Zone Stalker Tag
  kind: Tag
  tagName: SenseLiving
  notes: The being hunts those moving through the Zone more reliably than they can track it.

- _id: ZoneBaseStalkerTrait
  name: Zone Base - Zone Stalker Trait
  kind: Trait
  traitName: Zone Stalker
  traitDescription: It follows, circles, separates, and pressures intruders with patience, using the wrongness of the Zone as part of the hunt.
  notes: Core pursuit trait for Zone creatures.
```

### Alien Locality

```yaml
- _id: ZoneBaseAlienTag
  name: Zone Base - Alien Locality Tag
  kind: Tag
  tagName: Otherworldly
  notes: The being is shaped by a place where ordinary logic, memory, time, or perception has gone wrong.

- _id: ZoneBaseAlienTrait
  name: Zone Base - Alien Locality Trait
  kind: Trait
  traitName: Alien Locality
  traitDescription: It belongs to warped terrain, wrong silence, broken paths, impossible nearness, and the hostile logic of the Zone rather than to any stable natural, supernatural, or historical order.
  notes: Core ontological difference trait for Zone creatures as wrongly present beings.
```

## Granted Power Items

The base monster should own the following named powers.

### Stalking Pressure

Suggested power identity:

```yaml
name: Stalking Pressure
type: Power
description: The being's pursuit wears down nerve before it closes to strike.
```

Suggested primary usage effect:

```yaml
Description: The being's pursuit wears down nerve before it closes to strike.
ApplicationMode: CreateActiveEffect
EffectType: Influence
EffectSubtype: Fear
Visible: true
TargetType: Actor
TargetCount: "1"
TargetRange: "Felt presence or uncertain distance"
TargetFilter: ""
TargetDescription: A traveler or trespasser who knows, or thinks they know, that the Zone creature is near.
CheckType: Contest
CheckFormula: source Power
ResistanceType: Faith or Stamina
ResistanceFormula: target Faith or Stamina
OnPartial: Target hesitates, turns back, or loses discipline.
OnFailure: Target is overcome by dread, isolation, or hunted panic.
PayloadTarget: Status
PayloadOperation: Apply
PayloadValue: Afraid
PayloadDice: ""
PayloadTag: ""
PayloadTraitName: ""
PayloadTraitText: ""
GrantedItemTemplate: ""
GrantedItemName: ""
PayloadNotes: Use before clear contact, when the creature is only partly perceived or only inferred from signs.
DurationType: Scene
DurationValue: ""
ExpiryTrigger: Leave the Zone, regroup safely, or the creature breaks off pursuit.
RemovalMethod: Rally, blessing, clear shelter, trusted companionship
SuppressedBy: ""
```

### Lead From the Path

Suggested power identity:

```yaml
name: Lead From the Path
type: Power
description: The being draws a victim away from safety, certainty, or the group.
```

Suggested primary usage effect:

```yaml
Description: The being draws a victim away from safety, certainty, or the group.
ApplicationMode: CreateActiveEffect
EffectType: Influence
EffectSubtype: Doubt
Visible: false
TargetType: Actor
TargetCount: "1"
TargetRange: "Sight, sound, or false sign"
TargetFilter: ""
TargetDescription: A target moving through the Zone who can be separated from others.
CheckType: Contest
CheckFormula: source Power or Dexterity
ResistanceType: Faith or Intelligence
ResistanceFormula: target Faith or Intelligence
OnPartial: Target loses direction or strays slightly.
OnFailure: Target is led away, split off, or drawn into a bad approach.
PayloadTarget: Judgment / direction
PayloadOperation: Apply
PayloadValue: Doubt
PayloadDice: ""
PayloadTag: ""
PayloadTraitName: ""
PayloadTraitText: ""
GrantedItemTemplate: ""
GrantedItemName: ""
PayloadNotes: Use for false voices, wrong tracks, near-at-hand movement, or a compelling sense that the safe path lies elsewhere.
DurationType: Scene
DurationValue: ""
ExpiryTrigger: Target is recovered, guided back, or leaves the Zone.
RemovalMethod: Trusted guide, warded route, tethering, communal discipline
SuppressedBy: ""
```

### Sudden Taking

Suggested power identity:

```yaml
name: Sudden Taking
type: Power
description: The being closes abruptly from partial perception into direct harm.
```

Suggested primary usage effect:

```yaml
Description: The being closes abruptly from partial perception into direct harm.
ApplicationMode: CreateActiveEffect
EffectType: Status
EffectSubtype: Weakened
Visible: true
TargetType: Actor
TargetCount: "1"
TargetRange: "Touch or sudden proximity"
TargetFilter: ""
TargetDescription: A target isolated, cornered, or overtaken by the Zone creature.
CheckType: Contest
CheckFormula: source Dexterity or Power
ResistanceType: Stamina
ResistanceFormula: target Stamina
OnPartial: Target is struck, grazed, or partially seized.
OnFailure: Target is overtaken and weakened by sudden contact with the creature.
PayloadTarget: Status
PayloadOperation: Apply
PayloadValue: Weakened
PayloadDice: ""
PayloadTag: ""
PayloadTraitName: ""
PayloadTraitText: ""
GrantedItemTemplate: ""
GrantedItemName: ""
PayloadNotes: The exact bodily form may remain unclear even in attack; the important effect is abrupt dangerous contact from an only-half-seen hunter.
DurationType: Scene
DurationValue: ""
ExpiryTrigger: End of scene or recovery
RemovalMethod: Rest, treatment, rescue, removal from the Zone
SuppressedBy: ""
```

Optional secondary direct-harm effect:

```yaml
Description: The contact inflicts direct harm.
ApplicationMode: DirectDataChange
EffectType: Stat
EffectSubtype: Resource
Visible: true
TargetType: Actor
TargetCount: "1"
TargetRange: "Touch or sudden proximity"
TargetDescription: A target caught by the Zone creature.
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

## Concrete Starter Package

The `Zone Base` should therefore include:

- passive tag/trait changes:
  - `Badly Seen`
  - `Zone Stalker`
  - `Alien Locality`
- owned power items:
  - `Stalking Pressure`
  - `Lead From the Path`
  - `Sudden Taking`

## Actor Source Draft

This is the recommended authored shape for a future `monsters.json` entry once
actor seeding is expanded to support fully-authored embedded power items.

```yaml
name: Zone Base
type: character
img: icons/svg/mystery-man.svg
system:
  template: Tgs09eTiTp63Cp7u
  props:
    TypeDropdown: Zone
    MoveGround: 5
    MoveFly: 0
    MoveSwim: 0
    MoveBurrow: 0
    MoveClimb: 0
    Stats_StrengthDice: 1
    Stats_StrengthMod: 1
    Stats_DexterityDice: 2
    Stats_DexterityMod: 1
    Stats_StaminaDice: 2
    Stats_StaminaMod: 0
    Stats_IntelligenceDice: 1
    Stats_IntelligenceMod: 1
    Stats_FaithDice: 1
    Stats_FaithMod: 0
    Stats_CharismaDice: 1
    Stats_CharismaMod: 1
    Stats_PowerDice: 2
    Stats_PowerMod: 1
items:
  - Badly Seen rule feature
  - Zone Stalker rule feature
  - Alien Locality rule feature
  - Stalking Pressure power
  - Lead From the Path power
  - Sudden Taking power
```

## Recommended Next Layer

The first layers to stack onto this base should distinguish how the Zone-being
exists and hunts, for example:

- `Manifestation`
- `Echo Person`
- `Zone Predator`
- `Warped Servitor`
- `Boundary Haunter`

Those should add the exact mode of appearance, signs of approach, movement
logic, relation to warped terrain, and subtype-specific attack pattern that the
base intentionally leaves open.
