# Motivation Specializations Starter Spec v1

This document defines the shared authoring model for `Motivation` ChangeSets.

Unlike base-monster specs, this document is organized by slot type rather than
by monster family. Its purpose is to make `Motivation` reusable across
compatible families while still supporting explicit restrictions for drives that
only fit specific lineages.

It should be read alongside:

- `monster-creation-guide.md`
- `monster-maker-spec-v1.md`
- `domain-specializations-starter-spec-v1.md`
- `loadout-specializations-starter-spec-v1.md`
- `quirk-specializations-starter-spec-v1.md`
- family base specs such as `nature-spirit-base-starter-spec-v1.md`,
  `undead-base-starter-spec-v1.md`, and `people-base-starter-spec-v1.md`

## Purpose Of Motivation

`Motivation` is the slot that describes what a being is trying to do in the
world right now and what behavior-pattern overrides or sharpens its base and
domain logic.

A good `Motivation` answers questions like:

- what drive is shaping this creature's choices?
- what does it want badly enough to change how it approaches a scene?
- what behavior pattern would make this version play differently from another of
  the same lineage and domain?
- what pressure does it put on targets, allies, territory, or itself?
- what should strengthen or redirect its `Drive` property in social battles?

`Motivation` is not:

- the creature's lineage
- the source of its power
- its physical combat kit
- a single folkloric strength or weakness

Those belong primarily to `TypeDropdown`, `Domain`, `Loadout`, and `Quirk`.

Motivation should include:

- drives
- recurring behavior patterns
- hungers
- protective compulsions
- recruitment agendas
- unfinished purposes
- duties or imperatives that meaningfully alter scene behavior
- any motivation strong enough to increase or focus the actor's `Drive` in
  social conflict

## Drive In Social Battles

Some motivations should explicitly add to the actor's `Drive` property when
social battles are in play.

Use `Motivation` for `Drive`-affecting logic when:

- the creature has a strong overriding desire, duty, grievance, or imperative
- that desire would make it harder to persuade, distract, shame, or redirect
- the extra resistance or intensity comes from what it wants, not merely from
  body, lineage, or equipment

Examples:

- `Vengeful`
  - may increase `Drive` against the wrongdoer or target-class tied to the grievance
- `Guardian`
  - may increase `Drive` while defending a ward, household, sacred place, or charge
- `Recruiter`
  - may increase `Drive` while pressing someone toward pact, allegiance, or corruption
- `Preserve the Hidden Order`
  - may increase `Drive` when the Hidden Folk world, its secrecy, or its magic is threatened
- `Return to the House`
  - may increase `Drive` when the undead thing is opposed in carrying out its domestic return

This should usually be authored as:

- a situational `Drive` increase tied to the motivation's trigger
- not as a flat universal bonus unrelated to scene context

If a creature is always broadly strong-willed regardless of what it currently
wants, that belongs more in base stats or another systemic rule than in
`Motivation`.

## Reuse Rule

The default design goal is:

- keep `Motivation` reusable across monster families when the concept remains clear

Examples:

- `Guardian`
- `Hunter`
- `Lurer`
- `Recruiter`
- `Vengeful`
- `Hungry`
- `Territorial`
- `Collector`

These can mean different things for different families while still sharing one
motivation concept:

- `NatureSpirit + Guardian` means defense of place, boundary, or holding
- `People + Guardian` means defense of kin, lord, road, or post
- `Undead + Vengeful` means unfinished return driven by grievance
- `Unnatural + Recruiter` means active pressure to win souls, service, or allegiance

## Applicability Model

Every `Motivation` ChangeSet should explicitly declare whether it is:

1. cross-family
2. family-limited
3. subtype-limited within a family

### 1. Cross-family motivations

Use this when the motivational concept is valid for multiple lineages.

Recommended authoring pattern:

```yaml
Group: Motivation
ForTypeAny: false
ForType_NatureSpirit: true
ForType_People: true
ForType_Undead: true
```

