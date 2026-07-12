# ADR-0004: Exchange pipeline, patch transport, and the second carve-out round

**Status**: accepted
**Date**: 2026-07-11
**Replaces / extends**: amends ADR-0002 (dispatcher location; pure-module list), applies ADR-0003 (two new phased functions)
**Context for**: anything touching attack execution end-to-end, the patch
dispatcher, `hud/actor-hud.js`, `HUD_STATE`, or roll-to-chat helpers.

## Background

The 2026-07-11 architecture review found the ADR-0002/0003 core healthy but
five frictions around it:

1. The **exchange skeleton** (declare → reaction → attack roll → defense roll
   → `resolveAttackOutcome` → result card) re-assembled in five modules
   (+1 partial): `executeWeaponAttackAction` (324L), `runSafeCounterattack`,
   `resolveInterception` (hud-actions.js), `resolveFreeAttack`,
   `declareChokeAttack` (combat-resolver-service.js), and the follow-up safe
   attack inside `applyPostManeuverEffect`. The roll+card helper existed
   twice verbatim (`rollFormulaToChatAndSummarize` / `rollPublicTotals`);
   equipped-armor extraction existed 4×. The 2026-07-11 pre-maneuver
   double-spend bug lived exactly in this seam gap.
2. The **patch dispatcher + GM socket routing** (~250L, ~28% of the
   resolver) is a transport concern with near-zero coupling to resolution.
3. `hud/actor-hud.js` (2,420L) owns seven unrelated jobs; its deps objects
   reach 52 keys.
4. `HUD_STATE` is a half-bypassed facade (~18 flat fields written raw from
   4 files, including during render); `services/reaction-service.js`
   imports `hud/hud-state.js` (service → UI layering leak).
5. `applyPostManeuverEffect` (~195L) is a domain effect-interpreter living
   in the orchestrator; `combat/resolver.mjs` is a dead parallel damage
   model with different multiplier semantics.

## Decisions (grilled 2026-07-11)

| # | Fork | Decision |
|---|---|---|
| 1a | Exchange seam | **Phased function** `resolveExchangePhased(opts, run)` in `combat/lifecycle-flow.mjs`; orchestrator exposes thin `resolveExchange`. Rejected: orchestrator async fn (untestable, third control-flow home); HUD-only dedup (seam stays split). |
| 1b | Exchange interface | **Named presets → private flags.** `mode: "weapon" \| "safe-counter" \| "interception" \| "free-shot"`; each expands internally to capability flags (rollDefense, allowReactions, critsEnabled). Choke stays declare-only, outside the pipeline. Rejected: raw flags (2^n legal states); N exported functions (shallow). |
| 1c | Decoration scope | **Outside.** Ranged cover, auto-facing, positional advantage, rider text, defense-summary push stay in the HUD as pre/post steps around the pipeline. |
| 1d | Rolling | Injected dep per ADR-0002 DI convention — the pipeline never news a `Roll`. The dep is `lib/roll-chat.mjs` (see 7). |
| 2 | Patch transport | Extract dispatcher + `applyPatches` + GM authority (`isDesignatedPatchGM`, `canApplyPatchLocally`) + socket protocol + doc resolvers to **`services/patch-transport.js`**. **Closed switch stays** (ADR-0002 rule); the two domain-flavored kinds get **injected handlers** `{ applyCondition, setActorStatusEffect }` supplied by the combat resolver at registration. Rejected: open registration API (breaks closed-union auditability); moving domain handlers in (stops being a transport). |
| 3a | actor-hud split scope | **All three extractions**: (i) weapon/ammo/attack-profile parsing + `getWeaponAttackState` → pure `combat/weapon-state.mjs`; (ii) PIXI threat overlay → `hud/threat-overlay.js` (`show/clear` interface); (iii) side-advance + Side-Ready + socket → `combat-tracker/side-turn-flow.js` (joins `checkForSideVictory` in the side domain). Order: weapon-state → side-turn-flow → threat-overlay. |
| 3b | weapon-state location | **`combat/`**, not `hud/` — it is attack legality the HUD merely displays; pure module per ADR-0002; `{status, reason, label}` shape kept. |
| 4 | HUD_STATE | **Facade for window state only** (reactionWindow, damageTakenWindow, postManeuverQueue, deferred release, tickers — invariant-carrying, single mutation point); the ~14 view toggles move to a documented plain `HUD_STATE.view` object written freely. Render must not mutate state (`hud-render.js:657` wart removed). **Layering leak fixed**: reaction-service receives staged Core count in the reaction-selection payload; the `services → hud` import is deleted. |
| 5 | Post-maneuver interpreter | **Phased function** `applyPostManeuverEffectPhased` in new `combat/post-maneuver-effects.mjs`; pure helpers exported for direct tests (`planPushPath(from, dir, squares, collides)`, rotation math, Convert re-match math). Chat + declareAttack are injected deps. |
| 6 | Dead code | **Delete `combat/resolver.mjs` + `resolution.test.mjs`**; update CONTEXT.md table and ADR-0002 pure-module list. Rationale: unreferenced by the live path and its multiplier semantics differ — a trap. Git history preserves it. Descriptor pass-throughs in actor-hud fold during the split; ADR-0002's reserved API wrappers stay. |
| 7 | Roll helper | **`lib/roll-chat.mjs`** (`rollToChat({formula, speaker, flavor, mode}) → totals`). **Full sweep**: all ~8 copies migrate (hud-actions, combat-resolver, hud-bindings, counter-roll, movement-reactions, spell-casting-service, usage-effect-action-resolver, social-battle, roll-dialog, side-tracker), **and the spell / social / ritual subsystems gain test coverage** as part of the sweep (owner-directed scope expansion). |

## Consequences

- `combat/lifecycle-flow.mjs` gains the exchange pipeline; the five callers
  become preset one-liners plus their genuinely unique decoration.
- `services/combat-resolver-service.js` shrinks by roughly the transport
  (~250L) + interpreter (~195L) + `resolveFreeAttack`/`rollPublicTotals`
  (~50L) — toward ~800L of API wrappers + Foundry glue.
- `hud/actor-hud.js` lands near ~1,200L of actual HUD (window state, hooks,
  render loop); deps objects shrink as extracted modules import their own
  needs.
- New test surfaces: exchange pipeline (fake-run), patch authority table,
  weapon-state parsing, push/rotate/Convert math, window-state transitions,
  spell/social/ritual roll paths.
- The ADR-0002 patch-union rule is unchanged; only the dispatcher's file
  moves. ADR-0003's `run` contract is unchanged.

## Cross-references

- ADR-0002 (carve-up; amended: dispatcher location, module lists).
- ADR-0003 (phased-function contract this ADR reuses twice).
- `CONTEXT.md` — new entries: Exchange pipeline, Patch transport,
  weapon-state, view state, roll-chat.
- Architecture review report:
  `%TEMP%/architecture-review-20260711-combat.html`.
