# Usage Effect Examples v1

This document gives concrete first-pass example records for common `UsageEffect`
authoring patterns in `1547Core`.

Each example is written against the current template fields in
`fvtt-Item-usageeffecttemplate-mwPqEYUoOfzXpyT9.json`.

## 1. Afraid

Use for monster auras, dreadful apparitions, or sudden supernatural shock.

```yaml
Description: "The target is overcome with fear and hesitates before the threat."
ApplicationMode: CreateActiveEffect
EffectType: Status
EffectSubtype: Afraid
Visible: true
TargetType: Actor
TargetCount: "1"
TargetRange: "2 squares"
TargetFilter: ""
TargetDescription: "Any mortal that enters the aura."
CheckType: Contest
CheckFormula: "monster Power"
ResistanceType: "Faith"
ResistanceFormula: "target Faith"
OnPartial: "Target suffers unease but is not fully Afraid."
OnFailure: "Target gains Afraid."
DetectionCheck: ""
PayloadTarget: "Status"
PayloadOperation: Apply
PayloadValue: "Afraid"
PayloadDice: ""
PayloadTag: ""
PayloadTraitName: ""
PayloadTraitText: ""
GrantedItemTemplate: ""
GrantedItemName: ""
PayloadNotes: "Use for fear-based penalties and hesitation."
DurationType: Scene
DurationValue: ""
ExpiryTrigger: "End of scene or source destroyed."
RemovalMethod: "Calm, miracle, or leaving the scene if the fiction allows."
SuppressedBy: ""
```

## 2. Ill Luck

Use for curse knots, witchery, malicious signs, or pact strain.

```yaml
Description: "The target suffers mounting misfortune on risky actions."
ApplicationMode: CreateActiveEffect
EffectType: Status
EffectSubtype: IllLuck
Visible: false
TargetType: Actor
TargetCount: "1"
TargetRange: "Touch or carried item"
TargetFilter: ""
TargetDescription: "A victim carrying the cursed knot or touched by the rite."
CheckType: Contest
CheckFormula: "caster Power"
ResistanceType: "Power"
ResistanceFormula: "target Power"
OnPartial: "Minor misfortune follows the target."
OnFailure: "Target gains Ill Luck."
DetectionCheck: "Faith or Occultism vs 3d6"
PayloadTarget: "Status"
PayloadOperation: Apply
PayloadValue: "Ill Luck"
PayloadDice: ""
PayloadTag: ""
PayloadTraitName: ""
PayloadTraitText: ""
GrantedItemTemplate: ""
GrantedItemName: ""
PayloadNotes: "Usually means extra risk, disadvantage, or GM complications."
DurationType: Days
DurationValue: "1d6"
ExpiryTrigger: ""
RemovalMethod: "Sanctify, break the knot, or lift the curse."
SuppressedBy: ""
```

## 3. Lost Faith

Use for doubt-inducing spells, corruptive miracles, or contact with blasphemous beings.

```yaml
Description: "The target's trust in faith and prayer is shaken."
ApplicationMode: CreateActiveEffect
EffectType: Status
EffectSubtype: LostFaith
Visible: false
TargetType: Actor
TargetCount: "1"
TargetRange: "Voice or gaze"
TargetFilter: ""
TargetDescription: "A believer, priest, or target relying on faith."
CheckType: Contest
CheckFormula: "caster Divination or Power"
ResistanceType: "Faith"
ResistanceFormula: "target Faith"
OnPartial: "Target becomes doubtful and hesitant."
OnFailure: "Target gains Lost Faith."
DetectionCheck: ""
PayloadTarget: "Status"
PayloadOperation: Apply
PayloadValue: "Lost Faith"
PayloadDice: ""
PayloadTag: ""
PayloadTraitName: ""
PayloadTraitText: ""
GrantedItemTemplate: ""
GrantedItemName: ""
PayloadNotes: "Use when faith-based acts become harder or spiritually unstable."
DurationType: Days
DurationValue: "1d6"
ExpiryTrigger: ""
RemovalMethod: "Confession, miracle, sanctification, or sincere repentance."
SuppressedBy: ""
```

## 4. Protected

Use for short-lived magical protection on a person.

