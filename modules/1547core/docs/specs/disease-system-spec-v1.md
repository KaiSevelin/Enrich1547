# Disease System Spec v1

**Status: Source design — authored by the project owner.** This is the canonical
disease design. Implementation is pending; see the connections below for the systems it
plugs into.

## Connections

- **Humours** drive contraction/immunity/resistance. The four `Humour_*` actor flags
  (actor template `Tgs09eTiTp63Cp7u`, set in chargen — see the birth-humours step and the
  `HumourChange` directive) decide which characters can contract which disease.
- **Spirits** are a disease *cause*; contagion for spirit-diseases is a check vs spirit
  `Power`. See [`spirit-base-starter-spec-v1.md`](spirit-base-starter-spec-v1.md).
- **The race board** (`scripts/raceboard/`) is the cure mechanic — each disease's
  treatment table is a race board of medical roles × phases. See
  [`ritual-execution-spec-v1.md`](ritual-execution-spec-v1.md) for the other race-board use.
- **Statuses** "weak" / "exhausted" map to actor conditions; `Weakened` is formalized in
  [`status-effects-guide.md`](status-effects-guide.md). `Exhausted` is still to formalize.

---

# The four body fluids

In the 16th century diseases were a normal part of life.
The cause of diseases are from the four humors and poisoned air, miasma.

* Blood (warm and moist, air) is associated with charm.
* Phlegm (cold and moist, water) is associated with calmness and endurance
* Yellow bile (warm and dry, fire) is associated with aggression and nerve
* Black bile (cold and dry, earth) is associated with focus and caution.

Imbalance of a body fluid is a cause of many diseases. A special case is *general*
imbalance which is when all body fluids are in a flux.

## Balancing the body fluids

A session with a doctor will provide advantage to stamina saves for a week. The sessions are:

* Blood: bloodletting and cooling diet
* Phlegm: sweating and dry wine
* Yellow bile: baths and cooling drinks
* Black bile: laxatives with music and cheerful company.
* Balanced humors: Is not dominated by any humor.
* Unbalanced humors: Is dominated by **all or some** humors.
* General balancing: a combination of the above combined with some cupping and astrology.

## Other causes of diseases

Other things than body fluids can be a cause of illness. These affect all and are the
cause of several severe diseases.
**Miasma** is corrupted air that can give diseases.

* Astral miasma, poisonous fumes from hell.
* English miasma, a specific miasma found in England, more rarely otherwise.
* Stale miasma, air that becomes poisonous due to low ventilation.
* Marsh miasma, poisonous air from swamps and marshes.

**Spirits** can also give diseases by corrupting a person's head.
**Unnaturals** can give players a demonic possession.

### Detecting Miasma

Medical personnel use three different tests to find dangerous miasma.
The candle test is done by carrying a lit candle and observing its smoke. A trained candle
handler will detect miasma.
The pomander is a fragrant ball that is carried by medical personnel. If the fragrance
can't be noticed it is probably due to miasma.
Astrology and stars can in the hands of a skilled astrologer detect times and places for
concentrations of miasma.

For detection of astral miasma see spirit sight.

People wanting to be healthy avoid miasma rich areas such as graveyards, slums,
quarantined ships and villages.

### Detecting spirits

The standard tests for spirit presence is through scrying and to read prayers and listen
for reactions. Sounds, cold pockets in a room and smells (sulphur) might lead to the
detection of a spirit as well. Spirit sight is used here as well.

## Contracting diseases

Diseases are contracted when:

* A player is in an area of miasma
* Something throws the humor balance off in the body
* A player is in the presence of a malevolent spirit
* Unnaturals can also possess a player

A player subjected to a source of a disease must succeed in a stamina save or contract the
disease in question.

## Medical staff

### Physician

The physician makes diagnoses and decides the treatment.

### Barber-surgeon

The barber-surgeon handles bloodletting, surgery, bloodletting and trepanning.

### Apothecary

The apothecary mixes syrups and ointments from herbs.

### Cleric

A cleric handles processions, pilgrimages and fasts.

## Medications

A lot of things were used as medication, from prayers to herbs and saunas. Some
medications had side effects though.

### Bloodletting

One of the most common cures was bloodletting. A session of bloodletting lowers the active
strength for the patient with 1 for the next 24 hours.

### Opiates

Opiates lowers the active dexterity for the patient with 1 for the next 24 hours. Regular
use of opiates or use over a prolonged period of time might lead to addiction.

