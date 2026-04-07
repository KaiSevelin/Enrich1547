# Content Module Architecture Spec V1

## Purpose

This document defines how `1547Core` should remain a rules/runtime module while
actual content such as maneuvers and items lives in separate Foundry modules.

The goal is to keep:

- `1547Core` focused on rules, automation, and integration contracts
- content modules focused on compendia, data definitions, and optional handlers

## Core Principle

`1547Core` should define how content behaves, not ship all content itself.

That means:

- `1547Core` defines data contracts and runtime services
- content modules define concrete maneuvers, items, and packs
- orchestration modules decide which content stack is required for a game setup

## Package Roles

### `1547Core`

Responsibilities:

- combat engine
- action and reaction system
- resource economy
- dice adapter integration
- maneuver timing and legality rules
- item and maneuver schema expectations
- handler registration APIs
- validation and runtime lookup helpers

`1547Core` should not be the long-term home for all concrete item and maneuver data.

### Content Modules

Examples:

- `1547-items`
- `1547-maneuvers`
- `1547-bestiary`
- `1547-careers`

Responsibilities:

- compendium packs
- concrete item definitions
- concrete maneuver definitions
- optional custom handlers for special behavior
- optional templates or module-specific UI

### Orchestration Module

Examples:

- `1547Game`
- `1547Campaign`

Responsibilities:

- depends on `1547Core`
- depends on chosen content modules
- wires the full game stack together

## Content Separation Model

### Core Owns Contracts

Core should define:

- what fields a maneuver must have
- what fields an item must have
- how timing types are interpreted
- how costs are resolved
- how handlers are discovered and invoked

### Content Modules Own Data

Content modules should provide:

- actual maneuver entries
- actual weapons and armor entries
- actual compendium packs
- flavor text and setting-specific content

## Maneuver Model

Maneuvers should remain ordinary content definitions wherever possible.

Recommended minimum maneuver fields:

```js
{
  name,
  type, // "pre" | "post" | "reaction" | "full-turn"
  triggerType: null | string,
  CostType: null | string,
  CostAmount: number,
  automated: true | false,
  handlerId: null | string,
  effectData: {}
}
```

Meaning:

- `type` defines timing category
- `triggerType` defines when a reaction/full-turn effect can fire
- `automated` tells core whether automation should attempt handling
- `handlerId` links to a registered runtime handler if one exists

## Item Model

Items such as weapons and armor should also live in content modules.

Recommended minimum item fields:

```js
{
  name,
  itemType, // "weapon" | "armor" | "maneuver" | ...
  attackType: null | string,
  attackDice: [],
  defenseDice: [],
  props: {}
}
```

Examples:

- weapons define attack dice and attack type
- armor defines defense dice
- maneuvers define timing and cost metadata

## Compendium Strategy

Content modules should primarily ship concrete data through compendium packs.

Recommended pattern:

- `1547-maneuvers` ships maneuver packs
- `1547-items` ships weapon and armor packs
- `1547Core` reads item/maneuver data after import or runtime use

Benefits:

- smaller core repo
- reusable content modules
- easier versioning of content separately from engine changes

## Handler Registration Model

Some maneuvers or stunts need custom runtime handling.

Core should support handler registration by id.

Conceptual model:

```js
registerManeuverHandler("disarm", handlerFn);
registerStuntHandler("trip", handlerFn);
```

Then a maneuver entry may say:

```js
{
  handlerId: "disarm"
}
```

Rules:

- if a handler exists, core may automate the maneuver
- if no handler exists, the maneuver remains content-valid but is not auto-resolved

This matches the rule that stunts should only be automated if a handler exists.

## Discovery Strategy

Core should not hardcode content module names where possible.

Preferred discovery options:

1. Explicit registration at startup
2. Content lookup by item schema/type
3. Optional module capability registration

Conceptual startup pattern:

- content module loads
- content module registers any handlers with `1547Core`
- compendia remain normal Foundry content

This keeps runtime behavior explicit.

## Runtime Validation

`1547Core` should validate content before using it.

Examples:

- maneuver `type` must be valid
- reaction maneuver must have valid trigger type
- costs must have valid `CostType` and `CostAmount`
- attack items must provide attack dice if they are attack-capable

If validation fails:

- content should not crash core
- item or maneuver should be treated as invalid and surfaced to logs/UI

## Dependency Structure

Recommended dependency direction:

- content modules may depend on `1547Core`
- `1547Core` should not depend on content modules
- orchestration module depends on both

That gives clean layering:

```text
1547Core
  ^
  |
1547-maneuvers   1547-items
  ^                 ^
   \               /
      1547Game
```

## UI and Content

Core may provide generic UI for:

- selecting maneuvers
- validating costs
- resolving reactions

Content modules provide:

- actual entries to populate those UIs
- optional extra presentation data

This keeps UI reusable and content-specific text/data externalized.

## Migration Strategy

If concrete maneuvers or items currently live in core, migrate them by:

1. keeping the schema and services in `1547Core`
2. moving actual entries into dedicated content modules
3. replacing any hardcoded item references in core with schema-driven lookup
4. keeping custom logic only behind handler ids

## Recommendations

1. Keep `1547Core` content-light.
2. Put all concrete maneuvers into a dedicated maneuver module.
3. Put all weapons and armor into a dedicated items module.
4. Use compendia as the primary delivery mechanism for data.
5. Use handler registration only for content that truly needs custom automation.
6. Keep orchestration in a separate top-level module.

## Next Useful Spec

The next useful companion document would be:

- `Maneuver Schema Spec V1`

or

- `Handler Registration Spec V1`

Those would define the exact runtime contract between `1547Core` and content modules.
