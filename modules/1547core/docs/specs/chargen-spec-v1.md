# Chargen Spec v1

**Status: Source design - drafted from the current chargen implementation and project-owner
direction.** This is the canonical high-level design for player-character generation in
`1547core`. It describes the chargen structure, its authored content model, and the new
`Your Nature` phase.

## Connections

- **The live implementation** lives in `scripts/chargen/chargen.js` and the surrounding
  `scripts/chargen/` helpers.
- **Humours** are set during chargen on the actor's `Humour_*` flags and already drive other
  systems such as disease. See [`disease-system-spec-v1.md`](disease-system-spec-v1.md).
- **Primary stats** are the seven core actor aptitudes:
  `Strength`, `Dexterity`, `Stamina`, `Intelligence`, `Faith`, `Charisma`, `Power`.
- **ChangeSets** remain the preferred vehicle for authored persistent changes that should be
  granted by random-table results and continue to participate in the normal derivation
  pipeline. See [`monster-maker-spec-v1.md`](monster-maker-spec-v1.md) and
  [`change-carrier-schema-spec-v1.md`](change-carrier-schema-spec-v1.md).
- **Biography** is the narrative spine of chargen. Each phase should leave readable traces in
  the actor biography so the generated life can be reviewed after creation.

---

## Goal

Chargen is a biography-first character generation system. It does not begin from free point
buy. Instead it builds a playable adventurer by walking through a life, allowing earlier
events to echo forward, then letting the player finish the character for play.

The chargen experience has four parts:

1. **A Life of Choices**
2. **The Past Returns**
3. **Your Nature**
4. **Advancement**

Each part answers a different question:

- **A Life of Choices**: what happened to this person?
- **The Past Returns**: what from that life still follows them?
- **Your Nature**: what in their aptitude and temperament kept surfacing across the years?
- **Advancement**: what finally sharpens them into an adventurer?

## Part 1 - A Life of Choices

This is the guided life-path from birth to readiness for adventure.

It covers the major authored chapters of a life such as:

- birth and humours
- childhood
- adolescence
- careers and transitions
- retirement / late-life shaping where applicable

This phase is primarily about **discovery through constrained choice**. The player is not
optimizing a build from scratch; they are uncovering a person by choosing between prompted
life events and accepting the outcomes of authored tables.

Expected outputs of this phase include:

- stat changes
- skill and maneuver gains
- money, contacts, status, suspicion, and bodily marks
- humours
- biography lines
- deferred hooks that later feed `The Past Returns`

## Part 2 - The Past Returns

`The Past Returns` is the deferred-consequence layer.

Earlier life choices may plant threads that are not fully resolved when first encountered.
Those threads can later return as one-off reveals, complications, gifts, obligations, old
contacts, old enemies, or reopened wounds.

This phase is **not** a general reward pass. It is specifically about **callbacks to earlier
specific events**. A result in `The Past Returns` should feel like a remembered thread
becoming active again.

Design intent:

- results should read as returns, not as unrelated bonuses
- the player should feel continuity between earlier life events and later consequences
- biography output should make the callback legible

## Part 3 - Your Nature

`Your Nature` is a separate late-life emergence layer. It is **not** another form of
`The Past Returns`.

Where `The Past Returns` is about specific earlier events coming back, `Your Nature` is about
the character's **aptitudes and humours** quietly shaping their life again and again. These
are one-off incidents, not multi-step reveal chains.

### Core idea

From **adolescence through retirement**, each life step may trigger a one-off draw. If it
does, the system first selects a stat-table or humour-table source at random. The result is
then granted only if the character actually qualifies for that source. Otherwise, the draw
**fails quietly** and nothing happens.

This is intentionally sparse. Not every latent tendency flowers into a defining event.

### Rule flow

For each life step from **adolescence** through **retirement**:

1. Roll `1d6`.
2. On a result of `5` or `6`, make a `Your Nature` draw.
3. Roll on the **balanced selector** `3d6` table.
4. The selector points to one of the stat or humour tables.
5. Check whether the character qualifies for that table.
6. If qualified, roll `3d6` on that table and apply the resulting ChangeSet.
7. If not qualified, the draw **fails quietly** and nothing happens.

Each successful trigger produces at most **one** result. `Your Nature` has no reveal chain,
follow-up stage, or retry logic.

### Eligibility

There are **twelve** authored `Your Nature` tables:

- **seven stat tables**, one for each primary stat
- **four humour tables**, one for each humour
- **one balanced selector table**, which chooses among the eleven destination tables

