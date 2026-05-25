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

- `actor.img`
- `actor.system.props.TypeDropdown`
- effective composition state from `composition.getEffectiveActorCached(actor)`
- future metadata keys such as `PortraitKey` or `VisualTheme`

Current implementation only relies on `actor.img` plus a fallback icon.

## Resolution order

Recommended long-term order:

1. explicit actor-level portrait override
2. `PortraitKey`
3. `VisualTheme`
4. `Type + Domain + Role/Office`
5. `Type + Domain`
6. `Type`
7. actor base image `actor.img`
8. `icons/svg/mystery-man.svg`

Current implemented order:

1. explicit actor-level portrait override
2. actor base image `actor.img`
3. `icons/svg/mystery-man.svg`

## Current runtime contract

Service: `services/monster-image-resolver-service.js`

API:

```js
game.modules.get("1547core").api.imageResolver.resolveMonsterImage(actor, options?)
```

Current behavior:

- returns `flags["1547core"].portraitOverride` if present
- otherwise returns `actor.img`
- otherwise returns `icons/svg/mystery-man.svg`

## Authoring guidance

For now:

- set a sensible base portrait directly on the actor
- do not author `Image` Changes in ChangeSets
- let shared domains remain mechanical/thematic only

Later, if type-aware portrait variation is needed, add portrait metadata such
as `PortraitKey` or `VisualTheme` to the composed actor context and let the
resolver interpret it.

## Example

Shared domain concept:

- `Fire`

Different portrait outcomes:

- `HiddenFolk + Fire` -> ember-thin, local, uncanny hidden being
- `TheUnseen + Fire` -> majestic smokeless-fire sovereign or jinn-like noble

Both can share mechanical domain logic while presenting different imagery.
