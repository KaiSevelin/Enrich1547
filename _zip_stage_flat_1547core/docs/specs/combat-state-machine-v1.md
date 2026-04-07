# Combat State Machine V1

## Scope

This document defines the formal state-machine structure for combat:

- Combat machine
- Side activation machine
- Action machine
- Reaction window machine
- Post-maneuver machine

## Combat Machine

### States

- `idle`
- `combat_start`
- `initiative_resolved`
- `side_activation`
- `side_transition`
- `combat_end`

### Transitions

| Current State | Event | Guard | Next State | Side Effects |
|---|---|---|---|---|
| `idle` | `START_COMBAT` | combatants exist | `combat_start` | initialize combat state and round state |
| `combat_start` | `ROLL_INITIATIVE` | valid sides exist | `initiative_resolved` | roll side initiative once and persist side order |
| `initiative_resolved` | `OPEN_SIDE_ACTIVATION` | winning side exists | `side_activation` | set active side |
| `side_activation` | `END_SIDE_ACTIVATION` | end-group-turn requested | `side_transition` | close current side |
| `side_transition` | `ACTIVATE_NEXT_SIDE` | another side remains | `side_activation` | activate next side |
| `side_transition` | `ACTIVATE_NEXT_SIDE` | no side remains | `side_activation` | increment round and activate first side in stored initiative order |
| any | `END_COMBAT` | always | `combat_end` | finalize combat |

## Initiative Rule

Initiative is rolled once when combat starts.

It is not rerolled each round.

After the last side finishes a round:

- round number increments
- actor round state resets
- the first side in the stored initiative order activates again

## Side Activation Machine

### State

```js
{
  sideId,
  actorDone: {
    [actorId]: true | false
  },
  open: true
}
```

`actorDone` is informational and supports player coordination. It is not the
formal condition for ending a side activation.

### States

- `open`
- `resolving_action`
- `checking_done`
- `closed`

### Transitions

| Current State | Event | Guard | Next State | Side Effects |
|---|---|---|---|---|
| `open` | `DECLARE_ACTION` | actor on active side and not done | `resolving_action` | create action context |
| `resolving_action` | `ACTION_FINISHED` | action terminal | `checking_done` | persist outcome |
| `open` | `MARK_ACTOR_DONE` | actor on active side | `open` | set done true |
| `open` | `UNMARK_ACTOR_DONE` | actor on active side | `open` | set done false |
| `open` | `END_GROUP_TURN` | requested by active side controller | `closed` | close side |

## Action Machine

### States

- `declared`
- `validated`
- `reserved`
- `pre_reaction_window`
- `resolving`
- `post_reaction_window`
- `post_maneuver_window`
- `committed`
- `cancelled`
- `cleanup`

### Transitions

| Current State | Event | Guard | Next State | Side Effects |
|---|---|---|---|---|
| `declared` | `VALIDATE` | action legal | `validated` | none |
| `declared` | `VALIDATE` | action illegal | `cancelled` | record reason |
| `validated` | `RESERVE_COSTS` | costs exist | `reserved` | reserve resources |
| `validated` | `OPEN_PRE_REACTIONS` | no costs | `pre_reaction_window` | open reactions |
| `reserved` | `OPEN_PRE_REACTIONS` | always | `pre_reaction_window` | open reactions |
| `pre_reaction_window` | `RESOLVE_ACTION` | reactions resolved | `resolving` | resolve move/attack/full-turn |
| `resolving` | `OPEN_POST_REACTIONS` | post reactions legal | `post_reaction_window` | open reactions |
| `resolving` | `OPEN_POST_MANEUVERS` | no post reactions and attack | `post_maneuver_window` | open crit spending |
| `post_reaction_window` | `OPEN_POST_MANEUVERS` | attack action | `post_maneuver_window` | defender first |
| `post_reaction_window` | `COMMIT_ACTION` | non-attack action | `committed` | finalize |
| `post_maneuver_window` | `COMMIT_ACTION` | post windows resolved | `committed` | spend/release reservations |
| any pre-`committed` | `CANCEL_ACTION` | cancellation legal | `cancelled` | release reservations |
| `committed` | `CLEANUP_ACTION` | always | `cleanup` | clear temp state |
| `cancelled` | `CLEANUP_ACTION` | always | `cleanup` | clear temp state |

## Reaction Window Machine

### States

- `closed`
- `open`
- `selection_resolved`
- `applied`
- `skipped`

### Transitions

| Current State | Event | Guard | Next State | Side Effects |
|---|---|---|---|---|
| `closed` | `OPEN_WINDOW` | reactions allowed | `open` | gather candidates |
| `open` | `SELECT_REACTION` | selection legal | `selection_resolved` | mark maneuver used |
| `open` | `SKIP_REACTION` | no selection | `skipped` | none |
| `selection_resolved` | `APPLY_REACTION` | always | `applied` | mutate action or apply effect |
| `applied` | `CLOSE_WINDOW` | always | `closed` | return to action flow |
| `skipped` | `CLOSE_WINDOW` | always | `closed` | return to action flow |

## Post-Maneuver Machine

### States

- `closed`
- `defender_open`
- `attacker_open`
- `resolved`

### Transitions

| Current State | Event | Guard | Next State | Side Effects |
|---|---|---|---|---|
| `closed` | `OPEN_DEFENDER_POST` | defender has legal post maneuvers | `defender_open` | expose defender options |
| `closed` | `OPEN_ATTACKER_POST` | defender has none and attacker has some | `attacker_open` | expose attacker options |
| `defender_open` | `DEFENDER_DONE` | always | `attacker_open` or `resolved` | spend defender crits |
| `attacker_open` | `ATTACKER_DONE` | always | `resolved` | spend attacker crits |
| `resolved` | `CLOSE_POST_WINDOW` | always | `closed` | clear remaining crits |

## Notes

- Done is an optional coordination marker for actors on the active side.
- Group turn transition is controlled by `END_GROUP_TURN`.
- Safe attacks suppress reaction/crit/fumble generation.
- Entering a threatened square commits the actor into that square before reaction resolution.