#### Stat-table requirement

A character may use a stat table only if they have at least **`1d6+2`** in that stat at the
time the draw is checked. Both the die count and the modifier count toward this threshold.
Stats are measured in **steps** up the d6 ladder from `1d6` = 0 (`0 = 1d6`, `1 = 1d6+1`,
`2 = 1d6+2`, `3 = 1d6+3`, `4 = 2d6`, ...), and any stat at **2 steps** (`1d6+2`) or above
qualifies.

The seven stat tables are:

- `Strength`
- `Dexterity`
- `Stamina`
- `Intelligence`
- `Faith`
- `Charisma`
- `Power`

#### Humour-table requirement

A character may use a humour table only if that humour is present on the actor via the
corresponding `Humour_*` flag.

The four humour tables are:

- `Blood`
- `Yellow Bile`
- `Black Bile`
- `Phlegm`

#### Balanced selector

The balanced selector table may point to **any** of the seven stat tables or four humour
tables whether or not the character qualifies.

If the chosen destination table is ineligible, the result simply **fails quietly**. There is
no re-roll and no fallback to another eligible table.

This quiet-failure rule is intentional:

- it preserves the feeling of chance rather than entitlement
- it keeps `Your Nature` from becoming a guaranteed reward stream
- it lets the authored selector table stay globally balanced rather than actor-specific

### Design intent

`Your Nature` should feel like a scattering of life marks:

- an intelligent character repeatedly drawn toward study, puzzles, secrets, or abstraction
- a powerful character repeatedly brushing against the uncanny
- a black-bile life acquiring caution, melancholy, severity, or obsessive focus
- a blood-dominant life drawing warmth, appetite, social movement, or reckless generosity

These are not meant to be the "main plot" of chargen. They are secondary accents that make
two otherwise similar life paths diverge.

### Authoring guidance

Results on `Your Nature` tables should generally be:

- self-contained
- flavorful
- readable as expressions of aptitude or temperament
- valid as one-off life incidents even without supporting context

They should usually grant one or more of:

- a ChangeSet
- a small persistent trait
- a contact or social consequence
- a drive or biography mark
- a skill, stat, or occult leaning if the table's theme supports it

They should usually avoid:

- long transition chains
- mandatory career changes
- heavy dependence on a prior named event
- outcomes that only make sense as explicit callbacks

## Part 4 - Advancement

Advancement is the final player-shaping phase after the life-path material has resolved.

Here the emphasis changes from "what happened?" to "what does this person now bring into
play?" The player is given directed choices to refine the character into a playable
adventurer.

The current implementation shape is a post-career wizard that presents:

- stat picks
- skill picks
- maneuver or alternative reward picks

Design intent:

- the life path should still matter more than optimization
- the player should leave chargen with meaningful final agency
- advancement should complete the character, not rewrite them

## Data and authoring model

At a high level, chargen content is authored as a web of random tables and choice items.

- **Life-path tables** drive the main sequence of choices.
- **Past-return hooks** carry deferred callbacks.
- **Your Nature** adds one balanced selector table plus eleven destination tables.
- **Advancement** remains a guided manual-choice layer rather than another random-table pass.

`Your Nature` results should preferably grant authored ChangeSets or other already-supported
chargen effects so that they compose with the existing actor-derivation model instead of
inventing a separate persistence mechanism.

## Rulings

- `Your Nature` begins at **adolescence**, not birth or childhood. It represents qualities
  surfacing through a life already underway.
- `Your Nature` ends at **retirement**, because it is still part of the pre-adventuring life
  history, not campaign advancement.
- Qualification for a stat table is checked against the actor state **as it exists when that
  life step is processed**, not against the actor's initial state.
- The stat-table threshold is **`1d6+2`** (2 steps, counting both dice and modifier), not a
  raw die count, so a character with one die but a built-up modifier can still qualify.
- Qualification for a humour table is based on whether the actor currently has that humour's
  flag.
- A trigger that fails qualification produces **no compensation** and **no substitute roll**.
- `Your Nature` results are isolated one-offs; they do not create a four-step reveal pattern.

## Out of scope

- Re-rolling failed `Your Nature` selector results.
- Filtering the selector table to only currently eligible destinations.
- Turning `Your Nature` into a guaranteed progression track.
- Making `Your Nature` depend on hidden scoring beyond the visible stat and humour checks.
- Replacing `The Past Returns`; the two phases are intentionally different.
