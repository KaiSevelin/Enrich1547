# 1547 Core Manual Foundry Test Plan v1

## Purpose

This deploy checklist should only test the behavior changed since the last deployment, plus a minimal console/regression sanity check.

## Build

- [x] Version noted: `0.0.83`
- [x] Date noted
- [x] Tester noted

## Current Deployment Checks

- [x] Selecting a token opens the HUD with no `effectiveWeaponRollContext` or `hud-summary.js` runtime error
- [ ] Out of combat, targeting an actor and pressing `Attack` now performs a real targeted attack flow

Can not read attack roll message

- [x] Out of combat, pressing `Attack` with no target still only rolls to chat
- [ ] Selecting a pre-maneuver that adds dice updates `Overview -> Attack Dice` immediately

Maneuvers are marked with No matching action is currently available for this maneuver

- [ ] `Attack Dice` shows maneuver-added `Main Dice`, `Multiplier`, `Advantage`, or `Risk` when relevant

Change the layout to have a + and a minus button that increments and decrements a label with number of dice.

Roll and add is not clickable

Tooltip on dice should show a list of the dice face values

## Minimal Regression Check

- [ ] Default `Unarmed` / `Unprotected` fallback still appears correctly when nothing is equipped
- [ ] No red console errors during this focused pass

## Notes

- Targeted HUD attack flow now waits briefly for `dice1547` roll results before resolving the attack outcome.
- HUD maneuver entries are rendered as selectable rows and should update `Overview -> Attack Dice` when chosen.
- Verify whether missing maneuvers such as `Act of Strength` are intentionally excluded by timing/filter rules or still absent unexpectedly.

