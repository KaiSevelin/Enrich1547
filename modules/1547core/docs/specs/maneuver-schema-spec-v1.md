# Maneuver Schema Spec V1

## Purpose

This document defines the runtime and content schema for maneuvers used by
`1547Core`.

The goals are:

- keep concrete maneuver content outside `1547Core`
- give content modules a stable contract
- allow validation before runtime use
- support both automated and non-automated maneuvers
- preserve room for creative or GM-adjudicated effects

## Core Principle

A maneuver is content data plus optional automation metadata.

That means:

- every maneuver must be valid content first
- only maneuvers with a registered handler should be auto-resolved if their effect
  requires custom logic
- maneuvers without handlers remain legal content, but are not fully automated

## Maneuver Timing Types

Every maneuver must have a timing `type`.

Allowed values:

- `pre`
- `post`
- `reaction`
- `full-turn`

Meaning:

- `pre`: declared as part of attack declaration before roll resolution
- `post`: spends crit points after damage-taken reactions
- `reaction`: may be triggered by a reaction window
- `full-turn`: consumes normal move and attack economy on commit

## Required Schema

Recommended minimum maneuver schema:

```js
{
  id,
  name,
  type,
  triggerType,
  CostType,
  CostAmount,
  automated,
  handlerId,
  effectData,
  usageLimit,
  tags,
  enabled
}
```

## Field Definitions

### `id`

Unique maneuver identifier.

This should be stable across compendium updates.

### `name`

Display name of the maneuver.

### `type`

Timing category.

Allowed:

- `pre`
- `post`
- `reaction`
- `full-turn`

### `triggerType`

When the maneuver may be used.

Examples:

- `attack-declared`
- `threat-zone-entered`
- `after-damage`
- `full-turn-activation`
- `post-attack`

Rules:

- required for `reaction`
- usually required for `full-turn` persistent effects
- optional for `pre`
- optional for `post`

### `CostType`

Resource type used by the maneuver.

Rules:

- for `pre`, `reaction`, and `full-turn`, allowed values are:
  - `StrengthPoints`
  - `StaminaPoints`
  - `DexterityPoints`
  - `CharismaPoints`
  - `IntelligencePoints`
  - `FaithPoints`
  - `PowerPoints`
  - `null`
- for `post`, `CostType` must be `CriticalPoints`
- if set, it must be valid for the maneuver `type`

### `CostAmount`

Numeric maneuver cost.

Rules:

- must be `0` or greater
- if `CostType` is set, `CostAmount` must be greater than `0`
- if `CostType` is null, `CostAmount` should be `0`

### `automated`

Boolean telling core whether automation should attempt to resolve the maneuver.

Rules:

- `true` means automation is allowed if runtime support exists
- `false` means maneuver is content-only and not auto-resolved

### `handlerId`

Optional id of the registered maneuver handler.

Examples:

- `disarm`
- `binding`
- `armor-breaking`
- `overwatch`

Rules:

- optional
- required if `automated = true` and the effect cannot be fully expressed through
  generic effect data
- if present, core may look up the handler during resolution

### `effectData`

Structured effect payload describing generic behavior.

Examples:

```js
{
  addMultiplierDice: 1
}
```

```js
{
  safeAttack: true
}
```

```js
{
  ignoreDieTypes: ["multiplier"]
}
```

Rules:
- may be empty
- should be used for generic effects before creating custom handlers
- should remain serializable and content-safe
- if `safeAttack: true` is set, the attack is treated as a safe attack
  regardless of other follow-up effect flags

- may be empty
- should be used for generic effects before creating custom handlers
- should remain serializable and content-safe

### `usageLimit`

Defines how often the maneuver may be used.

Recommended values:

```js
{
  scope: "turn",
  maxUses: 1
}
```

Rules:

- in current combat rules, maneuver type usage is effectively once per turn
- `usageLimit` may still be explicit to support future exceptions

### `tags`

Free-form classification tags.

Examples:

- `safe-attack`
- `defense`
- `stunt`
- `persistent`
- `template-targeting`

Tags are descriptive and should not replace formal fields.

### `enabled`

Whether the maneuver is currently active or in use.

Rules:

- commonly used for persistent or toggle-style maneuvers
- for normal content entries, defaults to `false`

## Recommended Extended Schema

For more automation-ready content, the following extended fields are recommended:

```js
{
  id,
  name,
  type,
  triggerType,
  CostType,
  CostAmount,
  automated,
  handlerId,
  effectData,
  usageLimit,
  tags,
  enabled,
  targetRules,
  requirements,
  duration,
  persistence,
  uiHints
}
```

## Extended Field Definitions

### `targetRules`

Defines valid targeting behavior.

Examples:

```js
{
  mode: "self"
}
```

```js
{
  mode: "enemy-single"
}
```

```js
{
  mode: "template"
}
```

### `requirements`

Defines prerequisites for legal use.

Examples:

```js
{
  requiredWeaponTags: ["melee"],
  requiredWeaponTraits: ["Fast"]
}
```

```js
{
  requiredTargetConditions: ["locked"],
  requiresAdjacentAllyTarget: true
}
```

```js
{
  requiredActorConditions: ["hidden"],
  prohibitedActorConditions: ["locked", "prone"],
  requiresVisibleAlly: true
}
```

Recommended structured fields:

- `requiredWeaponTags`
- `requiredWeaponTraits`
- `requiredWeaponGroups`
- `excludedWeaponTags`
- `requiredActorConditions`
- `prohibitedActorConditions`
- `requiredTargetConditions`
- `requiresHidden`
- `requiresMounted`
- `requiresUnmounted`
- `requiresVisibleAlly`
- `requiresAdjacentAllyTarget`
- `requiresFormationPartner`
- `requiresFlankingAlly`
- `requiresPolearmAlly`
- `requiresTargetLocked`

