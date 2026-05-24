# Equipment And Dice Schema Spec V1.1

## Purpose

This document defines the canonical stored-data vocabulary for:

- combat dice families
- weapon traits
- armor traits
- ammunition item data
- weapon item data
- armor item data

It exists so `1547Core` can keep equipment content, Foundry item data, and
combat resolution aligned around one stable model.

## Core Principle

Stored equipment data must match the current combat engine.

That means the schema should describe:

- the same canonical dice families used by combat resolution
- the same ordered dice pools consumed by the runtime
- the same item fields that Foundry weapon and armor content already needs

If the runtime changes later, the schema can evolve. For now, the schema should
not describe a more advanced weapon model than the engine actually resolves.

## Canonical Dice Families

The canonical dice families are:

- `Balanced`
- `Grace`
- `Heavy`
- `Penetration`
- `Lethality`
- `Control`
- `Armor`
- `Evade`
- `Risk`
- `Multiplier`

## Foundry Dice Term Mapping

The canonical Foundry dice-term mapping is:

- `a` = `Armor`
- `b` = `Balanced`
- `c` = `Control`
- `e` = `Evade`
- `g` = `Grace`
- `h` = `Heavy`
- `l` = `Lethality`
- `p` = `Penetration`
- `r` = `Risk`
- `x` = `Multiplier`

Example:

```text
1db + 1df + 1dh
```

rolls:

- `Balanced`
- `Grace`
- `Heavy`

## Dice Representation Layers

`1547Core` uses two related but distinct dice representations:

- content/schema representation
- runtime roll-formula representation

The content/schema representation uses canonical family names:

```js
["Balanced", "Grace", "Heavy"]
```

The runtime roll-formula representation uses Foundry custom dice terms:

```text
1db + 1df + 1dh
```

Conversion between these two layers should be deterministic and lossless.

## Dice Family Definitions

### `Balanced`

Standard weapon die family.

### `Grace`

High-control and highly maneuverable weapon die family.

This is the canonical name for older content that used `Precise`.

### `Heavy`

Powerful and unwieldy weapon die family.

### `Penetration`

Piercing weapon die family.

### `Lethality`

High-power damage die family.

### `Control`

Low-damage, high-control die family.

### `Armor`

Armor protection die family.

### `Evade`

Unarmored or lightly protected defense die family.

This is the canonical name for older content that used `Unprotected`.

### `Risk`

Risk die family used when stored `RiskPoints` convert into roll pressure.

### `Multiplier`

Multiplier die family used for damage escalation and similar effects.

## Canonical Stored Weapon Traits

The canonical stored weapon traits are:

- `Aiming`
- `Armor Breaking`
- `Bracing`
- `Charging`
- `Control`
- `Disarming`
- `Fast`
- `Fragile`
- `Heavy`
- `Hooking`
- `Narrow`
- `Parrying`
- `Point Blank`
- `Receiving`
- `Reloading`
- `Shield`
- `Small Shield`
- `Tactical`

These are the traits that should exist in persisted weapon data and Foundry item
content today.

## Derived Or Descriptive Weapon Labels

The following labels may still be useful in rules text, UI, or future content,
but they should not be treated as required persisted weapon traits in v1.1:

- `Reach`
- `Long Reach`
- `Needs Space`
- `Versatile`

Why:

- reach logic should come from numeric reach fields
- some labels are currently inferred from weapon setup plus character skill
- keeping non-persisted labels out of the canonical stored trait list reduces
  import/export drift

## Canonical Armor Traits

The canonical armor traits are:

- `Encumbering`
- `Resistance`
- `Soft`
- `Very Soft`
- `Concealable`
- `Flexible`

Only traits that materially affect battle rules or legality should be kept in
the long-term schema.

## Canonical Equipment Rules

### Shields

Shields belong in weapon content, not armor content.

That means:

- shields should live with weapons
- shield defense benefits come from weapon traits and maneuvers
- shields are not modeled as worn armor entries

### Reach

