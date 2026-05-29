# Spell Usage Effect Mapping Spec v1

This document maps the current human spell list to the minimum `UsageEffect`
patterns needed to cover all spells in `1547Core`.

It is a spell-authoring reference, not a runtime contract.

## Purpose

- identify the reusable `UsageEffect` combinations needed to cover the full
  spell list
- keep spell authoring consistent
- highlight gaps in the current effect subtype catalog before we start
  populating `SuccessEffects`

## Authoring Rule

Each spell should usually have:

- one `Primary UsageEffect`
- optionally one `Secondary UsageEffect`
- optional supporting descriptive or trait payloads

Most spells do **not** need bespoke one-off effect types.

## Recommended Catalog Additions

The current effect catalog is close, but these additions would make spell
coverage cleaner:

- `Influence / Sleep`
- `Transformation / Self`
- `Transformation / Object`

Optional later additions:

- `Transformation / Other`
- `Revelation / PastEvent`
- `Movement / PhaseTravel`

## Pattern Legend

- `Primary` = the main gameplay effect the spell should resolve through
- `Secondary` = a common secondary outcome that may appear in the same spell

---

## Alchemy

| Spell | Primary | Secondary |
| --- | --- | --- |
| Albedo | `Transformation / Self` | `Stat / ActorStat` |
| Calcination | `Transformation / Object` | `Trait / PassiveRule` |
| Citrinitas | `Transformation / Self` | `Status / Inspired` |
| Coagulation | `Transformation / Object` | `Trait / PassiveRule` |
| Conjunction | `Transformation / Object` | `Grant / BoundEntity` |
| Dissolution | `Remove / Binding` | `Transformation / Object` |
| Distillation | `Transformation / Object` | `Trait / PassiveRule` |
| Fermentation | `Transformation / Object` | `Status / Blessed` |
| Golem | `Grant / BoundEntity` | `Binding / CompelService` |
| Homunculus | `Grant / BoundEntity` | `Binding / BindToItem` |
| Humoral Rebalancing | `Status / Blessed` | `Remove / Disease` |
| Metallic Transposition | `Transformation / Object` | `Trait / PassiveRule` |
| Nigredo | `Transformation / Self` | `Status / Cursed` |
| Rubedo | `Transformation / Self` | `Stat / PrimaryStat` |
| Separation | `Transformation / Object` | `Remove / Status` |

## Astrology

| Spell | Primary | Secondary |
| --- | --- | --- |
| Auspicious Prediction | `Revelation / Omen` | `Descriptive / Omen` |
| Auspicious Timing | `Revelation / Omen` | `Status / Blessed` |
| Planetary Invocation | `Status / Blessed` | `Revelation / Prophecy` |
| Prophecy | `Revelation / Prophecy` | `Descriptive / Omen` |
| Prospect Reading | `Revelation / Omen` | `Revelation / Location` |
| Reading | `Revelation / Omen` | `Descriptive / Omen` |

## Divination

| Spell | Primary | Secondary |
| --- | --- | --- |
| Astral Projection | `Movement / PhaseTravel` | `Grant / BoundEntity` |
| Danger Sense | `Revelation / Omen` | `Status / Protected` |
| Dream Interpretation | `Revelation / DreamMessage` | `Descriptive / Dream` |
| Faith Manipulation | `Influence / Doubt` | `Status / LostFaith` |
| Find the Culprit | `Revelation / Identity` | `Revelation / Location` |
| Find What Is Lost | `Revelation / Location` | `Revelation / Identity` |
| Glamour | `Status / Hidden` | `Trait / VisibleTell` |
| Object Memory | `Revelation / ObjectHistory` | `Revelation / Memory` |
| Scrying | `Revelation / Location` | `Revelation / SpiritSight` |
| Threshold Awareness | `Revelation / SpiritSight` | `Ward / Alarm` |
| Truth Pressure | `Influence / TruthPressure` | `Status / TruthBound` |

## Grimoire

