# Weapon Modifier Schema Spec v1

This document defines the first shared schema for `WeaponModifier` items in
`1547Core`.

It exists to support layered upgrades and treatments such as:

- silvering
- blessing
- cold-iron treatment
- poison
- alchemical fire wrapping
- bodkin or broadhead style attack modifiers

without forcing all of that logic into base weapon items or ammunition items.

It should be read alongside:

- `equipment-and-dice-schema-spec-v1.md`
- `damage-type-catalog-spec-v1.md`
- `monster-tag-catalog-spec-v1.md`

## Purpose

A `WeaponModifier` is an item that can be attached to:

- a weapon
- an ammunition item
- sometimes both

and changes how attacks from that item resolve.

The main design goal is:

- base weapons define their normal attack profiles
- ammunition defines its ammunition-specific changes
- modifiers add a third reusable layer for material, blessing, poison, craft,
  and temporary treatment

This keeps content authoring flexible without needing a separate silvered copy
of every weapon and every arrow type.

## Core Rule

A weapon modifier should be:

- narrow
- reusable
- attached to an existing item
- primarily about combat payload changes

It should not become a second full spell or effect system.

Good uses:

- `Silvered`
- `Blessed`
- `Cold Iron`
- `Poisoned`
- `Broadhead Head`
- `Bodkin Head`
- `Wrapped in Flame`

Bad uses:

- a full supernatural attack power
- a broad monster passive rule
- a whole curse or pact system

Those belong elsewhere.

## Attachment Model

First-pass target kinds:

- `weapon`
- `ammo`

Recommended drop behavior:

- dropping a `WeaponModifier` on a weapon attaches the modifier to that weapon
- dropping a `WeaponModifier` on an ammunition item attaches the modifier to
  that ammunition stack
- one weapon may carry multiple attached modifiers at once
- one ammunition stack may carry multiple attached modifiers at once
- legality and final combination are determined by `requirements`, `stackKey`,
  and `stackMode`, not by a hard one-modifier limit

The parent item should then resolve attacks using:

1. base weapon profile
2. loaded ammo changes
3. attached weapon modifiers
4. attached ammo modifiers

### Multiple Modifiers On One Parent

The intended model is:

- multiple modifiers may be attached to the same weapon
- multiple modifiers may be attached to the same ammunition stack
- modifiers with different `stackKey` values may usually coexist
- modifiers with the same `stackKey` are resolved by `stackMode`

This allows combinations such as:

- `Arrow` + `Bodkin Head` + `Silvered`
- `Arrow` + `Broadhead Head` + `Poisoned`
- `Sword` + `Blessed` + `Wrapped in Flame`

while still preventing invalid doubling such as:

- two `arrowhead` modifiers on the same arrow stack
- two `material` treatments that should replace one another

## Canonical Modifier Schema

Recommended stored schema:

```js
{
  id,
  name,
  itemType: "weaponModifier",
  modifierType,
  targetKinds: [],

  addDamageQualifiers: [],
  removeDamageQualifiers: [],
  overrideDamageType: null,

  addDice: [],
  removeDice: [],
  resultModifiers: [],
  tags: [],
  onHitEffects: [],

  appliesToProfiles: [],
  durationType,
  durationValue,

  stackKey,
  stackMode,
  requirements: {},
  description
}
```

## Field Definitions

### `id`

Stable unique item identifier.

### `name`

Display name of the modifier.

Examples:

- `Silvered`
- `Blessed`
- `Poisoned`
- `Bodkin Head`

### `itemType`

Must be:

```js
"weaponModifier"
```

### `modifierType`

The broad category of the modifier.

Recommended first-pass values:

- `Material`
- `Blessing`
- `Poison`
- `Craft`
- `TemporaryEffect`
- `Alchemical`

This is mainly for authoring, UI grouping, and stack rules.

### `targetKinds`

Which item kinds the modifier may legally attach to.

