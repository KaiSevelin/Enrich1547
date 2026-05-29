# Cursed Base Starter Spec v1

This document defines a concrete first-pass content draft for the `Cursed Base`
monster chassis.

It is intended as the reusable root actor for beings transformed by curse,
magic, corruption, or violation of natural order, such as werewolves,
basilisks, and similar altered creatures before more specific domain,
motivation, loadout, and quirk ChangeSets are layered on top.

Cursed beings are defined by magical transformation. Something living, or
something once living, has been remade by curse, witchcraft, malediction,
blasphemous rite, or corrupt generation into a monstrous state. The family
center is not merely suffering under a curse, but having been made into
something else by magic.

## Design Goals

The base Cursed should be:

- transformed by magic rather than born into its present state
- dangerous through altered body, altered appetite, curse-work, contagion, or monstrous capability
- marked by imposed change rather than by outsider origin or failed death alone
- distinct from `Beast`, which is natural, by carrying the sense that magic has remade the creature's nature
- distinct from `Undead` by centering magical transformation rather than death that failed to end properly
- broad enough to support werewolves, basilisks, witch-made animals, strigoi-like transformed dead, and similar beings without yet being specialized into lunar, venomous, petrifying, bestial, or familiar variants

It should feel like a creature folklore would explain as having been made wrong
by witchcraft, malediction, blasphemy, or corrupt generation rather than by
ordinary nature.

## Base Stats

Recommended actor-side base values:

```yaml
TypeDropdown: Cursed
MoveGround: 5
MoveFly: 0
MoveSwim: 0
MoveBurrow: 0
MoveClimb: 0

Stats_StrengthDice: 2
Stats_StrengthMod: 0
Stats_DexterityDice: 1
Stats_DexterityMod: 2
Stats_StaminaDice: 2
Stats_StaminaMod: 0
Stats_IntelligenceDice: 1
Stats_IntelligenceMod: 1
Stats_FaithDice: 1
Stats_FaithMod: 0
Stats_CharismaDice: 1
Stats_CharismaMod: 0
Stats_PowerDice: 2
Stats_PowerMod: 0
```

This corresponds to:

- good Strength
- moderate Dexterity
- good Stamina
- low to moderate Intelligence
- low Faith
- low Charisma
- good Power

## Passive Rule Changes

These are the concrete passive changes the base monster should receive.

### Twisted From Rightful Shape

```yaml
- _id: CursedBaseTwistedTag
  name: Cursed Base - Twisted From Rightful Shape Tag
  kind: Tag
  tagName: Cursed
  notes: The being has been altered from its proper form or condition.

- _id: CursedBaseTwistedTrait
  name: Cursed Base - Twisted From Rightful Shape Trait
  kind: Trait
  traitName: Twisted From Rightful Shape
  traitDescription: It bears a condition forced by curse, corruption, punishment, or magical distortion rather than by ordinary nature.
  notes: Core identity trait for Cursed beings.
```

### Instability of Form or Will

```yaml
- _id: CursedBaseInstabilityTag
  name: Cursed Base - Instability of Form or Will Tag
  kind: Tag
  tagName: UnsettlingPresence
  notes: The being is marked by visible wrongness, volatility, or pressure on mind and body.

- _id: CursedBaseInstabilityTrait
  name: Cursed Base - Instability of Form or Will Trait
  kind: Trait
  traitName: Instability of Form or Will
  traitDescription: Its body, appetite, senses, or judgment may be unstable, overdriven, or bent toward an imposed condition that is difficult to master.
  notes: Core volatility trait for Cursed beings.
```

### Carries the Curse Forward

```yaml
- _id: CursedBaseContagionTag
  name: Cursed Base - Carries the Curse Forward Tag
  kind: Tag
  tagName: Corruptive
  notes: Contact with the being may spread, deepen, or awaken harmful transformation.

- _id: CursedBaseContagionTrait
  name: Cursed Base - Carries the Curse Forward Trait
  kind: Trait
  traitName: Carries the Curse Forward
  traitDescription: Harm, gaze, blood, bite, venom, or proximity to the creature may transmit its condition, worsen an existing taint, or impose a lesser version of its corruption.
  notes: Core transmission and consequence trait for Cursed beings.
```

## Granted Power Items

The base monster should own the following named powers.

### Violent Transformation

Suggested power identity:

```yaml
name: Violent Transformation
type: Power
description: The magical transformation expresses itself in a sudden burst of altered strength, speed, or monstrous form.
```

Suggested primary usage effect:

```yaml
Description: The magical transformation expresses itself in a sudden burst of altered strength, speed, or monstrous form.
ApplicationMode: CreateActiveEffect
EffectType: Protection
EffectSubtype: Momentum
Visible: true
TargetType: Self
TargetCount: "1"
TargetRange: "Self"
TargetFilter: ""
TargetDescription: The Cursed being itself.
CheckType: None
CheckFormula: ""
ResistanceType: ""
ResistanceFormula: ""
OnPartial: ""
OnFailure: ""
PayloadTarget: Transformation / violent surge
PayloadOperation: Apply
PayloadValue: Momentum
PayloadDice: ""
PayloadTag: ""
PayloadTraitName: ""
PayloadTraitText: ""
GrantedItemTemplate: ""
GrantedItemName: ""
PayloadNotes: Use for bestial surge, sudden monstrous speed, reptilian motion, grotesque unfolding, or the transformed state breaking through restraint.
DurationType: Scene
DurationValue: ""
ExpiryTrigger: After the surge resolves or the scene changes.
RemovalMethod: ""
SuppressedBy: Restraint, ward, exhaustion, or suppression rite
```

