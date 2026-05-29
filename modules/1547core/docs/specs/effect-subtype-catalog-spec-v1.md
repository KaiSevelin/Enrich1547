# Effect Subtype Catalog Spec v1

This document defines the first controlled vocabulary for `UsageEffect.EffectSubtype`.

## Purpose

`EffectType` answers what kind of outcome is being authored.

`EffectSubtype` answers the narrower gameplay pattern within that type.

Subtypes should stay:

- reusable
- narrow enough for automation later
- broad enough to work for monsters, powers, spells, and pacts

## Authoring Rule

- Use only values from this catalog unless a subtype is explicitly marked `freeform`.
- Prefer the smallest reusable subtype over a highly specific one-off label.
- Put named conditions, tags, or traits in payload fields, not in the subtype itself.

Example:

- good: `Status / Cursed`
- bad: `Status / WitheringKnotVictim`

## Status

Use for temporary or current conditions affecting a target.

Allowed subtypes:

- `Afraid`
- `Blessed`
- `Charmed`
- `Confused`
- `Cursed`
- `Diseased`
- `Dominated`
- `Doomed`
- `Friendly`
- `Hidden`
- `IllLuck`
- `Inspired`
- `LostFaith`
- `Marked`
- `Possessed`
- `Protected`
- `Restless`
- `Revealed`
- `Silenced`
- `SleepTouched`
- `TruthBound`
- `Weakened`
- `Wounded`

## Stat

Use when changing numeric sheet values.

Allowed subtypes:

- `ActorStat`
- `PrimaryStat`
- `Resource`
- `Movement`
- `Threshold`
- `Derived`

Notes:

- Use `PayloadTarget` to name the actual field, such as `MoveGround`, `HP`, or `Power`.

## Tag

Use when adding, removing, suppressing, or revealing machine-readable rule facts.

Allowed subtypes:

- `BindingTag`
- `ConditionTag`
- `DefenseTag`
- `InfluenceTag`
- `NatureTag`
- `PerceptionTag`
- `VulnerabilityTag`

Notes:

- Use `PayloadTag` for the actual tag key, such as `SunlightSensitive`.

## Trait

Use when the effect applies readable rule text or a visible magical feature.

Allowed subtypes:

- `BlessingText`
- `CurseText`
- `MonsterFeature`
- `PactTerm`
- `PassiveRule`
- `VisibleTell`

## Grant

Use when the effect gives the target a content object.

Allowed subtypes:

- `Action`
- `BoundEntity`
- `ConditionItem`
- `Pact`
- `Power`
- `Spell`
- `WardAnchor`

## Ward

Use when the effect creates, strengthens, weakens, or detects a protective magical boundary.

Allowed subtypes:

- `Alarm`
- `AntiDemon`
- `AntiPossession`
- `AntiSpirit`
- `Barrier`
- `Proof`
- `Reflection`
- `Sanctuary`
- `Seal`
- `Threshold`

## Binding

Use when the effect compels, anchors, or contains an entity, oath, or relationship.

Allowed subtypes:

- `AnchorSpirit`
- `BindByName`
- `BindByOath`
- `BindToActor`
- `BindToItem`
- `BindToPlace`
- `CompelService`
- `ContainEntity`

## Possession

Use when the effect relates to inhabiting, resisting, or transferring control of a body or vessel.

Allowed subtypes:

- `AttachSpirit`
- `DriveOut`
- `DreamRiding`
- `FullControl`
- `ShieldFromPossession`
- `SuppressPossessor`
- `TransferPossessor`

## Influence

Use when the effect alters emotions, judgment, desire, obedience, or social stance.

Allowed subtypes:

- `Calm`
- `Doubt`
- `Fear`
- `Forgetfulness`
- `Love`
- `Obedience`
- `Rage`
- `Shame`
- `Sleep`
- `SocialFavor`
- `Suggestion`
- `Temptation`
- `TruthPressure`

## Revelation

Use when the effect reveals hidden truth, memory, location, cause, or omen.

Allowed subtypes:

- `CauseOfCurse`
- `DreamMessage`
- `Identity`
- `Location`
- `Memory`
- `ObjectHistory`
- `Omen`
- `PastEvent`
- `Prophecy`
- `SpiritSight`
- `TrueName`

## Movement

Use when the effect changes position, pathing, or freedom of motion.

Allowed subtypes:

- `DragUnder`
- `Grounded`
- `Immobilize`
- `LeadAstray`
- `Phase`
- `PhaseTravel`
- `Pull`
- `Push`
- `Slow`
- `Teleport`

## Transformation

Use when the effect changes what a being, body, or object is rather than only
applying a temporary condition.

Allowed subtypes:

- `Object`
- `Other`
- `Self`

## Protection

Use when the effect directly protects a target without primarily being a place-bound ward.

Allowed subtypes:

- `Concealment`
- `ConditionImmunity`
- `DamageImmunity`
- `DamageResistance`
- `SafePassage`
- `SanctifiedGuard`
- `WardBypass`

## Remove

Use when the effect strips away an existing state, bond, or magical condition.

Allowed subtypes:

- `Binding`
- `Blessing`
- `Curse`
- `Disease`
- `Oath`
- `PactStrain`
- `Possession`
- `Status`
- `Tag`
- `Trait`
- `Ward`

## Descriptive

Use when the outcome is fictional, sensory, or omen-like and does not need strong mechanical targeting.