### Trepanning

Trepanning, the drilling of a hole in a patient's brain to let out bad spirits, is a
dangerous therapy. A player who goes through a trepanning must succeed on a stamina roll
against 2d6 or die.

### Panacea

Panacea is a legendary cure-all medicine, sought by alchemists.

## General flow of a disease

### Contagion

The first step is to get infected.

### Incubation

A period when everything seems ok.

### Symptoms

A period where symptoms show without any lowered stats.

### Onset

First stage with shivers and fevers. Treat the player as **weak.**

### Crisis

Second stage when the symptoms are clear. Treat the player as **exhausted**.

### Resolution

Get well or die.

### Convalescence

For those that survive the time to get rid of stat changes. Permanent changes stay with
the player.

## Cure race board

Treating a disease is run on the race board (`scripts/raceboard/`). The board is **one
track whose boxes are exactly the role-action columns of that disease's table for the
current phase** — e.g. Plague Onset has six boxes (Diagnose, Bloodletting, Mix herbs, Mix
sulphur, Stamina-or-die, Treat disease). **To cure the disease, every box must be filled.**

### Who rolls what

Each box is a single roll against that cell's difficulty pool (the opposed-roll model: the
roller's pool must exceed the cell's `Nd6`).

| Box owner | Rolls |
|---|---|
| Physician | Medicine |
| Apothecary | Herbalism (or Alchemy) |
| Cleric | Religion |
| Barber-Surgeon | Surgeon (`Skills_ServicesExpertiseSurgeon`) |
| Player | Stamina |

### A treatment attempt

One attempt rolls every **still-empty** box once and **consumes the disease's stated
treatment time regardless of outcome** (Plague = 1 day, Ship fever = 1d3 days, …).

- **Medical boxes** (Medicine / Herbalism / Religion / Surgeon): success **fills** the box;
  failure leaves it empty — only the time is spent, and it is re-rolled next attempt.
- The **"Stamina or die" box**: success fills it (the patient holds on); **failure is
  death** — the disease's lethal hit, not merely lost time.
- **Filled boxes persist** across attempts within the phase; later attempts re-roll only
  the still-empty boxes.

### Winning, time, and phase advance

- **All boxes filled → cured → convalescence.**
- **Phase freeze:** an attempt always completes at the phase it began on — the disease does
  not change phase mid-attempt.
- **The clock:** each attempt adds its treatment time to the days elapsed in the phase.
  When elapsed time exceeds the phase's duration (Onset `1d3` days, etc.) before the board
  is full, the disease **advances to the next phase and the board resets to that phase's
  row, all boxes empty.** Progress is lost and the new boxes are harder. This time pressure
  *is* the race.
- **Death:** a failed "Stamina or die" box, or the disease reaching its **Resolution**
  uncured (the Resolution save).

### Notes

- An untreated disease simply runs its phase clocks to Resolution.
- "Diagnose" is just another box that must be filled; until the Physician fills it the
  disease's identity (and the correct treatment) is unconfirmed in the fiction.
- The board is the existing race-board track; the winner splash fires when it fills (cured).

## Diseases

### Plague

Catching the plague is never good. The plague is caused by Astral miasma, poisonous air
seeping from another plane of existence.

* **Contagion:** Stamina check 3d6
* **Incubation:** 1d6 days
* **Symptoms:** 0 days
* **Onset:** 1d3 days, usually a gradual phase of fevers, pain and finally swollen lymphs.
* **Crisis:** 1d3 days. The swollen lymph starts to hemorrhage and gangrene sets in on:
  1. Fingers. The player loses 1d3 fingers and gets a **permanent** -1 step on dexterity
  2. Nosetip. The player's nose tip rots, giving the player a **permanent** -1 step on charisma.
  3. Toes. 1d3 toes rot away giving the player a limp and a **permanent** -1 step on dexterity.
  4. No gangrene
* **Resolution:** If the player fails a stamina check against 4d6 the player dies, otherwise he recovers.
* **Convalescence:** 1d6 days to get his strength back if the player has reached the crisis phase; 1d3 days if he only reached the onset phase; 0 days if he only reached the incubation phase.
* **Immunity:** None
* **Resistance:** Players not dominated by blood get advantage to avoid contracting the disease.
* **Prevention:** Avoid places with astral miasma.
* **Diagnosis:** Easy in the crisis phase
* **Cure:** A medic can cure with a combination of bloodletting, sulphur fumigation, and herbs. The treatment takes 1 day.

