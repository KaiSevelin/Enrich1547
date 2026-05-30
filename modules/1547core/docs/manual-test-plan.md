# 1547 Core — Manual Test Plan

Covers the Foundry-coupled paths the Node test suite (`npm test`) cannot exercise:
the live HUD, item-sheet actions, document CRUD, roll tables, and the diagnostics
button. This-session fixes are flagged **Regression**.

_Current target: 1547core 0.2.22._

## Prerequisites

- Foundry VTT (v11–v13; verified 13.350) running the **Custom System Builder** system.
- Modules enabled: **dice1547** (required dependency) and **1547core**.
- A throwaway GM world with a scene and a few tokens.
- Browser dev console open (F12) for every test — "no console errors" is an implicit pass condition throughout.

---

## A. Load & wiring

### A1 — Clean init/ready
1. Launch the world, log in as GM.
2. Watch the console through `init` and `ready`.

**Expected:** No `1547core | … failed` errors and no uncaught exceptions. `game.modules.get("1547core").api` exists and exposes `diagnostics`, `summarizeActor`, `resolveUsageEffectsFromCarrier`, and the spell/ritual helpers.

--- OK

## B. Data setup & overwrite (source-of-truth)

### B1 — First Setup Data
1. Game Settings → **1547 Core** menu → **Setup Data**.

**Expected:** Notification reports the loaded counts. Managed folders appear under Items / Actors / RollTables. "Last Setup" timestamp updates.
OK

### B2 — Re-run overwrites, doesn't duplicate
1. Rename a managed item (e.g. a seeded weapon), then run **Setup Data** again.

**Expected:** The edit is overwritten back to source values; **no duplicate** is created; counts unchanged.
OK

### B3 — Prune
1. Run Setup Data again and inspect the managed folders.

**Expected:** Managed-folder content matches source; nothing orphaned or duplicated.
OK
---

## C. Diagnostics button (new feature)

### C1 — Basic dump
1. Settings → 1547 Core → **Run Diagnostics** (no token selected).

**Expected:** A dialog shows formatted JSON (also logged to console and copied to clipboard). Sections present: `environment`, `seedData`, `worldContent`, `tableResolution`, `tokens`. `errors` is empty; `tokens.controlledCount`/`targetedCount` = 0.
OK

### C2 — `tableResolution` is clean — **Regression** (rolltable key resolution)
1. After Setup Data, inspect `tableResolution` in the dump.

**Expected:** `ritualStepTables.unresolved` and `failureTables.unresolved` are both empty.
OK

### C3 — Single-actor
1. Select one token → Run Diagnostics.

**Expected:** `tokens.controlled[0].hudSummary` is populated (no `hudSummaryError`).
OK

### C4 — Multi-actor (source + target)
1. Select an attacker token; **target** a different token (T). Run Diagnostics.

**Expected:** `tokens.controlled` holds the attacker and `tokens.targeted` holds the defender, each with its own `hudSummary`. Selecting 2+ tokens puts all of them in `controlled`.
OK
---

## D. HUD rendering — **Regression** (ReferenceError fixes)

### D1 — Equipped weapon
1. Give an actor a seeded weapon, equip it, control its token.

**Expected:** HUD renders weapon/armor/attack info with **no `ReferenceError` / `SOURCE_FLAG_SCOPE` is not defined** error. _(Previously crashed `summarizeActor`.)_
OK

### D2 — Attached modifier names
1. Attach a weapon modifier to the equipped weapon (see E1); control the token.

**Expected:** The modifier name appears in the weapon's HUD summary; no error.
Logger.js:39 Custom System Builder | Item template has been deleted for item Poisoned - Scene.jwk6hs21SMkhoDT8.Token.eMJiRILuUGXZhpYA.Actor.BLuivuopMTDw9dAb.Item.0m2Cthmno3THsfvI used in Dagger - Scene.jwk6hs21SMkhoDT8.Token.eMJiRILuUGXZhpYA.Actor.BLuivuopMTDw9dAb.Item.q5nTVe6d08OeOUMh
### D3 — Ammo with AddDice
1. Equip a ranged weapon and load ammo whose `AddDice` is set via the string prop (not the `sourceData.addDice` array).

**Expected:** HUD shows the loaded-ammo add-dice with **no `getStringProp is not defined`** error. _(Regression: `getAmmoAddDice` fix.)_
When I reload it says Reloaded crossbow with bolt, but loaded ammo is none
---

## E. Weapon-modifier attachment

> The "Attached Modifiers" surface is a **CSB-native `itemContainer`** on the WeaponTemplate / AmmunitionTemplate (filtered to WeaponModifierTemplate). Rows open each modifier's sheet, and a **Uses remaining** column reads from `system.props.UsesRemaining`. The consume path decrements both the legacy `flags["1547Core"].usesRemaining` and the prop; when uses hit 0 the modifier item is deleted and CSB drops the row. The combat resolver unions flag-based and `system.container`-based attachments, so drops directly into the container are honoured. As of **0.2.22**, on-hit effects are first-class items (`OnHitEffectTemplate`) shown in an `itemContainer` on each WeaponModifier sheet: child items with `system.container = modifier.id` carry the per-effect props (TriggerMode, ArmorInteraction, Resolution, SourceCheck/TargetCheck/Difficulty, DamageType/Amount/Qualifiers, ApplyStatus/Tag, Notes). Combat normalisation reads the effects from those child items (falling back to the legacy JSON prop for unmigrated worlds). A `createItem` hook auto-seeds child effects from `source.onHitEffects` on modifier creation, and `runContainerMigration` backfills existing actor modifiers. Re-run **Setup Data** after upgrading so the new template ships and the modifier sheet picks up the new container component.

