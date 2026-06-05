# Item Description Authoring Guide

This guide defines how item descriptions should be authored across the `1547Core` item catalogs.

The goal is:

- keep item text consistent across equipment, weapons, armor, spells, marks, and monster items
- separate flavor from rules when both are needed
- keep short catalog text useful in lists, while allowing richer supporting notes where appropriate
- preserve a historically grounded, low-magic 1547 tone

## Core Principle

Do not treat `description` as one job.

Most item families need at least two distinct kinds of text:

- `CatalogDescription`
  A short identification line. This is what the item is.
- `PlayerFacingRulesText`
  A plain statement of what the item does in play.

Some item families also benefit from:

- `GMNotes`
  Guidance for adjudication, rarity, edge cases, or tone.
- `LoreNotes`
  Historical, folkloric, or setting-facing context.

When a dataset only supports a single `description` field today, author that field as a combined short form:

1. one sentence of identification
2. one short sentence of play meaning if needed

Do not bury key rules in long flavor paragraphs.

## Default Text Layers

### CatalogDescription

Use for all item families.

Purpose:

- identify the object, mark, ritual, or power quickly
- support compendium browsing and fast GM scanning

Style:

- 1 sentence
- usually 8-22 words
- concrete and specific
- historically grounded where possible

Good:

- `A small wax devotional bearing the Lamb of God, commonly worn for protection.`
- `A broad-headed hunting arrow meant to cut rather than pierce.`
- `A binding charm worked through cord, word, and fixed intent.`

Avoid:

- vague marketing language
- hidden mechanics
- long explanatory clauses

### PlayerFacingRulesText

Use when the item has meaningful play impact.

Purpose:

- explain what the item changes in play
- summarize effect without requiring the user to inspect schema fields

Style:

- 1-3 short sentences
- direct language
- no ornamental prose
- say what changes, who it affects, and when

Good:

- `Counts as a blessed weapon against creatures harmed by holy force.`
- `Adds the Silver qualifier to attacks made with this weapon or ammunition.`
- `Places the target under magical sleep until disturbed or resisted.`

Avoid:

- repeating the full data payload in prose
- undefined narrative words like `strong`, `major`, or `mystic` without game meaning

### GMNotes

Use only when needed.

Purpose:

- record intended rulings
- explain ambiguity or limits
- preserve setting tone in edge cases

Style:

- plain and practical
- 1-4 short sentences

Good use cases:

- relics with uncertain sanctity
- protective charms whose cultural meaning exceeds their raw mechanics
- monster abilities whose visible effect is subtler than their game payload

### LoreNotes

Optional.

Purpose:

- give historical, cultural, or folkloric context
- help the item feel rooted in the setting

Style:

- brief paragraph or 2-4 sentences
- grounded, not encyclopedic
- prefer period texture over modern explanation

Use sparingly for:

- relics
- occult tools
- pacts
- marks
- named spells
- notable monster powers

## Family Rules

### Equipment

Default:

- `CatalogDescription`
- optional `PlayerFacingRulesText`
- optional `LoreNotes`

Emphasis:

- what the object is in the world
- what a player should assume it is for
- whether it has ritual, devotional, social, or occult significance

Examples:

- devotional objects
- travel gear
- tools
- containers
- light sources

### Mundane Equipment

For clearly mundane items, keep the description practical and category-aware.

Use this order:

1. what the object physically is
2. what it is for in ordinary life
3. one short play-facing sentence only if it meaningfully changes what players try to do

Good:

- `A sturdy carrying pack worn on the back, used to keep travel goods together and off the hands. In play, it is the standard container for hauling personal gear on the road.`
- `A framed portable lamp that throws steadier light than an open torch and shelters its flame from wind. In play, it is a reliable light source for travel, searching, and work in darkness.`
- `A length of sturdy hemp rope used for tying, hauling, climbing, and securing loads. In play, it is the default tool for binding, lowering, dragging, or making simple field solutions.`

Avoid:

- treating ordinary gear like magical treasure
- forcing rules text onto simple items that only need a clear identification sentence
- turning every bowl, shoe, or loaf into a lore paragraph

