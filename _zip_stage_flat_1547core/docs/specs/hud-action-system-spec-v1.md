# HUD Action System Spec V1

## Purpose

This document defines a robust action model for clickable HUD entries in
`1547Core`.

The goal is to let HUD rows represent real playable actions instead of acting as
isolated button handlers. This is especially important for:

- stat rolls
- skill checks
- weapon attacks
- equipping and reloading weapons
- consumable use
- maneuver activation
- future power, spell, pact, and effect actions

## Core Principle

Every actionable HUD row should resolve to a normalized action descriptor.

That descriptor is then:

1. built from the clicked source
2. evaluated against current game context
3. marked as `valid`, `invalid`, or `incomplete`
4. previewed or executed through a registered action handler

The HUD is not the rules engine. It is a context-sensitive action surface over
the authoritative combat and item systems.

## Design Goals

The HUD action system should:

- give every clickable row a consistent interaction model
- separate action description from action execution
- separate legality evaluation from UI rendering
- support missing context such as no target selected yet
- support immediate rolls and multi-step actions
- scale from simple stat checks to weapon attacks and item use
- remain compatible with combat timing, action economy, and maneuver legality

## Out Of Scope

This spec does not define:

- final attack resolution math
- final maneuver effect resolution
- full combat controller implementation
- full item authoring schemas

It defines the action interaction layer that the HUD should use.

## Terminology

### HUD Source

The thing the player clicked in the HUD.

Examples:

- a stat row
- a skill row
- a weapon row
- a consumable row
- a maneuver row

### Action Descriptor

A normalized object describing what the player is trying to do.

### Action Context

The current play state used to judge whether that action can be taken right now.

### Action Handler

A registered implementation that can preview, confirm, and execute a given
action type.

## Action Descriptor

All actionable HUD entries should resolve into the same normalized shape.

### Minimum Shape

```js
{
  actionType,
  sourceType,
  sourceId,
  label,
  actorId,
  tokenId,
  handlerId,
  targeting,
  requirements,
  costs,
  rollData,
  metadata
}
```

### Required Fields

- `actionType`
- `sourceType`
- `sourceId`
- `label`
- `actorId`
- `handlerId`

### Optional Fields

- `tokenId`
- `targeting`
- `requirements`
- `costs`
- `rollData`
- `metadata`

## Action Types

The first supported action types should be:

- `roll-stat`
- `roll-skill`
- `attack-with-weapon`
- `equip-item`
- `reload-weapon`
- `use-consumable`
- `use-maneuver`

Later action types may include:

- `cast-spell`
- `use-power`
- `invoke-pact`
- `apply-usage-effect`

## Source Types

The HUD should normalize these source types:

- `stat`
- `skill`
- `weapon`
- `armor`
- `consumable`
- `equippable`
- `maneuver`
- `spell`
- `power`
- `pact`
- `usage-effect`

Source type should come from the authoritative CSB template mapping where
possible.

## Action Context

Each action must be evaluated against a shared context model.

### Minimum Context

```js
{
  actor,
  token,
  selectedToken,
  hoveredToken,
  targetedTokens,
  inCombat,
  combatRound,
  actionEconomy,
  pointPools,
  riskPoints,
  criticalPoints,
  conditions,
  persistentEffects,
  equippedItems,
  readyItems
}
```

### Extended Context

When needed, context may also include:

- selected weapon
- selected attack profile
- range to target
- facing information
- threat and vulnerability relationship
- counter roll configuration
- active preview state
- current combat timing window

## Action Status

Every action evaluation should return one of three statuses:

- `valid`
- `invalid`
- `incomplete`

### Valid

The action can be executed immediately or confirmed immediately.

Examples:

- a stat roll
- a skill check
- a consumable with no target requirement

### Invalid

The action cannot currently be taken.

Examples:

- no attacks remain
- target is out of reach
- actor lacks required points

### Incomplete

The action could become valid if missing context is supplied.

Examples:

- attack clicked with no target selected
- consumable clicked with no recipient selected
- maneuver clicked before a required weapon profile is chosen

This distinction is important because the HUD should not treat all failures as
hard failures.

## Action Validation Result

Each evaluated action should return:

```js
{
  status,
  reasons: [],
  resolvedTargets: [],
  resolvedCosts: {},
  rollPreview,
  followUp
}
```

### Reasons

`reasons` is a player-facing explanation list.

Examples:

- `Weapon is not equipped`
- `Select a target`
- `Target is out of reach`
- `Not enough StrengthPoints`

### Follow-Up

`followUp` describes what the HUD should prompt for next.

Examples:

- `select-target`
- `select-weapon-profile`
- `confirm-full-turn-equip`
- `confirm-roll-modifier-consumption`
- `confirm-cost`
- `confirm-action`

## Targeting Model

Each action descriptor should declare a targeting mode.

### Targeting Modes

- `none`
- `self`
- `single-target`
- `multi-target`
- `area`
- `optional-single-target`

### Examples

- stat roll: `none`
- skill check with difficulty only: `none`
- weapon attack: `optional-single-target`
- healing consumable: `single-target` or `self`
- battlefield maneuver: `area`

## Execution Modes

Not every action should execute the same way.

### Modes

- `instant`
- `preview-then-confirm`
- `target-then-confirm`

### Examples

- `roll-stat`: `instant`
- `roll-skill`: `instant`
- `attack-with-weapon`: `preview-then-confirm`
- `equip-item`: `preview-then-confirm`
- `use-consumable` with target: `target-then-confirm`
- `use-maneuver`: usually `preview-then-confirm`

## Roll Preview Model

The current stat roll preview should evolve into a generic action preview model.

### Preview Shape

```js
{
  title,
  actionType,
  sourceLabel,
  targetLabels,
  baseFormula,
  advantageDice,
  riskDice,
  finalFormula,
  costs,
  notes
}
```

### Current Usage

The existing HUD preview already supports:

- `Base`
- `Advantage Dice`
- `Risk Dice`
- `Final`

That preview model should be generalized rather than replaced.

## Handler Registry

The HUD should not spread action logic across isolated click handlers.

Instead, there should be a handler registry keyed by `actionType`.

### Example Shape

```js
{
  "roll-stat": statActionHandler,
  "roll-skill": skillActionHandler,
  "attack-with-weapon": weaponAttackHandler,
  "equip-item": equipItemHandler,
  "reload-weapon": reloadWeaponHandler,
  "use-consumable": consumableHandler,
  "use-maneuver": maneuverHandler
}
```

### Handler Responsibilities

Each handler should be able to:

- build or refine preview data
- validate context-specific legality
- execute the action
- return document updates and chat outputs as needed

## HUD Source Rules

### Stat Rows

Clicking a stat row should create:

```js
{
  actionType: "roll-stat",
  sourceType: "stat",
  sourceId: "Strength",
  label: "Strength Check"
}
```

This action is usually:

- targeting mode: `none`
- execution mode: `instant`

### Skill Rows

Clicking a skill row should create:

```js
{
  actionType: "roll-skill",
  sourceType: "skill",
  sourceId: skillId,
  label: "<Skill Name> Check"
}
```

This action is usually:

- targeting mode: `none`
- execution mode: `instant`

Counter roll configuration may extend the execution result but does not change
the base action type.

### Weapon Rows

Clicking a weapon row should not automatically mean one fixed thing.

The primary available action should be resolved from context.

Examples:

- not equipped: `equip-item`
- weapon can still be used even if it is not equipped, if the rules or player
  choice allow it
- no target selected: `attack-with-weapon` as a plain attack roll
- target selected and legal: `attack-with-weapon`
- target selected but out of reach: `attack-with-weapon` with `invalid` status
  and a clear message

This means weapon rows should produce context-sensitive primary actions.

## Weapon HUD Actions

Weapons need a more specific rules section because their clickable behavior is
stateful and may branch into either lightweight rolling or full combat
resolution.

### Weapon State Inputs

Weapon actions should consider:

- whether the weapon is equipped
- whether the weapon is loaded or reloaded where relevant
- whether a target is selected
- whether the selected target is in reach
- whether temporary roll modifiers are currently available
- whether the actor can currently spend a full-turn activity

### Equip Action

`equip-item` is a full-turn activity.

Because of that, the HUD should not execute it immediately.

Instead:

- clicking `Equip` should open a confirmation dialog
- the dialog should clearly state that equipping costs a full-turn activity
- the player must be able to cancel

`equip-item` is not the same as `attack-with-weapon`.

The HUD should allow weapon use even when the weapon is not equipped if the
player intentionally chooses to use it and the current rules permit that
freedom.

### Reload Action

`reload-weapon` is separate from equipping and separate from attacking.

The HUD should not use `ready-weapon` as a generic weapon state label.

