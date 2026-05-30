# Spell Automation Tracking Spec v1

This document tracks which included spells are good candidates for active
`Use`-effect automation, which ones can be implemented with the current runtime,
which ones are better handled by chat/manual resolution, and which still depend
on deeper supporting systems.

It is an authored implementation tracker, not a runtime contract.

## Purpose

- identify the spells that should feel mechanically actionable in play
- normalize spell implementation notes into a stricter authoring format
- distinguish runtime-ready effects from manual or blocked spells
- define the new editable spell active effects that should exist in the system

## Status Meanings

- `Ready`
  Can be implemented now with the current spell resolver and current targeting
  model.
- `Manual`
  Should still be cast through the spell system, but the main result is chat,
  GM judgment, or a manual follow-up instead of a direct runtime payload.
- `Blocked`
  Has a clear automation goal, but needs missing engine support first.
- `Narrative`
  Primarily informational, omen-based, or fictional and should not be treated
  as a strong active automation target yet.

## Columns

- `Spell`
  Spell name.
- `Status`
  `Ready`, `Manual`, `Blocked`, or `Narrative`.
- `Target`
  Intended target model for the spell.
- `Resolution`
  How the spell should resolve at cast time.
- `Implementation`
  The concrete automated or semi-automated behavior.
- `Blockers`
  Missing runtime support or follow-up work.

## Authoring Rules

- Use `DirectDataChange` only when the exact prop/resource target is known.
- Use `CreateActiveEffect` for named spell states the user should be able to
  inspect and edit.
- In the current implementation pass, spell-created active effects should be
  created as empty editable shells with no authored `changes`; detailed
  mechanics will be added later.
- For primary-stat ladder changes, use `PayloadTarget = PrimaryStat:<Stat>:steps`.
- For spell `Power` contests, `single advantage` adds `+1d6` to the caster's
  `Power` roll and `double advantage` adds `+2d6`.
- `CurrentHitPoints` is the live HP field.
- `MaxHitPoints` is now a real actor property with default value
  `Stats_StrengthDice + Stats_StaminaDice + Stats_DexterityDice`.
- Recurring time-based spell effects are handled manually after the first
  automated deduction or first applied effect.
- Use `Manual` if the spell should show success/failure or produce a chat
  result, but not mutate actor or item state directly.
- Do not keep a spell in `Ready` if its implementation note says
  `No automation`.

## Proposed Editable Spell Active Effects

These are the new spell-facing active effects proposed by the current spell
list. They should be editable system active effects rather than one-off hidden
runtime payloads.

### Blessings And Protections

- `Blessed`
- `Consumption Oath`
- `Curse Protection`
- `Danger Sense`
- `Dream Warded`
- `Evil Eye Protection`
- `Friendly`
- `Love Bound`
- `Deep Love Bound`
- `Oath Bound`
- `Protected`
- `Ritual Protection`
- `Sanctified`
- `Spirit Protection`
- `Spirit Sight`
- `Threshold Sense`
- `Truthful`

### Curses, Control, And Afflictions

- `Bad Luck`
- `Confused`
- `Cursed`
- `Diseased`
- `Doomed`
- `Fear`
- `Possessed`
- `Shadowed`
- `Silenced`
- `Sleep Touched`
- `Weakened`
- `Withering`

### Transformation And Special States

- `Astral`
- `Glamour`
- `Shape Changed`

## Notes On Editable Spell Active Effects

- `Bad Luck`
  Should be authorable as a reusable effect that adds `risk` dice to attacks or
  other chosen roll families.
- `Withering`
  Should be authorable as a long-duration curse shell even if daily max-HP decay
  is still blocked.
- `Possessed`
  Should exist as an inspectable state even before full possession control rules
  are richer.
- `Protected`, `Spirit Protection`, and `Ritual Protection`
  should remain distinct until we decide whether they collapse into one broader
  ward family.

## Ready

