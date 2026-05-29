# Loadout Specializations Starter Spec v1

This document defines the shared authoring model for `Loadout` ChangeSets.

Unlike base-monster specs, this document is organized by slot type rather than
by monster family. Its purpose is to make `Loadout` reusable across compatible
families while still supporting explicit restrictions for loadouts that only fit
specific lineages.

It should be read alongside:

- `monster-creation-guide.md`
- `monster-maker-spec-v1.md`
- `domain-specializations-starter-spec-v1.md`
- family base specs such as `people-base-starter-spec-v1.md`,
  `beast-base-starter-spec-v1.md`, and `undead-base-starter-spec-v1.md`

## Purpose Of Loadout

`Loadout` is the slot that describes how a being is equipped, bodily arranged,
or practically prepared to act in a scene.

A good `Loadout` answers questions like:

- what kind of attack shape does this being bring?
- what kind of protection or vulnerability does it visibly carry?
- does it fight with tools, armor, natural force, mounted movement, or frail speed?
- what immediately changes about play when this version enters the scene?

`Loadout` is not:

- the creature's lineage
- the source of its power
- its full personality
- its deeper agenda

Those belong primarily to `TypeDropdown`, `Domain`, `Quirk`, and `Motivation`.

## Reuse Rule

The default design goal is:

- keep `Loadout` reusable across monster families when the concept remains clear

Examples:

- `Natural Weapons`
- `Heavy Body`
- `Armored`
- `Armed`
- `Mounted`
- `Ranged`
- `Grasping`
- `Swift Fragile`

These can mean different things for different families while still sharing one
loadout concept:

- `People + Armed` means ordinary weapons, shields, and human martial readiness
- `Undead + Armed` means grave-retained or battlefield-retained weapon use
- `Construct + Heavy Body` means mass, reinforced frame, and blunt force
- `Beast + Natural Weapons` means bite, claw, horn, tusk, or trampling shape

## Applicability Model

Every `Loadout` ChangeSet should explicitly declare whether it is:

1. cross-family
2. family-limited
3. subtype-limited within a family

### 1. Cross-family loadouts

Use this when the loadout concept is valid for multiple lineages.

Recommended authoring pattern:

```yaml
Group: Loadout
ForTypeAny: false
ForType_People: true
ForType_Undead: true
ForType_Construct: true
```

Then add Requirements only if the loadout needs extra structural constraints.

### 2. Family-limited loadouts

Use this when the loadout only makes sense for one base family.

Recommended authoring pattern:

```yaml
Group: Loadout
ForTypeAny: false
ForType_Beast: true
```

Examples:

- `Natural Weapons`
- `Half-Seen Body`
- `Impossible Bulk`

### 3. Subtype-limited loadouts

Use this when the loadout is legal for a family, but only for actors that
already carry some narrower identity.

Recommended authoring pattern:

```yaml
Group: Loadout
ForTypeAny: false
ForType_People: true
Requirements:
  - HasTag: SocialCreature
  - StatAtLeast: MoveGround >= 5
```

The exact predicates will vary, but the rule is consistent:

- use `ForType` for lineage eligibility
- use `Requirements` for narrower structural eligibility

Do not try to encode all nuance in the name of the ChangeSet.

## Requirements Guidance

Requirements on `Loadout` should answer:

- what must already be true for this fighting or bodily arrangement to make
  sense on this actor?

Good Requirement candidates:

- `HasTag`
  - example: a loadout that assumes `LivingCreature`, `Undead`, `Artificial`,
    `Mounted`, `NaturalWeapons`, or `SocialCreature`
- `StatAtLeast`
  - example: a heavy loadout that assumes enough Strength or Stamina
- `PrimaryStatAtLeast`
  - example: a precision-ranged loadout that assumes strong Dexterity
- `GroupPresent`
  - example: a loadout that only makes sense after a matching `Domain` or later
    slot has already been authored

Bad Requirement uses:

- replacing `ForType` with tag logic when lineage restriction is actually intended
- using `Loadout` to smuggle in a full personality or agenda
- using Requirements to fix a weak loadout concept that should be split instead

## Reuse Summary

To make authoring easier, every current loadout concept should be treated as one
of two things:

- `Shared across multiple bases`
  - the concept is intentionally reusable, even if each base still needs its
    own authored ChangeSet variant
- `Single-family only`
  - the concept is currently intended for one lineage only and should not be
    reused unless a broader version is later designed on purpose

Current reusable loadout concepts:

- `Heavy Body`
  - `Construct`
  - `Undead`
  - `Colossal`
- `Armed`
  - `People`
  - `Undead`
- `Armored`
  - `People`
  - `Undead`
  - `Construct`
- `Ranged`
  - `People`
  - `Construct`
  - `Unnatural`
- `Mounted`
  - `People`
  - `TheUnseen`
- `Swift Fragile`
  - `HiddenFolk`
  - `Construct`
  - `Cursed`
- `Grasping`
  - `Undead`
  - `Construct`
  - `ZoneColossus`

Current single-family loadout concepts:

- `Natural Weapons`
  - `Beast`
- `Half-Seen Body`
  - `Zone`
- `Impossible Bulk`
  - `ZoneColossus`
- `Tool-Body`
  - `Construct`
- `Corpse-Body`
  - `Undead`
- `Winged Horror`
  - `Colossal`

## Shared Loadout Catalog

### `Natural Weapons`

Allowed families:

```yaml
Group: Loadout
ForTypeAny: false
ForType_Beast: true
```

Authoring classification:

- `Family-specific only`

Recommended authored ChangeSet variants:

- `Natural Weapons (Beast)`

Use for:

- wolves
- bears
- boars
- great cats

Recommended expression:

- intended feel: body as weapon, animal directness, and no dependence on crafted gear
- passive rule ideas:
  - `NaturalWeapons` / `Built to Bite and Tear`
- stat ideas:
  - `Stats_StrengthMod +1`
- granted power ideas:
  - `Rending Bite`
  - `Tusk Gore`
  - `Trampling Rush`

### `Heavy Body`

Allowed families:

```yaml
Group: Loadout
ForTypeAny: false
ForType_Construct: true
ForType_Undead: true
ForType_Colossal: true
```

Authoring classification:

- `Shared concept, separate family variants recommended`

Recommended authored ChangeSet variants:

- `Heavy Body (Construct)`
- `Heavy Body (Undead)`
- `Heavy Body (Colossal)`

Recommended expressions:

- `Construct`
  - intended feel: reinforced frame, blunt force, and slow irresistible pressure
  - passive rule ideas:
    - `Durable` / `Reinforced Frame`
  - stat ideas:
    - `Stats_StaminaMod +1`
  - granted power ideas:
    - `Hammering Impact`

- `Undead`
  - intended feel: corpse-mass, grave weight, and unclean persistence
  - passive rule ideas:
    - `Undead` / `Carries Grave Weight`
  - stat ideas:
    - `Stats_StrengthMod +1`
  - granted power ideas:
    - `Drag Down`

- `Colossal`
  - intended feel: sheer catastrophic bulk rather than armor or agility
  - passive rule ideas:
    - `Massive` / `Weight of Ruin`
  - stat ideas:
    - `Stats_StrengthMod +1`
  - granted power ideas:
    - `Ground-Shaking Step`

### `Armed`

Allowed families:

```yaml
Group: Loadout
ForTypeAny: false
ForType_People: true
ForType_Undead: true
```

Authoring classification:

- `Shared concept, separate family variants recommended`

Recommended authored ChangeSet variants:

- `Armed (People)`
- `Armed (Undead)`

Recommended expressions:

- `People`
  - intended feel: practical weapons, discipline, and ordinary human combat readiness
  - passive rule ideas:
    - `SocialCreature` / `Carries the Tools of Violence`
  - stat ideas:
    - `Stats_DexterityMod +1`
  - granted power ideas:
    - `Shield Bash`
    - `Spear Thrust`
    - `Knife Work`

