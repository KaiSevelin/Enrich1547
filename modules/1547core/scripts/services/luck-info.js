/**
 * Authored description for the Lucky Streak, used by the info tooltips/enricher
 * (@luck[Lucky streak], @luck[on]). A lucky streak is a spell of good fortune
 * during chargen: while it holds, a turn of fortune is rolled in your favour.
 */
export const LUCK_INFO =
    "A spell of good fortune. While a lucky streak holds, fate leans your way — a chance meeting, a narrow escape, an unlooked-for gift — and a turn of fortune is rolled for you. Once spent, the streak fades.";

/** Tooltip for a lucky streak; reflects on/off when given a state. */
export function getLuckTooltip(state) {
    const s = String(state ?? "").trim().toLowerCase();
    if (s === "on" || s === "true" || s === "1") return `Lucky streak (on) — ${LUCK_INFO}`;
    if (s === "off" || s === "false" || s === "0") return `Lucky streak (off) — the run of good fortune has run its course. ${LUCK_INFO}`;
    return `Lucky streak — ${LUCK_INFO}`;
}
