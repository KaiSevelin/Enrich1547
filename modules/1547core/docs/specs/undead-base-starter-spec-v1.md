# Undead Base Starter Spec v1

This document defines a concrete first-pass content draft for the `Undead Base`
monster chassis.

It is intended as the reusable root actor for beings that for some reason did
not pass properly out of the world in death: revenants, draugr, ghosts,
unquiet dead, living dead, hauntings, fetches, and similar returns before more
specific domain, motivation, loadout, and quirk ChangeSets are layered on top.

Undead are not defined by body type but by failed death. They remain because of
injustice, hatred, grief, oath, pact, wrong burial, unclean spirit, magic, or
some unfinished claim that has prevented proper rest.

## Design Goals

The base Undead should be:

- unmistakably dead or death-touched
- marked by failed passage rather than by living transformation
- dangerous through persistence, return, spiritual wrongness, or unfinished purpose
- broad enough to support corporeal and incorporeal dead alike
- distinct from `Cursed`, which is wrong life, by feeling like wrong death
- broad enough to support revenants, draugr, ghosts, living dead, hauntings, and fetches without yet being specialized into corporeal, spectral, vengeful, domestic, or imitative variants

It should feel like something that should have passed out of the world but did
not, whether through refusal, binding, desecration, impurity, or unfinished
need.

Undead are often fought, but they should also support eerie, tragic, domestic,
and narrative presences rather than only straightforward combat encounters.

## Base Stats

Recommended actor-side base values:

```yaml
TypeDropdown: Undead
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
Stats_IntelligenceDice: 1
Stats_IntelligenceMod: 1
Stats_FaithDice: 1
Stats_FaithMod: 1
Stats_CharismaDice: 1
Stats_CharismaMod: 0
Stats_PowerDice: 2
Stats_PowerMod: 1
```

This corresponds to:

- moderate Strength
- moderate Dexterity
- good Stamina
- low to moderate Intelligence
- moderate Faith
- low Charisma
- strong Power

The stronger Power here represents persistence, spiritual force, and the
wrongness of continued presence, not necessarily spellcasting or active malice.

## Passive Rule Changes

These are the concrete passive changes the base monster should receive.

### Unpassed Dead

```yaml
- _id: UndeadBaseUnpassedTag
  name: Undead Base - Unpassed Dead Tag
  kind: Tag
  tagName: Undead
  notes: The being is dead, or should be dead, and yet remains active in the world.

- _id: UndeadBaseUnpassedTrait
  name: Undead Base - Unpassed Dead Trait
  kind: Trait
  traitName: Unpassed Dead
  traitDescription: It did not pass properly out of the world. Whether corpse, spirit, echo, or false continuation, it remains because death was denied, disrupted, or refused.
  notes: Core identity trait for Undead.
```

### Bound by the Cause of Return

```yaml
- _id: UndeadBaseCauseTag
  name: Undead Base - Bound by the Cause of Return Tag
  kind: Tag
  tagName: OathBound
  notes: The being remains tied to a cause, grievance, pact, rite, impurity, or unfinished purpose.

- _id: UndeadBaseCauseTrait
  name: Undead Base - Bound by the Cause of Return Trait
  kind: Trait
  traitName: Bound by the Cause of Return
  traitDescription: Its continued presence is anchored in hatred, grief, injustice, oath, wrong burial, unclean spirit, magic, or some other unresolved cause that gives shape to its return.
  notes: Core motive and anchor trait for Undead.
```

### Grave Wrongness

```yaml
- _id: UndeadBaseWrongnessTag
  name: Undead Base - Grave Wrongness Tag
  kind: Tag
  tagName: UnsettlingPresence
  notes: The being carries the pressure of death not being at rest.

- _id: UndeadBaseWrongnessTrait
  name: Undead Base - Grave Wrongness Trait
  kind: Trait
  traitName: Grave Wrongness
  traitDescription: Its presence brings dread, chill, sorrow, sacrilege, corruption, or the sense that something about death has gone uncleanly wrong.
  notes: Core emotional and spiritual pressure trait for Undead.
```

## Granted Power Items

The base monster should own the following named powers.

### Return Unbidden

Suggested power identity:

```yaml
name: Return Unbidden
type: Power
description: The dead presence reasserts itself where rest, absence, or closure should have prevailed.
```

Suggested primary usage effect:

```yaml
Description: The dead presence reasserts itself where rest, absence, or closure should have prevailed.
ApplicationMode: CreateActiveEffect
EffectType: Protection
EffectSubtype: Momentum
Visible: true
TargetType: Self
TargetCount: "1"
TargetRange: "Self"
TargetFilter: ""
TargetDescription: The Undead itself.
CheckType: None
CheckFormula: ""
ResistanceType: ""
ResistanceFormula: ""
OnPartial: ""
OnFailure: ""
PayloadTarget: Return / persistence
PayloadOperation: Apply
PayloadValue: Momentum
PayloadDice: ""
PayloadTag: ""
PayloadTraitName: ""
PayloadTraitText: ""
GrantedItemTemplate: ""
GrantedItemName: ""
PayloadNotes: Use for rising again, manifesting, appearing where burial or memory binds it, or asserting continued presence when it should have been gone.
DurationType: Scene
DurationValue: ""
ExpiryTrigger: After the return resolves, proper rites are completed, or the scene changes.
RemovalMethod: Rite, blessing, fulfillment, release
SuppressedBy: Consecration, proper burial, true absolution
```

