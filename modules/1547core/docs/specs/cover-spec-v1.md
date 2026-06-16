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
- **Visualization & automation** — how the lane, obstacles, odds, and the fire flow are shown
  and rolled is [`ranged-shot-visualization-spec-v1.md`](ranged-shot-visualization-spec-v1.md).

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

2. **Each obstacle has a block value** — its d6 threshold, **strictly by size / solidity**:

   | Obstacle | Block value (d6 ≤) | Chance |
   | --- | --- | --- |
   | Light / small (small creature, fencepost) | 1 | 1-in-6 |
   | Medium (a person, a barrel) | 2 | 2-in-6 |
   | Heavy / large (large creature, a cart) | 3 | 3-in-6 |
   | Huge / near-total (colossus, portcullis, arrow-slit) | 4 | 4-in-6 |

   Block value depends **only** on the obstacle's size/solidity — never on the shooter's skill
   (skill belongs to the future "thread the needle" option). Creature block value is driven by
   **token size**; inanimate obstacles carry a GM-set value (see Data model).

3. **Roll each obstacle in order; first catch wins.** Roll a d6 for each obstacle from
   nearest to farthest. The **first** roll **≤ its block value intercepts** — the projectile
   strikes that obstacle and **stops** (no further obstacles, and it never reaches the
   intended target). If no obstacle intercepts, the shot reaches the target.

4. **Redirect resolution — the obstacle is simply hit.** When an obstacle intercepts, it is
   **hit outright** and takes a **full damage roll** from the weapon. There is **no defense
   roll** — in this system all defense lives in the defense roll, and a stray, unaimed hit on
   a bystander grants none — and **no mitigation**: the screen was not braced for it. An
   inanimate object likewise just takes the full damage (no durability tracked in v1).

5. **Pass-through → normal resolution.** If the shot clears every obstacle, resolve the
   attack against the intended target as usual — including any **rear +1** from the facing
   spec.

**Friendly fire is real — and unmitigated.** If the intercepting obstacle is an ally, that
ally takes a **full damage roll with no defense**. That is the entire point: shooting past
your own line is a genuine, punishing risk, not a free play. The deterrent is meant to bite.

## Arced shots bypass the lane (the `indirect` flag)

A **lobbed / arced** shot climbs over intervening obstacles and drops onto the target — the
way to shoot over your own front line, a low wall, or a melee — so it **skips interception
entirely**. This is **not** a separate firing mode: it is the **`indirect: true`** flag on a
maneuver's `effectData` (the **Arced Shot** maneuver, and Volley Fire). When an attack carries
`indirect`:

- **No interception** — the lane (rules 1–5) is not traced; intervening obstacles are ignored.
- **No rear +1** — a shot falling from above doesn't care which way the target faces, so it
  forfeits the facing rear bonus (see [`facing-and-positioning-spec-v1.md`](facing-and-positioning-spec-v1.md)).
- **A risk die** — an indirect lob is a gamble, not merely a weaker shot: `addRiskDice: 1`
  adds a Risk die (which can **fumble** — the arc goes awry — or come up a **crit**). This is
  the cost that keeps arcing from being the free escape from interception, and it limits
  *frequency* (you won't casually arc every round) rather than just making the shot miss.
- **Arc-capable, non-firearm weapons only** — bows, slings, thrown (`RangedWeapon` /
  `ThrownWeapon` groups; firearms fire flat and cannot arc).
- **Overhead cover is a GM call** — Foundry's grid has no height, so "is there a roof/canopy
  above the path?" is a GM flag, not derived. Indoors / under cover, no arc.

So the shooter's choice is real: a **direct** shot plays the positional game (interception
risk, rear-+1 reward); an **arced** shot opts out of both for a flat accuracy cost.

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
- **GM/player choice:** whether to take the shot at all, and the GM-set block value for
  inanimate obstacles. The engine never *forces* the shot.

Suggested insertion points:

- **Lane trace** — a grid line-of-tiles helper (Bresenham/supercover) alongside the facing
  geometry in `scripts/hud/actor-hud.js` (or a shared `scripts/lib` geometry module).
- **Obstacle gather + block values** — map lane tiles → occupying tokens/flagged objects,
  exclude shooter/target, order by distance, attach block values (token size, or object flag).
- **Interception roll** — in the attack lifecycle (`scripts/combat/attack-lifecycle.mjs`),
  after target selection and before target resolution: roll nearest-first, stop at first
  catch. On a catch, deal a **full damage roll to that obstacle with no defense roll**;
  otherwise pass through to the target.
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

1. **Lane trace + warning (read-only). ✅** Pure geometry in `scripts/lib/lane.mjs`
   (`laneTiles` supercover trace, `blockValueForSize`, `gatherObstacles`, `rollInterception`),
   unit-tested in `scripts/tests/lane.test.mjs`. Live glue in `scripts/combat/ranged-cover.js`
   (`laneObstacles`, `describeLaneOdds`). The shooter gets a "Firing through cover — cart 3/6,
   ally 2/6" notice before the shot. *(A richer in-HUD panel is the
   `ranged-shot-visualization-spec` — still future.)*
2. **Interception roll. ✅** `rollLaneInterception` rolls a d6 per obstacle nearest-first with
   early-stop; first `≤ block` catches.
3. **Redirect resolution. ✅** On a catch, `resolveInterception` (in `hud-actions.js`, before the
   target's reaction) deals a **safe attack** to the obstacle — full damage roll, **no defense
   roll, no reaction, no crit/fumble** — and the shot never reaches the target (friendly fire
   included). Writes route to the GM (Move 1). Block values come from token size (decision: tiny→1,
   1×1→2, 2×2→3, 3×3+→4); **tokens only** in v1.
   - **Arced Shot `indirect` ✅** — a maneuver with `effectData.indirect` skips the lane entirely
     and forfeits the rear +1 (the Risk die already comes from the maneuver's `addRiskDice`). This
     finally makes the Arced Shot maneuver functional.
4. **(Optional, later)** Destructible object cover (block value + HP), GM-flagged inanimate
   obstacles (drawings/tiles), and a "thread the needle" shooter option (accept disadvantage to
   lower interception odds).

## Out of scope (v1)

- Automatic partial cover from **walls** (use Foundry LoS for full block; GM toggle for
  abstract cover).
- Directional cover bookkeeping (which side the obstacle protects).
- Object durability / destructible cover (future).
- Melee/reach cover (this spec is ranged interception only).
- Area / template attacks (a separate concern).