- `Undead`
  - intended feel: burial-retained arms, battlefield remnants, and dead hands still knowing violence
  - passive rule ideas:
    - `Undead` / `Dead Hand on the Hilt`
  - stat ideas:
    - `Stats_StrengthMod +1`
  - granted power ideas:
    - `Rusting Cut`
    - `Old Soldier's Reach`
    - `Strike from the Bier`

### `Armored`

Allowed families:

```yaml
Group: Loadout
ForTypeAny: false
ForType_People: true
ForType_Undead: true
ForType_Construct: true
```

Authoring classification:

- `Shared concept, separate family variants recommended`

Recommended authored ChangeSet variants:

- `Armored (People)`
- `Armored (Undead)`
- `Armored (Construct)`

Recommended expressions:

- `People`
  - intended feel: trained fighters, guarded vital points, and more confidence under pressure
  - passive rule ideas:
    - `Durable` / `Harness and Protection`
  - stat ideas:
    - `Stats_StaminaMod +1`
  - granted power ideas:
    - `Brace Behind Armor`

- `Undead`
  - intended feel: armor that remained after death, heavy and uncanny in its persistence
  - passive rule ideas:
    - `Undead` / `Mail of the Dead`
  - stat ideas:
    - `Stats_StaminaMod +1`
  - granted power ideas:
    - `Shrug the Blow`

- `Construct`
  - intended feel: plated shell, reinforced joints, and difficult-to-breach artificed protection
  - passive rule ideas:
    - `Artificial` / `Plated Construction`
  - stat ideas:
    - `Stats_StaminaMod +1`
  - granted power ideas:
    - `Turn the Edge`

### `Mounted`

Allowed families:

```yaml
Group: Loadout
ForTypeAny: false
ForType_People: true
ForType_TheUnseen: true
```

Authoring classification:

- `Shared concept, separate family variants recommended`

Recommended authored ChangeSet variants:

- `Mounted (People)`
- `Mounted (TheUnseen)`

Recommended expressions:

- `People`
  - intended feel: horseman, raider, messenger, or knight with speed and shock advantage
  - passive rule ideas:
    - `SocialCreature` / `Horse and Rider`
  - stat ideas:
    - `MoveGround +2`
  - granted power ideas:
    - `Ride Through`
    - `Lance the Line`

- `TheUnseen`
  - intended feel: impossible rider, hunt-rank, or sovereign mounted presence
  - passive rule ideas:
    - `Otherworldly` / `Rides Beyond the Safe Path`
  - stat ideas:
    - `MoveGround +2`
  - granted power ideas:
    - `Ride Them Down`
    - `Pass Without Hoofbeat`

### `Ranged`

Allowed families:

```yaml
Group: Loadout
ForTypeAny: false
ForType_People: true
ForType_Construct: true
ForType_Unnatural: true
```

Authoring classification:

- `Shared concept, separate family variants recommended`

Recommended authored ChangeSet variants:

- `Ranged (People)`
- `Ranged (Construct)`
- `Ranged (Unnatural)`

Recommended expressions:

- `People`
  - intended feel: bows, crossbows, stones, or thrown weapons handled by mortal skill
  - passive rule ideas:
    - `SocialCreature` / `Missile-Ready`
  - stat ideas:
    - `Stats_DexterityMod +1`
  - granted power ideas:
    - `Loose the Shot`
    - `Volley from Cover`

- `Construct`
  - intended feel: dart-projector, alchemical spitter, or made thing designed for distance attack
  - passive rule ideas:
    - `Artificial` / `Built for Projection`
  - stat ideas:
    - `Stats_PowerMod +1`
  - granted power ideas:
    - `Launch the Dart`
    - `Project the Sting`

- `Unnatural`
  - intended feel: distance-force expressed through command, radiance, fire, or spiritual assault
  - passive rule ideas:
    - `Otherworldly` / `Distance Means Little`
  - stat ideas:
    - `Stats_PowerMod +1`
  - granted power ideas:
    - `Judging Bolt`
    - `Cast the Temptation Afar`