Reach uses explicit numeric minimum and maximum values, not a single text field.

Canonical reach model:

- `minReach`
- `maxReach`

Meaning:

- `minReach: 1`, `maxReach: 1` threatens adjacent legal squares only
- `minReach: 2`, `maxReach: 2` threatens only at distance `2`
- `minReach: 2`, `maxReach: 3` threatens at distances `2` and `3` but not
  adjacent squares

Trait-like labels such as `Reach` and `Long Reach` may exist as descriptive UI
tags, but threat and legality logic should read the explicit numeric fields.

### Ranged Range Bands

Ranged weapons should use explicit range bands distinct from melee reach.

Canonical ranged range model:

- `shortRange`
- `longRange`
- `maxRange`

Meaning:

- attacks at distance `<= shortRange` are normal
- attacks at distance `> shortRange` and `<= longRange` are legal but made with
  disadvantage
- attacks at distance `> longRange` and `<= maxRange` are not legal for normal
  direct attacks
- `maxRange` exists for special rules such as battlefield-area maneuvers

All range measurements use Chebyshev distance in squares.

### Ready And Equipped

Weapons should distinguish between:

- `equipped`
- `ready`

This matters for:

- disarm recovery
- draw actions
- reload handling
- legal attack availability

Armor only needs `equipped`.

### Reloading And Ammunition

Reload state belongs on weapon items.

Weapons that use loading or ammunition rules should track:

- whether they have the `Reloading` trait
- `reloadTime`
- `reloadProgress`
- `ready`
- `usesAmmo`
- `ammoType`
- `ammoCapacity`
- `ammoLoaded`

`reloadTime` and `reloadProgress` remain canonical even when ammo capacity is
also tracked, because reload pacing and loaded ammunition are related but not
identical concepts.

## Canonical Ammunition Rules

Ammunition modifies a weapon attack profile's single attacker resolution pool.

In v1.1:

- the weapon attack profile provides the base ordered `dice` pool
- the loaded ammo item may add more dice to that same pool
- the loaded ammo item may add tags or result modifiers
- the loaded ammo item may also narrow or override range behavior for that
  resolved attack
- attacker and defender still each roll one pool

This keeps ammunition compatible with the current simultaneous opposed
resolution model.

### Ammunition Lifecycle

In v1.1, ammunition identity is explicit when a weapon uses `loadedAmmoId`.

Recommended baseline lifecycle:

- the actor chooses a specific compatible ammo stack from inventory
- loading sets `loadedAmmoId` to that ammo item
- loading also updates `ammoLoaded` to reflect the number of loaded units
- changing ammo type swaps `loadedAmmoId` without consuming ammunition
- ammunition is consumed only when an attack is committed, not when declared

For the current content set, the default assumption should be:

- most ranged weapons that use ammunition have `ammoCapacity: 1`
- for those weapons, a committed attack consumes `1` unit
- after that committed attack, `ammoLoaded` becomes `0`
- after that committed attack, `loadedAmmoId` becomes `null`

This keeps ammo choice meaningful and avoids hidden auto-selection.

### Compatibility And Legality

When ammunition identity is tracked:

- `loadedAmmoId` should reference a real ammo item owned by the actor
- that ammo item must have `quantity > 0`
- that ammo item's `ammoType` must be compatible with the selected attack
  profile
- compatibility should be checked against `allowedAmmoTypes`
- if the selected attack requires ammo and no valid ammo is loaded, the attack
  is illegal

### Loading And Swapping

Loading ammunition is distinct from consuming ammunition.

In v1.1:

- loading chooses a stack
- swapping loaded ammo chooses a different stack
- neither loading nor swapping should reduce `quantity`
- quantity is reduced only by successful attack commitment

This lets players select `Broadhead Arrow` versus `Bodkin Arrow` explicitly
without spending ammo until the shot is actually resolved.

## Canonical Weapon Schema

Recommended weapon schema:

```js
{
  id,
  name,
  itemType: "weapon",
  category,
  weight,
  value,
  equipped,
  ready,
  minReach,
  maxReach,
  shortRange,
  longRange,
  maxRange,
  reloadTime,
  reloadProgress,
  usesAmmo,
  ammoType,
  ammoCapacity,
  ammoLoaded,
  loadedAmmoId,
  traits: [],
  attackProfiles: []
}
```

## Weapon Field Definitions

### `id`

Stable unique item identifier.

### `name`

Display name of the weapon.

### `itemType`

Must be `weapon`.

### `category`

High-level weapon family.

Examples:

- `Knife`
- `Blade`
- `Blunt`
- `Polearm`
- `Thrown`
- `Bow`
- `Crossbow`
- `Firearm`
- `Mounted`
- `Shield`
- `Unarmed`

### `weight`

Physical item weight.

### `value`

Economic item value.

### `equipped`

Whether the weapon is currently equipped.

### `ready`

Whether the weapon is currently ready for legal combat use.

### `minReach`

Minimum legal threat or attack distance.

Use `null` only when reach is not relevant to that item's threat logic.

### `maxReach`

Maximum legal threat or attack distance.

For ordinary adjacent weapons, `minReach` and `maxReach` should both be `1`.

### `reloadTime`

How many reload steps are required when the weapon reloads.

Default should be `0` for non-reloading weapons.

### `reloadProgress`

Current progress toward a ready state.

Default should be `0`.

### `shortRange`

Normal attack range band for ranged weapons, measured in squares.

Use `null` for weapons that do not use ranged range bands.

### `longRange`

Disadvantaged attack range band for ranged weapons, measured in squares.

Attacks beyond `shortRange` and up to `longRange` remain legal but are made with
disadvantage.

Use `null` for weapons that do not use ranged range bands.

### `maxRange`

Special extended range ceiling for ranged weapons, measured in squares.

This is not part of ordinary direct-fire legality. It exists for special rules
such as `Suppressing Fire` and `Volley Fire`.

Use `null` for weapons that do not use ranged range bands.

### `usesAmmo`

Whether the weapon consumes tracked ammunition.

Default should be `false`.

### `ammoType`

The ammunition family used by the weapon.

Examples:

- `Arrow`
- `Bolt`
- `Bullet`

Use an empty string only when `usesAmmo` is `false`.

### `ammoCapacity`

How many units of ammunition the weapon can hold while loaded.

Default should be `0` for weapons that do not use ammo.

### `ammoLoaded`

How many units of ammunition are currently loaded.

Default should be `0`.

For the current baseline:

- `ammoLoaded` should usually be `0` or `1`
- `ammoLoaded` should not decrease when ammo is merely swapped
- `ammoLoaded` should decrease when the committed attack spends ammo

### `loadedAmmoId`

Identifier of the currently loaded ammunition item when ammo identity matters.

Use `null` when:

- the weapon does not use ammo
- no ammunition is currently loaded
- ammo identity is not being tracked beyond count

When present, it should identify a specific compatible ammo stack owned by the
same actor.

### `traits`

Canonical stored weapon traits.

### `attackProfiles`

One or more named attack profiles for the weapon.

Recommended shape:

```js
[
  {
    id,
    name,
    attackType,
    dice: ["Balanced", "Heavy", "Control"],
    allowedAmmoTypes: [],
    tags: []
  }
]
```

In v1.1, `dice` is one ordered attack pool definition.

This is intentionally aligned with the current combat engine:

- attack profiles provide one ordered list of canonical dice families
- advantage duplicates the first die type in that ordered list
- maneuvers and effects may add or filter dice at runtime
- ammunition may add dice or result modifiers to that same attacker pool
- the schema does not use a separate stored to-hit pool

If the combat engine later gains a true separate attack-pool and damage-pool
workflow, the schema can be expanded in a future version.

## Weapon Example

