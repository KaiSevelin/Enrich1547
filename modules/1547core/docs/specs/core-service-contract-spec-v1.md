# Core Service Contract Spec V1

## Purpose

This document defines the runtime service contract exposed by `1547Core`.

The goals are:

- give `1547Core` a stable internal architecture
- provide controlled extension points for content modules
- reduce hidden coupling between runtime subsystems
- avoid direct ad hoc imports between unrelated feature modules

## Core Principle

`1547Core` should expose a small, explicit service layer rather than letting
content modules or internal features reach into arbitrary files or globals.

That means:

- services are the public runtime surface of `1547Core`
- content modules consume services, not internal file structure
- services coordinate combat, resources, dice, reactions, and handler lookup

## Service Categories

Recommended top-level service groups:

- `combat`
- `resources`
- `dice`
- `reactions`
- `handlers`
- `content`
- `logger`

Optional future groups:

- `effects`
- `ui`
- `validation`

## Service Container

`1547Core` should conceptually expose a single service container.

Recommended shape:

```js
{
  combat,
  resources,
  dice,
  reactions,
  handlers,
  content,
  logger
}
```

This may be exposed through:

- module API
- injected handler context
- internal runtime bootstrap

## Availability Rule

Service availability should follow this rule:

- service definitions available during `init`
- services ready for gameplay before `ready` completes

This allows content modules to register handlers during startup.

## Combat Service

The combat service owns:

- combat state
- side activation state
- action context lifecycle
- post-maneuver timing
- combat event emission

Recommended combat service interface:

```js
{
  startCombat(combatContext),
  endCombat(combatId),
  getCombatState(combatId),
  getActiveSide(combatId),
  markActorDone(combatId, actorId, done),
  createActionContext(input),
  getActionContext(actionId),
  commitAction(actionId),
  cancelAction(actionId, reason),
  emitCombatEvent(type, payload),
  onCombatEvent(type, handler, options)
}
```

## Resource Service

The resource service owns:

- resource normalization
- affordability checks
- reservations
- spending/releasing/recovering
- maneuver cost helpers

Recommended resource service interface:

```js
{
  adjustResource(input),
  getResourceBudget(actor, resource, options),
  canAdjustResource(input),
  reserveManeuverCost(input),
  releaseManeuverCost(input),
  setManeuverInUse(input),
  getItemResourceCost(item)
}
```

This service should encapsulate the current logic in
`scripts/utils/resource.js`.

## Dice Service

The dice service owns:

- roll request creation
- in-memory pending request registry
- dice adapter integration
- result normalization
- dice lifecycle bus events

Recommended dice service interface:

```js
{
  createRollRequest(input),
  executeRoll(request),
  getPendingRoll(requestId),
  getResolvedRoll(requestId),
  waitForRoll(requestId, options),
  buildAttackBundle(actionId),
  onDiceEvent(type, handler, options)
}
```

Key decisions already established:

- pending registry is memory-only
- default timeout is 5000 ms
- timeout is configurable
- ignore reasons are all collected

## Reaction Service

The reaction service owns:

- reaction trigger evaluation
- candidate collection
- reaction window opening
- reaction selection/resolution flow
- mutation of source action when reactions apply

Recommended interface:

```js
{
  registerReactionService(options),
  unregisterReactionService(),
  openReactionWindow(input),
  getReactionCandidates(input),
  resolveReactionSelection(input)
}
```

Reaction service should use the combat event bus rather than bypassing it.

## Handler Service

The handler service owns:

- maneuver handler registry
- stunt handler registry
- persistent-effect handler registry
- registration validation
- safe invocation wrappers

Recommended interface:

```js
{
  registerManeuverHandler(id, handler, options),
  unregisterManeuverHandler(id),
  getManeuverHandler(id),
  hasManeuverHandler(id),
  registerStuntHandler(id, handler, options),
  unregisterStuntHandler(id),
  getStuntHandler(id),
  hasStuntHandler(id),
  registerPersistentEffectHandler(id, handler, options),
  unregisterPersistentEffectHandler(id),
  getPersistentEffectHandler(id),
  hasPersistentEffectHandler(id),
  invokeManeuverHandler(input),
  invokeStuntHandler(input),
  invokePersistentEffectHandler(input)
}
```

`options` should be limited to:

```js
{
  moduleId,
  version,
  capabilities
}
```

Duplicate handler ids are rejected in V1.

## Content Service

The content service owns:

- content validation helpers
- schema-aware lookup
- maneuver and item inspection helpers
- optional pack discovery helpers

Recommended interface:

```js
{
  validateManeuver(item),
  validateItem(item),
  getManeuverType(item),
  getManeuverTrigger(item),
  getManeuverHandlerId(item),
  getAttackDice(item),
  getDefenseDice(item),
  isAutomatedManeuver(item)
}
```

This keeps content modules data-driven and keeps validation logic centralized.

## Logger Service

The logger service owns:

- debug logging
- warning logging
- error reporting with service/module context

Recommended interface:

```js
{
  debug(scope, message, data),
  info(scope, message, data),
  warn(scope, message, data),
  error(scope, message, data)
}
```

Scopes should be stable strings such as:

- `combat`
- `dice`
- `resources`
- `handlers`
- `content`

## Service Access Rule

Internal features and content handlers should consume services through:

- injected service container
- handler context `services`
- official module API

They should not rely on:

- random relative imports across subsystems
- reaching deep into unrelated module internals
- uncontrolled global state where service access exists

## Handler Context Services

When invoking a custom handler, the `services` field should provide:

```js
{
  combat,
  resources,
  dice,
  reactions,
  handlers,
  content,
  logger
}
```

This is the canonical runtime context for content-driven automation.

## Stability Policy

The service contract should be treated as more stable than the internal folder
layout.

Meaning:

- refactors inside `scripts/services` should not break content modules if the
  service contract remains the same
- content modules should depend on service APIs, not implementation files

## Error Boundary Rule

Each service should be responsible for isolating errors at its own boundary.

Examples:

- dice service catches hook/lookup failures
- handler service catches handler exceptions
- resource service throws clear affordability/validation errors
- combat service prevents invalid state transitions

This avoids one failure taking down the whole runtime.

## Service Interaction Rules

Recommended interaction boundaries:

- combat service may call resources, dice, reactions, handlers
- reaction service may call combat, handlers, resources
- handler service may call logger and invoke through context services
- content service should not directly mutate combat state
- logger should be dependency-light and callable by all

This avoids cyclic architectural drift.

## Suggested Bootstrap Order

Recommended runtime bootstrap:

1. create logger service
2. create handler registries
3. create content helpers
4. create resource service
5. create dice service
6. create combat event bus
7. create combat service
8. create reaction service
9. expose service container
10. allow content modules to register handlers

## Diagnostics and Introspection

Recommended debug helpers:

```js
{
  listServices(),
  listRegisteredHandlers(),
  listPendingRolls(),
  getCombatDiagnostics(combatId)
}
```

These are useful during development and testing.

## Minimal Public API Recommendation

If `1547Core` exposes a module API, it should expose only the service container or
a stable subset of it.

Recommended conceptual API:

```js
game.modules.get("1547Core")?.api = {
  services
};
```

This keeps the external contract simple.

## Recommendations

1. Keep service contracts explicit and small.
2. Keep registries in memory unless persistence is explicitly needed.
3. Inject services into handlers instead of encouraging direct imports.
4. Treat the service contract as the stable extension boundary.
5. Use the content service to keep schema logic centralized.
6. Avoid letting content modules import deep internal files directly.

## Next Useful Spec

The next useful companion document would be:

- `Persistent Effect Schema Spec V1`

or

- `Combat Controller Spec V1`

depending on whether you want to formalize ongoing effects or the concrete combat
runtime implementation next.
