# Chargen Dexterity "Your Nature" Table Draft v1

**Status: Authoring draft.** This document proposes a complete `Dexterity` destination table
for the `Your Nature` phase defined in [`chargen-spec-v1.md`](chargen-spec-v1.md).

The draft is written in the same three-part outcome shape already used by life-path chargen
items:

- `ChoiceTitle`
- `ChoiceText`
- `ChoiceBio`
- `Effects1`
- `Effects2`
- `Effects3`

## Design notes

- This is a **single** `3d6` table used from adolescence through retirement.
- The entries are about timing, balance, precision, quiet movement, deft labor, and the social
  consequences of being quick or exact.
- Results are meant to add **biography**, **body marks**, reputation, suspicion, and skilled
  usefulness as often as they add raw capability.
- The effect rows below use only change types the current chargen parser already understands:
  `Stat`, `Money`, `Luck`, `Contact`, `Body`, `Social`, `Drive`, `Bio`, `Nothing`.
- `Body` means "roll once on the configured body table", which then appends an appearance/body
  mark entry to the actor.
- `Social` is used for esteem, grace, suspicion, prestige, or notoriety as a practical
  current-system stand-in.

## Suggested roll table

Table name:

- `Your Nature - Dexterity`

Formula:

- `3d6`

Results:

| Roll | Entry |
|---|---|
| 3 | Fingers in the dark |
| 4 | Rooftop crossing |
| 5 | Needle-steady |
| 6 | The dropped blade you caught |
| 7 | Dancer on bad boards |
| 8 | Window work |
| 9 | Too quick to trust |
| 10 | The cup that did not break |
| 11 | Silent errand |
| 12 | Craft hand's eye |
| 13 | Slipped the noose |
| 14 | Fairground hands |
| 15 | Delicate salvage |
| 16 | Called for the narrow work |
| 17 | Grace under witness |
| 18 | Hands that make people uneasy |

---

## Entries

### 3. Fingers in the dark

- `ChoiceTitle`: `Fingers in the dark`
- `ChoiceText`: `When a prisoner had to be cut free in a dark loft before the watch came back, they thrust a single knot into your hands and trusted you to work it loose by touch alone.`
- `ChoiceBio`: `You learned early that deft fingers are invited into places strength and honesty are not.`

`Effects1`
- `Stat` target `Dexterity` amount `1` weight `2`
- `Contact` text `The fugitive from the loft remembers the night your fingers bought back his freedom.` weight `2`
- `Money` amount `25` weight `2`

`Effects2`
- `Drive` target `add` amount `Curiosity` weight `2`
- `Social` amount `-1` weight `2`
- `Nothing` weight `2`

`Effects3`
- `Bio` amount `People began trusting your hands with tasks they would rather not have described too clearly.` weight `3`
- `Nothing` weight `3`

### 4. Rooftop crossing

- `ChoiceTitle`: `Rooftop crossing`
- `ChoiceText`: `When the constables blocked the bridge, you crossed three wet rooftops above the tannery and dropped the rope that let the others escape.`
- `ChoiceBio`: `That crossing taught you that balance can open roads brute courage never could.`

`Effects1`
- `Stat` target `Dexterity` amount `1` weight `2`
- `Luck` amount `true` weight `2`
- `Contact` text `One of the fugitives still remembers you on the tannery roofs with the night wind at your back.` weight `2`

`Effects2`
- `Drive` target `add` amount `Boldness` weight `2`
- `Body` weight `2`
- `Nothing` weight `2`

`Effects3`
- `Bio` amount `After that, heights and narrow footing felt less like obstacles than invitations.` weight `3`
- `Social` amount `1` weight `1`
- `Nothing` weight `2`

### 5. Needle-steady

- `ChoiceTitle`: `Needle-steady`
- `ChoiceText`: `When the steward's daughter ripped her wedding sleeve an hour before the bells, the gown was put in your lap because your needle never trembled.`
- `ChoiceBio`: `Your dexterity first earned respect not by display, but by how little motion you wasted.`

`Effects1`
- `Money` amount `45` weight `2`
- `Contact` text `The steward's house remembers who saved the wedding gown when panic had already set in.` weight `2`
- `Stat` target `Dexterity` amount `1` weight `2`

