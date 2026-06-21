/**
 * Authored descriptions for the seven primary stats, used for the HUD stat
 * hover tooltips. Each stat is rolled as Xd6 + modifier; the text explains what
 * the stat governs so a player can read it at a glance.
 */
export const STAT_INFO = {
    Strength: "Raw physical power — lifting, hauling, breaking, and the force behind a blow. Governs heavy weapons, grappling, and feats of might. Also helps carry weight and bolsters hit points.",
    Stamina: "Endurance and toughness — resisting fatigue, pain, hunger, weather, poison, and disease. The body's staying power, and a main source of hit points.",
    Dexterity: "Speed, balance, and precision — nimble footwork and steady hands. Governs quick or finesse weapons, dodging, stealth, sleight of hand, and delicate work.",
    Intelligence: "Reason, memory, and keen perception — learning, planning, and noticing what others miss. Governs knowledge, tactics, craft, and many trained skills.",
    Faith: "Conviction and spiritual resolve — your bond with the divine or the unseen. Governs prayer and sacred power, and steadies you against fear, despair, and corruption.",
    Charisma: "Presence and force of personality — charm, command, and nerve. Governs persuasion, leadership, performance, intimidation, and deception.",
    Power: "Raw arcane potential — the capacity to touch forces beyond the natural. Governs magic and supernatural effects; the uncanny answers those who carry it."
};

/**
 * Tooltip text for a stat row: the authored description, with the current roll
 * formula appended when available.
 */
export function getStatTooltip(label, formula = "") {
    const name = String(label ?? "").trim();
    const desc = STAT_INFO[name] ?? "";
    const roll = String(formula ?? "").trim();
    const head = roll ? `${name} (${roll})` : name;
    return desc ? `${head} — ${desc}` : head;
}
