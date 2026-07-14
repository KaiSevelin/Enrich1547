const MANUAL_SPELL_NAMES = new Set([
    "Angelic Boon",
    "Auspicious Timing",
    "Banish",
    "Bind",
    "Black Sleep",
    "Command",
    "Curse of Withering",
    "Death Knots",
    "Exorcism",
    "Faith Manipulation",
    "Humoral Rebalancing",
    "Limbsnare",
    "Night Riding",
    "Nigredo",
    "Possess",
    "Refusal Rite",
    "Witch's Ladder",
]);

export function normalizeSpellName(name) {
    return String(name ?? "").trim();
}

export function isManualSpellName(name) {
    return MANUAL_SPELL_NAMES.has(normalizeSpellName(name));
}

export function isManualSpellItem(item) {
    return isManualSpellName(item?.name);
}

export function getManualSpellNames() {
    return Array.from(MANUAL_SPELL_NAMES);
}
