# Chargen Strength "Your Nature" Table Draft v1

**Status: Authoring draft.** This document proposes a complete `Strength` destination table
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
- The entries are about how bodily force shapes a life, not only combat.
- Results are meant to add **biography**, **body marks**, and social consequences as often as
  they add raw power.
- The effect rows below use only change types the current chargen parser already understands:
  `Stat`, `Money`, `Luck`, `Contact`, `Body`, `Social`, `Drive`, `Bio`, `Nothing`.
- `Body` means "roll once on the configured body table", which then appends an appearance/body
  mark entry to the actor.
- `Social` is used for esteem/fear/reputation shifts as a practical current-system stand-in.

## Suggested roll table

Table name:

- `Your Nature - Strength`

Formula:

- `3d6`

Results:

| Roll | Entry |
|---|---|
| 3 | Crushed under the load |
| 4 | Broken in service |
| 5 | Foreman's beast |
| 6 | The beating you stayed standing through |
| 7 | Wrestler's reputation |
| 8 | Held the door |
| 9 | Carried the wounded |
| 10 | Too useful to rest |
| 11 | Strong arm in a weak matter |
| 12 | Pulled through |
| 13 | Protective bulk |
| 14 | Hands like tools |
| 15 | A blow remembered |
| 16 | Strength drew patronage |
| 17 | Carried beyond reason |
| 18 | Strength that troubled people |

---

## Entries

### 3. Crushed under the load

- `ChoiceTitle`: `Crushed under the load`
- `ChoiceText`: `When the millstones had to be dragged to higher ground before the flood took the storehouse, they put the ropes in your hands first and shouted for you to lean harder than the rest.`
- `ChoiceBio`: `After that season, people remembered your strength less as a gift than as the reason the heaviest burden found you first.`

`Effects1`
- `Body` weight `3`
- `Stat` target `Strength` amount `1` weight `1`
- `Stat` target `Stamina` amount `1` weight `2`

`Effects2`
- `Social` amount `-1` weight `2`
- `Money` amount `40` weight `2`
- `Drive` target `add` amount `Resentment` weight `2`

`Effects3`
- `Bio` amount `Your body kept account of the years in scars, stiffness, and a way of carrying weight even when empty-handed.` weight `2`
- `Contact` text `Old Marten the carter still remembers the spring you dragged his millstones uphill through flood mud.` weight `2`
- `Nothing` weight `2`

### 4. Broken in service

- `ChoiceTitle`: `Broken in service`
- `ChoiceText`: `When a cart overturned on the road, pinning a man beneath it, you heaved it high enough for others to pull him free and felt something in your own body give way that never properly healed.`
- `ChoiceBio`: `People remembered the rescue with gratitude; your body remembered it as the day strength became injury.`

`Effects1`
- `Body` weight `3`
- `Social` amount `1` weight `2`
- `Stat` target `Stamina` amount `1` weight `1`

`Effects2`
- `Contact` text `Garin Pike still limps, and still says he would have died under the cart if you had not lifted it.` weight `3`
- `Drive` target `add` amount `Duty` weight `2`
- `Nothing` weight `1`

`Effects3`
- `Bio` amount `People praised your courage more easily than they helped you bear what it cost.` weight `3`
- `Money` amount `25` weight `1`
- `Nothing` weight `2`

### 5. Foreman's beast

- `ChoiceTitle`: `Foreman's beast`
- `ChoiceText`: `The day a wagon of stone had to be unloaded before dusk, you carried what should have taken two laborers, and after that the foreman watched you the way men watch a valuable animal.`
- `ChoiceBio`: `One hard day taught your betters that your strength could save them wages, and they rarely forgot it.`

`Effects1`
- `Money` amount `60` weight `3`
- `Stat` target `Strength` amount `1` weight `1`
- `Contact` text `Foreman Joric still remembers the evening you emptied the stone wagon before the bell.` weight `2`

`Effects2`
- `Social` amount `-1` weight `2`
- `Drive` target `add` amount `Pride` weight `2`
- `Drive` target `add` amount `Resentment` weight `2`

`Effects3`
- `Bio` amount `Work taught you that usefulness can look a lot like ownership from the wrong side of the bargain.` weight `3`
- `Body` weight `1`
- `Nothing` weight `2`