```js
{
  id: "weapon-rapier",
  name: "Rapier",
  itemType: "weapon",
  category: "Blade",
  weight: 1.1,
  value: 14,
  equipped: false,
  ready: false,
  minReach: 1,
  maxReach: 1,
  shortRange: null,
  longRange: null,
  maxRange: null,
  reloadTime: 0,
  reloadProgress: 0,
  usesAmmo: false,
  ammoType: "",
  ammoCapacity: 0,
  ammoLoaded: 0,
  loadedAmmoId: null,
  traits: ["Parrying", "Disarming", "Fast", "Narrow"],
  attackProfiles: [
    {
      id: "thrust",
      name: "Thrust",
      attackType: "melee",
      dice: ["Grace", "Grace", "Balanced"],
      allowedAmmoTypes: [],
      tags: []
    },
    {
      id: "bind",
      name: "Bind",
      attackType: "melee",
      dice: ["Grace", "Control", "Balanced"],
      allowedAmmoTypes: [],
      tags: []
    }
  ]
}
```

## Canonical Ammunition Schema

Recommended ammunition schema:

```js
{
  id,
  name,
  itemType: "ammo",
  ammoType,
  quantity,
  addDice: [],
  tags: [],
  resultModifiers: []
}
```

## Ammunition Field Definitions

### `id`

Stable unique item identifier.

### `name`

Display name of the ammunition item.

### `itemType`

Must be `ammo`.

### `ammoType`

The ammunition family this item belongs to.

Examples:

- `Arrow`
- `Bolt`
- `Bullet`

### `quantity`

How many units of this ammunition item are currently available.

`quantity` should decrease only when ammunition is actually consumed by a
committed attack or another explicit spend rule.

### `addDice`

Ordered dice added to the attack profile's attacker pool when this ammunition
is used.

Example:

```js
["Penetration"]
```

### `tags`

Tags granted by the ammunition item for the resolved attack.

These may be consumed by maneuver legality, UI, or runtime combat rules.

### `resultModifiers`

Structured runtime effects granted by the ammunition item.

Recommended examples:

- `ignoreProtectionResult`
- `bonusCritCount`
- `addRiskOnUse`
- `cannotRecoverAmmo`
- `overrideRangeBand`

Most ammunition should use only `addDice` and optionally one or two simple
modifiers.

## Ammunition Examples

```js
{
  id: "ammo-broadhead-arrow",
  name: "Broadhead Arrow",
  itemType: "ammo",
  ammoType: "Arrow",
  quantity: 20,
  addDice: ["Lethality"],
  tags: [],
  resultModifiers: []
}
```

## Recommended Runtime Procedures

### Load Ammo

Recommended conceptual procedure:

```js
loadAmmo({ actor, weapon, ammoItem, profile }) {
  assert(weapon.usesAmmo === true);
  assert(ammoItem.quantity > 0);
  assert(profile.allowedAmmoTypes.includes(ammoItem.ammoType));

  weapon.loadedAmmoId = ammoItem.id;
  weapon.ammoLoaded = Math.min(weapon.ammoCapacity, 1);
}
```

### Swap Loaded Ammo

Recommended conceptual procedure:

```js
swapLoadedAmmo({ actor, weapon, ammoItem, profile }) {
  assert(weapon.usesAmmo === true);
  assert(ammoItem.quantity > 0);
  assert(profile.allowedAmmoTypes.includes(ammoItem.ammoType));

  weapon.loadedAmmoId = ammoItem.id;
}
```

Swapping should not reduce ammo quantity by itself.

### Consume Loaded Ammo

Recommended conceptual procedure:

```js
consumeLoadedAmmo({ actor, weapon, ammoItem }) {
  assert(weapon.usesAmmo === true);
  assert(ammoItem.quantity >= 1);

  ammoItem.quantity -= 1;
  weapon.ammoLoaded = Math.max(0, weapon.ammoLoaded - 1);

  if (weapon.ammoLoaded === 0) {
    weapon.loadedAmmoId = null;
  }
}
```

This procedure should happen on committed attack resolution, not on mere attack
declaration.

