# Usage Effect Action Resolver Spec v1

This document defines the generic resolver contract for token-targeted
supernatural marks, monster magic, spells, and similar item-driven
`UsageEffect` execution.

It also records the HUD visibility rule for actor-owned supernatural marks and
monster magic.

## Goals

- one generic resolver for targeted `UsageEffect` items
- support token selection and target selection
- keep `UsageEffect` as the payload source of truth
- make actor-owned supernatural marks and monster magic visible in the HUD

## HUD Visibility Rule

Actor-owned `Supernatural Mark` and `Monster Magic` items must be visible in
the HUD.

Minimum requirement:

- marks appear in a dedicated `Marks` HUD category
- monster magic appears in a dedicated `Monster Magic` HUD category
- each row shows at least:
  - item name
  - short description if available
- clicking a row must expose the item to the user

Initial implementation:

- marks are rendered in a `Marks` category
- monster magic is rendered in a `Monster Magic` category
- clicking a row opens its item sheet

Future implementation target:

- clicking a row resolves the primary `UsageEffect` directly through the
  generic usage-effect resolver

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
- `Item`
- `Area`
- `BoundEntity`
- `PactBearer`

Future target types:

- scene-anchored `Area` documents
- non-actor `BoundEntity` records
- richer pact-bearer selection helpers

### Item Target Resolution

First-pass `Item` targeting is shared across one spell resolution:

- if the caller provides explicit item targets, the resolver uses them
- otherwise, the resolver prompts the user to choose from the source actor's
  owned items
- the chosen item targets are then reused for every `Item`-targeted effect in
  the same resolution

This is intended to make spells like `Bless Weapon`, `Wax Seal`, `Iron Seal`,
and `Enchant Object` resolve coherently as one casting instead of asking for a
new item pick per effect.

### Bound Entity And Pact-Bearer Resolution

First-pass `BoundEntity` and `PactBearer` targeting reuses the normal actor
target flow:

- the user selects target tokens
- the resolver treats those targets as the current bearer or manifested entity
- checks and applications then run against the targeted actor documents

This keeps command, banishment, sealing, and pact-breaking spells operational
as long as the relevant supernatural being is represented by an actor/token.

### Area Resolution

First-pass `Area` targeting uses the source actor as a persistence proxy:

- narrative and descriptive area effects resolve immediately
- granted items and active effects are stored on the source actor
- the chat/result note should make it clear that the source actor is only the
  current storage proxy for the area effect

This is an intentional temporary model until the system grows a richer
scene-anchor or placed-ritual document type.

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

## Direct Data Change Contract

`DirectDataChange` must only be used when the payload target is explicit enough
to mutate data safely.

Recommended first-pass target grammar:

- `system.props.<PropName>`
- `PrimaryStat:<Stat>:mod`
- `PrimaryStat:<Stat>:dice`
- `PrimaryStat:<Stat>:steps`
- `Resource:<PropName>`
- `FlagTrait:<Slug>`
- `FlagTag:<Slug>`

Examples:

- `system.props.PowerPoints`
- `PrimaryStat:Strength:mod`
- `PrimaryStat:Power:steps`
- `Resource:StaminaPoints`
- `FlagTrait:visible-tell`
- `FlagTag:curse-proof`

### Primary Stat Step Ladder

`PrimaryStat:<Stat>:steps` must advance or reduce a stat on the d6 ladder:

- `1d6`
- `1d6 + 1`
- `1d6 + 2`
- `1d6 + 3`
- `2d6`
- `2d6 + 1`
- `2d6 + 2`
- `2d6 + 3`
- `3d6`
- and so on

Each increase is `+1` step.

Each decrease is `-1` step.

Example:

- `1d6 + 3` with `PayloadTarget = PrimaryStat:Strength:steps` and
  `PayloadValue = 1`
  becomes `2d6`
- `2d6` with `PayloadValue = -1`
  becomes `1d6 + 3`

If a `DirectDataChange` effect does not provide one of these explicit targets,
the runtime resolver should **not** guess. It should fail safely and report
that the effect was too ambiguous to apply automatically.

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
- ActiveEffect creation on actors or items
- direct actor/item updates
- item grants to actors
- hybrid application helpers

### `scripts/hud/*`

Owns:

- exposing actor-owned supernatural marks and monster magic in the HUD
- dispatching the selected item into the resolver
- reporting resolver result to the user

## HUD Action Contract

Future direct-use contract:

1. user selects a token they control or the active combatant token
2. user targets zero, one, or many tokens according to `TargetType`
3. user clicks a `Mark` or `Monster Magic` row in the HUD
4. HUD resolves the primary `UsageEffect` on that item
5. HUD calls the generic action resolver
6. result is applied and posted to chat

## Hidden Folk Base Examples

### Cold Hand

- carrier: `Monster Magic`
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

- carrier: `Monster Magic`
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

- carrier: `Monster Magic`
- `TargetType`: `Self`
- `CheckType`: `None`
- `ApplicationMode`: `CreateActiveEffect`
- `EffectType`: `Protection`
- `EffectSubtype`: `Concealment`

## MVP Scope

The first useful resolver milestone should support:

- `Supernatural Mark` and `Monster Magic` items in the HUD
- `Self` and `Actor` targeting
- `None` and `Contest` checks
- `CreateActiveEffect`
- `DirectDataChange`
- `NarrativeOnly`

This is enough for:

- `Cold Hand`
- `Brush of Glamour`
- `Slip Aside`
- many first-pass monster actions and ritual outcomes