**Race board**

| Phase | Physician (Diagnose) | Barber-Surgeon (Bloodletting) | Apothecary (Mix herbs) | Apothecary (Mix sulphur) | Player (Stamina or die) | Physician (Treat disease) |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| **Onset** | 2d6 | 2d6 | 2d6 | 2d6 | 2d6 | 3d6 |
| **Crisis** | 1d6 | 2d6 | 2d6 | 2d6 | 3d6 | 4d6 |

### Small pox

Smallpox is caused by too much impure blood. Stars in the wrong position can increase the
chance of contracting the disease.

* **Contagion:** Stamina check 3d6
* **Incubation:** 1d6 + 6 days
* **Symptoms:** 0 days
* **Onset:** 1d6 + 10 days, fevers, vomiting, muscle pain
* **Crisis:** 1d3 days, blisters start showing and cover the body.
* **Resolution:** If the player fails a stamina check against 2d6 the player dies, otherwise he recovers.
* **Convalescence:** 1d6 days if reached crisis; 1d2 days if only onset; 0 days if only incubation.
* **Immunity:** Only players of blood-type can contract this disease.
* **Resistance:** None.
* **Prevention:** Bloodletting prevents any chance of contracting smallpox in a week.
* **Diagnosis:** A medic can diagnose the disease, easier in the crisis phase.
* **Cure:** A medic can cure the disease with a cooling regiment and herbs. The treatment takes 1d2 days.

**Race board**

| Phase | Physician (Diagnose) | Apothecary (Mix cooling) | Apothecary (Mix herbs) | Physician (Treat disease) |
| :---- | :---- | :---- | :---- | :---- |
| **Onset** | 3d6 | 1d6 | 2d6 | 2d6 |
| **Crisis** | 2d6 | 1d6 | 2d6 | 3d6 |

### Great pox

Great pox is caused by astral miasma from a sex partner. Sometimes as a punishment from a
spirit.

* **Contagion:** Stamina check 2d6. If a spirit is the cause, Stamina vs spirit Power.
* **Incubation:** 1d6 * 10 + 10 days
* **Symptoms:** 2d6 + 2 years, genital blisters, sore throat, hair loss
* **Onset:** 1d6 years, muscle pain, inflammations and swollenness
* **Crisis:** Permanent, deformed face. -2 Charisma **permanent**.
* **Resolution:** No resolution
* **Convalescence:** 1d2 days if the player reaches the onset phase; 0 days if only incubation.
* **Immunity:** Only players of blood-type can contract this disease.
* **Resistance:** None.
* **Prevention:** Avoid sex.
* **Diagnosis:** The disease is hard to diagnose in the onset phase.
* **Cure:** A medic can cure the disease with mercury. A treatment takes 1d10 days. If the disease reaches the crisis phase it can only be cured with a trepanning to let the spirit out.

**Onset and symptoms phase:**

| Physician (Diagnose) | Apothecary (Mix mercury) | Player (Stamina or die) | Physician (Treat disease) |
| :---- | :---- | :---- | :---- |
| 4d6 | 1d6 | 2d6 | 2d6 |

**Crisis phase:**

| Barber-Surgeon (Trepanning) | Player (Stamina or die) | Physician (Treat disease) |
| :---- | :---- | :---- |
| 2d6 | 2d6 | 3d6 |

### English sweat

English sweat is caused by English miasma.

* **Contagion:** Stamina check 2d6
* **Incubation:** 1d6 days
* **Symptoms:** NA
* **Onset:** NA
* **Crisis:** 1d3 + 7 hours. A sense of apprehension and violent cold shivers followed by fevers, delirium and intense thirst.
* **Resolution:** If the player succeeds with a stamina check against 3d6 the player survives, otherwise he dies.
* **Convalescence:** 1d6 + 2 days to recover; 0 days if only incubation.
* **Immunity:** Players with balanced humors are immune to the disease.
* **Resistance:** None
* **Prevention:** A session with general balancing of the humors will give advantage to saves for a week.
* **Diagnosis:** The disease can only be diagnosed in the crisis phase.
* **Cure:** A medic can cure the disease with a bed regiment and herbs. The treatment takes 1d4 hours.

| Phase | Physician (Diagnose) | Cleric (Bed regiment) | Apothecary (Mix herbs) | Physician (Treat disease) |
| :---- | :---- | :---- | :---- | :---- |
| **Crisis** | 2d6 | 1d6 | 2d6 | 3d6 |

