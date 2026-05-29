# Quirk Specializations Starter Spec v1

This document defines the shared authoring model for `Quirk` ChangeSets.

Unlike base-monster specs, this document is organized by slot type rather than
by monster family. Its purpose is to make `Quirk` reusable across compatible
families while still supporting explicit restrictions for quirks that only fit
specific lineages.

It should be read alongside:

- `monster-creation-guide.md`
- `monster-maker-spec-v1.md`
- `domain-specializations-starter-spec-v1.md`
- `loadout-specializations-starter-spec-v1.md`
- family base specs such as `hidden-folk-base-starter-spec-v1.md`,
  `undead-base-starter-spec-v1.md`, and `cursed-base-starter-spec-v1.md`

## Purpose Of Quirk

`Quirk` is the slot that gives a being its distinctive twist: the habit,
limitation, fixation, eerie sign, folkloric rule, strange personal pattern, or
specific strength or weakness that makes it feel specific rather than generic.

A good `Quirk` answers questions like:

- what unusual trait makes this creature memorable?
- what rule, fixation, weakness, or sign changes how scenes around it play out?
- what special strength, immunity, advantage, vulnerability, or taboo changes
  how it should be approached?
- what detail would witnesses repeat afterward?
- what changes about interacting with this version beyond lineage and domain?

`Quirk` is not:

- the creature's lineage
- its main source of power
- its weapon or armor configuration
- its deeper agenda or long-term purpose

Those belong primarily to `TypeDropdown`, `Domain`, `Loadout`, and `Motivation`.

Specific strengths and weaknesses should usually live in `Quirk` when they are:

- folkloric
- situational
- rule-like
- memorable enough that witnesses would warn others about them

Examples:

- cannot cross running water
- strengthened by moonlight
- weakened by iron
- cannot bear church bells
- cannot enter without invitation
- heals in darkness
- loses force away from burial ground

Purely broad statistical toughness or baseline attack shape still belongs more
often in `Loadout` or the base monster chassis.

## Reuse Rule

The default design goal is:

- keep `Quirk` reusable across monster families when the concept remains clear

Examples:

- `Half-Seen`
- `Easily Offended`
- `Cannot Cross Threshold`
- `Voice Like a Lure`
- `Smells the Living`
- `Collects the Dead`
- `Speaks in Bargains`
- `Breaks Mirrors`

These can mean different things for different families while still sharing one
quirk concept:

- `HiddenFolk + Easily Offended` means fierce response to insult, broken courtesy, or bad conduct
- `NatureSpirit + Voice Like a Lure` means fatal beckoning through the environment
- `Undead + Smells the Living` means dead attention drawn to warmth, breath, or blood
- `Unnatural + Speaks in Bargains` means infernal or factional pressure through negotiated temptation

## Applicability Model

Every `Quirk` ChangeSet should explicitly declare whether it is:

1. cross-family
2. family-limited
3. subtype-limited within a family

### 1. Cross-family quirks

Use this when the quirk concept is valid for multiple lineages.

Recommended authoring pattern:

```yaml
Group: Quirk
ForTypeAny: false
ForType_HiddenFolk: true
ForType_NatureSpirit: true
ForType_Undead: true
```

Then add Requirements only if the quirk needs extra structural constraints.

### 2. Family-limited quirks

Use this when the quirk only makes sense for one base family.

Recommended authoring pattern:

```yaml
Group: Quirk
ForTypeAny: false
ForType_Zone: true
```

Examples:

- `Cannot Be Fully Seen`
- `Must Be Invited`
- `Wrong Reflection`

### 3. Subtype-limited quirks

Use this when the quirk is legal for a family, but only for actors that already
carry some narrower identity.

Recommended authoring pattern:

```yaml
Group: Quirk
ForTypeAny: false
ForType_Undead: true
Requirements:
  - HasTag: Undead
  - GroupPresent: Domain
```

The exact predicates will vary, but the rule is consistent:

- use `ForType` for lineage eligibility
- use `Requirements` for narrower structural eligibility

