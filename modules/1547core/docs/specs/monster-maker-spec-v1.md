# Monster Maker Spec V1

## Purpose

This document specifies the data model, template structure, and runtime
contracts for the `1547Core` monster-maker / ChangeSet system. It is the
implementer-facing companion to `monster-creation-guide.md` and is the
authoritative reference for downstream code that integrates with the
ChangeSet pipeline.

## Architecture Overview

The system is built on Custom System Builder (CSB) templates plus a small
runtime in `1547core/scripts/services/`.

### Layers

```
base.* (authored on actor)
  ↓
[ChangeSet pipeline]                  ← derives effective values
  ↓
effective.*
  ↓
[Active Effects]                      ← Foundry-native, applies on top
  ↓
actual.*
```

- `base.*` is what the author writes directly on the actor (rare for monsters;
  typical for chargen-side PC stats).
- `effective.*` is the result of walking attached ChangeSets in pipeline order
  and applying each Change. This view is what the sheet should display by
  default.
- `actual.*` is `effective.*` with Foundry's Active Effects layered on top. It
  is the play-time view used by the combat engine, damage resolution, etc.

### Boundary rules

- ChangeSets never see Active Effect state.
- Active Effects never feed into the ChangeSet pipeline.
- Removing a ChangeSet and re-deriving must return the actor to the prior
  state (modulo any AEs).
- The pipeline must be **deterministic** for the same set of inputs.

## CSB Templates

### ChangeSetTemplate

| Field | Type | Notes |
|---|---|---|
| `_id` | identifier | `b7A1z6cSZO4dYTKT` |
| Header → MonsterMetadata → `Group` | select | One of `Size`, `Role`, `Domain`, `Motivation`, `Loadout`, `Quirk`, `Boost` |
| Header → MonsterMetadata → `ForTypeAny` | checkbox | When true, set is valid for any TypeDropdown |
| Header → MonsterMetadata → ForTypeSelector → `ForType_<Type>` | checkbox × 12 | One per TypeDropdown value (Player / Spirit / HiddenFolk / TheUnseen / Beast / Undead / Colossal / Cursed / Unnatural / Construct / Zone / People) |
| Header → `RequirementsDisplayer` | itemContainer (template-filtered to RequirementTemplate) | Holds Requirement child items |
| Header → `ChangeDisplayer` | itemContainer (template-filtered to ChangeTemplate) | Holds Change child items |
| Body → `Notes` | textArea | Free-form author notes |

`ForTypeSelector` visibility: `not(ForTypeAny)`.

### ChangeTemplate

| Field | Type | Visibility | Notes |
|---|---|---|---|
| `_id` | identifier | always | `WsrkfjBmudnIhvEK` |
| `Kind` | select | always | `Stat`, `PrimaryStat`, `Skill`, `Text`, `ItemGrant`, `Tag`, `Trait` |
| `Notes` | textArea | always | Author comment |
| `StatTarget`, `StatOp`, `StatValue` | text + select + numberField | `equalText(Kind, 'Stat')` | StatOp ∈ `Add`, `Multiply`, `Override` |
| `PrimaryStatTarget`, `PrimaryStatOp` | select × 2 | `equalText(Kind, 'PrimaryStat')` | Target ∈ 7 primary stats; Op ∈ `Step`, `Set` |
| `PrimaryStatSteps` | numberField | `equalText(PrimaryStatOp, 'Step')` | Signed integer |
| `PrimaryStatSetDice`, `PrimaryStatSetMod` | numberField × 2 | `equalText(PrimaryStatOp, 'Set')` | Dice ≥ 1, Mod 0–3 |
| `SkillRef`, `SkillDelta` | itemContainer (skill-filtered) + numberField | `equalText(Kind, 'Skill')` | Delta signed |
| `TextTarget`, `TextOp`, `TextValue` | text + select + textArea | `equalText(Kind, 'Text')` | Op ∈ `Append`, `Prepend`, `Replace` |
| `ItemGrantMode` | select | `equalText(Kind, 'ItemGrant')` | `Direct` or `RollTable` |
| `ItemGrantRef` | itemContainer (broadly filtered) | `equalText(ItemGrantMode, 'Direct')` | Drop the item |
| `ItemGrantRollTable` | text | `equalText(ItemGrantMode, 'RollTable')` | RollTable UUID |
| `TagName` | text | `equalText(Kind, 'Tag')` | Tag string |
| `TraitName`, `TraitDescription` | text + textArea | `equalText(Kind, 'Trait')` | Named ability + description |
| `DurationValue`, `DurationUnit` | numberField + select | always (collapsed by default) | Used only as AE payload |

`DurationUnit` options: `Permanent`, `Rounds`, `Turns`, `Minutes`, `Hours`,
`Scene`, `UntilEvent`. When `Permanent`, `DurationValue` is ignored.

