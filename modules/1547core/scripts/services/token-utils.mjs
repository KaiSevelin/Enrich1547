// Shared token-resolution helpers used by the spell-casting and usage-effect
// services. Runtime-only (reads `canvas`), but import-safe — `canvas` is only
// touched inside the functions.

/** Coerce a Token placeable or TokenDocument to its TokenDocument, else null. */
export function normalizeTokenDocument(tokenLike) {
    if (!tokenLike) return null;
    if (tokenLike.documentName === "Token") return tokenLike;
    if (tokenLike.document?.documentName === "Token") return tokenLike.document;
    return null;
}

/** The actor's controlled token if any, else its first active token. */
export function getDefaultSourceTokenForActor(actor) {
    if (!actor) return null;
    const controlled = (canvas?.tokens?.controlled ?? []).find((token) => token?.actor?.id === actor.id);
    if (controlled?.document) return controlled.document;
    const active = actor.getActiveTokens?.(true, true)?.[0] ?? actor.getActiveTokens?.()[0] ?? null;
    return normalizeTokenDocument(active);
}