Do not try to encode all nuance in the name of the ChangeSet.

## Requirements Guidance

Requirements on `Quirk` should answer:

- what must already be true for this strange behavior, sign, or limitation to
  make sense on this actor?

Good Requirement candidates:

- `HasTag`
  - example: a quirk that assumes `Undead`, `Artificial`, `Glamour`,
    `Otherworldly`, or `WaterBound`
- `GroupPresent`
  - example: a quirk that only makes sense if a certain `Domain` or `Loadout`
    has already been chosen
- `StatAtLeast`
  - example: a lure-voice or command quirk that assumes notable `Power` or
    `Charisma`

Bad Requirement uses:

- replacing `ForType` with tag logic when lineage restriction is actually intended
- using `Quirk` to encode a whole combat kit or social role
- using Requirements to rescue a vague quirk that should instead be split

## Strengths And Weaknesses Guidance

Use `Quirk` for strengths and weaknesses when they are:

- conditional rather than always-on baseline stats
- folkloric rather than generic simulation logic
- something players or NPCs could discover, exploit, fear, or prepare for
- part of the being's story-shape rather than only its body plan

Good fits for `Quirk`:

- `Cannot Cross Threshold`
- `Burned by Iron`
- `Strengthens in Moonlight`
- `Cannot Abide Bells`
- `Heals in Darkness`
- `Bound to the Grave-Gift`
- `Must Be Invited`

Usually not `Quirk`:

- ordinary armor value
- normal weapon reach
- broad movement profile
- default body toughness

Those usually belong in `Loadout`, `Domain`, or the base chassis unless they
take on a specific folkloric rule form.

## Reuse Summary

To make authoring easier, every current quirk concept should be treated as one
of two things:

- `Shared across multiple bases`
  - the concept is intentionally reusable, even if each base still needs its
    own authored ChangeSet variant
- `Single-family only`
  - the concept is currently intended for one lineage only and should not be
    reused unless a broader version is later designed on purpose

Current reusable quirk concepts:

- `Half-Seen`
  - `HiddenFolk`
  - `Zone`
  - `TheUnseen`
- `Easily Offended`
  - `HiddenFolk`
  - `NatureSpirit`
- `Voice Like a Lure`
  - `NatureSpirit`
  - `Zone`
- `Smells the Living`
  - `Beast`
  - `Undead`
- `Speaks in Bargains`
  - `TheUnseen`
  - `Unnatural`
- `Restless`
  - `Undead`
  - `Cursed`
- `Protective of Its Own`
  - `Beast`
  - `People`
- `Burned by Iron`
  - `HiddenFolk`
  - `NatureSpirit`
  - `TheUnseen`
- `Must Be Invited`
  - `HiddenFolk`
  - `Unnatural`
  - `Undead`

Current single-family quirk concepts:

- `Cannot Be Fully Seen`
  - `Zone`
- `Wrong Reflection`
  - `Unnatural`
- `Only by Night`
  - `Cursed`
- `Bound to the Grave-Gift`
  - `Undead`
- `Never Stops Watching`
  - `Construct`
- `Too Large for Shelter`
  - `Colossal`
- `Strengthens in Moonlight`
  - `Cursed`

## Shared Quirk Catalog

### `Half-Seen`

Allowed families:

```yaml
Group: Quirk
ForTypeAny: false
ForType_HiddenFolk: true
ForType_Zone: true
ForType_TheUnseen: true
```

Authoring classification:

- `Shared concept, separate family variants recommended`

Recommended authored ChangeSet variants:

- `Half-Seen (HiddenFolk)`
- `Half-Seen (Zone)`
- `Half-Seen (TheUnseen)`

Recommended expressions:

- `HiddenFolk`
  - intended feel: glamour, parallel presence, and chosen visibility
  - granted power ideas:
    - `Withdraw from Sight`

- `Zone`
  - intended feel: perception failure, uncertainty, and wrong glimpses
  - granted power ideas:
    - `Not Where You Thought`

- `TheUnseen`
  - intended feel: impossible majesty not fully safe to perceive directly
  - granted power ideas:
    - `Look Away or Bow`

