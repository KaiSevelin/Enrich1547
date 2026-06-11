# Spirit Base Starter Spec v1

**Status: Draft — under discussion.** First-pass content draft for a new `Spirit Base`
monster chassis and a new `Spirit` monster type.

This document defines the reusable root actor for **bodiless afflicting beings** —
fever-spirits, wasting-spirits, unclean and foul spirits, the malice that rides bad air,
bad water, and the breath of the sick. Their defining role is that they **cause disease**:
in the world of 1547, a spirit is **one of the three causes of sickness**, alongside
**unbalanced bodily humours** and **miasma** (corrupt air).

## Positioning (how Spirit differs from neighbouring types)

- **The Unseen** — singular, sovereign elder powers (Jinn, the Erlking). *Spirit is the
  opposite*: usually anonymous, minor, and many.
- **Nature Spirit** — place-bound guardians tied to a grove, spring, or hill. *Spirit has
  no seat*: it intrudes, clings, and moves on.
- **Undead** — the restless dead. A Spirit is not a returned person; it is a bodiless
  affliction. (A grave may *breed* sickness-spirits, but they are not the dead themselves.)

## Design assumptions (flagged for correction)

These shape the whole chassis — confirm or redirect before the power blocks are filled in:

1. **Bodiless / Incorporeal.** A Spirit has no body. Ordinary weapons pass through it; it
   is reached only by wards, naming, holy force, cleansing, and exorcism. (Makes the ward
   system matter, and makes Spirits a "you can't just stab it" threat.)
2. **Intruder, not combatant.** Its threat is affliction, not melee — it enters through
   breath, open wounds, water, sleep, and unclean air.
3. **Often minor and numerous**, not singular.
4. **Disease is its signature** — the chassis exists primarily to be the spirit *cause* in
   the three-cause sickness model.

## Design Goals

The base Spirit should be:

- bodiless and hard to harm by ordinary means
- an intruder that enters through breath, wound, water, sleep, and foul air
- an afflicter whose signature is sowing disease, fever, and wasting rather than open battle
- gathered in miasma — foul air, stagnant water, corpses, filth — and weakened by clean air,
  salt, iron, threshold, and cleansing
- countered by wards, naming, holy protection, and exorcism rather than blades
- clearly one of the three causes of sickness (spirit / humoral imbalance / miasma)

## Base Stats

Recommended actor-side base values (incorporeal — physical stats are deliberately weak,
Power and elusiveness carry it):

```yaml
TypeDropdown: Spirit
MoveGround: 4
MoveFly: 4
MoveSwim: 0
MoveBurrow: 0
MoveClimb: 0

Stats_StrengthDice: 0
Stats_StrengthMod: 0
Stats_DexterityDice: 2
Stats_DexterityMod: 1
Stats_StaminaDice: 1
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

This corresponds to: no physical strength, elusive, frail in body but immune to ordinary
harm, modestly clever, good occult Power.

## Passive Rule Changes

### Bodiless

```yaml
- _id: SpiritBaseBodilessTag
  name: Spirit Base - Bodiless Tag
  kind: Tag
  tagName: Incorporeal
  notes: Has no body; ordinary weapons pass through it.

- _id: SpiritBaseBodilessTrait
  name: Spirit Base - Bodiless
  kind: Trait
  traitName: Bodiless
  traitDescription: The spirit has no flesh. Physical attacks pass through it harmlessly; it is reached only by wards, true names, holy force, cleansing, and exorcism.
  notes: Core "cannot be stabbed" rule. Pairs with DamageImmunity to physical sources.
```

### Sickness-Bringer

```yaml
- _id: SpiritBaseSicknessTag
  name: Spirit Base - Sickness-Bringer Tag
  kind: Tag
  tagName: DiseaseBringer
  notes: One of the three causes of sickness in 1547 (spirit / humour / miasma).

- _id: SpiritBaseSicknessTrait
  name: Spirit Base - Sickness-Bringer
  kind: Trait
  traitName: Sickness-Bringer
  traitDescription: Its touch, breath, or lingering presence sows disease. Sickness it causes is cured by exorcism, warding, and cleansing — not by humoral medicine or by fleeing foul air.
  notes: Defines the cure-path that distinguishes spirit-caused disease from humoral and miasmic disease.
```

### Intruder

```yaml
- _id: SpiritBaseIntruderTag
  name: Spirit Base - Intruder Tag
  kind: Tag
  tagName: ThresholdBarred
  notes: Hindered or barred by salt, iron, and warded thresholds.

- _id: SpiritBaseIntruderTrait
  name: Spirit Base - Intruder
  kind: Trait
  traitName: Intruder
  traitDescription: It enters through breath, open wounds, water, sleep, and unclean air. Salt, iron, a warded threshold, and clean observance hinder or bar it.
  notes: Ties the spirit to the ward/border system and to the miasma cause.
```

### Of Foul Air

```yaml
- _id: SpiritBaseMiasmaTag
  name: Spirit Base - Of Foul Air Tag
  kind: Tag
  tagName: Miasmic
  notes: Gathers in and is strengthened by miasma.

- _id: SpiritBaseMiasmaTrait
  name: Spirit Base - Of Foul Air
  kind: Trait
  traitName: Of Foul Air
  traitDescription: It gathers where the air is foul — sickrooms, stagnant water, corpses, and filth — and is weakened by clean air, smoke, fire, and cleansing.
  notes: Links the spirit cause to the miasma cause; the two often appear together.
