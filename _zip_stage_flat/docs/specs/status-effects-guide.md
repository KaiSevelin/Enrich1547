# Status And Effects Guide

## Purpose

This document formalizes the actor conditions, persistent effects, and visible
combat-state trackers implied by the current `1547Core` combat and maneuver
rules.

It separates 3 different kinds of state:

- conditions
- persistent effects
- combat trackers
- battlefield effects

These should not be mixed together in Foundry even if they may all appear in the
HUD.

## State Categories

### Conditions

Conditions are actor states that directly affect legality, attacks, defense,
movement, or escape rules.

Conditions remain active until something explicitly removes them or combat ends
if that is the defined expiry.

### Persistent Effects

Persistent effects are maneuver-created ongoing states.

They usually come from `full-turn` maneuvers or ongoing control maneuvers and
they expire by timing or by being consumed.

Some persistent effects also belong to a prepared-effect family.

Prepared effects are setup states that grant a later tactical benefit, but they
are spoiled if the owner becomes the target of an attack unless a later rule
explicitly says otherwise.

### Combat Trackers

Combat trackers are not conditions.

They are visible combat state such as points, usage flags, or informational
markers.

They may be shown in the HUD, but they should not be treated as statuses.

### Battlefield Effects

Battlefield effects are area-based ongoing states.

They are not personal actor conditions even if they affect actors standing
inside them.

They should be tracked separately from actor conditions and separately from
actor-owned persistent effects.

Each battlefield effect should define:

- a source actor or source effect
- a legal area
- a duration or expiry rule
- the rule applied while actors remain inside the area
- how the effect ends or is cleared early

## Equipment State

Some combat outcomes should be modeled as equipment state rather than as actor
conditions.

The clearest current example is `disarm`.

`Disarm` should be modeled by:

- removing the weapon from ready or equipped combat use
- placing the weapon on the battlefield
- requiring the actor to recover and ready a weapon again before using it

If the dropped weapon is no longer in the actor's square, the actor must move to
the weapon before a later readying action can restore it to combat use.

Reloading should be modeled on weapon items rather than as an actor condition.

That means reload progress, readiness, and loading state should live on the
weapon or attack item that is being reloaded.

This should not require a separate `disarmed` condition if equipment readiness
and dropped-item state are already tracked correctly.

## Conditions

### Prone

- Type: `condition`
- Applied by:
  - `Throw`
  - `Hook`
- Removed by:
  - standing up by spending `2` squares of movement during a later movement or
    recovery action
  - any later rule or handler that explicitly removes `prone`
- Rules impact:
  - actor is on the ground
  - standing up costs `2` squares of movement
  - maneuvers may check for `prone`
  - `Evade` cannot be used while prone

### Locked

- Type: `condition`
- Applied by:
  - `Lock`
- Removed by:
  - successful escape from the lock
  - any later rule or handler that explicitly removes `locked`
- Rules impact:
  - locked actor has disadvantage on attack rolls
  - locked actor has disadvantage on defense rolls
  - escape uses the shared later-action opposed-roll procedure
  - both sides may use `Strength` or `Dexterity` for that opposed roll
  - maneuvers may require the target to already be locked
  - `Evade` cannot be used while locked

### Choking Hold

- Type: `condition`
- Applied by:
  - `Choke`
- Removed by:
  - successful escape using the same process as a normal lock
  - any later rule or handler that explicitly removes `choking-hold`
- Rules impact:
  - replaces or upgrades a lock into a tighter control state
  - escape uses the same shared later-action opposed-roll procedure as `Lock`
  - while active, the controller may make one free safe unarmed attack during
    each later side activation in which the hold is maintained
  - maneuvers may check for `choking-hold`

### Unconscious

- Type: `condition`
- Applied by:
  - `Sap` if the hidden nonlethal attack meets its success requirement
- Removed by:
  - any later healing, aid, or recovery rule that explicitly removes
    `unconscious`
- Rules impact:
  - actor is unable to act normally
  - actor should not be offered ordinary combat actions while unconscious

### Hidden

- Type: `condition`
- Applied by:
  - stealth setup outside this combat document
  - any later rule or handler that explicitly applies `hidden`
- Removed by:
  - being revealed by attack, detection, or any explicit reveal rule
- Rules impact:
  - required by `Sap`
  - required by `Assassinate`

### Mounted

- Type: `condition`
- Applied by:
  - mounted state from actor or scene setup
- Removed by:
  - dismounting
  - `Hook` when used to dismount a mounted target
- Rules impact:
  - required by `Charge`
  - `Hook` can target mounted actors differently

## Persistent Effects

### Overwatch

- Type: `persistentEffect`
- Family: `preparedEffect`
- Applied by:
  - `Overwatch`
- Removed by:
  - expiry when that same side becomes active again
  - any later handler or rule that explicitly clears `overwatch`