### Curse-Borne Attack

Suggested power identity:

```yaml
name: Curse-Borne Attack
type: Power
description: The creature's strike carries not only harm but the force of what magic has made it become.
```

Suggested primary usage effect:

```yaml
Description: The creature's strike carries not only harm but the force of what magic has made it become.
ApplicationMode: CreateActiveEffect
EffectType: Status
EffectSubtype: Weakened
Visible: true
TargetType: Actor
TargetCount: "1"
TargetRange: "Touch or gaze"
TargetFilter: ""
TargetDescription: A target struck by the Cursed being's body, venom, bite, claw, or curse-laden contact.
CheckType: Contest
CheckFormula: source Strength or Power
ResistanceType: Stamina
ResistanceFormula: target Stamina
OnPartial: Target is shaken, pained, or tainted.
OnFailure: Target is weakened by bodily harm, venom, corruption, or curse pressure.
PayloadTarget: Status
PayloadOperation: Apply
PayloadValue: Weakened
PayloadDice: ""
PayloadTag: ""
PayloadTraitName: ""
PayloadTraitText: ""
GrantedItemTemplate: ""
GrantedItemName: ""
PayloadNotes: Variants may style this as fang, claw, basilisk gaze, corruptive touch, venomous bite, toad-poison, or familiar-marking contact.
DurationType: Scene
DurationValue: ""
ExpiryTrigger: End of scene or recovery
RemovalMethod: Treatment, antidote, blessing, rest
SuppressedBy: ""
```

Optional secondary direct-harm effect:

```yaml
Description: The attack inflicts direct physical or magical harm.
ApplicationMode: DirectDataChange
EffectType: Stat
EffectSubtype: Resource
Visible: true
TargetType: Actor
TargetCount: "1"
TargetRange: "Touch or gaze"
TargetDescription: A target exposed to the Cursed being's violence.
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

### Curse Pressure

Suggested power identity:

```yaml
name: Curse Pressure
type: Power
description: The being's transformed state exerts fear, fascination, revulsion, or contaminating pressure on others.
```

Suggested usage effect:

```yaml
Description: The being's transformed state exerts fear, fascination, revulsion, or contaminating pressure on others.
ApplicationMode: CreateActiveEffect
EffectType: Influence
EffectSubtype: Fear
Visible: true
TargetType: Actor
TargetCount: "1"
TargetRange: "Sight or felt presence"
TargetFilter: ""
TargetDescription: A mortal or lesser being that directly confronts the Cursed creature.
CheckType: Contest
CheckFormula: source Power
ResistanceType: Faith or Stamina
ResistanceFormula: target Faith or Stamina
OnPartial: Target hesitates, recoils, or feels dread of contamination.
OnFailure: Target is overcome by fear, revulsion, or curse-haunted panic.
PayloadTarget: Status
PayloadOperation: Apply
PayloadValue: Afraid
PayloadDice: ""
PayloadTag: ""
PayloadTraitName: ""
PayloadTraitText: ""
GrantedItemTemplate: ""
GrantedItemName: ""
PayloadNotes: Variants may shift toward petrifying awe, blood-fear, moon-dread, beast-dread, or dread of witch-made contamination.
DurationType: Scene
DurationValue: ""
ExpiryTrigger: Leave the presence, regain nerve, or the scene changes.
RemovalMethod: Rally, blessing, distance, proof of safety
SuppressedBy: ""
```

## Concrete Starter Package

The `Cursed Base` should therefore include:

- passive tag/trait changes:
  - `Twisted From Rightful Shape`
  - `Instability of Form or Will`
  - `Carries the Curse Forward`
- owned power items:
  - `Violent Transformation`
  - `Curse-Borne Attack`
  - `Curse Pressure`

## Actor Source Draft

This is the recommended authored shape for a future `monsters.json` entry once
actor seeding is expanded to support fully-authored embedded power items.

```yaml
name: Cursed Base
type: character
img: icons/svg/mystery-man.svg
system:
  template: Tgs09eTiTp63Cp7u
  props:
    TypeDropdown: Cursed
    MoveGround: 5
    MoveFly: 0
    MoveSwim: 0
    MoveBurrow: 0
    MoveClimb: 0
    Stats_StrengthDice: 2
    Stats_StrengthMod: 0
    Stats_DexterityDice: 1
    Stats_DexterityMod: 2
    Stats_StaminaDice: 2
    Stats_StaminaMod: 0
    Stats_IntelligenceDice: 1
    Stats_IntelligenceMod: 1
    Stats_FaithDice: 1
    Stats_FaithMod: 0
    Stats_CharismaDice: 1
    Stats_CharismaMod: 0
    Stats_PowerDice: 2
    Stats_PowerMod: 0
items:
  - Twisted From Rightful Shape rule feature
  - Instability of Form or Will rule feature
  - Carries the Curse Forward rule feature
  - Violent Transformation power
  - Curse-Borne Attack power
  - Curse Pressure power
```

## Recommended Next Layer

The first layers to stack onto this base should distinguish the kind of magical
transformation and how it manifests, for example:

- `Bestial Curse`
- `Petrifying Curse`
- `Venomous Curse`
- `Moon-Bound Curse`
- `Familiar Transformation`
- `Monstrous Generation`

Those should add the exact rite or curse-source, transformed body plan, weakness,
spread logic, folkloric signs, tragic or predatory behavior, and
subtype-specific powers that the base intentionally leaves open.
