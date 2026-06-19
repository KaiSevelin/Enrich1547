# 1547 Core — Manual Test Plan

Single living checklist for the live/Foundry-coupled paths the Node suite can't
cover. **Reset to a clean state (unchecked, no carried-over notes) each release;**
the version line below is auto-stamped by `release.ps1`. **Regression** = verifies
a fix from a recent release.

_Current target: 1547core 0.3.102._

## Setup
- [ ] Update to the current **1547core** build, reload the world (GM).
- [ ] Run **Game Settings → 1547 Core → Setup Data** (so updated templates/packs apply to the world — required for the Composition-panel gating below).
- [ ] Keep the browser console (F12) open — "no `1547core | … failed` / no red errors" is an implicit pass condition for every step.

---

## 1. Load & Setup Data
- [ ] World loads with no `1547core | … failed` errors.
- [ ] Exactly **one** `CHARGEN.JS LOADED FROM …` line appears (not two).
- [ ] Setup Data reports loaded counts and finishes without uncaught errors.
- [ ] No `No Base ChangeSet found for type "…"` warnings for wired types (Beast, Undead, Construct, …). _(NatureSpirit excepted — see Known Issues.)_
- [ ] A wired base monster (e.g. **Beast**, **Undead**) has a **Base**-group ChangeSet attached and derived stats populated.

---

## 2. Item sheet actions — **Regression** (bug #8 buttons removed)
- [ ] **Spell** item sheet → **no "Actions" panel**, no Cast Spell / Resolve Effects / Generate Ritual buttons.
- [ ] **Supernatural Mark** and **Monster Magic** sheets → no Resolve Effects button.
- [ ] Right-click a **spell** in the directory → **Generate Ritual** works (creates a ritual).
- [ ] Right-click a **ritual** → **Open Ritual Board** works (the casting flow).
- [ ] Actor-owned **Disease/affliction** → **Treat** button opens the cure board.

---

## 3. Character generation
- [ ] Run a full chargen start→finish; cards roll, choices apply, biography fills in.
- [ ] **Regression (v13 rolls):** no `The async option for Roll#evaluate has been removed` error in the console; chargen does **not** stall on a card.
- [ ] **Regression (HP):** the finished character has **full HP** (Current HP = Max HP), not 0.
- [ ] **Regression (UI lockup):** the **final** roll's last choice does not freeze the UI — continue/finish still work.
- [ ] **Regression (weighted picks):** across several runs, rewards vary — not always the same/last option.
- [ ] **Regression (legacy template):** a legacy single-reward table (Effect1-style + NextTable) parses with no console `ReferenceError`.
- [ ] (If used) Batch **simulation** runs and renders summary stats.

---

## 4. Actor sheets & monster wizard
- [ ] **Regression (Composition gating):** a **player character** sheet shows **no** Composition panel; a **typed monster** sheet **does**. _(Requires Setup Data to have re-applied the template.)_
- [ ] **Regression (monster wizard):** the wizard creates a **real monster** (a `character` actor in the Monsters folder), **not** a `_template`, and its Base chassis is auto-applied.

---

## 5. Combat HUD
- [ ] Select a token → HUD renders. Hover/target other tokens and rotate a token mid-combat → no console errors; buttons stay clickable.
- [ ] **Ammo weapon:** pick an ammo chip, switch profile, fire → correct ammo used; loading ammo loads **one** round.
- [ ] Attack with **maneuver/staged dice + ammo dice** → the rolled pool matches the HUD preview.

---

## 6. Reactions & monster stats
- [ ] **Regression (reaction recursion):** an overwatch / free counterattack resolves but does **not** pop a fresh reaction window against the original attacker.
- [ ] **Regression (movement economy):** a movement reaction nobody is actually prompted for does **not** silently consume that reactor's movement reaction for the round.
- [ ] **Regression (monster stats):** **Social Battle** and **Disease → Treat** against a **monster** read its stat dice/mods correctly (not 0).
- [ ] **Regression (boost):** boosting a monster with a natural weapon/armor a few times applies the weapon-die/armor-die boost to it.

---

## 7. Cross-client (needs a second connected client)
- [ ] **Regression (derived-state cache):** as GM, add/edit a **ChangeSet** on an actor a **player** has open → the player's sheet/derived values update **without** a reload.

---

## Known issues (expected — not test failures)
- **NatureSpirit** isn't wired into the ForType system (no `ForType_NatureSpirit` on its changesets), so it's absent from the monster wizard and its base isn't auto-applied. Separate content task.
- **Duplicate "Zone Base"** in an existing world is a stale orphan from an earlier seed (different `_id`); source/packs have one. Setup upserts by `_id` and does not prune orphaned actors, so delete the orphan manually (keep the one with id `MonBaseZone0001`).
- The **move-remaining** stat on monsters is the per-turn movement budget on the shared actor template — intentional, shows on all actors.

---

## Pass criteria
- [ ] Every checked item behaves as described.
- [ ] Console clean of `1547core` errors throughout.
- [ ] No `No Base ChangeSet found` warnings for wired types (NatureSpirit excepted).

When a case fails, capture the **console error + the step** (and a **Run Diagnostics** dump if relevant).
