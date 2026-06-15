# Cross-Client Reaction Layer Spec v1

**Status: Implementation plan.** The combat reaction flow currently runs entirely on the
**acting client** (the attacker's / GM's browser), because combat events use a local
in-memory bus. This spec adds a **socket transport** so the *reacting* player gets the
reaction prompt on **their own** browser and their choice routes back — without moving combat
*resolution* off the acting client. It is the foundation for player-driven reactions across
combat (the Face reaction from the facing spec is one consumer).

## Connections

- **The local event bus** — `scripts/services/event-bus.js` + `scripts/services/combat-events.js`
  (`emitCombatEvent` / `onCombatEvent`) is in-memory only; nothing crosses the socket today.
- **The reaction service** — `scripts/services/reaction-service.js`:
  `handleReactionTrigger` builds the candidate list, emits `REACTION_WINDOW_OPENED`, then
  `waitForReactionSelection` awaits a selection (10 s default timeout) via
  `createReactionSelectionController` (`selectReaction` / `passReaction`), then emits
  `REACTION_RESOLVED`. **This is the integration point.**
- **The window UI** — `scripts/hud/actor-hud.js` shows the window on
  `onCombatEvent(REACTION_WINDOW_OPENED)` (`setHudReactionWindow` + `renderHudForSelection`)
  and settles it via `reactionWindow.selectReaction(...)`.
- **Candidate id normalisation** — `normalizeSelectedReaction` already maps a **string id**
  back to a candidate (`candidates.find(c => c.id === id)`). So the wire only needs to carry
  the chosen **candidate id**.
- **Socket precedent** — the module already uses a socket channel (`module.1547core` in
  `scripts/social/social-battle.js`; `module.raceboard`). Reuse the same pattern.
- **GM-authoritative writes** — combat-state and combatant writes stay on the GM/acting client
  (already enforced); this layer moves only the *prompt + choice*, not the resolution.

---

## Goal & principles

- **The reactor decides on their own client.** The owner of the defending actor gets the
  prompt in their browser; their pick drives the outcome.
- **The acting client stays the authority.** It still runs `declareAttackPhased`, owns the
  timeout, performs the resolution and all combat writes. Only the *presentation and the
  selection* are delegated.
- **Transport only — no resolution rewrite.** Add a socket request/response keyed by a window
  id; keep `reaction-service`'s existing wait/timeout/settle machinery.