`ItemGrantRef` filter: all granted item template IDs **except** SkillTemplate
(skills go through `Kind: Skill`).

### RequirementTemplate

| Field | Type | Visibility | Notes |
|---|---|---|---|
| `_id` | identifier | always | `L4ujYgqhGBGcoo2P` |
| `PredicateType` | select | always | `GroupPresent`, `HasTag`, `StatAtLeast`, `PrimaryStatAtLeast`, `HasSkill` |
| `Negate` | checkbox | always | Inverts the predicate |
| `Notes` | textArea | always | |
| `GroupTarget` | select | `equalText(PredicateType, 'GroupPresent')` | The 7 groups |
| `TagName` | text | `equalText(PredicateType, 'HasTag')` | |
| `StatTarget`, `StatThreshold` | text + numberField | `equalText(PredicateType, 'StatAtLeast')` | Threshold allows decimals |
| `PrimaryStatRequirementTarget` | select | `equalText(PredicateType, 'PrimaryStatAtLeast')` | 7 primary stats |
| `PrimaryStatRequirementDice`, `PrimaryStatRequirementMod` | numberField × 2 | `equalText(PredicateType, 'PrimaryStatAtLeast')` | Min dice ≥ 1, min mod 0–3 |
| `RequirementSkillRef`, `SkillMinLevel` | itemContainer + numberField | `equalText(PredicateType, 'HasSkill')` | |

### Actor template

The actor template (`Tgs09eTiTp63Cp7u`) shares one structure between Players
and NPCs/monsters. It contains a body-level `CompositionPanel` (added by
monster-maker) holding the seven group containers in pipeline order:

| Container key | Group | Role | Item filter formula |
|---|---|---|---|
| `SizeContainer` | Size | 0 (all) | `equalText(item.Group, 'Size')` |
| `RoleContainer` | Role | 0 | `equalText(item.Group, 'Role')` |
| `DomainContainer` | Domain | 0 | `equalText(item.Group, 'Domain')` |
| `MotivationContainer` | Motivation | 0 | `equalText(item.Group, 'Motivation')` |
| `LoadoutContainer` | Loadout | 0 | `equalText(item.Group, 'Loadout')` |
| `QuirkContainer` | Quirk | 0 | `equalText(item.Group, 'Quirk')` |
| `BoostContainer` | Boost | 3 (GM-only) | `equalText(item.Group, 'Boost')` |

All seven containers have `templateFilter: ["b7A1z6cSZO4dYTKT"]` so only
ChangeSets can be dropped. The Boost container is `role: 3` so players
cannot see it.

Between `QuirkContainer` and `BoostContainer` sits a `BoostControls` panel
(role: 3) holding two label-buttons: `BoostButton` and `UnboostButton`.

## CSB Formula Conventions

The formula language used in visibilityFormula and itemFilterFormula is
CSB's small expression DSL. The conventions in use:

- **Bare references** for field reads: `UsesAmmo`, `MinLevel`, `Group`.
  No `${...}$` wrapping.
- **Numeric comparison**: `MinLevel < 1`, `MaxLevel > 1`.
- **String equality**: `equalText(Field, 'Value')`. Single-quoted string
  literal. Double quotes fail with "Cannot convert 'X' to a number" at
  `Formula.computeStatic`.
- **Boolean negation**: `not(Field)`. JS-style `!Field` fails.
- **Per-item context**: in itemFilterFormula, the item's fields are
  accessible as `item.<key>`. In rowLayout substitutions, the syntax is
  `${item.<key>}$`.

## Storage Conventions

### Primary stats

Stored on `actor.system.props`:

- `Stats_{Name}Dice` (number, default 1)
- `Stats_{Name}Mod` (number, default 0, range 0–3)

Names: `Strength`, `Dexterity`, `Stamina`, `Intelligence`, `Faith`,
`Charisma`, `Power`.

Ladder index conversion: `index = (dice - 1) * 4 + mod`. Inverse:
`dice = floor(index / 4) + 1`, `mod = index % 4`.

Helpers in `1547core/scripts/services/primary-stats.js`:

```
PRIMARY_STATS               // string[]
statIndex(dice, mod)        // -> number
indexToStat(index)          // -> { dice, mod }
getStatRating(actor, name)  // -> { dice, mod }
advanceStat(actor, name, steps)   // -> Promise<{ dice, mod }>
setStat(actor, name, dice, mod)   // -> Promise<{ dice, mod }>
```

### Numeric stats

Other numeric properties (HP, attribute points, movement budget, exhaustion,
money, social status, ...) are stored on `actor.system.props.<Key>` as
plain numbers.

Combat-managed runtime values such as `AdvantagePoints`, `RiskPoints`,
`CriticalPoints` are **off-limits** as Change targets. They are mutated by
the combat resolver, not by ChangeSets.

