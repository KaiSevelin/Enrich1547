# ADR-0003: Phased functions for cancellable-event flows

**Status**: accepted
**Date**: 2026-05-25
**Replaces / extends**: ADR-0002 (extends the patch/event vocabulary
with a third module shape)
**Context for**: anything in `combat/lifecycle-flow.mjs`, anything that
exports an `async function …(opts, run)` signature, or anything
considering a similar pattern in a non-combat subsystem.

## Background

ADR-0002 documented two module shapes — **pure modules** and
**patch-returner modules** — that together carved 49% off the
`combat-resolver-service.js` orchestrator. The remaining ~900 lines
contains five imperative lifecycle functions that resisted the
patch-returner pattern: `declareAttack`, `declareMovement`,
`resolveAttackOutcome`, `executeResolvedReaction`,
`executeSafeCounterattack`.

Why they resist: their bodies interleave `emit event → inspect
response → branch → patch → emit again`, where each emit is
synchronous in the JS run but the function's later logic depends on
what the emit returned (`event.cancelled`, `event.reason`,
`findReactionResolution(event)`). The "return ready-to-emit events"
contract from ADR-0002 can't express this — the function would have
to know all responses before yielding any events, which is
contradictory.

## Decision

Introduce a third module shape: **phased function**. Signature:

```js
// combat/lifecycle-flow.mjs
export async function declareAttackPhased(opts, run) { ... }
```

The function looks imperative — `await`s, branches, throws — but it
never touches Foundry. At every cancellable-event boundary it
delegates to the injected `run` callback:

```js
const { response } = await run({
    phase: "declare",                                       // debug-only label
    patches: [{ kind: "actor.update", actorId, data }],     // applied first
    event: { type: COMBAT_EVENTS.ATTACK_DECLARED, payload }, // emitted second
});
// `response` is whatever emitCombatEvent returned
```

The orchestrator binds a real `run` implementation:

```js
// services/combat-resolver-service.js
async function runPhases({ phase, patches = [], event = null }) {
    for (const p of patches) await applyPatch(p);
    if (!event) return {};
    const response = await emitCombatEvent(event.type, event.payload);
    return { response };
}

export async function declareAttack(opts) {
    return declareAttackPhased(opts, runPhases);
}
```

Tests bind a fake `run` that returns canned responses and records
phases:

```js
const phases = [];
const fakeRun = async (p) => {
    phases.push(p);
    return { response: cannedResponseFor(p.phase) };
};
const result = await declareAttackPhased(opts, fakeRun);
assert(phases[0].event.type === COMBAT_EVENTS.ATTACK_DECLARED);
```

## Forks decided during the grilling round (2026-05-25)

| # | Fork | Decision |
|---|---|---|
| 1 | Abstraction shape | **(D) Injected-effects callback.** Rejected: generator-style (unusual pattern), step-function reducer (ceremony-heavy, serialization assumption we don't need), named-phase objects (most API surface). |
| 2 | Phase granularity | **(A) One event per phase.** Rejected: many-events-per-phase (loses atomicity of "patches before event"; forces callers to track response/event order at call sites). |
| 3 | Composition | **(A) Wrappers are also phased.** `executeResolvedReactionPhased(resolution, run)` shares the runner with `declareAttackPhased`. Rejected: non-phased wrappers — would make them untestable + force the `REACTION_RESOLVED` listener to know which functions are phased. |
| 4 | File layout | **(A) New `combat/lifecycle-flow.mjs`.** Pure planners (compute patches+events for one moment) stay in `attack-lifecycle.mjs`; phased flows (drive a sequence of moments) live in the new file. `declareMovement` fits there too since it's a flow, not attack-specific. |
| 5a | Error propagation | **Throws propagate normally.** No transactional rollback. Matches today's semantics. |
| 5b | `phase` name purpose | **Debug/test inspection only.** Runner doesn't dispatch on it. |
| 5c | Return shape | **Same as today's async function.** Orchestrator wrapper is literally `return await declareAttackPhased(opts, runPhases)`. |

## Alternatives that were considered and rejected

### Generator-style (option A)

`async function*` that `yield`s `{events, patches}` and receives
responses back via `.next(responses)`. JavaScript-native and
composable, but generator-with-returned-values is an unfamiliar
pattern in this codebase; async generators have specific quirks (no
return value, awkward iteration semantics) that would add cognitive
load for marginal benefit over the callback shape.

### Step-function reducer (option B)

Redux-style: `step(state, responses) → {state, events, patches, done}`.
Most explicit, makes every transition a named function. Requires the
state to be serializable — we don't need that property (Foundry's
emit is synchronous within the JS run, so the phased function lives
entirely in one tick). The ceremony cost was high relative to the
non-existent benefit.

