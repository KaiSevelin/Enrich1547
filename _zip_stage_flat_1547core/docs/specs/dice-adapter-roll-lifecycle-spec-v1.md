# Dice Adapter / Roll Lifecycle Spec V1

## Purpose

This document defines how `1547Core` integrates with `dice1547` at runtime through
an adapter, an in-memory pending request registry, and service-bus lifecycle events.

## Responsibilities

### Dice Adapter Owns

- pending roll registry
- request ids
- request-to-message correlation
- result normalization
- hook/API integration with `dice1547`

### Combat Owns

- deciding what to roll
- consuming normalized results
- continuing action resolution

### Service Bus Owns

- lifecycle notifications
- observers reacting to roll progress

The bus does not replace the registry.

## Registry Policy

- pending roll registry is in memory only
- no persistence between reloads is required in V1

## Bus Events

Recommended event names:

- `dice:roll-requested`
- `dice:roll-executing`
- `dice:roll-message-created`
- `dice:roll-result-received`
- `dice:roll-resolved`
- `dice:roll-failed`

## Roll Lifecycle

1. Combat creates logical roll request
2. Adapter stores request in pending registry
3. Adapter emits `dice:roll-requested`
4. Adapter executes external roll
5. Adapter links `chatMessageId`
6. Hook or API returns result
7. Adapter normalizes face-aware result
8. Adapter emits `dice:roll-resolved`
9. Combat continues resolution

## Hook Handling

When `dice1547RollResult` fires:

1. Receive `(result, message)`
2. Find registry entry by `message.id`
3. Store raw result
4. Normalize filtered/final totals
5. Emit lifecycle events

Unknown messages are ignored or logged for debugging.

## Lookup Fallback

If the hook is missed, adapter may call:

```ts
api.getRollResult(messageOrId)
```

to recover raw results.

## Normalized Result

Recommended normalized result shape:

```js
{
  requestId,
  actionId,
  rollKind,
  actorId,
  targetId,
  chatMessageId,
  attackMode,
  rawTotals,
  filteredTotals,
  finalTotals,
  multiplierFactor,
  dice: []
}
```

## Group Attacks

For group attacks:

- one shared attack request
- one defense request per target
- combat waits for one shared attacker result and all defender results

Registry relationship:

```js
{
  actionId,
  sharedAttackRequestId,
  defenseRequestIdsByTarget: {}
}
```

## Timeout Rule

- default timeout is 5 seconds
- timeout must be configurable

If required roll results are not available by timeout, mark request or group bundle
as failed and emit `dice:roll-failed`.

## Ignore Reason Collection

If multiple filters match the same face or die:

- collect all ignore reasons
- the face is ignored once

This preserves auditability.

## Key Design Choice

Use the service bus for lifecycle orchestration, not as the primary request store.