### `Easily Offended`

Allowed families:

```yaml
Group: Quirk
ForTypeAny: false
ForType_HiddenFolk: true
ForType_NatureSpirit: true
```

Authoring classification:

- `Shared concept, separate family variants recommended`

Recommended authored ChangeSet variants:

- `Easily Offended (HiddenFolk)`
- `Easily Offended (NatureSpirit)`

Recommended expressions:

- `HiddenFolk`
  - intended feel: insult, broken courtesy, and quick magical reprisal
  - granted power ideas:
    - `Answer the Insult`

- `NatureSpirit`
  - intended feel: trespass, neglect, and protective reaction to mistreatment
  - granted power ideas:
    - `Take Offense at the Harm`

### `Voice Like a Lure`

Allowed families:

```yaml
Group: Quirk
ForTypeAny: false
ForType_NatureSpirit: true
ForType_Zone: true
```

Authoring classification:

- `Shared concept, separate family variants recommended`

Recommended authored ChangeSet variants:

- `Voice Like a Lure (NatureSpirit)`
- `Voice Like a Lure (Zone)`

Recommended expressions:

- `NatureSpirit`
  - intended feel: beckoning, beauty, warning mistaken for invitation
  - granted power ideas:
    - `Call to the Water`

- `Zone`
  - intended feel: wrong familiarity, false rescue, and bad following instinct
  - granted power ideas:
    - `Call from the Wrong Side`

### `Smells the Living`

Allowed families:

```yaml
Group: Quirk
ForTypeAny: false
ForType_Beast: true
ForType_Undead: true
```

Authoring classification:

- `Shared concept, separate family variants recommended`

Recommended authored ChangeSet variants:

- `Smells the Living (Beast)`
- `Smells the Living (Undead)`

Recommended expressions:

- `Beast`
  - intended feel: scent-tracking, blood-awareness, and instinctive pursuit
  - granted power ideas:
    - `Follow the Blood-Scent`

- `Undead`
  - intended feel: warmth-seeking, breath-seeking, and the dead drawn to life
  - granted power ideas:
    - `Find the Warm Heart`

### `Speaks in Bargains`

Allowed families:

```yaml
Group: Quirk
ForTypeAny: false
ForType_TheUnseen: true
ForType_Unnatural: true
```

Authoring classification:

- `Shared concept, separate family variants recommended`

Recommended authored ChangeSet variants:

- `Speaks in Bargains (TheUnseen)`
- `Speaks in Bargains (Unnatural)`

Recommended expressions:

- `TheUnseen`
  - intended feel: old law, gift-for-gift, and dangerous unequal exchange
  - granted power ideas:
    - `Name the Price`

- `Unnatural`
  - intended feel: infernal, coercive, tempting, and binding through factional purpose
  - granted power ideas:
    - `Close the Pact`

### `Restless`

Allowed families:

```yaml
Group: Quirk
ForTypeAny: false
ForType_Undead: true
ForType_Cursed: true
```

Authoring classification:

- `Shared concept, separate family variants recommended`

Recommended authored ChangeSet variants:

- `Restless (Undead)`
- `Restless (Cursed)`

Recommended expressions:

- `Undead`
  - intended feel: cannot settle, cannot lie fully still, and driven by unresolved return
  - granted power ideas:
    - `Rise Again Too Soon`

- `Cursed`
  - intended feel: bodily agitation, recurring transformation pressure, and inability to remain safe in one state
  - granted power ideas:
    - `The Curse Stirs`

### `Protective of Its Own`

Allowed families:

```yaml
Group: Quirk
ForTypeAny: false
ForType_Beast: true
ForType_People: true
```

Authoring classification:

- `Shared concept, separate family variants recommended`

Recommended authored ChangeSet variants:

- `Protective of Its Own (Beast)`
- `Protective of Its Own (People)`

Recommended expressions:

- `Beast`
  - intended feel: pack defense, den defense, young defense, and explosive reaction to threat
  - granted power ideas:
    - `Defend the Pack`