Allowed subtypes:

- `Dream`
- `Light`
- `Manifestation`
- `Mark`
- `Omen`
- `Smell`
- `Trace`
- `Voice`
- `Weather`

## Recommended First-Pass Combinations

Common pairings for this module:

- `Status / Possessed`
- `Status / IllLuck`
- `Status / LostFaith`
- `Influence / Sleep`
- `Tag / VulnerabilityTag`
- `Trait / VisibleTell`
- `Grant / Spell`
- `Ward / Threshold`
- `Binding / BindToItem`
- `Possession / DriveOut`
- `Influence / TruthPressure`
- `Revelation / TrueName`
- `Revelation / PastEvent`
- `Movement / LeadAstray`
- `Movement / PhaseTravel`
- `Protection / DamageResistance`
- `Remove / Curse`
- `Transformation / Self`
- `Transformation / Object`
- `Descriptive / Omen`

## Default Effect Meanings

This section gives each subtype a default gameplay meaning, typical application
mode, typical duration, and the payload fields most likely to matter.

### Status

| Type | Subtype | Default effect meaning | Typical application mode | Typical duration | Typical payload fields |
| --- | --- | --- | --- | --- | --- |
| Status | Afraid | Target suffers fear penalties and may hesitate to engage. | CreateActiveEffect | Scene | `PayloadValue`, `OnFailure`, `DurationType` |
| Status | Blessed | Target gains a favorable sacred or supernatural condition. | CreateActiveEffect | Scene to Days | `PayloadValue`, `PayloadNotes` |
| Status | Charmed | Target becomes favorably disposed or compliant. | CreateActiveEffect | Scene to Days | `PayloadValue`, `ResistanceFormula` |
| Status | Confused | Target misjudges actions, allies, or surroundings. | CreateActiveEffect | Scene | `PayloadValue`, `OnPartial` |
| Status | Cursed | Target is under an active harmful magical condition. | CreateActiveEffect | Days to UntilBroken | `PayloadValue`, `RemovalMethod` |
| Status | Diseased | Target is carrying an active disease state. | CreateActiveEffect | Days to Weeks | `PayloadValue`, `RemovalMethod` |
| Status | Dominated | Target is forced into obedience or direct control. | CreateActiveEffect | Scene to UntilBroken | `PayloadValue`, `ResistanceFormula` |
| Status | Doomed | Target is marked for worsening misfortune or death. | CreateActiveEffect | Days to Permanent | `PayloadValue`, `ExpiryTrigger` |
| Status | Friendly | Target treats source as ally or favorable contact. | CreateActiveEffect | Scene to Days | `PayloadValue` |
| Status | Hidden | Target becomes harder to perceive or identify. | CreateActiveEffect | Scene | `PayloadValue`, `DetectionCheck` |
| Status | IllLuck | Target suffers misfortune on risky actions. | CreateActiveEffect | Days | `PayloadValue`, `DurationValue` |
| Status | Inspired | Target gains confidence, resolve, or spiritual force. | CreateActiveEffect | Scene to Days | `PayloadValue` |
| Status | LostFaith | Target struggles to rely on belief, prayer, or faith practice. | CreateActiveEffect | Days to UntilBroken | `PayloadValue`, `RemovalMethod` |
| Status | Marked | Target bears an active mystical sign relevant in play. | CreateActiveEffect or DirectDataChange | Days to Permanent | `PayloadValue`, `Visible` |
| Status | Possessed | A foreign entity is inhabiting or influencing the target. | Hybrid | Scene to UntilBroken | `PayloadValue`, `GrantedItemName`, `RemovalMethod` |
| Status | Protected | Target is under active magical protection. | CreateActiveEffect | Scene to Days | `PayloadValue`, `SuppressedBy` |
| Status | Restless | Target cannot settle, sleep well, or remain calm. | CreateActiveEffect | Scene to Days | `PayloadValue` |
| Status | Revealed | Hidden nature, disguise, or concealment is broken. | CreateActiveEffect | Scene | `PayloadValue`, `ExpiryTrigger` |
| Status | Silenced | Target is prevented from speech, prayer, or naming. | CreateActiveEffect | Scene | `PayloadValue` |
| Status | SleepTouched | Target is disturbed, influenced, or contacted through sleep. | CreateActiveEffect | Night to Days | `PayloadValue` |
| Status | TruthBound | Target finds deceit difficult or impossible. | CreateActiveEffect | Scene to Days | `PayloadValue`, `ResistanceFormula` |
| Status | Weakened | Target suffers broad physical or supernatural impairment. | CreateActiveEffect | Scene to Days | `PayloadValue`, `PayloadDice` |
| Status | Wounded | Target carries a non-instant ongoing injury state. | CreateActiveEffect | Scene to Days | `PayloadValue`, `RemovalMethod` |

### Stat

