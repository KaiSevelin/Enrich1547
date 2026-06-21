/**
 * Authored descriptions for the four humours, used by the info tooltips/enricher
 * (@humour[Blood], @info[humour:Phlegm], etc.). Names are normalised so any of
 * the spellings used across the system resolve — "Yellow Bile", "YellowBile",
 * "yellow bile", "yellow-bile", or the "Humour_YellowBile" flag.
 */
export const HUMOUR_INFO = {
    Blood: "The sanguine humour — warm and moist, of air and spring. It makes for a sociable, hopeful, courageous, appetite-driven nature; in excess, impulsive, indulgent, and easily swept along by passion.",
    "Yellow Bile": "The choleric humour — hot and dry, of fire and summer. It drives ambition, boldness, and quick decisive action; in excess, wrathful, impatient, domineering, and slow to forgive.",
    "Black Bile": "The melancholic humour — cold and dry, of earth and autumn. It inclines toward thought, caution, and depth of feeling; in excess, sorrowful, brooding, withdrawn, and prone to obsession.",
    Phlegm: "The phlegmatic humour — cold and moist, of water and winter. It lends calm, patience, endurance, and steadiness; in excess, sluggish, apathetic, and hard to rouse to action."
};

const HUMOUR_CANON = {
    blood: "Blood",
    yellowbile: "Yellow Bile",
    "yellow-bile": "Yellow Bile",
    blackbile: "Black Bile",
    "black-bile": "Black Bile",
    phlegm: "Phlegm"
};

/** Canonical humour name from any spelling/flag, or "" if unknown. */
export function canonicalHumour(name) {
    const raw = String(name ?? "").trim().toLowerCase().replace(/^humour[\s_-]*/, "");
    const slug = raw.replace(/[^a-z]+/g, "-").replace(/(^-|-$)/g, "");
    return HUMOUR_CANON[slug] ?? HUMOUR_CANON[slug.replace(/-/g, "")] ?? "";
}

/** Description for a humour by any spelling, or "" if unknown. */
export function getHumourDescription(name) {
    const canon = canonicalHumour(name);
    return canon ? HUMOUR_INFO[canon] : "";
}

/** Tooltip text for a humour: "Yellow Bile — <description>" (or "" if unknown). */
export function getHumourTooltip(name) {
    const canon = canonicalHumour(name);
    if (!canon) return "";
    return `${canon} — ${HUMOUR_INFO[canon]}`;
}
