# 1547 Core — Manual Test Plan

Single living checklist for the live/Foundry-coupled paths the Node suite can't
cover. **Reset to a clean state (unchecked, no carried-over notes) each release;**
the version line below is auto-stamped by `release.ps1`. **Regression** = verifies
a fix/feature from a recent release.

_Current target: 1547core 0.3.112._

## Setup
- [ ] Update to the current **1547core** build, reload the world (GM).
- [ ] Run **Game Settings -> 1547 Core -> Setup Data**.
- [ ] Keep the browser console (F12) open — "no `1547core | ... failed` / no red errors" is an implicit pass condition for every step.

---

## 1. Load & Setup Data
- [ ] World loads with no `1547core | ... failed` errors; exactly **one** `CHARGEN.JS LOADED FROM ...` line.
- [ ] Setup Data reports counts and finishes without uncaught errors.
- [ ] No `No Base ChangeSet found for type "..."` warnings for **any** wired type — including the renamed **Spirit** (was NatureSpirit). **Regression.**
- [ ] A wired base monster (Beast/Undead) has a **Base**-group ChangeSet and derived stats.

---

## 2. Item sheet actions
- [ ] **Spell** / **Supernatural Mark** / **Monster Magic** sheets -> **no** Actions panel / Resolve Effects button.
- [ ] Right-click a **spell** -> **Generate Ritual** works; right-click a **ritual** -> **Open Ritual Board** works.
- [ ] Actor-owned **Disease/affliction** -> **Treat** opens the cure board.

---

## 3. Character generation — **Regression** (inline prompts in the flipped bio panel; no dialogs)
- [ ] Run a full chargen start->finish; cards roll, choices apply, biography fills in.
- [ ] **Inline prompts flip the biography panel** (card-style rotation) to show the prompt — **no separate Dialog window** opens; the bio flips back after continuing.
- [ ] Inputs are **radios** (career picks, language award/upgrade, optional transition) or a **text box pre-filled** with a suggestion (drive / new language). There are **no confirm/cancel buttons**.
- [ ] **Confirm by clicking a chargen card** ("click to continue"); a cue shows over the cards and on the panel.
- [ ] The **option panel scrolls** for long lists (e.g. career increase picks).
- [ ] **Skip / decline** works: pick the "— Skip … —" radio, or clear the pre-filled text box, then click a card.
- [ ] **Language upgrade** applies read/write to the **chosen** language (not index 0).
- [ ] **Career-advancement wizard:** stat -> skill -> maneuver/alternative picks appear **in sequence** (each flips in); "Skip" ends the wizard with the "ended early" bio line.
- [ ] **Drives:** add (pre-filled textarea + cause hint) and remove (radio list) update the actor's Drives.
- [ ] **Optional transition:** two radios ("Take the New Path" / "Remain Where You Are"); both resume the flow correctly.
- [ ] Closing the chargen window while a prompt is open -> no console error.
- [ ] **External drive callers still use a Dialog:** trigger a failure effect and a social-battle drive prompt -> these open the original **Dialog** (not the inline panel).
- [ ] **Regression (v13 rolls):** no `Roll#evaluate ... async option ... removed` error; chargen does not stall on a card.
- [ ] **Regression (HP):** finished character has **full HP** (Current = Max), not 0.
- [ ] **Regression (weighted picks):** rewards vary across runs (not always the last option).
- [ ] (If used) Batch **simulation** runs headless with **no inline panel ever shown** and renders summary stats.

---

## 4. Actor sheets & monster wizard
- [ ] **Composition gating:** a **player character** sheet shows **no** Composition panel; a **typed monster** sheet **does**. _(Requires Setup Data.)_
- [ ] **Monster wizard:** creates a **real monster** (`character` actor in Monsters), **not** a `_template`, with its Base chassis auto-applied.
- [ ] **Spirit type (Regression — renamed from NatureSpirit):** the monster wizard lists **Spirit**; creating one applies the **Spirit Base** chassis; the actor sheet's **Actor Type** dropdown offers **Spirit**.

---

## 4b. Side assignment & side initiative — **Regression**
- [ ] **Co-op (players + at least one NPC):** two+ players start a combat with a monster present → **all players share one side**; hostile NPCs oppose them. Players are NOT split against each other.
- [ ] **Duel (players only, no NPCs):** two players start a combat with no NPC → they land on **different sides** (Team 1 vs Team 2). 3+ players-only → alternate across the two teams.
- [ ] Each player's own tokens always stay **on that player's side**; a single player + NPCs behaves as before (disposition default).
- [ ] **Begin Combat** posts a public **"Side Initiative"** chat message (3d6 per side) and the **side turn order follows the roll** (highest first), not always Team 1 → Team 2.
- [ ] Side order stays **fixed** across rounds (no re-roll); adding a combatant mid-combat doesn't reshuffle the rolled order. **Tied side rolls re-roll** until distinct.

---

## 5. Combat HUD
- [ ] Token select -> HUD renders; hover/target/rotate mid-combat -> no console errors; buttons stay clickable.
- [ ] **Ammo weapon:** ammo chip + profile switch + fire -> correct ammo; loading loads **one** round.
- [ ] Attack with maneuver/staged + ammo dice -> rolled pool matches HUD preview.

---

## 6. Reactions & monster stats
- [ ] Overwatch/free counterattack does **not** pop a fresh reaction window against the original attacker.
- [ ] A movement reaction nobody is prompted for does **not** silently consume that reactor's movement reaction.
- [ ] **One reaction per round (Regression):** after a token **uses** a reaction (movement OR attack), it gets **no further reaction window** that round — neither a later attack against it nor another opponent's movement prompts it again.
- [ ] **Movement offer is per-opponent:** **passing** a movement reaction on opponent A still lets the token react to opponent B's movement, or to an incoming attack, later that round (the pass didn't spend the reaction).
- [ ] You are **not** offered a reaction on **your own** side's turn, and a reaction-generated free attack does **not** itself open a reaction window (no react-to-a-reaction).
- [ ] **Social Battle** / **Disease -> Treat** vs a **monster** read stat dice/mods correctly (not 0).
- [ ] Boosting a monster with a natural weapon/armor applies the weapon-die/armor-die boost.

---

## 7. Cross-client (second client)
- [ ] GM edits a **ChangeSet** on an actor a **player** has open -> the player's derived values update **without** reload.

---

## Known issues (expected — not test failures)
- **CharacterSheetV2 close error** — closing some actor sheets throws `You must provide an _id for every object in the update data Array` (a CSB dynamic-table form-submit issue, seen with the corrupt/duplicate Zone Base). **Open — under investigation.**
- **Duplicate "Zone Base"** in an existing world is a stale orphan (earlier seed, different `_id`); source/packs have one. Setup does not prune orphaned actors — delete the orphan manually (keep id `MonBaseZone0001`).
- **move-remaining** stat on monsters is the per-turn movement budget on the shared actor template — intentional.

---

## Pass criteria
- [ ] Every checked item behaves as described.
- [ ] Console clean of `1547core` errors throughout.

When a case fails, capture the **console error + the step** (and a **Run Diagnostics** dump if relevant).