| Type | Subtype | Default effect meaning | Typical application mode | Typical duration | Typical payload fields |
| --- | --- | --- | --- | --- | --- |
| Stat | ActorStat | A named numeric actor field changes. | DirectDataChange or CreateActiveEffect | Instant to Permanent | `PayloadTarget`, `PayloadOperation`, `PayloadValue` |
| Stat | PrimaryStat | A core ladder stat changes. | DirectDataChange or CreateActiveEffect | Scene to Permanent | `PayloadTarget`, `PayloadValue` |
| Stat | Resource | A pool such as HP, stamina, or faith changes. | DirectDataChange | Instant to Days | `PayloadTarget`, `PayloadDice`, `PayloadValue` |
| Stat | Movement | A movement value changes. | DirectDataChange or CreateActiveEffect | Scene to Permanent | `PayloadTarget`, `PayloadValue` |
| Stat | Threshold | A defensive or contest threshold changes. | CreateActiveEffect | Scene to Days | `PayloadTarget`, `PayloadValue` |
| Stat | Derived | A computed or secondary number changes. | CreateActiveEffect | Scene to Days | `PayloadTarget`, `PayloadValue` |

### Tag

| Type | Subtype | Default effect meaning | Typical application mode | Typical duration | Typical payload fields |
| --- | --- | --- | --- | --- | --- |
| Tag | BindingTag | Adds or removes a tag tied to folklore law or magical bonds. | DirectDataChange | Days to Permanent | `PayloadTag`, `RemovalMethod` |
| Tag | ConditionTag | Adds or removes a tag tied to a current rule condition. | CreateActiveEffect or DirectDataChange | Scene to Days | `PayloadTag` |
| Tag | DefenseTag | Changes a target's defensive rule facts. | DirectDataChange or CreateActiveEffect | Scene to Permanent | `PayloadTag`, `SuppressedBy` |
| Tag | InfluenceTag | Changes a target's social or supernatural influence hooks. | DirectDataChange | Days to Permanent | `PayloadTag` |
| Tag | NatureTag | Alters what kind of being something is treated as. | DirectDataChange | Permanent | `PayloadTag` |
| Tag | PerceptionTag | Changes detection, sight, or awareness rule facts. | DirectDataChange or CreateActiveEffect | Scene to Permanent | `PayloadTag` |
| Tag | VulnerabilityTag | Adds or removes a weakness rule fact. | DirectDataChange | Days to Permanent | `PayloadTag`, `RemovalMethod` |

### Trait

| Type | Subtype | Default effect meaning | Typical application mode | Typical duration | Typical payload fields |
| --- | --- | --- | --- | --- | --- |
| Trait | BlessingText | Adds readable text for a beneficial magical condition. | DirectDataChange | Days to Permanent | `PayloadTraitName`, `PayloadTraitText` |
| Trait | CurseText | Adds readable text for a harmful magical condition. | DirectDataChange | Days to Permanent | `PayloadTraitName`, `PayloadTraitText` |
| Trait | MonsterFeature | Adds readable text for a monster rule or nature. | DirectDataChange | Permanent | `PayloadTraitName`, `PayloadTraitText` |
| Trait | PactTerm | Adds readable text for an oath, demand, or pact rule. | DirectDataChange | UntilBroken | `PayloadTraitName`, `PayloadTraitText` |
| Trait | PassiveRule | Adds explanatory text for an always-on rules element. | DirectDataChange | Permanent | `PayloadTraitName`, `PayloadTraitText` |
| Trait | VisibleTell | Adds readable text for a visible sign, stain, or omen-mark. | DirectDataChange | Days to Permanent | `PayloadTraitName`, `PayloadTraitText`, `Visible` |

### Grant

| Type | Subtype | Default effect meaning | Typical application mode | Typical duration | Typical payload fields |
| --- | --- | --- | --- | --- | --- |
| Grant | Action | Grants a discrete usable action or monster feature. | GrantItem | Scene to Permanent | `GrantedItemTemplate`, `GrantedItemName` |
| Grant | BoundEntity | Grants a bound spirit, demon, or linked entity record. | GrantItem | UntilBroken | `GrantedItemTemplate`, `GrantedItemName` |
| Grant | ConditionItem | Grants a persistent condition as an ownable item. | GrantItem | Days to Permanent | `GrantedItemTemplate`, `GrantedItemName` |
| Grant | Pact | Grants a pact item or pact-derived content object. | GrantItem | UntilBroken | `GrantedItemTemplate`, `GrantedItemName` |
| Grant | Power | Grants a power item. | GrantItem | Days to Permanent | `GrantedItemTemplate`, `GrantedItemName` |
| Grant | Spell | Grants a spell item. | GrantItem | WhileConditionHolds to Permanent | `GrantedItemTemplate`, `GrantedItemName`, `ExpiryTrigger` |
| Grant | WardAnchor | Grants an item that anchors a ward to a thing or place. | GrantItem | UntilBroken | `GrantedItemTemplate`, `GrantedItemName` |

### Ward