`Effects2`
- `Social` amount `1` weight `2`
- `Drive` target `add` amount `Pride` weight `2`
- `Nothing` weight `2`

`Effects3`
- `Bio` amount `People learned that you could be trusted with what must not slip, tear, or go wrong under pressure.` weight `3`
- `Nothing` weight `3`

### 6. The dropped blade you caught

- `ChoiceTitle`: `The dropped blade you caught`
- `ChoiceText`: `When a butcher's knife slipped from a greasy table toward a child, your hand closed on the blade before it struck, and the cut across your palm never quite faded.`
- `ChoiceBio`: `You learned that quick hands can save a moment only by letting the body pay for it later.`

`Effects1`
- `Body` weight `3`
- `Luck` amount `true` weight `1`
- `Social` amount `1` weight `2`

`Effects2`
- `Contact` text `The child's mother still remembers the blood on your hand and the fact that it was not her child's.` weight `3`
- `Drive` target `add` amount `Protectiveness` weight `2`
- `Nothing` weight `1`

`Effects3`
- `Bio` amount `The mark it left became part of the story whenever that moment was retold.` weight `3`
- `Nothing` weight `3`

### 7. Dancer on bad boards

- `ChoiceTitle`: `Dancer on bad boards`
- `ChoiceText`: `At midsummer revels, you crossed a brewer's table slick with spilled ale without upsetting a cup, and the whole hall stopped to watch you turn at the end.`
- `ChoiceBio`: `You discovered that grace in public can change how people imagine the rest of your life.`

`Effects1`
- `Social` amount `1` weight `3`
- `Money` amount `35` weight `2`
- `Contact` text `A fiddler from that midsummer hall still remembers how the room changed when you stepped onto the table.` weight `1`

`Effects2`
- `Drive` target `add` amount `Pride` weight `2`
- `Bio` amount `For a while, people remembered you less for what you said than for how easily you moved.` weight `2`
- `Nothing` weight `2`

`Effects3`
- `Luck` amount `true` weight `1`
- `Nothing` weight `5`

### 8. Window work

- `ChoiceTitle`: `Window work`
- `ChoiceText`: `When the chapel chest had to be opened without waking the sexton, you slipped through the vestry window and dropped the bar from inside.`
- `ChoiceBio`: `Your dexterity made you useful wherever entry mattered more than permission.`

`Effects1`
- `Contact` text `The man who waited beneath the vestry wall still remembers how softly the bar lifted.` weight `3`
- `Stat` target `Dexterity` amount `1` weight `2`
- `Money` amount `30` weight `1`

`Effects2`
- `Social` amount `-1` weight `2`
- `Drive` target `add` amount `Caution` weight `2`
- `Nothing` weight `2`

`Effects3`
- `Bio` amount `After enough such errands, people began to look at walls and locks as if they were obstacles made especially for you.` weight `3`
- `Body` weight `1`
- `Nothing` weight `2`

### 9. Too quick to trust

- `ChoiceTitle`: `Too quick to trust`
- `ChoiceText`: `After the silver seal vanished from the magistrate's supper table, every eye in the room turned toward you before anyone had even finished naming what was missing.`
- `ChoiceBio`: `You learned that visible dexterity can breed suspicion even when you have done nothing at all.`

`Effects1`
- `Social` amount `-1` weight `3`
- `Contact` text `A clerk from the magistrate's house still watches your hands before he listens to you.` weight `2`
- `Drive` target `add` amount `Resentment` weight `1`

`Effects2`
- `Bio` amount `Whether guilty or innocent, you were burdened for a time by the sort of reputation that clings to nimble people.` weight `3`
- `Money` amount `20` weight `1`
- `Nothing` weight `2`

`Effects3`
- `Luck` amount `true` weight `1`
- `Nothing` weight `5`

### 10. The cup that did not break

- `ChoiceTitle`: `The cup that did not break`
- `ChoiceText`: `When a servant stumbled into the high table, you snatched the bishop's wine cup out of the air before it struck the floor or stained his robes.`
- `ChoiceBio`: `For one instant, your quickness made disaster look almost elegant.`

