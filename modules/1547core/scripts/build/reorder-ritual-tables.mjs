// One-shot tool: turn each ritual step table into an Xd6 "big pool" roll.
// Entries are tent-ordered by rarity (common/mundane steps at the curve's
// centre, rare/exotic steps at the tails) and each is assigned a contiguous
// range of dice totals: heavy central totals become narrow 1-number bands,
// light tail totals are lumped into wide bands so every step stays reachable.
// The per-entry `pickRange` + table `pickFormula` are the single source of
// truth shared by build-packs (compiled RollTable) and ritual generation.
// Run with --write to persist; otherwise prints a dry-run report.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, "..", "..", "foundry", "Templates", "ritual-step-roll-tables.json");

// Dice pool per table id. ~12 d6 for the big table, fewer for smaller ones —
// enough totals (5X+1) to cover every entry with room to widen the tails.
const DICE = { RitualSteps_Easy: 13, RitualSteps_Medium: 9, RitualSteps_Hard: 7 };

// --- rarity scoring (lower = more common/mundane = nearer the centre) -------
const TYPE_SCORE = {
    Craft: 12, Material: 18, Writing: 18, Performance: 18, Purification: 16, Purity: 20,
    Environment: 26, DivinatoryFocus: 34, HerbalPreparation: 30, BoundaryWork: 30,
    AlchemicalOperation: 42, ComplexPerformance: 46, Resistance: 46, ExactTiming: 50,
    CeremonialDiagram: 55, LongVigil: 64, Isolation: 70, Assistance: 70, Defense: 70,
    TrueName: 82, RareMaterial: 85, CorpseWork: 85, OathBurden: 92
};
const KEYWORD_ADJ = [
    [/(blood|spittle|sweat|tooth|bone|corpse|nail clipping)/i, 26],
    [/(eclipse|solstice|equinox|conjunction)/i, 22],
    [/(true name|rare relic|oath|binding vow|verified true name)/i, 24],
    [/(graveyard|churchyard|barrow|gallows|gibbet|battlefield|cave|bog|marsh)/i, 10],
    [/(red thread|wax|dried herbs|river clay|river stone|silver coin|clean water|piece of wood|scrap of cloth|sheet of paper)/i, -6]
];
function rarityScore(entry) {
    let score = TYPE_SCORE[entry.stepType] ?? 40;
    const hay = `${entry.stepText} ${entry.requiredItem} ${entry.skillCheck}`;
    for (const [re, adj] of KEYWORD_ADJ) if (re.test(hay)) score += adj;
    return score;
}

// ways to roll each total with `x` d6 → array indexed by (total - x).
function d6Probs(x) {
    let dist = [1];
    for (let d = 0; d < x; d += 1) {
        const next = new Array(dist.length + 5).fill(0);
        for (let s = 0; s < dist.length; s += 1)
            for (let face = 1; face <= 6; face += 1) next[s + face - 1] += dist[s];
        dist = next;
    }
    const total = 6 ** x;
    return dist.map((w) => w / total); // index 0 -> total x, ... index 5x -> total 6x
}

// Tent arrangement: rank 0 (most common) nearest centre, rarest at both ends.
function tentArrange(ranked) {
    const n = ranked.length;
    const centre = (n - 1) / 2;
    const positions = [...Array(n).keys()].sort((a, b) => {
        const da = Math.abs(a - centre), db = Math.abs(b - centre);
        return da !== db ? da - db : a - b;
    });
    const arr = new Array(n);
    for (let k = 0; k < n; k += 1) arr[positions[k]] = ranked[k];
    return arr;
}

// Symmetric anchoring: give every entry one central total, then fold the
// extreme (near-zero) tail totals into the two end entries. Guarantees each
// entry is reachable (>=1 total) and the curve is symmetric — but a d6 sum is
// steeply peaked, so the outer entries are inherently rare. Returns [lo,hi].
function partition(probs, n) {
    const T = probs.length;
    const dropEach = Math.floor((T - n) / 2);
    const groups = [];
    for (let i = 0; i < n; i += 1) {
        let lo = dropEach + i;
        let hi = dropEach + i;
        if (i === 0) lo = 0;
        if (i === n - 1) hi = T - 1;
        groups.push([lo, hi]);
    }
    return groups;
}

const tables = JSON.parse(fs.readFileSync(FILE, "utf8"));
for (const table of tables) {
    const n = table.entries.length;
    const x = DICE[table.id] ?? Math.max(2, Math.ceil((n - 1) / 5) + 2);
    const probs = d6Probs(x);

    delete table.pickWeight;
    for (const e of table.entries) { delete e.pickWeight; delete e.pickRange; }

    const ranked = [...table.entries].map((e, i) => ({ e, i, s: rarityScore(e) }))
        .sort((a, b) => (a.s - b.s) || (a.i - b.i)).map((o) => o.e);
    const arranged = tentArrange(ranked);
    const groups = partition(probs, n);

    let minP = Infinity, maxP = -Infinity, minTxt = "", maxTxt = "";
    arranged.forEach((entry, i) => {
        const [lo, hi] = groups[i];
        entry.pickRange = [x + lo, x + hi]; // totals are x..6x
        let p = 0;
        for (let s = lo; s <= hi; s += 1) p += probs[s];
        if (p < minP) { minP = p; minTxt = entry.stepText; }
        if (p > maxP) { maxP = p; maxTxt = entry.stepText; }
    });

    table.pickFormula = `${x}d6`;
    table.entries = arranged;

    const centreIdx = Math.round((n - 1) / 2);
    console.log(`\n=== ${table.name}  (N=${n}, pick=${x}d6, totals ${x}..${6 * x}) ===`);
    console.log(`  centre  #${centreIdx} [${arranged[centreIdx].pickRange.join("-")}]  ${arranged[centreIdx].stepText.slice(0, 44)}`);
    console.log(`  L-tail  #0  [${arranged[0].pickRange.join("-")}]  ${arranged[0].stepText.slice(0, 44)}`);
    console.log(`  R-tail  #${n - 1} [${arranged[n - 1].pickRange.join("-")}]  ${arranged[n - 1].stepText.slice(0, 44)}`);
    console.log(`  most likely: ${(maxP * 100).toFixed(2)}%  (${maxTxt.slice(0, 40)})`);
    console.log(`  least likely: ${(minP * 100).toFixed(2)}%  (${minTxt.slice(0, 40)})`);
    console.log(`  spread: ${(maxP / minP).toFixed(1)}x   (uniform would be ${(100 / n).toFixed(2)}%/entry)`);
}

if (process.argv.includes("--write")) {
    fs.writeFileSync(FILE, JSON.stringify(tables, null, 2) + "\n");
    console.log("\nWROTE", FILE);
} else {
    console.log("\n(dry run — pass --write to persist)");
}
