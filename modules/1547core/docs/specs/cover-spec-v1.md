# Cover & Line Obstruction Spec v1

**Status: Source design — drafted from a design discussion with the project owner.
Implementation is pending.** This is the canonical design for ranged **cover**, modelled as
*obstacle interception*: rather than a flat to-hit penalty, each thing in a shot's path gets
a chance to **catch the projectile instead**. It deliberately reuses the grid + a single d6,
adds essentially no persistent data, and stays GM-assisted.

## Connections

- **Facing & positioning** — [`facing-and-positioning-spec-v1.md`](facing-and-positioning-spec-v1.md)
  is the sibling system. They compose: interception is rolled **first** (the lane), and if
  the shot gets through, the attack resolves with any **rear +1** from facing. Cover reuses
  the same grid geometry and the same "single-die, GM-assisted" philosophy.
- **Ranged range bands** — `getRangeBandTiles` / `getDistanceTiles` in
  `scripts/hud/actor-hud.js` already model ranged reach; the lane trace is the same grid math
  one step further (a line instead of a band).
- **Attack lifecycle** — interception happens when a ranged attacker→target pair is
  established, before target resolution. See `scripts/combat/attack-lifecycle.mjs` and
  [`combat-resolution-loop-spec-v1.md`](combat-resolution-loop-spec-v1.md).
- **Dice** — one d6 per obstacle; see [`dice-resolution-spec-v1.md`](dice-resolution-spec-v1.md).
- **Foundry walls / LoS** — full, solid cover is **not** in this spec: a wall that blocks
  line of sight already means *no shot* (Foundry enforces it). Interception is only for
  things you can partly see past.

---

## Goal & design principles

Make "what's between me and my target" matter for ranged attacks — especially **firing into
melee** — without a to-hit-penalty abstraction or a wall-geometry nightmare.

- **Cover = interception, not a penalty.** Each obstacle in the lane *might* take the hit
  instead. Dramatic, intuitive, and it makes the danger of shooting past allies emergent.
- **Reuse the grid + a d6.** A line trace and one die per obstacle. No new currency, no new
  persistent schema beyond an optional block value on inanimate obstacles.
- **GM-assisted.** The engine traces the lane, rolls, and *shows* the result; the GM/shooter
  decides to take the shot knowing the risk. Foundry already handles full LoS.
- **Composes with facing.** Interception (the lane) resolves before the rear +1 (the target's
  back). They are orthogonal and both apply.

## Core rules

1. **Trace the lane.** From shooter to target, list every **other** token or flagged object
   the shot's line crosses, **ordered nearest-the-shooter first**. The shooter and the
   intended target are never obstacles to themselves.

2. **Each obstacle has a block value** — its d6 threshold, by size/solidity:

   | Obstacle | Block value (d6 ≤) | Chance |
   | --- | --- | --- |
   | Light / small (small creature, fencepost) | 1 | 1-in-6 |
   | Medium (a person, a barrel) | 2 | 2-in-6 |
   | Heavy / large (large creature, a cart) | 3 | 3-in-6 |

   **(Open call — block-value table.)** Defaults above; tune the buckets/thresholds to taste.
   Creature block value is driven by **token size**; inanimate obstacles carry a GM-set value
   (see Data model).

3. **Roll each obstacle in order; first catch wins.** Roll a d6 for each obstacle from
   nearest to farthest. The **first** roll **≤ its block value intercepts** — the projectile
   strikes that obstacle and **stops** (no further obstacles, and it never reaches the
   intended target). If no obstacle intercepts, the shot reaches the target.

4. **Redirect resolution.** When an obstacle intercepts, the shot is now an attack **against
   that obstacle**: a creature **defends normally** (its own defense/armor applies); an
   inanimate object simply **absorbs** the shot (no defense; no durability tracked in v1).
   **(Open call — resolve vs. obstacle.)** Default: re-resolve the attack against the
   obstacle so defense/armor still matter. Alternative: the obstacle is simply **hit**
   (auto), skipping its defense.

5. **Pass-through → normal resolution.** If the shot clears every obstacle, resolve the
   attack against the intended target as usual — including any **rear +1** from the facing
   spec.

**Friendly fire is real.** If the intercepting obstacle is an ally, that ally takes the hit
and damage normally. That is the entire point — it is what makes shooting past your own line
a genuine risk, not a free play. **(Confirm the table wants this lethality.)**

## Why this works

- **"Don't shoot into melee" is emergent.** An enemy toe-to-toe with your ally puts the ally
  in the lane as the nearest obstacle — roll, and you may feather your own fighter. No
  special rule; it falls out of the trace.