```

## Granted Power Items

### Afflict (signature)

```yaml
name: Afflict
type: Power
description: The spirit sows sickness in a living body.
Description: The spirit's touch, breath, or presence sows disease in a living body.
ApplicationMode: CreateActiveEffect
EffectType: Status
EffectSubtype: Diseased
Visible: true
TargetType: Actor
TargetCount: "1"
TargetRange: Breath, touch, shared water or air
CheckType: Contest
CheckFormula: source Power
ResistanceType: Stamina
ResistanceFormula: target Stamina
OnPartial: The target sickens lightly — Diseased for a single day.
OnFailure: The target falls ill — Diseased until cured.
PayloadTarget: Status
PayloadOperation: Apply
PayloadValue: Diseased
DurationType: UntilBroken
RemovalMethod: Exorcism, warding, or cleansing — not humoral medicine
PayloadNotes: This is the spirit cause of disease. The disease subsystem decides severity and progression.
```

### Ride the Breath

```yaml
name: Ride the Breath
type: Power
description: The spirit enters and clings to a host.
Description: The spirit slips inside on a breath, a wound, or a dream and clings within.
ApplicationMode: CreateActiveEffect
EffectType: Possession
EffectSubtype: AttachSpirit
Visible: false
TargetType: Actor
TargetCount: "1"
TargetRange: Breath, wound, or sleep
CheckType: Contest
CheckFormula: source Power
ResistanceType: Faith
ResistanceFormula: target Faith
OnPartial: The spirit clings but is weak — it may be shaken off with rest, salt, or prayer.
OnFailure: The spirit lodges within and must be driven out by exorcism.
PayloadTarget: Possession
PayloadOperation: Apply
PayloadValue: Attached spirit
DurationType: UntilBroken
RemovalMethod: Exorcism (Possession / DriveOut), strong ward, or cleansing
PayloadNotes: A lodged sickness-spirit typically also keeps Afflict active each day until expelled.
```

### Wasting Touch

```yaml
name: Wasting Touch
type: Power
description: The spirit draws the strength from a living body.
Description: Where it lingers, vigour ebbs and the body wastes.
ApplicationMode: CreateActiveEffect
EffectType: Status
EffectSubtype: Weakened
Visible: true
TargetType: Actor
TargetCount: "1"
TargetRange: Presence
CheckType: Contest
CheckFormula: source Power
ResistanceType: Stamina
ResistanceFormula: target Stamina
OnPartial: Weakened for the scene.
OnFailure: Weakened until the spirit is gone.
PayloadTarget: Status
PayloadOperation: Apply
PayloadValue: Weakened
DurationType: Scene
RemovalMethod: Remove the spirit, then rest
PayloadNotes: Pairs with Afflict; the wasting is the visible face of the unseen disease.
```

## Defences and counters

A Spirit is reached and removed by, not fought with:

- **Wards** — `Ward / AntiSpirit`, salt, iron, warded thresholds (the border system).
- **Exorcism** — `Possession / DriveOut` expels a lodged spirit.
- **Cleansing & clean air** — weakens or banishes it; counters the miasma it rides.
- **Naming / holy force** — binds or repels it.

It should carry `Protection / DamageImmunity` (or a `DefenseTag`) against ordinary physical
damage to back up the Bodiless trait.

## Concrete Starter Package

- passive tag/trait changes: `Bodiless`, `Sickness-Bringer`, `Intruder`, `Of Foul Air`
- owned power items: `Afflict`, `Ride the Breath`, `Wasting Touch`
- physical damage immunity to support `Bodiless`

## Actor Source Draft

```yaml
name: Spirit Base
type: character
img: icons/svg/aura.svg
system:
  template: Tgs09eTiTp63Cp7u
  props:
    TypeDropdown: Spirit
    MoveGround: 4
    MoveFly: 4
    Stats_StrengthDice: 0
    Stats_StrengthMod: 0
    Stats_DexterityDice: 2
    Stats_DexterityMod: 1
    Stats_StaminaDice: 1
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
  - Bodiless trait + physical damage immunity
  - Sickness-Bringer rule feature
  - Intruder rule feature
  - Of Foul Air rule feature
  - Afflict power
  - Ride the Breath power
  - Wasting Touch power
```

## Recommended Next Layer

Specializations to stack onto this base:

- `Fever Spirit` — heat, delirium, fast onset
- `Wasting Spirit` — slow decline, consumption
- `Plague Spirit` — contagious, spreads between hosts
- `Madness Spirit` — affliction of the mind rather than the body
- `Drowned / Water Spirit of Sickness` — carried in foul or stagnant water
- `Grave-Bred Spirit` — bred from unclean death (overlaps Undead's domain)

## Wiring and connections

- **Type enum** — add `Spirit = Spirit` to the monster `TypeDropdown`
  (`fvtt-Actor-1547-...json`). (`NatureSpirit` and `Cursed` are also pending there.)
- **Disease model** — this chassis is the *spirit* cause in the three-cause sickness model
  (spirit / humoral imbalance / miasma). The next document should define disease severity,
  progression, and the three distinct cure-paths (exorcism+cleansing for spirit; medicine
  +diet for humoral; clean air+flight for miasma).
- **Status reuse** — `Afflict` and `Wasting Touch` apply the now-formalized `Diseased` and
  `Weakened` conditions (status-effects-guide).
- **Open**: whether `Spirit` also becomes a fifth ritual *entity nature* (so a failed rite
  can loose a sickness-spirit), or stays purely a monster type. Currently the four ritual
  natures are the Unseen / Undead / Unnatural / Nature Spirits.
```