### Amulets

Amulets should sit between mundane equipment and overt supernatural effects.

Use this order:

1. what the object physically is
2. what it is worn, carried, or kept for
3. what it may matter for in play

Good:

- `A small wax devotional bearing the Lamb of God, worn or carried for protection. It is used as a blessed object against danger, evil influence, and unclean presence. In play, it is a religious protective item that may matter in warding, resistance, or rites of blessing.`
- `A naturally holed stone carried as a charm against witchcraft, ill luck, and hidden malice. It is kept for protection and for seeing what should not easily be seen. In play, it is an apotropaic folk object that may matter in warding, omen-work, or the detection of hostile magic.`

Avoid:

- treating the amulet like a full spell in prose
- reducing it to only a schema effect with no cultural identity
- writing abstract fantasy language where a concrete devotional or folkloric object would do

### Misc Ritual Items

Misc ritual-adjacent items should be written as practical objects first and occult supports second.

Use this order:

1. what the object physically is
2. what learned, ritual, or technical use it has
3. what it may matter for in play

Good:

- `A shaped distilling vessel used to separate, condense, and refine substances through controlled heat. It is a working tool of alchemy rather than ordinary household cooking. In play, it is a specialist apparatus that may matter in alchemical preparation, extraction, and transformation.`
- `A sealed bottle prepared as a protective counter-charm against malice, curse-work, and hostile witchcraft. It is buried, hidden, or kept in place to catch or turn back harmful force. In play, it is a warding object that may matter in protection, curse resistance, and household defense.`

Avoid:

- treating these objects like generic treasure
- writing them as if they were already full spells
- losing the practical object under too much abstract occult language

### Potions

Potions should be written as preparations first, intended effect second, and play consequence third.

Use this order:

1. what the preparation physically is
2. what it is taken, applied, or kept for
3. what it may matter for in play

Good:

- `A dark prepared draught meant to draw the drinker into heavy enchanted sleep. It is kept for forced rest, covert dosing, or ritual preparation of the body and mind. In play, it is a consumable preparation that may matter in sleep-working, incapacitation, or occult setup.`
- `A compounded antidotal preparation valued for resisting poison, corruption, and inward harm. It is taken as a remedy where danger may already be in the body. In play, it is a medicinal preparation that may matter in recovery, resistance, or emergency treatment.`

Avoid:

- describing every potion as if it were a spell in liquid form
- skipping whether it is drunk, applied, or otherwise used
- writing modern chemical language where a period-appropriate preparation voice works better

### Grimoires And Scrolls

Grimoires and scrolls should be written as written ritual carriers first, sources of dangerous or useful knowledge second, and play supports third.

Use this order:

1. what the written object physically is
2. what sort of magical or ritual knowledge it carries
3. what it may matter for in play

Good:

- `A serviceable written grimoire containing working ritual knowledge, signs, and procedures of meaningful power. It is valuable less as ornament than as a usable source of occult instruction. In play, it is a magical text that may matter in spell access, ritual preparation, and learned supernatural practice.`
- `A small scroll bearing a prepared working, formula, or copied ritual text ready to be carried or consulted. It is made for portability rather than long study. In play, it is a written magical aid that may matter in spell use, transmission, and field preparation.`

Avoid:

- treating every grimoire as uniquely legendary if the item grade is only moderate
- describing them as full spells instead of books or texts that carry spells
- losing the difference between a portable scroll and a more substantial bound grimoire

### Weapons

Default:

- `CatalogDescription`
- `PlayerFacingRulesText`

Emphasis:

- weapon form and historical use
- one short rules-facing summary if the weapon has a distinctive tactical identity

Use rules text mostly to summarize:

- reach identity
- defensive use
- unusual handling
- special qualifier relevance

Do not restate all traits and attack profiles in raw prose when the enricher can carry them more cleanly.

### Armor

Default:

- `CatalogDescription`
- `PlayerFacingRulesText`

Emphasis:

- what kind of armor it is
- what tradeoff it implies in play

Good:

- `A padded defensive coat worn beneath or instead of metal protection.`
- `Offers modest protection without the burden of full mail.`