### E1 — Drop auto-attaches
1. Drag a seeded weapon-modifier item onto an actor that owns a weapon.
2. Open the target weapon's item sheet.

**Expected:**
- The weapon sheet shows the **"Attached Modifiers"** itemContainer with one row per attached modifier. Rows are CSB-native (clickable, deletable).
- Clicking a row **opens the modifier item's sheet** — the "Uses remaining" field shows the current count.
- If the modifier source has `durationType: "Uses"` and `durationValue: N`, the row's **Uses remaining** column shows `N` on the first attach.
- The HUD weapon row shows the modifier in `weaponModifierNames`.
- Console verification (optional):
  ```js
  const a = canvas.tokens.controlled[0].actor;
  const w = a.items.find(i => i.name === "Dagger");
  console.log("flag ids:", w.flags["1547Core"].attachedModifierIds);
  console.log("contained:", a.items.contents.filter(i => i.system?.container === w.id).map(i => `${i.name} (${i.system?.props?.UsesRemaining ?? "—"})`));
  ```

### E2 — Stack replace
1. With one modifier already attached (E1), drag a second modifier that has the **same `stackKey`** onto the actor.
2. Re-open the target weapon's sheet.

**Expected:**
- The "Attached Modifiers" panel still lists exactly one modifier — the **new** one replaces the previous same-key modifier; other (different-key) modifiers are preserved.
- `attachedModifierIds` and the summary both reflect the new state.

### E3 — Multi-use decrement and auto-removal — **Regression** (0.2.17 lifecycle)
1. Attach a modifier whose source data has `durationType: "Uses"` and `durationValue: 3`.
2. Perform attacks that trigger the modifier's `onHitEffects` (e.g. an `automatic` rider with damage).
3. After **each** attack, re-open (or re-render) the weapon sheet and watch the panel.

**Expected:**
- After attack 1: the row's **Uses remaining** column shows `2`. The modifier item still exists on the actor.
- After attack 2: column shows `1`.
- After attack 3: the modifier item is **deleted from the actor**; the container row vanishes (CSB removes it because `system.container` no longer resolves).
- The HUD's "Modifiers" row mirrors the same lifecycle.
---
After an attack with poisoned, the usesRemaining is not updated.

## F. Combat on-hit effects — **Regression** (`save` resolution)

### F1 — `automatic` rider
1. On a weapon modifier, add an on-hit effect: `resolution: "automatic"`, `damageAmount: 1`, `applyStatus: "Weakened"`. Attack a defender and apply damage.

**Expected:** Secondary damage + status applied; chat/HUD reflects it.

Attack Result
Spelare 1 -> Spelare 2
Damage: 0
Protection: 0
Applied: 1
Critical: 4
HP: null / was 3

### F2 — `contest` rider
1. `resolution: "contest"`, `sourceCheck: "source Dexterity"`, `targetCheck: "target Stamina"`. Attack where attacker Dexterity ≥ defender Stamina.

**Expected:** Rider fires. Reverse the stat advantage → rider does **not** fire.

### F3 — `save` rider (the fix)
1. `resolution: "save"`, `sourceCheck: ""`, `targetCheck: "target Power"`, `difficulty: 5`. Attack a defender whose Power < 5.

**Expected:** Rider **fires**. _(Previously never fired.)_ Raise the defender's Power above the difficulty → rider is resisted (does not fire).

No save is done
---

## G. Spell casting — **Regression** (failure table)

### G1 — Cast success
1. Open a seeded spell item → header **Cast Spell**, with a controlled caster token that meets the requirements.

**Expected:** A casting summary posts to chat; usage effects resolve (see H).

### G2 — Cast failure rolls a real table
1. Cast a spell whose requirements aren't met (or otherwise force failure).

**Expected:** A spell-failure result is drawn and shown — **not** "No failure table 'SpellFailure_Minor' could be found."

---

## H. Usage-effect resolution

### H1 — Resolve Effects with target / range
1. On a spell, supernatural-mark, or monster-magic item that carries usage effects: control the source token, target a valid token, click header **Resolve Effects**.

**Expected:** Effects apply per mode — DirectDataChange updates props, CreateActiveEffect adds an effect, GrantItem grants an item, Remove deletes matching effects. A chat summary lists each effect, its outcome, and target. Out-of-range / no-target cases report gracefully (no throw).

---

## I. Generate Ritual — **Regression** (ritual table)

### I1 — Generate from spell
1. Open a seeded spell that has a `RitualStepTable` (e.g. references `RitualSteps_Hard`) → header **Generate Ritual**.

**Expected:** A Ritual item is created with the spell's static steps **plus rolled random steps** — **not** "Could not resolve ritual step roll table 'RitualSteps_Hard'."

---

## J. Upgrade / migration

### J1 — Existing world upgrade
1. Open a world created on an older 1547core build, then enable the current version.

**Expected:** `ready` migrations run without error. Running **Setup Data** overwrites managed content to the new schema; items that used the old recipe/power templates are replaced/repointed (source-of-truth overwrite), with no orphans.

---

## Pass criteria

- Every **Expected** result met.
- Console clean of `1547core` errors.
- A **Run Diagnostics** dump with empty `tableResolution.unresolved` and an empty `errors` array.

When a case fails, the most useful thing to capture is the **Run Diagnostics** JSON plus the console error — together they describe the live state needed to diagnose it.
