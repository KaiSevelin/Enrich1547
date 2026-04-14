# 1547 Core Manual Foundry Test Plan v1

## Purpose

This deploy checklist should only test the behavior changed since the last deployment, plus a minimal console/regression sanity check.

## Build

- [x] Version noted
- [x] Date noted
- [x] Tester noted

## Current Deployment Checks

- [x] Selecting a token opens the HUD with no `effectiveWeaponRollContext` or `hud-summary.js` runtime error
- [ ] Out of combat, targeting an actor and pressing `Attack` now performs a real targeted attack flow
- [ ] Out of combat, pressing `Attack` with no target still only rolls to chat
- [ ] Selecting a pre-maneuver that adds dice updates `Overview -> Attack Dice` immediately
- [ ] `Attack Dice` shows maneuver-added `Main Dice`, `Multiplier`, `Advantage`, or `Risk` when relevant

## Minimal Regression Check

- [ ] Default `Unarmed` / `Unprotected` fallback still appears correctly when nothing is equipped
- [x] No red console errors during this focused pass

## Notes

- New bugs / odd behavior: (Out of combat)
- Still only shows declared attack, no actual attack
- Attack dice is not updated
- Missing several maneuvers such as act of strength from the maneuver list