### Ammunition

Default:

- `CatalogDescription`
- short `PlayerFacingRulesText` only when needed

Emphasis:

- base ammunition identity only
- head shape, poison, sanctification, and similar treatment belong to modifiers, not the ammo base description

### Weapon Modifiers

Default:

- `CatalogDescription`
- `PlayerFacingRulesText`

Emphasis:

- what has been done to the weapon or ammunition
- exact play consequence

These should be among the clearest items in the game.

Good:

- `A silver treatment worked onto the striking surface or head.`
- `Adds the Silver qualifier.`

When a weapon modifier has a concrete `addDice` payload, the description should expose that added die through the `@1547[...]` enricher instead of only naming it in plain prose.

Good:

- `A broad cutting head built to worsen open wounds. In play, it adds @1547[1dl]{Lethality} to the modified shot, favoring raw injury over narrow penetration.`
- `A narrow hardened head built to press through armor and gaps. In play, it adds @1547[1dp]{Penetration} to the modified shot, favoring armor-breaking force.`

Usually keep these as normal prose:

- qualifier-only changes such as `Silvered`, `Blessed`, or `Cold Iron`
- non-roll tags or stack behavior

## Enricher Syntax

Item descriptions may include interactive mechanical references using the `1547Core` enricher syntax:

`@1547[roll|roll|roll]{Label}`

Current behavior:

- the text inside `[]` is split on `|`
- each term becomes a roll option in the 1547 roll dialog
- the text inside `{}` is the clickable label shown to the player

Examples:

- `@1547[2dg|1db]{Rapier Thrust}`
- `@1547[1dg|1dc|1db]{Rapier Bind}`
- `@1547[1dh|1db|1dc]{Bill Hook}`

Use the enricher when:

- you want the description to name a concrete attack profile
- you want the description to expose exact dice without hard-coding them as plain text
- you want the prose to stay readable while still embedding live mechanical references

Do not use the enricher for:

- basic flavor words
- rules that are not roll expressions
- large blocks of mechanical detail that would read better as normal prose

### Enricher Authoring Rule

Write the sentence as natural prose first.

Then replace the mechanically exact roll expression with an enricher reference.

Good:

- `In play, it excels in agile dueling, using @1547[2dg|1db]{Rapier Thrust} or @1547[1dg|1dc|1db]{Rapier Bind}, both dealing piercing damage.`

Less good:

- `Uses @1547[2dg|1db]{Rapier Thrust} and has Parrying and Fast and Narrow and also Piercing damage and Disarming.`

The enricher should support the prose, not overwhelm it.

## Enricher By Family

### Weapons

Weapons are the best fit for the enricher.

Prefer to enrich:

- attack profiles
- alternate modes
- notable offensive options

Usually keep these as normal prose:

- historical identity
- handling identity
- trait summary
- damage type summary

### Monster Natural Weapons

Also a strong fit.

Use the enricher to expose:

- bite
- claw
- gore
- slam
- constriction
- tentacle

especially when a creature has multiple attack modes worth calling out in its description.

### Spells

Use sparingly.

Spells usually want normal prose first. The enricher is appropriate only when the spell description intentionally offers a direct clickable roll expression.

### Equipment, Marks, Pacts, Monster Magic

Use only when a description genuinely benefits from an interactive roll reference.

Most of these families should remain prose-first.

### Skills

Skills should remain prose-first and almost never use the `@1547[...]` enricher.

Default:

- `CatalogDescription`
- `PlayerFacingRulesText`

Emphasis:

- what field of competence the skill covers
- what kinds of actions it governs
- when it should be used in play
- which base stat it depends on
- what level span the skill supports

Skill descriptions should usually follow this structure:

1. one sentence defining the field of competence
2. one sentence naming the governed actions
3. one sentence explaining use in play
4. one compact rules sentence:
   `Base stat: [Stat]. Levels: [Min]-[Max].`

Good:

- `This skill covers fighting with hand weapons in close reach. It governs timing, pressure, measure, striking, parrying, and weapon control in melee. In play, it is the default skill for swords, polearms, blunt weapons, and similar armed close combat. Base stat: Dexterity. Levels: 0-3.`
- `This skill covers learned occult knowledge, ritual understanding, hidden correspondences, and dangerous supernatural theory. It governs identifying occult phenomena, interpreting ritual logic, and handling grimoire-based workings with informed intent. In play, it is used for scholarly or formal occult practice, especially where misunderstanding carries risk. Base stat: Intelligence. Levels: 1-3.`

Avoid:

- item-style flavor text with no guidance on use
- repeating schema field names without explanation
- adding `@1547[...]` unless the skill description genuinely needs a clickable roll reference

### Maneuvers

Maneuvers should be more rules-forward than skills and more compact than spells.

Default:

- `CatalogDescription`
- `PlayerFacingRulesText`

Emphasis:

- what the maneuver attempts to do
- when it is used in the combat sequence
- what it changes in play
- what cost or requirement matters to using it

Maneuver descriptions should usually follow this structure:

1. one sentence stating the tactical intent
2. one sentence naming the timing window
3. one sentence stating the concrete play effect
4. optional requirement or cost clause if it meaningfully changes use

Good:

- `A quick false opening used to draw a bad response and create a better line for the true attack. It is declared before a melee attack. In play, it adds one main die to the attack, but requires Combat Melee 1 and a Fast weapon.`
- `A committed weapon defense that turns an incoming blow aside rather than simply enduring it. It is used as a reaction when attacked. In play, it adds one armor die to the defense and locks the parrying weapon until the end of the current side's activation.`

Avoid:

- only restating raw schema fields like `pre`, `reaction`, or `CriticalPoints` with no explanation
- burying timing and effect inside long flavor text
- adding `@1547[...]` unless the maneuver itself genuinely exposes a distinct clickable roll package

### Spells

Default:

- `CatalogDescription`
- `PlayerFacingRulesText`
- optional `LoreNotes`

Emphasis:

- the spell's intended outcome, not its ritual procedure
- ritual generation belongs elsewhere

Spell description should answer:

- what the working attempts
- what success looks like in play
- whether the effect is blessing, curse, ward, divination, or transformation

Do not duplicate generated ritual steps in the main spell description.

### Rituals And Ritual Steps

Rituals:

- `CatalogDescription` should summarize the assembled working
- `GMNotes` may explain unusual constraints

Ritual steps:

- should be procedural and concrete
- not poetic
- write them as instructions or requirements

Good step text:

- `Carve the sign into clean beeswax before sunrise.`
- `Perform the chant aloud beneath a full moon.`

### Supernatural Marks

Default:

- `CatalogDescription`
- `PlayerFacingRulesText`
- optional `LoreNotes`

Emphasis:

- what the mark feels like or looks like
- what it changes in play
- whether it is blessing, curse, or mixed inheritance

Current mark data often compresses all three into one field. That is acceptable for now, but future normalization should split:

- visible sign or lived reality
- rules consequence
- source or folklore context

### Monster Magic

Default:

- `CatalogDescription`
- `PlayerFacingRulesText`
- optional `GMNotes`

Emphasis:

- how the power presents fictionally
- what players should expect when it is used

Monster-magic text should feel immediate and threatening, not scholarly.

### Pacts

Default:

- `CatalogDescription`
- `PlayerFacingRulesText`
- `LoreNotes`

Emphasis:

- what is being promised, bound, owed, or risked
- what the benefit is
- what the burden is

## Tone Rules

All item descriptions should follow these tone rules unless a family explicitly needs another voice.

- stay historically grounded
- prefer concrete nouns over abstract fantasy language
- prefer folkloric unease over spectacle
- keep low-magic assumptions unless the item is explicitly exceptional
- do not sound like a video game tooltip unless the text is the rules summary

Prefer:

- `wax devotional`
- `grave soil`
- `cord`
- `saint's image`
- `threshold mark`
- `blessed iron`

Avoid:

- `arcane artifact`
- `legendary relic`
- `mystic power surge`
- `enchanted energy`

## Length Guidance