| Spell | Status | Target | Resolution | Implementation | Blockers |
| --- | --- | --- | --- | --- | --- |
| `Albedo` | `Ready` | `Self` | `DirectDataChange` | Add `+3` steps to `Power` on self. | None. Use `PrimaryStat:Power:steps`. |
| `Bless Weapon` | `Ready` | `Item` | `GrantItem` or `DirectDataChange` | Attach a `Blessed` weapon modifier to the chosen weapon. | Item.YEmH08i9vPl49ZNu |
| `Borrowed Pulse` | `Ready` | `Self` | `CreateActiveEffect` | Apply a duration-based effect giving `Stamina +1 step` and `CurrentHitPoints +2`. | None. Use `PrimaryStat:Stamina:steps` plus `system.props.CurrentHitPoints`. |
| `Citrinitas` | `Ready` | `Self` | `CreateActiveEffect` | Apply a duration-based effect giving `Intelligence +2 steps` and `Power +2 steps`. | None. Use `PrimaryStat:Intelligence:steps` and `PrimaryStat:Power:steps`. |
| `Cold Knot` | `Ready` | `Actor` | `CreateActiveEffect` | Apply a duration-based effect giving `Stamina -2 steps` and `Strength -2 steps`. | None. Use `PrimaryStat:Stamina:steps` and `PrimaryStat:Strength:steps`. |
| `Consumption Oath` | `Ready` | `Actor` | `CreateActiveEffect` | Apply editable active effect `Consumption Oath`. | Breach consequences still manual. |
| `Disease Knot` | `Ready` | `Actor` | `CreateActiveEffect` | Apply editable active effect `Diseased`. | None. |
| `Dream Warding` | `Ready` | `Self`, `Actor` | `CreateActiveEffect` | Apply editable active effect `Dream Warded` with duration. | None. |
| `Dread` | `Ready` | `Actor` | `CreateActiveEffect` | Apply editable active effect `Fear` with duration. | None. |
| `Favor Knot` | `Ready` | `Actor` | `CreateActiveEffect` | Apply editable active effect `Friendly` with duration. | None. |
| `Heart Twine` | `Ready` | `Actor` | `CreateActiveEffect` | Apply editable active effect `Love Bound` with duration. | None. |
| `Ill Luck Knot` | `Ready` | `Actor` | `CreateActiveEffect` | Apply editable active effect `Bad Luck` with duration. | Handled manually. |
| `Ill Turning Loop` | `Ready` | `Actor` | `CreateActiveEffect` | Apply editable active effect `Curse Protection` with duration. | None. |
| `Lovebinding` | `Ready` | `Actor` | `CreateActiveEffect` | Apply editable active effect `Deep Love Bound` with duration. | None. |
| `Oath Knot` | `Ready` | `Actor` | `CreateActiveEffect` | Apply editable active effect `Oath Bound`. | Oath enforcement remains social/manual. |
| `Prayer Against the Evil Eye` | `Ready` | `Self`, `Actor` | `CreateActiveEffect` | Apply editable active effect `Evil Eye Protection` with duration. | None. |
| `Protection Rhyme` | `Ready` | `Self`, `Actor` | `CreateActiveEffect` | Apply editable active effect `Spirit Protection`. | None. |
| `Protective Border` | `Ready` | `Actor` | `CreateActiveEffect` | Apply editable active effect `Spirit Protection` to multiple selected actors. | Using selected actors on canvas. |
| `Protective Circle` | `Ready` | `Actor` | `CreateActiveEffect` | Apply editable active effect `Ritual Protection` to multiple selected actors. | Using selected actors on canvas. |
| `Rubedo` | `Ready` | `Self` | `DirectDataChange` | Add `+1` step to `Strength`, `Dexterity`, `Intelligence`, `Stamina`, and `Charisma` on self. | None. Use one `PrimaryStat:<Stat>:steps` payload per stat. |
| `Sanctify` | `Ready` | `Self`, `Actor` | `CreateActiveEffect` | Apply editable active effect `Sanctified` with duration. | None |
| `Shadow Attachment` | `Ready` | `Actor` | `CreateActiveEffect` | Apply editable active effect `Shadowed` with duration. | None. |
| `Shapeshifting` | `Ready` | `Self` | `CreateActiveEffect` | Apply editable active effect `Shape Changed` with duration. | Handled manually. |
| `Spirit Sight` | `Ready` | `Self` | `CreateActiveEffect` | Apply editable active effect `Spirit Sight` with duration. | None. |
| `Still Tongue` | `Ready` | `Actor` | `CreateActiveEffect` | Apply editable active effect `Silenced` with duration. | None. |
| `Tongue-Tying Knot` | `Ready` | `Actor` | `CreateActiveEffect` | Apply editable active effect `Silenced` with duration. | None. |
| `Transform Self` | `Ready` | `Self` | `DirectDataChange` | Add `+1` step to `Strength`, `Stamina`, and `Dexterity` on self. | None. Use one `PrimaryStat:<Stat>:steps` payload per stat. |
| `Truth Pressure` | `Ready` | `Actor` | `CreateActiveEffect` | Apply editable active effect `Truthful` with duration. | None. |
| `Uncertain Knot` | `Ready` | `Actor` | `CreateActiveEffect` | Apply editable active effect `Confused` with duration. | None. |
| `Withering Knot` | `Ready` | `Actor` | `CreateActiveEffect` | Apply editable active effect `Withering` with duration. | None. |