### Ship fever

Ship fever is a disease caused by stale miasma. It is associated with an imbalance of phlegm.

* **Contagion:** Stamina check 2d6
* **Incubation:** 2d6 + 4 days
* **Symptoms:** NA
* **Onset:** 1d4 + 5 days. Flu-like symptoms with fever.
* **Crisis:** 2d10 days. A rash spreads over the body with delirium and sensitivity to light.
* **Resolution:** If the player succeeds with a stamina check against 4d6 the player survives, otherwise he enters a coma and dies.
* **Convalescence:** 2d4 days to recover; 0 days if only incubation.
* **Immunity:** Only phlegm characters can contract the disease.
* **Resistance:** None
* **Prevention:** Avoid stale miasma. Quarantine. Phlegm sessions for +4 to save for a week.
* **Diagnosis:** This disease is hard to diagnose and is often mixed up with common fevers.
* **Cure:** A medic can cure the disease with bloodletting, smoke and herbs. The treatment takes 1d3 days.

| Phase | Physician (Diagnose) | Barber-Surgeon (Bloodletting) | Apothecary (Mix herbs) | Apothecary (Mix smoke) | Physician (Treat disease) |
| :---- | :---- | :---- | :---- | :---- | :---- |
| **Onset** | 4d6 | 2d6 | 2d6 | 2d6 | 2d6 |
| **Crisis** | 3d6 | 2d6 | 2d6 | 2d6 | 3d6 |

### Agues

Agues is a fever disease caused by marsh miasma and too much yellow bile.

* **Contagion:** Stamina check 1d6
* **Incubation:** 1d6 + 8 days
* **Symptoms:** NA
* **Onset:** 1d2 days. Heavy fevers.
* **Crisis:** 1 day. Inability to make the eyes turn in the same direction and cramps.
* **Resolution:** If the player succeeds with a stamina check against 4d6 the player survives, otherwise he enters a coma and dies.
* **Convalescence:** 2d4 days to recover; 0 days if only incubation.
* **Immunity:** Only players dominated by yellow bile can contract the disease.
* **Resistance:** None
* **Prevention:** Avoid marsh miasma. Rumors talk of a bark that can be chewed to avoid contracting the disease.
* **Diagnosis:** A medic can diagnose the disease quite easily.
* **Cure:** A medic can cure the disease with intervals of bloodletting and cooling herbs. The treatment takes 1 day.

| Phase | Physician (Diagnose) | Barber-Surgeon (Bloodletting) | Apothecary (Mix herbs) | Physician (Treat disease) |
| :---- | :---- | :---- | :---- | :---- |
| **Onset** | 2d6 | 2d6 | 2d6 | 2d6 |
| **Crisis** | 1d6 | 2d6 | 2d6 | 4d6 |

### Bloody flux

Bloody flux is a stomach disease that gives bloody diarrhea. Too much black bile is the cause.

* **Contagion:** Stamina check 3d6
* **Incubation:** 1d3 days
* **Symptoms:** 1d2 days. Diarrhea.
* **Onset:** 1d6 days. Dehydration and pain.
* **Crisis:** 1d6 days. Bloody diarrhea.
* **Resolution:** If the player succeeds with a stamina check against 1d6 he survives.
* **Convalescence:** 1d6 + 1 days to fully recover; 0 days if only incubation.
* **Immunity:** Only players dominated by black bile can contract the disease.
* **Resistance:** None
* **Prevention:** A vomiting session will reduce the black bile in the body and gives +4 on stamina save for a week.
* **Diagnosis:** The disease is quite easy to diagnose.
* **Cure:** A medic can cure the disease with a strict opium regiment combined with prayers. It takes 1d3 days.

| Phase | Physician (Diagnose) | Apothecary (Mix opium) | Player (Stamina or addicted) | Cleric (Pray) | Physician (Treat disease) |
| :---- | :---- | :---- | :---- | :---- | :---- |
| **Onset and before** | 2d6 | 1d6 | 2d6 | 1d6 | 1d6 |
| **Crisis** | 1d6 | 1d6 | 2d6 | 1d6 | 2d6 |

### Consumption

Consumption is a lung disease caused by black bile.

