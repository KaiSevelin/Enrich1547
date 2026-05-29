# Domain Specializations Starter Spec v1

This document defines the shared authoring model for `Domain` ChangeSets.

Unlike base-monster specs, this document is organized by slot type rather than
by monster family. Its purpose is to make `Domain` reusable across compatible
families while still supporting explicit restrictions for domains that only fit
specific lineages.

It should be read alongside:

- `monster-creation-guide.md`
- `monster-maker-spec-v1.md`
- family base specs such as `hidden-folk-base-starter-spec-v1.md`,
  `nature-spirit-base-starter-spec-v1.md`, and
  `the-unseen-base-starter-spec-v1.md`

## Purpose Of Domain

`Domain` is the slot that describes a creature's source of power and its scene
logic.

A good `Domain` answers questions like:

- where is this being strongest?
- what sort of environment or threshold matters to it?
- what blessings, hazards, or constraints naturally follow from that place?
- what does the world feel like when it is present?

`Domain` is not:

- the creature's species name
- its full personality
- a complete loadout
- a one-off unique gimmick

Those belong primarily to `TypeDropdown`, `Motivation`, `Loadout`, and `Quirk`.

## Reuse Rule

The default design goal is:

- keep `Domain` reusable across monster families when the concept remains clear

Examples:

- `Wood`
- `Water`
- `Hill`
- `Underground`
- `Hearth`
- `Settlement`
- `Bog`
- `Stone`
- `Mountain`
- `Corrupted`
- `Severed`

These can mean different things for different families while still sharing one
domain concept:

- `HiddenFolk + Water` means elder parallel beings of crossings, wells, and banks
- `NatureSpirit + Water` means a place-bound spirit of flow, reflection, and depth
- `TheUnseen + Water` means a sovereign or mythic ruler of water and crossing
- `Colossal + Water` means an immense sea-beast or deep predator whose presence turns water into catastrophe
- `People + Settlement` means human opposition rooted in village, ward, street, or holding rather than in wilderness or court

## Applicability Model

Every `Domain` ChangeSet should explicitly declare whether it is:

1. cross-family
2. family-limited
3. subtype-limited within a family

### 1. Cross-family domains

Use this when the domain concept is valid for multiple lineages.

Recommended authoring pattern:

```yaml
Group: Domain
ForTypeAny: false
ForType_HiddenFolk: true
ForType_NatureSpirit: true
ForType_TheUnseen: true
```

Then add Requirements only if the domain needs extra structural constraints.

### 2. Family-limited domains

Use this when the domain only makes sense for one base family.

Recommended authoring pattern:

```yaml
Group: Domain
ForTypeAny: false
ForType_TheUnseen: true
```

or the equivalent family flag for `HiddenFolk`, `NatureSpirit`, or another type.

Examples:

- `Courtly`
- `Smokeless Fire`
- `Winter Matron`
- `Golem`
- `Homunculus`
- `Brazen Head`
- `Wax Servitor`

These are domains or offices that are not meant to be shared broadly.

### 3. Subtype-limited domains

Use this when the domain is legal for a family, but only for actors that already
carry some narrower identity.

Recommended authoring pattern:

```yaml
Group: Domain
ForTypeAny: false
ForType_NatureSpirit: true
Requirements:
  - HasTag: PlaceBound
  - StatAtLeast: MoveClimb >= 1
```

The exact predicates will vary, but the rule is consistent:

- use `ForType` for lineage eligibility
- use `Requirements` for narrower structural eligibility

Do not try to encode all nuance in the name of the ChangeSet.

## Requirements Guidance

Requirements on `Domain` should answer:

- what must already be true for this domain to make sense on this actor?

Good Requirement candidates:

- `HasTag`
  - example: a domain variant that only makes sense for actors already marked
    `PlaceBound`, `Glamour`, `WaterBound`, or `OathBound`
- `StatAtLeast`
  - example: a highland or mounted domain that expects unusual movement
- `PrimaryStatAtLeast`
  - example: a domain reserved for beings with exceptional `Power` or `Faith`
- `HasSkill`
  - example: a domain that expects a specific authored practice or training hook
- `GroupPresent`
  - mainly for later-phase specializations if the domain model ever becomes layered

Bad Requirement uses:

- replacing `ForType` with tags alone when lineage restriction is actually intended
- using Requirements to hide a weak or confused domain concept
- depending on future groups that have not yet applied

## Shared Domain Catalog

A reusable domain keeps the concept stable while allowing the expression to
differ by base family.

The entries below replace the need for separate family-specific domain
specialization documents.

## Reuse Summary

To make authoring easier, every current domain concept should be treated as one
of two things:

- `Shared across multiple bases`
  - the concept is intentionally reusable, even if each base still needs its
    own authored ChangeSet variant
- `Single-family only`
  - the concept is currently intended for one lineage only and should not be
    reused unless a broader version is later designed on purpose

Current reusable domain concepts:

- `Wood`
  - `HiddenFolk`
  - `NatureSpirit`
  - `Beast`
- `Water`
  - `HiddenFolk`
  - `NatureSpirit`
  - `TheUnseen`
  - `Colossal`
- `Hill`
  - `HiddenFolk`
  - `NatureSpirit`
- `Hearth`
  - `HiddenFolk`
  - `NatureSpirit`
  - `TheUnseen`
- `Settlement`
  - `HiddenFolk`
  - `NatureSpirit`
  - `People`
- `Battlefield`
  - `People`
  - `Undead`
- `Deep Zone`
  - `Zone`
  - `ZoneColossus`

Current single-family domain concepts:

- `Underground`
  - `HiddenFolk`
- `Bog`
  - `NatureSpirit`
- `Stone`
  - `NatureSpirit`
- `Mountain`
  - `NatureSpirit`
- `Corrupted`
  - `NatureSpirit`
- `Severed`
  - `NatureSpirit`
- `Courtly`
  - `TheUnseen`
- `Hunt`
  - `TheUnseen`
- `Smokeless Fire`
  - `TheUnseen`
- `Winter`
  - `TheUnseen`
- `Grave`
  - `Undead`
- `Moon-Bound`
  - `Cursed`
- `Witch-Made`
  - `Cursed`
- `Infernal`
  - `Unnatural`
- `Angelic`
  - `Unnatural`
- `Border Zone`
  - `Zone`
- `Golem`
  - `Construct`
- `Homunculus`
  - `Construct`
- `Brazen Head`
  - `Construct`
- `Wax Servitor`
  - `Construct`

### Authoring classifications

Each domain entry should be classified one of three ways for actual authored
ChangeSets:

- `Single shared ChangeSet possible`
  - use this when the same tags, stat shifts, and granted powers can apply
    across every allowed family without flattening important differences
- `Shared concept, separate family variants recommended`
  - use this when the same domain concept is shared, but the actual mechanics
    or granted items differ meaningfully by family
- `Family-specific only`
  - use this when the domain concept itself is already doing lineage-specific
    work and should not be treated as broadly reusable

In the current architecture, most cross-family domains are likely to be
`Shared concept, separate family variants recommended`, because one authored
ChangeSet cannot easily express different mechanical payloads for different
families.

### `Wood`

Stable concept:

- cover
- roots
- path confusion
- old growth and hidden watching

Allowed families:

```yaml
Group: Domain
ForTypeAny: false
ForType_HiddenFolk: true
ForType_NatureSpirit: true
ForType_Beast: true
```

Authoring classification:

- `Shared concept, separate family variants recommended`

Recommended authored ChangeSet variants:

- `Wood (HiddenFolk)`
- `Wood (NatureSpirit)`
- `Wood (Beast)`

Recommended expressions:

- `HiddenFolk`
  - use for woodland hidden folk, leaf-shadow beings, and elder parallel inhabitants of forest margins and hidden paths
  - intended feel: elusive, proud, magical, and difficult to approach on human terms
  - passive rule ideas:
    - `WoodlandBound` / `Of Hidden Track and Canopy`
    - `Glamour` / `Walks the Green Parallel`
  - stat ideas:
    - `MoveClimb +1`
  - granted power ideas:
    - `Lead Astray`
    - `Thorn Snare`
    - `Leaf-Shadow Escape`

- `NatureSpirit`
  - use for skogsra, dryads, wood-wives, and grove spirits
  - intended feel: watchful, beautiful or half-seen, patient until trespass becomes insult
  - passive rule ideas:
    - `WoodlandBound` / `Of Root and Canopy`
    - `Glamour` / `Knows the Deer Paths`
  - stat ideas:
    - `MoveClimb +2`
  - granted power ideas:
    - `Turn the Path`
    - `Branch and Briar`
    - `Green Blessing`

- `Beast`
  - use for wolves, boars, bears, and other dangerous woodland animals
  - intended feel: natural, territorial, scent-driven, and difficult to corner in cover
  - passive rule ideas:
    - `LivingCreature` / `At Home in Cover and Track`
    - `SenseLiving` / `Knows the Game Paths`
  - stat ideas:
    - `MoveGround +1`
    - `MoveClimb +1` for appropriate animal shapes
  - granted power ideas:
    - `Break from the Brush`
    - `Ambush from Cover`
    - `Scent the Intruder`

### `Water`

Stable concept:

- crossing
- reflection
- depth
- invitation and danger

Allowed families:

```yaml
Group: Domain
ForTypeAny: false
ForType_HiddenFolk: true
ForType_NatureSpirit: true
ForType_TheUnseen: true
ForType_Colossal: true
```

Authoring classification:

- `Shared concept, separate family variants recommended`

Recommended authored ChangeSet variants:

- `Water (HiddenFolk)`
- `Water (NatureSpirit)`
- `Water (TheUnseen)`
- `Water (Colossal)`

Recommended expressions:

- `HiddenFolk`
  - use for brook-side hidden folk, ford dwellers of the parallel ways, and lakeshore beings with their own hidden claims
  - intended feel: enticing, proud, difficult to read, and quick to answer disrespect with magical reprisal
  - passive rule ideas:
    - `WaterBound` / `Of Hidden Ford and Reflection`
    - `ThresholdAware` / `Keeps the Parallel Crossing`
  - stat ideas:
    - `MoveSwim = 5`
  - granted power ideas:
    - `Mirror-Lure`
    - `Slip from the Bank`
    - `Cold Pull`

- `NatureSpirit`
  - use for river wives, ford spirits, spring maidens, waterfall hauntings
  - intended feel: reflective, inviting and dangerous, tied to current and drowning beauty
  - passive rule ideas:
    - `WaterBound` / `Of Current and Depth`
    - `ThresholdAware` / `Keeper of the Crossing`
  - stat ideas:
    - `MoveSwim = 6`
  - granted power ideas:
    - `Beckoning Reflection`
    - `Drag Below`
    - `Waters Favor`

- `TheUnseen`
  - use for water sovereigns, ford maidens of high rank, mist-and-depth rulers
  - intended feel: beautiful, distant, vow-heavy, blessing and drowning close together
  - passive rule ideas:
    - `WaterBound` / `Of Depth and Crossing`
    - `ThresholdAware` / `Keeper of the Ford`
  - stat ideas:
    - `MoveSwim = 6`
  - granted power ideas:
    - `Drowning Summons`
    - `Gift from the Water`
    - `Mirror Revelation`

- `Colossal`
  - use for leviathans, kraken, and other immense sea or deep-water catastrophe-beasts
  - intended feel: remote, wakeful only in disaster, and overwhelming once the deep stirs
  - passive rule ideas:
    - `Massive` / `Of Depth and Open Water`
    - `Ravenous` / `The Deep Hungers`
  - stat ideas:
    - `MoveSwim = 7`
  - granted power ideas:
    - `Break the Hull`
    - `Rise from the Sounding Depth`
    - `Drag Beneath the Wake`

### `Hill`

Stable concept:

- old earth
- burial
- hidden chambers
- elevated watchfulness

Allowed families:

```yaml
Group: Domain
ForTypeAny: false
ForType_HiddenFolk: true
ForType_NatureSpirit: true
```

Authoring classification:

- `Shared concept, separate family variants recommended`

Recommended authored ChangeSet variants:

- `Hill (HiddenFolk)`
- `Hill (NatureSpirit)`

Recommended expressions:

- `HiddenFolk`
  - use for barrow folk, mound-dwellers, and elder hidden communities of hill and hollow
  - intended feel: old, proud, territorial, and conscious of prior claim
  - passive rule ideas:
    - `EarthBound` / `Of Mound and Hollow Hill`
    - `ThresholdAware` / `Keepers of the Older Claim`
  - stat ideas:
    - `Stats_FaithMod +1`
  - granted power ideas:
    - `Barrow Glamour`
    - `Call from the Hill`
    - `Old Curse`

- `NatureSpirit`
  - use for hill trolls, cliff-haunters, old stone slope wardens
  - intended feel: heavy, enduring, territorial
  - passive rule ideas may overlap with `Stone`
  - consider using `Stone` when the emphasis is rock and cliff, and `Hill`
    when the emphasis is mound, slope, or old earth-fast place

### `Underground`

Stable concept:

- beneath-earth habitation
- hidden chambers
- underways and buried roads
- enclosed dark belonging to older claimants

Allowed families:

```yaml
Group: Domain
ForTypeAny: false
ForType_HiddenFolk: true
```

Authoring classification:

- `Family-specific only`

Recommended authored ChangeSet variants:

- `Underground (HiddenFolk)`

Recommended expressions:

- `HiddenFolk`
  - use for under-earth hidden folk, chamber-dwellers, tunnel-haunters, and elder people who keep roads and halls below the human world
  - intended feel: enclosed, secretive, proud, and ancient, with a strong sense that humans walk over realms they do not know exist
  - passive rule ideas:
    - `EarthBound` / `Of Hall, Root, and Stone Below`
    - `ThresholdAware` / `Keepers of the Underways`
  - stat ideas:
    - `Stats_IntelligenceMod +1`
  - granted power ideas:
    - `Call Below`
    - `Lose the Lamp`
    - `Seal the Way`

### `Hearth`

Stable concept:

- threshold
- household order
- labor
- domestic blessing or punishment

Allowed families:

```yaml
Group: Domain
ForTypeAny: false
ForType_HiddenFolk: true
ForType_TheUnseen: true
```

Authoring classification:

- `Shared concept, separate family variants recommended`

Recommended authored ChangeSet variants:

- `Hearth (HiddenFolk)`
- `Hearth (TheUnseen)`

Recommended expressions:

- `HiddenFolk`
  - use for Hidden Folk whose parallel habitation presses close against human hearth, hall, byre, and boundary
  - intended feel: intimate but alien, prideful, and deeply attentive to how humans conduct themselves in shared ground
  - passive rule ideas:
    - `HearthBound` / `Beside the Human Fire`
    - `OfferingBound` / `Demands Proper Keeping`
  - stat ideas:
    - `Stats_IntelligenceMod +1`
  - granted power ideas:
    - `Household Blessing`
    - `Spoil the Work`
    - `Knack of the House`

- `TheUnseen`
  - use for winter matrons, household judges, domestic sovereign powers
  - intended feel: maternal and terrible, judges work, order, and conduct
  - passive rule ideas:
    - `HearthBound` / `Judge of House and Labor`
    - `DreamIntrusion` / `Touches the Sleeping`
  - stat ideas:
    - `Stats_FaithMod +1`
  - granted power ideas:
    - `Snow Blessing`
    - `Winter Sleep`
    - `Household Judgment`

### `Settlement`

Stable concept:

- inhabited place
- maintained thresholds
- domestic order
- human and nonhuman co-presence

Allowed families:

```yaml
Group: Domain
ForTypeAny: false
ForType_NatureSpirit: true
ForType_HiddenFolk: true
ForType_People: true
```

Authoring classification:

- `Shared concept, separate family variants recommended`

Recommended authored ChangeSet variants:

- `Settlement (HiddenFolk)`
- `Settlement (NatureSpirit)`
- `Settlement (People)`

Recommended expressions:

- `HiddenFolk`
  - use for Hidden Folk whose hidden settlements, routes, or courts overlap with roads, holdings, byres, lanes, and village edges
  - intended feel: watchful, proud, easily offended, and never fully reconciled to human occupation
  - passive rule ideas:
    - `HearthBound` / `Of Yard, Lane, and Hidden Threshold`
    - `OfferingBound` / `Requires Due Conduct`
  - stat ideas:
    - `Stats_IntelligenceMod +1`
  - granted power ideas:
    - `Spoil the Work`
    - `Household Blessing`
    - `Knack of the House`

- `NatureSpirit`
  - use for tomte-like beings, farmstead guardians, shrine spirits, and local protective presences tied to inhabited land
  - intended feel: protective, local, easily turned dangerous if the place is mistreated
  - passive rule ideas:
    - `ThresholdAware` / `Warden of the Holding`
    - `HearthBound` / `Bound to Homestead and Yard`
  - stat ideas:
    - `Stats_FaithMod +1`
  - granted power ideas:
    - `Blessing of the Holding`
    - `Lead the Trespasser Wrong`
    - `Withhold the Harvest`

- `People`
  - use for villagers, guards, thieves, town watch, retainers, and human opposition defined by street, yard, lane, wall, or holding
  - intended feel: socially legible, tied to authority, household, work, and local custom rather than to wilderness
  - passive rule ideas:
    - `SocialCreature` / `Of Street, Yard, and Holding`
    - `BreakableMorale` / `Knows the Local Order`
  - stat ideas:
    - `Stats_CharismaMod +1` for civic or guard variants
  - granted power ideas:
    - `Raise the Alarm`
    - `Hold the Lane`
    - `Call the Neighbors`

### `Bog`

Stable concept:

- stagnant water
- sinking ground
- rot
- swallowed remains

Allowed families:

```yaml
Group: Domain
ForTypeAny: false
ForType_NatureSpirit: true
```

Authoring classification:

- `Family-specific only`

Recommended authored ChangeSet variants:

- `Bog (NatureSpirit)`

Recommended expressions:

- `NatureSpirit`
  - use for mire spirits, marsh-lights, fen wardens, reed and rot beings
  - intended feel: slow, inescapable, ambiguous between warning and lure
  - passive rule ideas:
    - `RotTouched` / `Of Mire and Preservation`
    - `DifficultTerrain` / `The Ground Wants You`
  - stat ideas:
    - `Stats_StaminaMod +1`
  - granted power ideas:
    - `Mire-Clutch`
    - `Bog Breath`
    - `Corpse Light`

### `Stone`

Stable concept:

- cliff
- cave
- cairn
- exposed rock

Allowed families:

```yaml
Group: Domain
ForTypeAny: false
ForType_NatureSpirit: true
```

Authoring classification:

- `Family-specific only`

Recommended authored ChangeSet variants:

- `Stone (NatureSpirit)`

Recommended expressions:

- `NatureSpirit`
  - use for standing-stone wardens, cave-mouth beings, cairn spirits, stone-bound trolls
  - intended feel: heavy, enduring, territorial, hard to appease once roused
  - passive rule ideas:
    - `StoneBound` / `Of Stone and Silence`
    - `UnsettlingPresence` / `The Hill Is Watching`
  - stat ideas:
    - `Stats_StrengthMod +1`
  - granted power ideas:
    - `Stone-Handed Blow`
    - `Scree Fall`
    - `Stand Like Granite`