## Manual

| Spell | Status | Target | Resolution | Implementation | Blockers |
| --- | --- | --- | --- | --- | --- |
| `Angelic Boon` | `Manual` | `Self`, `Actor` | `RollTable` + chat | Roll on table `Angelic Boons` and present the selected boon in chat or as a manually applied effect. The spell now carries `SupportRollTable = AngelicBoons`. | Payload mapping is still needed if later automated beyond chat/manual resolution. |
| `Auspicious Timing` | `Manual` | `Self`, `Actor` | Chat result | Grants advantage during a specific turn, but leave the timing choice and effect application manual for now. | Manually handled. |
| `Banish` | `Manual` | `Actor` | Contest + chat | Make a contested `Power` check with double advantage against an Unnatural's `Power`; on success the being is banished. | Unnatural-only target and removal consequences are handled manually. |
| `Bind` | `Manual` | `Actor` | Contest + chat | Make a contested `Power` check with single advantage against an Unnatural's `Power`; show success or failure. | Unnatural-only target and binding consequences are handled manually. |
| `Black Sleep` | `Manual` | `Actor` | Chat or manual effect | Keep manual for now even though a `Sleep Touched` state is plausible later. | Intentionally not automated per author note. |
| `Command` | `Manual` | `Actor` | Contest + chat | Make a contested `Power` check with double advantage against an Unnatural's `Power`; show success or failure. | Unnatural-only target and obedience consequences are handled manually. |
| `Curse of Withering` | `Manual` | `Actor` | Chat + optional effect shell | Lower `MaxHitPoints` by `1` and apply indefinite `Withering`. | Further recurring decay is handled manually. |
| `Death Knots` | `Manual` | `Actor` | Chat + optional effect shell | Apply `Doomed` and reduce `MaxHitPoints` by `1`. | Manual handling after first effect. |
| `Evil Eye` | `Manual` | `Actor` | Contest + damage | Make a contested `Power` check; on success deal `1d3` HP loss. | Remove 1d3 Current Hit Points on target on success. |
| `Exorcism` | `Manual` | `Actor` | Contest + chat | Make a contested `Power` check with single advantage against an Unnatural's `Power`; show success or failure. | Unnatural-only target and expulsion consequences are handled manually. |
| `Faith Manipulation` | `Manual` | `Actor` | Direct loss | Lower target `FaithPoints` by `1d3`. | Use `AvailableFaithPoints` as the canonical target. |
| `Humoral Rebalancing` | `Manual` | `Self`, `Actor` | Removal flow | Remove harmful active effects manually. | Manually handled. |
| `Limbsnare` | `Manual` | `Actor` | Create effect | Apply a duration-based hindrance that lowers `DexterityDice` by `1`. | Create an active effect that lowers DexterityDice with 1 to a minimum of 1. |
| `Night Riding` | `Manual` | `Actor` | Contest + damage | Make a contested `Power` check with single advantage; on success deal `1d3` HP loss. | After the first damage, any longer oppression is handled manually. |
| `Nigredo` | `Manual` | `Self`, `Actor` | DirectDataChange or effect | Lower `Faith`, `Intelligence`, and `Charisma` by `2` steps. | Raw step changes. |
| `Possess` | `Manual` | `Actor` | Contest + effect | Make a contested `Power` check; on success apply editable effect `Possessed` with duration. | Possession control after application is handled manually. |
| `Refusal Rite` | `Manual` | `Actor` | Chat or manual effect | Keep manual for now. | Author explicitly wants no automation yet. |
| `Witch's Ladder` | `Manual` | `Actor`, `Item` | Manual combo spell | Use as a manual enabler for combining multiple knot effects. | Handled manually. |