| Spell | Primary | Secondary |
| --- | --- | --- |
| Angelic Boon | `Status / Blessed` | `Grant / Spell` |
| Banish | `Remove / Possession` | `Binding / ContainEntity` |
| Bind | `Binding / BindByName` | `Binding / ContainEntity` |
| Break Binding | `Remove / Binding` | `Remove / Tag` |
| Break Pact | `Remove / Oath` | `Remove / PactStrain` |
| Break Seal | `Remove / Ward` | `Remove / Binding` |
| Chalk Border | `Ward / Barrier` | `Ward / AntiSpirit` |
| Command | `Influence / Obedience` | `Binding / CompelService` |
| Create Spirit Vessel | `Binding / BindToItem` | `Grant / BoundEntity` |
| Delay | `Binding / BindToActor` | `Status / Weakened` |
| Divine Guidance | `Status / Blessed` | `Revelation / Omen` |
| Enchant Object | `Transformation / Object` | `Grant / Spell` |
| Exorcism | `Possession / DriveOut` | `Remove / Possession` |
| Golem | `Grant / BoundEntity` | `Binding / CompelService` |
| Homunculus | `Grant / BoundEntity` | `Binding / BindToItem` |
| Invoke Pact | `Grant / Pact` | `Trait / PactTerm` |
| Lovebinding | `Influence / Love` | `Status / Charmed` |
| Name the Unnamed | `Revelation / TrueName` | `Binding / BindByName` |
| Possess | `Possession / FullControl` | `Status / Possessed` |
| Planetary Invocation | `Status / Blessed` | `Revelation / Prophecy` |
| Rewrite the Past | `Revelation / PastEvent` | `Influence / Forgetfulness` |
| Scrying | `Revelation / Location` | `Revelation / SpiritSight` |
| Seal | `Ward / Seal` | `Binding / ContainEntity` |
| Shape Shifting | `Transformation / Self` | `Trait / VisibleTell` |
| Simulacrum | `Grant / BoundEntity` | `Transformation / Object` |
| Summon Being | `Grant / BoundEntity` | `Binding / CompelService` |
| Transform Self | `Transformation / Self` | `Stat / PrimaryStat` |
| Zone Travel | `Movement / PhaseTravel` | `Descriptive / Manifestation` |

## Knot

| Spell | Primary | Secondary |
| --- | --- | --- |
| Calm Knot | `Influence / Calm` | `Status / Protected` |
| Cold Knot | `Status / Weakened` | `Influence / Fear` |
| Death Knots | `Status / Doomed` | `Status / Weakened` |
| Disease Knot | `Status / Diseased` | `Status / Cursed` |
| Favor Knot | `Influence / SocialFavor` | `Status / Charmed` |
| Heart Twine | `Influence / Love` | `Status / Charmed` |
| Ill Luck Knot | `Status / IllLuck` | `Status / Cursed` |
| Ill Turning Loop | `Influence / Doubt` | `Movement / LeadAstray` |
| Limbsnare | `Movement / Immobilize` | `Binding / BindToActor` |
| Memory Tangle | `Influence / Forgetfulness` | `Revelation / Memory` |
| Oath Knot | `Binding / BindByOath` | `Status / TruthBound` |
| Tongue-Tying Knot | `Status / Silenced` | `Influence / Obedience` |
| Uncertain Knot | `Movement / LeadAstray` | `Influence / Doubt` |
| Wind Knot | `Descriptive / Weather` | `Protection / SafePassage` |
| Witch's Ladder | `Binding / BindToItem` | `Influence / Suggestion` |
| Withering Knot | `Status / Weakened` | `Status / Cursed` |

## Necromancy

| Spell | Primary | Secondary |
| --- | --- | --- |
| Black Sleep | `Influence / Sleep` | `Status / SleepTouched` |
| Blood Border | `Ward / Barrier` | `Ward / AntiSpirit` |
| Borrowed Pallor | `Transformation / Self` | `Status / Marked` |
| Borrowed Pulse | `Transformation / Self` | `Status / Weakened` |
| Consumption Oath | `Binding / BindByOath` | `Status / Doomed` |
| Create Funeral Wax Candle | `Binding / BindToItem` | `Trait / VisibleTell` |
| Curse of Withering | `Status / Cursed` | `Status / Weakened` |
| Dread | `Influence / Fear` | `Status / Weakened` |
| Empty Mirror | `Trait / VisibleTell` | `Revelation / Identity` |
| Evil Eye | `Status / IllLuck` | `Status / Cursed` |
| Grave Dreaming | `Revelation / DreamMessage` | `Descriptive / Dream` |
| Grave Soil & Salt Border | `Ward / Barrier` | `Ward / AntiSpirit` |
| Night Riding | `Possession / DreamRiding` | `Status / SleepTouched` |
| Shadow Attachment | `Possession / AttachSpirit` | `Status / Possessed` |
| Speak with the Dead | `Grant / BoundEntity` | `Revelation / SpiritSight` |
| Still Tongue | `Status / Silenced` | `Influence / Fear` |

## Religion

| Spell | Primary | Secondary |
| --- | --- | --- |
| Banish | `Remove / Possession` | `Ward / AntiSpirit` |
| Beam Sigil | `Ward / Threshold` | `Protection / SafePassage` |
| Consecrate Church | `Ward / Sanctuary` | `Ward / AntiDemon` |
| Create Funeral Wax Candle | `Binding / BindToItem` | `Trait / BlessingText` |
| Exorcism | `Possession / DriveOut` | `Remove / Possession` |
| Divine Guidance | `Status / Blessed` | `Revelation / Omen` |
| Oath of Three Witnesses | `Binding / BindByOath` | `Status / TruthBound` |
| Prayer Against the Evil Eye | `Remove / Curse` | `Protection / ConditionImmunity` |
| Protection Rhyme | `Status / Protected` | `Protection / SafePassage` |
| Protective Border | `Ward / Threshold` | `Ward / Proof` |
| Protective Circle | `Ward / Barrier` | `Ward / AntiSpirit` |
| Refusal Rite | `Remove / Binding` | `Remove / Possession` |
| Sanctify | `Status / Blessed` | `Remove / Curse` |
| Seal | `Ward / Seal` | `Binding / ContainEntity` |
| Spirit Sight | `Revelation / SpiritSight` | `Status / Revealed` |