### `Mountain`

Stable concept:

- height
- exposure
- cold
- narrow footing

Allowed families:

```yaml
Group: Domain
ForTypeAny: false
ForType_NatureSpirit: true
```

Authoring classification:

- `Family-specific only`

Recommended authored ChangeSet variants:

- `Mountain (NatureSpirit)`

Recommended expressions:

- `NatureSpirit`
  - use for highland spirits, avalanche wardens, summit presences
  - intended feel: vast, cold, difficult to approach, punishing through height and weather
  - passive rule ideas:
    - `WeatherBound` / `Of Height and Exposure`
    - `FearAura` / `Thin Air of the Heights`
  - stat ideas:
    - `MoveClimb +3`
  - granted power ideas:
    - `Avalanche Warning`
    - `Cast from the Ledge`
    - `Breath of Cold Height`

### `Corrupted`

Stable concept:

- blighted place-bond
- hostile wrongness
- place turned against itself

Allowed families:

```yaml
Group: Domain
ForTypeAny: false
ForType_NatureSpirit: true
```

Authoring classification:

- `Family-specific only`

Recommended authored ChangeSet variants:

- `Corrupted (NatureSpirit)`

Recommended expressions:

- `NatureSpirit`
  - use for glo-so-like beings, blighted guardians, and spirits whose bond to place has become poisoned rather than severed
  - intended feel: pained, hostile, misdirecting, protective instincts turned malign
  - passive rule ideas:
    - `Corruptive` / `The Land Has Turned`
    - `UnsettlingPresence` / `Guardian in Rot`
  - stat ideas:
    - `Stats_PowerMod +1`
  - granted power ideas:
    - `Lead Into Ruin`
    - `Blighted Grasp`
    - `Withhold All Blessing`

### `Severed`

Stable concept:

- broken place-bond
- displacement
- guardian without true ground

Allowed families:

```yaml
Group: Domain
ForTypeAny: false
ForType_NatureSpirit: true
```

Authoring classification:

- `Family-specific only`

Recommended authored ChangeSet variants:

- `Severed (NatureSpirit)`

Recommended expressions:

- `NatureSpirit`
  - use for uprooted, displaced, land-lost spirits that no longer belong properly anywhere
  - intended feel: estranged, unstable, hungry for ground, no longer capable of healthy guardianship
  - passive rule ideas:
    - `Otherworldly` / `No Longer Held`
    - `UnsettlingPresence` / `Without a Place`
  - stat ideas:
    - `Stats_PowerMod +1`
  - granted power ideas:
    - `Wander the Wrong Way`
    - `Hungry Manifestation`
    - `Break the Boundary`

## Family-Limited Domain Catalog

Some domains should start life restricted to one family because the concept is
already doing lineage-specific work.

### `Grave`

Allowed families:

```yaml
Group: Domain
ForTypeAny: false
ForType_Undead: true
```

Authoring classification:

- `Family-specific only`

Recommended authored ChangeSet variants:

- `Grave (Undead)`

Use for:

- revenants
- draugr
- burial guardians
- dead bound to mound, tomb, or churchyard

Recommended expression:

- intended feel: burial claim, unquiet rest, and the pressure of improper death made local and physical
- Requirements guidance:
  - use Requirements when a grave-bound dead thing needs explicit burial wrongs, relic ties, or site-anchoring
- passive rule ideas:
  - `Undead` / `Bound to Tomb and Earth`
  - `UnsettlingPresence` / `The Grave Is Not Quiet`
- stat ideas:
  - `Stats_FaithMod +1`
- granted power ideas:
  - `Rise from the Grave`
  - `Cold of the Tomb`
  - `Drag Back to Earth`

### `Battlefield`

Allowed families:

```yaml
Group: Domain
ForTypeAny: false
ForType_People: true
ForType_Undead: true
```

Authoring classification:

- `Shared concept, separate family variants recommended`

Recommended authored ChangeSet variants:

- `Battlefield (People)`
- `Battlefield (Undead)`

Recommended expressions:

- `People`
  - use for soldiers, mercenaries, raiders, and disciplined armed opposition rooted in camp, march, and line of battle
  - intended feel: martial, ordered, exposed to command and morale
  - passive rule ideas:
    - `SocialCreature` / `Of Banner and Line`
    - `BreakableMorale` / `Holds Under Orders`
  - stat ideas:
    - `Stats_StaminaMod +1`
  - granted power ideas:
    - `Advance in Line`
    - `Rally to the Banner`
    - `Press the Rout`

- `Undead`
  - use for battle-dead, execution-dead, or dead that return from slaughter fields and broken lines
  - intended feel: relentless, grievance-bound, and full of old violence that never properly ended
  - passive rule ideas:
    - `Undead` / `Still on the Field`
    - `UnsettlingPresence` / `The Slain Return`
  - stat ideas:
    - `Stats_PowerMod +1`
  - granted power ideas:
    - `Rise Among the Fallen`
    - `Call the Old Slaughter`
    - `March Without Breath`

