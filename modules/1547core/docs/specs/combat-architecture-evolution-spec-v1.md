# Combat Architecture Evolution Spec v1 — three structural moves

**Status: Proposal.** The combat *micro*-architecture (phased pure functions + patches + maneuver
gates) fits [`battle-flow-spec-v1.md`](battle-flow-spec-v1.md) almost 1:1 and should be kept. The
*macro*-architecture has three structural mismatches with the spec's multiplayer / authority /
turn-scoped nature, and every one of them shows up as a recurring bug or an "unimplemented" feature
in `battle-flow-spec-v1` §12. This spec proposes three additive layers that turn today's bolt-ons
into the natural grain of the code, with an incremental migration that never rewrites the phased
design.

## The thesis

| Spec requirement | Today | Natural home? |
|---|---|---|
| GM-authoritative writes (§7) | `applyPatch` writes on whatever client resolves | **none** — no authority in the dispatcher |
| Cross-client windows: reactions, post-maneuvers, damage-taken (§5,§6,§10) | three different control-flows; one bolted-on relay | **none** — relay is a side-channel |
| Turn-scoped rules: reaction renewal, off-turn lock, economy reset (§3,§8) | persistent token state; no per-actor turn record | **none** — only the *side* has state |

Three moves, each additive and independently shippable:

1. **Patch authority** — route writes to a GM at the dispatcher.
2. **A uniform combat-window abstraction** — promote the relay to *the* window mechanism.
3. **Per-actor activation state** — a turn-scoped record reset on side advance.

Move 1 is the foundation (2 and 3 both write through it). The design keeps `plan*`→patch→event and
the phased functions exactly as they are.

---

## Move 1 — Patch authority (the dispatcher routes writes to a GM)

**Problem.** `applyPatch` ([`combat-resolver-service.js`](../../scripts/services/combat-resolver-service.js))
calls `actor.update` / `setFlag` / `setActorStatusEffect` **directly on the resolving client**. When
a player attacks a GM-owned actor the player is the resolver and the writes fail (battle-flow §12 #1).
The relay's "GM-authoritative" claim is aspirational because nothing routes the writes.

**Why it fits.** Patches are already **plain serialisable data** (`{kind, actorId, data, …}`) — the
exact thing you want to ship over a socket. The dispatcher is the one choke-point for every combat
write. So authority belongs here and nowhere else.

**Shape.** Keep `applyPatch` as the *local applier*; add a routing wrapper:

```js
// can the local client write this patch's target document?
function canApplyLocally(patch) {
  if (game.user.isGM) return true;
  const actor = resolveActorById(patch.actorId);
  return !!actor?.isOwner; // owner ⇒ may update/setFlag/status
}

// replaces direct applyPatches() at the runPhases call sites
async function dispatchPatches(patches = [], { awaitRemote = false } = {}) {
  const local = patches.filter(canApplyLocally);
  const remote = patches.filter((p) => !canApplyLocally(p));
  for (const p of local) await applyPatch(p);
  if (remote.length) await routePatchesToGM(remote, { awaitRemote });
}
```

- `routePatchesToGM` emits a `patch-apply` message on `module.1547core` with the serialised patch
  set; the **active GM** validates and applies them (and acks when `awaitRemote`). Reuse the relay's
  socket + `userConnected` re-send + single-applier discipline.
- **Single applier:** exactly one GM applies (e.g. `game.users.activeGM` / lowest-id active GM) to
  avoid double-writes; others ignore.
- **Await only when needed.** Most combat patches are terminal (HP, status, flags) and the resolver
  reads roll outcomes from the **rolls**, not the docs — so fire-and-forget is correct and fast. Pass
  `awaitRemote: true` only where the next phase reads back written state.
- **Validation.** The GM applies only known patch `kind`s against documents in the active combat /
  scene — the wire can't write arbitrary data (mirror the relay's "validate against what we know").

**Touch-points.** `runPhases` and the `applyPatches` call sites in
`combat-resolver-service.js`; one new GM-side socket handler. **No change** to `plan*`,
`lifecycle-flow.mjs`, or any phased function — they still emit patches.

**Fixes:** battle-flow §12 #1 (player-initiated attacks apply), and retroactively makes #2's
safe-counterattack / Face-rotation writes work when the resolver is a player.

---

## Move 2 — A uniform combat-window abstraction