Then add Requirements only if the motivation needs extra structural constraints.

### 2. Family-limited motivations

Use this when the motivation only makes sense for one base family.

Recommended authoring pattern:

```yaml
Group: Motivation
ForTypeAny: false
ForType_Unnatural: true
```

Examples:

- `Recruiter`
- `Preserve the Hidden Order`
- `Await the Summons`

### 3. Subtype-limited motivations

Use this when the motivation is legal for a family, but only for actors that
already carry some narrower identity.

Recommended authoring pattern:

```yaml
Group: Motivation
ForTypeAny: false
ForType_Undead: true
Requirements:
  - GroupPresent: Domain
  - HasTag: Undead
```

The exact predicates will vary, but the rule is consistent:

- use `ForType` for lineage eligibility
- use `Requirements` for narrower structural eligibility

Do not try to encode all nuance in the name of the ChangeSet.

## Requirements Guidance

Requirements on `Motivation` should answer:

- what must already be true for this drive or behavior pattern to make sense on
  this actor?

Good Requirement candidates:

- `HasTag`
  - example: a motivation that assumes `Undead`, `OathBound`, `LivingCreature`,
    or `Artificial`
- `GroupPresent`
  - example: a motivation that only makes sense with a matching `Domain` such
    as `Settlement`, `Grave`, or `Water`
- `StatAtLeast`
  - example: a command-driven or recruiter motivation that assumes notable
    `Charisma` or `Power`
- `DomainPresent`
  - example: a protective or territorial motivation that only makes sense for a
    creature with an appropriate place-bond or scene anchor

Bad Requirement uses:

- replacing `ForType` with tag logic when lineage restriction is actually intended
- using `Motivation` to encode a body plan, weapon kit, or single taboo weakness
- using Requirements to rescue a vague motivation that should be split instead

## Behavior Override Guidance

Motivation is the slot most explicitly allowed to override or redirect the
default assumptions of the base and domain.

Use `Motivation` when you want to say:

- this guardian is not merely place-bound, it is actively vengeful
- this predator is not merely hungry, it is selective and ritualistic
- this dead thing is not merely grave-bound, it is hunting a specific bloodline
- this outsider is not merely infernal, it is here to recruit rather than kill
- this being becomes much harder to sway in social battle when its central
  drive is directly engaged

That means `Motivation` can legitimately change:

- target choice
- pursuit pattern
- degree of aggression
- willingness to negotiate
- what the being protects
- whether it attacks, lures, waits, recruits, hoards, punishes, or flees
- how much `Drive` it can bring to bear in a social battle when its core
  motive is at stake

## Reuse Summary

To make authoring easier, every current motivation concept should be treated as
one of two things:

- `Shared across multiple bases`
  - the concept is intentionally reusable, even if each base still needs its
    own authored ChangeSet variant
- `Single-family only`
  - the concept is currently intended for one lineage only and should not be
    reused unless a broader version is later designed on purpose

Current reusable motivation concepts:

- `Guardian`
  - `NatureSpirit`
  - `People`
  - `Construct`
- `Hunter`
  - `Beast`
  - `TheUnseen`
  - `Zone`
- `Lurer`
  - `NatureSpirit`
  - `Zone`
  - `HiddenFolk`
- `Territorial`
  - `Beast`
  - `NatureSpirit`
  - `HiddenFolk`
- `Vengeful`
  - `Undead`
  - `Cursed`
  - `People`
- `Hungry`
  - `Beast`
  - `Colossal`
  - `Undead`
- `Protector of Kin`
  - `People`
  - `Beast`
- `High Drive When Pressed`
  - `People`
  - `Undead`
  - `Unnatural`

Current single-family motivation concepts:

- `Recruiter`
  - `Unnatural`
- `Preserve the Hidden Order`
  - `TheUnseen`
- `Await the Summons`
  - `Construct`