```yaml
Description: "The target is protected against hostile supernatural influence."
ApplicationMode: CreateActiveEffect
EffectType: Status
EffectSubtype: Protected
Visible: true
TargetType: Actor
TargetCount: "1"
TargetRange: "Touch"
TargetFilter: ""
TargetDescription: "A willing target."
CheckType: None
CheckFormula: ""
ResistanceType: ""
ResistanceFormula: ""
OnPartial: ""
OnFailure: ""
DetectionCheck: ""
PayloadTarget: "Status"
PayloadOperation: Apply
PayloadValue: "Protected"
PayloadDice: ""
PayloadTag: ""
PayloadTraitName: ""
PayloadTraitText: ""
GrantedItemTemplate: ""
GrantedItemName: ""
PayloadNotes: "Protection may give bonus resistance or block a class of effect."
DurationType: Days
DurationValue: "1"
ExpiryTrigger: "Sunrise"
RemovalMethod: "Dispelling, blasphemy, or threshold breach if relevant."
SuppressedBy: "Direct contact with a stronger opposed force"
```

## 5. Threshold Ward

Use for a house, church door, barrow opening, or protected room.

```yaml
Description: "A protected threshold bars or warns against hostile crossing."
ApplicationMode: GrantItem
EffectType: Ward
EffectSubtype: Threshold
Visible: true
TargetType: Area
TargetCount: "1 threshold"
TargetRange: "Placed"
TargetFilter: ""
TargetDescription: "A doorway, gate, ford, or other crossing."
CheckType: None
CheckFormula: ""
ResistanceType: ""
ResistanceFormula: ""
OnPartial: ""
OnFailure: ""
DetectionCheck: "Threshold awareness or ward-sight as appropriate"
PayloadTarget: "Threshold"
PayloadOperation: Apply
PayloadValue: "Protected crossing"
PayloadDice: ""
PayloadTag: ""
PayloadTraitName: ""
PayloadTraitText: ""
GrantedItemTemplate: "WardAnchor"
GrantedItemName: "Threshold Ward"
PayloadNotes: "Crossing may require invitation, contest, or special bypass."
DurationType: UntilBroken
DurationValue: ""
ExpiryTrigger: "Ward line broken or ritual countered."
RemovalMethod: "Break line, remove anchor, counter-rite, or permission breach."
SuppressedBy: ""
```

## 6. Bind To Item

Use for charms, cursed vessels, bound demons, or enchanted tools.

```yaml
Description: "A being or force is anchored into an object."
ApplicationMode: Hybrid
EffectType: Binding
EffectSubtype: BindToItem
Visible: true
TargetType: Item
TargetCount: "1"
TargetRange: "Touch"
TargetFilter: ""
TargetDescription: "A prepared vessel, charm, mirror, doll, ring, or reliquary."
CheckType: Contest
CheckFormula: "caster Power"
ResistanceType: "Power"
ResistanceFormula: "bound entity Power"
OnPartial: "The entity is contained but unstable."
OnFailure: "Binding fails or the entity lashes out."
DetectionCheck: "Occultism vs 3d6"
PayloadTarget: "Binding"
PayloadOperation: Grant
PayloadValue: "Entity anchored to item"
PayloadDice: ""
PayloadTag: ""
PayloadTraitName: ""
PayloadTraitText: ""
GrantedItemTemplate: "BoundEntity"
GrantedItemName: "Bound Spirit"
PayloadNotes: "Use with a linked bound-entity or curse vessel record."
DurationType: UntilBroken
DurationValue: ""
ExpiryTrigger: "Vessel broken, seal undone, or true release performed."
RemovalMethod: "Exorcism, unbinding rite, destruction, or true-name release."
SuppressedBy: ""
```

## 7. Drive Out Possessor

Use for exorcism, prayer, sacred force, or true-name expulsions.

```yaml
Description: "A possessing force is forced out of the host."
ApplicationMode: Hybrid
EffectType: Possession
EffectSubtype: DriveOut
Visible: true
TargetType: Actor
TargetCount: "1"
TargetRange: "Touch or ritual circle"
TargetFilter: ""
TargetDescription: "A possessed host."
CheckType: Contest
CheckFormula: "caster Faith or Power"
ResistanceType: "Power"
ResistanceFormula: "possessor Power"
OnPartial: "The possessor is weakened or briefly suppressed."
OnFailure: "The possessor remains and may retaliate."
DetectionCheck: ""
PayloadTarget: "Possession"
PayloadOperation: Remove
PayloadValue: "Possessed"
PayloadDice: ""
PayloadTag: ""
PayloadTraitName: ""
PayloadTraitText: ""
GrantedItemTemplate: ""
GrantedItemName: ""
PayloadNotes: "Also clear or suppress the possessor relationship record if successful."
DurationType: Instant
DurationValue: ""
ExpiryTrigger: ""
RemovalMethod: ""
SuppressedBy: ""
```