| Type | Subtype | Default effect meaning | Typical application mode | Typical duration | Typical payload fields |
| --- | --- | --- | --- | --- | --- |
| Ward | Alarm | A boundary or object warns when disturbed. | GrantItem or CreateActiveEffect | Days to UntilBroken | `PayloadValue`, `DetectionCheck` |
| Ward | AntiDemon | Protects against demonic approach, influence, or entry. | CreateActiveEffect or GrantItem | Scene to UntilBroken | `PayloadValue`, `SuppressedBy` |
| Ward | AntiPossession | Prevents or hinders inhabitation by a spirit or demon. | CreateActiveEffect | Scene to Days | `PayloadValue`, `ResistanceFormula` |
| Ward | AntiSpirit | Protects against spirits and similar beings. | CreateActiveEffect or GrantItem | Scene to UntilBroken | `PayloadValue` |
| Ward | Barrier | Creates a magical line, shell, or crossing limit. | GrantItem or NarrativeOnly | Scene to UntilBroken | `PayloadValue`, `ExpiryTrigger` |
| Ward | Proof | Marks whether a document, chamber, or object has been disturbed. | GrantItem or NarrativeOnly | Days to UntilBroken | `PayloadValue` |
| Ward | Reflection | Turns a curse, influence, or hostile magic back on its source. | CreateActiveEffect | Scene to Days | `PayloadValue`, `OnFailure` |
| Ward | Sanctuary | Makes a target or zone harder to touch with hostile magic. | CreateActiveEffect or GrantItem | Scene to Days | `PayloadValue`, `SuppressedBy` |
| Ward | Seal | Holds something shut, contained, or inaccessible. | GrantItem | UntilBroken | `PayloadValue`, `RemovalMethod` |
| Ward | Threshold | Creates or strengthens a protective threshold. | GrantItem or NarrativeOnly | UntilBroken | `PayloadValue`, `ExpiryTrigger` |

### Binding

| Type | Subtype | Default effect meaning | Typical application mode | Typical duration | Typical payload fields |
| --- | --- | --- | --- | --- | --- |
| Binding | AnchorSpirit | Holds a spirit in a constrained state or host. | Hybrid | UntilBroken | `GrantedItemName`, `RemovalMethod` |
| Binding | BindByName | Compels or anchors through a true name. | Hybrid | Scene to UntilBroken | `PayloadValue`, `ResistanceFormula` |
| Binding | BindByOath | Compels through sworn obligation. | Hybrid | UntilBroken | `PayloadValue`, `PayloadTraitText` |
| Binding | BindToActor | Attaches an entity, force, or obligation to a person. | Hybrid | UntilBroken | `GrantedItemName`, `ExpiryTrigger` |
| Binding | BindToItem | Attaches an entity, curse, or force to an object. | Hybrid | UntilBroken | `GrantedItemName`, `RemovalMethod` |
| Binding | BindToPlace | Attaches a force to a house, grave, spring, or location. | GrantItem or NarrativeOnly | UntilBroken | `PayloadValue`, `ExpiryTrigger` |
| Binding | CompelService | Forces action, obedience, or duty from a bound subject. | CreateActiveEffect or Hybrid | Scene to UntilBroken | `PayloadValue`, `OnFailure` |
| Binding | ContainEntity | Keeps an entity from escaping a circle, seal, or vessel. | Hybrid | Scene to UntilBroken | `PayloadValue`, `ResistanceFormula` |

### Possession

| Type | Subtype | Default effect meaning | Typical application mode | Typical duration | Typical payload fields |
| --- | --- | --- | --- | --- | --- |
| Possession | AttachSpirit | A spirit or entity begins inhabiting the target. | Hybrid | Scene to UntilBroken | `GrantedItemName`, `ResistanceFormula` |
| Possession | DriveOut | A possessing force is expelled. | Hybrid | Instant | `PayloadValue`, `RemovalMethod` |
| Possession | DreamRiding | The possessor reaches the target through dreams or sleep. | Hybrid | Night to Scene | `PayloadValue`, `DurationType` |
| Possession | FullControl | The possessor gains strong or total command of the host. | CreateActiveEffect or Hybrid | Scene to UntilBroken | `PayloadValue`, `ResistanceFormula` |
| Possession | ShieldFromPossession | The target becomes harder or impossible to possess. | CreateActiveEffect | Scene to Days | `PayloadValue`, `SuppressedBy` |
| Possession | SuppressPossessor | A possessing force remains present but weakened or blocked. | CreateActiveEffect | Scene to Days | `PayloadValue` |
| Possession | TransferPossessor | A possessing force changes vessel or host. | Hybrid | Instant to UntilBroken | `GrantedItemName`, `PayloadNotes` |

### Influence

| Type | Subtype | Default effect meaning | Typical application mode | Typical duration | Typical payload fields |
| --- | --- | --- | --- | --- | --- |
| Influence | Calm | Reduces panic, rage, or turmoil. | CreateActiveEffect | Scene | `PayloadValue` |
| Influence | Doubt | Weakens certainty, conviction, or trust. | CreateActiveEffect | Scene to Days | `PayloadValue` |
| Influence | Fear | Imposes dread, retreat, or fearful hesitation. | CreateActiveEffect | Scene | `PayloadValue`, `ResistanceFormula` |
| Influence | Forgetfulness | Makes memory retrieval or retention difficult. | CreateActiveEffect or NarrativeOnly | Scene to Days | `PayloadValue` |
| Influence | Love | Creates attachment, affection, or longing. | CreateActiveEffect | Days to UntilBroken | `PayloadValue`, `RemovalMethod` |
| Influence | Obedience | Pushes the target toward service or compliance. | CreateActiveEffect | Scene to Days | `PayloadValue` |
| Influence | Rage | Pushes the target toward aggression or loss of restraint. | CreateActiveEffect | Scene | `PayloadValue` |
| Influence | Shame | Burdens the target with guilt, exposure, or social shrinking. | CreateActiveEffect | Scene to Days | `PayloadValue` |
| Influence | Sleep | Pushes the target into magical sleep, slumber, or lethargy. | CreateActiveEffect | Scene to Night | `PayloadValue`, `ResistanceFormula` |
| Influence | SocialFavor | Makes the target view source more favorably. | CreateActiveEffect | Scene to Days | `PayloadValue` |
| Influence | Suggestion | Plants an urge, direction, or accepted idea. | CreateActiveEffect | Scene to Days | `PayloadValue`, `OnFailure` |
| Influence | Temptation | Urges the target toward sinful, dangerous, or patron-aligned action. | CreateActiveEffect | Scene to Days | `PayloadValue` |
| Influence | TruthPressure | Makes deception difficult and truth easier to force out. | CreateActiveEffect | Scene to Days | `PayloadValue`, `ResistanceFormula` |

