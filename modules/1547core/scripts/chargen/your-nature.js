// Pure logic + constants for the "Your Nature" chargen phase, extracted from
// chargen.js so the qualification, stage-eligibility, and selector-bucket rules
// are isolated and unit-testable with literal fixtures (no Foundry globals).
//
// See docs/specs/chargen-spec-v1.md (Part 3 - Your Nature). The live wiring
// (rolling tables, building reveals) stays on SkillTreeChargenApp, which
// delegates the decisions below to keep behaviour identical.

import { PRIMARY_STATS, statSteps } from "../../foundry/Templates/chargen/foundry-primary-stats/stats.js";

/** Destination-table refs keyed by selector domain. IDs are kept on import. */
export const YOUR_NATURE_TABLE_REFS = {
    Strength: "RollTable.RollTablYnStrg00",
    Dexterity: "RollTable.RollTablYnDext00",
    Stamina: "RollTable.RollTablYnStam00",
    Intelligence: "RollTable.RollTablYnIntl00",
    Faith: "RollTable.RollTablYnFath00",
    Charisma: "RollTable.RollTablYnChar00",
    Power: "RollTable.RollTablYnPowr00",
    "Yellow bile": "RollTable.RollTablYnYBil00",
    "Black bile": "RollTable.RollTablYnBBil00",
    Blood: "RollTable.RollTablYnBloo00",
    Phlegm: "RollTable.RollTablYnPhlg00"
};

/** The balanced 3d6 selector table that chooses among the destinations. */
export const YOUR_NATURE_SELECTOR_TABLE_REF = "RollTable.RollTablYnNatr00";

/** Selector keys, in the fixed order used by the computed fallback bucketing. */
export const YOUR_NATURE_SELECTOR_KEYS = [
    "Strength",
    "Dexterity",
    "Stamina",
    "Intelligence",
    "Faith",
    "Charisma",
    "Power",
    "Yellow bile",
    "Black bile",
    "Blood",
    "Phlegm"
];

/** Humour selector keys mapped to the actor prop that proves the humour. */
export const YOUR_NATURE_HUMOUR_PROPS = {
    Blood: "Humour_Blood",
    "Yellow bile": "Humour_YellowBile",
    "Black bile": "Humour_BlackBile",
    Phlegm: "Humour_Phlegm"
};

/** Bio stages during which a Your Nature draw may fire (adolescence → retirement). */
export const YOUR_NATURE_ELIGIBLE_STAGES = ["adolescence", "career", "advanced"];

/**
 * Minimum stat value (in steps; see statSteps) to qualify for a stat table.
 * 2 == "1d6+2 or better". Lowered from 4 ("2d6") so modest aptitudes can still
 * surface a Your Nature mark.
 */
export const YOUR_NATURE_STAT_MIN_STEPS = 2;

/**
 * Whether a 1d6 trigger result makes a Your Nature draw. Spec: 5 or 6 triggers.
 */
export function shouldTriggerYourNature(triggerTotal) {
    return Number(triggerTotal) >= 5;
}

/**
 * Whether the given bio stage is inside the Your Nature window. Birth and
 * childhood are excluded; it runs adolescence through retirement ("advanced").
 */
export function isYourNatureEligibleStage(stage) {
    return YOUR_NATURE_ELIGIBLE_STAGES.includes(String(stage ?? "").trim());
}

/**
 * Whether the actor qualifies for a selected Your Nature domain, given its
 * props map. Stat domains need at least 2d6 in the stat; humour domains need
 * the corresponding Humour_* flag. Unknown keys never qualify.
 */
export function hasYourNatureRequirement(props, key) {
    const domain = String(key ?? "").trim();
    if (!domain) return false;

    if (PRIMARY_STATS.includes(domain)) {
        const dice = Number(props?.[`Stats_${domain}Dice`] ?? 1);
        const mod = Number(props?.[`Stats_${domain}Mod`] ?? 0);
        if (!Number.isFinite(dice) || !Number.isFinite(mod)) return false;
        return statSteps(dice, mod) >= YOUR_NATURE_STAT_MIN_STEPS;
    }

    const humourProp = YOUR_NATURE_HUMOUR_PROPS[domain];
    if (!humourProp) return false;
    return Boolean(props?.[humourProp]);
}

/** Clamp a raw die face to 1..6, treating non-numeric/zero as 1. */
function clampDie(value) {
    return Math.max(1, Math.min(6, Number(value) || 1));
}

/**
 * Computed-fallback mapping from three d6 faces to a selector key, used only
 * when the authored selector table is unavailable. Maps the 216 ordered
 * combinations uniformly across the 11 destination keys.
 */
export function yourNatureSelectorBucket(dice) {
    const d = Array.isArray(dice) ? dice : [];
    const safe = [clampDie(d[0]), clampDie(d[1]), clampDie(d[2])];
    const combinationIndex = ((safe[0] - 1) * 36) + ((safe[1] - 1) * 6) + (safe[2] - 1);
    const bucketIndex = Math.min(
        YOUR_NATURE_SELECTOR_KEYS.length - 1,
        Math.floor((combinationIndex * YOUR_NATURE_SELECTOR_KEYS.length) / 216)
    );
    return { key: YOUR_NATURE_SELECTOR_KEYS[bucketIndex], dice: safe };
}