For this system:

- `equip-item` means preparing the weapon for ongoing carried use
- `reload-weapon` means restoring ammunition or load state
- `attack-with-weapon` means making the attack roll or attack resolution

### Attack Without Target

If no target is selected, clicking a weapon row should still permit a plain
attack roll.

That means:

- build a normal weapon attack roll
- do not attempt defender resolution
- do not attempt armor resolution
- do not attempt target-specific reaction logic

If temporary roll modifiers are available and would be consumed, the HUD should
ask whether the player wants to consume them before the roll is made.

This allows attack rolling without forcing target selection for every test roll
or edge case.

### Attack With Target

If a target is selected and is within reach, clicking the weapon row should
resolve a targeted attack path.

This targeted path should eventually support:

1. attack roll
2. attack roll modifications
3. defender armor or defense roll
4. reaction handling
5. critical point generation
6. risk dice handling
7. damage resolution
8. post-resolution effects

This full path is more complex than a plain roll and may need its own preview
or confirm step.

### Target Out Of Reach

If a target is selected but outside legal reach:

- the weapon action result should be `invalid`
- the HUD should show a clear player-facing message:
  - `Target is out of reach`

The action should not silently fail.

### Weapon Execution Paths

The weapon action layer should support two different execution paths:

#### Plain Attack Roll

Used when:

- no target is selected

Behavior:

- make the attack roll only
- optionally consume chosen temporary roll modifiers
- no armor roll
- no target reactions

#### Targeted Attack Resolution

Used when:

- a valid target is selected
- the target is in reach

Behavior:

- full attack resolution path
- defender handling included
- reactions included
- critical and risk handling included

## Weapon Action Status Examples

Examples:

- weapon clicked, not equipped, full-turn available:
  - primary action: `equip-item`
  - status: `incomplete`
  - follow-up: `confirm-full-turn-equip`

- weapon clicked, no target selected:
  - primary action: `attack-with-weapon`
  - status: `valid`

- weapon clicked, target selected but out of reach:
  - primary action: `attack-with-weapon`
  - status: `invalid`
  - reasons:
    - `Target is out of reach`

### Consumable Rows

Consumables should resolve to `use-consumable`.

Whether they execute instantly or require a target depends on item rules.

### Maneuver Rows

Maneuver clicks should resolve to `use-maneuver`.

Legality depends on:

- timing window
- trigger
- current action context
- target requirements
- selected weapon and profile
- costs and usage limits

## Inventory Action Rules

The inventory tab should prioritize player-facing actions over raw item display.

### First Responsibility

Show what the player can meaningfully do with the item right now.

### Row Behavior

Each inventory row should expose:

- primary action
- optional action status
- optional preview on hover or selection

The row should not need to expose every possible secondary action immediately.

### Examples

Weapon:

- `Equip`
- `Attack`
- `Reload`

Consumable:

- `Use`

Armor:

- `Equip`

Light source:

- `Use`
- `Light`
- `Extinguish`

## Legality Inputs

HUD item actions should validate against these sources of truth:

- combat timing
- action economy
- equipped and ready state
- target selection
- range and facing
- actor conditions
- actor persistent effects
- target state
- point affordability
- usage limits

This overlaps intentionally with maneuver legality. The HUD action layer should
query and display legality, not reinvent the rules.

## Unknown Items

If an item source can be displayed in the HUD but does not map to a known action
or type:

- its source type is `unknown`
- its action status should default to `invalid`
- the HUD should provide a readable reason such as:
  - `No HUD action is defined for this item`

This is better than guessing behavior.

## Suggested Implementation Order

The first implementation pass should support:

1. `roll-stat`
2. `roll-skill`
3. `attack-with-weapon`
4. `equip-item`
5. `reload-weapon`
6. `use-consumable`
7. `use-maneuver`

## Integration With Existing HUD

The current HUD already contains pieces of the future action system:

- clickable stat rows
- clickable skill rows
- roll preview state
- target mode toggle
- combat-aware inventory presentation

Those should be refactored into the normalized action system rather than
replaced with separate code paths.

## Bottom Line

The HUD should treat clicks as action requests, not widget-specific events.

That means:

- every clickable entry becomes an action descriptor
- every descriptor is validated against shared context
- every valid action is handled by a registered handler
- missing context results in `incomplete`, not silent failure

This gives `1547Core` a stable path from simple roll buttons to fully
context-aware, combat-legal HUD actions.
