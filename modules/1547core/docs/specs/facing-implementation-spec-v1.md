# Facing — Implementation Spec v1 (Face reaction & off-turn lock)

**Status: Implementation plan.** Phases 1–3 of
[`facing-and-positioning-spec-v1.md`](facing-and-positioning-spec-v1.md) are **built and
released** (0.3.72). This spec is the execution plan for the two remaining pieces — the
**Face-attacker reaction** (rule 3) and the **off-turn rotation/movement lock** (rule 1's
enforcement) — both of which touch the cross-client reaction orchestrator and the token
update path, and should be done with **Foundry open** for live testing.

## Connections

- Design: [`facing-and-positioning-spec-v1.md`](facing-and-positioning-spec-v1.md) (the rules).
- Shipped code:
  - `scripts/lib/positioning.mjs` — pure geometry (facing, rear cone, `computePositionalAdvantage`). Unit-tested in `scripts/tests/positioning.test.mjs`.
  - `scripts/combat/facing.mjs` — live glue: `getAttackPositioning`, `autoFaceAttacker`, `positionalAdvantageToApply`, `positioningNote`, `tokenInActiveCombat`.
  - `scripts/hud/hud-actions.js` → `executeWeaponAttackAction` — builds the attack pool/formula, calls `declareAttack`, then rolls. The positional +1 is applied here today.
- Reaction orchestrator: `scripts/combat/lifecycle-flow.mjs` (`declareAttackPhased`, `executeResolvedReactionPhased`), `scripts/combat/reaction-candidates.mjs` (`buildAttackReactionCandidates`), `scripts/combat/attack-lifecycle.mjs` (`buildPendingAttack`, `normalizeDefenseModifiers`, `normalizeAppliedAttackModifiers`).

---

## Current behaviour (what's already live)

On a weapon attack (`executeWeaponAttackAction`):
1. **Auto-face** — `autoFaceAttacker(attackerToken, targetToken)` rotates the attacker to face
   the target. The update carries the option `{ facingAutoFace: true }` (the lock will honour
   this).
2. **Detect** — `getAttackPositioning(attacker, target, distanceSquares)` → `{ surprise, rear,
   advantage, faceable }` (square-grid scenes only).
3. **Apply, but only where un-faceable** — `positionalAdvantageToApply(pos)` returns the +1
   **only** for a surprise (target not in combat) or a Hidden attacker. The formula is rebuilt
   with the extra advantage die for those cases. A **faceable rear shot stays a suggestion**
   (card note), so the +1 never lands without its counter.

The remaining work makes the **faceable** rear +1 real by adding its counter (the Face
reaction), and enforces facing persistence (the off-turn lock).

## The reaction architecture (what to integrate with)

- A defender's reactions to an attack are **legal reaction maneuvers**:
  `buildAttackReactionCandidates({ attacker, defender, … })` → `getLegalManeuvers({ timingType:
  "reaction", triggerType: "attack-declared", incomingAttack, context })`.
- The orchestrator is event-driven and **cross-client**: `declareAttackPhased` emits an
  `ATTACK_DECLARED` event through `run({ phase, event })`; the response carries `cancelled` and
  a `reactionResolution` (`findReactionResolution`). The defender picks on their own client.
- Reaction effects already modify the incoming attack. Precedents:
  - `normalizeDefenseModifiers({ defenseReaction })` reads `effectData.addArmorDice`,
    `reduceDamageTaken`, `lockParryingWeaponUntil`, `createFreeSafeCounterattack`.
  - "Desperate Defense" cancels incoming dice via `effectData.cancelIncomingMultiplierDice`.
  - `executeResolvedReactionPhased` branches on `effectData.createFreeSafeAttack` /
    `createFreeSafeCounterattack`.
- The **pool/formula is built before `declareAttack`** and rolled after — so the reaction
  window sits between formula-build and roll. This is the seam the +1 timing must respect.

## Part A — the Face-attacker reaction (facing rule 3)

A defender struck from a vulnerability tile may, in the attack's reaction window, **Face the
attacker**: turn to face (so the blow is no longer from behind, cancelling the +1), as their
**defense** for that attack (consuming the one reaction). Unavailable when not in combat
(surprise), out of reactions, or the attacker is Hidden.

### Recommended approach: recompute-after-reaction (avoids a cancel modifier)

Make the Face reaction's *only* mechanical job **rotate the defender**, and compute the
positional +1 **after** the reaction window from the defender's (possibly updated) facing. If
they Faced, they are no longer in the attacker's rear → no +1, for free. No "cancel incoming
advantage" modifier or identifiable-component bookkeeping needed.

Concretely:

1. **Thread the positional result into the pending attack.** `executeWeaponAttackAction`
   already computes `positioning` from the two tokens. Pass it into `declareAttack(...)` (via
   the `context`/options that reach `buildPendingAttack`) as e.g. `positionAdvantage`. The
   tokens cannot be resolved inside the pure `buildPendingAttack`, so the **HUD computes it and
   passes it down** — do not recompute in the pure layer.
