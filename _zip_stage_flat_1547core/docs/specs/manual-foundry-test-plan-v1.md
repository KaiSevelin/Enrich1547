# 1547 Core Manual Foundry Test Plan v1

## Build
- [ ] Version noted: `0.0.61`
- [ ] Date noted
- [ ] Tester noted

## Recently Changed

### HUD Equipped / Inventory
- [ ] `Equipped` tab only shows equipped / ready items
- [ ] `Inventory` tab excludes equipped / ready items
- [ ] `Inventory` filter dropdown works for at least `All`, `Weapons`, and `Ammunitions`
- [ ] Stowed weapon shows `Ready`
- [ ] `Ready` moves stowed weapon to `Equipped`
- [ ] `Unequip` moves equipped weapon out of `Equipped`

### Ammunition
- [ ] Ammo item sheet shows numeric range fields instead of raw JSON
- [ ] Ammo item sheet shows a clear override / modify checkbox
- [ ] Reload works with a non-empty ammo stack
- [ ] Reload decrements the ammo stack by 1
- [ ] Reload can replace already loaded ammo
- [ ] Loaded ammo is not incorrectly reported as depleted
- [ ] Firing a ranged attack updates the weapon loaded state correctly
- [ ] Firing a ranged attack does not decrement the stack a second time
- [ ] Switching ammo changes effective weapon range when expected
- [ ] `Scatter Shot` uses its special close-range profile

### Weapon Template / Range
- [ ] Thrown weapons show range fields in the weapon sheet
- [ ] Thrown weapons use their configured ranges in the HUD
- [ ] Longbow still shows correct range fields
- [ ] Weapon subtype labels are correct in the HUD
- [ ] Polearms do not incorrectly show as `Knife`
- [ ] Range overlays appear on hover only, not on selection
- [ ] Range overlays are visually clear enough on hover

## General Regression Check
- [ ] Setup/import still completes successfully
- [ ] No duplicate managed items created
- [ ] No red console errors during the test pass
- [ ] No new major HUD regressions noticed

## Notes
- General bugs / odd behavior:
- 
- 