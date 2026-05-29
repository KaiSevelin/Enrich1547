# Nature Spirit Base Starter Spec v1

This document defines a concrete first-pass content draft for the `Nature Spirit Base`
monster chassis.

It is intended as the first reusable Nature Spirit root actor for beings such as
skogsra, dryads, river wives, land-wights, and place-bound trolls before more
specific domain, motivation, loadout, and quirk ChangeSets are layered on top.

## Design Goals

The base Nature Spirit should be:

- tied to a specific piece of nature
- stronger through place, presence, and natural influence than through social rank
- more often encountered as a guardian, warning, or luring danger than as an open combatant
- uncanny and dangerous without yet being specialized into forest, river, bog, stone, mountain, settlement, or corrupted variants
- able to bless, hinder, lure, or punish in ways that reflect the place it belongs to
- clearly distinct from `Hidden Folk` social-neighbor beings and `The Unseen` mythic sovereign beings

Its core identity is that it belongs to a natural seat: grove, spring, hill, cliff,
marsh, old tree, waterfall, cave mouth, farmstead, shrine, or similar place of
presence.

Nature Spirits are usually not roaming aggressors. They are place-bound
guardian beings that manifest to protect, warn away, or indirectly destroy
those who threaten their place. Open battle should usually feel like a late
stage of escalation after warning, trespass, desecration, or refusal to turn
back.

## Base Stats

Recommended actor-side base values:

```yaml
TypeDropdown: NatureSpirit
MoveGround: 5
MoveFly: 0
MoveSwim: 0
MoveBurrow: 0
MoveClimb: 1

Stats_StrengthDice: 1
Stats_StrengthMod: 1
Stats_DexterityDice: 1
Stats_DexterityMod: 2
Stats_StaminaDice: 2
Stats_StaminaMod: 0
Stats_IntelligenceDice: 1
Stats_IntelligenceMod: 1
Stats_FaithDice: 2
Stats_FaithMod: 1
Stats_CharismaDice: 1
Stats_CharismaMod: 2
Stats_PowerDice: 2
Stats_PowerMod: 0
```

This corresponds to:

- low to moderate Strength
- moderate Dexterity
- good Stamina
- low to moderate Intelligence
- strong Faith
- moderate to strong Charisma
- good Power

## Passive Rule Changes

These are the concrete passive changes the base monster should receive.

### Bound to Place

```yaml
- _id: NsBaseBoundToPlaceTag
  name: Nature Spirit Base - Bound to Place Tag
  kind: Tag
  tagName: PlaceBound
  notes: The being's nature and power are tied to a specific natural seat.

- _id: NsBaseBoundToPlaceTrait
  name: Nature Spirit Base - Bound to Place Trait
  kind: Trait
  traitName: Bound to Place
  traitDescription: It is tied to a natural seat such as a grove, spring, stone, marsh, or cliff, and is strongest when acting through or within that place.
  notes: Core identity trait for Nature Spirits.
```

### Warden of a Natural Seat

```yaml
- _id: NsBaseWardenTag
  name: Nature Spirit Base - Warden of a Natural Seat Tag
  kind: Tag
  tagName: ThresholdAware
  notes: The being reacts to trespass, damage, theft, pollution, and broken respect within its place.

- _id: NsBaseWardenTrait
  name: Nature Spirit Base - Warden of a Natural Seat Trait
  kind: Trait
  traitName: Warden of a Natural Seat
  traitDescription: It notices and reacts when its place is violated, neglected, polluted, despoiled, or treated without proper respect, and may answer respect with aid or trespass with warning, misdirection, or death.
  notes: Core reciprocity and guardianship rule for Nature Spirits.
```

### More Than Landscape

