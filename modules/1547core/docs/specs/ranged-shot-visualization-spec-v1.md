# Ranged Shot Visualization & Automation Spec v1

**Status: Source design — drafted from a design discussion with the project owner.
Implementation is pending.** This is the canonical design for **visualizing and automating a
ranged attack** on the canvas and in the HUD: range bands, the shot lane, cover obstacles,
the rear bonus, line of sight, and the direct/arc choice. It is the *presentation + resolution
layer* over two already-specced rules — facing and cover — and reuses the overlay and grid
math the module already has.

## Connections

- **Facing & positioning** — [`facing-and-positioning-spec-v1.md`](facing-and-positioning-spec-v1.md)
  supplies the **rear cone** (`getVulnerabilityTiles` / reversed `getThreatTiles`) and the
  rear +1.
- **Cover & obstruction** — [`cover-spec-v1.md`](cover-spec-v1.md) supplies the **lane trace**,
  the ordered **obstacle list** with block values, the nearest-first interception roll, and
  the **`indirect`** (arced) flag that bypasses the lane.
- **Existing overlays** — `scripts/hud/actor-hud.js` already draws range bands and the
  threat/vulnerability tiles (`getRangeBandTiles`, `getDistanceTiles`, `getThreatTiles`,
  `getVulnerabilityTiles`, `renderThreatOverlay`, `ensureThreatOverlayLayer`). This spec
  *extends* that PIXI layer rather than adding a new one.
- **Attack pipeline** — the pool is built in `scripts/combat/pool-builder.mjs`
  (`advantageCount`, `addRiskDice`, …); the exchange runs through
  `scripts/combat/attack-lifecycle.mjs` and
  [`combat-resolution-loop-spec-v1.md`](combat-resolution-loop-spec-v1.md). The HUD attack
  block is in `scripts/hud/hud-render.js`.
- **Foundry walls / LoS** — line of sight and full-block come from Foundry's wall-collision
  test (`ClockwiseSweepPolygon.testCollision` / `canvas.walls.checkCollision`), never derived
  by hand.

---

## Goal & design principles

Make a ranged shot **legible before it is taken** and **automated where the maths is
deterministic**, while keeping the *decisions* with the player/GM (per the facing & cover
specs).

- **One source of truth.** The overlay, the HUD readout, and the resolution all read the same
  computed object (the **ShotPlan**), so what you *see* is exactly what *rolls*.
- **Extend, don't reinvent.** Build on the existing PIXI overlay and grid helpers.
- **Assisted, not forced.** The engine *computes and shows*; it auto-applies only the truly
  deterministic parts (LoS, range band, attacker auto-face) and *suggests* the rest.
- **Legibility is the first deliverable.** The preview (see what your shot faces) is valuable
  on its own, before any roll is automated.

## The backbone: a `ShotPlan`

Computed once for a (shooter, target) pair — on target/hover — and consumed by every layer:

```
ShotPlan(shooter, target) → {
  losBlocked:    boolean,          // Foundry wall collision; if true, no shot
  rangeBand:     "short"|"long"|"max"|"out",   // + its accuracy modifier
  lane:          [ {col,row} … ],  // grid line shooter→target (supercover)
  obstacles:     [ { ref, kind:"token"|"object", blockValue:1..4, distance } ],  // nearest-first
  rearAdvantage: boolean,          // attacker stands in the target's rear cone (+1)
  arc: {
    available:   boolean,          // weapon arc-capable (RangedWeapon/ThrownWeapon, not Firearm)
    overheadClear: boolean|null    // GM flag; null = unknown/open (treat as clear)
  }
}
```

`ShotPlan` is the union of the facing rear-cone check and the cover lane/obstacle trace,
plus range and LoS. It is **pure derivation** — no persistent state.

## Visualize it

### Canvas overlay (extend the existing PIXI layer)

When a ranged attacker **targets** a token, replace the generic threat overlay with the
shot-specific one:

- **Lane** — a line shooter→target, **tinted by range band** (short / long / max), so range
  reads at a glance.
- **Obstacles** — each obstacle tile gets a badge with its **block odds** ("2/6") and a
  **friend/foe tint** (a red ring when it is an *ally* in the lane — the "you'll shoot your
  own man" warning).
- **Rear marker** — when the shot lands in the target's rear cone, mark it (reuse the
  vulnerability-tile colour) to show the **+1 is available**.
- **LoS blocked** — the lane greys out and a wall marker shows at the blocking segment; Fire
  is disabled.
- **Arc mode** — toggling to arced lifts the lane to a dashed "over" style, **greys out the
  obstacles** (ignored), and **clears the rear marker** (no +1).

### HUD panel (the same data, in words)

