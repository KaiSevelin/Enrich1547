import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SOURCE_PATH = path.join(ROOT, "modules/1547core/foundry/Templates/spells.json");

const FIRST_SENTENCE_OVERRIDES = {
    "Albedo": "The whitening, the second alchemical transformation of a person, refining body and essence toward altered power.",
    "Angelic Boon": "Calls down a boon from an angel or an answering heavenly force.",
    "Astral Projection": "Lets the diviner's soul slip free of the body and travel unseen.",
    "Auspicious Prediction": "Reads whether fortune favors or opposes the matter at hand.",
    "Auspicious Timing": "Seeks the right moment for an action so that the heavens lean in its favor.",
    "Banish": "Drives a supernatural being away and breaks its immediate hold on the place or victim.",
    "Beam Sigil": "Inscribe a sign or prayer on a house beam to hinder supernatural beings from entering the house.",
    "Bind": "Binds a supernatural being into a vessel, place, or prepared confinement.",
    "Black Sleep": "Lays a target into a deathlike sleep that is hard to distinguish from true dying.",
    "Blood Border": "Draws a protective boundary in blood to hold danger at bay.",
    "Borrowed Pallor": "Sleep beside a corpse and borrow its stillness to pass unseen by spirits until dawn.",
    "Borrowed Pulse": "Steal a remnant of vigor from a newly dead corpse and carry it in your own body.",
    "Break Binding": "Releases a being from an imposed binding, fastening, or occult confinement.",
    "Break Pact": "Severs a pact and tears loose the bond that once held it in force.",
    "Break Seal": "Breaks a magical seal and opens what it was made to hold shut.",
    "Calcination": "Burns matter down toward its harsher truth through the first destructive labor of alchemy.",
    "Calm Knot": "Tie down agitation and still the heart through a tempering knot-work.",
    "Chalk Border": "Marks a temporary protective line in chalk to define a safer threshold.",
    "Citrinitas": "The yellowing, the alchemical stage of dawning illumination and spiritual ripening.",
    "Coagulation": "Compels separated matter back into denser, fixed, or newly joined form.",
    "Cold Knot": "Ties chill, weakness, and draining cold into the victim through a hostile knot.",
    "Command": "Utters a binding order meant to override hesitation and compel obedience.",
    "Conjunction": "Joins separated principles into a single working union through alchemical marriage.",
    "Consecrate Church": "Consecrates a church or holy space so it stands properly under sacred protection.",
    "Consumption Oath": "Swear an oath whose breaking feeds ruin back into the oathbreaker.",
    "Create Funeral Wax Candle": "Prepare a funerary candle meant to carry grave-linked force in later rites.",
    "Create Spirit Vessel": "Prepare a vessel fit to receive, confine, or host a spirit under rule.",
    "Curse of Withering": "Lays a wasting curse that steadily diminishes health, force, and bodily soundness.",
    "Bless Weapon": "Bless a weapon so it strikes under holy favor rather than mere steel alone.",
    "Danger Sense": "Draws a warning before immediate danger properly shows its face.",
    "Death Knots": "Tie a killing or wasting intention into a series of malignant knots.",
    "Delay": "Push a working, force, or consequence a little farther down the line of time.",
    "Disease Knot": "Tie sickness into the victim so the body begins to fail from within.",
    "Dissolution": "Loosens fixed form and breaks a thing down toward separation or loss of coherence.",
    "Distillation": "Refines a substance through repeated separation, carrying the subtle upward from the gross.",
    "Divine Guidance": "Seek a moment of guiding grace from a higher holy source.",
    "Dread": "Lay spiritual fear on the target until courage buckles into dread.",
    "Dream Interpretation": "Draw meaning out of a dream and judge what sign or truth it carried.",
    "Dream Warding": "Set a protection over sleep so hostile dreams or night visitations find poorer footing.",
    "Empty Mirror": "Use a prepared mirror to catch, redirect, or hollow out what should have been reflected.",
    "Enchant Object": "Imbue an object with prepared magical force so it carries more than its common use.",
    "Exorcism": "Drive out an occupying or attached supernatural force through forceful holy rejection.",
    "Faith Manipulation": "Twist, burden, or redirect the target's faith through supernatural pressure.",
    "Favor Knot": "Tie a knot that bends another's favor, sympathy, or goodwill toward you.",
    "Fermentation": "Carries matter through the alchemical stage of inward living change and dangerous ripening.",
    "Find the Culprit": "Use divinatory means to identify the guilty party behind a hidden wrong.",
    "Find What Is Lost": "Seek the place or trail of something hidden, missing, or carried away.",
    "Glamour": "Lay a glamour over appearance, perception, or first understanding.",
    "Golem": "Fashion or awaken an artificial servant body fit for imposed purpose.",
    "Grave Dreaming": "Sleep near the grave so the dead or the earth of burial may answer in dreams.",
    "Grave Soil and Salt Border": "Lay a protective border of grave soil and salt to mark a place the dead or uncanny should hesitate to cross.",
    "Heart Twine": "Twine the target's heart toward attachment, longing, or yielding affection.",
    "Homunculus": "Prepare and bring forth an artificial lesser being through alchemical and occult craft.",
    "Humoral Rebalancing": "Correct a body's dangerous imbalance by restoring its humors toward better order.",
    "Ill Luck Knot": "Tie misfortune into the victim so accidents and failures gather around them.",
    "Ill Turning Loop": "Loop a hostile turn back on itself so harm doubles or circles the wrong way.",
    "Invoke Pact": "Call on the living force of an existing pact so its promise answers now.",
    "Iron Seal": "Set an iron-bound seal against intrusion, escape, or spirit passage.",
    "Limbsnare": "Catch the target's limbs in a magical snare that hinders motion and control.",
    "Lovebinding": "Bind another person in love, fixation, or compelled attachment.",
    "Memory Tangle": "Snarl memory so recollection becomes confused, delayed, or unreliable.",
    "Metallic Transposition": "Shift the nature or place of metals through alchemical substitution.",
    "Name the Unnamed": "Force a hidden being or presence into a name that can be spoken and used.",
    "Nigredo": "The blackening, the first alchemical descent into corruption, undoing, and necessary ruin.",
    "Night Riding": "Ride the sleeper through the night and oppress them with unseen presence.",
    "Oath Knot": "Tie an oath into a knot so promise and consequence stay fast together.",
    "Oath of Three Witnesses": "Fix an oath under the authority of three witnessing presences or persons.",
    "Object Memory": "Draw out what an object remembers of what has been done with it or near it.",
    "Possess": "Enter and seize a host body through direct supernatural occupation.",
    "Planetary Invocation": "Invoke a planet's influence and draw its force into the working.",
    "Prophecy": "Speak or receive a prophecy that reaches beyond ordinary knowing.",
    "Prospect Reading": "Read a prospect for what it is likely to yield, conceal, or become.",
    "Protection Rhyme": "Speak a protective rhyme to strengthen the bearer against common harm or uncanny trouble.",
    "Protective Border": "Lay a protective border that marks where hostile force should not pass freely.",
    "Protective Circle": "Set a ritual circle as a defensive boundary against intrusion and corruption.",
    "Prayer Against the Evil Eye": "Pray against the evil eye and lift or resist its wasting influence.",
    "Reading": "Read signs, patterns, or tokens for hidden meaning beyond common judgment.",
    "Refusal Rite": "Perform a rite of refusal to deny entry, claim, or forced supernatural attachment.",
    "Rewrite the Past": "Alter how the past is remembered, read, or made to stand in the present.",
    "Rubedo": "The reddening, the culminating alchemical transformation of completion, force, and perfected change.",
    "Sanctify": "Sanctify a person, object, or place so it stands under holy claim.",
    "Scrying": "Seek distant sight through a prepared medium and the narrowing of attention.",
    "Seal": "Set a seal that closes, forbids, preserves, or holds something under rule.",
    "Separation": "Separate what was mixed together so hidden distinctions stand apart again.",
    "Shadow Attachment": "Fasten a clinging shadow or unseen follower onto the target.",
    "Shapeshifting": "Change bodily form and wear another shape through dangerous transformation.",
    "Simulacrum": "Make a crafted likeness that imitates a living form or person.",
    "Speak with the Dead": "Draw answers from a dead person or their lingering remains.",
    "Spirit Sight": "Open the senses to spirits, traces, and presences not plainly visible.",
    "Still Tongue": "Still the tongue so the dead or living find speech difficult or impossible.",
    "Summon Being": "Call a being by true name or prepared rite into your presence.",
    "Tongue Tying Knot": "Tie the tongue against confession, accusation, or dangerous speech.",
    "Transform Self": "Change your own body to gain other strengths, forms, or capacities.",
    "Threshold Awareness": "Sense protective wards, charged thresholds, and defended boundaries nearby.",
    "Truth Pressure": "Lay pressure on the tongue and conscience so falsehood becomes harder to carry.",
    "Uncertain Knot": "Tie doubt and wavering into the victim until resolve loosens.",
    "Wax Seal": "Set a wax seal that both closes and spiritually marks what lies beneath it.",
    "Wind Knot": "Tie the wind into knots so it may later be loosed for sailing or weather-work.",
    "Witch's Ladder": "Braid a witch's ladder to carry bound intention through knots, feathers, and fixed sequence.",
    "Withering Knot": "Tie a wasting force into the victim so health declines by slow degrees.",
    "Zone Travel": "Pass through the zone by occult transit rather than ordinary movement."
};

