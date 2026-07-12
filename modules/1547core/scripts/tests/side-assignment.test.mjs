import assert from "assert";

/**
 * Tests for combat/side-assignment.mjs — the pure side-assignment and
 * side-initiative ordering logic. Locks in the rules that two+ players always
 * land on different sides (round-robin across two teams) and that the 3d6
 * side-initiative result orders the sides high-first.
 */

const {
    primaryPlayerOwner,
    dispositionSide,
    assignSides,
    orderSidesByInitiative,
} = await import("../combat/side-assignment.mjs");

// ───────────────────────────────────────────────────────── primaryPlayerOwner ──
console.log("primaryPlayerOwner...");
assert.strictEqual(primaryPlayerOwner([]), null);
assert.strictEqual(primaryPlayerOwner(null), null);
assert.strictEqual(primaryPlayerOwner(["u2", "u1"]), "u1", "lowest id, deterministic");
assert.strictEqual(primaryPlayerOwner(["", "  "]), null, "ignores blanks");
console.log("  ✓ primaryPlayerOwner picks a deterministic owner or null");

// ───────────────────────────────────────────────────────────── dispositionSide ──
console.log("dispositionSide...");
assert.strictEqual(dispositionSide(1), "team-1", "friendly");
assert.strictEqual(dispositionSide(-1), "team-2", "hostile");
assert.strictEqual(dispositionSide(0), "team-2", "neutral -> team-2 (matches legacy default)");
assert.strictEqual(dispositionSide(null), "team-2");
console.log("  ✓ dispositionSide maps friendly/hostile/neutral");

// ───────────────────────────────────────────────────────────────── assignSides ──
console.log("assignSides...");

// PvP duel: a PLAYERS-ONLY fight (no NPCs) splits the players across sides,
// regardless of disposition.
const twoPlayersDuel = assignSides([
    { id: "a", ownerUserIds: ["alice"], disposition: 1 },
    { id: "b", ownerUserIds: ["bob"], disposition: 1 },
]);
assert.strictEqual(twoPlayersDuel.get("a"), "team-1");
assert.strictEqual(twoPlayersDuel.get("b"), "team-2");
assert.notStrictEqual(twoPlayersDuel.get("a"), twoPlayersDuel.get("b"), "players-only -> opposing sides");
console.log("  ✓ players-only fight splits the players (duel/PvP)");

// Co-op: two players + any NPC -> players SHARE a side; NPCs by disposition.
const coop = assignSides([
    { id: "a", ownerUserIds: ["alice"], disposition: 0 },
    { id: "b", ownerUserIds: ["bob"], disposition: 0 },
    { id: "foe", ownerUserIds: [], disposition: -1 },   // a monster makes it a co-op fight
]);
assert.strictEqual(coop.get("a"), "team-1");
assert.strictEqual(coop.get("b"), "team-1", "players share a side once an NPC is present");
assert.strictEqual(coop.get("foe"), "team-2", "hostile NPC opposes the party");
console.log("  ✓ two players + an NPC keeps the party together (co-op default)");

// GM-owned player characters (no distinct owning user) still split in a duel:
// they're flagged isPlayer by type, and each becomes its own group.
const gmOwnedDuel = assignSides([
    { id: "p1", isPlayer: true, ownerUserIds: [] },
    { id: "p2", isPlayer: true, ownerUserIds: [] },
]);
assert.notStrictEqual(gmOwnedDuel.get("p1"), gmOwnedDuel.get("p2"), "GM-owned player characters split in a duel");
console.log("  ✓ GM-owned player characters still split (players-only)");

// GM-owned player characters + a monster -> co-op: players share a side.
const gmOwnedCoop = assignSides([
    { id: "p1", isPlayer: true, ownerUserIds: [] },
    { id: "p2", isPlayer: true, ownerUserIds: [] },
    { id: "foe", isPlayer: false, ownerUserIds: [], disposition: -1 },
]);
assert.strictEqual(gmOwnedCoop.get("p1"), "team-1");
assert.strictEqual(gmOwnedCoop.get("p2"), "team-1", "GM-owned players group together vs a monster");
assert.strictEqual(gmOwnedCoop.get("foe"), "team-2");
console.log("  ✓ GM-owned player characters group together vs an NPC (co-op)");