A compact ranged-shot readout in the attack block:
`Range: long (−1) · Lane: cart 3/6, ally 2/6 · Rear +1 · [ Direct ▸ Arc ]` with a **Fire**
button. For the player not staring at the grid.

## Automate it (auto / suggest / roll)

| Tier | What | Examples |
| --- | --- | --- |
| **Auto** (just happens) | Deterministic, no judgement | LoS test; range-band classification; lane trace + obstacle gather + block values; rear-cone check; **attacker auto-faces the target** |
| **Suggested** (one-click) | Choices the engine offers | apply the range penalty; accept the rear +1; pick **Direct vs Arc** |
| **Rolled** (on Fire) | Dice | interception d6s (nearest-first, early-stop → redirect); the attack pool (rear +1 if direct; **risk die if arced**) |

The engine never auto-applies the +1 or auto-spends a reaction; it never *forces* the shot.

### Foundry APIs to lean on

- **LoS / full block** — `ClockwiseSweepPolygon.testCollision(origin, dest, {type:"move"|"sight"})`
  / `canvas.walls.checkCollision`. Gives full-block for free and keeps us out of partial-wall
  cover (which the cover spec leaves to a GM toggle).
- **Range bands** — `getRangeBandTiles` / `getDistanceTiles` (already exist).
- **Lane** — a grid supercover/Bresenham line between token centres; obstacles = tokens
  occupying lane tiles (minus shooter/target), plus GM-flagged objects.
- **Targeting** — `game.user.targets` and the `targetToken` hook drive the live preview;
  `hoverToken` can drive a lighter preview as today.
- **Animation (optional)** — a Sequencer/JB2A projectile if available, else a quick PIXI
  tracer along the lane. The **interception animation** (the arrow thunking into the body in
  the way) is the payoff that sells the cover rule.

## The fire flow

1. **Aim** — target a token; the `ShotPlan` overlay updates live.
2. **Choose** — Direct or Arc (Arc only if `arc.available` and overhead is clear).
3. **Fire:**
   - *Direct:* roll interception nearest-first; on a catch, **redirect** — animate the
     projectile stopping at that obstacle and deal a **full damage roll, no defense**
     (cover spec). Otherwise the shot reaches the target.
   - *Arc:* skip the lane entirely; resolve against the target with **no rear +1** and a
     **risk die** added to the pool.
   - On reaching the target, resolve normally (rear +1 if a direct rear shot).
4. **Animate + report** — projectile along the lane (or arc), then the chat card.

## Data model

| Datum | Where it lives | New? |
| --- | --- | --- |
| ShotPlan | Derived per (shooter, target) at aim time | New (pure computation; no persistence) |
| Range bands / distance tiles | `getRangeBandTiles` / `getDistanceTiles` | No |
| Lane / obstacles / block values | Derived (cover spec) | No (lane helper is the one small new util) |
| Rear cone | Derived (facing spec) | No |
| LoS / walls | Foundry wall collision | No — built-in |
| Object block value, overhead-clear | GM flags on drawings/tiles | Minor — optional flags (cover spec) |

## Implementation phases

1. **Preview overlay + HUD readout (read-only).** *Partial.*
   - **HUD readout ✅** — a pre-shot notice on firing: `Ranged shot — <range band> · cover:
     cart 3/6, ally 2/6 (threading)`. (`hud-actions.js`, `describeLaneOdds`.)
   - **LoS auto-block ✅** — `ranged-cover.js lineOfSightBlocked` (Foundry sight collision,
     defensive); a shot with no line of sight is rejected.
   - **Canvas overlay (the lane line / odds badges / rear marker on the map) — deferred.**
     Untestable PIXI drawing; best done with Foundry open. Extends the existing
     `renderThreatOverlay` PIXI layer.
2. **Fire flow — interception + attack. ✅** Done in the cover spec (interception roll → redirect /
   pass-through, rear +1 wired). See `cover-spec-v1.md`.
3. **Arc toggle. ✅ (via the maneuver).** `indirect` is the Arced Shot maneuver's `effectData`
   (skip interception, no rear +1, risk die) — already consumed. A dedicated Direct/Arc *button*
   is optional sugar on top.
4. **Animation. — deferred.** Projectile + interception visuals (Sequencer/JB2A if present, else a
   PIXI tracer). Pure presentation; depends on optional modules; untestable headlessly.

## Out of scope (v1)

- Automatic partial cover from walls (full block is Foundry's; partial cover is a GM toggle —
  cover spec).
- 3-D / elevation and true overhead-cover detection for arcs (a GM flag, per the cover spec).
- Area / template attacks and their visualization (a separate concern).
- Forcing any modifier or the shot itself — the layer stays assisted.