## Wards

| Spell | Primary | Secondary |
| --- | --- | --- |
| Beam Sigil | `Ward / Threshold` | `Ward / Alarm` |
| Blood Border | `Ward / Barrier` | `Ward / AntiSpirit` |
| Chalk Border | `Ward / Barrier` | `Ward / AntiSpirit` |
| Dream Warding | `Ward / AntiPossession` | `Possession / ShieldFromPossession` |
| Grave Soil & Salt Border | `Ward / Barrier` | `Ward / AntiSpirit` |
| Iron Seal | `Ward / Seal` | `Binding / ContainEntity` |
| Oath of Three Witnesses | `Binding / BindByOath` | `Ward / Proof` |
| Protective Border | `Ward / Threshold` | `Protection / SafePassage` |
| Protective Circle | `Ward / Barrier` | `Ward / Sanctuary` |
| Refusal Rite | `Ward / AntiPossession` | `Remove / Possession` |
| Sanctify | `Ward / Sanctuary` | `Status / Blessed` |
| Wax Seal | `Ward / Seal` | `Binding / BindToItem` |

---

## Multi-School Spell Quick Check

These deserve especially careful two-effect authoring because both schools are
structurally visible in the result:

- `Auspicious Prediction`
- `Auspicious Timing`
- `Banish`
- `Beam Sigil`
- `Blood Border`
- `Chalk Border`
- `Create Funeral Wax Candle`
- `Divine Guidance`
- `Exorcism`
- `Grave Soil & Salt Border`
- `Golem`
- `Homunculus`
- `Oath of Three Witnesses`
- `Planetary Invocation`
- `Prophecy`
- `Protective Border`
- `Protective Circle`
- `Refusal Rite`
- `Sanctify`
- `Seal`
- `Spirit Sight`

## Minimum Complete Coverage Set

If we want a smallest realistic first implementation pass, these effect
patterns are enough to start filling all spells:

- `Ward / Threshold`
- `Ward / Barrier`
- `Ward / AntiSpirit`
- `Ward / AntiPossession`
- `Ward / Seal`
- `Ward / Sanctuary`
- `Binding / BindByName`
- `Binding / BindByOath`
- `Binding / BindToActor`
- `Binding / BindToItem`
- `Binding / ContainEntity`
- `Binding / CompelService`
- `Possession / AttachSpirit`
- `Possession / DriveOut`
- `Possession / DreamRiding`
- `Possession / FullControl`
- `Influence / Calm`
- `Influence / Doubt`
- `Influence / Fear`
- `Influence / Forgetfulness`
- `Influence / Love`
- `Influence / Obedience`
- `Influence / Sleep`
- `Influence / SocialFavor`
- `Influence / Suggestion`
- `Influence / TruthPressure`
- `Revelation / DreamMessage`
- `Revelation / Identity`
- `Revelation / Location`
- `Revelation / Memory`
- `Revelation / ObjectHistory`
- `Revelation / Omen`
- `Revelation / PastEvent`
- `Revelation / Prophecy`
- `Revelation / SpiritSight`
- `Revelation / TrueName`
- `Status / Blessed`
- `Status / Charmed`
- `Status / Cursed`
- `Status / Diseased`
- `Status / Doomed`
- `Status / Hidden`
- `Status / IllLuck`
- `Status / LostFaith`
- `Status / Marked`
- `Status / Possessed`
- `Status / Protected`
- `Status / Revealed`
- `Status / Silenced`
- `Status / SleepTouched`
- `Status / TruthBound`
- `Status / Weakened`
- `Movement / Immobilize`
- `Movement / LeadAstray`
- `Movement / PhaseTravel`
- `Protection / ConditionImmunity`
- `Protection / DamageResistance`
- `Protection / SafePassage`
- `Remove / Binding`
- `Remove / Curse`
- `Remove / Disease`
- `Remove / Oath`
- `Remove / PactStrain`
- `Remove / Possession`
- `Remove / Ward`
- `Grant / BoundEntity`
- `Grant / Pact`
- `Grant / Spell`
- `Trait / BlessingText`
- `Trait / CurseText`
- `Trait / PactTerm`
- `Trait / PassiveRule`
- `Trait / VisibleTell`
- `Transformation / Self`
- `Transformation / Object`
- `Descriptive / Dream`
- `Descriptive / Manifestation`
- `Descriptive / Omen`
- `Descriptive / Weather`

This set should be enough to cover the whole current human spell list without
inventing a one-off effect type per spell.
