export function parseDiceTerm(term) {
    const normalized = String(term ?? "").replace(/\s+/g, "");
    const match = normalized.match(/^(\d*)d([a-z0-9]+)(.*)$/i);
    if (!match) return null;

    const count = match[1] === "" ? 1 : Number(match[1]);
    const faces = match[2];
    const rest = match[3] ?? "";

    if (!Number.isFinite(count) || count < 0 || !faces) return null;

    return { n: count, faces, rest };
}

export function formatDiceTerm({ n, faces, rest }) {
    return `${String(n)}d${faces}${rest ?? ""}`;
}

export function buildCombinedFormula(terms) {
    return terms.map((term) => `(${term})`).join(" + ");
}