Examples:

```js
["weapon"]
```

```js
["ammo"]
```

```js
["weapon", "ammo"]
```

Examples of intended use:

- `Silvered`
  - weapon or ammo
- `Bodkin Head`
  - ammo only
- `Poisoned`
  - weapon or ammo, depending on poison style

### `addDamageQualifiers`

Damage qualifiers this modifier adds to the resolved attack.

Examples:

```js
["Silver"]
```

```js
["Blessed"]
```

```js
["ColdIron"]
```

This is the main field for folklore counters and bypass conditions.

### `removeDamageQualifiers`

Optional list of qualifiers removed from the resolved attack.

This should be rare, but it is useful when one modifier replaces another
instead of stacking.

Example:

- replacing `NormalWeapon` logic with a more specific treated state if later
  runtime rules need that

### `overrideDamageType`

Optional replacement for the resolved attack's primary `damageType`.

Default should be:

```js
null
```

Use this only when the modifier fundamentally changes the harm.

Examples:

- fire-wrap turns the strike into `Fire`
- frost treatment turns the strike into `Cold`

Most modifiers should leave this `null`.

### `addDice`

Additional dice added to the resolved attack pool.

Examples:

```js
["Penetration"]
```

```js
["Lethality"]
```

Use sparingly.

### `removeDice`

Optional list of dice families removed from the resolved attack pool.

This should be rare.

It is mostly for cases where a modifier intentionally trades one attack quality
for another.

### `resultModifiers`

Structured runtime effects applied to the attack result.

Examples:

- `ignoreProtectionResult`
- `bonusCritCount`
- `addRiskOnUse`
- `cannotRecoverAmmo`

### `tags`

Optional tags added to the resolved attack.

Use only when another runtime rule will query them.

### `onHitEffects`

Optional list of secondary damage or rider payloads that can trigger when the
modified attack hits or makes contact.

This is the correct home for things like:

- poison damage
- silver burn
- blessed sting
- fire wrapping
- alchemical acid
- curse transfer on strike

Do not try to force these into vague `resultModifiers`.

Recommended shape:

```js
[
  {
    triggerMode,
    armorInteraction,
    resolution,
    sourceCheck,
    targetCheck,
    difficulty, // optional: flat save difficulty (1-5) when no attacker stat
    damageType,
    damageQualifiers: [],
    damageAmount,
    applyStatus,
    applyTag,
    notes
  }
]
```

If no secondary payload exists, this field should be:

```js
[]
```

### `appliesToProfiles`

Which attack profiles on the parent item the modifier affects.

Default:

- empty array means all profiles

Examples:

```js
[]
```

```js
["thrust"]
```

```js
["default"]
```

Useful for:

- silvering only the striking edge or point
- poison applied only to the active blade profile

## Secondary Hit Effect Model

`onHitEffects` exists because a weapon modifier may need to do more than alter
the base attack profile.

Examples:

- a poison only harms when the attack pierced flesh
- silver may burn a creature on contact even if the base strike was mostly
  stopped by armor
- a flame wrap may add fire damage regardless of whether the base wound was
  large
- a curse transfer may require an extra opposed check

So every secondary effect needs to answer three questions:

1. when does it get a chance to trigger?
2. how is it resolved?
3. what does it apply?

### `triggerMode`

Defines when the secondary effect is allowed to resolve.

Recommended first-pass values:

- `onAnyHit`
  - the base attack hit at all
- `onDamageApplied`
  - base damage got through and reduced HP
- `onCritical`
  - only after a critical hit
- `onExposure`
  - contact or meaningful touch happened even if base damage was small or
    mostly prevented
- `onManualChoice`
  - the attacker chooses to invoke the effect

Examples:

- poison on a dagger:
  - `onDamageApplied`
- silver burn against a werewolf:
  - `onExposure`
- flame burst on a crit:
  - `onCritical`