- Rules impact:
  - owner watches a chosen area
  - enemies entering the area may be attacked
  - loading weapons may attack only `1` target while the effect lasts
  - overwatch attacks gain advantage
  - if the owner becomes the target of an attack, `overwatch` is spoiled and the
    persistent effect is removed unless a later rule explicitly says otherwise

### Aimed

- Type: `persistentEffect`
- Family: `preparedEffect`
- Applied by:
  - `Aim`
- Removed by:
  - being consumed by the next legal aimed attack
  - expiry when that same side becomes active again
  - any later rule or handler that explicitly clears `aimed`
- Rules impact:
  - the next legal aimed attack gains advantage
  - if the owner becomes the target of an attack before using the effect,
    `aimed` is spoiled and the persistent effect is removed unless a later rule
    explicitly says otherwise

### Braced

- Type: `persistentEffect`
- Family: `preparedEffect`
- Applied by:
  - `Brace`
- Removed by:
  - expiry when that same side becomes active again
  - any later rule or handler that explicitly clears `braced`
- Rules impact:
  - attacks with the braced weapon gain `1` multiplier die while the effect
    remains active
  - if the owner becomes the target of an attack, `braced` is spoiled and the
    persistent effect is removed unless a later rule explicitly says otherwise

## Future Battlefield Effects

These are not yet fully formalized conditions or persistent effects, but they
fit the current rules direction and should be considered when battlefield-state
rules are expanded.

### Obscured

- Type: `battlefieldEffect`
- Possible sources:
  - smoke
  - dust
  - terrain
  - weather
- Intended rules direction:
  - ranged targeting through the obscured area is reduced, blocked, or made less
    accurate
  - `Overwatch` may fail to trigger through obscured lines
  - `Aim` may be prevented or spoiled if the intended target becomes obscured

## Combat Trackers

### RiskPoints

- Type: `combatTracker`
- Applied by:
  - roll fumbles
  - maneuvers such as `Push Of Pike`
  - maneuvers such as `Desperate Defense`
- Removed by:
  - automatic conversion into `risk` dice on the next eligible attack or defense
    roll
  - combat end
  - `Catch Breath`
- Rules impact:
  - each stored `RiskPoint` becomes one `risk` die on the actor's next eligible
    attack or defense roll
  - all stored `RiskPoints` are consumed on that one roll

### CriticalPoints

- Type: `combatTracker`
- Applied by:
  - crit results generated during one attack resolution
- Removed by:
  - being spent on post-maneuvers
  - automatic clearing when the post-maneuver window closes
- Rules impact:
  - used only during the current post-maneuver window
  - defender spends first
  - attacker spends second

### Full-Turn Availability

- Type: `combatTracker`
- Applied by:
  - actor round-state initialization
- Removed by:
  - committing a full-turn maneuver
  - round reset
- Rules impact:
  - determines whether a full-turn maneuver is still legal for that actor in the
    current round

### Maneuver Usage

- Type: `combatTracker`
- Applied by:
  - using a maneuver
- Removed by:
  - side-based turn reset
  - round reset if that is how the implementation stores it
- Rules impact:
  - each individual maneuver can only be used once per side-based turn unless a
    later rule explicitly overrides that limit

### Done Marker

- Type: `combatTracker`
- Applied by:
  - player or HUD coordination choice
- Removed by:
  - player or HUD coordination choice
  - round reset
- Rules impact:
  - informational only
  - does not formally end side activation

## Battlefield Effects

### Suppressing Fire

- Type: `battlefieldEffect`
- Applied by:
  - `Suppressing Fire`
- Removed by:
  - expiry at the end of the current round, or when the effect's defined timing
    window closes
  - any later rule or handler that explicitly clears `suppressing-fire`
- Rules impact:
  - affects the chosen `5x5` area
  - enemies within the area can move only `1` square while the effect remains
    active
  - should be tracked as an area effect tied to its source actor, not as a
    status on each affected actor
  - if multiple battlefield effects overlap, each effect should check its own
    legality and timing rather than being merged implicitly

## Foundry Guidance

In Foundry, these categories should be represented separately:

- `conditions`
- `persistentEffects`
- `combatTrackers`
- `battlefieldEffects`

Recommended UI behavior:

- conditions show clear gameplay restrictions or vulnerabilities
- persistent effects show source, remaining duration, and key rules text
- combat trackers show numeric values or simple availability state
- battlefield effects show area, source, duration, and the rule they apply while
  actors remain inside

## Summary

Current formalized state in the rules consists of:

- conditions: `prone`, `locked`, `choking-hold`, `unconscious`, `hidden`,
  `mounted`
- persistent effects: `overwatch`, `aimed`, `braced`
- combat trackers: `RiskPoints`, `CriticalPoints`, full-turn availability,
  maneuver usage, and `done`
- battlefield effects: `suppressing-fire`