```js
{
  id: "ammo-bodkin-arrow",
  name: "Bodkin Arrow",
  itemType: "ammo",
  ammoType: "Arrow",
  quantity: 20,
  addDice: ["Penetration"],
  tags: ["Armor Breaking"],
  resultModifiers: [
    { type: "ignoreProtectionResult", value: 1 }
  ]
}
```

```js
{
  id: "ammo-scatter-shot",
  name: "Scatter Shot",
  itemType: "ammo",
  ammoType: "Bullet",
  quantity: 10,
  addDice: ["Multiplier"],
  tags: ["Short Range"],
  resultModifiers: [
    { type: "overrideRangeBand", value: "short" }
  ]
}
```

## Schema Versioning And Migration Contract

Every persisted equipment item in v1.1 must carry an explicit `schemaVersion`.
Weapons, ammunition, and armor share the same schema namespace and versioning
model.

Migration is explicit and item-local:

- import or content-load detects an older `schemaVersion` and applies the
  appropriate migration path for that single item
- each item migrates independently, so one bad item does not block unrelated
  items
- recoverable errors should be tolerated and the item should still be written
  back with as much valid data as possible
- fatal errors should be rare; only skip the item when it truly cannot be
  converted safely

Validation and error handling:

- unknown or non-canonical trait names are dropped and logged as errors
- unsupported dice-family values are dropped and logged as errors
- no legacy alias map is used; if migration does not convert an old trait,
  that trait is gone
- import should preserve as much content as possible while reporting issues in
  a plain log
- migration errors are not recorded on the item itself

Dice contract:

- the equipment schema stores canonical dice family names only
- a separate dice module owns runtime conversion to Foundry roll formulas
- if imported content contains both canonical dice arrays and legacy runtime
  roll-formula fields, prefer canonical families and ignore the runtime formula
- legacy runtime formulas may be converted only when a specific migration rule
  supports it; otherwise they are logged and dropped
- do not persist legacy runtime roll formulas in migrated items

Defaults and field creation:

- when a migration introduces a new required field, the migration should auto-fill
  it when a safe derived or schema-specific default exists
- if no safe default can be chosen, log the issue and skip the item only when
  the item is truly invalid
- the migration should remain forgiving and attempt to write every recoverable
  field

Recommended migration behavior:

- treat items without `schemaVersion` as legacy input and migrate them into the
  current `schemaVersion`
- detect the current item type from `itemType` and apply the correct weapon,
  ammo, or armor migration rules
- preserve valid item identifiers and content where possible
- rewrite migrated items in place; backups are out of scope for v1.1

This contract is intended to make schema evolution explicit, predictable, and
data-safe while keeping the system tolerant of partially invalid legacy data.

## Dice Pools — Functional Rules

Dice pools in v1.1 are intentionally simple, deterministic, and driven by the
stored canonical arrays. The runtime must preserve stored ordering and apply a
small set of deterministic transforms when building the final roll pools.

Rules

- Stored `dice` arrays in attack profiles are authoritative and must not be
  reordered by runtime rules.
- Advantage duplicates the first die family in the stored ordered `dice` list
  and inserts that duplicate at the front of the attacker pool.
- Ammunition `addDice` are always appended to the attack pool after advantage
  duplication and base attack dice.
- Defender pools use the stored `defenseDice` array. If no defense dice are
  present, the runtime should inject the unarmored fallback `["Evade","Evade","Evade"]`.
- `Multiplier` dice are retained in the pool but are applied as a post-roll
  multiplier to aggregated damage results rather than as direct additive faces.
- When attacker and defender pools differ in length, each side rolls its own
  pool and the resolution aggregates each side's results independently.
- Unknown or non-canonical dice families present in stored content are dropped
  during migration and logged; runtime code should assume migrated content is
  canonical.

Deterministic conversion

The runtime dice module is responsible for converting canonical family names
into Foundry custom-dice terms deterministically. Example mapping (v1.1):

