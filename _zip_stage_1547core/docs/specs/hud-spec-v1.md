# HUD Spec V1

## Purpose

This document defines the current heads-up display requirements for `1547Core`.

The HUD is a compact play surface for the selected token. It should make the
selected actor's current state readable during combat and expose fast access to
checks, equipment context, maneuvers, and conditions without replacing the full
actor sheet.

It is not the source of truth for rules. The combat engine, resource logic, and
handlers remain authoritative.

## Design Goals

The HUD should:

- stay contextual to the currently selected token
- remain compact enough to live beside Foundry UI rather than replacing it
- present only one main branch of detail at a time
- keep persistent state separate from temporary roll state
- expose the most common combat information without deep sheet navigation
- feel readable on smaller windows through horizontal navigation and one primary
  scroll area

## Core Principle

The HUD is a view and input layer over normalized actor and combat state.

That means:

- the selected token drives HUD content
- HUD widgets read normalized values
- HUD actions request rolls or service actions
- HUD does not own combat state
- HUD does not directly embed rules logic beyond presentation and lightweight
  preview composition

## Scope

The HUD should cover:

- selected actor identity
- persistent combat state
- current points and health
- equipped weapon and armor visibility
- stat checks
- skill checks
- quick inventory context
- maneuver browsing by timing
- conditions and persistent effects

It should not replace:

- full actor sheets
- item editing
- long-form inventory management
- deep content authoring tools
- full combat logs

## Current Layout Model

The HUD uses a 3-level navigation structure:

1. top-row main categories
2. horizontal subgroup row for the active category when needed
3. one scrollable content area for the selected branch

This keeps navigation stable while preventing large vertical sheets from taking
over the screen.

## Top-Level Categories

The current player-facing HUD categories are:

1. `Overview`
2. `Stats`
3. `Inventory`
4. `Maneuvers`
5. `Skills`
6. `Conditions`

These are presentation categories. They do not replace internal item folders,
rules timing, or handler-layer concepts.

## Header

The HUD header should always show:

- actor portrait
- token or actor name
- combat active or inactive
- current round when combat is active

If combat is not active, the header should state that clearly.

## Overview

`Overview` is reserved for persistent or semi-persistent current state.

It should not show temporary roll modifiers such as advantage dice.

`Overview` should contain 4 blocks:

1. `HP`
2. core point pools
3. `Risk` and `Crit`
4. equipped and status summaries

### HP Block

The `HP` block should be visually separated from the rest of the overview.

It should show:

- current hit points
- max hit points if available

### Core Point Pools

The point-pool block should be visually distinct from both `HP` and `Risk/Crit`.

It should show the currently available and maximum values, when available, for:

- `StrengthPoints`
- `StaminaPoints`
- `DexterityPoints`
- `CharismaPoints`
- `IntelligencePoints`
- `FaithPoints`
- `PowerPoints`

### Risk And Crit

`RiskPoints` and `CriticalPoints` should be grouped together and visually
separated from both `HP` and the core stat-point pools.

This distinction matters because:

- they are combat-state trackers rather than ordinary stat pools
- they affect tactical decision-making differently from ordinary points

### Equipped

The equipped summary should show:

- ready or equipped weapons relevant to current combat use
- equipped armor

This area is for awareness, not editing.

### Status

The status summary should show:

- current conditions
- persistent effects that matter to immediate play

This is a compact awareness block, not a deep rules text panel.

## Stats

`Stats` is a quick stat-check category.

Each stat row is defined by two actor properties:

- `Stats_<Name>Dice`
- `Stats_<Name>Mod`

Example:

- `Stats_IntelligenceDice = 2`
- `Stats_IntelligenceMod = 3`
- displayed formula: `2d6 + 3`

Rules for display:

- `Mod` is never below `0`
- if `Mod = 0`, show `Xd6`
- if `Mod > 0`, show `Xd6 + Mod`

The current stat list should include:

- `Strength`
- `Stamina`
- `Dexterity`
- `Charisma`
- `Intelligence`
- `Faith`
- `Power`

Clicking a stat row should open or update a roll preview for that stat.

## Stat Roll Preview

Temporary roll state belongs in the roll preview, not in `Overview`.