### `armorInteraction`

Defines how the modifier's own secondary payload relates to armor and the base
strike.

Recommended first-pass values:

- `normal`
  - resolves like ordinary follow-up harm
- `ignoresArmor`
  - the secondary payload is not reduced by armor/protection
- `onlyIfBaseDamagePassed`
  - only resolve if the base strike actually got through
- `contactOnly`
  - can resolve from meaningful contact even if the base harm was mostly
    stopped

Examples:

- venom:
  - `onlyIfBaseDamagePassed`
- silver burn:
  - `contactOnly`
- acid smear:
  - `ignoresArmor`

### `resolution`

Defines whether the secondary payload is automatic or checked.

Recommended first-pass values:

- `automatic`
- `contest`
- `save`

Use:

- `automatic` when the extra harm simply happens
- `contest` when both attacker and defender roll against one another
- `save` when only the target resists

#### How a checked resolution is decided

Checks resolve deterministically against a nominal check value: `statDice +
statMod` for a stat side, or `difficulty` for a flat difficulty side (a
difficulty of `N` is read as `Nd6`, whose nominal value is `N`).

- `contest`: the rider lands when the `sourceCheck` value `>=` the
  `targetCheck` value (the attacker wins ties).
- `save`: the attacker side — the `sourceCheck` stat, or a flat `difficulty`
  when no attacker stat is given — is compared to the defender's `targetCheck`.
  The rider lands unless the defender's value **strictly exceeds** the attacker
  side (i.e. it lands when `attacker >= target`).

### `sourceCheck`

Optional source-side check formula.

For `contest` it is the attacker's stat. For `save` it is either the
attacker's stat or a flat difficulty:

- a stat, e.g. `source Dexterity`, `source Power`, `source Strength`
- a difficulty value (usually `1`–`5`), written `3` or `3d6`, used when the
  save has no attacker stat

When a `save` has neither a stat `sourceCheck` nor a `difficulty`, a default
difficulty of `3` applies.

### `targetCheck`

Optional target-side check formula used for `contest` or `save`.

Examples:

- `target Stamina`
- `target Faith`
- `target Dexterity`
- `target Power`

### `difficulty`

Optional flat difficulty for a `save` that has no attacker stat. Expressed as
`1`–`5` and read as `[difficulty]d6` (nominal value = the number itself). If a
`save` provides neither this field nor a numeric `sourceCheck`, a default of
`3` is used. Ignored by `contest` and `automatic`.

### `damageType`

Primary damage type of the secondary payload.

Examples:

- `Poison`
- `Fire`
- `Corruption`
- `Soul`

### `damageQualifiers`

Optional qualifiers attached to the secondary payload itself.

Example:

```js
["Blessed"]
```

### `damageAmount`

Direct numeric damage applied by the secondary payload when it succeeds.

Use `0` when the effect only applies status, tag, or some other rider.

### `applyStatus`

Optional status applied by the secondary payload.

Examples:

- `Weakened`
- `Afraid`
- `Cursed`

### `applyTag`

Optional machine-readable tag applied by the secondary payload.

Examples:

- `Poisoned`
- `Marked`

### `notes`

Human-readable explanation of the secondary effect.

## Example Secondary Hit Effects

### Poisoned Blade

```js
{
  triggerMode: "onDamageApplied",
  armorInteraction: "onlyIfBaseDamagePassed",
  resolution: "contest",
  sourceCheck: "source Dexterity",
  targetCheck: "target Stamina",
  damageType: "Poison",
  damageQualifiers: [],
  damageAmount: 1,
  applyStatus: "Weakened",
  applyTag: "",
  notes: "The poison only matters if the blow actually got into the body."
}
```

### Silver Burn

