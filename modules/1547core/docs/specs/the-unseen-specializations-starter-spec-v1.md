# The Unseen Specializations Starter Spec v1

This document defines the first specialization layer for `The Unseen Base`.

These are not full unique beings yet. They are reusable overlays that turn the
base chassis toward a recognizable mythic office or courtly role.

Each specialization is intended to sit above:

- `The Unseen Base`

and below:

- unique names
- personal motives
- retinues
- relics
- unique boons/curses

## Overview

Recommended first specialization set:

- `Courtly Sovereign`
- `Water Sovereign`
- `Hunt Master`
- `Smokeless Fire`
- `Winter Matron`

These cover:

- Sidhe nobles
- Lady of the Lake
- Erlking / Wild Hunt leader
- Jinn
- Frau Holle

## 1. Courtly Sovereign

Use for:

- sidhe nobles
- fairy kings and queens
- barrow-court royalty
- lords and ladies of the hollow hill

### Intended feel

- beautiful and terrible
- impossible etiquette
- dangerous generosity
- commands obedience without haste

### Added passive rules

```yaml
- ChangeType: RuleFeature
  Operation: Add
  TagKey: Glamour
  TraitName: Courtly Radiance
  TraitText: Mortal judgment is disturbed by beauty, rank, and ceremonial presence.
  Visible: true
  DurationType: Permanent

- ChangeType: RuleFeature
  Operation: Add
  TagKey: OfferingBound
  TraitName: Gift for Gift
  TraitText: Offerings, gifts, and breaches of etiquette carry unusual force in its presence.
  Visible: true
  DurationType: Permanent
```

### Added stat changes

```yaml
- ChangeType: Stat
  Target: Stats_CharismaMod
  Operation: Add
  Value: 1
```

### Granted powers

- `Courtly Favor`
  - use `Influence / SocialFavor`
- `Withering Courtesy`
  - use `Influence / Shame` or `Status / Cursed`

## 2. Water Sovereign

Use for:

- Lady of the Lake
- river queens
- ford maidens of high rank
- mist-and-depth rulers

### Intended feel

- beautiful, distant, reflective
- tied to vows, gifts, and crossings
- blessing and drowning close together

### Added passive rules

```yaml
- ChangeType: RuleFeature
  Operation: Add
  TagKey: WaterBound
  TraitName: Of Depth and Crossing
  TraitText: Its power is greatest near still water, crossings, and reflected surfaces.
  Visible: true
  DurationType: Permanent

- ChangeType: RuleFeature
  Operation: Add
  TagKey: ThresholdAware
  TraitName: Keeper of the Ford
  TraitText: Crossings, vows, and the passage from one shore to another matter deeply to it.
  Visible: true
  DurationType: Permanent
```

### Added stat changes

```yaml
- ChangeType: Stat
  Target: MoveSwim
  Operation: Override
  Value: 6
```

### Granted powers

- `Drowning Summons`
  - use `Movement / DragUnder`
- `Gift from the Water`
  - use `Status / Blessed`
- `Mirror Revelation`
  - use `Revelation / Identity` or `Revelation / Prophecy`

## 3. Hunt Master

Use for:

- Erlking
- leader of the Wild Hunt
- spectral riders of rank
- lords of pursuit and seizure

### Intended feel

- relentless
- mounted or accompanied
- hard to flee once marked
- brings sound, weather, and panic with him

### Added passive rules

```yaml
- ChangeType: RuleFeature
  Operation: Add
  TagKey: FearAura
  TraitName: Heard Before Seen
  TraitText: The sound of the hunt and the knowledge of pursuit can break mortal nerve before the being arrives.
  Visible: true
  DurationType: Permanent

- ChangeType: RuleFeature
  Operation: Add
  TagKey: SenseLiving
  TraitName: Hunter of the Living
  TraitText: It is difficult to hide life, warmth, or panic from the master of the hunt.
  Visible: true
  DurationType: Permanent
```

### Added stat changes

```yaml
- ChangeType: Stat
  Target: MoveGround
  Operation: Add
  Value: 2
```

### Granted powers

- `Mark the Quarry`
  - use `Status / Marked`
- `Ride Them Down`
  - use `Movement / Pull` or `Movement / LeadAstray`
- `Cry of the Hunt`
  - use `Influence / Fear`

## 4. Smokeless Fire

Use for:

- jinn
- desert and ruin spirits of rank
- beings of heat, smoke, bargain, and invisible fire

### Intended feel

- proud
- swift in bargaining
- dangerous in offense and promise
- able to pass between seen and unseen states

### Added passive rules

```yaml
- ChangeType: RuleFeature
  Operation: Add
  TagKey: FireVulnerable
  TraitName: Fire That Answers Fire
  TraitText: Heat, flame, and smokeless burning are part of its nature and may also expose its weakness.
  Visible: true
  DurationType: Permanent

- ChangeType: RuleFeature
  Operation: Add
  TagKey: NameBound
  TraitName: Bound in the Naming
  TraitText: True naming and formal address carry unusual force in dealings with it.
  Visible: true
  DurationType: Permanent
```

### Added stat changes

```yaml
- ChangeType: Stat
  Target: Stats_PowerMod
  Operation: Add
  Value: 1
```

### Granted powers

- `Smoke Passage`
  - use `Movement / Phase`
- `Burning Bargain`
  - use `Binding / BindByOath`
- `Breath of Cinders`
  - use `Status / Weakened` or direct HP loss

## 5. Winter Matron

Use for:

- Frau Holle
- winter queens
- spinners of snow, sleep, and household judgment
- rulers of harsh blessing and domestic consequence

### Intended feel

- maternal and terrible
- judges work, order, and household conduct
- sleep, snow, and reward are entangled

### Added passive rules

```yaml
- ChangeType: RuleFeature
  Operation: Add
  TagKey: HearthBound
  TraitName: Judge of House and Labor
  TraitText: Household order, spinning, bread, snow, and proper labor fall under her eye.
  Visible: true
  DurationType: Permanent

- ChangeType: RuleFeature
  Operation: Add
  TagKey: DreamIntrusion
  TraitName: Touches the Sleeping
  TraitText: Sleep and dream are easy roads for her favor and displeasure.
  Visible: true
  DurationType: Permanent
```

### Added stat changes

```yaml
- ChangeType: Stat
  Target: Stats_FaithMod
  Operation: Add
  Value: 1
```

### Granted powers

- `Snow Blessing`
  - use `Status / Blessed`
- `Winter Sleep`
  - use `Status / SleepTouched`
- `Household Judgment`
  - use `Influence / Shame` or `Status / Cursed`

## Recommended Grouping

These can be authored as:

- `Domain` ChangeSets if you want them to represent the source of power

or:

- a separate `Office` or `Rank` group if you want `The Unseen` to have a more
  specialized hierarchy than ordinary monsters

If you keep the current monster-maker groups unchanged, I recommend treating
these as `Domain` sets for now.

## Recommended Next Step

After choosing one specialization, add:

- one `Motivation`
- one `Loadout`
- one `Quirk`
- one or more named powers or relics

That is where:

- the Lady of the Lake becomes distinct from a lesser water sovereign
- the Erlking becomes distinct from another hunt ruler
- a named sidhe queen becomes distinct from another courtly sovereign