- **Trust the authority, not the wire.** The acting client validates the returned id against
  the candidates *it* offered (the responder can't invent a reaction).
- **Graceful fallback.** No online owner / responder closes / times out → the acting client
  resolves locally (GM picks, as today). Combat never stalls.

## Design

### Who is the "responder"?
On the acting client, when a reaction window opens, resolve the **responder users**:

```
owners = game.users.filter(u => u.active && reactorActor.testUserPermission(u, "OWNER"))
```

- If the **acting user is among the owners** → present locally (today's behaviour; no socket).
- Else if there is **≥1 remote owner** → relay to them; show a *"waiting for <name>…"*
  indicator locally instead of the prompt.
- Else (no online owner; GM-owned NPC) → present locally for the GM (fallback).

Prefer the player **controlling the defender token** when several owners exist; otherwise all
remote owners get the request and **first response wins** (the controller settles it).

### The flow (acting client = A, responder client = R)
1. **A** opens the window (`handleReactionTrigger`). It registers the live `reactionWindow`
   in a `pendingWindows` map keyed by a generated `windowId`.
2. **A** broadcasts `reaction-request` to R with a **serialisable** descriptor (no docs/fns):
   `{ windowId, reactorActorId, reactorName, trigger, candidates: [{ id, name, usage, tooltip,
   costType, costAmount, legal, reasons }], timeoutMs, deadline }`.
3. **R** receives it (only users who own `reactorActorId`), renders the prompt (reuse the HUD
   reaction window, or a dialog), and on pick / pass / its own deadline emits
   `reaction-response` → `{ windowId, candidateId | null }`.
4. **A** receives `reaction-response`, looks up `pendingWindows[windowId]`, validates
   `candidateId` against that window's candidates, and calls
   `reactionWindow.selectReaction(candidateId)` (or `passReaction()` on null) — settling the
   promise `waitForReactionSelection` is already awaiting.
5. **A** continues: emits `REACTION_RESOLVED` and performs the resolution + writes, exactly as
   today. R's local view updates from the resulting document changes.

`waitForReactionSelection`'s existing timeout stays on **A** as the backstop: if R never
answers, A passes. `createReactionSelectionController` already guarantees single-settle, so a
late response after timeout is ignored.

### Wire protocol (channel `module.1547core`, type-discriminated)
- `{ type: "reaction-request", windowId, forActorId, reactorName, trigger, candidates, timeoutMs, deadline }`
  — A → all; each client ignores it unless it owns `forActorId` (and isn't A).
- `{ type: "reaction-response", windowId, candidateId }` — R → all; only A (holder of
  `windowId`) acts on it.

Keep the payload free of Foundry documents and functions. The acting client retains the full
candidate objects in `pendingWindows[windowId]` and maps the returned id back.

## Where the code changes go

- **`reaction-service.js`** — the hub:
  - Add `pendingWindows` (Map) and the `game.socket.on("module.1547core", …)` handler for
    `reaction-response` (acting side) and `reaction-request` (responder side).
  - In `handleReactionTrigger`, after building `reactionWindow`, compute responders; if the
    prompt belongs to a remote owner, register the window, broadcast `reaction-request`, and
    **suppress the local emit** of `REACTION_WINDOW_OPENED` (show a waiting indicator instead).
  - On `reaction-response`, resolve the window via `selectReaction` / `passReaction`.
- **Responder presentation** — on `reaction-request`, either re-emit `REACTION_WINDOW_OPENED`
  locally (so the existing HUD UI renders) with a thin `selectReaction` that emits
  `reaction-response`, or show a dedicated dialog. Reusing the HUD window keeps UX consistent.
- **`actor-hud.js`** — minor: a "waiting for <player> to react" affordance on the acting
  client; ensure the responder's HUD `selectReaction` routes to the socket when the window is
  remote-driven.

## Edge cases & rulings

- **No online owner / GM-owned NPC reactor** → resolve locally (GM), as today.
- **Multiple owners** → all are prompted; first response wins; the others' prompts close on
  `REACTION_RESOLVED` (broadcast or implied by the resulting doc update).
- **Responder disconnects / closes mid-window** → A's timeout fires → pass. No stall.
- **Late response after timeout** → ignored (single-settle controller).
- **Invalid / spoofed candidateId** → A validates against its own candidate list; unknown id
  is treated as pass.
- **GM attacks a GM-owned token** → acting user owns the reactor → local prompt (no socket).
- **Reconnect / missed request** → the window is authority-side; if R never received it, A
  times out and passes. (Optional v2: A re-sends on R's `userConnected`.)

## Implementation phases

1. **Transport + fallback.** `pendingWindows`, the socket request/response, responder
   resolution, and the acting-side suppress-local-when-remote. Responder side can start as a
   minimal `DialogV2` listing candidate names. Verifiable with GM + one player.
2. **Reuse the HUD reaction window** on the responder for consistent UX; add the
   "waiting for…" indicator on the acting client.
3. **Polish.** Countdown to the deadline on the responder; multi-owner first-wins close;
   `userConnected` re-send.

## Test plan (two clients)

1. GM attacks a player-owned token from the rear → the **player's** browser shows the reaction
   window with **Face Attacker**; the GM sees "waiting for <player>…".
2. Player picks Face → on the GM (acting) client the +1 is dropped, the defender turns, and
   resolution proceeds. Player picks nothing → timeout → +1 stands.
3. Player offline → GM resolves locally (fallback), no error, no stall.
4. Regression: GM attacks a GM-owned NPC → window still shows on the GM client as before.

## Out of scope (v1)

- Moving combat **resolution** or combat-state **writes** off the acting/GM client (they stay
  authoritative; this is transport for the prompt only).
- Broadcasting *every* combat event cross-client — only the reaction window/choice is
  relayed; other events remain local unless a future need arises.
- Spectator views of the reaction window for non-owners.
