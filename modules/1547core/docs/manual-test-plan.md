# 1547 Core — Manual Test Plan

Single living checklist for the live/Foundry-coupled paths the Node suite can't
cover. **Update the version line + any changed steps on each release.**
**Regression** = verifies a fix from a recent release.

_Current target: 1547core 0.3.101._

## Setup
- [ ] Update to the current **1547core** build, reload the world (GM).
- [ ] Run **Game Settings → 1547 Core → Setup Data** (so updated templates/packs apply to the world).
- [ ] Keep the browser console (F12) open — "no `1547core | … failed` / no red errors" is an implicit pass condition for every step.

---

## 1. Load & Setup Data
- [ ] World loads with no `1547core | … failed` errors.
- [ ] Exactly **one** `CHARGEN.JS LOADED FROM …` line appears (not two). _(HUD double-registration guard.)_
- [ ] Setup Data reports loaded counts and finishes without uncaught errors.
- [ ] **Regression (Base ChangeSet reconcile):** no `No Base ChangeSet found for type "…"` warnings for the wired types (Beast, Undead, Construct, …).
  - [ ] _Known-open:_ `NatureSpirit` **is expected to still warn** — it isn't wired into the ForType system yet (see Known Issues).
- [ ] Open a wired base monster (e.g. **Beast**, **Undead**) → it has a **Base**-group ChangeSet attached and derived stats populated.

---

## 2. Item sheet actions — **Regression** (bug #8 buttons removed)
- [ ] Open a **Spell** item → there is **no "Actions" panel** and **no** Cast Spell / Resolve Effects / Generate Ritual buttons on the sheet.
- [ ] Open a **Supernatural Mark** and a **Monster Magic** item → likewise **no** Resolve Effects button on the sheet.
- [ ] Right-click a **spell** in the Items directory → **Generate Ritual** is offered and works (creates a ritual in the Rituals folder).
- [ ] Right-click a **ritual** → **Open Ritual Board** is offered and opens the board (this is the casting flow).
- [ ] Actor-owned **Disease/affliction** item → **Treat** button still opens the cure board. _(Regression: dead code removed; label-button retained.)_

---

## 3. Character generation
- [ ] Run a full chargen start→finish; cards roll, choices apply, biography fills in.
- [ ] **Regression (HP):** the finished character has **full HP** (Current HP = Max HP), not 0.
- [ ] **Regression (UI lockup):** on the **final** roll, the last choice does **not** freeze the UI — continue/finish still work.
- [ ] **Regression (weighted picks):** across several runs, rewards vary — not always the same/last option.
- [ ] **Regression (legacy template):** drawing a legacy single-reward table (Effect1-style with a NextTable) parses with **no console `ReferenceError`**.
- [ ] (If used) Batch **simulation** runs and renders summary stats.

---

## 4. Actor sheets — **Regression** (Composition gating)
- [ ] Open a **player character** sheet → the **Composition / tier badge is NOT shown**.
- [ ] Open a **typed monster** sheet → the Composition / tier badge **is** shown.

---

## 5. Combat HUD
- [ ] Select a token → HUD renders. Hover/target other tokens and rotate a token mid-combat → no console errors; buttons stay clickable.
- [ ] **Ammo weapon:** pick an ammo chip, switch profile, fire → correct ammo used; loading ammo loads **one** round.
- [ ] Attack with **maneuver/staged dice + ammo dice** → the rolled pool matches the HUD preview. _(Regression: weapon roll context.)_

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
- **NatureSpirit** isn't wired into the ForType system (no `ForType_NatureSpirit` on its changesets), so it's absent from the monster wizard and its base isn't auto-applied. Tracked as a separate content task.
- A duplicate **"Zone Base"** may appear in an existing world's Monsters folder (stale seeding artifact); source has only one. Delete the orphan if present.
- The **move-remaining** stat on monsters is the per-turn movement budget on the shared actor template — intentional, shows on all actors.

---

## Pass criteria
- [ ] Every checked item behaves as described.
- [ ] Console clean of `1547core` errors throughout.
- [ ] No `No Base ChangeSet found` warnings for wired types (NatureSpirit excepted).

When a case fails, capture the **console error + the step** (and a **Run Diagnostics** dump if relevant).