- `Return to the House`
  - `Undead`
- `Fulfill the Curse`
  - `Cursed`
- `Manifest the Zone`
  - `ZoneColossus`

## Shared Motivation Catalog

### `Guardian`

Allowed families:

```yaml
Group: Motivation
ForTypeAny: false
ForType_NatureSpirit: true
ForType_People: true
ForType_Construct: true
```

Authoring classification:

- `Shared concept, separate family variants recommended`

Recommended authored ChangeSet variants:

- `Guardian (NatureSpirit)`
- `Guardian (People)`
- `Guardian (Construct)`

Recommended expressions:

- `NatureSpirit`
  - intended feel: protects grove, stream, homestead, or sacred patch, warns before punishing
  - granted power ideas:
    - `Turn Back the Threat`

- `People`
  - intended feel: guard-post loyalty, watch duty, defense of charge or holding
  - granted power ideas:
    - `Stand the Post`

- `Construct`
  - intended feel: literal imposed warding function, no fear of harm to itself
  - granted power ideas:
    - `Hold to the Command`

### `Hunter`

Allowed families:

```yaml
Group: Motivation
ForTypeAny: false
ForType_Beast: true
ForType_TheUnseen: true
ForType_Zone: true
```

Authoring classification:

- `Shared concept, separate family variants recommended`

Recommended authored ChangeSet variants:

- `Hunter (Beast)`
- `Hunter (TheUnseen)`
- `Hunter (Zone)`

Recommended expressions:

- `Beast`
  - intended feel: prey-driven, instinctive, and physical
  - granted power ideas:
    - `Follow the Quarry`

- `TheUnseen`
  - intended feel: sovereign pursuit, chosen quarry, and terrible inevitability
  - granted power ideas:
    - `Mark the Chosen Prey`

- `Zone`
  - intended feel: patient stalking, isolation pressure, and sudden overtaking
  - granted power ideas:
    - `Never Lose the Trail`

### `Lurer`

Allowed families:

```yaml
Group: Motivation
ForTypeAny: false
ForType_NatureSpirit: true
ForType_Zone: true
ForType_HiddenFolk: true
```

Authoring classification:

- `Shared concept, separate family variants recommended`

Recommended authored ChangeSet variants:

- `Lurer (NatureSpirit)`
- `Lurer (Zone)`
- `Lurer (HiddenFolk)`

Recommended expressions:

- `NatureSpirit`
  - intended feel: misleads threats into water, bog, cold, roots, or getting lost
  - granted power ideas:
    - `Lead to the Bad Ground`

- `Zone`
  - intended feel: false rescue, wrong voice, impossible near-at-hand pull
  - granted power ideas:
    - `Let Them Follow`

- `HiddenFolk`
  - intended feel: seduction, testing, mockery, or dangerous invitation under elder custom
  - granted power ideas:
    - `Offer the Wrong Welcome`

### `Territorial`

Allowed families:

```yaml
Group: Motivation
ForTypeAny: false
ForType_Beast: true
ForType_NatureSpirit: true
ForType_HiddenFolk: true
```

Authoring classification:

- `Shared concept, separate family variants recommended`

Recommended authored ChangeSet variants:

- `Territorial (Beast)`
- `Territorial (NatureSpirit)`
- `Territorial (HiddenFolk)`

Recommended expressions:

- `Beast`
  - intended feel: den, range, young, and feeding ground defense
  - granted power ideas:
    - `Drive from the Range`

- `NatureSpirit`
  - intended feel: place-bonded response to intrusion, damage, neglect, or desecration
  - granted power ideas:
    - `The Place Rejects You`

- `HiddenFolk`
  - intended feel: old claim, parallel possession, and offense at trespass into overlapping ground
  - granted power ideas:
    - `Assert the Older Claim`

### `Vengeful`

Allowed families:

```yaml
Group: Motivation
ForTypeAny: false
ForType_Undead: true
ForType_Cursed: true
ForType_People: true
```