- `CatalogDescription`: 1 sentence
- `PlayerFacingRulesText`: 1-3 short sentences
- `GMNotes`: 1-4 short sentences
- `LoreNotes`: 2-4 sentences

If the text feels longer than that, split it instead of stretching one field.

## Current Data Strategy

Not every item family currently has dedicated fields for all of these layers.

Until the schema is expanded, use the following temporary mapping:

- `description`
  Combined `CatalogDescription` + short `PlayerFacingRulesText`
- `spellNotes`
  Authoring-facing technical note, not player-facing prose
- `PayloadNotes`
  Resolver or implementation note, not player-facing prose
- `traitDescription`
  Short `PlayerFacingRulesText` with a small amount of flavor if needed

Do not use technical fields as a substitute for proper item prose.

## Recommended Normalization Order

When normalizing existing content, do it in this order:

1. `Weapon modifiers`
   They are small, high-impact, and easy to standardize.
2. `Ammunition`, `Weapons`, and `Armor`
   Short and mostly factual.
3. `Equipment`
   Large volume, but straightforward once the style is stable.
4. `Supernatural marks`
   Need the most careful split between flavor and rules.
5. `Monster magic` and `Pacts`
   Smaller volume, higher complexity.
6. `Spells`
   Only after spell effect authoring has settled.

## Example Patterns

### Equipment Example

`CatalogDescription`
`A small wax devotional bearing the Lamb of God, often worn or carried for protection.`

`PlayerFacingRulesText`
`Counts as a blessed devotional item. It may support rites of protection or resistance against unclean influence when used appropriately.`

### Weapon Example

`CatalogDescription`
`A straight, single-handed sidearm suited to cut and thrust.`

`PlayerFacingRulesText`
`A balanced melee weapon with a strong defensive and dueling role.`

### Weapon Example With Enricher

`A long, narrow thrusting sword worn at the side, favored in towns, courts, and duels. It is made for reach, timing, and precise point work rather than heavy cutting. In play, it excels in agile dueling, using @1547[2dg|1db]{Rapier Thrust} or @1547[1dg|1dc|1db]{Rapier Bind}, both dealing piercing damage, while its traits emphasize parrying, disarming, speed, and narrow point control.`

### Additional Weapon Examples With Enricher

`An arming sword is a straight, single-handed sidearm suited to both cut and thrust. In play, it offers a balanced fencing role with @1547[3db]{Arming Sword}, dealing slashing damage while its traits emphasize parrying, disarming, and rigid blade control.`

`A falchion is a broad, forward-weighted sword built to deliver forceful cuts while still allowing a serviceable thrust. In play, it can answer with @1547[1dg|2db]{Falchion Thrust} or @1547[2db|1dc]{Falchion Swing}, shifting between piercing and slashing damage while its traits support parrying and disarming.`

`A bill is a polearm built from an agricultural hook and adapted for war, useful for catching, dragging, and controlling foes at reach. In play, it strikes with @1547[2dc|1dg]{Bill}, dealing slashing damage while its traits emphasize tactical use, receiving, and hooking control.`

`A crossbow is a spanning bow fixed to a stock, slower to reload but powerful and direct in use. In play, it fires @1547[1dg|1dp|1dm]{Crossbow Shot}, dealing piercing damage, while its traits emphasize reloading, aiming, armor breaking, and fragile precision.`

### Weapon Modifier Example

`CatalogDescription`
`A silver treatment worked onto the striking edge or head.`

`PlayerFacingRulesText`
`Adds the Silver qualifier to attacks made with the modified weapon or ammunition.`

### Supernatural Mark Example

`CatalogDescription`
`A wasting curse that slowly leaches strength from the body.`

`PlayerFacingRulesText`
`Applies a withering condition and may reduce the victim's endurance over time.`

`LoreNotes`
`Such afflictions are often blamed on knot-work, spiteful prayer, or old quarrels carried into ritual form.`

## Authoring Rule Of Thumb

If a player only sees one line, write `CatalogDescription`.

If a player must know how it changes play, add `PlayerFacingRulesText`.

If the GM needs help ruling it, add `GMNotes`.

If the item needs cultural or folkloric grounding, add `LoreNotes`.
