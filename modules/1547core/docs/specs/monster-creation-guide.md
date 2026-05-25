# Monster Creation Guide

## Purpose

This document explains how monsters and NPCs are built in `1547Core` using the
**ChangeSet** system. It is intended for game designers, GMs, and content
authors who want to compose new creatures or write reusable ChangeSets.

It is also relevant to characters because Player and non-Player actors share
the same template; the same ChangeSet machinery is available for chargen-style
authoring.

## Overview

A creature is built by stacking **ChangeSets** onto a base actor. Each
ChangeSet is a small item containing:

- **Changes** — atomic modifications to the actor such as stat adjustments,
  granted items, tags, text, and traits.
- **Requirements** — preconditions that must hold for the set to apply.
- **Metadata** — which pipeline slot the set fills (`Group`) and which actor
  types it is valid for (`ForType`).

The actor's base stats plus the cumulative effect of all attached ChangeSets
produces an effective character. Adding or removing a ChangeSet is
**non-destructive** — the system re-derives the character from scratch each
time the set of attached ChangeSets changes.

## Core Concepts

### ChangeSet

A ChangeSet is a CSB item (template `b7A1z6cSZO4dYTKT`) that represents one
unit of composition — for example, a Role profile, a Domain layer, a
Motivation, a piece of gear, or a Quirk. It contains:

- a `Group` value, locking it to one slot in the application pipeline
- a `ForType` policy controlling which actor types can receive it
- a list of Changes
- a list of Requirements
- a free-form Notes textarea for the author

### Change

A Change is one atomic modification. Change items (template
`WsrkfjBmudnIhvEK`) carry one of seven kinds:

| Kind | Modifies | Typical use |
|---|---|---|
| `Stat` | A numeric actor stat | HP +5, MoveGround +1 |
| `PrimaryStat` | One of the seven primary stats on the d6 ladder | Strength one step up |
| `Skill` | The level of a skill item on the actor | Athletics +1 |
| `Text` | A text field | Append omen text to Bio |
| `ItemGrant` | Adds an item to the actor | Attack, maneuver, power, spell |
| `Tag` | Adds a string tag | `SunlightSensitive`, `Glamour` |
| `Trait` | Adds readable rules text | `Half-Seen`, `Bound to Custom` |

`ItemGrant` additionally supports a **RollTable mode**. The field references a
RollTable, and the actual granted item is randomly rolled once when the parent
ChangeSet is dropped onto the actor. The result is cached so the grant remains
stable until the ChangeSet is removed and re-added.

Portraits are **not** a Change kind. Monster portraits are derived by the
image resolver and currently default to the actor's authored base image. This
keeps portrait selection out of the ChangeSet conflict space and lets a shared
domain such as `Fire` later resolve differently for `HiddenFolk` and
`TheUnseen`.

Each Change also has an optional **duration** (numeric value + unit:
`Permanent`, `Rounds`, `Turns`, `Minutes`, `Hours`, `Scene`, `Until event`).
Inside ChangeSets, duration is ignored and the Change applies permanently for
as long as the set is attached. The duration fields mainly matter when the
same change-like payload is reused as an Active Effect or `UsageEffect`
outcome.

### Requirement

A Requirement is a predicate that must be true before its parent ChangeSet can
apply. Requirement items (template `L4ujYgqhGBGcoo2P`) have:

- a predicate `Type`:
  - `GroupPresent`
  - `HasTag`
  - `StatAtLeast`
  - `PrimaryStatAtLeast`
  - `HasSkill`
- a `Negate` checkbox that inverts the predicate
- type-specific fields such as target stat, tag name, group, skill ref, and
  threshold

Requirements within one ChangeSet are AND-ed together. To express an OR, use
multiple ChangeSet variants.

Requirements are evaluated against the **cumulative pipeline state at the
point the parent ChangeSet would apply**. Earlier groups have already
contributed; later groups have not yet run.

## Groups And Pipeline Order

ChangeSets are applied in a fixed group order:

| # | Group | Cardinality | What it represents |
|---|---|---|---|
| 1 | Size | exactly one | physical scale |
| 2 | Role | exactly one | behavioral or combat profile |
| 3 | Domain | exactly one | source of power and scene logic |
| 4 | Motivation | many | what drives the creature |
| 5 | Loadout | many | gear, attacks, powers |
| 6 | Quirk | many | one-off folklore twist |
| 7 | Boost | many | GM-only random boosts |

**Lineage is not a group.** The actor's `TypeDropdown` field is the lineage
(`Player`, `HiddenFolk`, `TheUnseen`, and so on). ChangeSets opt into
lineages via `ForType`, not via a separate pipeline group.

## ForType And Lineage Filtering

A ChangeSet's metadata includes an `Applies to any type` checkbox. When
checked, the set works on any actor regardless of `TypeDropdown`. When
unchecked, per-type checkboxes appear and the set only applies to those
selected lineages.

## Op Semantics

`Stat` Changes use three ops:

- `Add` — adds the value
- `Multiply` — multiplies the running value
- `Override` — sets the working value at this point in the pipeline

`PrimaryStat` Changes use:

- `Step` — move N steps along the d6 ladder
- `Set` — write an absolute dice/mod value

Other kinds have their own natural semantics:

- `Skill` — signed `Delta`
- `Text` — `Append`, `Prepend`, or `Replace`

## The Boost Mechanism

Boosts are random GM-driven additions that increase a creature's power without
picking specific upgrades by hand. A boost is just a ChangeSet drawn from a
configured RollTable.

**Tier is derived**, not authored. It equals the count of items in the
actor's Boost container.

### Boost workflow

1. Author a pool of Boost-group ChangeSets.
2. Put those ChangeSets on a world RollTable.
3. Set the RollTable UUID in `1547 Core` settings.
4. Click **Roll Boost** on an actor.
5. Accept the previewed result.
6. The rolled ChangeSet is copied onto the actor as a `Boost`.
7. **Undo Last Boost** removes the most recent Boost ChangeSet.

Boosts can themselves contain RollTable-mode `ItemGrant` Changes. Those roll
once when the parent boost is placed and the result is cached.

### Boost content scope

By convention, Boosts should modify mechanics: stats, skills, tags, traits,
and granted items. They should not silently rewrite portraits; portrait
selection is handled separately by the image resolver.

## Active Effects Vs ChangeSets

ChangeSets are for **structural, persistent** modifications — what a creature
*is*. Active Effects are for **temporary, situational** modifications — what
is *happening to* a creature right now.

```text
base.* -> [ChangeSet pipeline] -> effective.* -> [Active Effects] -> actual.*
```

ChangeSets compute `effective.*`. Active Effects then layer on top and produce
`actual.*`.

## Authoring Workflows

### Creating a new ChangeSet

1. Create a new item from the `ChangeSetTemplate`.
2. Set its name.
3. Choose a `Group`.
4. Configure `ForType`.
5. Add Requirement child items.
6. Add Change child items.
7. Drop the finished ChangeSet onto an actor to test.

### Composing a monster

1. Choose the actor's `TypeDropdown`.
2. Author the actor's base stats and base portrait.
3. Add one `Size`, one `Role`, and one `Domain`.
4. Add any number of `Motivation`, `Loadout`, `Quirk`, and `Boost` sets.
5. Verify that tags, traits, powers, and granted items match the intended
   folklore logic.
6. Let the image resolver keep the base portrait unless and until you add a
   higher-level portrait rule.

## Authoring Tips

- Put stable identity on the base actor.
- Use ChangeSets for reusable composition layers.
- Use `Tag` for automation hooks and `Trait` for readable rules text.
- Use `ItemGrant` for attacks, powers, spells, pacts, and other ownable
  content.
- Keep `Domain` reusable across monster families by treating it as source of
  power and scene logic, not species name.
- Keep portrait decisions out of Changes. If two creatures share `Domain:
  Fire` but should look different, solve that in the image resolver, not in
  competing Change items.

## Cross-reference

- `monster-maker-spec-v1.md` — implementer-facing runtime and template spec
- `monster-image-resolver-spec-v1.md` — portrait derivation rules