The stat roll preview should show:

- `Base`
- `Advantage Dice`
- `Risk Dice`
- `Final`

Example:

- `Base: 2d6 + 3`
- `Advantage Dice: 2`
- `Risk Dice: 1`
- `Final: 4d6 + 3`

The preview is where temporary roll construction is visualized.

`Overview` should not duplicate this.

## Skills

`Skills` should provide a single scrollable list of skills for quick checks.

Each row should show:

- skill name
- compact supporting context such as skill group or linked stat when useful

Clicking a skill row should initiate or prepare a skill check.

This category is for quick play use, not long-form skill management.

## Inventory

`Inventory` should support quick battlefield-relevant context without replacing
the actor sheet.

It should contain:

- a top summary of equipped or ready weapons
- grouped inventory content below

Recommended subgroup ideas:

- `Equipped`
- `Weapons`
- `Armor`
- `Consumables`
- `Other`

The lower area should remain scrollable.

Inventory is also where quick-use items and weapon changes are surfaced.

## Weapon Readying And Switching

The HUD should reflect the current rules direction:

- changing weapon state is not a separate `Draw` maneuver
- changing to another weapon should normally cost a full-turn action or an
  equivalent committed readying action
- `Quick Draw` is the maneuver that bypasses that cost for eligible sidearms

This means:

- `Draw` should not exist as a maneuver entry
- normal weapon swapping should be treated as a slower equipment action
- `Quick Draw` should remain visible in maneuver logic and legality filtering

## Maneuvers

`Maneuvers` should use:

1. the main category row
2. a horizontal subgroup row by timing
3. one scrollable list of maneuvers for the selected timing group

Only one timing subgroup should be visible at a time.

Typical maneuver timing groups:

- `Pre`
- `Reaction`
- `Post`
- `FullTurn`

Each maneuver row should show:

- name
- compact timing or usage context
- any short secondary detail useful in play

The maneuver list should be compact and should not use stacked subgroup panels.

## Conditions

`Conditions` should show the current active conditions and relevant persistent
effects affecting the selected actor.

It should stay compact and scrollable if necessary.

This category is for awareness, not editing.

## Navigation Rules

The HUD should follow these interaction rules:

- only one main category is active at a time
- only one subgroup is active at a time when a category uses subgroups
- the content area below is the primary scrollable region
- subgroup rows should remain visible while their list scrolls when useful

This keeps the HUD readable with large maneuver or inventory lists.

## Visual Direction

The current visual direction is:

- semi-transparent
- readable over the map
- compact rather than sheet-like
- stronger contrast for active tabs
- tighter spacing in the content list

Transparency is acceptable as long as:

- active navigation states are clear
- content remains legible
- the panel still reads as a HUD rather than disappearing into the scene

## Positioning

The HUD should position itself dynamically based on the live Foundry interface.

It should:

- avoid overlapping the left-side Foundry controls
- account for `#scene-navigation` and `#controls`
- occupy the first free horizontal space to the right of blocking UI when
  possible
- remain usable on smaller windows

## Synchronization

The HUD should rerender or reposition when relevant context changes, including:

- token selection changes
- canvas ready
- actor updates
- item changes
- combat updates
- scene navigation rerenders
- sidebar collapse changes
- window resize

## Automation Boundary

The HUD should not:

- decide maneuver legality as its own source of truth
- directly mutate actor or combat documents as a rules engine
- replace service-layer validation

It should:

- display normalized state
- request actions
- build lightweight previews for the current player choice
- reflect rule outcomes returned by the authoritative systems

## Suggested Read Models

The HUD benefits from normalized read models such as:

```js
{
  actorSummary,
  pointPoolSummary,
  riskAndCritSummary,
  statSummary,
  inventorySummary,
  maneuverSummary,
  conditionSummary,
  rollPreview
}
```

## Bottom Line

The HUD should be a compact, transparent, token-contextual play surface.

It should emphasize:

- persistent current state in `Overview`
- quick formula-based checks in `Stats`
- fast access to items in `Inventory`
- timing-based browsing in `Maneuvers`
- quick checks in `Skills`
- readable current status in `Conditions`

while keeping temporary roll math inside roll previews instead of cluttering the
overview.