### `Moon-Bound`

Allowed families:

```yaml
Group: Domain
ForTypeAny: false
ForType_Cursed: true
```

Authoring classification:

- `Family-specific only`

Recommended authored ChangeSet variants:

- `Moon-Bound (Cursed)`

Use for:

- werewolves
- cyclical beast-transformations
- night-ruled curse-beings

Recommended expression:

- intended feel: imposed cycle, bodily wrongness, and recurrence tied to moon, night, or periodic transformation
- Requirements guidance:
  - use Requirements when the curse should depend on calendric trigger, visibility, or a specific transformation condition
- passive rule ideas:
  - `Cursed` / `Ruled by the Returning Moon`
  - `UnsettlingPresence` / `Night Changes the Flesh`
- stat ideas:
  - `Stats_DexterityMod +1`
  - `MoveGround +1`
- granted power ideas:
  - `Turn Under Moonlight`
  - `Night Scent`
  - `Lunar Frenzy`

### `Witch-Made`

Allowed families:

```yaml
Group: Domain
ForTypeAny: false
ForType_Cursed: true
```

Authoring classification:

- `Family-specific only`

Recommended authored ChangeSet variants:

- `Witch-Made (Cursed)`

Use for:

- witch-made beasts
- transformed toads, hares, or dogs
- curse-creatures shaped by malediction or sympathetic craft

Recommended expression:

- intended feel: intimate malice, bodily wrongness, and visible signs of having been made rather than naturally born into monstrosity
- Requirements guidance:
  - use Requirements when the transformation needs explicit maker, victim, or rite logic
- passive rule ideas:
  - `Cursed` / `Shaped by Witchcraft`
  - `Corruptive` / `Made Wrong by Hand and Spell`
- stat ideas:
  - `Stats_PowerMod +1`
- granted power ideas:
  - `Mark of Malediction`
  - `Witch-Bound Bite`
  - `Carry the Spell Forward`

### `Infernal`

Allowed families:

```yaml
Group: Domain
ForTypeAny: false
ForType_Unnatural: true
```

Authoring classification:

- `Family-specific only`

Recommended authored ChangeSet variants:

- `Infernal (Unnatural)`

Use for:

- devils
- contract-demons
- tempters of hierarchy and corruption

Recommended expression:

- intended feel: proud, contractual, coercive, and bound to factional order from below rather than to local myth or place
- Requirements guidance:
  - use Requirements when a being should also require speech, pact, or command logic
- passive rule ideas:
  - `Otherworldly` / `Of Contract and Damnation`
  - `OathBound` / `Bound by Infernal Rank`
- stat ideas:
  - `Stats_CharismaMod +1`
  - `Stats_PowerMod +1`
- granted power ideas:
  - `Seal the Bargain`
  - `Brand the Will`
  - `Smoke Through the Threshold`

### `Angelic`

Allowed families:

```yaml
Group: Domain
ForTypeAny: false
ForType_Unnatural: true
```

Authoring classification:

- `Family-specific only`

Recommended authored ChangeSet variants:

- `Angelic (Unnatural)`

Use for:

- cherubic war-servitors
- seraphic messengers
- rival faction powers of revelation, judgment, or terrible order

Recommended expression:

- intended feel: radiant, doctrinal, severe, and no less dangerous for seeming elevated
- Requirements guidance:
  - use Requirements when a being should also require heraldic, judicial, or revelation logic
- passive rule ideas:
  - `Otherworldly` / `Of Radiance and Sentence`
  - `OathBound` / `Bound by Celestial Rank`
- stat ideas:
  - `Stats_FaithMod +1`
  - `Stats_PowerMod +1`
- granted power ideas:
  - `Announce the Sentence`
  - `Blinding Presence`
  - `Command from Above`

### `Border Zone`

Allowed families:

```yaml
Group: Domain
ForTypeAny: false
ForType_Zone: true
```

Authoring classification:

- `Family-specific only`

Recommended authored ChangeSet variants:

- `Border Zone (Zone)`

Use for:

- threshold stalkers
- edge-haunters
- wrong things that prey where the safe world thins but has not yet vanished

Recommended expression:

- intended feel: half-near, half-withdrawn, tempting victims off the last trustworthy path
- Requirements guidance:
  - use Requirements when the being depends on roads, paths, hedges, or known routes near the Zone edge
- passive rule ideas:
  - `HalfSeen` / `At the Edge of Wrongness`
  - `ThresholdAware` / `Waits Where the Safe Path Ends`
- stat ideas:
  - `Stats_DexterityMod +1`
- granted power ideas:
  - `Call from the Verge`
  - `Mislead at the Boundary`
  - `Step Back into the Wrong Side`

### `Deep Zone`

Allowed families:

```yaml
Group: Domain
ForTypeAny: false
ForType_Zone: true
ForType_ZoneColossus: true
```

Authoring classification:

- `Shared concept, separate family variants recommended`

Recommended authored ChangeSet variants:

- `Deep Zone (Zone)`
- `Deep Zone (ZoneColossus)`

Recommended expressions:

- `Zone`
  - use for deep stalkers, manifestations, and predators of warped interiors where human sense has fully failed
  - intended feel: more alien, less traceable, and more confident than border-haunters
  - passive rule ideas:
    - `Otherworldly` / `Of the Inner Wrongness`
    - `SenseLiving` / `Knows the Lost Routes`
  - stat ideas:
    - `Stats_PowerMod +1`
  - granted power ideas:
    - `Erase the Track`
    - `Close from the Wrong Angle`
    - `No Safe Return`

- `ZoneColossus`
  - use for immense manifestations moving through the deep Zone as if the land itself had become catastrophic anatomy
  - intended feel: singular, impossible, and more like living disaster than pursuit-creature
  - passive rule ideas:
    - `Massive` / `The Inner Zone Has Risen`
    - `Otherworldly` / `Catastrophe of the Deep Wrongness`
  - stat ideas:
    - `Stats_StrengthMod +1`
    - `Stats_PowerMod +1`
  - granted power ideas:
    - `Tear Up the Ground`
    - `Advance Without Distance`
    - `Inner Zone Dread`

### `Golem`

Allowed families:

```yaml
Group: Domain
ForTypeAny: false
ForType_Construct: true
```

Authoring classification:

- `Family-specific only`

Recommended authored ChangeSet variants:

- `Golem (Construct)`

Use for:

- clay guardians
- laboring wards
- letter-bound protectors
- heavy obedient artifices

Recommended expression:

- intended feel: large, durable, literal, obedient, and strongest when guarding, lifting, blocking, or enforcing
- Requirements guidance:
  - use Requirements when a narrower golem path needs unusual size, special inscription, or explicit guarding role
- passive rule ideas:
  - `Durable` / `Of Clay and Command`
  - `OathBound` / `Letter-Bound Labor`
- stat ideas:
  - `Stats_StrengthMod +1`
  - `Stats_StaminaMod +1`
- granted power ideas:
  - `Guard the Threshold`
  - `Burden-Bearing Force`
  - `Hand of Clay`

### `Homunculus`

Allowed families:

```yaml
Group: Domain
ForTypeAny: false
ForType_Construct: true
```

Authoring classification:

- `Family-specific only`

Recommended authored ChangeSet variants:

- `Homunculus (Construct)`

Use for:

- alchemical servants
- whispering assistants
- hidden messengers
- small artificial life-forms

Recommended expression:

- intended feel: uncanny, small, clever, and more like made life than masonry
- Requirements guidance:
  - use Requirements when a homunculus needs small-scale movement, alchemical origin, or service-specific capabilities
- passive rule ideas:
  - `Artificial` / `Vessel-Born Life`
  - `UnsettlingPresence` / `Almost Alive`
- stat ideas:
  - `Stats_DexterityMod +1`
  - `MoveClimb +1`
- granted power ideas:
  - `Whispering Service`
  - `Hidden Courier`
  - `Alchemical Bite`

### `Brazen Head`

Allowed families:

```yaml
Group: Domain
ForTypeAny: false
ForType_Construct: true
```

Authoring classification:

- `Family-specific only`

Recommended authored ChangeSet variants:

- `Brazen Head (Construct)`

Use for:

- warded oracle heads
- speaking gate relics
- learned magical watchers
- doom-speaking artifices

Recommended expression:

- intended feel: artificial, learned, prophetic, and more concerned with speech, warning, and knowledge than pursuit
- Requirements guidance:
  - use Requirements when a brazen head should be stationary, omen-bearing, or tied to a learned site
- passive rule ideas:
  - `SocialCreature` / `Speaks with Forged Mouth`
  - `UnsettlingPresence` / `Knows More Than It Should`
- stat ideas:
  - `Stats_IntelligenceMod +1`
  - `Stats_PowerMod +1`
- granted power ideas:
  - `Pronounce the Doom`
  - `Speak the Warning`
  - `Answer Once`

### `Wax Servitor`

Allowed families:

```yaml
Group: Domain
ForTypeAny: false
ForType_Construct: true
```

Authoring classification:

- `Family-specific only`

Recommended authored ChangeSet variants:

- `Wax Servitor (Construct)`

Use for:

- likeness-dolls made animate
- witch-made helpers
- hidden domestic spies
- targeted malice-servitors

Recommended expression:

- intended feel: intimate, eerie, fragile, and tied to sympathetic craft, household interference, or a specific victim
- Requirements guidance:
  - use Requirements when a wax servitor needs likeness-binding, stealth use, or targeted household logic
- passive rule ideas:
  - `Artificial` / `Shaped in Wax and Intention`
  - `ThresholdAware` / `Sent Through the House`
