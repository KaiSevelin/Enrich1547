# Zone Colossus Base Starter Spec v1

This document defines a concrete first-pass content draft for the `Zone Colossus Base`
monster chassis.

It is intended as the reusable root actor for singular immense Zone beings such
as the enormous severed hand and other impossible disasters whose danger is
defined by colossal scale fused with warped locality before more specific
domain, motivation, loadout, and quirk ChangeSets are layered on top.

Zone Colossi are not merely large Zone creatures or eerie versions of dragons.
They are singular manifestations of the Zone at catastrophic scale: impossible
things that move through warped land like disasters, landmarks, or intrusions of
wrong reality. They should feel less like beasts and more like enormous
nightmares that have become physically present.

Like the broader Zone category, they should carry a sense of being out of time
and out of place. Their approach may bring signs, debris, architecture,
processions, dead things, or impossible remnants that feel torn from other eras
and wrongly forced into the present.

## Design Goals

The base Zone Colossus should be:

- singular
- immense
- alien in anatomy or composition
- out of time
- out of place
- catastrophic to landscapes, roads, villages, or whole stretches of Zone
- more apprehended through signs, tremors, spoor, and impossible effects than through ordinary sight
- distinct from ordinary `Colossal` by feeling warped, impossible, and Zone-native rather than hunger-driven and beastlike
- broad enough to support the severed hand and other singular Zone disasters without yet being specialized into grasping, burrowing, crawling, watching, or boundary-breaking variants

It should feel like a colossal manifestation of wrongness rather than a giant
animal, an old god, or an outsider invader.

## Base Stats

Recommended actor-side base values:

```yaml
TypeDropdown: ZoneColossus
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
Stats_IntelligenceMod: 0
Stats_FaithDice: 1
Stats_FaithMod: 0
Stats_CharismaDice: 1
Stats_CharismaMod: 1
Stats_PowerDice: 3
Stats_PowerMod: 0
```

This corresponds to:

- very high Strength
- low to moderate Dexterity
- very high Stamina
- low Intelligence
- low Faith
- low to moderate Charisma
- very high Power

## Passive Rule Changes

These are the concrete passive changes the base monster should receive.

### Impossible Bulk

```yaml
- _id: ZoneColossusBaseBulkTag
  name: Zone Colossus Base - Impossible Bulk Tag
  kind: Tag
  tagName: Massive
  notes: The being's scale is immense and physically scene-defining.

- _id: ZoneColossusBaseBulkTrait
  name: Zone Colossus Base - Impossible Bulk Trait
  kind: Trait
  traitName: Impossible Bulk
  traitDescription: Its body, or what passes for a body, is so vast that roads, ruins, treelines, and watchers must orient themselves around its movement.
  notes: Core scale trait for Zone Colossi.
```

### Zone Catastrophe

```yaml
- _id: ZoneColossusBaseCatastropheTag
  name: Zone Colossus Base - Zone Catastrophe Tag
  kind: Tag
  tagName: Otherworldly
  notes: The being is not just in the Zone but is itself a catastrophic expression of Zone wrongness.

- _id: ZoneColossusBaseCatastropheTrait
  name: Zone Colossus Base - Zone Catastrophe Trait
  kind: Trait
  traitName: Zone Catastrophe
  traitDescription: It moves through warped land as a disaster of impossible nearness, altered scale, and hostile unreality rather than as a natural living creature.
  notes: Core ontological trait for Zone Colossi.
```

### Badly Understood

```yaml
- _id: ZoneColossusBaseSeenTag
  name: Zone Colossus Base - Badly Understood Tag
  kind: Tag
  tagName: HalfSeen
  notes: Even at great size the being is difficult to perceive correctly.

- _id: ZoneColossusBaseSeenTrait
  name: Zone Colossus Base - Badly Understood Trait
  kind: Trait
  traitName: Badly Understood
  traitDescription: Even when enormous, it is known through partial views, wrong distances, vanished ground, and impossible signs more often than through a stable full sighting.
  notes: Core perception-distortion trait for Zone Colossi.
```

## Granted Power Items

The base monster should own the following named powers.

### Zonequake Advance

Suggested power identity:

```yaml
name: Zonequake Advance
type: Power
description: The being's movement turns approach itself into a disaster.
```

Suggested primary usage effect:

```yaml
Description: The being's movement turns approach itself into a disaster.
ApplicationMode: CreateActiveEffect
EffectType: Protection
EffectSubtype: Momentum
Visible: true
TargetType: Self
TargetCount: "1"
TargetRange: "Self"
TargetFilter: ""
TargetDescription: The Zone Colossus itself.
CheckType: None
CheckFormula: ""
ResistanceType: ""
ResistanceFormula: ""
OnPartial: ""
OnFailure: ""
PayloadTarget: Movement / terrain pressure
PayloadOperation: Apply
PayloadValue: Momentum
PayloadDice: ""
PayloadTag: ""
PayloadTraitName: ""
PayloadTraitText: ""
GrantedItemTemplate: ""
GrantedItemName: ""
PayloadNotes: Use for ground-failure, shattered roads, collapsing structures, grasping reach, or the sense that safe distance has ceased to exist.
DurationType: Scene
DurationValue: ""
ExpiryTrigger: After the advance resolves or the scene changes.
RemovalMethod: ""
SuppressedBy: Strong barriers, deep warding, or terrain it cannot yet force through
```