2. **Offer the Face candidate when faceable.** In `buildAttackReactionCandidates`, when
   `context.positionAdvantage?.faceable` is true, **inject a built-in "Face attacker"
   candidate** (id like `face:<defenderId>`, `type: "reaction"`, `effectData: { facingFace:
   true }`). Injecting a synthetic candidate is simpler than authoring a data maneuver +
   teaching `getLegalManeuvers` a `requiresRearAttack` requirement — prefer it unless you want
   Face to be a real, list-visible maneuver.
3. **Resolve the Face effect = rotate the defender.** Where reaction resolutions apply (the
   defense-reaction path feeding `normalizeDefenseModifiers`, and/or
   `executeResolvedReactionPhased`), handle `effectData.facingFace`: rotate the **defender**
   token to face the attacker (reuse `facingToward` + a tagged `{ facingAutoFace: true }`
   update so the lock allows it). Consuming the reaction is the existing defense-reaction
   accounting — Face *is* the defense.
4. **Apply the +1 after the window.** Move the faceable-rear application out of
   `positionalAdvantageToApply`'s "un-faceable only" rule: after `declareAttack` returns (and
   any Face rotation has happened), **re-run `getAttackPositioning`** and rebuild
   `finalAttackFormula` with `pos.advantage`. Now: Faced → not rear → no +1; didn't/couldn't
   Face → still rear → +1. The surprise/Hidden auto-apply path stays as-is (those never reach a
   faceable window).

### Alternative: cancel-via-defense-modifier

Keep applying the +1 up front; author a real **"Face Attacker"** reaction maneuver whose
`effectData` cancels it (mirroring `cancelIncomingMultiplierDice`, e.g.
`cancelIncomingPositionAdvantage: 1`), handled in `normalizeDefenseModifiers` + the resolve
path, plus the defender rotation. More moving parts (a new modifier, identifying the +1
component, a data maneuver, legality gating) — use only if a list-visible maneuver is desired.

### Open decisions
- **Synthetic candidate vs data maneuver** for Face (recommend synthetic).
- **Reaction cost** — confirm Face consumes the same one reaction as a normal defense (spec
  says yes; verify against the reaction economy so it isn't a free extra).
- **Does Facing also let the defender roll a normal defense?** Spec rule 3: yes — Face *is* the
  defense (turn and meet it). Ensure the rotation doesn't *replace* the defense roll.

## Part B — the off-turn rotation/movement lock (facing rule 1)

Enforce "facing changes only on your side's turn" so it isn't a trust rule.

- **Hook:** `Hooks.on("preUpdateToken", (tokenDoc, changes, options, userId) => …)`.
- **Veto** when, **during an active combat**, the token's side is **not** the active side and
  `changes.rotation`/`changes.x`/`changes.y` are present → `return false`.
- **Bypasses** (do not veto): `options.facingAutoFace` (auto-face & Face reaction already tag
  this), forced movement / knockback (tag those updates similarly, e.g.
  `options.facingForced`), the **GM** (`game.users.get(userId)?.isGM`), and when there is no
  active combat.
- **"Active side"** comes from the side-based initiative (`game.combat` turn / the combat
  tracker side groups — see `foundry-side-initiative-encounter-spec-v1.md`). Resolve the
  token's side and compare to the active one.
- Register it alongside the other combat services (a `registerFacingLock()` from
  `scripts/combat/facing.mjs`, wired in `main.js`).

### Open decisions
- **Scope of the lock** — rotation only, or rotation + movement? (Spec says both; movement is
  more intrusive — confirm.)
- **Player feedback** on a vetoed update (a quiet `ui.notifications.info` "not your turn").

## Test plan (run with Foundry open, two clients)

1. **Auto-face** — attacker visibly rotates to face the target on every attack.
2. **Surprise / Hidden** — attack a token not in combat, or while Hidden, from the rear →
   card says "+1 applied", pool has the die. (Already live — regression-check.)
3. **Faceable rear, no Face** — rear attack on an in-combat target; defender declines →
   "+1 applied".
4. **Faceable rear, Face taken** — defender (on their client) picks **Face attacker** → token
   turns, **+1 is gone**, the reaction is spent.
5. **Flanking** — two attackers on the rear; defender Faces one → that +1 cancels, the other's
   +1 lands (defender out of reactions).
6. **Off-turn lock** — a player tries to rotate/drag their token on another side's turn → the
   change is reverted; the GM and the auto-face/Face updates are unaffected; out of combat,
   movement is free.

## Out of scope (here)

- Re-spec of the rules (those live in `facing-and-positioning-spec-v1.md`).
- Ranged interception / cover (`cover-spec-v1.md`) and the shot overlay
  (`ranged-shot-visualization-spec-v1.md`).