```js
{
  triggerMode: "onExposure",
  armorInteraction: "contactOnly",
  resolution: "automatic",
  sourceCheck: "",
  targetCheck: "",
  damageType: "Corruption",
  damageQualifiers: ["Silver"],
  damageAmount: 1,
  applyStatus: "",
  applyTag: "",
  notes: "Hurts vulnerable creatures on meaningful contact even if the base wound was slight."
}
```

### Blessed Sting

```js
{
  triggerMode: "onAnyHit",
  armorInteraction: "normal",
  resolution: "save",
  sourceCheck: "",
  targetCheck: "target Power",
  damageType: "Soul",
  damageQualifiers: ["Blessed"],
  damageAmount: 1,
  applyStatus: "",
  applyTag: "",
  notes: "The sanctified strike forces a spiritual resistance."
}
```

### Flame Wrap

```js
{
  triggerMode: "onAnyHit",
  armorInteraction: "ignoresArmor",
  resolution: "automatic",
  sourceCheck: "",
  targetCheck: "",
  damageType: "Fire",
  damageQualifiers: [],
  damageAmount: 1,
  applyStatus: "",
  applyTag: "",
  notes: "A small extra burst of fire rides on the strike."
}
```

### `durationType`

How long the modifier remains attached or active.

Recommended first-pass values:

- `Permanent`
- `Scene`
- `Uses`
- `Days`

### `durationValue`

Numeric or count value associated with the duration type.

Examples:

- `Uses: 1`
- `Days: 1`

### `stackKey`

Stack-family identifier used to resolve conflicts between modifiers of the same
kind.

Examples:

- `material`
- `blessing`
- `poison`
- `arrowhead`

This is not a user-facing name. It is a rule bucket.

### `stackMode`

How this modifier behaves when another modifier with the same `stackKey` is
already present.

Recommended first-pass values:

- `replace`
- `stack`
- `ignore-if-present`

Examples:

- `Silvered`
  - `stackKey: "material"`
  - `stackMode: "replace"`
- `Blessed`
  - `stackKey: "blessing"`
  - `stackMode: "replace"`
- `Poisoned`
  - `stackKey: "poison"`
  - `stackMode: "replace"`
- a small temporary oil
  - `stackMode: "ignore-if-present"`

Combined with multiple attached modifiers, this means:

- many modifiers may coexist on one parent item
- only one modifier from a given replace-family should normally survive
- truly additive families should use `stack`
- passive duplicate-prevention families should use `ignore-if-present`

### `requirements`

Optional constraints for legal attachment.

Examples:

- only melee weapons
- only edged weapons
- only arrows
- not firearms

First-pass requirement keys can stay simple:

```js
{
  weaponCategories: ["Blade", "Knife"],
  ammoTypes: ["Arrow"],
  requiresUsesAmmo: true
}
```

This can expand later if needed.

### `description`

Readable text describing the modifier for players and GMs.

## Example Modifier Items

### `Silvered`

```js
{
  id: "mod-silvered",
  name: "Silvered",
  itemType: "weaponModifier",
  modifierType: "Material",
  targetKinds: ["weapon", "ammo"],
  addDamageQualifiers: ["Silver"],
  removeDamageQualifiers: [],
  overrideDamageType: null,
  addDice: [],
  removeDice: [],
  resultModifiers: [],
  tags: [],
  onHitEffects: [],
  appliesToProfiles: [],
  durationType: "Permanent",
  durationValue: null,
  stackKey: "material",
  stackMode: "replace",
  requirements: {},
  description: "Counts as silver against beings vulnerable to silver."
}
```

### `Blessed`

```js
{
  id: "mod-blessed",
  name: "Blessed",
  itemType: "weaponModifier",
  modifierType: "Blessing",
  targetKinds: ["weapon", "ammo"],
  addDamageQualifiers: ["Blessed"],
  removeDamageQualifiers: [],
  overrideDamageType: null,
  addDice: [],
  removeDice: [],
  resultModifiers: [],
  tags: [],
  onHitEffects: [],
  appliesToProfiles: [],
  durationType: "Days",
  durationValue: 1,
  stackKey: "blessing",
  stackMode: "replace",
  requirements: {},
  description: "Consecrated for creatures harmed by blessing."
}
```

