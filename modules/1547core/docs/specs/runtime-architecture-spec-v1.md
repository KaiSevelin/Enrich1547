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

*(Refreshed 2026-07-11 to the post-ADR-0004 as-built structure. The module
shapes and their rules live in ADR-0002/0003/0004; the glossary and per-module
tables live in CONTEXT.md. This spec is the navigable overview of who owns
what and who may import whom.)*

The module is organized in layers, lowest first:

- `lib/` — dependency-free utilities (positioning math, constants,
  `roll-chat.mjs` — the ONE roll→chat→totals path).
- `combat/` — pure modules, patch-returners, and phased functions
  (ADR-0002/0003 shapes). No `game.*`/`Hooks` except the documented glue
  files (`.js` suffix: movement-reactions, defense-roll, defense-summary,
  ranged-cover, facing helpers).
- `services/` — Foundry-side orchestrators: apply patches, emit events,
  register hooks, expose the module API. Never import from `hud/`.
- `combat-tracker/` — the side domain: side assignment/labels/state
  (side-tracker) and the Side-Ready turn flow (side-turn-flow).
- `hud/` — presentation + local interaction state. May import combat/,
  services/ APIs, lib/.
- `settings/`, `migrations/`, `validation/` — setup, data, safety nets.

The three module shapes (ADR-0002/0003, summarized):

- **Pure module** — inputs in, outputs out; tested with literal fixtures.
- **Patch-returner** — pure `planX(...) → {patches, result}`; the patches
  are applied by the orchestrator through the patch transport.
- **Phased function** — `async fooPhased(opts, run)`; imperative control
  flow that delegates every Foundry touch to the injected `run`.

High-level responsibility split:

- HUD modules build local player-facing state and UI
- service modules own shared combat logic and authoritative outcomes
- Foundry documents and flags hold committed game state
- local HUD state holds only transient client-side interaction state

### The Exchange pipeline (ADR-0004)

One entry point owns the attack skeleton — declare → reaction → attack roll
→ defense roll → resolve → result card: `resolveExchangePhased` in
`combat/lifecycle-flow.mjs`, exposed as `api.combat.resolveExchange`.
Callers pick a preset (`weapon` / `safe-counter` / `interception` /
`free-shot`) and supply only their decoration (attack formula callback,
card extras). Cover, facing, and rider text run before/after the pipeline
in the caller — never inside it. Choke round attacks stay declare-only.

## Responsibility Rules

### Local HUD State

`HUD_STATE` is split in two tiers (ADR-0004):

- **View state** (`HUD_STATE.view.*`) — harmless UI toggles with no
  invariants: active tab/category, filters, collapse, check-mode, ammo
  chip, range-pill toggles. Written freely by bindings.
- **Window state** (top-level: reactionWindow, damageTakenWindow,
  postManeuverQueue, deferred windows, selections) — invariant-carrying,
  refresh-fragile exchange state. Mutated ONLY through the exported
  setters in `hud-state.js` (one mutation point; transitions are
  unit-tested in `hud-window-state.test.mjs`).

Render never mutates state: contextual defaults (the maneuver-filter
follow) are applied BEFORE render via `syncManeuverFilterContext`.

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

Responsibilities extracted from it in the 2026-07-11 split (ADR-0004) —
do not let them creep back:

- weapon/ammo/attack-profile parsing + `getWeaponAttackState` →
  `combat/weapon-state.mjs`
- Side-Ready / side-advance flow + its socket →
  `combat-tracker/side-turn-flow.js`
- the canvas threat/range overlay (PIXI) → `hud/threat-overlay.js`
  (weapon SELECTION stays here; the overlay receives the selectors
  per call)

### [threat-overlay.js](/c:/temp/Enrich%201547/modules/1547core/scripts/hud/threat-overlay.js)

This module owns the canvas threat/range overlay.

It should own:

- threat cone / range band / rear-vulnerability tile geometry
- the PIXI layer lifecycle (`renderThreatOverlay(token, selectors)` /
  `clearThreatOverlay()`)
- shot-lane and cover-odds badge drawing

It should not own:

- weapon selection (injected: getThreatSource / getRangedSource /
  getPrimaryTargetToken)
- HUD DOM or state

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

This is the combat orchestrator (~800 lines post-ADR-0004).

It should own:

- the public combat API (`api.combat.*`) and hook registration
- thin wrappers binding the phased functions to the live runner
  (`runPhases`) and Foundry-glue deps: declareAttack, declareMovement,
  resolveAttackOutcome, **resolveExchange**, executeSafeCounterattack
- the `normalizeWeapon` unarmed-fallback + default-asset builders
- the status-effect writer, escape commit, choke round attacks
- post-window closure decoration

It should NOT own (extracted, ADR-0004):

- the patch dispatcher / GM routing → `services/patch-transport.js`
- the post-maneuver effect interpreter →
  `combat/post-maneuver-effects.mjs`
- roll+chat helpers → `lib/roll-chat.mjs`, `combat/defense-roll.js`

It should be treated as authoritative for committed combat transitions.

It should avoid taking on HUD-specific concerns.

### [patch-transport.js](/c:/temp/Enrich%201547/modules/1547core/scripts/services/patch-transport.js)

This module owns HOW a Patch becomes a Foundry write, and WHERE it runs.

It should own:

- the closed `applyPatch` switch over patch kinds (new kinds: one line
  here + an update to ADR-0002's union list)
- write authority: `canApplyPatchLocally`, `isDesignatedPatchGM`
  (decision table unit-tested in `patch-authority.test.mjs`)
- the `patch-apply` / `patch-ack` socket protocol and `applyPatches`
  (local-or-routed, `awaitRemote` ack round-trips)

It must stay domain-free: the two domain-flavored kinds
(`actor.applyCondition`, `actor.statusEffect`) are injected by the combat
resolver via `configurePatchTransport` at registration.

### [combat/lifecycle-flow.mjs](/c:/temp/Enrich%201547/modules/1547core/scripts/combat/lifecycle-flow.mjs)

This module owns the phased combat flows (ADR-0003): declareAttackPhased,
declareMovementPhased, resolveAttackOutcomePhased, the safe-counterattack
declaration, and the Exchange pipeline `resolveExchangePhased` +
`buildExchangeResultCard`. It never touches Foundry — every effect goes
through the injected `run` or the injected deps.

### [combat/weapon-state.mjs](/c:/temp/Enrich%201547/modules/1547core/scripts/combat/weapon-state.mjs)

This pure module owns the attack-legality surface the HUD displays:
weapon/ammo/attack-profile parsing, range bands and reach,
`getWeaponAttackState` verdicts, and attack-formula building. Every
exchange enters battle flow through this gate (`weapon-state.test.mjs`).

### [combat/defense-roll.js](/c:/temp/Enrich%201547/modules/1547core/scripts/combat/defense-roll.js)

The ONE defense-side module: equipped-armor extraction, the defense-pool
formula (armor + condition Risk dice + reaction Multiplier dice), and
`rollDefenseForActor`. Injected into the Exchange pipeline.

### [combat/post-maneuver-effects.mjs](/c:/temp/Enrich%201547/modules/1547core/scripts/combat/post-maneuver-effects.mjs)

The phased post-maneuver effect interpreter: condition apply, automated
rotate/push (ruling 2026-07-11), Core Restore, Convert, follow-up safe
attack. Pure math (`planPushPath`, `nextFacingRotation`,
`computeConvertBreakdown`) is exported and unit-tested.

### [combat-tracker/side-turn-flow.js](/c:/temp/Enrich%201547/modules/1547core/scripts/combat-tracker/side-turn-flow.js)

The Side-Ready turn flow: next-side computation, the GM-only combat
advance (players request it over the socket), and the Side Ready
announcement/confirmation. Lives with the side domain (side-tracker,
victory detection), not the HUD — the HUD only hosts the button.

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
- reads of HUD state (removed 2026-07-11: the staged Core count now
  arrives ON the selection — `selectReaction(id, { stagedCore })`; the
  HUD clears its own stack at commit)

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

Layer rules (enforced by convention; the one known violation —
reaction-service importing hud-state — was removed 2026-07-11, the staged
Core count now rides the reaction-selection payload):

- `lib/` imports nothing above it.
- `combat/` pure modules import other combat modules, `lib/`, and the
  `COMBAT_EVENTS` enum only. The documented `.js` glue files in combat/
  may read Foundry globals but must not import from `hud/`.
- `services/` import `combat/`, `lib/`, other services. **Never `hud/`.**
- `combat-tracker/` sits beside services (side domain); combat/ glue may
  import it (side lookups), and it imports combat/ pure helpers — keep new
  cross-links one-way per file.
- `hud/` may import everything below; cross-HUD flow goes through
  `actor-hud.js`'s deps binding or direct same-layer imports.

In other words:

- services should be usable without the HUD
- the HUD may depend on services, but not the reverse
- everything under `combat/` (minus glue) must run headless in node —
  that is what the test suite executes

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

## Refactor History and Current State

- The shared combat normalization this spec once recommended shipped as
  `combat/normalisation.mjs` (ADR-0002 carve-up, 2026-05-25).
- The phased-function shape for cancellable flows shipped as
  `combat/lifecycle-flow.mjs` (ADR-0003).
- The 2026-07-11 round (ADR-0004) shipped the Exchange pipeline, the
  patch transport, the actor-hud three-way split, the HUD_STATE
  view/window split, and the roll-chat sweep.

What intentionally remains outside unit coverage (live two-client test
list): the socket transport actually delivering, Dice So Nice timing,
and canvas geometry in a real scene.

## Maintenance Rule

When adding a new feature, put it in the narrowest responsible module first.

Default guidance:

- if it is temporary local HUD choice state: `hud-state.js` (view vs
  window tier — see Local HUD State)
- if it is actor-to-HUD data shaping: `hud-summary.js`
- if it is weapon/ammo/range/attack-state parsing: `combat/weapon-state.mjs`
- if it is action evaluation or preview: `hud-evaluation.js`
- if it is action execution: `hud-actions.js` (attack execution =
  decoration around `resolveExchange`, never a second skeleton)
- if it is HTML generation: `hud-render.js` (reads state, never writes)
- if it is DOM wiring: `hud-bindings.js`
- if it is canvas overlay drawing: `hud/threat-overlay.js`
- if it rolls dice to chat: `lib/roll-chat.mjs` (never a new
  `new Roll(...).toMessage(...)` copy)
- if it is combat rules math: a pure `combat/` module (+ a test)
- if it mutates Foundry docs from combat logic: a patch-returner +
  the patch transport
- if it is a multi-step flow with events: a phased function in
  `combat/lifecycle-flow.mjs` (or its own combat/ flow module)
- if it is side/turn order logic: `combat-tracker/`
- if it is setup/import logic: settings module

If a feature naturally spans several layers, keep each layer focused instead of
placing the whole implementation in one file.
