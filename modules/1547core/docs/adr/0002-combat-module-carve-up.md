# ADR-0002: Combat module carve-up — patch-returners + lifecycle events

**Status**: accepted (amended by ADR-0004, 2026-07-11: the `applyPatch`
dispatcher moves to `services/patch-transport.js` with injected domain
handlers; `combat/resolver.mjs` is deleted from the pure-module list.
The patch union, closed-shape rule, and `plan*` conventions are unchanged.)
**Date**: 2026-05-25
**Replaces / extends**: nothing
**Context for**: anything touching `services/combat-resolver-service.js`,
the `combat/*.mjs` modules, or future patch-returner / lifecycle-event
work.

## Background

`combat-resolver-service.js` shipped at ~1,776 lines: one file that owned
attack-lifecycle compute, normalisation helpers, ammo state, persistent
effects, HP / status-effect sync, reaction-candidate construction, the
Foundry hook listener, the public combat API, plus duplicated copies of
~6 helpers that also lived in `maneuver-legality-service.js` (~780 lines).
Neither was unit-tested directly; only the two `combat/*.mjs` pure cores
(`resolver.mjs`, `pool-builder.mjs`) had tests. The architecture review
on 2026-05-25 picked the combat split as candidate #3 ("split the
1,776-line combat-resolver-service into deep modules") and the user
grilled the design in eight forks before we started cutting.

The carve-up shipped across versions 0.0.94 → 0.1.1 (~10 releases).

## The pattern we landed on

Two complementary contracts:

### 1. Pure module

No `game.*`, no `Hooks`, no `fromUuid`, no mutation, no `async`.
Imports only other pure modules. Inputs in, outputs out. Tested with
literal fixtures.

Currently: `combat/normalisation.mjs`, `combat/maneuver-legality.mjs`,
`combat/reaction-candidates.mjs`, `combat/resolver.mjs`,
`combat/pool-builder.mjs`, and the side-effect-free helpers in
`combat/attack-lifecycle.mjs` (summarisation, merging, roll-summary,
collectReservedCosts, isPendingAttack, actorHasEquippedArmor,
buildPending{Attack,Move}, …).

### 2. Patch-returner module

Pure module whose output is a list of **patches** the caller (the
orchestrator) applies. Used when a function logically needs to mutate
Foundry state but we want it testable without Foundry.

Currently: `combat/ammo-state.mjs` (`planLoadWeaponAmmo`,
`planConsumeLoadedAmmo`, `planSpendLoadedAmmo`),
`combat/persistent-effects.mjs` (`planConsumePersistentEffect`),
`combat/hp-state.mjs` (`planApplyDamage`),
`combat/maneuver-state.mjs` (`planSpendActorManeuverCost`,
`planAppendCommittedManeuverState`),
and the `plan*` exports in `combat/attack-lifecycle.mjs`
(`planApplyDefenseFollowUpState`, `planCommitPostManeuver`,
`planCommitFullTurnManeuver`).

The patch shape is a **discriminated union**:

```js
{ kind: "actor.update",       actorId, data }
{ kind: "item.update",        actorId, itemId, data }
{ kind: "actor.setFlag",      actorId, scope, key, value }
{ kind: "actor.statusEffect", actorId, keyword, active }
```

The `applyPatch` dispatcher in `services/combat-resolver-service.js`
is the single place that turns a patch into a Foundry mutation. New
patch-returners slot in by emitting one of these kinds; new kinds get
added to the dispatcher's `switch` and to this list.

### 3. Lifecycle events

Some pure planners return `{ events: [...], patches: [...], result }`
where each event is a ready-to-emit `{ type, payload }` object. The
orchestrator iterates events and calls `emitCombatEvent(type, payload)`
on each. The pure module imports `COMBAT_EVENTS` (the enum from
`services/combat-events.js`) but never touches the bus.

Used by: `planCommitPostManeuver`, `planCommitFullTurnManeuver` (each
emits one ACTION_COMMITTED).

## What did NOT get extracted, and why

Three orchestrator-side imperative flows stayed in
`combat-resolver-service.js`:

- **`declareAttack`** and **`declareMovement`** — emit an event, then
  branch on the emit's response (`event.cancelled`, `event.reason`,
  `findReactionResolution(event)`). The "lifecycle returns
  ready-to-emit events" pattern doesn't fit cleanly: the function's
  later logic depends on what came back from earlier emits.