### Revelation

| Type | Subtype | Default effect meaning | Typical application mode | Typical duration | Typical payload fields |
| --- | --- | --- | --- | --- | --- |
| Revelation | CauseOfCurse | Reveals the source or caster of a curse. | NarrativeOnly | Instant | `PayloadValue` |
| Revelation | DreamMessage | Conveys information through dreams. | NarrativeOnly | Instant to Night | `PayloadValue`, `PayloadNotes` |
| Revelation | Identity | Reveals who or what something really is. | NarrativeOnly or CreateActiveEffect | Instant to Scene | `PayloadValue` |
| Revelation | Location | Reveals where a person, object, or threat is. | NarrativeOnly | Instant | `PayloadValue` |
| Revelation | Memory | Recovers hidden, lost, or buried memory. | NarrativeOnly or CreateActiveEffect | Instant to Scene | `PayloadValue` |
| Revelation | ObjectHistory | Reveals impressions or past events tied to an object. | NarrativeOnly | Instant | `PayloadValue` |
| Revelation | Omen | Reveals or generates omen-significance. | NarrativeOnly | Instant to Days | `PayloadValue` |
| Revelation | PastEvent | Reveals, reconstructs, or ritually re-frames an earlier event. | NarrativeOnly or Hybrid | Instant to Scene | `PayloadValue`, `PayloadNotes` |
| Revelation | Prophecy | Gives insight into future events or possible outcomes. | NarrativeOnly | Instant | `PayloadValue`, `PayloadNotes` |
| Revelation | SpiritSight | Reveals spiritual presence or hidden beings. | CreateActiveEffect or NarrativeOnly | Scene | `PayloadValue`, `DetectionCheck` |
| Revelation | TrueName | Reveals a true name or binding identity. | NarrativeOnly | Permanent | `PayloadValue` |

### Movement

| Type | Subtype | Default effect meaning | Typical application mode | Typical duration | Typical payload fields |
| --- | --- | --- | --- | --- | --- |
| Movement | DragUnder | Pulls a target beneath water, ground, or other dangerous medium. | CreateActiveEffect | Scene | `PayloadValue`, `OnFailure` |
| Movement | Grounded | Prevents flying or vertical escape. | CreateActiveEffect | Scene | `PayloadValue` |
| Movement | Immobilize | Prevents or nearly prevents movement. | CreateActiveEffect | Scene | `PayloadValue` |
| Movement | LeadAstray | Causes loss of route, separation, or misdirection. | CreateActiveEffect or NarrativeOnly | Scene | `PayloadValue`, `ExpiryTrigger` |
| Movement | Phase | Allows movement through barriers or beings. | CreateActiveEffect | Scene | `PayloadValue` |
| Movement | PhaseTravel | Projects or shifts the target through an altered state of travel or presence. | NarrativeOnly or Hybrid | Scene to Night | `PayloadValue`, `TargetDescription` |
| Movement | Pull | Draws the target toward a point or source. | DirectDataChange or NarrativeOnly | Instant to Scene | `PayloadValue` |
| Movement | Push | Forces the target away from a point or source. | DirectDataChange or NarrativeOnly | Instant | `PayloadValue` |
| Movement | Slow | Reduces available movement or pace. | CreateActiveEffect | Scene to Days | `PayloadValue` |
| Movement | Teleport | Instantly relocates a target. | NarrativeOnly or DirectDataChange | Instant | `PayloadValue`, `TargetDescription` |

### Transformation

| Type | Subtype | Default effect meaning | Typical application mode | Typical duration | Typical payload fields |
| --- | --- | --- | --- | --- | --- |
| Transformation | Object | Changes the form, nature, or magical function of an object, vessel, or crafted thing. | Hybrid or DirectDataChange | Scene to Permanent | `PayloadTarget`, `PayloadValue`, `PayloadTraitText` |
| Transformation | Other | Changes the form or nature of another being. | Hybrid | Scene to Permanent | `PayloadTarget`, `PayloadValue`, `ResistanceFormula` |
| Transformation | Self | Changes the caster's or user's own form, body, or occult state. | Hybrid or CreateActiveEffect | Scene to Permanent | `PayloadTarget`, `PayloadValue`, `PayloadTraitText` |

### Protection

