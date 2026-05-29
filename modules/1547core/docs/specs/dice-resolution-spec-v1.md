# Dice Resolution Spec V1.1

## Purpose

This document defines how combat dice pools are built, modified, rolled,
filtered, and interpreted for combat in `1547`.

It is written to align with the current equipment schema and Foundry content
model used by `1547Core`.

## Core Principle

The runtime combat engine resolves one ordered dice pool per attack or defense
roll.

That means:

- stored weapon attack profiles provide one ordered `dice` array
- stored armor data provides one ordered `defenseDice` array
- loaded ammunition may contribute `addDice`, `tags`, and `resultModifiers`
- maneuvers and effects modify those ordered pools at runtime

This spec does not assume a separate stored to-hit roll or attack-pool and
damage-pool model.

## Canonical Dice Notation

At runtime, `1547` uses Foundry custom dice terms:

- `da` = `Armor`
- `db` = `Balanced`
- `dc` = `Control`
- `de` = `Evade`
- `dg` = `Grace`
- `dh` = `Heavy`
- `dl` = `Lethality`
- `dp` = `Penetration`
- `dr` = `Risk`
- `dx` = `Multiplier`

Example:

```text
1db + 1df + 1dh
```

means one each of:

- `Balanced`
- `Grace`
- `Heavy`

Stored data should use canonical family names such as `Balanced`, `Grace`,
and `Heavy`. Roll formulas should convert those names to the Foundry custom
dice-term notation when executed.

## Canonical Totals

The canonical totals are:

- `damage`
- `protection`
- `crit`
- `fumble`
- `multiplier`

## Resolution Overview

For each attack-vs-defense interaction:

1. Build attacker pool
2. Build defender pool
3. Apply additive pool modifiers
4. Roll attacker and defender simultaneously
5. Apply pool and result filters
6. Compute multiplier factor
7. Apply multiplier to `damage`, `protection`, and `crit`
8. Compute final damage
9. Record crits and fumbles unless the attack is safe

## Dice Pool Model

Dice pools are ordered lists.

Example:

```js
{
  orderedDice: [
    { dieType: "Grace", source: "weapon-base" },
    { dieType: "Control", source: "weapon-base" },
    { dieType: "Balanced", source: "weapon-base" }
  ]
}
```

Order matters because advantage duplicates the first die type in the base
weapon pool.

## Pool Construction Rules

### Base Pool

- attack pool comes from the selected weapon attack profile
- defense pool comes from armor or other defense setup

For ranged attacks:

- attacks within `shortRange` are normal
- attacks beyond `shortRange` and within `longRange` are made with disadvantage
- attacks beyond `longRange` are not legal unless a special rule explicitly uses
  `maxRange`

The canonical stored weapon profile shape is:

```js
{
  id,
  name,
  attackType,
  dice: ["Grace", "Control", "Balanced"],
  allowedAmmoTypes: [],
  tags: []
}
```

The canonical stored armor pool shape is:

```js
["Evade", "Evade", "Armor"]
```

### Ammunition Merge

If the selected attack uses loaded ammunition, the final attacker definition is
built by layering ammo onto the selected weapon attack profile.

Canonical merge model:

```js
finalAttackDefinition = {
  dice: [...attackProfile.dice, ...ammo.addDice],
  tags: [...weapon.traits, ...attackProfile.tags, ...ammo.tags],
  resultModifiers: [...ammo.resultModifiers]
}
```

Rules:

- ammo may only be used if its `ammoType` is allowed by the selected profile
- if the attack requires ammo and no valid ammo is loaded, the attack is not
  legal
- `loadedAmmoId` should identify a specific compatible ammo stack when ammo
  identity is tracked
- `addDice` extends the same attacker pool instead of creating a second roll
- ammo tags and result modifiers apply to that resolved attack only
- ammo may also override or narrow range for that resolved attack

### Ammunition Consumption Timing

To keep ammo choice and combat timing coherent:

- choosing loaded ammo does not consume ammo
- swapping to another compatible loaded ammo stack does not consume ammo
- attack declaration does not consume ammo
- ammunition is consumed when the attack is committed

For the current default `ammoCapacity: 1` model:

- a committed attack spends `1` unit from the loaded ammo stack
- after spending that unit, `ammoLoaded` becomes `0`
- after spending that unit, `loadedAmmoId` becomes `null`

If attack commitment is cancelled before resolution, ammunition remains
unspent.

