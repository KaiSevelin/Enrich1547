# Combat Resolution Loop Spec v1

## Purpose

This document defines the minimum playable combat loop for `1547Core`.

It is the bridge between the plain-language combat rules and later automation
handlers.

The goal is to make one attack or move resolution fully deterministic in terms
of timing, windows, and state changes.

## Scope

This spec covers:

- move declaration and movement commitment
- attack declaration and attack commitment
- weapon profile selection
- pre-maneuver attachment
- reaction windows
- simultaneous attack and defense rolls
- damage application
- damage-taken reactions
- post-maneuver spending
- action-economy commit timing

This spec does not define:

- full UI layout
- detailed dice syntax
- handler internals
- campaign-level content gating

## Core Principle

An action is declared first and commits last.

That means:

- legality is checked before the roll
- costs may be reserved before the roll
- reactions may change the pending action
- action economy is only spent when the action commits

## Move Resolution Loop

The minimum move loop is:

1. actor declares movement
2. system checks remaining movement budget
3. actor chooses path square by square
4. attached movement pre-maneuvers are declared
5. any movement costs are reserved
6. when movement crosses a legal reaction point, open a movement reaction window
7. reacting side chooses one legal reaction if any exist
8. that reaction resolves fully
9. if movement continues, repeat reaction checks square by square
10. movement ends when the actor stops, runs out of movement, or a reaction
    stops movement
11. reserved costs are spent or released
12. moved distance commits against movement budget

## Attack Resolution Loop

The minimum attack loop is:

1. actor declares an attack
2. actor selects one ready weapon and one legal attack profile
3. system verifies the target is legal for that profile and range
4. actor declares any legal attached pre-maneuvers
5. pre-maneuver costs are reserved
6. all legal pre effects are merged into one pending attack state
7. open the attack reaction window
8. reacting side chooses one legal reaction if any exist
9. that reaction resolves fully
10. attacker and defender build final roll pools
11. attacker and defender roll simultaneously
12. resolve roll filters and net modifiers
13. apply multiplier results
14. calculate damage and protection
15. apply damage
16. open damage-taken reaction window
17. resolve one legal damage-taken reaction if chosen
18. open post-maneuver window for defender
19. defender may spend legal `CriticalPoints`
20. open post-maneuver window for attacker
21. attacker may spend legal `CriticalPoints`
22. clear remaining `CriticalPoints`
23. reserved pre costs are spent or released
24. attack commits and spends action economy

## Weapon Profile Selection

If a weapon has more than one attack profile:

- the attacker chooses the profile at attack declaration
- the chosen profile becomes part of the pending attack state
- the first die in that profile is the `main die`
- all legality checks for the attack use the chosen profile

Profile selection happens before pre-maneuvers are attached.

## Range Legality

For melee attacks:

- legality uses the weapon's `minReach` and `maxReach`

For ranged attacks:

- attacks at `shortRange` are normal
- attacks beyond `shortRange` and up to `longRange` are legal but disadvantaged
- attacks beyond `longRange` are illegal unless a special maneuver or rule
  explicitly allows use of `maxRange`

## Pending Action State

Before commit, the resolver should treat the declared move or attack as a
pending action state.

For attacks, the pending state should include at least:

- acting actor
- target or targets
- selected weapon
- selected weapon profile
- safe-attack flag
- pre-maneuvers
- reserved costs
- net attack modifiers
- reaction modifications

For movement, the pending state should include at least:

- acting actor
- planned path
- moved squares so far
- attached movement pre-maneuvers
- reserved costs
- reaction suppression flags

## Reaction Windows

Each reaction window follows the same minimum procedure:

1. core opens the window with a specific trigger
2. legal reactions are filtered for the reacting side
3. the reacting side chooses one legal reaction or passes
4. the chosen reaction resolves fully
5. that reaction cannot generate further reactions
6. window closes

If multiple actors on one side can react, that side chooses which actor reacts.

## Damage-Taken Window

After damage is applied, but before post-maneuvers:

- damage-taken reactions may resolve
- the defender must still be a legal user for that reaction
- the chosen damage-taken reaction resolves fully
- no further reactions are created by that reaction

## Post-Maneuver Window

The post-maneuver window is always:

1. defender side first
2. attacker side second

Only maneuvers that are legal for:

- the current attack result
- the current weapon
- the current target state
- the currently available `CriticalPoints`

may appear in that window.

When the post-maneuver window closes:

- all remaining `CriticalPoints` from that attack are cleared

## Commit Rules

An action commits only after all of its timing windows are closed.

At commit:

- reserved costs become spent if the effect was used
- unused reservations are released
- move distance is deducted from movement budget
- attack availability is deducted from the actor
- full-turn availability is deducted if relevant

If the action never reaches commit:

- reserved costs are released
- uncommitted action economy remains available

## First Automation Goal

The first automation target for this loop is:

- declare action
- compute legal options
- resolve one reaction window
- roll attack and defense
- apply damage
- resolve post-maneuver legality
- commit state cleanly

That is enough for a first playable combat pass.
