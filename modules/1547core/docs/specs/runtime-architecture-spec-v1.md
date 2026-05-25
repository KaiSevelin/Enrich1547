# 1547 Core Runtime Architecture Spec v1

## Purpose

This document describes the current runtime architecture of `1547core` and the
responsibility boundaries between its main parts.

The main goal is to keep the system easier to extend, review, and refactor
without reintroducing the earlier "everything lives in one HUD file" problem.

This spec is descriptive first:

- it records the current intended boundaries
- it explains which part should own which kind of logic
- it helps future refactors preserve those boundaries

## Architecture Overview

The module is currently organized around these runtime areas:

- HUD orchestration and presentation
- combat orchestration and state transitions
- maneuver legality and filtering
- reaction timing and prompt flow
- module setup/import and content projection
- validation and deployment support

High-level responsibility split:

- HUD modules build local player-facing state and UI
- service modules own shared combat logic and authoritative outcomes
- Foundry documents and flags hold committed game state
- local HUD state holds only transient client-side interaction state

## Responsibility Rules

### Local HUD State

Local HUD state may track:

- active tab/category
- selected maneuver buttons before commit
- local reaction or post selection before commit
- inventory filter choice
- selected ammo chip before reload
- collapsed or expanded HUD state

Local HUD state must not be treated as authoritative combat truth.

### Shared Combat State

Shared combat state should live in:

- actor updates
- item updates
- actor flags
- combat events
- chat messages when appropriate

Committed game outcomes must not rely only on local HUD memory.

## HUD Module Responsibilities

### [actor-hud.js](/c:/temp/Enrich%201547/modules/1547core/scripts/hud/actor-hud.js)

This is the HUD coordinator.

It should own:

- module-level HUD constants
- top-level registration via `register1547ActorHud()`
- Foundry hook registration
- combat-event subscriptions relevant to the HUD
- HUD root lifecycle
- HUD placement and viewport logic
- top-level rerender scheduling
- small coordinator wrappers that connect submodules together

It should not become the main home for:

- large state helpers
- large data projection functions
- large rendering trees
- large action execution blocks
- large DOM binding blocks

### [hud-state.js](/c:/temp/Enrich%201547/modules/1547core/scripts/hud/hud-state.js)

This module owns transient HUD state.

It should own:

- the `HUD_STATE` object
- selection helpers for pre/full-turn/post/reaction choices
- queued post-window helpers
- damage-taken window helpers
- small state normalization helpers tied to HUD interaction only

It should not own:

- Foundry document updates
- combat resolution
- legality evaluation
- rendering logic

### [hud-summary.js](/c:/temp/Enrich%201547/modules/1547core/scripts/hud/hud-summary.js)

This module owns actor-to-HUD projection.

It should own:

- `summarizeActor(...)`
- transforming actor, item, and token data into a HUD summary model
- combining resource, weapon, maneuver, ammo, and effect data into a read model
- deriving display-friendly summary fields from raw data

It should stay read-oriented.

It should avoid:

- direct DOM work
- direct chat creation
- direct combat commits
- hidden mutation outside narrowly necessary HUD normalization

## HUD Interaction Modules

### [hud-evaluation.js](/c:/temp/Enrich%201547/modules/1547core/scripts/hud/hud-evaluation.js)

This module owns HUD action context and pre-execution evaluation.

It should own:

- building the HUD action context for a selected actor/token
- building action descriptors for stat, skill, and weapon actions
- evaluating whether a HUD action is currently valid
- building roll-preview payloads for valid HUD actions

It should not own:

- execution side effects
- Foundry document updates
- chat output
- direct combat declaration

### [hud-actions.js](/c:/temp/Enrich%201547/modules/1547core/scripts/hud/hud-actions.js)

This module owns HUD-triggered execution.

It should own:

- stat roll execution
- skill roll execution
- weapon attack execution from the HUD
- full-turn maneuver commit from the HUD
- reload / ready / unequip button execution
- the HUD action handler map
- `runHudAction(...)`

It should be the place where evaluated intent becomes action.

It should not own:

- DOM event binding
- large render trees
- actor summary building

### [hud-prompts.js](/c:/temp/Enrich%201547/modules/1547core/scripts/hud/hud-prompts.js)

This module owns prompt/banner markup fragments.

It should own:

- reaction prompt markup
- damage-taken summary prompt markup
- post-maneuver prompt markup

It should stay presentation-focused and avoid direct behavior.

### [hud-render.js](/c:/temp/Enrich%201547/modules/1547core/scripts/hud/hud-render.js)

This module owns the main HUD markup generation.

It should own:

- tree/list render helpers
- category content builders
- equipped/inventory/overview/stat/maneuver rendering
- top-level `buildHudHtml(...)`
- `buildEmptyHtml(...)`

It should produce HTML only.

It should not own:

- event listeners
- document updates
- combat commits

### [hud-bindings.js](/c:/temp/Enrich%201547/modules/1547core/scripts/hud/hud-bindings.js)

This module owns DOM event binding for the HUD.

It should own:

- attaching click/change handlers after a render
- wiring UI events to HUD actions and state transitions
- prompt commit/pass handlers
- maneuver selection handlers
- profile/ammo chip handlers
- counter-roll control handlers

It should not own:

- HTML generation
- actor summary construction
- combat-service internals

## Combat and Rules Service Responsibilities

### [combat-resolver-service.js](/c:/temp/Enrich%201547/modules/1547core/scripts/services/combat-resolver-service.js)

This is the main combat orchestration service.

It should own:

- declaring attacks and moves
- ammo loading and ammo spending behavior
- attack outcome normalization
- committed full-turn and post-maneuver processing
- persistent-effect application and expiry helpers
- generated attack/counterattack execution paths
- shared combat payloads emitted to the event system

It should be treated as authoritative for committed combat transitions.

It should avoid taking on HUD-specific concerns.

### [combat/maneuver-legality.mjs](/c:/temp/Enrich%201547/modules/1547core/scripts/combat/maneuver-legality.mjs)

This service owns maneuver legality evaluation.

It should own:

- legality checks by timing, trigger, actor state, target state, weapon, and range
- cost legality checks
- reserved-resource-aware legality checks
- readable blocking reasons

It should not own:

- prompt rendering
- action execution
- stateful HUD selection logic

### [reaction-service.js](/c:/temp/Enrich%201547/modules/1547core/scripts/services/reaction-service.js)

This service owns reaction-window flow.

It should own:

- opening reaction opportunities
- selecting the reacting actor/user-facing reactor context
- reaction resolution and pass behavior
- integration with generated reactions such as overwatch or safe counterattack entry points

It should not own:

- HUD rendering details
- generic attack preview rendering

### [combat-events.js](/c:/temp/Enrich%201547/modules/1547core/scripts/services/combat-events.js)

This module defines shared combat event vocabulary.

It should own:

- event names
- event subscription helpers
- shared event contract surface used by HUD and services

Its role is to keep combat flow decoupled by explicit events rather than hidden direct calls.

## Setup and Content Responsibilities

### [module-settings.js](/c:/temp/Enrich%201547/modules/1547core/scripts/settings/module-settings.js)

This module owns module setup and content import wiring.

It should own:

- settings registration
- module setup UI hooks
- import/setup flows for Foundry content
- source-data to Foundry-item projection
- managed-folder pruning during setup/import

It should not own:

- combat resolution
- HUD rendering

## Validation Responsibilities

### [validate-module.mjs](/c:/temp/Enrich%201547/modules/1547core/scripts/validation/validate-module.mjs)

This validator is a structural safety net.

It should own:

- manifest BOM/id/version checks
- HUD structural marker checks
- duplicate-function checks
- trait-formula regression checks
- lightweight JS syntax validation where allowed

When architecture changes move responsibilities between files, this validator
should be updated to match the new intended structure rather than forcing the
old one.

## Dependency Direction

Preferred dependency direction:

- `actor-hud.js` depends on HUD submodules
- HUD submodules may depend on injected helpers from `actor-hud.js`
- HUD modules may call service APIs through injected dependencies or module API access
- service modules must not depend on HUD modules

In other words:

- services should be usable without the HUD
- the HUD may depend on services, but not the reverse

## Current Practical Boundaries

### Good boundary examples

- legality reason comes from the legality service, then the HUD displays it
- a full-turn commit is triggered from the HUD, but resolved by the combat service
- actor summary data is built in `hud-summary.js`, then rendered in `hud-render.js`
- DOM events are attached in `hud-bindings.js`, not in render helpers

### Boundary violations to avoid

- adding large render trees back into `actor-hud.js`
- putting combat document updates into `hud-render.js`
- putting legality logic into `hud-bindings.js`
- making `combat-resolver-service.js` call HUD render functions

## Multiplayer Readiness Rule

For future multiplayer and socket work:

- HUD modules may own local prompt and selection state
- committed combat state must move through shared Foundry updates/events
- prompt routing across clients should use coordination mechanisms such as sockets
- sockets should coordinate who sees a prompt, not replace authoritative state storage

## Next Recommended Refactor Area

The HUD split is now in a good place.

The next recommended architecture cleanup is shared combat normalization.

A likely next module would be something like:

- `combat-normalizers.js`

It should centralize repeated logic for:

- weapon normalization
- ammo normalization
- profile resolution
- range-band application
- persistent-effect normalization
- defense-state normalization

That would reduce drift between:

- HUD summary code
- legality code
- combat resolution code

## Maintenance Rule

When adding a new feature, put it in the narrowest responsible module first.

Default guidance:

- if it is temporary local HUD choice state: `hud-state.js`
- if it is actor-to-HUD data shaping: `hud-summary.js`
- if it is action evaluation or preview: `hud-evaluation.js`
- if it is action execution: `hud-actions.js`
- if it is HTML generation: `hud-render.js`
- if it is DOM wiring: `hud-bindings.js`
- if it is committed combat logic: combat service modules
- if it is setup/import logic: settings module

If a feature naturally spans several layers, keep each layer focused instead of
placing the whole implementation in one file.
