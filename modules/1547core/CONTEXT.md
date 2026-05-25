# 1547Core — context

Living glossary for the `1547core` Foundry VTT module. Names defined here
should be the names used in code, commits, ADRs, and conversation.
When a term gets sharpened during design, update the entry — don't drift.

## Module shape

`1547core` is a Foundry VTT module that adds a custom RPG ("1547") on
top of the Custom System Builder (CSB) system. It owns:

- the **monster-maker pipeline** — composing actors from `ChangeSet` items
- the **combat pipeline** — attack/defense lifecycle, dice pool resolution
- the **HUD subsystem** — in-game action selection UI
- a **schema-migration** pass for legacy item shapes

Detailed specs live in `docs/specs/`. This file is the index; specs are
the manuals.

## Architectural terms

These describe how the code is shaped, not what it represents.

- **Module** — a file with an interface (its exports + behaviour
  contract) and an implementation. Anything we can import.
- **Pure module** — no `game.*`, no `Hooks`, no `fromUuid`, no mutation.
  Inputs in, outputs out. Unit-testable with literal fixtures.
- **Patch-returner module** — pure module whose output is a list of
  **patches** the caller can apply. Used when an operation needs to
  mutate Foundry state but we want it testable without Foundry.
- **Orchestrator** — thin Foundry-side wrapper that drives pure /
  patch-returner modules, applies their patches, and emits events.
  `services/combat-resolver-service.js` will become this once the combat
  carve-up lands. `services/*.js` files in general aim for this role.
- **Patch** — a discriminated-union descriptor of a single Foundry
  mutation. Shape: `{ kind: "actor.update" | "item.update" |
  "actor.setFlag" | "actor.statusEffect", ...args }`. Produced by
  patch-returner modules; applied by the orchestrator's
  `applyPatch(patch)` dispatcher. First patch-returner shipped:
  `combat/ammo-state.mjs` (see `services/combat-resolver-service.js`
  for the dispatcher).
- **Lifecycle event** — a `COMBAT_EVENTS.*` payload returned by the
  attack lifecycle in `{ events: [{ type, payload }, ...] }`. The
  orchestrator emits them via `emitCombatEvent`. Lifecycle never touches
  the event bus itself.

## Monster-maker domain

Authored against `docs/specs/monster-maker-spec-v1.md` and
`monster-creation-guide.md`.

- **ChangeSet** — a CSB item (`template: b7A1z6cSZO4dYTKT`) that bundles
  Requirements + Changes and applies as one unit. Has a `Group` slot.
- **Change** — atomic modification (one of: `Stat`, `PrimaryStat`,
  `Skill`, `Text`, `Image`, `ItemGrant`, `Tag`, `Trait`). CSB item
  `template: WsrkfjBmudnIhvEK`. Stored as a sibling of its parent
  ChangeSet on the actor — not nested.
- **Requirement** — predicate gating its parent ChangeSet. CSB item
  `template: L4ujYgqhGBGcoo2P`. Sibling of ChangeSet on the actor.
- **Group** — one of seven pipeline slots: `Size`, `Role`, `Domain`,
  `Motivation`, `Loadout`, `Quirk`, `Boost`. Size/Role/Domain are
  singletons.
- **Pipeline** — deterministic walk of attached ChangeSets in Group
  order. Re-derived from scratch every invocation (no incremental
  state). Lives in `services/composition-service.mjs`.
- **Effective state** — actor's stats + items as the pipeline derives
  them. Cached on the actor by `_stats.modifiedTime`.
- **Boost** — Group used for random GM-driven additions rolled from a
  configured RollTable. Tier = count of attached Boosts.
- **Tier** — derived, not stored. Displayed in the actor sheet's
  CompositionPanel via `services/tier-display-service.js`.
