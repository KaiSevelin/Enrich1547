# Monster Creation Guide

## Purpose

This document explains how monsters and NPCs are built in `1547Core` using the
**ChangeSet** system. It is intended for game designers, GMs, and content
authors who want to compose new creatures or write reusable ChangeSets.

It is also relevant to characters because Player and non-Player actors share
the same template; the same ChangeSet machinery is available for chargen-style
authoring.

## Overview

A creature is built by stacking **ChangeSets** onto a base actor. Each ChangeSet
is a small item containing:

- **Changes** — atomic modifications to the actor (stat adjustments, item
  grants, tags, text, images, traits).
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
unit of composition — for example, a Lineage attribute, a Role profile, a
Motivation, a piece of gear, or a Quirk. It contains:

- A `Group` value, locking it to one slot in the application pipeline.
- A `ForType` policy controlling which actor types can receive it.
- A list of Changes (the actual modifications it applies).
- A list of Requirements (the conditions it requires).
- A free-form Notes textarea for the author.

### Change

A Change is a single atomic modification. Change items (template
`WsrkfjBmudnIhvEK`) carry one of seven kinds:

| Kind | Modifies | Typical use |
|---|---|---|
| `Stat` | A numeric actor stat | HP +5, StaminaPoints +2, Override exhaustion to 0 |
| `PrimaryStat` | One of the seven primary stats on the d6 ladder | Strength one step up, Dexterity set to 2d6 |
| `Skill` | The level of a skill item on the actor | Athletics +1, Religion -2 |
| `Text` | A text field (Description, Bio, etc.) | Append "Often seen near old oaks" to Bio |
| `Image` | An image field (default `img`) | Set portrait to a specific path, or roll on a RollTable |
| `ItemGrant` | Adds an item to the actor | Bear claws, a Fierce Charge maneuver, a granted spell |
| `Tag` | Adds a string tag | "fire", "claws", "aquatic" — used by Requirements |
| `Trait` | A named ability with a description | "Flight", "Fire Immunity", "Blindsight" |

Image and ItemGrant Changes additionally support a **RollTable mode** — the
field references a RollTable, and the actual image path or item is randomly
rolled once when the parent ChangeSet is dropped onto the actor. The roll is
cached so the result is stable until the ChangeSet is removed and re-added.

Each Change also has an optional **duration** (numeric value + unit:
`Permanent`, `Rounds`, `Turns`, `Minutes`, `Hours`, `Scene`, `Until event`)
used only when the Change is delivered as an Active Effect payload from a
spell, maneuver, or power. Inside a ChangeSet, duration is ignored and the
Change applies permanently for as long as the set is attached.

### Requirement

A Requirement is a predicate that must be true before its parent ChangeSet can
apply. Requirement items (template `L4ujYgqhGBGcoo2P`) have:

- A predicate `Type`:
  - `GroupPresent` — some ChangeSet is in a given group slot
  - `HasTag` — some applied set provided a given tag
  - `StatAtLeast` — a numeric stat meets a threshold
  - `PrimaryStatAtLeast` — a primary stat is at or above a dice/mod rating
  - `HasSkill` — the actor has a specific skill at or above a minimum level
- A `Negate` checkbox that inverts the predicate. `HasTag fire + Negate`
  means "this set must not be applied where fire is present."
- Type-specific fields (target stat, tag name, group, skill ref, threshold).

Requirements within one ChangeSet are AND-ed together. To express an OR, use
multiple variants of the ChangeSet, each with its own AND-list. For finer
control, the `Negate` flag rewrites most OR cases as AND-of-negations.

Requirements are evaluated against the **cumulative pipeline state at the
point the parent ChangeSet would apply** — earlier groups have already
contributed, later groups have not yet run.

## Groups and Pipeline Order

ChangeSets are applied in a fixed group order. Each group has a cardinality:

| # | Group | Cardinality | What it represents |
|---|---|---|---|
| 1 | Size | exactly one | Size class — scales HP, damage dice, reach |
| 2 | Role | exactly one | Combat role (Brute, Skirmisher, Controller, Lurker) |
| 3 | Domain | exactly one | Elemental or thematic identity (Fire, Undead, Fey, Clockwork) |
| 4 | Motivation | many | What drives the creature — Vengeance, Hunger, Territorial |
| 5 | Loadout | many | Gear and granted attacks |
| 6 | Quirk | many | One-off tweaks |
| 7 | Boost | many | GM-only random boosts (see below) |

**Lineage is not a group.** The actor's `TypeDropdown` field (Player /
Spirit / HiddenFolk / TheUnseen / Beast / Undead / Colossal / Cursed /
Unnatural / Construct / Zone / People) is the lineage. ChangeSets opt into
lineages via the `ForType` field, not via a separate group.

