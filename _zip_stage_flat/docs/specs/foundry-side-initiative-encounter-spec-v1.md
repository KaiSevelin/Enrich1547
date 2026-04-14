# Foundry Side Initiative Encounter Spec v1

## Purpose

This document defines how side-based initiative should integrate with Foundry's
built-in combat encounter system for 1547 Core.

It answers two practical questions:

1. how actors are assigned to teams when a combat encounter is created
2. how side-based initiative is represented inside the normal Foundry combat tracker

This spec is intentionally implementation-oriented. It is meant to give the HUD,
combat services, and encounter setup a single stable source of truth.

## Chosen Direction

### Team Assignment

Use explicit combatant team assignment.

Each combatant in the Foundry encounter must carry a stored `sideId` on module
flags.

Default values may be seeded from Foundry token disposition:

- friendly disposition -> `team-1`
- hostile disposition -> `team-2`
- neutral or unknown disposition -> `team-2`

The GM can override those defaults during encounter setup.

### Tracker Display

Keep the normal Foundry combatants visible in the tracker.

Add side headers and side-state decoration inside the standard Foundry combat
tracker rather than replacing the tracker with synthetic side-only rows.

This means:

- actors still exist as normal Foundry combatants
- the combat tracker remains recognizable and usable
- the module visually groups combatants by side
- the active side is highlighted in the tracker UI

## Core Model

### Combatant State

Each combatant stores:

```js
combatant.flags["1547core"] = {
  sideId: "team-1"
}
```

### Combat State

Combat stores side order and activation state:

```js
combat.flags["1547core"] = {
  sideOrder: ["team-1", "team-2"],
  activeSideId: "team-1",
  roundNumber: 1,
  sides: {
    "team-1": {
      id: "team-1",
      label: "Team 1",
      combatantIds: []
    },
    "team-2": {
      id: "team-2",
      label: "Team 2",
      combatantIds: []
    }
  }
}
```

### Actor Round State

Each actor's round state continues to store side identity explicitly:

```js
{
  actorId,
  sideId,
  movementBudget,
  movementRemaining,
  attacksRemaining,
  fullTurnAvailable,
  fullTurnLocked,
  maneuverUsage: {},
  persistentManeuvers: {},
  RiskPoints,
  done
}
```

## Encounter Creation Flow

### Create Encounter

The GM selects tokens on the scene and starts combat through a 1547 encounter
setup flow.

Expected flow:

1. selected tokens are added to a standard Foundry combat encounter
2. each resulting combatant gets a default `sideId`
3. defaults are derived from disposition when possible
4. a small team-assignment dialog opens for confirmation/editing
5. the GM confirms the team assignments
6. the module builds side membership and side order
7. side initiative is rolled once per side
8. the winning side becomes `activeSideId`

### Team Defaults

Team assignment defaults are:

- `team-1` for friendly tokens
- `team-2` for hostile tokens
- `team-2` for neutral/unknown tokens unless the GM changes them

This gives the GM a fast default while keeping explicit side ownership in stored
state.

## Side Initiative

### Initiative Roll

Initiative is rolled once per side, not once per actor.

The resulting side order is stored in:

- `combat.flags.1547core.sideOrder`

The current active side is stored in:

- `combat.flags.1547core.activeSideId`

### Side Activation

During a side activation:

- any actor on the active side may act
- actor order inside the side is flexible
- `done` remains a coordination marker only
- the side ends only when the active side uses the side-end control

### Side Transition

When `Side Ready` or `End Group Turn` is used:

1. read `activeSideId`
2. advance to the next side in `sideOrder`
3. if another side remains in the current round, activate it
4. if the order wraps, increment round and activate the first side again
5. reset side-based round state as needed

This button must not infer sides ad hoc from token disposition at click time.
It must use stored combat side state.

## Foundry Tracker Rendering

The standard combat tracker remains the visible container.

The module should add:

- side headers such as `Team 1` and `Team 2`
- visual grouping of combatants under their side
- active-side highlight
- optional actor `done` markers
- a combat header showing current round and active side

The tracker should not require synthetic side-only rows in the first
implementation.

## Data Ownership

### Foundry Owns

Foundry remains responsible for:

- combat encounter existence
- combatant documents
- token references
- actor references
- tracker rendering lifecycle hooks

### 1547 Core Owns

1547 Core remains responsible for:

- side membership
- side initiative order
- active side state
- side transitions
- side-based round resets
- done markers
- side-based legality and reactions

## Fallback Rules

If explicit side state is missing for legacy encounters:

1. attempt to derive side defaults from combatant disposition
2. if still unclear, derive player-owned combatants as `team-1` and other
   combatants as `team-2`
3. persist the repaired side state back onto the combat encounter

This fallback is for compatibility only. It is not the intended steady-state
model.

## Required UI Pieces

The first implementation should include:

- a `Create 1547 Encounter` or equivalent setup action
- a team-assignment dialog with default values
- side headers in the Foundry tracker
- an active-side display
- a reliable `Side Ready` / `End Group Turn` control using stored side state

## Non-Goals For The First Slice

The first slice does not need to:

- replace the entire Foundry combat tracker
- support arbitrary custom team counts beyond the stored side model
- add synthetic combatant rows for sides
- solve multiplayer socket routing in the same change

## Recommended Next Implementation Order

1. add `combatant.flags.1547core.sideId`
2. add `combat.flags.1547core.sideOrder` and `activeSideId`
3. create encounter setup with `team-1` and `team-2` defaults
4. render side headers in the tracker
5. rewrite `Side Ready` to use stored side state only
6. add round reset and active-side UI polish

