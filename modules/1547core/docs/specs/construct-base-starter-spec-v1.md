# Construct Base Starter Spec v1

This document defines a concrete first-pass content draft for the `Construct Base`
monster chassis.

It is intended as the reusable root actor for made beings such as golems,
homunculi, and similar artificial creatures formed by craft, rite, alchemy, or
inscribed animation before more specific domain, motivation, loadout, and quirk
ChangeSets are layered on top.

Constructs are not outsiders, spirits, or natural life gone wrong. They are
made things given force, motion, and purpose by human or nonhuman craft.
Whether shaped from clay, wax, metal, bone, stitched matter, or alchemical
substance, they exist because someone fashioned them to serve, guard, labor,
carry, observe, or obey.

## Design Goals

The base Construct should be:

- made rather than born
- animated by craft, inscription, alchemy, rite, or imposed force
- purposeful rather than instinctive
- distinct from `Unnatural`, which comes from another existence, by feeling artificial and fabricated
- distinct from `People`, which are mortal humans, by feeling built for function rather than ordinary social life
- broad enough to support golems, homunculi, animated guardians, laboratory things, and crafted servitors without yet being specialized into clay, metal, wax, stitched, alchemical, or miniature variants

It should feel like a being whose body and behavior have been designed,
assembled, or imposed for a task rather than grown into place by ordinary life.

Constructs are often fought as guardians or tools, but some should also support
uncanny domestic, scholarly, or workshop presences such as attendants,
watchers, or obedient little horrors.

## Base Stats

Recommended actor-side base values:

```yaml
TypeDropdown: Construct
MoveGround: 5
MoveFly: 0
MoveSwim: 0
MoveBurrow: 0
MoveClimb: 0

Stats_StrengthDice: 2
Stats_StrengthMod: 0
Stats_DexterityDice: 1
Stats_DexterityMod: 1
Stats_StaminaDice: 2
Stats_StaminaMod: 0
Stats_IntelligenceDice: 1
Stats_IntelligenceMod: 0
Stats_FaithDice: 1
Stats_FaithMod: 0
Stats_CharismaDice: 1
Stats_CharismaMod: 0
Stats_PowerDice: 2
Stats_PowerMod: 1
```

This corresponds to:

- good Strength
- low to moderate Dexterity
- good Stamina
- low Intelligence
- low Faith
- low Charisma
- strong Power

The stronger Power here represents animation, imposed vitality, and artificed
force rather than personality or spellcraft.

## Passive Rule Changes

These are the concrete passive changes the base monster should receive.

### Made Thing

```yaml
- _id: ConstructBaseMadeTag
  name: Construct Base - Made Thing Tag
  kind: Tag
  tagName: Artificial
  notes: The being is crafted, assembled, or shaped into existence rather than naturally born.

- _id: ConstructBaseMadeTrait
  name: Construct Base - Made Thing Trait
  kind: Trait
  traitName: Made Thing
  traitDescription: It is a fabricated being, produced by hands, tools, formulae, rite, or inscription rather than by ordinary generation.
  notes: Core identity trait for Constructs.
```

### Bound to Purpose

```yaml
- _id: ConstructBasePurposeTag
  name: Construct Base - Bound to Purpose Tag
  kind: Tag
  tagName: OathBound
  notes: The being exists to perform a function, obey a command, or maintain a task.

- _id: ConstructBasePurposeTrait
  name: Construct Base - Bound to Purpose Trait
  kind: Trait
  traitName: Bound to Purpose
  traitDescription: It is driven by command, inscription, design, or imprinted labor rather than by ordinary appetite, fear, kinship, or ambition.
  notes: Core directive trait for Constructs.
```

### Artificed Endurance

```yaml
- _id: ConstructBaseEnduranceTag
  name: Construct Base - Artificed Endurance Tag
  kind: Tag
  tagName: Durable
  notes: The being endures strain in an unnatural, mechanical, or fabricated way.

- _id: ConstructBaseEnduranceTrait
  name: Construct Base - Artificed Endurance Trait
  kind: Trait
  traitName: Artificed Endurance
  traitDescription: Its body bears force as crafted matter, stitched form, animated material, or reinforced shell rather than as ordinary flesh alone.
  notes: Core durability trait for Constructs.
```

## Granted Power Items

The base monster should own the following named powers.

### Obey the Imprint

Suggested power identity:

```yaml
name: Obey the Imprint
type: Power
description: The made being recommits to its shaping command, labor, or warding function.
```

Suggested primary usage effect:

```yaml
Description: The made being recommits to its shaping command, labor, or warding function.
ApplicationMode: CreateActiveEffect
EffectType: Protection
EffectSubtype: Momentum
Visible: true
TargetType: Self
TargetCount: "1"
TargetRange: "Self"
TargetFilter: ""
TargetDescription: The Construct itself.
CheckType: None
CheckFormula: ""
ResistanceType: ""
ResistanceFormula: ""
OnPartial: ""
OnFailure: ""
PayloadTarget: Task / directive / forward action
PayloadOperation: Apply
PayloadValue: Momentum
PayloadDice: ""
PayloadTag: ""
PayloadTraitName: ""
PayloadTraitText: ""
GrantedItemTemplate: ""
GrantedItemName: ""
PayloadNotes: Use for resuming a command, pressing a guard routine, continuing labor through harm, or acting with tireless imposed intent.
DurationType: Scene
DurationValue: ""
ExpiryTrigger: After the push resolves, the command ends, or the scene changes.
RemovalMethod: Counter-command, disruption of sigil, physical disablement
SuppressedBy: Broken control, erased inscription, command conflict
```

