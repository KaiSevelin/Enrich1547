# CSB Item Template Reference

This file is the source-of-truth reference for player-facing item type detection
when working with 1547 Core items backed by Custom System Builder templates.

## Template Mapping

- `Item.uLlgZXz3GlXPFtsj`: Armor
- `Item.l4j1zT3kpdkZmACQ`: Container
- `Item.PDxRO5ObvLaThpez`: Consumable
- `Item.eCIZRFXbcQVZKqEr`: Equippable
- `Item.CmGj09PEdHfklGsT`: Light source
- `Item.4owc4YQBlp94GbGs`: Maneuver
- `Item.HkiFlUWUkUycJdBZ`: Magic item
- `Item.HPYYc2P0Ouagicmr`: Pact
- `Item.w9ky0ZTDvXDs5Ce7`: Power
- `Item.BbwVnEJobtCR5oOf`: Skill
- `Item.2kiWw3Cv5Zk1lZxn`: Spell
- `Item.389uqkKKn8M1SKux`: Unequippable item
- `Item.mwPqEYUoOfzXpyT9`: Usage effect
- `Item.qZCfLEYQ7egbm1B9`: Weapon

## Usage Guidance

- HUD inventory grouping and item classification should use the CSB template ID
  as the only source of truth.
- The only fallback classification is `unknown`.
- Internal CSB folders such as embedded-item folders should never be shown as
  player-facing inventory categories.
- Weapon, armor, skill, maneuver, and other item identification should not rely
  on folder names or source-data hints.
