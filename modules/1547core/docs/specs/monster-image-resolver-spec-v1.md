# Monster Image Resolver Spec V1

## Purpose

This document defines how composed monster actors choose a portrait/image
without using `Image` Changes inside the ChangeSet pipeline.

The goal is to let shared composition concepts such as `Domain: Fire` produce
different portraits for different monster families. A fire-aligned
`HiddenFolk` should not automatically look like a fire-aligned `TheUnseen`.

## Why `Image` was removed from Changes

`Image` was the least composable Change kind:

- multiple ChangeSets could each try to replace the portrait
- precedence became arbitrary
- shared domains could not safely reuse the same thematic layer across
  different monster families
- random portrait rolls fought against authored base portraits

Portrait selection is therefore derived from the final composed actor state,
not granted by an atomic Change.

## Boundary rule

- ChangeSets may change mechanics, tags, traits, text, and granted items.
- ChangeSets do not directly set portraits.
- Portraits are resolved after composition from the actor's resulting state.

## Resolver inputs

The resolver may inspect:

- `flags["1547core"].portraitOverride` / `flags["1547core"].portraitKey`
- `actor.system.props.TypeDropdown` and `PortraitKey`
- the actor's attached ChangeSets (Role / Domain concepts, extracted from the
  set name's leading segment, e.g. `Wolf (Beast)` → `Wolf`)
- the portrait registry world setting `1547core.portraitRegistry` — a flat
  map of colon-delimited keys to image paths, populated by Setup Data from
  `foundry/Templates/portrait-registry.json`
- `actor.img`

## Resolution order (implemented)

1. explicit actor-level portrait override (`portraitOverride` flag)
2. `PortraitKey` (flag or actor prop) looked up in the registry
3. `Type:Domain:Role` registry lookup
4. `Type:Role`
5. `Type:Domain`
6. `Type`
7. actor base image `actor.img`
8. `icons/svg/mystery-man.svg`

`VisualTheme` remains a future extension.

## Current runtime contract

Service: `services/monster-image-resolver-service.js`

API:

```js
game.modules.get("1547core").api.imageResolver.resolveMonsterImage(actor)
game.modules.get("1547core").api.imageResolver.applyResolvedMonsterImage(actor)
```

- `resolveMonsterImage(actor)` walks the ladder above and returns a path.
  Read-only; safe to call from display code (the HUD summary uses it).
- `applyResolvedMonsterImage(actor)` resolves and then writes the result onto
  `actor.img` and `prototypeToken.texture.src` — but only fields still on the
  mystery-man default (or empty). A portrait or token the GM set by hand is
  never overwritten. Returns the resolved path when anything was written,
  `null` otherwise.

The monster wizard calls `applyResolvedMonsterImage` right after ChangeSets
are attached and cascaded, so a wizard-built monster gets its registry
portrait (e.g. `Beast` + `Wolf (Beast)` role → `Beast:Wolf`) instead of
shipping with the mystery-man icon.

## Authoring guidance

- author portraits in `foundry/Templates/portrait-registry.json` under
  composition keys (`Beast`, `Beast:Wolf`, `Beast:Wood`, ...); run Setup Data
  to push them into the world setting
- for a one-off named monster, set `PortraitKey` (actor prop or flag) or the
  `portraitOverride` flag
- do not author `Image` Changes in ChangeSets
- let shared domains remain mechanical/thematic only

## Example

Shared domain concept:

- `Fire`

Different portrait outcomes:

- `HiddenFolk + Fire` -> ember-thin, local, uncanny hidden being
- `TheUnseen + Fire` -> majestic smokeless-fire sovereign or jinn-like noble

Both can share mechanical domain logic while presenting different imagery.
