# Handler Registration Spec V1

## Purpose

This document defines how content modules register custom maneuver and stunt
handlers with `1547Core`.

The goals are:

- allow `1547Core` to stay content-light
- support custom automation without hardcoding content into core
- keep handler lookup deterministic
- allow content without handlers to remain valid

## Core Principle

Content data and runtime behavior are separate.

That means:

- maneuvers/items define `handlerId` in content data if they need custom behavior
- content modules register matching runtime handlers during startup
- `1547Core` resolves handlers at runtime by id

If no handler is registered:

- content remains valid
- generic `effectData` may still be applied
- unsupported custom behavior is not auto-resolved

## Supported Handler Kinds

The registration system should support at least:

- maneuver handlers
- stunt handlers
- optional persistent-effect handlers

Recommended handler categories:

- `maneuver`
- `stunt`
- `persistent-effect`

## Registry Model

`1547Core` should conceptually maintain in-memory registries for handlers.

Recommended structure:

```js
{
  maneuver: new Map(),
  stunt: new Map(),
  persistentEffect: new Map()
}
```

Each map key is a `handlerId`.

## Registration API

Recommended conceptual API:

```js
registerManeuverHandler(handlerId, handler, options)
registerStuntHandler(handlerId, handler, options)
registerPersistentEffectHandler(handlerId, handler, options)
```

Recommended unregister API:

```js
unregisterManeuverHandler(handlerId)
unregisterStuntHandler(handlerId)
unregisterPersistentEffectHandler(handlerId)
```

Recommended query API:

```js
getManeuverHandler(handlerId)
getStuntHandler(handlerId)
getPersistentEffectHandler(handlerId)
hasManeuverHandler(handlerId)
hasStuntHandler(handlerId)
hasPersistentEffectHandler(handlerId)
```

## Handler Registration Input

Recommended registration contract:

```js
registerManeuverHandler(handlerId, handler, {
  moduleId,
  version,
  capabilities
})
```

The same shape applies to `registerStuntHandler` and
`registerPersistentEffectHandler`.

## Field Definitions

### `handlerId`

Stable handler id used by content entries.

Examples:

- `disarm`
- `binding`
- `overwatch`

### `moduleId`

The module that registered the handler.

Used for traceability and debugging.

### `version`

Optional registration version string.

Useful for diagnostics and compatibility checks.

## Duplicate Registration Policy

Recommended default policy:

- duplicate `handlerId` registration is rejected

Reason:

- content behavior should remain deterministic
- handler registration remains sequential and single-owner by id
- silent overrides are dangerous

In V1, the safer rule is:

- no implicit override
- no explicit override path

## Handler Signature

Recommended maneuver handler signature:

```js
async function handler(context) {
  return {
    applied: true,
    mutations: [],
    effects: [],
    notes: []
  };
}
```

Recommended stunt handler signature:

```js
async function handler(context) {
  return {
    applied: true,
    outcome: null,
    notes: []
  };
}
```

## Maneuver Handler Context

Recommended context shape:

```js
{
  maneuver,
  actionContext,
  actor,
  target,
  combatState,
  rollContext,
  services,
  metadata
}
```

### Context Fields

- `maneuver`: the content definition being resolved
- `actionContext`: current action state
- `actor`: source actor
- `target`: current target if relevant
- `combatState`: combat/side/action state snapshot
- `rollContext`: attack/defense roll context if available
- `services`: safe access to core services
- `metadata`: caller-provided extras

## Stunt Handler Context

Recommended context shape:

```js
{
  stuntType,
  actionContext,
  actor,
  target,
  combatState,
  rollContext,
  services,
  metadata
}
```

## Services Access Rule

Handlers should not reach arbitrarily into globals when a core service can be passed
through context.

Recommended services object:

```js
{
  resources,
  combatBus,
  diceAdapter,
  reactions,
  logger
}
```

This keeps handlers testable and reduces hidden coupling.

## Handler Return Model

Handlers should return structured outcomes instead of mutating everything directly.

Recommended maneuver return shape:

```js
{
  applied: true | false,
  mutations: [],
  resourceAdjustments: [],
  persistentEffects: [],
  notes: [],
  errors: []
}
```

Recommended stunt return shape:

```js
{
  applied: true | false,
  outcome: null | {},
  notes: [],
  errors: []
}
```

This fits the earlier rule that action mutation should remain separate from action
resolution whenever possible.

## Mutation Model

Handlers should preferably return mutations such as:

```js
{
  kind: "set-attack-mode",
  value: "safe"
}
```

```js
{
  kind: "add-ignore-rule",
  value: { type: "ignore-die-type", dieType: "multiplier" }
}
```

```js
{
  kind: "add-defense-modifier",
  value: { type: "protection", value: 2 }
}
```

Core should merge and apply these mutations in a controlled phase.

## Invocation Order

Recommended resolution order for content-driven automation:

1. Validate content schema
2. Apply generic `effectData`
3. If `handlerId` exists and handler is registered, invoke handler
4. Merge returned mutations/effects
5. Continue normal action or reaction resolution

This keeps generic automation primary and custom handlers additive.

## Non-Automated Content

If `automated = false`:

- do not invoke handler automatically unless explicitly allowed by future rules
- maneuver remains valid content
- UI may still display the maneuver and cost

If `automated = true` but handler is missing:

- apply generic `effectData` if possible
- skip unsupported custom behavior
- log that no handler was found

This should not crash combat flow.

## Registration Timing

Recommended timing:

- content modules register handlers during Foundry `init`
- `1547Core` services are available before gameplay starts

This ensures handler registries are ready before action resolution begins.

## Discovery and Logging

Core should be able to report:

- registered handler ids
- owning module for each handler
- missing handlers referenced by content

Recommended diagnostics:

- log duplicate registration attempts
- log missing handler ids when automated content requests them
- support debug listing of all registered handlers

## Error Handling

If a handler throws:

- catch the error at the core invocation boundary
- mark handler invocation as failed
- do not crash the full combat engine
- log the module id, handler id, and maneuver id

Recommended failure result:

```js
{
  applied: false,
  errors: ["handler threw during execution"]
}
```

## Security / Trust Model

Because handlers are code from other local modules:

- treat them as trusted local extension points
- do not assume they are pure
- protect core with invocation boundaries and structured error handling

## Example Registration

Conceptual content module startup:

```js
registerManeuverHandler("disarm", async (context) => {
  return {
    applied: true,
    mutations: [
      {
        kind: "add-stunt-effect",
        value: { type: "disarm" }
      }
    ],
    notes: ["Disarm handler applied."]
  };
}, {
  moduleId: "1547-maneuvers",
  version: "1.0.0",
  capabilities: ["stunt"]
});
```

## Example Content Entry

```js
{
  id: "maneuver-disarm",
  name: "Disarm",
  type: "reaction",
  triggerType: "attack-declared",
  CostType: "StaminaPoints",
  CostAmount: 1,
  automated: true,
  handlerId: "disarm",
  effectData: {},
  usageLimit: { scope: "turn", maxUses: 1 },
  tags: ["reaction", "stunt"],
  enabled: false
}
```

## Recommended Policy Summary

1. Keep registries in memory.
2. Reject duplicate handler ids by default.
3. Prefer structured return values over direct uncontrolled mutation.
4. Allow content without handlers to remain valid.
5. Keep generic `effectData` support primary.
6. Catch and isolate handler failures.

## Next Useful Spec

The next useful companion document would be:

- `Core Service Contract Spec V1`

or

- `Persistent Effect Schema Spec V1`

depending on whether you want to formalize runtime services or Overwatch-like
effects next.