- **Size matters.** A large creature (3-in-6) is a real screen; a small one (1-in-6) barely
  obstructs. Interposing a body to protect a vulnerable ally becomes a deliberate tactic.
- **Clutter compounds.** Several obstacles in the lane is several independent chances to be
  stopped — a crowd is genuinely hard to shoot through, as it should be.
- **One die, reused geometry.** Nothing new to learn: a line on the grid and a d6 per thing
  on it. It also slots beside the rear +1 without interaction headaches (lane first, then the
  target's back).

## Data model

| Datum | Where it lives | New? |
| --- | --- | --- |
| Lane tiles (shooter→target) | Derived — a grid line trace (Bresenham/supercover) | New tiny helper, shares the facing grid math |
| Obstacle list (ordered) | Derived — tokens/objects on the lane tiles, minus shooter & target | No |
| Creature block value | Derived from **token size** | No |
| Object block value | A small flag on the obstacle (drawing/tile/token), GM-set; default by size | Minor — one optional flag |
| Line of sight (full block) | Foundry walls / vision | No — built-in, and out of scope here |

No per-attack persistent state: the interception is rolled and resolved in the moment.

## Engine mapping (auto vs. GM)

- **Auto (rolled and shown):** when a **ranged** attacker→target pair is set, trace the lane,
  gather ordered obstacles, and — on the shooter's confirmation to fire — roll each obstacle's
  d6 nearest-first, stopping at the first catch. Surface the obstacles and rolls in the HUD so
  the shooter sees the risk *before* committing ("2 in the lane: cart 3/6, ally 2/6").
- **GM/player choice:** whether to take the shot at all; the GM-set block value for inanimate
  obstacles; the redirect resolution per the open call. The engine never *forces* the shot.

Suggested insertion points:

- **Lane trace** — a grid line-of-tiles helper (Bresenham/supercover) alongside the facing
  geometry in `scripts/hud/actor-hud.js` (or a shared `scripts/lib` geometry module).
- **Obstacle gather + block values** — map lane tiles → occupying tokens/flagged objects,
  exclude shooter/target, order by distance, attach block values (token size, or object flag).
- **Interception roll** — in the attack lifecycle (`scripts/combat/attack-lifecycle.mjs`),
  after target selection and before target resolution: roll nearest-first, stop at first
  catch, and either redirect the attack to that obstacle or pass through.
- **HUD surface** — show the lane obstacles and their odds in the attack panel
  (`hud-render.js`), and report the interception result in the roll output.

## Edge cases & rulings

- **Melee / reach excluded.** Interception is a *projectile-path* rule; melee and reach
  attacks do not trace a lane (you are adjacent). Cover here is **ranged only**.
- **Full walls are Foundry's job.** A wall that blocks LoS = no shot at all; this spec never
  tries to derive *partial* cover from wall corners (the geometry nightmare). For abstract
  cover with no token to roll against, fall back to the facing spec's optional GM "in cover"
  toggle (a flat −1).
- **Shooter & target are not obstacles.** The endpoints are excluded; only things *between*
  them count.
- **Adjacent-to-line vs on-line.** v1 counts a token as an obstacle when the lane crosses a
  tile it occupies. (A token merely grazing the corner is a tuning question — start strict:
  must occupy a crossed tile.)
- **Composition with the rear +1.** Lane interception is resolved first; if the shot gets
  through, the target's facing (rear +1) applies to the final hit. They never conflict.
- **Objects and durability.** v1 does not track object HP — an inanimate obstacle just eats
  the shot. Destructible cover is future work.
- **Large obstacles span multiple lane tiles.** A 2×2 in the lane is still **one** obstacle
  with one roll (at its large block value); it does not roll per tile.

## Implementation phases

1. **Lane trace + warning (read-only).** Compute and display the obstacles and their odds in
   the ranged attack panel. No rolling, no enforcement — pure "you'd be shooting through X."
2. **Interception roll.** Roll nearest-first with early-stop; report which (if any) intercepts.
   Still informational if you want — the GM applies the result.
3. **Redirect resolution.** Wire the intercept to actually re-target the attack at the
   obstacle (per the open call), including friendly-fire damage.
4. **(Optional, later)** Destructible object cover (block value + HP), and a "thread the
   needle" shooter option (accept disadvantage to lower interception odds).

## Out of scope (v1)

- Automatic partial cover from **walls** (use Foundry LoS for full block; GM toggle for
  abstract cover).
- Directional cover bookkeeping (which side the obstacle protects).
- Object durability / destructible cover (future).
- Melee/reach cover (this spec is ranged interception only).
- Area / template attacks (a separate concern).