const KIND_SENTENCES = {
    Alchemy: [
        "It belongs to the labor of alchemy, where matter, body, and hidden principle are forced through deliberate transformation.",
        "It works through alchemical operations, using prepared matter and disciplined change rather than prayer or folk habit.",
        "It is an alchemical working, concerned with refinement, corruption, union, or remaking through controlled process."
    ],
    Curse: [
        "It is worked to burden a victim with wasting, fear, misfortune, or other hostile pressure that lingers after the moment of casting.",
        "It belongs to malignant workings meant to afflict, weaken, or trouble the victim rather than merely frighten them.",
        "It is a harmful working, laying decline, disturbance, or coercive spiritual force upon the target."
    ],
    Divination: [
        "It is used to draw out hidden truth, read signs, or reach knowledge that will not yield itself to ordinary sense alone.",
        "It belongs to divinatory practice, where questions are put to signs, distance, dream, or omen rather than answered by direct witness.",
        "It is a seeking working, used when truth must be drawn from sign, distance, memory, or hidden correspondence."
    ],
    Grimoire: [
        "It depends on learned occult instruction, seals, names, or written operations rather than common household charm-lore.",
        "It belongs to grimoire practice, relying on formal instruction, written formulae, and dangerous exactness.",
        "It is a learned occult working, shaped more by text, sign, and named authority than by inherited folk custom."
    ],
    Knot: [
        "It is worked through cords, bindings, and held tension, as is common in knot magic.",
        "It belongs to knot-work, where intent is fastened into loops, crossings, and things bound tight by hand.",
        "It is a knot-working, carrying its force through tied form, repeated turns, and what is made to hold."
    ],
    Necromancy: [
        "It belongs to the dangerous traffic of corpse, grave, spirit, and restless dead.",
        "It works at the edge of death, drawing on corpse, burial, remnant life, or the unsettled dead.",
        "It is a necromantic working, leaning on grave-power, lingering presence, and the perilous nearness of the dead."
    ],
    Oath: [
        "It deals with sworn bonds, compulsions, witnessed promises, and the supernatural force that clings to pledged words.",
        "It belongs to oath-work, where spoken vows are fixed hard enough to reward, punish, or bind.",
        "It is an oath-bound working, concerned with promise, witness, obligation, and the cost of breaking what has been sworn."
    ],
    Protection: [
        "It is chiefly used to secure a boundary, person, object, or place against intrusion, corruption, or hostile influence.",
        "It belongs to protective working, setting limits, cleansing entry, or strengthening what must hold against danger.",
        "It is a warding or defensive working, meant to deny entry, blunt corruption, or preserve what lies within the protection."
    ]
};

