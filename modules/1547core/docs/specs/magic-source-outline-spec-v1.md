# Magic Source Outline Spec v1

This document structures the uploaded `Magic.md` source into a reference spec for `1547Core`.
It is the authoritative source for the high-level magic model and for the human spell list.

## Scope

- Source document: `C:\Users\kaise\Downloads\Magic.md`
- This spec is descriptive and source-aligned rather than implementation-complete.
- The spell catalog in `foundry/Templates/spells.json` should only contain spells present in this source document's spell section.
- Foundry spell entries may normalize capitalization and obvious spelling mistakes while preserving one-to-one correspondence with the source spell identities.

## Source Structure

The source document is organized into these major parts:

1. `Supernatural marks`
2. `Spells`
3. `Recipe`
4. `Failure`
5. `Pacts`

## Supernatural Marks

- Supernatural marks are given, not learned.
- Positive or partly positive marks are `blessings`.
- Negative marks are `curses`.
- Source channels named in the document:
  - `Blood line`
  - `Faith`
  - `Pagan`
  - `Ritual`
  - `Zone`
- The document also defines escalating `Pow`-based curse acquisition.

## Spells

- Human-cast spells are ritual in nature.
- The source defines these spell schools:
  - Knot: Traditional cunning-folk knot magic used for weather, healing, control, curses, and love magic.
  - Wards: Protective magic for people, property, and grimoire work.
  - Divination: Prediction, omen-reading, and some illusion work.
  - Necromancy: Forbidden corpse- and graveyard-connected ritual magic.
  - Astrology: Safer, often church-approved divination through stars and planets.
  - Religion: Church, synagogue, and mosque ritual magic, mostly overlapping with grimoire and warding.
  - Alchemy: Item- and transformation-focused magic rooted in elements and tria prima.
  - Grimoire: The most powerful book-based occult magic, usually demanding elaborate rituals.

## Recipe

- A `recipe` is the concrete way a spell is cast.
- Different traditions can cast the same spell with different recipes and steps.
- Recipes may add requirements such as materials, times, waiting periods, tests, or supernatural resistance.
- Some spells have random outcomes, and some recipes reduce or shape that randomness.

## Failure

- Spell failure is roll-table-driven.
- Minor spells should fail with smaller setbacks.
- Major spells can fail with curses, confrontation, or forced pacts.

## Pacts

- The source defines pacts as a major magic type with patron, boon, price, obligation, tension, and status.
- This outline only records the existence of the pact section; pact content remains governed by the source document and the pact schema spec.

## Authoritative Human Spell List

The source document currently lists **102** human spells.

| Spell | Source Schools |
| --- | --- |
| Albedo | Alchemy 3 |
| Angelic boon | Grimoire 2 |
| Astral projection | Divination 3 |
| Auspicious prediction | Astrology 1, Divination 1 |
| Auspicious timing | Astrology 2, Divination 2 |
| Banish | Grimoire 3, Religion 3 |
| Beam sigil | Religion 1, Wards 1 |
| Bind | Grimoire 3 |
| Black sleep | Necromancy 2 |
| Blood border | Necromancy 2, Wards 1 |
| Borrowed pallor | Necromancy 2 |
| Borrowed pulse | Necromancy 1 |
| Break binding | Grimoire 1 |
| Break pact | Grimoire 3 |
| Break seal | Grimoire 2 |
| Calcination | Alchemy 2 |
| Calm knot | Knot 1 |
| Chalk border | Grimoire 2, Wards 2 |
| Citrinitas | Alchemy 3 |
| Coagulation | Alchemy 3 |
| Cold knot | Knot 2 |
| Command | Grimoire 2 |
| Conjunction | Alchemy 1 |
| Consecrate church | Religion 2 |
| Consumption oath | Necromancy 3 |
| Create funeral wax candle | Necromancy 2, Religion 2 |
| Create spirit vessel | Grimoire 2 |
| Curse of withering | Necromancy 2 |
| Bless weapon | Religion 2 |
| Danger sense | Divination 2 |
| Death knots | Knot 3 |
| Delay | Grimoire 1 |
| Disease knot | Knot 2 |
| Dissolution | Alchemy 1 |
| Distillation | Alchemy 2 |
| Divine guidance | Grimoire 3, Religion 3 |
| Dread | Necromancy 2 |
| Dream interpretation | Divination 1 |
| Dream warding | Wards 2 |
| Empty mirror | Necromancy 2 |
| Enchant object | Grimoire 3 |
| Evil eye | Necromancy 2 |
| Exorcism | Grimoire 2, Religion 2 |
| Faith manipulation | Divination 2 |
| Favor knot | Knot 2 |
| Fermentation | Alchemy 2 |
| Find the culprit | Divination 2 |
| Find what is lost | Divination 2 |
| Glamour | Divination 3 |
| Golem | Alchemy 3, Grimoire 3 |
| Grave dreaming | Necromancy 1 |
| Grave soil & salt border | Necromancy 1, Wards 1 |
| Heart twine | Knot 2 |
| Homonculus | Alchemy 3, Grimoire 2 |
| Humoral rebalancing | Alchemy 3 |
| Ill luck knot | Knot 2 |
| Ill turning loop | Knot 2 |
| Invoke pact | Grimoire 2 |
| Iron seal | Wards 2 |
| Limbsnare | Knot 2 |
| Lovebinding | Grimoire 1 |
| Memory tangle | Knot 1 |
| Metallic transposition | Alchemy 3 |
| Name the unnamed | Grimoire 2 |
| Nigredo | Alchemy 2 |
| Night riding | Necromancy 2 |
| Oath knot | Knot 2 |
| Oath of three witnesses | Wards 1 |
| Object memory | Divination 3 |
| Possess | Grimoire 2 |
| Planetary invocation | Astrology 3, Grimoire 1 |
| Prophecy | Astrology 2, Divination 2, Religion 2 |
| Prospect reading | Astrology 1, Divination 1 |
| Protection rhyme | Religion 1, Wards 1 |
| Protective border | Religion 1, Wards 1 |
| Protective circle | Religion 2, Wards 2 |
| Prayer against Evil Eye | Religion 1 |
| Reading | Astrology 1, Divination 1 |
| Refusal rite | Religion 2, Wards 2 |
| Rewrite the past | Grimoire 2 |
| Rubedo | Alchemy 3 |
| Sanctify | Religion 2, Wards 1 |
| Scrying | Divination 3, Grimoire 2 |
| Seal | Grimoire 2, Religion 3 |
| Separation | Alchemy 1 |
| Shadow attachment | Necromancy 3 |
| Shape shifting | Divination 3, Grimoire 3 |
| Similacrum | Grimoire 3 |
| Speak with the dead | Necromancy 2 |
| Spirit sight | Necromancy 1, Religion 2 |
| Still tongue | Necromancy 1 |
| Summon being | Grimoire 1 |
| Tongue tying knot | Knot 2 |
| Transform self | Grimoire 3 |
| Threshold awareness | Divination 1 |
| Truth pressure | Divination 2 |
| Uncertain knot | Knot 2 |
| Wax seal | Wards 1 |
| Wind knot | Knot 1 |
| Witch's ladder | Knot 2 |
| Withering knot | Knot 3 |
| Zone travel | Grimoire 1 |