### Colossal Taking

Suggested power identity:

```yaml
name: Colossal Taking
type: Power
description: The being seizes, crushes, drags, or overtakes a target with impossible force.
```

Suggested primary usage effect:

```yaml
Description: The being seizes, crushes, drags, or overtakes a target with impossible force.
ApplicationMode: CreateActiveEffect
EffectType: Status
EffectSubtype: Weakened
Visible: true
TargetType: Actor
TargetCount: "1"
TargetRange: "Reach"
TargetFilter: ""
TargetDescription: A target caught by limb, bulk, grasp, collapse, or proximity.
CheckType: Contest
CheckFormula: source Strength or Power
ResistanceType: Stamina
ResistanceFormula: target Stamina
OnPartial: Target is struck, trapped, or nearly lost.
OnFailure: Target is overtaken and weakened by catastrophic contact.
PayloadTarget: Status
PayloadOperation: Apply
PayloadValue: Weakened
PayloadDice: ""
PayloadTag: ""
PayloadTraitName: ""
PayloadTraitText: ""
GrantedItemTemplate: ""
GrantedItemName: ""
PayloadNotes: For the severed hand, this is the core grasping or crushing move; other Zone Colossi can reskin it to drag, bury, pin, or engulf.
DurationType: Scene
DurationValue: ""
ExpiryTrigger: End of scene or recovery
RemovalMethod: Rescue, retreat, recovery, removal from immediate reach
SuppressedBy: ""
```

Optional secondary direct-harm effect:

```yaml
Description: The contact inflicts devastating direct harm.
ApplicationMode: DirectDataChange
EffectType: Stat
EffectSubtype: Resource
Visible: true
TargetType: Actor
TargetCount: "1"
TargetRange: "Reach"
TargetDescription: A target caught by the Zone Colossus.
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

### Horizon of Dread

Suggested power identity:

```yaml
name: Horizon of Dread
type: Power
description: The realization of the being's scale and nearness breaks order and nerve.
```

Suggested usage effect:

```yaml
Description: The realization of the being's scale and nearness breaks order and nerve.
ApplicationMode: CreateActiveEffect
EffectType: Influence
EffectSubtype: Fear
Visible: true
TargetType: Actor
TargetCount: "1"
TargetRange: "Sight, tremor, or impossible sign"
TargetFilter: ""
TargetDescription: A mortal or lesser being that understands, too late, what is approaching.
CheckType: Contest
CheckFormula: source Power
ResistanceType: Faith
ResistanceFormula: target Faith
OnPartial: Target hesitates, breaks formation, or loses certainty.
OnFailure: Target is overcome by dread, disbelief, or hunted panic.
PayloadTarget: Status
PayloadOperation: Apply
PayloadValue: Afraid
PayloadDice: ""
PayloadTag: ""
PayloadTraitName: ""
PayloadTraitText: ""
GrantedItemTemplate: ""
GrantedItemName: ""
PayloadNotes: Use when the catastrophe becomes undeniable, even if the full shape is still not properly understood.
DurationType: Scene
DurationValue: ""
ExpiryTrigger: Reach clear safety, regroup, or the scene changes.
RemovalMethod: Rally, blessing, hard cover, strong leadership
SuppressedBy: ""
```

## Concrete Starter Package

The `Zone Colossus Base` should therefore include:

- passive tag/trait changes:
  - `Impossible Bulk`
  - `Zone Catastrophe`
  - `Badly Understood`
- owned power items:
  - `Zonequake Advance`
  - `Colossal Taking`
  - `Horizon of Dread`

## Actor Source Draft

This is the recommended authored shape for a future `monsters.json` entry once
actor seeding is expanded to support fully-authored embedded power items.

```yaml
name: Zone Colossus Base
type: character
img: icons/svg/mystery-man.svg
system:
  template: Tgs09eTiTp63Cp7u
  props:
    TypeDropdown: ZoneColossus
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
    Stats_IntelligenceMod: 0
    Stats_FaithDice: 1
    Stats_FaithMod: 0
    Stats_CharismaDice: 1
    Stats_CharismaMod: 1
    Stats_PowerDice: 3
    Stats_PowerMod: 0
items:
  - Impossible Bulk rule feature
  - Zone Catastrophe rule feature
  - Badly Understood rule feature
  - Zonequake Advance power
  - Colossal Taking power
  - Horizon of Dread power
```

## Recommended Next Layer

The first layers to stack onto this base should distinguish the exact form of
Zone catastrophe, for example:

- `Severed Hand`
- `Crawling Ruin`
- `Watching Mass`
- `Buried Colossus`

Those should add the exact anatomy, movement logic, signs of approach, terrain
warping, grasping or crushing profile, and singular horror identity that the
base intentionally leaves open.
