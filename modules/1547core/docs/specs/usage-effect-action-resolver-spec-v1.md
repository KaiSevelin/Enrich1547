# Usage Effect Action Resolver Spec v1

This document defines the generic resolver contract for token-targeted powers,
monster actions, and similar item-driven `UsageEffect` execution.

It also records the HUD visibility rule for powers.

## Goals

- one generic resolver for targeted `UsageEffect` powers
- support token selection and target selection
- keep `UsageEffect` as the payload source of truth
- make actor-owned power items visible in the HUD

## HUD Visibility Rule

Actor-owned `Power` items must be visible in the HUD.

Minimum requirement:

- powers appear in a dedicated `Powers` HUD category
- each row shows at least:
  - power name
  - short description if available
- clicking a row must expose the power to the user

Initial implementation:

- powers are rendered in a `Powers` category
- clicking a power row opens its item sheet

Future implementation target:

- clicking a power row resolves the action directly through the generic
  usage-effect resolver

## Resolver Input Contract

```ts
type ResolveUsageEffectRequest = {
  sourceToken: TokenDocument
  targetTokens: TokenDocument[]
  item: Item
  usageEffect: Item
}
```

## Resolver Output Contract

```ts
type ResolveUsageEffectResult = {
  ok: boolean
  reason?: string
  targetsResolved: Array<{
    targetTokenId: string
    outcome: "success" | "partial" | "failure"
    sourceRoll?: number
    targetRoll?: number
    applied: boolean
    appliedMode?: "CreateActiveEffect" | "DirectDataChange" | "GrantItem" | "NarrativeOnly" | "Hybrid"
  }>
}
```

## Processing Stages

### 1. Validate Source

The resolver must verify:

- a source token exists
- the source token has an actor
- the source item exists
- the source usage effect exists

### 2. Validate Targeting

Read from `usageEffect.system.props`:

- `TargetType`
- `TargetCount`
- `TargetRange`

Initial supported target types:

- `Self`
- `Actor`

Future target types:

- `Item`
- `Area`
- `BoundEntity`
- `PactBearer`

### 3. Validate Range

Initial supported range handling:

- `Self`
- `Touch`
- numeric squares
- permissive `Sight`
- permissive `Voice`

For permissive ranges, the resolver may defer exact validation to GM judgment.

### 4. Resolve Check

Read:

- `CheckType`
- `CheckFormula`
- `ResistanceType`
- `ResistanceFormula`

Initial supported check types:

- `None`
- `Contest`

Recommended outcome comparison:

- source > target -> `success`
- source == target -> `partial`
- source < target -> `failure`

### 5. Apply Payload

Dispatch by `ApplicationMode`:

- `CreateActiveEffect`
- `DirectDataChange`
- `GrantItem`
- `NarrativeOnly`
- `Hybrid`

## Formula Resolution

Initial supported formula grammar should stay small:

- `source Power`
- `source Dexterity`
- `target Faith`
- `target Stamina`

The resolver should map these to actor props:

- `Power` -> `Stats_PowerDice` + `Stats_PowerMod`
- `Strength` -> `Stats_StrengthDice` + `Stats_StrengthMod`
- `Dexterity` -> `Stats_DexterityDice` + `Stats_DexterityMod`
- `Stamina` -> `Stats_StaminaDice` + `Stats_StaminaMod`
- `Intelligence` -> `Stats_IntelligenceDice` + `Stats_IntelligenceMod`
- `Faith` -> `Stats_FaithDice` + `Stats_FaithMod`
- `Charisma` -> `Stats_CharismaDice` + `Stats_CharismaMod`

## Recommended Service Split

### `services/usage-effect-action-resolver.js`

Owns:

- top-level action resolution entry point
- source/target validation
- per-target loop
- chat/log result summary

### `services/usage-effect-roll-resolver.js`

Owns:

- parsing `CheckFormula`
- parsing `ResistanceFormula`
- performing opposed or flat rolls
- returning normalized roll results

### `services/usage-effect-application.js`

Owns:

- apply-by-mode dispatch
- ActiveEffect creation
- direct actor/item updates
- item grants
- hybrid application helpers

### `scripts/hud/*`

Owns:

- exposing actor-owned powers in the HUD
- dispatching the selected power into the resolver
- reporting resolver result to the user

## HUD Power Action Contract

Future direct-use contract:

1. user selects a token they control or the active combatant token
2. user targets zero, one, or many tokens according to `TargetType`
3. user clicks a `Power` row in the HUD
4. HUD resolves the primary `UsageEffect` on that power
5. HUD calls the generic action resolver
6. result is applied and posted to chat

## Hidden Folk Base Examples

### Cold Hand

- `TargetType`: `Actor`
- `TargetCount`: `1`
- `TargetRange`: `Touch`
- `CheckType`: `Contest`
- `CheckFormula`: `source Power`
- `ResistanceFormula`: `target Stamina`
- `ApplicationMode`: `CreateActiveEffect`
- `EffectType`: `Status`
- `EffectSubtype`: `Weakened`

Expected resolution:

- select Hidden Folk token
- target one adjacent token
- trigger `Cold Hand`
- resolve `Power` vs `Stamina`
- on success apply `Weakened`

### Brush of Glamour

- `TargetType`: `Actor`
- `TargetCount`: `1`
- `TargetRange`: `Sight or voice`
- `CheckType`: `Contest`
- `CheckFormula`: `source Power`
- `ResistanceFormula`: `target Faith`
- `ApplicationMode`: `CreateActiveEffect`
- `EffectType`: `Influence`
- `EffectSubtype`: `Doubt`

### Slip Aside

- `TargetType`: `Self`
- `CheckType`: `None`
- `ApplicationMode`: `CreateActiveEffect`
- `EffectType`: `Protection`
- `EffectSubtype`: `Concealment`

## MVP Scope

The first useful resolver milestone should support:

- `Power` items in the HUD
- `Self` and `Actor` targeting
- `None` and `Contest` checks
- `CreateActiveEffect`
- `DirectDataChange`
- `NarrativeOnly`

This is enough for:

- `Cold Hand`
- `Brush of Glamour`
- `Slip Aside`
- many first-pass monster powers and ritual outcomes