- `People`
  - intended feel: household loyalty, watch loyalty, kin duty, and local solidarity under pressure
  - granted power ideas:
    - `Stand for Their Own`

### `Burned by Iron`

Allowed families:

```yaml
Group: Quirk
ForTypeAny: false
ForType_HiddenFolk: true
ForType_NatureSpirit: true
ForType_TheUnseen: true
```

Authoring classification:

- `Shared concept, separate family variants recommended`

Recommended authored ChangeSet variants:

- `Burned by Iron (HiddenFolk)`
- `Burned by Iron (NatureSpirit)`
- `Burned by Iron (TheUnseen)`

Recommended expressions:

- `HiddenFolk`
  - intended feel: iron as hostile intrusion against glamour and elder hidden being
  - granted power ideas:
    - `Recoil from Cold Iron`

- `NatureSpirit`
  - intended feel: iron as cutting, civilizing, or harmful force against place-bound being
  - granted power ideas:
    - `Shrink from the Worked Blade`

- `TheUnseen`
  - intended feel: iron as old mortal check against dangerous high hidden power
  - granted power ideas:
    - `Majesty Checked by Iron`

### `Must Be Invited`

Allowed families:

```yaml
Group: Quirk
ForTypeAny: false
ForType_HiddenFolk: true
ForType_Unnatural: true
ForType_Undead: true
```

Authoring classification:

- `Shared concept, separate family variants recommended`

Recommended authored ChangeSet variants:

- `Must Be Invited (HiddenFolk)`
- `Must Be Invited (Unnatural)`
- `Must Be Invited (Undead)`

Recommended expressions:

- `HiddenFolk`
  - intended feel: threshold custom, courtesy-law, and dangerous respect for boundaries
  - granted power ideas:
    - `Wait Beyond the Door`

- `Unnatural`
  - intended feel: invitation as breach-permission for an outsider force that should not otherwise enter
  - granted power ideas:
    - `Cross on Welcome`

- `Undead`
  - intended feel: domestic haunting logic, return denied unless the house or kin allow it
  - granted power ideas:
    - `Stand at the Lintel`

### `Strengthens in Moonlight`

Allowed families:

```yaml
Group: Quirk
ForTypeAny: false
ForType_Cursed: true
```

Authoring classification:

- `Family-specific only`

Recommended authored ChangeSet variants:

- `Strengthens in Moonlight (Cursed)`

Use for:

- werewolves
- night-transformed curse-beings
- magic-changed predators whose force waxes with moon or night

Recommended expression:

- intended feel: visible increase in force, confidence, or bodily wrongness under night conditions
- granted power ideas:
  - `Wax with the Moon`

## Quirk Authoring Checklist

When writing a new `Quirk` ChangeSet or spec entry, confirm:

1. What is the stable quirk concept?
2. What is its authoring classification?
3. Is it cross-family or family-limited?
4. Which `ForType_*` flags should be enabled?
5. Are extra Requirements needed?
6. What belongs in `Quirk` rather than `Domain`, `Loadout`, or `Motivation`?
7. What memorable scene-level twist, exploitable strength, or exploitable weakness does this create?

## Recommended Initial Quirk Families

The first broadly reusable `Quirk` concepts should be:

- `Half-Seen`
- `Easily Offended`
- `Voice Like a Lure`
- `Smells the Living`
- `Speaks in Bargains`
- `Restless`
- `Protective of Its Own`
- `Burned by Iron`
- `Must Be Invited`

The first clearly family-limited examples should be:

- `Cannot Be Fully Seen`
- `Wrong Reflection`
- `Only by Night`
- `Bound to the Grave-Gift`
- `Never Stops Watching`
- `Too Large for Shelter`
- `Strengthens in Moonlight`

## Recommended Next Step

After approving this model, the next documentation pass should:

1. create a shared slot-based spec for `Motivation`
2. move any family-specific overlay content into that slot spec as needed
3. continue extending shared slot catalogs so every base family is represented
   without reintroducing family-only specialization documents