```
Balanced -> 1db
Grace    -> 1dg
Heavy    -> 1dh
Penetration -> 1dp
Lethality -> 1dl
Control  -> 1dc
Armor    -> 1da
Evade    -> 1de
Risk     -> 1dr
Multiplier -> 1dx
```

Pseudocode

```
function buildAttackerPool(attackDice, advantage, ammoAddDice) {
  const pool = attackDice.slice();
  if (advantage && pool.length > 0) pool.unshift(pool[0]);
  return pool.concat(ammoAddDice || []);
}

function buildDefenderPool(defenseDice) {
  if (!Array.isArray(defenseDice) || defenseDice.length === 0) {
    return ["Evade","Evade","Evade"];
  }
  return defenseDice.slice();
}

function toFoundryFormula(diceArray) {
  return diceArray.map(d => mapping[d] ? `1d${mapping[d]}` : '').filter(Boolean).join(' + ');
}
```

Acceptance tests for pool-building should verify:

- advantage duplicates the first die and preserves stored order
- ammo `addDice` are appended
- multiplier dice remain in the pool but are applied post-roll
- unknown families are dropped during migration and logged

Place runtime-ready helpers in `scripts/combat/pool-builder.mjs` and unit
tests in `scripts/tests/pool-building.test.mjs`.

## Canonical Armor Schema

Recommended armor schema:

```js
{
  id,
  name,
  itemType: "armor",
  armorClass,
  weight,
  value,
  equipped,
  traits: [],
  defenseDice: []
}
```

## Armor Field Definitions

### `id`

Stable unique item identifier.

### `name`

Display name of the armor.

### `itemType`

Must be `armor`.

### `armorClass`

Broad armor classification for legality and maneuver restrictions.

Recommended values:

- `Light`
- `Medium`
- `Heavy`
- `Very Heavy`

### `weight`

Physical item weight.

### `value`

Economic item value.

### `equipped`

Whether the armor is currently worn.

### `traits`

Canonical armor traits.

### `defenseDice`

Array of defense die families used by the armor.

Examples:

- `["Evade", "Evade", "Armor"]`
- `["Evade", "Armor", "Armor"]`
- `["Armor", "Armor", "Armor"]`

## Armor Examples

```js
{
  id: "armor-gambeson",
  name: "Gambeson",
  itemType: "armor",
  armorClass: "Light",
  weight: 0,
  value: 0,
  equipped: false,
  traits: [],
  defenseDice: ["Evade", "Evade", "Armor"]
}
```

```js
{
  id: "armor-full-plate",
  name: "Full Plate",
  itemType: "armor",
  armorClass: "Very Heavy",
  weight: 0,
  value: 0,
  equipped: false,
  traits: ["Resistance", "Encumbering"],
  defenseDice: ["Armor", "Armor", "Armor"]
}
```

## Foundry Guidance

In Foundry templates and import files:

- weapon items should expose `equipped`, `ready`, `minReach`, `maxReach`,
  `shortRange`, `longRange`, `maxRange`, `reloadTime`, `reloadProgress`,
  `usesAmmo`, `ammoType`, `ammoCapacity`, `ammoLoaded`, and `loadedAmmoId`
- ammo items should expose `ammoType`, `quantity`, `addDice`, `tags`, and
  `resultModifiers`
- armor items should expose `equipped`, `armorClass`, and `defenseDice`
- attack profile data should be structured enough to support multiple named
  weapon modes
- stored attack profile dice should use canonical family names in ordered arrays
- ranged attack profiles should define `allowedAmmoTypes`
- runtime roll formulas should convert canonical names to the mapped Foundry
  custom dice terms
- canonical stored dice and trait names should be used everywhere instead of
  legacy aliases

## Non-Goals In V1.1

This schema version does not attempt to standardize:

- full stunt automation data
- maneuver definitions
- derived skill-based labels such as whether a weapon is currently effectively
  `Versatile`
- deep inventory-container behavior for ammunition stacks

Those can be added later once the runtime model for them is stable.