These fields are preferred over free-form `requirements.text` because they
allow the legality engine to evaluate maneuver prerequisites directly and
consistently.
### `duration`

Describes maneuver duration.

Examples:

```js
{
  kind: "instant"
}
```

```js
{
  kind: "until-owner-side-next-activation"
}
```

### `persistence`

Used for maneuvers that create ongoing effects such as Overwatch.

Example:

```js
{
  createsPersistentEffect: true,
  effectType: "overwatch"
}
```

### `uiHints`

Optional UI presentation hints.

Examples:

```js
{
  color: "danger",
  shortLabel: "Disarm"
}
```

These should never affect rules logic.

## Generic EffectData Conventions

The following keys are recommended for generic automation.

### Dice Pool Modification

```js
{
  addDice: ["multiplier"],
  addRiskDice: 1,
  addAdvantagePoints: 1
}
```

### Safe Attack Mutation

```js
{
  forceSafeAttack: true
}
```

### Ignore Rules

```js
{
  ignoreDieTypes: ["multiplier"]
}
```

```js
{
  ignoreTotalValues: [
    { totalKey: "protection", value: 1 }
  ]
}
```

### Defensive or Offensive Modifiers

```js
{
  addAttackModifiers: [
    { type: "damage", value: 1 }
  ],
  addDefenseModifiers: [
    { type: "protection", value: 2 }
  ]
}
```

### Persistent Effects

```js
{
  persistentEffect: {
    type: "overwatch",
    expiresOn: "owner-side-next-activation"
  }
}
```

## Handler Resolution Rules

Core should resolve maneuver automation in this order:

1. Validate schema
2. Apply generic `effectData` if supported
3. If `handlerId` exists and a handler is registered, invoke it
4. If no handler exists:
   - if maneuver is generic enough, continue with generic automation
   - otherwise do not auto-resolve the custom portion

This preserves support for content that is only partially automated.

## Validation Rules

### Required Validation

A maneuver is valid only if:

- `id` exists
- `name` exists
- `type` is valid
- `CostAmount` is numeric and `>= 0`
- `CostType` is either null or a valid resource
- `automated` is boolean

### Type-Specific Validation

#### `pre`

- valid as attack-attached maneuver
- should not require reaction trigger
- `CostType` must be one of the standard point pools or `null`

#### `post`

- should be legal in post-maneuver window
- `CostType` must be `CriticalPoints`

#### `reaction`

- must have `triggerType`
- must respect once-per-turn maneuver usage
- `CostType` must be one of the standard point pools or `null`

#### `full-turn`

- may define duration/persistence
- should not be treated as a normal attack/move reaction trigger source
- `CostType` must be one of the standard point pools or `null`

## Automation Tiers

Maneuvers should be categorized into 3 automation tiers.

### Tier 1: Data-Only Generic

Fully supported through `effectData`, no custom handler required.

Examples:

- add one multiplier die
- force safe attack
- ignore multiplier dice

### Tier 2: Data + Handler

Uses normal schema plus a custom handler for special behavior.

Examples:

- disarm
- binding with custom interaction logic

### Tier 3: Non-Automated

Valid content entry but no automation handler and no generic automation path.

Examples:

- narrative stunts
- setting-specific creative effects

## Example Minimal Pre-Maneuver

```js
{
  id: "maneuver-armor-break",
  name: "Armor Breaking",
  type: "pre",
  triggerType: null,
  CostType: "StrengthPoints",
  CostAmount: 1,
  automated: true,
  handlerId: null,
  effectData: {
    ignoreTotalValues: [
      { totalKey: "protection", value: 1 }
    ]
  },
  usageLimit: { scope: "turn", maxUses: 1 },
  tags: ["attack", "armor-breaking"],
  enabled: false
}
```

## Example Reaction Maneuver

```js
{
  id: "maneuver-guarded-response",
  name: "Guarded Response",
  type: "reaction",
  triggerType: "attack-declared",
  CostType: "StaminaPoints",
  CostAmount: 1,
  automated: true,
  handlerId: null,
  effectData: {
    forceSafeAttack: true
  },
  usageLimit: { scope: "turn", maxUses: 1 },
  tags: ["reaction", "defense", "safe-attack"],
  enabled: false
}
```

## Example Full-Turn Persistent Maneuver

```js
{
  id: "maneuver-overwatch",
  name: "Overwatch",
  type: "full-turn",
  triggerType: "enemy-enters-zone",
  CostType: "DexterityPoints",
  CostAmount: 1,
  automated: true,
  handlerId: "overwatch",
  effectData: {
    persistentEffect: {
      type: "overwatch",
      expiresOn: "owner-side-next-activation"
    }
  },
  usageLimit: { scope: "turn", maxUses: 1 },
  tags: ["full-turn", "reaction-source", "persistent"],
  enabled: false
}
```

## Storage Recommendation

Maneuvers should live in content modules as Foundry items or compendium content using
this schema.

`1547Core` should:

- validate maneuver content at runtime
- interpret timing and costs
- apply generic effects
- invoke handlers when registered

## Recommendations

1. Prefer generic `effectData` over custom handlers when possible.
2. Use `handlerId` only for behavior that cannot be expressed generically.
3. Keep `type` and `triggerType` explicit.
4. Keep costs normalized through `CostType` and `CostAmount`.
5. Treat non-automated maneuvers as valid content, not errors.
6. Keep creative or narrative maneuvers legal even if not fully automated.

## Next Useful Spec

The next useful companion document would be:

- `Handler Registration Spec V1`

That would define how content modules register custom maneuver and stunt handlers
with `1547Core`.