- **`resolveAttackOutcome`** — same pattern, larger scale. Emits
  DAMAGE_APPLIED, then POST_MANEUVER_WINDOW_OPENED per window, then
  ACTION_COMMITTED. The body interleaves emit / inspect / branch /
  patch / emit.
- **`executeResolvedReaction`** / **`executeSafeCounterattack`** —
  short wrappers around `declareAttack`.

Converting these to patch-returners would require a different
abstraction — a phased state-machine that returns
`{ phase, events, patches, next: (responses) => ... }` and lets the
orchestrator drive a multi-step transaction. That's a deserving design
round in its own right; we didn't do it because:

1. The resulting orchestrator code would be **uglier** than the
   current imperative form (you'd loop over events with name hints to
   route responses back to result fields).
2. Without integration tests against a real Foundry instance, the
   risk of a subtle behaviour drift is high.
3. The remaining 906-line orchestrator is mostly Foundry-glue that
   genuinely belongs in a service. The big architectural win — pure
   testable cores — is already done.

A future round can revisit if those three functions grow more complex
or if integration testing arrives.

### Foundry-glue that also stays in the orchestrator

The orchestrator additionally owns:

- The `applyPatch` / `applyPatches` dispatcher (~50 lines).
- `normalizeWeapon` wrapper + `buildDefaultUnarmedWeapon` /
  `buildDefaultUnprotectedArmor` / `getStoredDatasetEntry` — depend on
  `game.settings`.
- `getActorReactionWeapon` + `buildAttackReactionCandidates` /
  `buildThreatReactionCandidates` wrappers — depend on the
  orchestrator's `normalizeWeapon`.
- `setActorStatusEffect` + `getStatusEffectDefinitions` — depend on
  `CONFIG.statusEffects`, `actor.createEmbeddedDocuments`,
  `actor.deleteEmbeddedDocuments`. Called from the `actor.statusEffect`
  patch handler.
- `createPostManeuverWindowPayload` — returns an object with closure
  callbacks (`commitPostManeuver`, `passPostManeuver`) that reference
  the orchestrator's `commitPostManeuver`. The data half could move;
  the closures stay.
- `applyMultiplier`, `findReactionResolution` — local
  orchestrator-specific implementations that differ from earlier-named
  cousins; kept here to avoid silent semantic drift.

## Results

| Metric | Before (0.0.94) | After (0.1.1) | Δ |
|---|---|---|---|
| `combat-resolver-service.js` lines | 1,776 | 906 | -870 (-49%) |
| `maneuver-legality-service.js` lines (later moved to `combat/`) | 780 | 505 | -275 (-35%) |
| Tested combat suites | 2 (pool-building, resolution) | 11 | +9 |
| Pure modules under `combat/` | 2 | 9 | +7 |

The original "thin orchestrator at ~250 lines" estimate was overshot
by ~650 lines — that was wishful. 900 lines is a reasonable floor for
Foundry-glue + cancellable-event imperative flow.

## Conventions established

- **`planX` prefix** for patch-returner exports. The non-`plan` name is
  reserved for the orchestrator wrapper (which preserves the historical
  public API). Example: `loadWeaponAmmo` is the orchestrator-exposed
  async wrapper; `planLoadWeaponAmmo` is the pure planner.
- **Dependency injection for Foundry-glue deps** that pure modules need.
  Example: `buildPendingAttack(opts)` requires `normalizeWeapon` and
  `buildAttackReactionCandidates` as props; the orchestrator wrapper
  injects its own implementations.
- **Patch shape is closed.** New patch kinds require a one-line
  addition to the dispatcher AND an update to this ADR's union list.
- **Pure modules import only other pure modules + `COMBAT_EVENTS` enum.**
  The enum lives in `services/combat-events.js`, which is itself a thin
  pass-through over `event-bus.js` — importing the enum doesn't drag in
  Foundry deps.

## Cross-references

- `CONTEXT.md` — domain glossary, lists every module in the combat
  layout with one-line role descriptions.
- `ADR-0001` — the CSB data-shape decisions referenced by the
  normalisation module.
- The architecture review HTML report
  (`<temp>/architecture-review-20260525-083901.html`) — original
  ranking that put this work as candidate #3 (Strong).
