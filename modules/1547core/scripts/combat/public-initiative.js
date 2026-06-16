/* ------------------------------------------------------------------ */
/*  Public initiative rolls                                            */
/*                                                                     */
/*  Foundry rolls initiative with the roller's chat roll-mode, so a    */
/*  GM with "Private GM Roll" hides initiative from players. Wrap       */
/*  Combat#rollInitiative to force the roll public so both the GM and   */
/*  the players see it.                                                 */
/* ------------------------------------------------------------------ */

let patched = false;

export function registerPublicInitiative() {
    if (patched) return;
    const proto = globalThis.CONFIG?.Combat?.documentClass?.prototype;
    if (typeof proto?.rollInitiative !== "function") return;
    patched = true;
    const original = proto.rollInitiative;
    proto.rollInitiative = function (ids, options = {}) {
        const publicMode = globalThis.CONST?.DICE_ROLL_MODES?.PUBLIC ?? "publicroll";
        const messageOptions = { ...(options?.messageOptions ?? {}), rollMode: publicMode };
        return original.call(this, ids, { ...options, messageOptions });
    };
}