- stat ideas:
  - `Stats_DexterityMod +1`
  - `Stats_StaminaMod -1`
- granted power ideas:
  - `Likeness Prick`
  - `Creep Unseen`
  - `Carry the Malice`

### `Courtly`

Allowed families:

```yaml
Group: Domain
ForTypeAny: false
ForType_TheUnseen: true
```

Authoring classification:

- `Family-specific only`

Recommended authored ChangeSet variants:

- `Courtly (TheUnseen)`

Use for:

- sidhe nobles
- fairy kings and queens
- barrow-court royalty
- lords and ladies of the hollow hill

Recommended expression:

- intended feel: beautiful and terrible, impossible etiquette, dangerous generosity
- passive rule ideas:
  - `Glamour` / `Courtly Radiance`
  - `OfferingBound` / `Gift for Gift`
- stat ideas:
  - `Stats_CharismaMod +1`
- granted power ideas:
  - `Courtly Favor`
  - `Withering Courtesy`

### `Hunt`

Allowed families:

```yaml
Group: Domain
ForTypeAny: false
ForType_TheUnseen: true
```

Authoring classification:

- `Family-specific only`

Recommended authored ChangeSet variants:

- `Hunt (TheUnseen)`

Use for:

- Erlking
- leaders of the Wild Hunt
- spectral riders of rank

Recommended expression:

- intended feel: relentless, mounted or accompanied, hard to flee once marked
- passive rule ideas:
  - `FearAura` / `Heard Before Seen`
  - `SenseLiving` / `Hunter of the Living`
- stat ideas:
  - `MoveGround +2`
- granted power ideas:
  - `Mark the Quarry`
  - `Ride Them Down`
  - `Cry of the Hunt`

### `Smokeless Fire`

Allowed families:

```yaml
Group: Domain
ForTypeAny: false
ForType_TheUnseen: true
```

Authoring classification:

- `Family-specific only`

Recommended authored ChangeSet variants:

- `Smokeless Fire (TheUnseen)`

Use for:

- jinn
- ruin spirits of rank
- beings of heat, smoke, bargain, and invisible fire

Recommended expression:

- intended feel: proud, swift in bargaining, dangerous in offense and promise
- passive rule ideas:
  - `FireVulnerable` / `Fire That Answers Fire`
  - `NameBound` / `Bound in the Naming`
- stat ideas:
  - `Stats_PowerMod +1`
- granted power ideas:
  - `Smoke Passage`
  - `Burning Bargain`
  - `Breath of Cinders`

### `Winter`

Allowed families:

```yaml
Group: Domain
ForTypeAny: false
ForType_TheUnseen: true
```

Authoring classification:

- `Family-specific only`

Recommended authored ChangeSet variants:

- `Winter (TheUnseen)`

Use for:

- winter queens
- snow matrons
- rulers of sleep, labor, and harsh blessing

Recommended expression:

- intended feel: maternal and terrible, domestic judgment entangled with snow and sleep
- passive rule ideas:
  - `HearthBound` / `Judge of House and Labor`
  - `DreamIntrusion` / `Touches the Sleeping`
- stat ideas:
  - `Stats_FaithMod +1`
- granted power ideas:
  - `Snow Blessing`
  - `Winter Sleep`
  - `Household Judgment`

## Domain Authoring Checklist

When writing a new `Domain` ChangeSet or spec entry, confirm:

1. What is the stable domain concept?
2. What is its authoring classification?
3. Is it cross-family or family-limited?
4. Which `ForType_*` flags should be enabled?
5. Are extra Requirements needed?
6. What belongs in `Domain` rather than `Loadout`, `Quirk`, or `Motivation`?
7. How does the domain express differently across allowed families?

## Recommended Initial Domain Families

The first broadly reusable `Domain` concepts should be:

- `Wood`
- `Water`
- `Hill`
- `Underground`
- `Hearth`
- `Settlement`
- `Bog`
- `Stone`
- `Mountain`
- `Corrupted`
- `Severed`

The first clearly family-limited examples should be:

- `Grave`
- `Moon-Bound`
- `Witch-Made`
- `Infernal`
- `Angelic`
- `Border Zone`
- `Deep Zone`
- `Corrupted`
- `Severed`
- `Underground`
- `Golem`
- `Homunculus`
- `Brazen Head`
- `Wax Servitor`
- `Courtly`
- `Smokeless Fire`
- `Winter`
- `Hunt`

These are still valid `Domain` concepts, but they should start restricted unless
and until a broader reusable version is intentionally designed.

## Recommended Next Step

After approving this model, the next documentation pass should:

1. create shared slot-based specs for `Loadout`, `Quirk`, and `Motivation`
2. move any family-specific overlay content into those slot specs as needed
3. continue extending shared slot catalogs so every base family is represented
   without reintroducing family-only specialization documents
4. keep family base specs for lineage identity, but keep specialization catalogs
   organized by slot type