The pipeline applies groups top-to-bottom. Within a group, items apply in
their sort order (Foundry's `sort` field — adjustable by drag-reordering).

## ForType and Lineage Filtering

A ChangeSet's metadata includes an `Applies to any type` checkbox. When
checked, the set works on any actor regardless of TypeDropdown. When
unchecked, twelve per-type checkboxes appear (one per TypeDropdown value);
tick the types the set is valid for.

The pipeline (planned, currently filter-only at the container) rejects drops
when the actor's TypeDropdown does not match the set's allowed types.

## Op Semantics

The `Stat` Change kind has three ops:

- **Add** — adds the value (signed). Multiple Adds accumulate.
- **Multiply** — multiplies the running value by a factor. Multiple Multiplies
  compound multiplicatively.
- **Override** — sets the working value at this point in the pipeline. Wipes
  all earlier mods on this stat (reset-at-position). Later mods then apply to
  the override value.

The `PrimaryStat` kind has its own ops:

- **Step** — advances or regresses N steps along the d6 ladder
  (1d6 → 1d6+1 → 1d6+2 → 1d6+3 → 2d6 → 2d6+1 → ...).
- **Set** — writes an absolute (dice, mod) value.

Other kinds have op-like semantics:

- **Skill**: a signed `Delta` (positive raises, negative lowers).
- **Text**: `Append`, `Prepend`, or `Replace`.

## The Boost Mechanism

Boosts are random GM-driven additions that increase a creature's power
without picking specific upgrades by hand. A boost is just a ChangeSet drawn
from a configurable RollTable.

**Tier is derived**, not authored — it equals the count of items in the
actor's Boost container. There is no separate Tier field on the actor.

### Boost workflow

1. The GM authors a pool of Boost-group ChangeSets — anything from "+5 HP"
   to "Frenzy: extra attack when below half HP." Each can have its own
   Requirements gating where it is appropriate.
2. The GM creates a RollTable in the world and populates it with those
   ChangeSets as document-type result rows.
3. In Game Settings → 1547 Core → Boost Roll Table UUID, the GM pastes the
   RollTable's UUID.
4. On any actor, the GM clicks **Roll Boost** in the Composition panel.
   The system rolls, previews the result, and asks the GM to accept.
5. On accept, the ChangeSet is copied onto the actor (its Group is forced to
   `Boost`) and appears in the Boost container. The tier display
   increases by one.
6. **Undo Last Boost** removes the most recently added Boost ChangeSet
   (LIFO).

Boosts can themselves contain RollTable-mode Changes (random image, random
granted item) — those roll once when the parent boost is placed and the
result is cached.

### Boost content scope

By convention, Boosts should modify mechanics (stats, skills, items, tags,
traits) but **not** aesthetics (image, text). A surprise random portrait
mid-game is rarely what the GM wants. This is a guideline, not enforced.

## Active Effects vs ChangeSets

ChangeSets are for **structural, persistent** modifications — what a
creature *is*. Active Effects are for **temporary, situational** ones —
what is *happening to* a creature right now (Poisoned, Wounded, Stunned, or
a spell-applied stat debuff).

The two layers are kept separate:

```
base.*  →  [ChangeSet pipeline]  →  effective.*  →  [Active Effects]  →  actual.*
```

ChangeSets compute the `effective.*` view. Active Effects then layer on top
and produce the `actual.*` view (what is displayed and used at play time).
Neither system sees the other's intermediate state.

For temporary stat changes, the recommended approach is a small library of
catalog conditions (Poisoned, Prone, Stunned, Bleeding, …) plus one generic
"Stat Modifier" AE that takes a Change-shaped payload (target, op, value,
duration) at apply time. Spells and maneuvers that lower stats carry that
payload rather than defining a new AE per effect.

## Authoring Workflows

### Creating a new ChangeSet

1. In the Items sidebar, create a new item from the `ChangeSetTemplate`.
2. Set its name.
3. In the metadata panel, pick a `Group`.
4. Configure `Applies to any type` or pick specific TypeDropdown values.
5. Add Requirements as child items in the RequirementsDisplayer container.
6. Add Changes as child items in the ChangeDisplayer container.
7. Drop the finished ChangeSet onto an actor to test.

### Composing a monster

1. Pick a TypeDropdown value for the actor (this sets the lineage).
2. Drop a Size ChangeSet into the Size container.
3. Drop a Role ChangeSet into the Role container.
4. Drop a Domain ChangeSet into the Domain container.
5. Drop one or more Motivation, Loadout, Quirk ChangeSets into their
   containers.
6. Optionally click Roll Boost a few times to scale the creature up.

### Tweaking an existing monster

- Reorder ChangeSets within a multi-slot group by drag-and-drop. Order
  matters because Overrides reset the stack at their position.
- Remove a ChangeSet by deleting it from the container — the actor reverts
  to its prior state for that group.

## Glossary

| Term | Definition |
|---|---|
| Actor | A Foundry document representing a character, NPC, or monster. |
| ChangeSet | A composable bundle of Changes and Requirements. |
| Change | A single atomic modification. |
| Requirement | A precondition predicate. |
| Group | One of seven pipeline slots a ChangeSet can fill. |
| ForType | Which TypeDropdown values a ChangeSet is valid for. |
| Tag | A string label applied via a Tag Change, read by Requirements. |
| Trait | A named ability with description. |
| Tier | Derived count of items in the Boost container. |
| Lineage | The actor's TypeDropdown value (Beast, Undead, etc.). |
| Boost | A ChangeSet randomly applied from a configured RollTable. |
| Primary stat | One of Strength, Dexterity, Stamina, Intelligence, Faith, Charisma, Power — stored as dice + mod on the d6 ladder. |
| Skill | A separately-templated item with a `Level` field, granted or modified by Skill Changes. |
| Active Effect | Foundry-native temporary modifier, applied on top of `effective.*` to produce `actual.*`. |