* **Contagion:** Stamina check 1d6
* **Incubation:** NA
* **Symptoms:** 6d6 days. Typically cough with blood.
* **Onset:** 6d6 days. Fevers, powerlessness and paleness. **Permanently** -1 on strength.
* **Crisis:** 1d6 days. Breathing problems.
* **Resolution:** If the player succeeds with a stamina save vs 3d6 the player survives, otherwise he dies.
* **Convalescence:** 4d6 days to fully recover.
* **Immunity:** Only players dominated by black bile can contract the disease.
* **Resistance:** None
* **Prevention:** A black bile balancing session will give advantage on saves for a week. Any joyful experience such as theatre, opera or parties will give advantage to the save for a week.
* **Diagnosis:** Consumption is easy to diagnose.
* **Cure:** A medic can cure the disease by moving the patient to a place with mountain or sea air for at least 15 days combined with a diet based on goat milk. The treatment takes 15 days.

| Phase | Physician (Diagnose) | Cleric (Diet) | Apothecary (Mix herbs) | Physician (Treat disease) |
| :---- | :---- | :---- | :---- | :---- |
| **All phases** | 1d6 | 1d6 | 2d6 | 2d6 |

### Lepra

Lepra is a deforming disease caused by chronically corrupted humors, especially black bile.

* **Contagion:** Stamina check 1d6
* **Incubation:** 1d2 + 4 years
* **Symptoms:** 2d6 years. Small signs of deformation in extremities, pink skin rashes sensitive to heat.
* **Onset:** 1d6 years. Deformation of fingers, face and toes. **Permanently** -1 on strength, dexterity, stamina and charisma.
* **Crisis:** 1d3 years. Paralysis and loss of tissue. The player is removed from play.
* **Resolution:** If the player enters the crisis phase it is game over.
* **Convalescence:** 3d6 months to fully recover.
* **Immunity:** Only players dominated by black bile can contract the disease.
* **Resistance:** People with Faith dice higher than one will get advantage on the contraction check.
* **Prevention:** A humor balancing session will give advantage on saves for a week.
* **Diagnosis:** A medic can diagnose the disease quite easily.
* **Cure:** A medic can cure the disease by ordering the patient to stay in a lepra colony for 1d4 years combined with pilgrimage, religious processions and prayers. Treatment time is 1d6 years.

| Phase | Physician (Diagnose) | Cleric (Pilgrimage) | Cleric (Processions) | Cleric (Prayers) |
| :---- | :---- | :---- | :---- | :---- |
| **Onset and before** | 2d6 | 2d6 | 2d6 | 2d6 |
| **Crisis** | 1d6 | 3d6 | 3d6 | 3d6 |

### St Anthony's Fire

St Anthony's Fire is a disease caused by spirits. It shows swollen limbs, blisters,
hallucinations and later gangrene.

* **Contagion:** Stamina check vs spirit Power
* **Incubation:** 3d6 days
* **Symptoms:** 3d6 days. Rashes, blisters and swollen limbs.
* **Onset:** 3d6 days. Spreading of symptoms, temporal hallucinations.
* **Crisis:** 2d6 days. Gangrene forcing amputation of limb. 1-3 Arm (Lose 2 steps of Dexterity, Strength and Stamina **permanently**, only one hand available for equipment); 4-6 Leg (Lose 2 steps of Dexterity, Strength and Stamina **permanently**, movement halved with prosthesis).
* **Resolution:** If the player enters the crisis phase it is game over.
* **Convalescence:** 2d6 days to fully recover.
* **Immunity:** Players with balanced humors are immune.
* **Resistance:** None.
* **Prevention:** A humor balancing session will give advantage on saves for a week.
* **Diagnosis:** A medic can diagnose the disease with difficulty in the beginning.
* **Cure:** A cleric can cure the disease by fasting, prayers and by using special wine and lard. Treatment time is 1d6 years.

| Phase | Physician (Diagnose) | Cleric (Fasting) | Apothecary (Wine and lard) | Cleric (Prayers) |
| :---- | :---- | :---- | :---- | :---- |
| **Onset and before** | 3d6 | 1d6 | 1d6 | 1d6 |
| **Crisis** | 1d6 | 2d6 | 2d6 | 3d6 |

## Melancholy

Melancholy is a disease caused by excess of black bile.