### Advantage

Each `AdvantagePoint` adds one extra copy of the first die type in the weapon's
base ordered pool.

### Risk Dice

Each stored `RiskPoint` adds one `Risk` die to the next eligible roll in the
same combat. All stored `RiskPoint`s are consumed on that one roll.

### Multiplier Dice

`Multiplier` dice may be added by maneuvers or effects.

### Other Added Dice

Maneuvers or effects may add other die types. Additive stacking is the default
unless a more specific rule overrides it.

## Filters

Two separate filter types exist.

### Pool Filters

Pool filters ignore entire die categories before totals are interpreted.

Example:

- binding ignores all `Multiplier` dice

### Result Filters

Result filters ignore specific rolled outcomes after the roll is made.

Example:

- armor breaking ignores `protection 1` results only

Result modifiers granted by ammunition are applied in the same general stage as
other result filters or post-roll attack effects, according to their type.

## Multiplier Rules

Multiplier applies to:

- `damage`
- `protection`
- `crit`

Multiplier does not apply to:

- `fumble`

Rules:

- multiple multiplier values stack multiplicatively
- `x0` overrides everything
- if no multiplier result survives filtering, multiplier factor is `1`

Examples:

- `x2 * x2 = x4`
- `x2 * x3 = x6`
- `x2 * x3 * x0 = x0`

## Damage Rule

```js
damageApplied = Math.max(0, attackerFinalDamage - defenderFinalProtection)
```

## Safe Attack

A safe attack is a normal attack except:

- no crits are generated
- no fumbles are generated
- no reactions are generated from the attack

Safe attack has no inherent numeric bonus or penalty. If the maneuver that
initiated it also modifies dice or totals, those modifications still apply.

## Group Attacks

For a group attack:

- attacker rolls once
- every target faces the same attacker totals
- each target rolls defense separately
- each target resolves its own damage and defender crit or fumble generation

Attacker crit or fumble generation comes from the shared attacker roll once.

## Stunts

Stunts are only automated if a stunt handler exists for the specific stunt.
Otherwise they remain non-automated narrative or GM-adjudicated effects.

## Worked Examples

### Ordered Pool With Advantage, Risk, and Multiplier

Base pool:

```js
["Grace", "Control", "Balanced"]
```

With:

- `AdvantagePoints = 1`
- `RiskPoints = 2`
- one `Multiplier` die from a maneuver

Final ordered pool:

```js
[
  "Grace",
  "Grace",
  "Control",
  "Balanced",
  "Risk",
  "Risk",
  "Multiplier"
]
```

### Armor Breaking

If the defender rolls results contributing:

- `protection 1`
- `protection 2`
- `protection 4`

Then armor breaking ignores only `protection 1`.
Final filtered protection is `6`.

### Weapon Plus Ammunition

Weapon profile:

```js
{
  id: "shot",
  attackType: "ranged",
  dice: ["Balanced", "Grace"],
  allowedAmmoTypes: ["Arrow"],
  tags: []
}
```

Loaded ammunition:

```js
{
  ammoType: "Arrow",
  addDice: ["Penetration"],
  tags: ["Armor Breaking"],
  resultModifiers: [
    { type: "ignoreProtectionResult", value: 1 }
  ]
}
```

Final attacker definition:

```js
{
  dice: ["Balanced", "Grace", "Penetration"],
  tags: ["Reloading", "Armor Breaking"],
  resultModifiers: [
    { type: "ignoreProtectionResult", value: 1 }
  ]
}
```

Consumption timing for that example:

- selecting the `Arrow` stack does not spend ammunition
- declaring the shot does not spend ammunition
- when the shot is committed, reduce that stack's `quantity` by `1`
- then clear `loadedAmmoId` if the weapon is now empty

## Alignment Notes

This spec is intentionally aligned with the current equipment schema:

- weapon attack profiles use one ordered `dice` array
- weapons may require a loaded ammo item identified by `loadedAmmoId`
- ammo items provide `addDice`, `tags`, and `resultModifiers`
- ammo is chosen explicitly and consumed on committed attack resolution
- armor uses `defenseDice`
- canonical family names remain capitalized in stored data
- runtime formulas remain responsible for converting canonical names into
  Foundry dice terms

If the combat engine later gains more granular post-roll effect timing or more
complex ammo substitution behavior, that should be introduced as a future spec
revision rather than implied in this version.