```yaml
- _id: NsBaseLandscapeTag
  name: Nature Spirit Base - More Than Landscape Tag
  kind: Tag
  tagName: UnsettlingPresence
  notes: The being is part of the place, but not merely scenery.

- _id: NsBaseLandscapeTrait
  name: Nature Spirit Base - More Than Landscape Trait
  kind: Trait
  traitName: More Than Landscape
  traitDescription: It can seem beautiful, monstrous, half-seen, or wholly natural until it chooses to reveal that the place itself is watching.
  notes: Tone-setting trait for local uncanny presence.
```

## Granted Power Items

The base monster should own the following named powers.

### Call of the Place

Suggested power identity:

```yaml
name: Call of the Place
type: Power
description: The being lures, warns, or unsettles through the voice and mood of its place.
```

Suggested primary usage effect:

```yaml
Description: The being lures, warns, or unsettles through the voice and mood of its place.
ApplicationMode: CreateActiveEffect
EffectType: Influence
EffectSubtype: Doubt
Visible: false
TargetType: Actor
TargetCount: "1"
TargetRange: "Sight, voice, or environmental presence"
TargetFilter: ""
TargetDescription: A mortal who lingers in, approaches, or disturbs the spirit's place.
CheckType: Contest
CheckFormula: source Power
ResistanceType: Faith or Intelligence
ResistanceFormula: target Faith or Intelligence
OnPartial: Target hesitates, loses certainty, or follows a false impression.
OnFailure: Target is lured, turned around, or drawn into danger.
PayloadTarget: Judgment / direction
PayloadOperation: Apply
PayloadValue: Doubt
PayloadDice: ""
PayloadTag: ""
PayloadTraitName: ""
PayloadTraitText: ""
GrantedItemTemplate: ""
GrantedItemName: ""
PayloadNotes: Use for path-twisting, fascination, beckoning voices, warning signs, or the sense that the land itself is guiding the target toward safety or death.
DurationType: Scene
DurationValue: ""
ExpiryTrigger: Leave the place, receive trustworthy guidance, or the spirit withdraws.
RemovalMethod: Trusted guidance, prayer, iron token, or clear landmark
SuppressedBy: ""
```

### Grasp of Root and Stone

Suggested power identity:

```yaml
name: Grasp of Root and Stone
type: Power
description: The place itself hinders, seizes, or throws down an intruder.
```

Suggested primary usage effect:

```yaml
Description: The place itself hinders, seizes, or throws down an intruder.
ApplicationMode: CreateActiveEffect
EffectType: Status
EffectSubtype: Restrained
Visible: true
TargetType: Actor
TargetCount: "1"
TargetRange: "Near the spirit's ground"
TargetFilter: ""
TargetDescription: A trespasser within the spirit's immediate domain.
CheckType: Contest
CheckFormula: source Power or Stamina
ResistanceType: Dexterity or Stamina
ResistanceFormula: target Dexterity or Stamina
OnPartial: Target stumbles, slows, or is briefly caught.
OnFailure: Target is restrained by root, mud, water, stone, or sudden terrain shift.
PayloadTarget: Status
PayloadOperation: Apply
PayloadValue: Restrained
PayloadDice: ""
PayloadTag: ""
PayloadTraitName: ""
PayloadTraitText: ""
GrantedItemTemplate: ""
GrantedItemName: ""
PayloadNotes: Domain variants can restyle this as roots, reeds, scree, bog-suction, river pull, grasping branches, yard-tools, fences, or household obstacles.
DurationType: Scene
DurationValue: ""
ExpiryTrigger: Escape, scene ends, or the spirit releases the target.
RemovalMethod: Force free, cut loose, sacred aid, or leaving the terrain
SuppressedBy: ""
```

### Slip Into the Land

Suggested power identity:

```yaml
name: Slip Into the Land
type: Power
description: The being vanishes into its natural seat or moves through it unnaturally.
```

Suggested usage effect:

```yaml
Description: The being vanishes into its natural seat or moves through it unnaturally.
ApplicationMode: CreateActiveEffect
EffectType: Protection
EffectSubtype: Concealment
Visible: false
TargetType: Self
TargetCount: "1"
TargetRange: "Self"
TargetFilter: ""
TargetDescription: The Nature Spirit itself.
CheckType: None
CheckFormula: ""
ResistanceType: ""
ResistanceFormula: ""
OnPartial: ""
OnFailure: ""
PayloadTarget: Detectability / movement
PayloadOperation: Apply
PayloadValue: Concealed
PayloadDice: ""
PayloadTag: ""
PayloadTraitName: ""
PayloadTraitText: ""
GrantedItemTemplate: ""
GrantedItemName: ""
PayloadNotes: Use for slipping behind trunks, into water, through reeds, under stone shadow, or into the presence of the place itself.
DurationType: Scene
DurationValue: ""
ExpiryTrigger: Reveals itself, attacks openly, or leaves meaningful cover from its place.
RemovalMethod: Fire, desecration, forced exposure, or leaving the natural seat
SuppressedBy: In barren or fully exposed ground away from its natural seat
```

### Optional: Blessing of the Place

Suggested power identity:

```yaml
name: Blessing of the Place
type: Power
description: The spirit grants aid, safe passage, or vitality to one who honors its place.
```

Suggested usage effect:

```yaml
Description: The spirit grants aid, safe passage, or vitality to one who honors its place.
ApplicationMode: CreateActiveEffect
EffectType: Status
EffectSubtype: Blessed
Visible: true
TargetType: Actor
TargetCount: "1"
TargetRange: "Touch, gift, water, shade, or spoken favor"
TargetFilter: ""
TargetDescription: A mortal or creature shown favor within the spirit's place.
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
PayloadNotes: Hostile or offended variants can swap Blessed for Cursed or Sickened.
DurationType: Days
DurationValue: "1d6"
ExpiryTrigger: ""
RemovalMethod: Favor exhausted, offense committed, or place left behind
SuppressedBy: ""
```

## Concrete Starter Package

The `Nature Spirit Base` should therefore include:

- passive tag/trait changes:
  - `Bound to Place`
  - `Warden of a Natural Seat`
  - `More Than Landscape`
- owned power items:
  - `Call of the Place`
  - `Grasp of Root and Stone`
  - `Slip Into the Land`
  - optional `Blessing of the Place`

## Actor Source Draft

This is the recommended authored shape for a future `monsters.json` entry once
actor seeding is expanded to support fully-authored embedded power items.

```yaml
name: Nature Spirit Base
type: character
img: icons/svg/mystery-man.svg
system:
  template: Tgs09eTiTp63Cp7u
  props:
    TypeDropdown: NatureSpirit
    MoveGround: 5
    MoveFly: 0
    MoveSwim: 0
    MoveBurrow: 0
    MoveClimb: 1
    Stats_StrengthDice: 1
    Stats_StrengthMod: 1
    Stats_DexterityDice: 1
    Stats_DexterityMod: 2
    Stats_StaminaDice: 2
    Stats_StaminaMod: 0
    Stats_IntelligenceDice: 1
    Stats_IntelligenceMod: 1
    Stats_FaithDice: 2
    Stats_FaithMod: 1
    Stats_CharismaDice: 1
    Stats_CharismaMod: 2
    Stats_PowerDice: 2
    Stats_PowerMod: 0
items:
  - Bound to Place rule feature
  - Warden of a Natural Seat rule feature
  - More Than Landscape rule feature
  - Call of the Place power
  - Grasp of Root and Stone power
  - Slip Into the Land power
  - optional Blessing of the Place power
```

## Recommended Next Layer

The first domain sets to stack onto this base should define the spirit's natural
seat, for example:

- `Forest`
- `River`
- `Bog`
- `Stone` or `Hill`
- `Mountain`
- `Settlement` or `Farmstead`
- `Corrupted` or `Severed`

Those should add the stronger visual identity, exact movement profile, specific
taboos, vulnerabilities, blessings, and punitive folklore behavior that the base
intentionally leaves open.
