/**
 * Authored description for Social Status, used by the info tooltips/enricher
 * (@social[Social Status], @social[1], @info[social:-2]). Social Status is a
 * single -2..+2 track on the actor (Stats_SocialStatus): your standing in the
 * eyes of society.
 */
export const SOCIAL_STATUS_INFO =
    "Your standing in the eyes of society, on a scale from -2 to +2. It shapes how strangers first receive you — suspicion and closed doors at the bottom, deference and open ones at the top. Most people sit at 0.";

export const SOCIAL_STATUS_LEVELS = {
    "-2": "Despised — shunned and watched; doors close before you reach them.",
    "-1": "Suspect — distrusted, and given little benefit of the doubt.",
    "0": "Ordinary — unremarkable; neither courted nor shunned.",
    "1": "Respected — welcomed, and your word carries some weight.",
    "2": "Esteemed — sought after; doors open and deference is given."
};

/**
 * Tooltip for Social Status. With a numeric level (-2..+2) it leads with that
 * rung's meaning; otherwise it gives the general description.
 */
export function getSocialStatusTooltip(level) {
    const n = Number(level);
    if (Number.isFinite(n)) {
        const clamped = Math.max(-2, Math.min(2, Math.trunc(n)));
        const signed = clamped > 0 ? `+${clamped}` : String(clamped);
        return `Social Status ${signed}: ${SOCIAL_STATUS_LEVELS[String(clamped)]} — ${SOCIAL_STATUS_INFO}`;
    }
    return `Social Status — ${SOCIAL_STATUS_INFO}`;
}