Authoring classification:

- `Shared concept, separate family variants recommended`

Recommended authored ChangeSet variants:

- `Vengeful (Undead)`
- `Vengeful (Cursed)`
- `Vengeful (People)`

Recommended expressions:

- `Undead`
  - intended feel: unfinished grievance, return for a wrong, and selective punishment
  - granted power ideas:
    - `Name the Wrongdoer`

- `Cursed`
  - intended feel: curse-driven retaliation against maker, betrayer, or target-class
  - granted power ideas:
    - `Strike the One Who Caused This`

- `People`
  - intended feel: feud, blood-price, revenge, or social wrong pursued into violence
  - granted power ideas:
    - `Settle the Wrong`

### `Hungry`

Allowed families:

```yaml
Group: Motivation
ForTypeAny: false
ForType_Beast: true
ForType_Colossal: true
ForType_Undead: true
```

Authoring classification:

- `Shared concept, separate family variants recommended`

Recommended authored ChangeSet variants:

- `Hungry (Beast)`
- `Hungry (Colossal)`
- `Hungry (Undead)`

Recommended expressions:

- `Beast`
  - intended feel: ordinary predation intensified by famine, season, or risk
  - granted power ideas:
    - `Commit to the Kill`

- `Colossal`
  - intended feel: catastrophe-beast feeding drive, ship-breaking appetite, and disaster through need
  - granted power ideas:
    - `Feed at Any Cost`

- `Undead`
  - intended feel: life-force hunger, corpse-hunger, or warmth-hunger that overrides caution
  - granted power ideas:
    - `Devour the Living`

### `Protector of Kin`

Allowed families:

```yaml
Group: Motivation
ForTypeAny: false
ForType_People: true
ForType_Beast: true
```

Authoring classification:

- `Shared concept, separate family variants recommended`

Recommended authored ChangeSet variants:

- `Protector of Kin (People)`
- `Protector of Kin (Beast)`

Recommended expressions:

- `People`
  - intended feel: household, children, spouse, band, or retainers defended at personal cost
  - granted power ideas:
    - `Step Between Them`

- `Beast`
  - intended feel: young defense, mate defense, and den-rage
  - granted power ideas:
    - `Defend the Young`

### `High Drive When Pressed`

Allowed families:

```yaml
Group: Motivation
ForTypeAny: false
ForType_People: true
ForType_Undead: true
ForType_Unnatural: true
```

Authoring classification:

- `Shared concept, separate family variants recommended`

Recommended authored ChangeSet variants:

- `High Drive When Pressed (People)`
- `High Drive When Pressed (Undead)`
- `High Drive When Pressed (Unnatural)`

Recommended expressions:

- `People`
  - intended feel: a mortal whose conviction hardens when kin, faith, oath, or honor is directly challenged
  - Drive guidance:
    - increase `Drive` in social battles when the challenge touches the specific loyalty or duty named by the motivation

- `Undead`
  - intended feel: an unquiet dead thing becoming harder to turn aside when its grievance, grave, or unfinished purpose is named or obstructed
  - Drive guidance:
    - increase `Drive` in social battles when opposed in the very matter that anchors its return

- `Unnatural`
  - intended feel: outsider resolve intensifying when recruitment, command, doctrine, or factional purpose is resisted
  - Drive guidance:
    - increase `Drive` in social battles when the target resists the outsider's central mission

### `Recruiter`

Allowed families:

```yaml
Group: Motivation
ForTypeAny: false
ForType_Unnatural: true
```

Authoring classification:

- `Family-specific only`

Recommended authored ChangeSet variants:

- `Recruiter (Unnatural)`

Use for:

- tempters
- devils
- outsider messengers seeking converts, vessels, or servants

Recommended expression:

- intended feel: active pressure to win allegiance rather than merely kill or frighten
- granted power ideas:
  - `Offer the Side`

### `Preserve the Hidden Order`

