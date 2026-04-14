# 1547 Core Maneuver State Spec v1

## Purpose

This document defines the player-facing state model for maneuver buttons in the
HUD.

The goal is to make maneuver interaction predictable, resource-aware, and easy
to understand before adding broader maneuver automation.

## Scope

This spec covers:

- maneuver button states
- timing-based visibility
- resource reservation
- reset rules by maneuver type
- expected HUD behavior for the first implementation slice

This spec does not yet define the full automation behavior for every maneuver
handler.

## Core Button States

A maneuver button has exactly one of three states:

### 1. Disabled

The maneuver is currently not legal.

Examples:

- no valid weapon for the maneuver
- missing required weapon trait
- not enough resource points
- wrong timing window
- wrong target state
- wrong range
- usage limit already reached

HUD behavior:

- the button is visibly disabled
- the button cannot be clicked
- the button shows a tooltip explaining why it is disabled
- the tooltip should show the first blocking reason, with room to expand to a
  short reason list later

### 2. Enabled

The maneuver is legal and can be selected.

HUD behavior:

- the button is visibly active
- the button can be clicked
- no resources are reserved yet

### 3. Selected

The maneuver is legal and currently selected for the active timing window.

HUD behavior:

- the button is visibly pressed or highlighted
- any connected resource cost is reserved immediately
- overview resource displays update immediately
- clicking the button again deselects it
- deselecting the button releases the reserved resource cost

## Resource Reservation Model

Selecting a maneuver does not immediately spend resources.

Selecting a maneuver reserves resources in HUD state.

Rules:

- reserved resources reduce the visible currently available pool in the HUD
- reserved resources affect legality recalculation for other maneuvers
- deselecting a maneuver releases its reservation
- resources are only actually spent when the action is committed

Example:

- actor has `1 DexterityPoints`
- player selects a `DexterityPoints 1` pre-maneuver
- that point is now reserved
- another `DexterityPoints 1` maneuver becomes disabled until the first one is
  deselected or committed

## Timing Visibility Rules

Maneuvers are not all shown in the same way.

### Reaction Maneuvers

Reaction maneuvers are not shown under the normal `Maneuvers` tab.

They are only shown when a reaction window is opened.

### Pre Maneuvers

Pre maneuvers are shown before an attack.

Initial implementation target:

- selectable before attack declaration
- tied to the current attack context
- selected pre-maneuvers are passed into attack declaration

### Full-Turn Maneuvers

Full-turn maneuvers are selectable before moving or doing anything else.

They should only be shown when the actor still has a legal full-turn action.

### Post Maneuvers

Post maneuvers are shown only after an attack is completed and a post-attack
window is open.

## Reset Rules By Type

Maneuver selection state resets depending on timing.

### Pre

Reset when:

- the attack is committed
- the attack is cancelled
- the player changes context in a way that invalidates the current attack setup

### Reaction

Reset when:

- the reaction window closes
- the player passes
- a reaction is committed
- the timer expires

### Post

Reset when:

- the post-attack window closes
- a post maneuver is committed
- the post window expires or is dismissed

### Full-Turn

Reset when:

- the full-turn maneuver is committed
- the actor takes another action that invalidates the full-turn opportunity
- the side/turn state advances

## Legality Evaluation Model

A maneuver row should be derived from:

- timing window
- current action context
- legality evaluation
- currently reserved resources
- whether the maneuver is already selected in the current timing window

A maneuver can only be `selected` if it is still legal after reserved resources
are considered.

After every select or deselect action, the HUD must:

1. recompute reserved totals
2. recompute maneuver legality
3. update overview resource displays
4. rerender maneuver rows

## Overview Expectations

The `Overview` tab should reflect reserved costs immediately.

This means:

- current visible resource values should account for reserved costs
- reserved points should be distinguishable from permanently spent points in the
  future if needed
- the first implementation may simply show the reduced available value as long
  as the reservation logic is consistent

## First Implementation Slice

The first implementation slice should focus on `pre` maneuvers only.

Goals:

- hide `reaction` maneuvers from the normal maneuvers tab
- show `pre` maneuvers as `disabled`, `enabled`, or `selected`
- allow selecting and deselecting `pre` maneuvers
- reserve and release maneuver resource costs immediately in HUD state
- update overview resource displays immediately
- pass selected `pre` maneuvers into `declareAttack(...)`
- reset selected `pre` maneuvers after attack commit or cancellation

## Suggested HUD State Shape

A minimal state shape can look like:

```js
HUD_STATE.maneuverSelection = {
  pre: new Set(),
  fullTurn: new Set(),
  post: new Set()
};

HUD_STATE.maneuverReservations = {
  StrengthPoints: 0,
  StaminaPoints: 0,
  DexterityPoints: 0,
  CharismaPoints: 0,
  IntelligencePoints: 0,
  FaithPoints: 0,
  PowerPoints: 0,
  CriticalPoints: 0
};
```

## Non-Goals For This Spec

This spec does not yet require:

- full automation for every maneuver effect
- post-maneuver HUD implementation
- full-turn maneuver commit flow
- expanded reaction chooser redesign
- advanced tooltip formatting beyond the first blocking reason

## Decision Summary

- maneuver buttons have exactly three states: `disabled`, `enabled`, `selected`
- selected maneuvers reserve resources immediately
- normal maneuver browsing should not show reaction maneuvers
- `pre`, `post`, and `full-turn` maneuvers are tied to their own timing windows
- state resets depend on maneuver timing
- the first implementation target is `pre` maneuver selection and reservation