## 8. Truth Pressure

Use for interrogation, curse, divine pressure, or social domination magic.

```yaml
Description: "The target finds deception difficult and truth easier to force out."
ApplicationMode: CreateActiveEffect
EffectType: Influence
EffectSubtype: TruthPressure
Visible: false
TargetType: Actor
TargetCount: "1"
TargetRange: "Voice"
TargetFilter: ""
TargetDescription: "A questioned or accused target."
CheckType: Contest
CheckFormula: "caster Faith, Divination, or Power"
ResistanceType: "Charisma or Faith"
ResistanceFormula: "target Charisma or Faith"
OnPartial: "Target becomes uneasy and evasive."
OnFailure: "Target is under Truth Pressure."
DetectionCheck: ""
PayloadTarget: "Honesty / social resistance"
PayloadOperation: Apply
PayloadValue: "Truth Pressure"
PayloadDice: ""
PayloadTag: ""
PayloadTraitName: ""
PayloadTraitText: ""
GrantedItemTemplate: ""
GrantedItemName: ""
PayloadNotes: "Use for harder lies, easier confession, or disadvantage on deceit."
DurationType: Scene
DurationValue: ""
ExpiryTrigger: "Questioning ends or scene closes."
RemovalMethod: "Blessing, silence, or withdrawal from the scene."
SuppressedBy: ""
```

## 9. Reveal True Name

Use for grimoire binding, exorcism preparation, or infernal research.

```yaml
Description: "The true name of the target is revealed."
ApplicationMode: NarrativeOnly
EffectType: Revelation
EffectSubtype: TrueName
Visible: true
TargetType: Actor
TargetCount: "1"
TargetRange: "Ritual target"
TargetFilter: ""
TargetDescription: "A spirit, demon, hidden being, or disguised supernatural."
CheckType: Contest
CheckFormula: "caster Occultism, Power, or Divination"
ResistanceType: "Power"
ResistanceFormula: "target Power"
OnPartial: "The caster gains a fragment, alias, or uncertain clue."
OnFailure: "No true name is learned."
DetectionCheck: ""
PayloadTarget: "Identity"
PayloadOperation: Reveal
PayloadValue: "True Name"
PayloadDice: ""
PayloadTag: ""
PayloadTraitName: ""
PayloadTraitText: ""
GrantedItemTemplate: ""
GrantedItemName: ""
PayloadNotes: "This grants knowledge, not a buff. Record it in notes or linked content."
DurationType: Permanent
DurationValue: ""
ExpiryTrigger: ""
RemovalMethod: ""
SuppressedBy: ""
```

## 10. Lead Astray

Use for Hidden Folk lures, glamour roads, forest spirits, or night-haunting guidance.

```yaml
Description: "The target loses the road or is drawn away from safety."
ApplicationMode: CreateActiveEffect
EffectType: Movement
EffectSubtype: LeadAstray
Visible: false
TargetType: Actor
TargetCount: "1"
TargetRange: "Sight, song, whisper, or path"
TargetFilter: ""
TargetDescription: "A traveller, child, lone sentry, or separated victim."
CheckType: Contest
CheckFormula: "source Power or Glamour"
ResistanceType: "Intelligence, Faith, or Survival"
ResistanceFormula: "target Intelligence, Faith, or Survival"
OnPartial: "Target becomes uncertain and delayed."
OnFailure: "Target loses direction or strays from the group."
DetectionCheck: ""
PayloadTarget: "Navigation / group cohesion"
PayloadOperation: Apply
PayloadValue: "Led Astray"
PayloadDice: ""
PayloadTag: ""
PayloadTraitName: ""
PayloadTraitText: ""
GrantedItemTemplate: ""
GrantedItemName: ""
PayloadNotes: "Can mean pathing penalty, separation, or arrival at a dangerous place."
DurationType: Scene
DurationValue: ""
ExpiryTrigger: "Daylight, blessing, regained bearings, or guide intervention."
RemovalMethod: "Holy sign, trusted guide, iron token, or dawn."
SuppressedBy: ""
```