## Deferred / Blocked

| Spell | Status | Target | Resolution | Implementation | Blockers |
| --- | --- | --- | --- | --- | --- |
| `Astral Projection` | `Blocked` | `Self` | `CreateActiveEffect` | Apply editable active effect `Astral` with duration and eventually allow travel through walls. | Handled manually for now. |
| `Break Binding` | `Blocked` | `Actor`, `Item` | `CreateActiveEffect`, `Hybrid` | Remove a binding from a person, object, or vessel. | Binding identity is handled manually, so the spell currently lacks a canonical runtime target to remove. |
| `Break Pact` | `Blocked` | `Actor` | Contest + chat | Make a contested `Power` check against `3d6` and report success/failure. | Pact identity is handled manually, so the spell currently lacks a canonical runtime target to remove. |
| `Break Seal` | `Blocked` | `Item`, `Area` | Contest + chat | Make a contested `Power` check against `3d6` and report success/failure. | Seal identity is handled manually, so the spell currently lacks a canonical runtime target to remove. |
| `Calcination` | `Manual` | `Item` | Removal flow | Remove poison, disease, and curse active effects from an item/substance target. | Item-side consequences are handled manually. |
| `Coagulation` | `Manual` | `Item` | Duration edit | Double the duration of one chosen active effect. | Duration changes are handled manually. |
| `Conjunction` | `Blocked` | `Item`, `BoundEntity` | `GrantItem`, `Hybrid` | Join substances or occult principles into a new object or being. | New object/being creation is still handled manually. |
| `Create Funeral Wax Candle` | `Blocked` | `Item` | `GrantItem` | Grant item `Item.GR9007QWbTWwuovE` to caster. | Depends on stable item UUID/import assumptions. |
| `Create Spirit Vessel` | `Blocked` | `Item` | `GrantItem` | Grant item `Item.PFL7Wa63zVffv4am` to caster. | Same stable item-reference dependency as above. |
| `Dissolution` | `Blocked` | `Item` | Manual | No automation for now. | Needs item-state breakdown semantics. |
| `Distillation` | `Manual` | `Item` | Manual | No automation for now. | Handled manually. |
| `Enchant Object` | `Blocked` | `Item` | Contest + chat | Contest against an Unnatural's `Power`; on success bind the being to the object. | Bound-being-to-item identity is still handled manually. |
| `Fermentation` | `Blocked` | `Item`, `BoundEntity` | Manual | No automation for now. | Consequences are handled manually. |
| `Glamour` | `Blocked` | `Self`, `Actor`, `Item` | `CreateActiveEffect` | Apply editable active effect `Glamour` with duration. | Consequences are handled manually. |
| `Golem` | `Blocked` | `Item`, `BoundEntity` | `GrantItem` | Create a construct servant or guardian. | Created entities are handled manually. |
| `Homunculus` | `Blocked` | `Item`, `BoundEntity` | `GrantItem` | Create an artificial servant being. | Created entities are handled manually. |
| `Iron Seal` | `Manual` | `Item`, `Area` | Manual | No automation for now. | Area/anchor consequences are handled manually. |
| `Metallic Transposition` | `Manual` | `Item` | Manual | No automation for now. | Handled manually. |
| `Seal` | `Manual` | `Item`, `Area` | Manual | No automation for now. | Area/anchor consequences are handled manually. |
| `Separation` | `Manual` | `Item` | Manual | No automation for now. | Handled manually. |
| `Simulacrum` | `Blocked` | `Item`, `BoundEntity` | `GrantItem` | Create an imitation being or copy-state. | Created entities are handled manually. |
| `Speak with the Dead` | `Blocked` | `Actor`, `BoundEntity` | Manual | Keep manual for now. | Narrative contact is primary; spirit-contact automation is not modeled. |
| `Summon Being` | `Blocked` | `BoundEntity`, `Actor` | Manual | Keep manual for now. | Created entities and summoned presences are handled manually. |
| `Wax Seal` | `Manual` | `Item` | Manual | No automation for now. | Handled manually. |

