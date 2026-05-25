# ADR-0001: CSB data shape — what we know and rely on

**Status**: accepted
**Date**: 2026-05-25
**Context for**: anything that reads CSB item data (composition, item-grant,
rolltable resolution, changeset drop validation, HUD summary).

## Background

The 1547core monster-maker pipeline shipped 0.0.85 with mocked unit tests that
assumed CSB nested children inside their parent item (`set.items`). In reality
CSB v5.2 lays things out differently. Versions 0.0.89 → 0.0.94 each fixed a
distinct shape quirk that hadn't been documented. This ADR pins down what we
verified so the next time CSB changes shape, we know what to retest.

## Decisions / verified facts

Each fact below was confirmed via console probes on the live sqyre instance
during the 0.0.89 → 0.0.94 debugging cycle.

### 1. CSB itemContainer children are siblings, not nested

Foundry items do not have an `.items` collection. CSB stores itemContainer
children as **separate items on the same actor**, linked from the parent via
a key on its `system.props`:

```js
parentItem.system.props.ChangeDisplayer = {
  "<childItemId>": { name: "...", id: "...", uuid: "..." },
  ...
}
```

The keys are item ids; `actor.items.get(id)` resolves each child. The inner
display object is CSB's own cache and can show `"ERROR"` when CSB couldn't
resolve at write time. The id key is still the source of truth.

Helper: [`services/csb-container-helpers.mjs`](../../scripts/services/csb-container-helpers.mjs)
`getContainerChildItems(set, actor, containerKey, expectedTemplateId)`.

### 2. CSB ref fields use the same object-keyed shape

Single-value reference fields (`ItemGrantRef`, `SkillRef`,
`RequirementSkillRef`) store the same shape:

```js
change.system.props.ItemGrantRef = {
  "<sourceItemId>": { name: "...", id: "...", uuid: "..." }
}
```

`refValue?.[0]` always returns `undefined`. Always extract via
`firstRefId(refValue)` (`Object.keys(refValue)[0]`).

### 3. Dragging into a ref field creates a copy on the actor

When you drag an item into an `ItemGrantRef` field on a Change that's open
on an actor sheet, CSB creates a copy of that item on the actor with a new
id, and stores the new id in the ref. The original world item is untouched.
Therefore source-resolution must check the reconciling actor's own items
**first**, before falling back to `game.items` and other actors.

Helper: [`item-grant-service.js`](../../scripts/services/item-grant-service.js)
`defaultResolveSource(id, actor)`.

### 4. `system.container` is a back-pointer that suppresses inventory rendering

CSB sets `item.system.container = <parentItemId>` on items that were dropped
into another item's itemContainer field. The actor sheet's inventory panels
filter items by template **and** by this back-pointer: an item with
`container` set to the wrong id won't render in the actor's Weapons / Armor /
etc. panels (it renders only inside the parent container's field display).

When the reconciler copies a source to create a grant, it must **strip
`system.container`** so the granted copy lands in the actor's main inventory.

### 5. CSB uses two flag namespaces — both must be read

CSB writes to `flags["1547Core"]` (capital C) via the schema-migration. Our
own code writes to `flags["1547core"]` (lowercase). Probes for `sourceData`
or similar must check both:

```js
const source =
  item.flags?.["1547Core"]?.sourceData ??
  item.flags?.["1547core"]?.sourceData ??
  item;
```

This convention is followed by `combat/normalisation.mjs` and the
schema-migration.

## Consequences

- All pipeline modules import from `csb-container-helpers.mjs` to walk
  linkage and extract refs — never read `system.props.<Container>` or
  `props.*Ref` directly.
- The item-grant reconciler's `defaultResolveSource` is the only "I'll look
  for this id anywhere" function. New ref-following code should reuse it.
- Stripping `system.container` is currently inline in `item-grant-service.js`.
  If a second reconciler ever copies items, factor that into the helpers.
- When CSB v5.3+ ships, run the probes in
  [`docs/specs/monster-maker-spec-v1.md`](../specs/monster-maker-spec-v1.md)
  to verify these facts still hold.

## Related

- `services/csb-container-helpers.mjs`
- `services/item-grant-service.js`
- `services/composition-service.mjs`
- `combat/normalisation.mjs` (reads CSB sourceData flags)
