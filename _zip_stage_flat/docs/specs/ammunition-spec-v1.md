# Ammunition Spec v1

## Purpose

This spec defines a simple ammunition model for `1547Core`.

The goals are:

- support ammunition-consuming weapons without adding unnecessary complexity
- separate carried ammunition from loaded ammunition
- keep the model compatible with current weapon handling and future HUD actions
- allow implementation even though no ammo items or ammo templates currently exist

## Core Principles

- weapons consume loaded ammunition when fired
- reloading moves ammunition from inventory into the weapon
- ammunition is tracked by ammo type
- a weapon cannot fire if it requires ammunition and has no loaded ammunition

## Weapon Fields

Weapons that use ammunition should support these fields:

- `UsesAmmo`
  - boolean
  - `true` if the weapon requires ammunition to attack
- `AmmoType`
  - string
  - example: `Bullet`, `Bolt`, `Arrow`
- `AmmoCapacity`
  - integer
  - maximum loaded ammunition the weapon can hold
  - default for most current ranged weapons: `1`
- `AmmoLoaded`
  - integer
  - currently loaded ammunition in the weapon
- `ReloadTime`
  - existing field
  - number of reload steps or turns required
- `ReloadProgress`
  - existing field
  - current progress toward reloading

## Ammo Item Fields

When ammunition items are introduced, they should support:

- `AmmoType`
  - string
  - must match the weapon `AmmoType`
- `Quantity`
  - integer
  - how many units of that ammunition stack remain

Optional later fields:

- `WeightPerUnit`
- `ValuePerUnit`
- `ContainerType`
- `SpecialTags`

## Initial Ammo Types

Recommended initial ammo types:

- `Arrow`
- `Bolt`
- `Bullet`
- `Stone`
- `Dart`

These should remain plain strings in v1.

## Weapon Categories and Ammo Expectations

Suggested v1 behavior:

- `Bow`
  - `UsesAmmo: true`
  - `AmmoType: Arrow`
  - `AmmoCapacity: 1`
- `Crossbow`
  - `UsesAmmo: true`
  - `AmmoType: Bolt`
  - `AmmoCapacity: 1`
- `Firearm`
  - `UsesAmmo: true`
  - `AmmoType: Bullet`
  - `AmmoCapacity: 1`
- `Thrown`
  - no separate loaded ammo model in v1
  - thrown weapons remain weapon items for now

## Reload Flow

Reload should follow this process:

1. validate that the weapon uses ammunition
2. validate that the weapon is not already full
3. search actor inventory for ammo items with matching `AmmoType`
4. validate that at least one matching ammo unit exists
5. spend reload time / progress according to weapon rules
6. when reload completes:
   - reduce matching ammo item `Quantity` by `1`
   - increase weapon `AmmoLoaded` by `1`

## Attack Consumption Flow

When a weapon attack is resolved:

1. validate attack legality
2. validate ammunition state
3. if `UsesAmmo` is `true`, require `AmmoLoaded > 0`
4. on a completed shot:
   - reduce `AmmoLoaded` by `1`

This should happen on firing, not on hit.

## HUD Action Expectations

Weapon HUD actions should use this behavior:

- if a weapon does not use ammo:
  - no ammo validation is needed
- if a weapon uses ammo and `AmmoLoaded > 0`:
  - attack is valid
- if a weapon uses ammo and `AmmoLoaded <= 0`:
  - attack is invalid
  - reason: `Weapon is not loaded`
- if a weapon uses ammo and inventory contains matching ammo:
  - `Reload` action is valid
- if a weapon uses ammo and no matching ammo is carried:
  - `Reload` is invalid
  - reason: `No matching ammunition`

## Setup Without Ammo Templates

Because no ammo item template currently exists, v1 should be implemented in phases:

### Phase 1

- add ammo-related fields to weapon data and template
- enforce `AmmoLoaded` consumption and reload validation logic
- treat missing ammo items as “no ammo available”

### Phase 2

- introduce an ammunition item template
- introduce world ammo items
- connect reload to stack consumption from inventory

## Recommended First Implementation

The first implementation should:

- add `UsesAmmo`
- add `AmmoType`
- add `AmmoCapacity`
- add `AmmoLoaded`
- set sensible defaults for current ranged weapons
- block ranged attacks when not loaded
- allow reload only when matching ammo exists once ammo items are added

Until ammo items exist, reload can either:

- remain disabled for realism, or
- use a temporary developer fallback

Recommended choice:

- keep reload logic in place
- do not fake infinite ammunition

## Validation Rules

For any weapon where `UsesAmmo` is `true`:

- `AmmoType` must be non-empty
- `AmmoCapacity` must be `>= 1`
- `AmmoLoaded` must be between `0` and `AmmoCapacity`

For any ammo item:

- `AmmoType` must be non-empty
- `Quantity` must be `>= 0`

## Open Questions

These are intentionally left for later:

- whether firearms also track powder separately
- whether ammunition can have quality tiers or special effects
- whether partial reload progress consumes ammo immediately or only on completion
- whether thrown weapons should later share the same quantity model