### `Swift Fragile`

Allowed families:

```yaml
Group: Loadout
ForTypeAny: false
ForType_HiddenFolk: true
ForType_Construct: true
ForType_Cursed: true
```

Authoring classification:

- `Shared concept, separate family variants recommended`

Recommended authored ChangeSet variants:

- `Swift Fragile (HiddenFolk)`
- `Swift Fragile (Construct)`
- `Swift Fragile (Cursed)`

Recommended expressions:

- `HiddenFolk`
  - intended feel: quick, elusive, half-seen, and hard to pin down
  - passive rule ideas:
    - `Glamour` / `Too Quick to Hold`
  - stat ideas:
    - `Stats_DexterityMod +1`
  - granted power ideas:
    - `Slip Past the Gaze`

- `Construct`
  - intended feel: small made thing, quick assistant, thin frame, and low staying power
  - passive rule ideas:
    - `Artificial` / `Quick Little Servitor`
  - stat ideas:
    - `MoveGround +1`
    - `Stats_StaminaMod -1`
  - granted power ideas:
    - `Skitter Aside`

- `Cursed`
  - intended feel: transformed quickness, predatory reflex, and unstable speed
  - passive rule ideas:
    - `Cursed` / `Flesh Made Overquick`
  - stat ideas:
    - `Stats_DexterityMod +1`
  - granted power ideas:
    - `Lunge in a Blur`

### `Grasping`

Allowed families:

```yaml
Group: Loadout
ForTypeAny: false
ForType_Undead: true
ForType_Construct: true
ForType_ZoneColossus: true
```

Authoring classification:

- `Shared concept, separate family variants recommended`

Recommended authored ChangeSet variants:

- `Grasping (Undead)`
- `Grasping (Construct)`
- `Grasping (ZoneColossus)`

Recommended expressions:

- `Undead`
  - intended feel: dead hands, dragging grip, and refusal to let the living free
  - passive rule ideas:
    - `Undead` / `Hands That Do Not Release`
  - stat ideas:
    - `Stats_StrengthMod +1`
  - granted power ideas:
    - `Seize the Living`

- `Construct`
  - intended feel: designed manipulator limbs, clamp-hands, and tool-like holding force
  - passive rule ideas:
    - `Artificial` / `Built to Hold Fast`
  - stat ideas:
    - `Stats_StrengthMod +1`
  - granted power ideas:
    - `Clamp and Hold`

- `ZoneColossus`
  - intended feel: catastrophic grasp, crushing capture, and the horror of being taken by something too large to understand
  - passive rule ideas:
    - `Massive` / `The Grasp That Covers Ground`
  - stat ideas:
    - `Stats_PowerMod +1`
  - granted power ideas:
    - `Colossal Grasp`

## Loadout Authoring Checklist

When writing a new `Loadout` ChangeSet or spec entry, confirm:

1. What is the stable loadout concept?
2. What is its authoring classification?
3. Is it cross-family or family-limited?
4. Which `ForType_*` flags should be enabled?
5. Are extra Requirements needed?
6. What belongs in `Loadout` rather than `Domain`, `Quirk`, or `Motivation`?
7. How does the loadout express differently across allowed families?

## Recommended Initial Loadout Families

The first broadly reusable `Loadout` concepts should be:

- `Heavy Body`
- `Armed`
- `Armored`
- `Mounted`
- `Ranged`
- `Swift Fragile`
- `Grasping`

The first clearly family-limited examples should be:

- `Natural Weapons`
- `Half-Seen Body`
- `Impossible Bulk`
- `Tool-Body`
- `Corpse-Body`
- `Winged Horror`

## Recommended Next Step

After approving this model, the next documentation pass should:

1. create shared slot-based specs for `Quirk` and `Motivation`
2. move any family-specific overlay content into those slot specs as needed
3. continue extending shared slot catalogs so every base family is represented
   without reintroducing family-only specialization documents