### Touch of the Grave

Suggested power identity:

```yaml
name: Touch of the Grave
type: Power
description: The dead thing's contact carries weakness, chill, wasting, or spiritual harm.
```

Suggested primary usage effect:

```yaml
Description: The dead thing's contact carries weakness, chill, wasting, or spiritual harm.
ApplicationMode: CreateActiveEffect
EffectType: Status
EffectSubtype: Weakened
Visible: true
TargetType: Actor
TargetCount: "1"
TargetRange: "Touch, grasp, strike, or close spiritual contact"
TargetFilter: ""
TargetDescription: A target touched by corpse, spirit, cold hand, drowning grasp, or grave-tainted nearness.
CheckType: Contest
CheckFormula: source Power or Strength
ResistanceType: Stamina
ResistanceFormula: target Stamina
OnPartial: Target is chilled, shaken, or spiritually tainted.
OnFailure: Target is weakened by grave-cold, wasting, drowning pull, corpse-force, or death pressure.
PayloadTarget: Status
PayloadOperation: Apply
PayloadValue: Weakened
PayloadDice: ""
PayloadTag: ""
PayloadTraitName: ""
PayloadTraitText: ""
GrantedItemTemplate: ""
GrantedItemName: ""
PayloadNotes: Variants can style this as revenant blow, ghost-touch, draugr grip, wasting kiss, drowning pull, or fetch-contact.
DurationType: Scene
DurationValue: ""
ExpiryTrigger: End of scene or recovery
RemovalMethod: Rest, warmth, rite, blessing, treatment
SuppressedBy: ""
```

Optional secondary direct-harm effect:

```yaml
Description: The contact inflicts direct bodily or spiritual harm.
ApplicationMode: DirectDataChange
EffectType: Stat
EffectSubtype: Resource
Visible: true
TargetType: Actor
TargetCount: "1"
TargetRange: "Touch, grasp, strike, or close spiritual contact"
TargetDescription: A target caught by the Undead.
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

### Presence of the Unquiet

Suggested power identity:

```yaml
name: Presence of the Unquiet
type: Power
description: The dead thing's nearness stirs dread, grief, guilt, or the fear that death has not been properly kept.
```

Suggested usage effect:

```yaml
Description: The dead thing's nearness stirs dread, grief, guilt, or the fear that death has not been properly kept.
ApplicationMode: CreateActiveEffect
EffectType: Influence
EffectSubtype: Fear
Visible: true
TargetType: Actor
TargetCount: "1"
TargetRange: "Sight, memory, cry, or felt presence"
TargetFilter: ""
TargetDescription: A mortal or lesser being that confronts or recognizes the Undead.
CheckType: Contest
CheckFormula: source Power
ResistanceType: Faith or Stamina
ResistanceFormula: target Faith or Stamina
OnPartial: Target recoils, hesitates, or feels the pull of old grief or dread.
OnFailure: Target is overcome by fear, grief, guilt, or the horror of improper death.
PayloadTarget: Status
PayloadOperation: Apply
PayloadValue: Afraid
PayloadDice: ""
PayloadTag: ""
PayloadTraitName: ""
PayloadTraitText: ""
GrantedItemTemplate: ""
GrantedItemName: ""
PayloadNotes: Variants may lean toward sorrow, fascination, guilt, drowning panic, or corpse-fear depending on subtype.
DurationType: Scene
DurationValue: ""
ExpiryTrigger: Leave the presence, receive blessing, regain nerve, or the scene changes.
RemovalMethod: Rally, prayer, ritual certainty, distance
SuppressedBy: ""
```

## Concrete Starter Package

The `Undead Base` should therefore include:

- passive tag/trait changes:
  - `Unpassed Dead`
  - `Bound by the Cause of Return`
  - `Grave Wrongness`
- owned power items:
  - `Return Unbidden`
  - `Touch of the Grave`
  - `Presence of the Unquiet`

## Actor Source Draft

This is the recommended authored shape for a future `monsters.json` entry once
actor seeding is expanded to support fully-authored embedded power items.

```yaml
name: Undead Base
type: character
img: icons/svg/mystery-man.svg
system:
  template: Tgs09eTiTp63Cp7u
  props:
    TypeDropdown: Undead
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
    Stats_IntelligenceDice: 1
    Stats_IntelligenceMod: 1
    Stats_FaithDice: 1
    Stats_FaithMod: 1
    Stats_CharismaDice: 1
    Stats_CharismaMod: 0
    Stats_PowerDice: 2
    Stats_PowerMod: 1
items:
  - Unpassed Dead rule feature
  - Bound by the Cause of Return rule feature
  - Grave Wrongness rule feature
  - Return Unbidden power
  - Touch of the Grave power
  - Presence of the Unquiet power
```

## Recommended Next Layer

The first layers to stack onto this base should distinguish the exact mode of
failed death and return, for example:

- `Restless Dead`
- `Ghost`
- `Unquiet Dead`
- `Living Dead`
- `Haunting`
- `Fetch`

Those should add the exact corporeality, anchor of return, domestic or grave
behavior, mode of manifestation, release condition, and subtype-specific powers
that the base intentionally leaves open.