- **ChangeDisplayer / RequirementsDisplayer** — CSB itemContainer keys
  on a ChangeSet's `system.props`. Stored as `{ "<childId>": { name,
  id, uuid }, ... }` — an object keyed by child item id. See ADR-0001.
- **Granted item** — an embedded item created on an actor by the
  reconciler from an `ItemGrant` Change, tagged with
  `flags["1547core"].grantedBy = { changeSetId, changeId }`. Removed
  when the parent ChangeSet leaves the actor.

## Combat domain

Authored against `docs/specs/combat-spec-v2.md`,
`combat-resolution-loop-spec-v1.md`, `combat-state-machine-v1.md`.

- **PendingAttack** — descriptor built by `buildPendingAttack`. Carries
  attacker, target, weapon, profile, loaded ammo, selected
  pre-maneuvers, legal pre-maneuvers, reaction candidates, modifier
  summary, reserved costs. Flag kind:
  `"1547core.pendingAttack"`.
- **Attack lifecycle** — pure-compute flow from `buildPendingAttack`
  through `resolveAttackOutcome` and `commitPostManeuver`. Returns
  events + patches; never touches Foundry directly. (Lives in
  `services/combat-resolver-service.js` today; carve-up to
  `combat/attack-lifecycle.mjs` is planned — see
  architecture-review-2026-05-25.)
- **Pool** — array of dice tokens (e.g. `["Heavy", "Heavy",
  "Penetration"]`) built per attacker and defender. Built in
  `combat/pool-builder.mjs`; resolved against opposing pool in
  `combat/resolver.mjs`.
- **Maneuver** — ability used during combat with a timing
  (`pre`/`reaction`/`post`/`full-turn`), trigger, resource cost,
  weapon/armor/range gates. Legal subset evaluated by
  `combat/maneuver-legality.mjs` against a context.
- **Reaction window** — opened by combat events
  (`ATTACK_DECLARED`/`THREAT_ZONE_ENTERED`); waits for actor selection
  with a timeout. Lives in `services/reaction-service.js`.
- **Persistent effect** — actor-flag–tracked status that fires per
  trigger (overwatch is the canonical example). Read/consume API on
  the combat-resolver service.
- **Safe attack** — counter-attack window that follows a successful
  defensive reaction. Free of normal action-economy cost.

## Subsystem-specific terms

### HUD
- **Summary** — single ~40-key object produced by
  `summarizeActor(actor, token, deps)`. The HUD's source of truth.
  Built in `hud/hud-summary.js` (~800 lines, the data aggregation
  seam).
- **Action descriptor** — `{ actionType, sourceType, sourceId, label,
  ...}` describing a HUD button's intent. Created by
  `hud/hud-evaluation.js`.
- **Action context** — `buildHudActionContext(actor, token, deps)`
  return value; cached per-render so the evaluation and execution
  phases share a snapshot.

### CSB
- **CSB itemContainer** — CSB-side container field on an item. Its
  children live as sibling items on the actor, linked by an
  object-keyed map under `system.props.<ContainerKey>`. See ADR-0001.
- **CSB ref field** — single-value variant of itemContainer
  (e.g. `ItemGrantRef`, `SkillRef`, `RequirementSkillRef`). Same
  object-keyed shape; first key is the source item id.
- **system.container** — CSB back-pointer on an item; when set,
  suppresses the item from the actor's main inventory panels. The
  reconciler strips it from granted copies.

## Conventions

- Module IDs: `1547core` (lowercase) for module-namespaced flags and
  the manifest. `1547Core` (capital C) is a *separate* flag namespace
  used by the schema-migration (legacy compatibility) — both appear in
  the wild and both must be read when probing source data.
- Folder layout:
  - `scripts/combat/` — pure logic + patch-returners.
  - `scripts/services/` — Foundry-side orchestrators that register
    hooks, expose the module API.
  - `scripts/hud/` — UI subsystem.
  - `scripts/migrations/` — startup data migrations.
- Tests: `scripts/tests/*.test.mjs`, run with `npm test`.
- Releases: `./release.ps1 [patch|minor|major]` from repo root —
  bumps `module.json`, builds `1547core.zip`, commits + pushes.