`Effects1`
- `Social` amount `1` weight `3`
- `Contact` text `The bishop's steward still remembers how neatly you spared the hall a public humiliation.` weight `2`
- `Luck` amount `true` weight `1`

`Effects2`
- `Money` amount `25` weight `2`
- `Drive` target `add` amount `Pride` weight `2`
- `Nothing` weight `2`

`Effects3`
- `Bio` amount `It was a small thing, but small things done perfectly are often remembered longer than they deserve.` weight `3`
- `Nothing` weight `3`

### 11. Silent errand

- `ChoiceTitle`: `Silent errand`
- `ChoiceText`: `You once carried a sealed letter through a sleeping manor, down the servants' stair, and across the gravel court without waking the dogs.`
- `ChoiceBio`: `That errand taught you that dexterity serves silence as well as speed.`

`Effects1`
- `Contact` text `Marta Elsyn still trusts you because you carried her brother's letter across the manor without waking a soul.` weight `3`
- `Money` amount `40` weight `2`
- `Stat` target `Dexterity` amount `1` weight `1`

`Effects2`
- `Drive` target `add` amount `Caution` weight `2`
- `Drive` target `add` amount `Curiosity` weight `2`
- `Nothing` weight `2`

`Effects3`
- `Bio` amount `Afterward, you knew exactly how differently the world sounds when every floorboard matters.` weight `3`
- `Nothing` weight `3`

### 12. Craft hand's eye

- `ChoiceTitle`: `Craft hand's eye`
- `ChoiceText`: `When the clockmaker's apprentice froze over a stripped gear, the master passed the tiny wheel to you, and your hands set it right before anyone finished giving advice.`
- `ChoiceBio`: `Your dexterity became visible as a kind of intelligence that lived in the fingers.`

`Effects1`
- `Contact` text `The clockmaker still remembers the day you corrected his apprentice's hand.` weight `3`
- `Money` amount `50` weight `2`
- `Stat` target `Dexterity` amount `1` weight `1`

`Effects2`
- `Social` amount `1` weight `2`
- `Drive` target `add` amount `Ambition` weight `2`
- `Nothing` weight `2`

`Effects3`
- `Bio` amount `After that, tools sat differently in your hands: less like objects you held and more like motions waiting to happen.` weight `3`
- `Nothing` weight `3`

### 13. Slipped the noose

- `ChoiceTitle`: `Slipped the noose`
- `ChoiceText`: `When the ferry rope snapped and wrapped your wrist, you turned with it at exactly the right instant and came away bruised instead of dragged under the current.`
- `ChoiceBio`: `You never forgot how narrow the space was between deftness and death.`

`Effects1`
- `Luck` amount `true` weight `3`
- `Body` weight `2`
- `Contact` text `The ferryman still tells how you slipped the river's pull by a movement no stronger man could have made.` weight `1`

`Effects2`
- `Drive` target `add` amount `Fear` weight `2`
- `Stat` target `Dexterity` amount `1` weight `2`
- `Nothing` weight `2`

`Effects3`
- `Bio` amount `The memory stayed close: the pull on the skin, the failing breath, and the tiny movement that gave you back the world.` weight `3`
- `Nothing` weight `3`

### 14. Fairground hands

- `ChoiceTitle`: `Fairground hands`
- `ChoiceText`: `At the harvest fair, you won three rounds at the knife-and-coin board so cleanly that applause gave way to muttering before the prizes were even counted.`
- `ChoiceBio`: `Dexterity in public taught you how admiration and suspicion can arrive together.`

`Effects1`
- `Social` amount `1` weight `2`
- `Social` amount `-1` weight `2`
- `Money` amount `45` weight `2`

`Effects2`
- `Contact` text `The knife-board keeper still remembers the smile he wore before he realized how much silver you had taken from him.` weight `2`
- `Drive` target `add` amount `Pride` weight `2`
- `Nothing` weight `2`

`Effects3`
- `Bio` amount `People remembered the speed of your hands long after they forgot what, exactly, those hands had done.` weight `3`
- `Nothing` weight `3`

### 15. Delicate salvage

- `ChoiceTitle`: `Delicate salvage`
- `ChoiceText`: `After the shelf collapsed in the archive, you were the one sent between the fallen boards to lift out the cracked reliquary without breaking it completely.`
- `ChoiceBio`: `Your quickness mattered because it could be made gentle at the same time.`