### `Bodkin Head`

```js
{
  id: "mod-bodkin-head",
  name: "Bodkin Head",
  itemType: "weaponModifier",
  modifierType: "Craft",
  targetKinds: ["ammo"],
  addDamageQualifiers: [],
  removeDamageQualifiers: [],
  overrideDamageType: null,
  addDice: ["Penetration"],
  removeDice: [],
  resultModifiers: [
    { type: "ignoreProtectionResult", value: 1 }
  ],
  tags: ["Armor Breaking"],
  onHitEffects: [],
  appliesToProfiles: [],
  durationType: "Permanent",
  durationValue: null,
  stackKey: "arrowhead",
  stackMode: "replace",
  requirements: {
    ammoTypes: ["Arrow", "Bolt"]
  },
  description: "An armor-piercing head shape."
}
```

### `Poisoned`

```js
{
  id: "mod-poisoned",
  name: "Poisoned",
  itemType: "weaponModifier",
  modifierType: "Poison",
  targetKinds: ["weapon", "ammo"],
  addDamageQualifiers: [],
  removeDamageQualifiers: [],
  overrideDamageType: null,
  addDice: [],
  removeDice: [],
  resultModifiers: [],
  tags: ["Poisoned"],
  onHitEffects: [
    {
      triggerMode: "onDamageApplied",
      armorInteraction: "onlyIfBaseDamagePassed",
      resolution: "contest",
      sourceCheck: "source Dexterity",
      targetCheck: "target Stamina",
      damageType: "Poison",
      damageQualifiers: [],
      damageAmount: 1,
      applyStatus: "Weakened",
      applyTag: "",
      notes: "The poison takes hold only if the strike got into the body."
    }
  ],
  appliesToProfiles: [],
  durationType: "Uses",
  durationValue: 1,
  stackKey: "poison",
  stackMode: "replace",
  requirements: {},
  description: "Carries poison for the next legal strike or shot."
}
```

## Recommended Runtime Merge Order

When resolving one attack, apply layers in this order:

1. selected weapon attack profile
2. loaded ammunition item
3. weapon-attached modifiers
4. ammunition-attached modifiers

This allows:

- a silvered sword
- a blessed spear
- an arrow with `Bodkin Head`
- an arrow with `Silvered`
- an arrow with `Silvered` and `Blessed`
- an arrow with `Broadhead Head` and `Poisoned`

without needing separate permanent weapon or ammo base items for every case.

Secondary `onHitEffects` should then resolve after the base hit is known, using
their own `triggerMode`, `armorInteraction`, and `resolution` rules.

## Recommended First-Pass UI

A `WeaponModifier` template should expose at least:

- `ModifierType`
- `TargetKinds`
- `AddDamageQualifiers`
- `RemoveDamageQualifiers`
- `OverrideDamageType`
- `AddDice`
- `OnHitEffects`
- `ResultModifiers`
- `AppliesToProfiles`
- `DurationType`
- `DurationValue`
- `StackKey`
- `StackMode`
- `Requirements`
- `Description`

Recommended parent-item UI:

- weapons show an attached modifiers list
- ammo stacks show an attached modifiers list
- both lists may contain multiple modifiers at once
- same-family conflicts should be surfaced clearly when `stackMode` would
  replace or reject an existing modifier
- dragging a modifier item onto a legal target attaches it
- illegal targets reject the drop with a clear message

## First-Pass Scope Recommendation

The first wave should stay small:

- `Silvered`
- `Blessed`
- `Cold Iron`
- `Poisoned`
- `Broadhead Head`
- `Bodkin Head`
- `Wrapped in Flame`

That is enough to support folklore counters and meaningful attack preparation
without overbuilding the system too early.