### Tags and traits

(Planned, not yet enforced by runtime.)

- Tags: `actor.system.props.Tags` as a string array, populated by Tag
  Changes during derivation.
- Traits: `actor.system.props.Traits` as `Array<{name, description}>`.

### Monster portraits

Monster portraits are derived outside the Change pipeline. `Image` is no
longer a Change kind.

The image resolver reads the final composed actor context and returns the
portrait to display. Current precedence:

1. explicit actor-level override (if any)
2. future portrait/theme keys derived from composition state
3. the actor's authored base `img`
4. Foundry fallback `icons/svg/mystery-man.svg`

Current implementation keeps only step 3 and 4 active, which means removing
the `Image` Change kind is safe today while leaving room for type-aware
resolution later.

### Boost-derived tier

Tier is not a stored field. It is computed as
`actor.items.filter(i => i.system?.props?.Group === "Boost").length`. UI
display (planned) reads this on-demand.

## Application Pipeline (planned)

```pseudo
function deriveActor(actor):
  state = clone(actor.system.props.base ?? actor.system.props)
  state.tags = new Set()
  state.attacks = []
  state.description = [actor.system.props.Description ?? ""]

  for group in [Size, Role, Domain, Motivation, Loadout, Quirk, Boost]:
    sets = actor.items
      .filter(i => i.system.template === "b7A1z6cSZO4dYTKT"
                && i.system.props.Group === group)
      .sort((a, b) => a.sort - b.sort)

    for set in sets:
      if evalRequirements(set, state) is false: continue   # log + skip
      applyChangeSet(state, set)

  return finalize(state)   # join description, dedupe attacks, etc.
```

`applyChangeSet` walks `set.items.filter(i => i.system.template === "WsrkfjBmudnIhvEK")`
and dispatches by `Kind`:

- `Stat` → state.props[StatTarget] mutated by `StatOp`/`StatValue`
- `PrimaryStat` → advance/set on Stats_{Name}Dice/Mod
- `Skill` → find/create skill item on actor, adjust Level by `SkillDelta`
- `Text` → state.props[TextTarget] mutated by `TextOp` with `TextValue`
- `ItemGrant` → copy item onto actor (when permanent) or attach proxy
- `Tag` → state.tags.add(TagName)
- `Trait` → state.traits.push({name, description})

The derive function should run on actor creation, on `createItem` /
`updateItem` / `deleteItem` for actor-owned items, and on `updateActor`
when relevant props change.

**Reversibility invariant**: derive must rebuild `effective.*` from scratch
on each invocation; never increment or mutate previous results.

## Service API

The 1547core module exposes services on `game.modules.get("1547core").api`:

### `boostActor(actorId: string): Promise<void>`

GM-only. Reads the `boostRollTableUuid` setting, resolves the RollTable,
rolls once, previews the result via a confirmation dialog, and on accept
creates an embedded copy of the rolled ChangeSet on the actor with
`Group` forced to `Boost`.

### `unboostActor(actorId: string): Promise<void>`

GM-only. Finds Boost-group ChangeSets on the actor, sorts by `_stats.createdTime`
descending, confirms removal of the most-recent one, and deletes it.

These are wired in via `registerBoostService()` invoked from main.js init.

## Settings

Registered in `scripts/settings/module-settings.js`:

| Key | Scope | Visible in module config | Default | Purpose |
|---|---|---|---|---|
| `boostRollTableUuid` | world | yes | `""` | Foundry UUID of the RollTable rolled by Boost button |

## RollTable Mode for ItemGrant Changes

When a Change has `ItemGrantMode == "RollTable"`, the field referenced is a
Foundry RollTable UUID. The actual item document is resolved at **placement
time** — when the parent ChangeSet item is added to an actor (`createItem`
hook).

The rolled result is cached on the Change item so subsequent derives do
not re-roll. Cache location:
`item.flags["1547core"].rolledResult = { tableUuid, rolledAt, sourceItemId? }`.
The `tableUuid` field allows the resolver to detect retargets (author
changed the RollTable reference) and re-roll only then.

(The original spec draft suggested `flags.custom-system-builder.rolledResult`;
the implementation deviates so we don't write into CSB's flag bucket.)

Removing the parent ChangeSet from the actor discards the cache (the
Change item is deleted with its parent). Re-placing re-rolls.

## Drop Hook Contract

Implemented in `services/changeset-drop-hook.js`. The `preCreateItem`
hook validates ChangeSet drops onto actors:

1. **Cardinality**: Size, Role, Domain accept at most one ChangeSet each. A
   second drop is rejected with a UI notification.
2. **ForType match**: reject when `ForTypeAny` is false and no
   `ForType_<TypeDropdown>` checkbox matches.
