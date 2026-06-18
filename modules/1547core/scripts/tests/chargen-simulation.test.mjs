import assert from "assert";

/**
 * Behavioural test for the pure simulation analytics extracted from chargen.js
 * into chargen-simulation.js (_summarizeSimulationOutcomes aggregation +
 * _defaultSimulationIdentity). The app-coupled orchestrators stay on the class.
 */

const S = await import("../chargen/chargen-simulation.js");

console.log("chargen-simulation: _defaultSimulationIdentity...");
{
    assert.deepStrictEqual(S._defaultSimulationIdentity(0),
        { name: "Simulated Character 1", nativeLanguage: "Common Tongue" });
    assert.strictEqual(S._defaultSimulationIdentity(4).name, "Simulated Character 5");
    console.log("  ✓ default identity name is 1-based");
}

console.log("\nchargen-simulation: _summarizeSimulationOutcomes...");
{
    const empty = S._summarizeSimulationOutcomes([]);
    assert.strictEqual(empty.totalRuns, 0);
    assert.strictEqual(empty.driveRate, 0);
    assert.strictEqual(empty.avgDrives, 0);
    assert.deepStrictEqual(empty.topDriveCategories, []);

    const outcomes = [
        { driveCount: 2, careerCardsSeen: 3, terminalCareerChoiceTitle: "Knight",
          driveCategories: ["Greed", "Honor"], careerEndedPrematurely: false,
          effectRolls: [{ choiceTitle: "C", tableIndex: 1, rowIndex: 0, type: "stat", targetKey: "Faith" }] },
        { driveCount: 1, careerCardsSeen: 0, terminalCareerChoiceTitle: "Knight",
          driveCategories: ["Greed"], careerEndedPrematurely: true, effectRolls: [] },
        { driveCount: 0, careerCardsSeen: 2, terminalCareerChoiceTitle: "",
          driveCategories: [], careerEndedPrematurely: false, effectRolls: [] },
    ];
    const sum = S._summarizeSimulationOutcomes(outcomes);
    assert.strictEqual(sum.totalRuns, 3);
    assert.strictEqual(sum.withDrive, 2, "driveCount >= 1");
    assert.strictEqual(sum.withTwoDrives, 1, "driveCount >= 2");
    assert.strictEqual(sum.withCareer, 2, "careerCardsSeen >= 1");
    assert.strictEqual(sum.careerEndedPrematurely, 1);
    assert.strictEqual(Number(sum.avgDrives.toFixed(4)), Number((3 / 3).toFixed(4)));
    assert.strictEqual(sum.driveRate, 2 / 3);
    assert.strictEqual(sum.prematureCareerEndRate, 1 / 2, "premature / withCareer");
    // "Knight" appears twice → top terminal card
    assert.deepStrictEqual(sum.topTerminalCards[0], { choiceTitle: "Knight", count: 2 });
    // "Greed" appears twice, "Honor" once
    assert.deepStrictEqual(sum.topDriveCategories[0], { category: "Greed", count: 2 });
    assert.strictEqual(sum.topEffectRolls.length, 1);
    assert.strictEqual(sum.topEffectRolls[0].count, 1);
    console.log("  ✓ counts, rates, averages, and top-N tallies aggregate correctly");
}

console.log("\nAll chargen-simulation tests passed.");
