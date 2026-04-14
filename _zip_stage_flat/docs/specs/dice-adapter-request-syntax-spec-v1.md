# Dice Adapter Request Syntax Spec V1

## Purpose

This document defines the logical request syntax passed from combat into the
`1547Core` dice adapter.

It also defines the adapter-side normalization expectations before a request is
translated into the concrete `dice1547` roll syntax.

## Request Model

```js
{
  requestId,
  actionId,
  rollKind, // "attack" | "defense"
  actorId,
  sideId,
  targetId: null | string,
  targetingMode: "single" | "group",
  attackMode: "normal" | "safe",
  orderedDice: [],
  filters: [],
  tags: [],
  metadata: {},
  timeoutMs: 5000
}
```

## Field Definitions

### `requestId`

Unique adapter-level request identifier.

### `actionId`

Action context owner of this roll.

### `rollKind`

- `attack`
- `defense`

### `actorId`

The actor performing the roll.

### `targetId`

Relevant target. `null` is allowed for shared attacker group rolls.

### `targetingMode`

- `single`
- `group`

### `attackMode`

- `normal`
- `safe`

### `orderedDice`

Ordered logical dice pool.

### `filters`

Post-roll ignore rules.

### `tags`

Free-form descriptors such as:

- `combat`
- `reaction`
- `post-maneuver`
- `safe-attack`

### `metadata`

Free-form contextual payload for combat correlation.

### `timeoutMs`

Optional timeout override. Default is 5000 ms.

## Ordered Dice Entry

```js
{
  dieType,
  source,
  sourceId: null | string,
  orderIndex
}
```

Recommended `source` values:

- `weapon-base`
- `armor-base`
- `advantage`
- `risk`
- `maneuver`
- `persistent-effect`

## Filter Syntax

### Ignore All Dice of a Type

```js
{
  type: "ignore-die-type",
  dieType: "multiplier"
}
```

### Ignore Faces By Total Value

```js
{
  type: "ignore-total-value",
  totalKey: "protection",
  value: 1
}
```

### Ignore Faces By Label

```js
{
  type: "ignore-face-label",
  label: "critical"
}
```

### Stunt-Driven Filter

```js
{
  type: "stunt-filter",
  stuntType: "disarm"
}
```

This should only be used if a stunt handler exists.

## Example Single-Target Attack Request

```js
{
  requestId: "req-100",
  actionId: "act-20",
  rollKind: "attack",
  actorId: "actor-a",
  sideId: "side-red",
  targetId: "actor-b",
  targetingMode: "single",
  attackMode: "normal",
  orderedDice: [
    { dieType: "evade", source: "weapon-base", sourceId: "weapon-1", orderIndex: 0 },
    { dieType: "control", source: "weapon-base", sourceId: "weapon-1", orderIndex: 1 },
    { dieType: "balanced", source: "weapon-base", sourceId: "weapon-1", orderIndex: 2 },
    { dieType: "evade", source: "advantage", sourceId: null, orderIndex: 3 }
  ],
  filters: [],
  tags: ["combat", "attack"],
  metadata: {
    attackType: "melee"
  },
  timeoutMs: 5000
}
```

## Example Group Safe Attack Request

```js
{
  requestId: "req-200",
  actionId: "act-77",
  rollKind: "attack",
  actorId: "actor-a",
  sideId: "side-red",
  targetId: null,
  targetingMode: "group",
  attackMode: "safe",
  orderedDice: [
    { dieType: "heavy", source: "weapon-base", sourceId: "weapon-9", orderIndex: 0 },
    { dieType: "balanced", source: "weapon-base", sourceId: "weapon-9", orderIndex: 1 },
    { dieType: "multiplier", source: "maneuver", sourceId: "maneuver-safe", orderIndex: 2 }
  ],
  filters: [],
  tags: ["combat", "attack", "safe-attack", "group"],
  metadata: {
    templateId: "template-5"
  }
}
```

## Translation Responsibility

Combat must only build this logical request.

The dice adapter is solely responsible for translating logical requests into the
actual `dice1547` roll syntax or formula strings.

Combat must not build formula strings directly.

## Validation Rules

Before execution, adapter should validate:

- `requestId` exists
- `actionId` exists
- `rollKind` is valid
- `orderedDice` is not empty
- `timeoutMs` is positive if provided

Invalid requests fail before roll execution.

## Ignore Reason Model

Normalized results should store all ignore reasons for an ignored face:

```js
{
  ignored: true,
  ignoreReasons: [
    "ignore-die-type:multiplier",
    "ignore-face-label:critical"
  ]
}
```

All reasons are collected.

## Default Timeout

Default timeout is 5000 ms, configurable per request or adapter configuration.