3. **Requirements**: walk the set's Requirements, evaluate each against
   the actor's cached cumulative state, and reject if any (after Negate)
   fails. **Implementation simplification**: the cached state contains
   *all* applied sets, not just those from earlier pipeline groups, so a
   Requirement that depends on a later-group set will spuriously pass at
   drop time. The runtime composition pipeline still skips truly-failing
   sets when deriving, so derived state stays correct — the gap is
   cosmetic UX only.
4. **Template exemption**: drops onto `_template`-type actors skip
   validation.

Group routing (#1 in the original draft) is enforced by CSB's
container-level template filter and is not duplicated in the hook.

The companion `validateMonster(actor)` exported on
`game.modules.get("1547core").api` audits existing applied sets and
reports violations introduced by manual data edits.

## Active Effects (planned integration)

Two-tier library:

- **Catalog** (~15–20 pre-built AEs for standard conditions): Poisoned,
  Prone, Stunned, Blinded, Charmed, Frightened, Restrained, Grappled,
  Unconscious, Wounded, Exhausted, Bleeding, Invisible, Hidden,
  Concentrating.
- **Generic Stat Modifier AE**: one definition that accepts a Change-shaped
  payload (`target`, `op`, `value`, `duration`) at apply time. Spells,
  maneuvers, and powers that produce temporary stat changes carry this
  payload rather than defining a new AE.

The catalog AEs and the generic template are world content, not part of
this spec's surface; they are authored once and referenced thereafter.

Layering rule: AEs operate on `effective.*` paths and produce `actual.*`.
The combat engine reads `actual.*`.

## Cross-references

- `monster-creation-guide.md` — the designer-facing companion to this spec.
- `monster-image-resolver-spec-v1.md` — portrait derivation rules for composed
  monsters.
- `equipment-and-dice-schema-spec-v1.md` — for weapon/ammo/armor data
  consumed by ItemGrant Changes.
- `combat-rules-guide.md` — for action economy, dice pools, and where
  `actual.*` values are read at play time.
- `combat-spec-v2.md` — for the runtime combat model that operates on the
  output of this pipeline.
- The skill tree DAG used by `Skill` Changes lives in the separate
  `skilltreehelper` module's `data/default.json`. Skill Changes apply with a
  **lenient** policy — the skill tree's prerequisite DAG is a chargen-time
  UI concept and is not enforced when ChangeSets adjust skill levels.

## Implementation Status (as of v1)

Implemented:

- All three item templates (Change, ChangeSet, Requirement) with the field
  shapes and visibility formulas above.
- Actor template additions (CompositionPanel with seven group containers
  and BoostControls).
- Primary-stat helpers in `services/primary-stats.js`.
- Boost service (`boostActor`, `unboostActor`) wired via main.js init.
- `boostRollTableUuid` world setting.
- Derive pipeline in `services/composition-service.mjs`: walks pipeline
  order, evaluates all five Requirement predicate types, dispatches all
  seven Change kinds into `cumulativeState`, caches by
  `actor._stats?.modifiedTime`, invalidates on createItem / updateItem /
  deleteItem.
- preCreateItem drop hook in `services/changeset-drop-hook.js` plus
  `validateMonster(actor)` audit companion (see "Drop Hook Contract"
  above).
- ItemGrant side-effects in `services/item-grant-service.js`: reconciles
  Direct- and RollTable-mode ItemGrant Changes into embedded items on the
  actor, tagged with `flags["1547core"].grantedBy = { changeSetId, changeId }`.
  Reversible — removing a ChangeSet (or just one Change) deletes the
  matching tagged items.
- RollTable resolution in `services/rolltable-resolution-service.js`:
  rolls ItemGrant RollTable Changes once at placement time,
  caches results at `flags["1547core"].rolledResult`, re-rolls when the
  target table UUID changes. composition-service and item-grant-service
  consume the cache.
- Image resolver in `services/monster-image-resolver-service.js`: portraits
  are derived from actor context and currently default to the actor's base
  image, rather than being granted by Change items.
- Tier display in `services/tier-display-service.js`: injects a "Tier: N"
  badge into the actor sheet's BoostControls panel via `renderActorSheet`,
  counting Boost-group ChangeSets.

Not yet implemented (tracked for future revisions):

- Active Effects catalog and generic Stat Modifier AE.
- Chargen refactor to consume `services/primary-stats.js` instead of its
  local copy (existing duplicate in `chargen1547_v2/scripts/chargen.js`
  lines 5279–5311 and `foundry-primary-stats/stats.js`).
- Skill change side-effects: `applyChange` collects `skillDeltas` into
  `cumulativeState` but no consumer reads them yet, and the actor's skill
  items are not auto-created when a Skill Change references one the actor
  doesn't have.
- Broader sheet integration: the derive pipeline produces `effective.*`
  but nothing reads it for display yet — the actor sheet renders `base.*`,
  and tier-display counts items directly without going through the cache.