`Effects1`
- `Contact` text `The prior still remembers who placed the reliquary back in his hands intact enough to save.` weight `3`
- `Money` amount `35` weight `2`
- `Body` weight `1`

`Effects2`
- `Social` amount `1` weight `2`
- `Drive` target `add` amount `Care` weight `2`
- `Nothing` weight `2`

`Effects3`
- `Bio` amount `That day proved your dexterity was not only quick, but careful enough to rescue what force would ruin.` weight `3`
- `Nothing` weight `3`

### 16. Called for the narrow work

- `ChoiceTitle`: `Called for the narrow work`
- `ChoiceText`: `When the jeweler dropped a pearl deep into the chapel screen, the whole shop fell silent and sent for you, because everyone knew your fingers could find it where theirs would only push it farther.`
- `ChoiceBio`: `Your life acquired a pattern of being summoned for the jobs that depended on exact hands rather than broad shoulders.`

`Effects1`
- `Contact` text `The jeweler's workshop still thinks of you whenever work turns cramped and exact.` weight `3`
- `Money` amount `55` weight `2`
- `Stat` target `Dexterity` amount `1` weight `1`

`Effects2`
- `Social` amount `1` weight `2`
- `Drive` target `add` amount `Duty` weight `2`
- `Drive` target `add` amount `Resentment` weight `2`

`Effects3`
- `Bio` amount `Being needed for exact work could feel like praise, burden, or both, depending on the day.` weight `3`
- `Nothing` weight `3`

### 17. Grace under witness

- `ChoiceTitle`: `Grace under witness`
- `ChoiceText`: `Before the governor's guests, you climbed the torn stage frame, caught the falling lantern, and came down so smoothly that the rescue looked rehearsed.`
- `ChoiceBio`: `For a moment, dexterity made you legible to others as someone rare.`

`Effects1`
- `Social` amount `1` weight `3`
- `Contact` text `One of the governor's guests still remembers the calm with which you caught the lantern.` weight `2`
- `Money` amount `30` weight `1`

`Effects2`
- `Drive` target `add` amount `Ambition` weight `2`
- `Luck` amount `true` weight `2`
- `Nothing` weight `2`

`Effects3`
- `Bio` amount `You learned that a body moving beautifully at the right time can alter a life as surely as a spoken introduction.` weight `3`
- `Nothing` weight `3`

### 18. Hands that make people uneasy

- `ChoiceTitle`: `Hands that make people uneasy`
- `ChoiceText`: `After you lifted the signet from the tablecloth with a trick of the fingers and set it back again laughing, the laughter died too quickly, and from then on people watched your hands more than your face.`
- `ChoiceBio`: `Your dexterity became a thing others desired, used, and distrusted all at once.`

`Effects1`
- `Social` amount `1` weight `2`
- `Social` amount `-1` weight `2`
- `Stat` target `Power` amount `1` weight `2`

`Effects2`
- `Contact` text `A courtier from that supper still praises your hands in the same breath that he warns people about them.` weight `2`
- `Drive` target `add` amount `Isolation` weight `2`
- `Drive` target `add` amount `Pride` weight `2`

`Effects3`
- `Bio` amount `People began watching your hands even when they meant to praise them, and the feeling stayed with you.` weight `3`
- `Nothing` weight `3`

---

## Conversion notes

When turning this draft into actual Foundry chargen content:

- each numbered result becomes a **chargen-template item**
- the `Your Nature - Dexterity` roll table points its `3-18` ranges at those items
- `Effects1`, `Effects2`, and `Effects3` should be entered as the normal CSB dynamic tables
- if you want **dexterity-specific body marks**, either:
  - rely on the current shared body table for generic marks, or
  - create a dedicated body-table variant for `Your Nature` and point these results there via
    setup/config

## Recommended next step

If this tone is right, the cleanest companion tables after `Dexterity` would be:

1. `Stamina`, to cover endurance, attrition, hunger, weather, and surviving long strain.
2. `Charisma`, to establish the contrasting social space where lives turn through presence,
   allure, speech, and attention rather than force or finesse.