### Crafted Strike

Suggested power identity:

```yaml
name: Crafted Strike
type: Power
description: The being attacks with built force, shaped limb, tool-body, or unnatural precision.
```

Suggested primary usage effect:

```yaml
Description: The being attacks with built force, shaped limb, tool-body, or unnatural precision.
ApplicationMode: CreateActiveEffect
EffectType: Status
EffectSubtype: Weakened
Visible: true
TargetType: Actor
TargetCount: "1"
TargetRange: "Touch"
TargetFilter: ""
TargetDescription: A target within reach of the Construct's body, tool, claw, hand, or fashioned appendage.
CheckType: Contest
CheckFormula: source Strength or Power
ResistanceType: Stamina
ResistanceFormula: target Stamina
OnPartial: Target is struck, shoved, or rattled.
OnFailure: Target is solidly hit and weakened by artificed force.
PayloadTarget: Status
PayloadOperation: Apply
PayloadValue: Weakened
PayloadDice: ""
PayloadTag: ""
PayloadTraitName: ""
PayloadTraitText: ""
GrantedItemTemplate: ""
GrantedItemName: ""
PayloadNotes: Variants may style this as stone fist, iron grip, stitched claw, alchemical sting, or homunculus bite.
DurationType: Scene
DurationValue: ""
ExpiryTrigger: End of scene or recovery
RemovalMethod: Repair, treatment, rest
SuppressedBy: ""
```

Optional secondary direct-harm effect:

```yaml
Description: The attack inflicts direct bodily harm.
ApplicationMode: DirectDataChange
EffectType: Stat
EffectSubtype: Resource
Visible: true
TargetType: Actor
TargetCount: "1"
TargetRange: "Touch"
TargetDescription: A target struck by the Construct.
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

### Tireless Function

Suggested power identity:

```yaml
name: Tireless Function
type: Power
description: The being withdraws from confusion, pain, or panic and returns to task.
```

Suggested usage effect:

```yaml
Description: The being withdraws from confusion, pain, or panic and returns to task.
ApplicationMode: CreateActiveEffect
EffectType: Protection
EffectSubtype: Concealment
Visible: false
TargetType: Self
TargetCount: "1"
TargetRange: "Self"
TargetFilter: ""
TargetDescription: The Construct itself.
CheckType: None
CheckFormula: ""
ResistanceType: ""
ResistanceFormula: ""
OnPartial: ""
OnFailure: ""
PayloadTarget: Defense / repositioning / task continuity
PayloadOperation: Apply
PayloadValue: Concealed
PayloadDice: ""
PayloadTag: ""
PayloadTraitName: ""
PayloadTraitText: ""
GrantedItemTemplate: ""
GrantedItemName: ""
PayloadNotes: Use for bracing, absorbing impact, stepping back into formation, shielding its core, or continuing a routine without ordinary fear.
DurationType: Scene
DurationValue: ""
ExpiryTrigger: Re-engages openly, the task changes, or the scene ends.
RemovalMethod: Disablement, order-break, disassembly
SuppressedBy: Broken frame, shattered control, command disruption
```

## Concrete Starter Package

The `Construct Base` should therefore include:

- passive tag/trait changes:
  - `Made Thing`
  - `Bound to Purpose`
  - `Artificed Endurance`
- owned power items:
  - `Obey the Imprint`
  - `Crafted Strike`
  - `Tireless Function`

## Actor Source Draft

This is the recommended authored shape for a future `monsters.json` entry once
actor seeding is expanded to support fully-authored embedded power items.

```yaml
name: Construct Base
type: character
img: icons/svg/mystery-man.svg
system:
  template: Tgs09eTiTp63Cp7u
  props:
    TypeDropdown: Construct
    MoveGround: 5
    MoveFly: 0
    MoveSwim: 0
    MoveBurrow: 0
    MoveClimb: 0
    Stats_StrengthDice: 2
    Stats_StrengthMod: 0
    Stats_DexterityDice: 1
    Stats_DexterityMod: 1
    Stats_StaminaDice: 2
    Stats_StaminaMod: 0
    Stats_IntelligenceDice: 1
    Stats_IntelligenceMod: 0
    Stats_FaithDice: 1
    Stats_FaithMod: 0
    Stats_CharismaDice: 1
    Stats_CharismaMod: 0
    Stats_PowerDice: 2
    Stats_PowerMod: 1
items:
  - Made Thing rule feature
  - Bound to Purpose rule feature
  - Artificed Endurance rule feature
  - Obey the Imprint power
  - Crafted Strike power
  - Tireless Function power
```

## Recommended Next Layer

The next layer for `Construct` should now be authored through the shared
`Domain` catalog rather than through a construct-only specialization document.

The first `Domain` entries intended for `Construct` are:

- `Golem`
- `Homunculus`
- `Brazen Head`
- `Wax Servitor`

Those should be authored as `ForType_Construct` domain paths with additional
Requirements when a narrower body plan, obedience pattern, site logic, or maker
tradition needs to be enforced.

More legendary or learned-tradition expansions such as `Animated Statue`,
`Alchemical Servitor`, `Mandrake Homunculus`, `Clockwork Servitor`, or
`Bronze Guardian` can be added later if the family needs broader range.