### 6. The beating you stayed standing through

- `ChoiceTitle`: `The beating you stayed standing through`
- `ChoiceText`: `In the tannery yard, they beat you to make an example of you, but you stayed on your feet until even the men holding you went quiet.`
- `ChoiceBio`: `From then on, people spoke of your strength not as triumph, but as the frightening refusal to go down when any sensible body should.`

`Effects1`
- `Body` weight `3`
- `Social` amount `1` weight `2`
- `Drive` target `add` amount `Defiance` weight `1`

`Effects2`
- `Contact` text `Nessa Vale still remembers the silence that fell over the tannery yard before you dropped.` weight `2`
- `Bio` amount `After that day, people looked at you as someone difficult to break cleanly.` weight `2`
- `Nothing` weight `2`

`Effects3`
- `Luck` amount `true` weight `1`
- `Social` amount `-1` weight `2`
- `Nothing` weight `3`

### 7. Wrestler's reputation

- `ChoiceTitle`: `Wrestler's reputation`
- `ChoiceText`: `At a fair-day bout, you threw an opponent everyone expected to shame you, and by sunset strangers were repeating your name as if they had known it for years.`
- `ChoiceBio`: `That single public victory taught you how quickly visible strength turns into rumor, expectation, and reputation.`

`Effects1`
- `Social` amount `1` weight `3`
- `Money` amount `50` weight `2`
- `Contact` text `Hob the miller's son still measures every fairground wrestler against the throw you gave him.` weight `1`

`Effects2`
- `Drive` target `add` amount `Pride` weight `2`
- `Bio` amount `For a while, your name moved ahead of you wherever contests of force were remembered.` weight `2`
- `Nothing` weight `2`

`Effects3`
- `Contact` text `The alewife at Red Well still remembers the day the crowd shouted your name over her benches.` weight `2`
- `Body` weight `1`
- `Nothing` weight `3`

### 8. Held the door

- `ChoiceTitle`: `Held the door`
- `ChoiceText`: `When the granary gate buckled in the fire, you set your shoulder to it and held long enough for the trapped workers to run past you.`
- `ChoiceBio`: `The moment stayed with you as proof that strength is sometimes measured in nothing but the time it buys for others.`

`Effects1`
- `Contact` text `Willem Broach still swears he only reached the yard because you held the gate in the fire.` weight `3`
- `Social` amount `1` weight `2`
- `Stat` target `Stamina` amount `1` weight `1`

`Effects2`
- `Body` weight `2`
- `Drive` target `add` amount `Protectiveness` weight `2`
- `Nothing` weight `2`

`Effects3`
- `Bio` amount `The memory stayed with you: weight, splintering wood, shouting, and the knowledge that your body was the last thing in the way.` weight `3`
- `Money` amount `20` weight `1`
- `Nothing` weight `2`

### 9. Carried the wounded

- `ChoiceTitle`: `Carried the wounded`
- `ChoiceText`: `After the chapel roof came down, you lifted Father Iven onto your shoulders and carried him all the way to the river infirmary without stopping once.`
- `ChoiceBio`: `From that day on, your strength was tied in memory to another person's continued life.`

`Effects1`
- `Contact` text `Father Iven's niece still says her uncle lived because you did not stop walking.` weight `3`
- `Social` amount `1` weight `2`
- `Drive` target `add` amount `Compassion` weight `1`

`Effects2`
- `Body` weight `2`
- `Bio` amount `The burden remained in your memory long after the weight left your shoulders.` weight `2`
- `Nothing` weight `2`

`Effects3`
- `Money` amount `30` weight `2`
- `Luck` amount `true` weight `1`
- `Nothing` weight `3`

### 10. Too useful to rest

- `ChoiceTitle`: `Too useful to rest`
- `ChoiceText`: `After you hauled Branek's grain cart out of axle-deep mud in front of the whole lane, every impossible job in the quarter started arriving at your door.`
- `ChoiceBio`: `One visible feat turned your strength into something neighbors and masters alike began to treat as theirs to call upon.`

`Effects1`
- `Contact` text `The Candle Lane neighbors still send boys to your door when brute work defeats them.` weight `3`
- `Money` amount `45` weight `2`
- `Stat` target `Strength` amount `1` weight `1`

