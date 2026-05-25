# Change Carrier Examples v1

This document gives concrete examples of how `ChangeSet`, `Change`, granted items,
and `UsageEffect` should fit together.

The examples are conceptual records intended to guide content authoring.

## 0. RuleFeature

Use this when a passive rule wants to be authored once but land as both a tag
and visible trait text.

### Example

```yaml
ChangeType: RuleFeature
Operation: Add
TagKey: SunlightSensitive
TraitName: Fades in Direct Sunlight
TraitText: In direct sunlight the creature loses concealment and becomes easier to resist.
Visible: true
DurationType: Permanent
RemovalMethod: ""
SuppressedBy: ""
```

### Normalized result

```yaml
- ChangeType: Tag
  Operation: Add
  Value: SunlightSensitive

- ChangeType: Trait
  Operation: Add
  Name: Fades in Direct Sunlight
  Text: In direct sunlight the creature loses concealment and becomes easier to resist.
```

## 1. Fear Aura

### ChangeSet

- Name: `Dreadful Presence`
- Purpose: grants a passive fear rule plus the actual fear pulse

### Changes

```yaml
- ChangeType: Tag
  Operation: Add
  Value: FearAura

- ChangeType: Trait
  Operation: Add
  Name: Dreadful Presence
  Text: Mortals who enter the creature's presence may lose their nerve.

- ChangeType: ItemGrant
  GrantSubtype: GrantPowerItem
  TemplateId: w9ky0ZTDvXDs5Ce7
  ItemName: Fear Aura Pulse
```

### Granted item

- Type: `Power`
- Name: `Fear Aura Pulse`

### UsageEffect on granted item

```yaml
ApplicationMode: CreateActiveEffect
EffectType: Status
EffectSubtype: Afraid
TargetType: Actor
TargetRange: "2 squares"
CheckType: Contest
CheckFormula: "source Power"
ResistanceType: Faith
ResistanceFormula: "target Faith"
PayloadTarget: Status
PayloadOperation: Apply
PayloadValue: Afraid
DurationType: Scene
```

## 2. Lead Astray

### ChangeSet

- Name: `Path Whispering`
- Purpose: grants a wood- or glamour-based misdirection power

### Changes

```yaml
- ChangeType: Tag
  Operation: Add
  Value: Glamour

- ChangeType: Trait
  Operation: Add
  Name: Path Whispering
  Text: The creature may draw travellers off the true road.

- ChangeType: ItemGrant
  GrantSubtype: GrantActionItem
  TemplateId: w9ky0ZTDvXDs5Ce7
  ItemName: Lead Astray
```

### Granted item

- Type: `Power`
- Name: `Lead Astray`

### UsageEffect on granted item

```yaml
ApplicationMode: CreateActiveEffect
EffectType: Movement
EffectSubtype: LeadAstray
TargetType: Actor
CheckType: Contest
CheckFormula: "source Power"
ResistanceType: "Intelligence or Faith"
ResistanceFormula: "target Intelligence or Faith"
PayloadTarget: "Navigation / group cohesion"
PayloadOperation: Apply
PayloadValue: "Led Astray"
DurationType: Scene
ExpiryTrigger: "Daylight, regained bearings, or holy guidance"
```

## 3. Night Riding

### ChangeSet

- Name: `Night Rider's Gift`
- Purpose: grants access to a ritual through a boon, bloodline, or pact

### Changes

```yaml
- ChangeType: Trait
  Operation: Add
  Name: Night Rider's Gift
  Text: The bearer may enter the dreams of others by night.

- ChangeType: ItemGrant
  GrantSubtype: GrantSpell
  TemplateId: 2kiWw3Cv5Zk1lZxn
  ItemName: Night Riding
```

### Granted item

- Type: `Spell`
- Name: `Night Riding`

### Example UsageEffect on spell

```yaml
ApplicationMode: Hybrid
EffectType: Possession
EffectSubtype: DreamRiding
TargetType: Actor
TargetDescription: "A sleeping target"
CheckType: Contest
CheckFormula: "caster Power"
ResistanceType: Faith
ResistanceFormula: "target Faith"
PayloadTarget: "Dream contact / nightmare intrusion"
PayloadOperation: Apply
PayloadValue: "Sleep-Touched"
DurationType: Night
ExpiryTrigger: "Dawn or awakening"
```

## 4. Devil's Errand

### ChangeSet

- Name: `Infernal Errand`
- Purpose: attaches a bargain-driven obligation after a failed rite

### Changes

```yaml
- ChangeType: Trait
  Operation: Add
  Name: Infernal Claim
  Text: A supernatural being has laid an errand upon the victim.

- ChangeType: ItemGrant
  GrantSubtype: GrantPact
  TemplateId: HPYYc2P0Ouagicmr
  ItemName: Devil's Errand
```

### Granted item

- Type: `Pact`
- Name: `Devil's Errand`

### Example UsageEffects on pact

#### Strain effect

```yaml
ApplicationMode: CreateActiveEffect
EffectType: Status
EffectSubtype: IllLuck
TargetType: PactBearer
PayloadTarget: Status
PayloadOperation: Apply
PayloadValue: Ill Luck
DurationType: Days
DurationValue: "1"
ExpiryTrigger: "The errand is advanced"
```

#### Broken progression effect

```yaml
ApplicationMode: DirectDataChange
EffectType: Stat
EffectSubtype: Resource
TargetType: PactBearer
PayloadTarget: HP
PayloadOperation: Decrease
PayloadValue: "1"
DurationType: Instant
```

## 5. Small Direct UsageEffect Carrier

This is the rare case where `GrantUsageEffect` could be used instead of granting
an item.

### Example

- Name: `Minor Omen Rider`

```yaml
- ChangeType: ItemGrant
  GrantSubtype: GrantUsageEffect
  EffectRef: "Omen Sign"
  Trigger: "Arriving at a new place"
  SourceLabel: "Living Omen"
```

Use this only when:

- the outcome is very small
- it does not need a named item
- it is not a signature spell, pact, or monster action

## Additional RuleFeature Examples

### Threshold Bound

```yaml
ChangeType: RuleFeature
Operation: Add
TagKey: ThresholdBound
TraitName: Cannot Cross Unbidden
TraitText: The creature may not cross a protected threshold without leave or a successful bypass.
Visible: true
DurationType: Permanent
```

### Cold Iron Vulnerability

```yaml
ChangeType: RuleFeature
Operation: Add
TagKey: ColdIronVulnerable
TraitName: Shrinks from Cold Iron
TraitText: Cold iron bypasses its ordinary protections and inflicts greater harm.
Visible: true
DurationType: Permanent
```

### Fear Aura Tag Only

```yaml
ChangeType: RuleFeature
Operation: Add
TagKey: FearAura
```

### Flavor Trait Only

```yaml
ChangeType: RuleFeature
Operation: Add
TraitName: Near but Not Friendly
TraitText: It lives beside human life and tests mortals before acting openly.
Visible: true
DurationType: Permanent
```