const STRENGTH_SENTENCES = {
    1: [
        "Among ritual workings it is considered slight, though even slight magic can miscarry.",
        "It is counted a lighter working, but light magic still has teeth when it slips or turns.",
        "It is a lesser working, often attempted more readily, though failure can still leave an ugly mark."
    ],
    2: [
        "It is a serious working that usually demands care, preparation, and a practiced hand.",
        "It sits in the middle range of dangerous practice, demanding steadiness, preparation, and someone who knows what they are doing.",
        "It is no trivial charm, but a working that rewards preparation and punishes carelessness."
    ],
    3: [
        "It is a potent working whose success can alter lives, bodies, bindings, or spiritual conditions in lasting ways.",
        "It is a forceful working, one that can leave lasting changes in body, bond, place, or spirit when it takes hold.",
        "It is among the weightier workings, capable of changing more than the moment if it succeeds cleanly."
    ]
};

function hashString(value) {
    let hash = 0;
    for (const ch of String(value ?? "")) {
        hash = ((hash * 31) + ch.charCodeAt(0)) >>> 0;
    }
    return hash;
}

function pickVariant(list, key) {
    if (!Array.isArray(list) || list.length === 0) return "";
    return list[hashString(key) % list.length];
}

function normalizeFirstSentence(description) {
    const first = String(description ?? "").split(".")[0].trim();
    if (!first) return "";
    return first.endsWith(".") ? first : `${first}.`;
}

function buildDescription(spell) {
    const name = String(spell?.name ?? "").trim();
    const kind = String(spell?.spellKind ?? "").trim();
    const strength = Number(spell?.strength ?? 2);
    const first = FIRST_SENTENCE_OVERRIDES[name] ?? normalizeFirstSentence(spell?.description);
    const second = pickVariant(KIND_SENTENCES[kind] ?? KIND_SENTENCES.Protection, `${name}:kind`);
    const third = pickVariant(STRENGTH_SENTENCES[strength] ?? STRENGTH_SENTENCES[2], `${name}:strength`);
    return [first, second, third].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function main() {
    let text = fs.readFileSync(SOURCE_PATH, "utf8");
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const spells = JSON.parse(text);
    const updated = spells.map((spell) => ({
        ...spell,
        description: buildDescription(spell)
    }));
    if (process.argv.includes("--stdout")) {
        process.stdout.write(`${JSON.stringify(updated, null, 4)}\n`);
        return;
    }
    fs.writeFileSync(SOURCE_PATH, `${JSON.stringify(updated, null, 4)}\n`, "utf8");
    console.log(`Updated ${updated.length} spell descriptions.`);
}

main();