`Effects2`
- `Social` amount `1` weight `2`
- `Drive` target `add` amount `Duty` weight `2`
- `Drive` target `add` amount `Resentment` weight `2`

`Effects3`
- `Bio` amount `There were years when rest felt less like a right than a privilege others had forgotten to grant you.` weight `3`
- `Nothing` weight `3`

### 11. Strong arm in a weak matter

- `ChoiceTitle`: `Strong arm in a weak matter`
- `ChoiceText`: `You stood behind Master Hadrik while he collected a debt in the fish market, and the man across the table paid before the argument properly began.`
- `ChoiceBio`: `That day taught you that strength is often hired not to strike, but to make sure no one thinks striking would help.`

`Effects1`
- `Money` amount `70` weight `3`
- `Social` amount `-1` weight `2`
- `Contact` text `Master Hadrik still remembers how quickly the fishmonger found his purse once you filled the doorway.` weight `1`

`Effects2`
- `Drive` target `add` amount `Shame` weight `2`
- `Drive` target `add` amount `Ambition` weight `2`
- `Nothing` weight `2`

`Effects3`
- `Bio` amount `You learned the difference between being feared for yourself and being feared on someone else's behalf.` weight `3`
- `Body` weight `1`
- `Nothing` weight `2`

### 12. Pulled through

- `ChoiceTitle`: `Pulled through`
- `ChoiceText`: `When the brewery beam tore loose above the mash floor, you caught it on your shoulder long enough for the coopers below to scramble clear.`
- `ChoiceBio`: `You remember that instant as the moment when sheer force, applied at the right heartbeat, changed what the day would become.`

`Effects1`
- `Social` amount `1` weight `3`
- `Contact` text `Cooper Len still remembers the crack of the beam and the instant you kept it from crushing him.` weight `2`
- `Stat` target `Strength` amount `1` weight `1`

`Effects2`
- `Body` weight `2`
- `Money` amount `35` weight `2`
- `Nothing` weight `2`

`Effects3`
- `Bio` amount `People retold the story more simply than you remembered it; they remembered force, while you remembered fear and slipping grip.` weight `3`
- `Luck` amount `true` weight `1`
- `Nothing` weight `2`

### 13. Protective bulk

- `ChoiceTitle`: `Protective bulk`
- `ChoiceText`: `When the tax riot broke the market line, your younger sister vanished behind your back and did not leave your shadow until the stones stopped flying.`
- `ChoiceBio`: `That moment taught you that strength can become shelter long before it becomes honor.`

`Effects1`
- `Contact` text `Your younger sister still stands a little closer to you in any crowd that turns ugly.` weight `3`
- `Drive` target `add` amount `Protectiveness` weight `2`
- `Social` amount `1` weight `1`

`Effects2`
- `Bio` amount `You learned how quickly protection becomes obligation once someone believes you can keep them safe.` weight `2`
- `Body` weight `1`
- `Nothing` weight `3`

`Effects3`
- `Money` amount `20` weight `2`
- `Nothing` weight `4`

### 14. Hands like tools

- `ChoiceTitle`: `Hands like tools`
- `ChoiceText`: `At the hiring yard, the cooper looked once at your scarred palms and rope-cut shoulders and named you for heavy work before asking your trade.`
- `ChoiceBio`: `By then your body had become a record of labor so plain that strangers could read it at a glance.`

`Effects1`
- `Body` weight `3`
- `Stat` target `Strength` amount `1` weight `2`
- `Stat` target `Stamina` amount `1` weight `1`

`Effects2`
- `Bio` amount `Callus, scar, and posture made your history visible before you spoke a word of it.` weight `3`
- `Social` amount `1` weight `1`
- `Nothing` weight `2`

`Effects3`
- `Contact` text `The cooper at Saint Bartram's yard still greets you as one of the truly worked.` weight `2`
- `Money` amount `30` weight `2`
- `Nothing` weight `2`

### 15. A blow remembered

- `ChoiceTitle`: `A blow remembered`
- `ChoiceText`: `In a quarrel that should have ended with shouting, you landed one blow so hard and so publicly that people kept referring to the dispute by that moment long after the reason for it was forgotten.`
- `ChoiceBio`: `You learned that a single act of force can outlive its cause and go on shaping your name by itself.`