**Problem.** The three interactive windows use three control-flows:
- **Reaction** — awaited *inline* (the `ATTACK_DECLARED` handler blocks on the selection).
- **Post-maneuver** — *fire-and-forget*: returned as decorated closures the **HUD** drives async.
- **Damage-taken** — *vestigial* machinery; its event reused for the defense summary.

So `remote-window-relay` had to special-case each, and the lifecycle isn't linear. The spec
describes one coherent sequence; the code realises it three ways.

**Why it fits.** `remote-window-relay` already does 80% of the general thing: pick responder →
present on owner (HUD or dialog) → resolve on authority → first-wins / timeout / close / re-send.
Promote it from a side-channel to **the** window primitive.

**Shape.** One call the orchestrator `await`s, uniform across kinds:

```js
// authority side (the resolving/GM client)
const choice = await openCombatWindow({
  kind: "reaction" | "post-maneuver" | "damage-taken",
  responderActor,            // whose owner decides
  candidates,                // serialisable [{id,name,…}]
  timeoutMs,
  mirrorToGM: true,          // GM also sees it (current reaction behaviour)
}); // → candidateId | null
```

- Internally: `relayRemoteWindow` (present on the owner) + the GM mirror rule + the single-settle
  controller, returning the chosen id. A registry of `kind → { serialize, present, prompt }` (the
  existing `registerRemoteWindowPresenter`) supplies the per-kind UI.
- **Make post-maneuvers awaited like reactions.** In `resolveAttackOutcomePhased`, the
  `POST_MANEUVER_WINDOW_OPENED` step becomes `await openCombatWindow(...)` and the chosen
  `commitPostManeuver` runs through Move 1 — instead of handing decorated closures to the HUD. The
  lifecycle becomes linear: declare → [reaction] → roll → resolve → [defender post] → [attacker post]
  → commit, each `[]` one `openCombatWindow`.