// Exactly TWO combatants = a duel regardless of who they are (ruling
// 2026-07-12): always split, player/friendly side first.
const onePlayerPair = assignSides([
    { id: "a", ownerUserIds: ["alice"], disposition: 1 },
    { id: "n", ownerUserIds: [], disposition: -1 },
]);
assert.strictEqual(onePlayerPair.get("a"), "team-1", "player takes team-1 in a pair");
assert.strictEqual(onePlayerPair.get("n"), "team-2", "the lone opponent takes team-2");

// Two NPCs (even both friendly) split too — two tokens selected for battle
// default to opposing teams.
const npcPair = assignSides([
    { id: "n1", ownerUserIds: [], disposition: 1 },
    { id: "n2", ownerUserIds: [], disposition: 1 },
]);
assert.strictEqual(npcPair.get("n1"), "team-1");
assert.strictEqual(npcPair.get("n2"), "team-2", "an NPC pair still splits into a duel");

// NPC-first ordering: the friendlier disposition still claims team-1.
const hostileFirstPair = assignSides([
    { id: "h", ownerUserIds: [], disposition: -1 },
    { id: "f", ownerUserIds: [], disposition: 1 },
]);
assert.strictEqual(hostileFirstPair.get("f"), "team-1", "friendly claims team-1 even when listed second");
assert.strictEqual(hostileFirstPair.get("h"), "team-2");

// The exception: BOTH combatants belong to the same player — never split a
// player's own tokens (empty map = leave defaults).
const sameOwnerPair = assignSides([
    { id: "a1", ownerUserIds: ["alice"] },
    { id: "a2", ownerUserIds: ["alice"] },
]);
assert.strictEqual(sameOwnerPair.size, 0, "one player's own pair is never split");
console.log("  ✓ two-combatant battles split into opposing teams (same-owner pair excepted)");

// Three players, PLAYERS-ONLY -> round-robin across exactly two teams (A->1, B->2, C->1).
const threePlayers = assignSides([
    { id: "a", ownerUserIds: ["alice"] },
    { id: "b", ownerUserIds: ["bob"] },
    { id: "c", ownerUserIds: ["carol"] },
]);
assert.deepStrictEqual(
    [threePlayers.get("a"), threePlayers.get("b"), threePlayers.get("c")],
    ["team-1", "team-2", "team-1"],
    "round-robin across two teams"
);
console.log("  ✓ 3+ players (players-only) alternate across the two teams");

// Co-op with NPCs: all of every player's tokens land on the party side; NPCs by disposition.
const partyWithNpcs = assignSides([
    { id: "a1", ownerUserIds: ["alice"] },
    { id: "b1", ownerUserIds: ["bob"] },
    { id: "a2", ownerUserIds: ["alice"] },              // alice's 2nd token
    { id: "ally", ownerUserIds: [], disposition: 1 },   // friendly NPC
    { id: "foe", ownerUserIds: [], disposition: -1 },   // hostile NPC
]);
assert.strictEqual(partyWithNpcs.get("a1"), "team-1");
assert.strictEqual(partyWithNpcs.get("a2"), "team-1");
assert.strictEqual(partyWithNpcs.get("b1"), "team-1", "all players share the party side in a co-op fight");
assert.strictEqual(partyWithNpcs.get("ally"), "team-1", "friendly NPC joins the party");
assert.strictEqual(partyWithNpcs.get("foe"), "team-2", "hostile NPC opposes the party");
console.log("  ✓ co-op party stays together; NPCs fall back to disposition");

// ───────────────────────────────────────────────────── orderSidesByInitiative ──
console.log("orderSidesByInitiative...");
assert.deepStrictEqual(
    orderSidesByInitiative(["team-1", "team-2"], new Map([["team-1", 9], ["team-2", 14]])),
    ["team-2", "team-1"],
    "higher 3d6 total goes first (and can reorder the defaults)"
);
assert.deepStrictEqual(
    orderSidesByInitiative(["team-1", "team-2", "team-3"], { "team-1": 10, "team-2": 10, "team-3": 18 }),
    ["team-3", "team-1", "team-2"],
    "ties keep incoming order; accepts a plain object"
);
assert.deepStrictEqual(
    orderSidesByInitiative(["team-1", "team-2"], new Map()),
    ["team-1", "team-2"],
    "no rolls -> stable original order"
);
console.log("  ✓ orderSidesByInitiative sorts high-first with stable ties");

console.log("side-assignment: all assertions passed");
