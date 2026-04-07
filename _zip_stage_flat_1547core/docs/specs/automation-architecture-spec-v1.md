# Automation Architecture Spec V1

## Purpose

This document defines a simple runtime structure for combat and maneuver
automation in `1547Core`.

The main goal is to keep automation code easy to reason about by:

- centralizing state changes
- keeping external integrations isolated
- keeping content data-driven
- preventing custom handlers from mutating combat state arbitrarily

## Core Principle

Data declares intent. Resolvers apply it.

That means:

- content modules provide item and maneuver data
- handlers may provide custom logic
- handlers return structured outcomes
- core resolvers remain the only layer that commits state changes

## Simplicity Goals

The architecture should optimize for:

- one clear owner for combat state
- one clear owner for dice integration
- one clear owner for resource transitions
- one clear path from declared action to committed action
- minimal hidden coupling between files

## Recommended Runtime Layers

Use 5 main layers:

1. content definitions
2. services
3. resolvers
4. adapters
5. types/schema helpers

## Recommended Folder Shape

```text
modules/1547Core/scripts/
  services/
    combat-service.js
    dice-service.js
    resource-service.js
    reaction-service.js
    handler-service.js
    content-service.js
    logger-service.js
  resolvers/
    action-resolver.js
    attack-resolver.js
    maneuver-resolver.js
    persistent-effect-resolver.js
  adapters/
    dice1547-adapter.js
  content/
    maneuver-schema.js
    item-schema.js
  types/
    combat-types.js
    dice-types.js
```

This is intentionally small. Add folders only when a real second implementation
or second responsibility exists.

## Service Responsibilities

### Combat Service

Owns:

- combat state
- side activation state
- actor done state
- action context creation and commit/cancel
- combat event emission

Combat service should be the authority on state transitions.

### Dice Service

Owns:

- roll request creation
- pending roll registry
- roll timeouts
- normalized roll results
- dice lifecycle bus events

Dice service should not contain combat logic.

### Resource Service

Owns:

- affordability checks
- reservations
- spend/release transitions
- maneuver cost helpers
- `RiskPoints` bookkeeping if tied to combat resource state

### Reaction Service

Owns:

- reaction candidate collection
- reaction window opening
- reaction selection flow
- application of reaction-generated mutations

Reaction service should not directly resolve attack math.

### Handler Service

Owns:

- maneuver handler registry
- stunt handler registry
- persistent-effect handler registry
- safe invocation wrappers

Handler service should not own combat state.

### Content Service

Owns:

- maneuver validation
- item validation
- schema-aware field lookup
- content inspection helpers

Content service should keep the rest of the system from depending on raw item
shapes everywhere.

## Resolver Responsibilities

Resolvers are where rules are actually applied.

### Action Resolver

Entry point for declared actions.

Owns:

- action validation
- deciding which specialized resolver to call
- coordinating reservations, reactions, rolls, and commit

This should be the main orchestration layer for action execution.

### Attack Resolver

Owns:

- attack context assembly
- attack and defense roll coordination
- safe attack handling
- crit/fumble/RiskPoints generation
- damage application
- post-maneuver ordering

Attack resolver should not know external dice API details directly.

### Maneuver Resolver

Owns:

- applying generic `effectData`
- invoking handler-service for custom behavior
- collecting structured mutations
- merging generic and custom effects into one mutation set

This is the main way to keep maneuver automation simple.

### Persistent Effect Resolver

Owns:

- creation of persistent effect state
- expiry checks
- trigger evaluation for active effects like Overwatch

This should be separate so ongoing effects do not bloat action resolution.

## Adapter Responsibilities

### Dice1547 Adapter

The adapter is the only layer that should know the concrete `dice1547` API.

Owns:

- request translation into external roll syntax
- hook/API integration
- face-aware result normalization
- raw result correlation to request ids

Everything else should talk to the dice service, not to `dice1547` directly.

## Mutation-First Rule

Handlers and maneuver logic should return structured mutations rather than directly
editing actor or combat state.

Example:

```js
{
  mutations: [
    { kind: "set-attack-mode", value: "safe" },
    { kind: "add-ignore-rule", value: { type: "ignore-die-type", dieType: "multiplier" } },
    { kind: "add-defense-modifier", value: { type: "protection", value: 2 } }
  ]
}
```

Resolvers then apply those mutations in a controlled phase.

Benefits:

- easier testing
- easier debugging
- less hidden coupling
- easier replay and audit
- avoids “handler did some random state change” problems

## Direct Mutation Rule

Custom handlers should not:

- update actor documents directly
- spend resources directly
- create chat messages directly as part of core combat resolution
- advance combat state directly

Instead they should return structured outcomes and let core services apply them.

## Recommended Action Pipeline

The simplest clean action pipeline is:

1. combat service creates action context
2. action resolver validates action
3. maneuver resolver applies generic maneuver effects
4. handler service invokes optional handler through maneuver resolver
5. reaction service resolves any reaction windows
6. dice service resolves required rolls
7. attack resolver or other specialized resolver computes outcome
8. resource service spends or releases reservations
9. combat service commits final action state

This keeps one clear execution path.

## Bus Usage Rule

Use the service bus for orchestration events, not for owning state.

Good uses:

- lifecycle notifications
- diagnostics
- UI updates
- decoupled listeners

Bad uses:

- primary combat state storage
- primary roll request storage
- source of truth for reservations

The source of truth should stay in services and action/combat state objects.

## Recommended Service Interactions

Allowed:

- combat service -> action resolver
- action resolver -> resource service
- action resolver -> maneuver resolver
- action resolver -> reaction service
- action resolver -> dice service
- attack resolver -> dice service
- maneuver resolver -> handler service
- reaction service -> handler service

Avoid:

- handlers importing combat internals directly
- dice adapter calling combat service directly
- content modules mutating state without service boundaries

## Content Module Rule

Content modules should provide:

- item data
- maneuver data
- optional handlers

They should not own:

- combat state
- roll correlation
- action commit rules
- resource resolution

That keeps `1547Core` as the runtime authority.

## Testing Advantage

This structure supports simple testing:

- service tests for registries and validation
- resolver tests for rules logic
- adapter tests for `dice1547` translation/correlation
- content validation tests for maneuver/item shape

Mutation-based handler results are especially easy to unit test.

## Minimal Implementation Order

To keep implementation manageable, build in this order:

1. handler service
2. content service
3. dice service + adapter
4. action resolver
5. attack resolver
6. combat service integration
7. reaction service integration
8. persistent effect resolver

This gives a usable vertical slice quickly.

## Recommended Constraints

1. Keep registries in memory in V1.
2. Keep handler registration single-owner by `handlerId`.
3. Keep action commit centralized in combat service.
4. Keep dice integration behind the dice service and adapter.
5. Keep maneuver logic mutation-based.
6. Keep content modules data-driven first.

## Anti-Patterns To Avoid

Avoid these patterns:

- one giant combat file that owns everything
- handlers directly editing actors/documents
- dice formulas built all over the codebase
- rules split between UI dialogs and services
- content modules importing deep internal files
- using the event bus as a state store

## Bottom Line

The simplest automation architecture is:

- thin services
- a few focused resolvers
- one adapter per external system
- data-driven content
- mutation-returning handlers
- centralized commit of combat state

That gives you extensibility without letting the codebase dissolve into special
cases.