`Effects1`
- `Social` amount `1` weight `2`
- `Social` amount `-1` weight `2`
- `Money` amount `50` weight `2`

`Effects2`
- `Contact` text `Tomas Venn still rubs his jaw when your name comes up.` weight `2`
- `Drive` target `add` amount `Guilt` weight `2`
- `Drive` target `add` amount `Pride` weight `2`

`Effects3`
- `Bio` amount `The story lasted longer than the pain, which was a mixed blessing depending on who told it.` weight `3`
- `Body` weight `1`
- `Nothing` weight `2`

### 16. Strength drew patronage

- `ChoiceTitle`: `Strength drew patronage`
- `ChoiceText`: `Lady Merrow first noticed you when you carried her fallen horse's saddle chest the length of the ford after three servants failed to budge it.`
- `ChoiceBio`: `Your strength brought you under the eye of someone important, which is another way of saying it changed the road your life could take.`

`Effects1`
- `Contact` text `Lady Merrow's steward still remembers the man who lifted the chest out of the ford.` weight `3`
- `Money` amount `80` weight `2`
- `Social` amount `1` weight `1`

`Effects2`
- `Drive` target `add` amount `Ambition` weight `2`
- `Bio` amount `You learned that strength attracts not only need, but opportunity shaped by hierarchy.` weight `2`
- `Nothing` weight `2`

`Effects3`
- `Luck` amount `true` weight `1`
- `Body` weight `1`
- `Nothing` weight `4`

### 17. Carried beyond reason

- `ChoiceTitle`: `Carried beyond reason`
- `ChoiceText`: `With the reliquary in your arms, you climbed the whole hill to Saint Oran's while your legs shook so badly the watching crowd crossed themselves.`
- `ChoiceBio`: `You remember it as the worst kind of miracle: the body going on past reason because stopping was unthinkable.`

`Effects1`
- `Stat` target `Strength` amount `1` weight `2`
- `Stat` target `Stamina` amount `1` weight `2`
- `Social` amount `1` weight `2`

`Effects2`
- `Body` weight `3`
- `Contact` text `The sexton at Saint Oran's still tells how you brought the reliquary up the hill without setting it down.` weight `2`
- `Nothing` weight `1`

`Effects3`
- `Bio` amount `The memory lingered with an almost frightening clarity: breath gone raw, limbs shaking, and the fact that you did not stop.` weight `3`
- `Luck` amount `true` weight `1`
- `Nothing` weight `2`

### 18. Strength that troubled people

- `ChoiceTitle`: `Strength that troubled people`
- `ChoiceText`: `After you lifted the fallen shrine stone clear of the altar steps by yourself, the people in the nave stopped calling you strong and started calling you unsettling.`
- `ChoiceBio`: `From then on, your strength no longer seemed ordinary to others; it became a thing they admired, suspected, and whispered about in equal measure.`

`Effects1`
- `Social` amount `1` weight `2`
- `Social` amount `-1` weight `2`
- `Stat` target `Power` amount `1` weight `2`

`Effects2`
- `Body` weight `2`
- `Drive` target `add` amount `Pride` weight `2`
- `Drive` target `add` amount `Isolation` weight `2`

`Effects3`
- `Bio` amount `Admiration and unease settled around you together, and you could rarely be sure which arrived first.` weight `3`
- `Contact` text `Brother Caldus still speaks of the shrine stone in a voice that never quite chooses between awe and fear.` weight `2`
- `Nothing` weight `1`

---

## Conversion notes

When turning this draft into actual Foundry chargen content:

- each numbered result becomes a **chargen-template item**
- the `Your Nature - Strength` roll table points its `3-18` ranges at those items
- `Effects1`, `Effects2`, and `Effects3` should be entered as the normal CSB dynamic tables
- if you want **strength-specific body marks**, either:
  - rely on the current shared body table for generic marks, or
  - create a dedicated body-table variant for `Your Nature` and point these results there via
    setup/config

## Recommended next step

If this tone is right, the cleanest next companion tables would be:

1. `Stamina`, because it overlaps with bodily consequence but leans more toward endurance,
   illness-resistance, and attrition.
2. `Power`, because `Strength 18` already brushes that edge and helps define the boundary
   between physical force and uncanny force.