| Type | Subtype | Default effect meaning | Typical application mode | Typical duration | Typical payload fields |
| --- | --- | --- | --- | --- | --- |
| Protection | Concealment | Makes the target harder to detect, identify, or strike. | CreateActiveEffect | Scene | `PayloadValue`, `DetectionCheck` |
| Protection | ConditionImmunity | Prevents a specified condition from applying. | DirectDataChange or CreateActiveEffect | Scene to Permanent | `PayloadTag`, `PayloadValue` |
| Protection | DamageImmunity | Prevents a specified damage source from harming the target. | DirectDataChange or CreateActiveEffect | Scene to Permanent | `PayloadTag`, `SuppressedBy` |
| Protection | DamageResistance | Reduces harm from a specified source. | DirectDataChange or CreateActiveEffect | Scene to Permanent | `PayloadTag`, `PayloadValue` |
| Protection | SafePassage | Allows crossing or travel that would otherwise be unsafe. | CreateActiveEffect or NarrativeOnly | Scene to Days | `PayloadValue` |
| Protection | SanctifiedGuard | Provides holy or consecrated protection. | CreateActiveEffect | Scene to Days | `PayloadValue`, `SuppressedBy` |
| Protection | WardBypass | Lets a target ignore or pierce an existing ward or threshold. | CreateActiveEffect or NarrativeOnly | Scene | `PayloadValue` |

### Remove

| Type | Subtype | Default effect meaning | Typical application mode | Typical duration | Typical payload fields |
| --- | --- | --- | --- | --- | --- |
| Remove | Binding | Breaks or clears a binding effect. | Hybrid | Instant | `PayloadValue`, `RemovalMethod` |
| Remove | Blessing | Removes a beneficial magical state. | DirectDataChange or Hybrid | Instant | `PayloadValue` |
| Remove | Curse | Removes a curse or harmful magical state. | DirectDataChange or Hybrid | Instant | `PayloadValue`, `RemovalMethod` |
| Remove | Disease | Removes a disease state. | DirectDataChange or CreateActiveEffect | Instant | `PayloadValue` |
| Remove | Oath | Breaks or dissolves an oath-binding effect. | Hybrid | Instant | `PayloadValue` |
| Remove | PactStrain | Clears current pact pressure without ending the pact itself. | CreateActiveEffect or Hybrid | Instant | `PayloadValue` |
| Remove | Possession | Expels or breaks an active possession. | Hybrid | Instant | `PayloadValue`, `RemovalMethod` |
| Remove | Status | Removes a current condition. | CreateActiveEffect or DirectDataChange | Instant | `PayloadValue` |
| Remove | Tag | Removes a tag-based rule fact. | DirectDataChange | Instant | `PayloadTag` |
| Remove | Trait | Removes a readable trait or sign. | DirectDataChange | Instant | `PayloadTraitName` |
| Remove | Ward | Breaks or clears a ward. | GrantItem or Hybrid | Instant | `PayloadValue`, `RemovalMethod` |

### Descriptive

| Type | Subtype | Default effect meaning | Typical application mode | Typical duration | Typical payload fields |
| --- | --- | --- | --- | --- | --- |
| Descriptive | Dream | Produces dream imagery, dream contact, or dream signs. | NarrativeOnly | Night to Instant | `PayloadValue`, `PayloadNotes` |
| Descriptive | Light | Produces visible light, glow, halo, or darkness. | NarrativeOnly or CreateActiveEffect | Scene to Days | `PayloadValue`, `Visible` |
| Descriptive | Manifestation | Produces sensory supernatural presence without a strict mechanical effect. | NarrativeOnly | Scene | `PayloadValue` |
| Descriptive | Mark | Produces a visible or sensory occult sign. | NarrativeOnly or DirectDataChange | Days to Permanent | `PayloadValue`, `Visible` |
| Descriptive | Omen | Produces a portent in the world around the subject. | NarrativeOnly | Instant to Days | `PayloadValue` |
| Descriptive | Smell | Produces a supernatural scent, fragrance, or corruption odor. | NarrativeOnly | Scene to Days | `PayloadValue` |
| Descriptive | Trace | Leaves lingering evidence, aura, or magical spoor. | NarrativeOnly | Scene to Days | `PayloadValue`, `DetectionCheck` |
| Descriptive | Voice | Produces supernatural speech, mimicry, or heard message. | NarrativeOnly | Instant to Scene | `PayloadValue` |
| Descriptive | Weather | Produces a weather sign or local atmospheric alteration. | NarrativeOnly | Scene to Days | `PayloadValue` |

## Allowed Effects Table

This table defines a practical first-pass list of reusable authored effects.

Use these rows as the default building blocks for monsters, spells, powers, and pacts.