## Narrative

| Spell | Status | Target | Resolution | Implementation | Blockers |
| --- | --- | --- | --- | --- | --- |
| `Auspicious Prediction` | `Narrative` | `Descriptive` | `NarrativeOnly` | No automation. | None. |
| `Danger Sense` | `Narrative` | `Self` | `CreateActiveEffect` | Apply editable active effect `Danger Sense` with duration if a lightweight buff is wanted later. | Currently better treated as information-first magic. |
| `Divine Guidance` | `Narrative` | `Self`, `Actor` | `NarrativeOnly` | No automation. | None. |
| `Dream Interpretation` | `Narrative` | `Descriptive` | `NarrativeOnly` | No automation. | None. |
| `Find the Culprit` | `Narrative` | `Descriptive` | `NarrativeOnly` | No automation. | None. |
| `Find What Is Lost` | `Narrative` | `Descriptive` | `NarrativeOnly` | No automation. | None. |
| `Grave Dreaming` | `Narrative` | `Descriptive` | `NarrativeOnly` | No automation. | None. |
| `Object Memory` | `Narrative` | `Descriptive` | `NarrativeOnly` | No automation. | None. |
| `Planetary Invocation` | `Narrative` | `Self`, `Actor` | `NarrativeOnly` | No automation. | None. |
| `Prophecy` | `Narrative` | `Descriptive` | `NarrativeOnly` | No automation. | None. |
| `Prospect Reading` | `Narrative` | `Descriptive` | `NarrativeOnly` | No automation. | None. |
| `Reading` | `Narrative` | `Descriptive` | `NarrativeOnly` | No automation. | None. |
| `Rewrite the Past` | `Narrative` | `Descriptive`, `Actor` | `NarrativeOnly` | No automation. | None. |
| `Scrying` | `Narrative` | `Descriptive` | `NarrativeOnly` | No automation. | None. |
| `Threshold Awareness` | `Narrative` | `Self` | `CreateActiveEffect` | Apply editable active effect `Threshold Sense` with duration if later needed. | Currently better treated as information-first magic. |
| `Wind Knot` | `Narrative` | `Descriptive` | `NarrativeOnly` | No automation. | None. |
| `Zone Travel` | `Narrative` | `Descriptive` | `NarrativeOnly` | No automation. | None. |

## First Automation Wave

If implementation time is limited, prioritize in this order:

1. stat and condition spells
2. curse and blessing spells
3. control, silence, sleep, and immobilization spells
4. cleansing, banishment, and exorcism spells
5. item blessing and sealing spells

## Follow-Up Trackers

After the first wave is stable, add:

- explicit `Done` markers per spell
- exact payload targets for each `DirectDataChange` that still remains ambiguous
- links to any new editable spell active effect definitions
- links to tests or manual verification scenarios for each spell family