* **Contagion:** Faith check 1d6
* **Incubation:** 1d2 days
* **Symptoms:** 1d6 days. Gloominess and the player gets **weak**.
* **Onset:** 3d6 days. Depression. **Permanently** -1 step on Faith.
* **Crisis:** 3d6 days. **Permanently** -1 step on Power, Charisma and Faith.
* **Resolution:** None
* **Convalescence:** None
* **Immunity:** Only players dominated by black bile can contract the disease.
* **Resistance:** People with Faith dice higher than one will get advantage on the contraction check.
* **Prevention:** A humor balancing session will give advantage on saves for a week.
* **Diagnosis:** A cleric can diagnose the disease quite easily.
* **Cure:** A cleric will order a regime of wine, music and dance to lift the melancholy. Treatment time is 1d6 days.

| Phase | Cleric (Diagnose) | Cleric (Dance, wine, music) |
| :---- | :---- | :---- |
| **Onset and before** | 2d6 | 2d6 |
| **Crisis** | 1d6 | 3d6 |

## Mania

Mania is a disease caused by excess of yellow bile or corruption from a spirit. It is
connected to hysterical outbreaks and anger.

* **Contagion:** Faith check 1d6
* **Incubation:** 1d6 days
* **Symptoms:** 1d6 days. The player gets disadvantage on all **charisma** checks.
* **Onset:** 3d6 days. Hysteria. **Permanently** -1 step on Charisma.
* **Crisis:** 3d6 days. **Permanently** -1 step on Intelligence and Charisma.
* **Resolution:** None
* **Convalescence:** None
* **Immunity:** Only players dominated by yellow bile can contract the disease.
* **Resistance:** People with Faith dice higher than one will get advantage on the contraction check.
* **Prevention:** A humor balancing session will give advantage on saves for a week.
* **Diagnosis:** A cleric can diagnose the disease quite easily.
* **Cure:** A physician will order restraints and odor therapy together with shaving of head and opiates to lift the disease. Treatment time is 1d6 days.

| Phase | Physician (Diagnose) | Barber-Surgeon (Shave head) | Apothecary (Opiates) | Physician (Restrain) | Apothecary (Odors) |
| :---- | :---- | :---- | :---- | :---- | :---- |
| **Onset and before** | 2d6 | 1d6 | 2d6 | 1d6 | 1d6 |
| **Crisis** | 1d6 | 1d6 | 3d6 | 2d6 | 1d6 |

## Dancing mania

Dancing mania is a disease caused by corruption from a spirit.

* **Contagion:** Power check vs the spirit's Power
* **Incubation:** 1d6 days
* **Symptoms:** 2d6 days. The player starts suddenly dancing for short periods of time.
* **Onset:** 1 day. The player dances constantly and ignores food. The player gets **weak**.
* **Crisis:** 1 day. The player gets **exhausted**.
* **Resolution:** The player dies.
* **Convalescence:** None
* **Immunity:** Players with faith dice higher than the spirit are immune to the disease.
* **Resistance:** None.
* **Prevention:** None
* **Diagnosis:** A cleric can diagnose the disease quite easily.
* **Cure:** A cleric will order vows together with soothing music to lift the disease. Treatment time is 1 day.

| Phase | Cleric (Diagnose) | Cleric (Vows and prayers) | Cleric (Soothing music) |
| :---- | :---- | :---- | :---- |
| **Onset and before** | 1d6 | 1d6 | 1d6 |
| **Crisis** | 1d6 | 3d6 | 3d6 |

## Spirit possession

Possession is when a spirit or unnatural possesses a body and takes control of the player.
Typical signs are filthy language, change of voice and vomits.

* **Contagion:** Faith check vs the spirit's or unnatural's Power
* **Incubation:** 1 day
* **Symptoms:** 1d6 days. The player starts showing signs of possession. It could be unnatural stances, weird speaking or aversion to the same things as the spirit or unnatural are averted from.
* **Crisis:** 6d6 days. The player needs to succeed on a Power check vs the spirit or unnatural to maintain free will.
* **Resolution:** The player dies as the spirit or unnatural claims his soul.
* **Convalescence:** 1d6 days.
* **Immunity:** Players that have Faith higher than the spirit's Power are immune to the disease.
* **Resistance:** None.
* **Prevention:** None
* **Diagnosis:** A cleric can diagnose the disease.
* **Cure:** A cleric will perform an exorcism spell together with fasting and opiates. Treatment time is 1d6 days.

| Phase | Cleric (Diagnose) | Cleric (Fasting) | Apothecary (Opiates) | Cleric (Exorcism — ritual spell) |
| :---- | :---- | :---- | :---- | :---- |
| **Onset and before** | 2d6 | 1d6 | 1d6 | As per the spell |
| **Crisis** | 1d6 | 1d6 | 2d6 | As per the spell |