### Named phases as object (option C)

`phases.declared(...) → {effects, next: "pendingReaction"}` etc.
Most discoverable, biggest API surface. Suitable for a state machine
that's mostly *about* its named states. Our flows don't have that
property — they're linear sequences with a handful of branches, not
networks of named states. The naming-by-strings introduces a class of
bug (typo'd phase names returning the wrong handler) for no leverage.

## Consequences

### Module shapes — final taxonomy

After this ADR there are three established shapes for module-side combat code:

| Shape | Exports look like | Used by | Imports allowed |
|---|---|---|---|
| **Pure module** | `function foo(args) → result` | normalisation, maneuver-legality, resolver, pool-builder, reaction-candidates, attack-lifecycle's helpers | Other pure modules |
| **Patch-returner** | `function planFoo(args) → {patches, result}` or `{patches, events, result}` | ammo-state, persistent-effects, hp-state, maneuver-state, attack-lifecycle's `plan*` exports | Other pure modules + patch-returner modules |
| **Phased function** | `async function fooPhased(opts, run) → result` | lifecycle-flow | Other pure modules + patch-returner modules + other phased functions (for composition) |

The orchestrator (`services/combat-resolver-service.js`) is the only
place that depends on Foundry singletons (`game`, `Hooks`, `CONFIG`,
`fromUuid`). Everything under `combat/` is testable without a Foundry
instance.

### `run` contract — closed

The phased function's contract with its runner is:

```ts
type Phase = { phase: string; patches?: Patch[]; event?: { type: string; payload: any } };
type Run = (phase: Phase) => Promise<{ response?: any }>;
```

- `patches` are applied in order before the event is emitted.
- If `event` is omitted, the runner does the patches only and returns `{}`.
- Throws from `applyPatch` or `emitCombatEvent` propagate to the
  phased function, then to its caller (the orchestrator wrapper),
  then to the API consumer. No partial-state rollback.
- `phase` is a debug label only. The runner may log it; it MUST NOT
  branch on it.

Changes to this contract require an update to this ADR.

### What does NOT change

- The public combat API (`game.modules.get("1547core").api.combat.*`)
  is preserved exactly. Orchestrator wrappers around the phased
  functions return the same shape they always did.
- The patch dispatcher (`applyPatch`, `applyPatches`) is unchanged.
- Existing pure / patch-returner modules under `combat/` are unchanged.
- `combat-events.js` and `event-bus.js` are unchanged.

### Estimated final orchestrator size

Going from ~900 to ~600 lines. Not a huge cut — most of what's left
is Foundry-glue that genuinely belongs in a service (the patch
dispatcher, `setActorStatusEffect`, `normalizeWeapon` unarmed-default
wrapper, default-asset builders, hook registration). The architectural
win is testability of the imperative lifecycle, not orchestrator-line-count.

## Cross-references

- ADR-0002 — the carve-up that established pure modules + patch-returners.
- `CONTEXT.md` — entries: "Phased function", "Phase", "Effect runner".
- The architecture review HTML report (2026-05-25) — original
  ranking that put this candidate as "deserves its own grilling round
  + ADR" rather than a normal pass-B continuation.