| Effect name | EffectType | EffectSubtype | Default payload target | Typical duration | Usually ActiveEffect |
| --- | --- | --- | --- | --- | --- |
| Afraid | Status | Afraid | `Status` | Scene | Yes |
| Blessed | Status | Blessed | `Status` | Scene to Days | Yes |
| Charmed | Status | Charmed | `Status` | Scene to Days | Yes |
| Confused | Status | Confused | `Status` | Scene | Yes |
| Cursed | Status | Cursed | `Status` | Days to UntilBroken | Yes |
| Diseased | Status | Diseased | `Status` | Days to Weeks | Yes |
| Dominated | Status | Dominated | `Status` | Scene to UntilBroken | Yes |
| Doomed | Status | Doomed | `Status` | Days to Permanent | Yes |
| Friendly | Status | Friendly | `Status` | Scene to Days | Yes |
| Hidden | Status | Hidden | `Status` | Scene | Yes |
| Ill Luck | Status | IllLuck | `Status` | Days | Yes |
| Inspired | Status | Inspired | `Status` | Scene to Days | Yes |
| Lost Faith | Status | LostFaith | `Status` | Days to UntilBroken | Yes |
| Marked | Status | Marked | `Status` | Days to Permanent | Sometimes |
| Possessed | Status | Possessed | `Status` or binding record | Scene to UntilBroken | Yes |
| Protected | Status | Protected | `Status` | Scene to Days | Yes |
| Restless | Status | Restless | `Status` | Scene to Days | Yes |
| Revealed | Status | Revealed | `Status` | Scene | Yes |
| Silenced | Status | Silenced | `Status` | Scene | Yes |
| Sleep-Touched | Status | SleepTouched | `Status` | Night to Days | Yes |
| Truth-Bound | Status | TruthBound | `Status` | Scene to Days | Yes |
| Weakened | Status | Weakened | `Status` | Scene to Days | Yes |
| Wounded | Status | Wounded | `Status` | Scene to Days | Yes |
| Heal HP | Stat | Resource | `HP` | Instant | No |
| Deal HP Damage | Stat | Resource | `HP` | Instant | No |
| Change Stamina | Stat | Resource | `Stamina` | Instant to Days | No |
| Change Faith | Stat | Resource | `Faith` | Instant to Days | No |
| Change Power | Stat | ActorStat | `Power` | Instant to Permanent | Sometimes |
| Change MoveGround | Stat | Movement | `MoveGround` | Scene to Permanent | Sometimes |
| Change MoveFly | Stat | Movement | `MoveFly` | Scene to Permanent | Sometimes |
| Change Primary Stat | Stat | PrimaryStat | named core stat | Scene to Permanent | Sometimes |
| Change Threshold | Stat | Threshold | named threshold | Scene to Days | Yes |
| Add Vulnerability Tag | Tag | VulnerabilityTag | tag key in `PayloadTag` | Days to Permanent | No |
| Add Immunity Tag | Tag | DefenseTag | tag key in `PayloadTag` | Days to Permanent | No |
| Add Resistance Tag | Tag | DefenseTag | tag key in `PayloadTag` | Days to Permanent | No |
| Add Binding Tag | Tag | BindingTag | tag key in `PayloadTag` | Days to Permanent | No |
| Add Perception Tag | Tag | PerceptionTag | tag key in `PayloadTag` | Scene to Permanent | Sometimes |
| Add Influence Tag | Tag | InfluenceTag | tag key in `PayloadTag` | Days to Permanent | No |
| Remove Tag | Remove | Tag | tag key in `PayloadTag` | Instant | No |
| Add Blessing Text | Trait | BlessingText | named trait | Days to Permanent | No |
| Add Curse Text | Trait | CurseText | named trait | Days to Permanent | No |
| Add Monster Feature Text | Trait | MonsterFeature | named trait | Permanent | No |
| Add Visible Tell | Trait | VisibleTell | named trait | Days to Permanent | No |
| Grant Spell | Grant | Spell | spell item | WhileConditionHolds to Permanent | No |
| Grant Power | Grant | Power | power item | Days to Permanent | No |
| Grant Pact | Grant | Pact | pact item | UntilBroken | No |
| Grant Bound Entity | Grant | BoundEntity | bound entity item | UntilBroken | No |
| Grant Action | Grant | Action | action or feature item | Scene to Permanent | No |
| Threshold Ward | Ward | Threshold | threshold or crossing | UntilBroken | No |
| Anti-Spirit Ward | Ward | AntiSpirit | actor, place, or boundary | Scene to UntilBroken | Sometimes |
| Anti-Possession Ward | Ward | AntiPossession | actor or vessel | Scene to Days | Yes |
| Seal | Ward | Seal | container, place, or opening | UntilBroken | No |
| Reflection Ward | Ward | Reflection | protected subject or boundary | Scene to Days | Yes |
| Sanctuary | Ward | Sanctuary | actor or place | Scene to Days | Yes |
| Alarm Ward | Ward | Alarm | object, letter, room, or border | Days to UntilBroken | No |
| Bind to Item | Binding | BindToItem | item or vessel | UntilBroken | No |
| Bind to Actor | Binding | BindToActor | actor | UntilBroken | Sometimes |
| Bind to Place | Binding | BindToPlace | place | UntilBroken | No |
| Bind by True Name | Binding | BindByName | actor or entity | Scene to UntilBroken | Yes |
| Bind by Oath | Binding | BindByOath | actor or group | UntilBroken | Sometimes |
| Contain Entity | Binding | ContainEntity | entity, circle, or vessel | Scene to UntilBroken | Yes |
| Compel Service | Binding | CompelService | bound subject | Scene to UntilBroken | Yes |
| Attach Spirit | Possession | AttachSpirit | actor or vessel | Scene to UntilBroken | Yes |
| Drive Out Possessor | Possession | DriveOut | possessed actor | Instant | No |
| Full Control | Possession | FullControl | possessed actor | Scene to UntilBroken | Yes |
| Shield from Possession | Possession | ShieldFromPossession | actor | Scene to Days | Yes |
| Suppress Possessor | Possession | SuppressPossessor | possessed actor | Scene to Days | Yes |
| Transfer Possessor | Possession | TransferPossessor | old host and new host | Instant to UntilBroken | No |
| Dream Riding | Possession | DreamRiding | sleeping actor | Night to Scene | Sometimes |
| Calm | Influence | Calm | actor attitude or state | Scene | Yes |
| Doubt | Influence | Doubt | actor attitude or faith | Scene to Days | Yes |
| Fear | Influence | Fear | actor attitude or nerve | Scene | Yes |
| Forgetfulness | Influence | Forgetfulness | memory or recall | Scene to Days | Sometimes |
| Love | Influence | Love | affection or desire | Days to UntilBroken | Yes |
| Obedience | Influence | Obedience | will or compliance | Scene to Days | Yes |
| Rage | Influence | Rage | temper or aggression | Scene | Yes |
| Shame | Influence | Shame | morale or social bearing | Scene to Days | Yes |
| Magical Sleep | Influence | Sleep | sleep, slumber, or lethargy | Scene to Night | Yes |
| Social Favor | Influence | SocialFavor | stance toward source | Scene to Days | Yes |
| Suggestion | Influence | Suggestion | intent or chosen action | Scene to Days | Yes |
| Temptation | Influence | Temptation | desire or sinful urge | Scene to Days | Yes |
| Truth Pressure | Influence | TruthPressure | lying, confession, or honesty | Scene to Days | Yes |
| Reveal Cause of Curse | Revelation | CauseOfCurse | curse source knowledge | Instant | No |
| Dream Message | Revelation | DreamMessage | information content | Instant to Night | No |
| Reveal Identity | Revelation | Identity | hidden identity | Instant to Scene | Sometimes |
| Reveal Location | Revelation | Location | object or person location | Instant | No |
| Recover Memory | Revelation | Memory | forgotten memory | Instant to Scene | No |
| Reveal Object History | Revelation | ObjectHistory | object past | Instant | No |
| Reveal Omen | Revelation | Omen | omen meaning | Instant to Days | No |
| Reveal Past Event | Revelation | PastEvent | earlier event or altered recollection | Instant to Scene | No |
| Prophecy | Revelation | Prophecy | future knowledge | Instant | No |
| Spirit Sight | Revelation | SpiritSight | hidden spirit presence | Scene | Sometimes |
| Reveal True Name | Revelation | TrueName | true name knowledge | Permanent | No |
| Drag Under | Movement | DragUnder | target position or movement | Scene | Yes |
| Ground | Movement | Grounded | flight or vertical movement | Scene | Yes |
| Immobilize | Movement | Immobilize | movement freedom | Scene | Yes |
| Lead Astray | Movement | LeadAstray | route, navigation, or cohesion | Scene | Sometimes |
| Pull | Movement | Pull | position relative to source | Instant to Scene | No |
| Push | Movement | Push | position relative to source | Instant | No |
| Slow | Movement | Slow | movement allowance | Scene to Days | Yes |
| Phase | Movement | Phase | collision or barrier rules | Scene | Yes |
| Phase Travel | Movement | PhaseTravel | altered travel or projected presence | Scene to Night | Sometimes |
| Teleport | Movement | Teleport | position | Instant | No |
| Transform Object | Transformation | Object | form, vessel, or magical function | Scene to Permanent | Sometimes |
| Transform Other | Transformation | Other | body, form, or nature of another | Scene to Permanent | Sometimes |
| Transform Self | Transformation | Self | body, form, or occult state of self | Scene to Permanent | Sometimes |
| Concealment | Protection | Concealment | detectability or identification | Scene | Yes |
| Condition Immunity | Protection | ConditionImmunity | blocked condition type | Scene to Permanent | Sometimes |
| Damage Immunity | Protection | DamageImmunity | blocked damage source | Scene to Permanent | Sometimes |
| Damage Resistance | Protection | DamageResistance | reduced damage source | Scene to Permanent | Sometimes |
| Safe Passage | Protection | SafePassage | travel or crossing safety | Scene to Days | Sometimes |
| Sanctified Guard | Protection | SanctifiedGuard | holy protection | Scene to Days | Yes |
| Ward Bypass | Protection | WardBypass | crossing or defeating wards | Scene | Sometimes |
| Remove Curse | Remove | Curse | curse state or curse item | Instant | No |
| Remove Blessing | Remove | Blessing | blessing state or blessing item | Instant | No |
| Remove Disease | Remove | Disease | disease state | Instant | No |
| Remove Possession | Remove | Possession | possession state or possessor link | Instant | No |
| Remove Binding | Remove | Binding | binding state or relation | Instant | No |
| Remove Status | Remove | Status | named status | Instant | No |
| Remove Ward | Remove | Ward | ward object or state | Instant | No |
| Remove Pact Strain | Remove | PactStrain | current pact pressure | Instant | No |
| Omen Sign | Descriptive | Omen | omen fiction | Instant to Days | No |
| Dream Vision | Descriptive | Dream | dream imagery or contact | Night to Instant | No |
| Supernatural Voice | Descriptive | Voice | heard message or mimicry | Instant to Scene | No |
| Supernatural Smell | Descriptive | Smell | aura scent or corruption odor | Scene to Days | No |
| Halo or Darkness | Descriptive | Light | visible glow or darkening | Scene to Days | Sometimes |
| Witch Mark | Descriptive | Mark | visible supernatural mark | Days to Permanent | No |
| Manifest Presence | Descriptive | Manifestation | uncanny presence or sensory event | Scene | No |
| Magical Trace | Descriptive | Trace | lingering aura or spoor | Scene to Days | No |
| Weather Sign | Descriptive | Weather | local atmospheric omen | Scene to Days | No |
