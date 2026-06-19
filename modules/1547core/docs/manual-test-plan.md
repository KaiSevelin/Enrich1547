# 1547 Core — Manual Test Plan

Single living checklist for the live/Foundry-coupled paths the Node suite can't
cover. **Reset to a clean state (unchecked, no carried-over notes) each release;**
the version line below is auto-stamped by `release.ps1`. **Regression** = verifies
a fix/feature from a recent release.

_Current target: 1547core 0.3.105._

## Setup
- [ ] Update to the current **1547core** build, reload the world (GM).
- [ ] Run **Game Settings -> 1547 Core -> Setup Data**.
- [ ] Keep the browser console (F12) open — "no `1547core | ... failed` / no red errors" is an implicit pass condition for every step.

---

## 1. Load & Setup Data
- [ ] World loads with no `1547core | ... failed` errors; exactly **one** `CHARGEN.JS LOADED FROM ...` line.
- [ ] Setup Data reports counts and finishes without uncaught errors.
- [ ] No `No Base ChangeSet found for type "..."` warnings for wired types (NatureSpirit excepted — see Known Issues).
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

---

## 5. Combat HUD
- [ ] Token select -> HUD renders; hover/target/rotate mid-combat -> no console errors; buttons stay clickable.
- [ ] **Ammo weapon:** ammo chip + profile switch + fire -> correct ammo; loading loads **one** round.
- [ ] Attack with maneuver/staged + ammo dice -> rolled pool matches HUD preview.

---

## 6. Reactions & monster stats
- [ ] Overwatch/free counterattack does **not** pop a fresh reaction window against the original attacker.
- [ ] A movement reaction nobody is prompted for does **not** silently consume that reactor's movement reaction.
- [ ] **Social Battle** / **Disease -> Treat** vs a **monster** read stat dice/mods correctly (not 0).
- [ ] Boosting a monster with a natural weapon/armor applies the weapon-die/armor-die boost.

---

## 7. Cross-client (second client)
- [ ] GM edits a **ChangeSet** on an actor a **player** has open -> the player's derived values update **without** reload.

---

## Known issues (expected — not test failures)
- **CharacterSheetV2 close error** — closing some actor sheets throws `You must provide an _id for every object in the update data Array` (a CSB dynamic-table form-submit issue, seen with the corrupt/duplicate Zone Base). **Open — under investigation.**
- **NatureSpirit** isn't wired into the ForType system -> absent from the monster wizard, base not auto-applied. Separate content task.
- **Duplicate "Zone Base"** in an existing world is a stale orphan (earlier seed, different `_id`); source/packs have one. Setup does not prune orphaned actors — delete the orphan manually (keep id `MonBaseZone0001`).
- **move-remaining** stat on monsters is the per-turn movement budget on the shared actor template — intentional.

---

## Pass criteria
- [ ] Every checked item behaves as described.
- [ ] Console clean of `1547core` errors throughout.

When a case fails, capture the **console error + the step** (and a **Run Diagnostics** dump if relevant).