Allowed families:

```yaml
Group: Motivation
ForTypeAny: false
ForType_TheUnseen: true
```

Authoring classification:

- `Family-specific only`

Recommended authored ChangeSet variants:

- `Preserve the Hidden Order (TheUnseen)`

Use for:

- old-god-like powers of the Hidden Folk civilization
- rulers, patrons, and terrors maintaining the parallel world

Recommended expression:

- intended feel: civilizational preservation, magical continuity, and harsh judgment toward threats to the hidden order
- granted power ideas:
  - `Command in the Name of the Old Order`

### `Await the Summons`

Allowed families:

```yaml
Group: Motivation
ForTypeAny: false
ForType_Construct: true
```

Authoring classification:

- `Family-specific only`

Recommended authored ChangeSet variants:

- `Await the Summons (Construct)`

Use for:

- dormant guardians
- task-bound servitors
- constructs that remain still until command, breach, or activation

Recommended expression:

- intended feel: unnatural patience, dormancy, and sudden total obedience once triggered
- granted power ideas:
  - `Wake to Command`

### `Return to the House`

Allowed families:

```yaml
Group: Motivation
ForTypeAny: false
ForType_Undead: true
```

Authoring classification:

- `Family-specific only`

Recommended authored ChangeSet variants:

- `Return to the House (Undead)`

Use for:

- living dead spouses
- domestic hauntings
- dead that continue trying to inhabit old routines

Recommended expression:

- intended feel: tragic repetition, domestic wrongness, and attachment to household identity after death
- granted power ideas:
  - `Resume the Old Habit`

### `Fulfill the Curse`

Allowed families:

```yaml
Group: Motivation
ForTypeAny: false
ForType_Cursed: true
```

Authoring classification:

- `Family-specific only`

Recommended authored ChangeSet variants:

- `Fulfill the Curse (Cursed)`

Use for:

- cursed beings compelled toward transformation, killing pattern, omen, or repeated act

Recommended expression:

- intended feel: inescapable compulsion, recurrence, and partial loss of choice under imposed magical fate
- granted power ideas:
  - `The Pattern Repeats`

### `Manifest the Zone`

Allowed families:

```yaml
Group: Motivation
ForTypeAny: false
ForType_ZoneColossus: true
```

Authoring classification:

- `Family-specific only`

Recommended authored ChangeSet variants:

- `Manifest the Zone (ZoneColossus)`

Use for:

- severed hand-like disasters
- colossal wrongness whose mere movement expands, declares, or intensifies the Zone

Recommended expression:

- intended feel: not predation alone, but active making-real of warped locality at immense scale
- granted power ideas:
  - `Bring the Wrongness With It`

## Motivation Authoring Checklist

When writing a new `Motivation` ChangeSet or spec entry, confirm:

1. What is the stable motivation concept?
2. What is its authoring classification?
3. Is it cross-family or family-limited?
4. Which `ForType_*` flags should be enabled?
5. Are extra Requirements needed?
6. What belongs in `Motivation` rather than `Domain`, `Loadout`, or `Quirk`?
7. What behavior override does this create at the scene level?

## Recommended Initial Motivation Families

The first broadly reusable `Motivation` concepts should be:

- `Guardian`
- `Hunter`
- `Lurer`
- `Territorial`
- `Vengeful`
- `Hungry`
- `Protector of Kin`
- `High Drive When Pressed`

The first clearly family-limited examples should be:

- `Recruiter`
- `Preserve the Hidden Order`
- `Await the Summons`
- `Return to the House`
- `Fulfill the Curse`
- `Manifest the Zone`

## Recommended Next Step

After approving this model, the next documentation pass should:

1. continue extending shared slot catalogs so every base family is represented
   without reintroducing family-only specialization documents
2. backfill any obviously missing single-family examples in `Domain`, `Loadout`,
   `Quirk`, or `Motivation`
3. start authoring actual slot combinations as reference monster packages