- **Damage-taken becomes just another kind** (its own event again, freeing
  `DAMAGE_TAKEN_WINDOW_OPENED` from the defense-summary reuse — battle-flow §12 #2).

**Touch-points.** Generalise `remote-window-relay.js`; `reaction-service.js` keeps working (it's
already a consumer); migrate the post-maneuver path in `lifecycle-flow.mjs` /
`combat-resolver-service.js` from closures to an awaited window; add the damage-taken kind. The HUD
becomes a *presenter*, not the post-maneuver *driver*.

**Fixes:** uniform control-flow; battle-flow §12 #2; collapses the GM-mirror/relay special-casing
into one mechanism; makes "the acting client" an explicit window parameter rather than an accident
of who clicked.

---

## Move 3 — Per-actor activation state (turn-scoped)

**Problem.** The side-tracker tracks the active **side**, but no per-actor turn record exists. So the
spec's turn-scoped rules have nowhere to live and are all unimplemented: reaction renewal each round
(§3/§12 #3), the off-turn facing lock (§12 #5), economy reset (§3). Facing is just persistent token
rotation; reactions have no counter.

**Why it fits.** The side model already persists per-combat flags via `persistCombatSideState`
(GM-gated). A per-combatant activation record is the same pattern, one level down, and gives the
legality gates and the off-turn lock a field to read.

**Shape.** A record per combatant (stored on the combatant flag, written via Move 1, reset on
advance):

```js
// combatant.flags.1547core.activation
{
  round: <n>,            // the round this record is for
  reactionUsed: false,   // renews each round (GM ruling)
  facedThisActivation: false,
  // attack/movement remain MANUAL for now (GM ruling) — fields reserved, not auto-enforced
}
```

- `getActivation(combatant)`, `markReactionUsed(actor)`, `resetActivationsForRound(combat)`.
- **Reset point:** `advanceCombatToNextSide` / round change calls `resetActivationsForRound`
  (per the ruling: **reactions renew each round**; economy stays manual).
- **Legality wiring:** `passesActionEconomyGate` reads `activation.reactionUsed` for reaction
  candidates (when the once-per-round rule is enabled); the synthetic **Face** candidate is offered
  only if a reaction is available *and* the shot is a faceable rear (§8) — keeping the geometry gate
  separate from the economy gate (so "Face missing for geometry" stays distinct from "reaction
  spent").
- **Off-turn lock:** a `preUpdateToken` veto reads "is this token's side the active side" +
  `activation`, allowing only `facingAutoFace` / forced updates off-activation (battle-flow §12 #5).

**Touch-points.** New `combat/activation-state.mjs` (plan*/patch helpers, GM-written via Move 1);
reset call in `advanceCombatToNextSide` (`actor-hud.js`); read in `maneuver-legality.mjs`
(reaction gate) and a new `registerFacingLock` (`combat/facing.mjs`).

**Fixes:** battle-flow §12 #3 (reaction renewal), #5 (off-turn lock), and the economy-reset hook (left
manual by ruling, but the field exists when wanted).

---

## How the moves compose

```
Move 1 (patch authority)  ── foundation; all GM-authoritative writes go through it
   ├─ Move 2 (windows) ── resolution patches (commitPostManeuver, safe counter) apply via Move 1
   └─ Move 3 (activation) ── activation records written/reset via Move 1, read by gates + lock
```

Authority is enforced once (Move 1); presentation/choice is unified once (Move 2); turn-scoped
state has one home (Move 3). The phased functions and the patch/event boundary are untouched.

## Migration path (incremental, keeps the phased/patch design)

- **Phase A — Patch authority (Move 1). ✅ Shipped.** `applyPatches` now splits each set into
  locally-writable vs. not; a player's patches to actors they don't own (e.g. attacking a GM NPC)
  are routed over `module.1547core` (`patch-apply`) to the **designated GM** (`isDesignatedPatchGM`,
  via `game.users.activeGM`) who applies them. GM-acting path unchanged (GM writes all locally).
  Fire-and-forget (combat reads outcomes from rolls, not docs). *Needs a two-client live test:
  player attacks a GM NPC → damage/status apply.* Remaining direct (non-patch) write:
  `registerFacingService`'s token rotation on `REACTION_RESOLVED` is not yet routed (minor — only
  bites when a player is the resolver and the reactor is a GM-owned token).
- **Phase B — Window abstraction (Move 2).**
  - **B1 — ✅ already in place.** `remote-window-relay` (built during the reaction phases) *is* the
    canonical window primitive: reactions, post-maneuvers, and the defense summary all flow through
    `relayRemoteWindow` + `registerRemoteWindowPresenter`. The cross-client mechanism is unified; no
    further collapse is needed there. (Treat `relayRemoteWindow` as the `openCombatWindow` this spec
    named.)
  - **B2 — deferred, recommend against.** Making post-maneuvers *awaited* (vs. today's async,
    HUD-driven, relay-backed flow) blocks the lifecycle on a player's choice (deadlock risk) for **no
    functional gain** — the async flow already works and is cross-client. The three windows having
    different *local* control-flows is legitimate. Revisit only if a post-maneuver must mutate the
    in-flight result before `ACTION_COMMITTED`.
  - **B3 — a feature, not wiring.** `executeSafeCounterattackPhased` only **declares** the counter
    (`declareAttackPhased`); it does **not** roll/resolve it (no attack+defense roll, no
    `resolveAttackOutcome`). To make the damage-taken safe-counterattack real, build the
    **counter-resolution loop** (roll → defense → resolve → card), then add the "Safe Counterattack"
    action to the existing defense-summary/damage-taken window (`buildDamageTakenPrompt` already
    renders the button when `commitSafeCounterattack` is provided). Untestable until the granting
    maneuver (maneuvers.json:1172) can be exercised with two clients. **This is the real remaining
    Phase B work.**
- **Phase C — Activation state (Move 3).** Add the record + `resetActivationsForRound` on advance;
  wire reaction renewal; add the `preUpdateToken` facing lock. Independent of A/B except it writes via
  Move 1.

Each phase is shippable on its own and leaves combat working.

## What this does *not* change / non-goals

- **Not** a rewrite of the phased/pure + patch + gate design — that's the part that fits.
- **Not** moving resolution off the GM. Authority *stays* GM; Move 1 routes writes **to** it.
- **Out of scope (local fixes, not architectural):** footprint-edge reach (§12 #4), the
  multiplier flag-path detail (§12 #8), multi-target/ammo (§12 #10). They don't need these layers.

## Fix mapping (to `battle-flow-spec-v1.md` §12)

| §12 item | Resolved by |
|---|---|
| #1 write routing | Move 1 |
| #2 damage-taken window / event reuse | Move 2 |
| #3 reaction renewal | Move 3 |
| #5 off-turn facing lock | Move 3 |
| #4 reach, #8 multiplier, #10 multi-target/ammo | local fixes (out of scope) |
