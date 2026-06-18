// Pure chargen simulation analytics, extracted from chargen.js. These operate
// on plain outcome objects (no Foundry, no app state), so they are unit-testable
// with literal fixtures. The app-coupled orchestrators (runBatchSimulation,
// runSimulationToCompletion, _buildSimulationOutcome) stay on SkillTreeChargenApp
// because they drive the live chargen app. Static delegators preserve call sites.

export function _defaultSimulationIdentity(index = 0) {
    return {
        name: `Simulated Character ${index + 1}`,
        nativeLanguage: "Common Tongue"
    };
}

export function _summarizeSimulationOutcomes(outcomes = []) {
    const list = Array.isArray(outcomes) ? outcomes.filter(Boolean) : [];
    const totalRuns = list.length;
    const withDrive = list.filter(o => Number(o.driveCount ?? 0) >= 1).length;
    const withTwoDrives = list.filter(o => Number(o.driveCount ?? 0) >= 2).length;
    const withCareer = list.filter(o => Number(o.careerCardsSeen ?? 0) >= 1).length;
    const careerEndedPrematurely = list.filter(o => o.careerEndedPrematurely).length;
    const avgDrives = totalRuns ? (list.reduce((sum, o) => sum + Number(o.driveCount ?? 0), 0) / totalRuns) : 0;
    const avgCareerCards = withCareer
        ? (list.filter(o => Number(o.careerCardsSeen ?? 0) >= 1).reduce((sum, o) => sum + Number(o.careerCardsSeen ?? 0), 0) / withCareer)
        : 0;

    const terminalCards = new Map();
    const driveCategories = new Map();
    const effectRolls = new Map();

    for (const outcome of list) {
        const terminalKey = String(outcome.terminalCareerChoiceTitle ?? "").trim();
        if (terminalKey) {
            terminalCards.set(terminalKey, (terminalCards.get(terminalKey) ?? 0) + 1);
        }

        for (const category of outcome.driveCategories ?? []) {
            const key = String(category ?? "").trim();
            if (!key) continue;
            driveCategories.set(key, (driveCategories.get(key) ?? 0) + 1);
        }

        for (const effect of outcome.effectRolls ?? []) {
            const key = `${effect.choiceTitle} | Effects${effect.tableIndex} | Row ${effect.rowIndex + 1} | ${effect.type || "unknown"}${effect.targetKey ? ` | ${effect.targetKey}` : ""}`;
            effectRolls.set(key, (effectRolls.get(key) ?? 0) + 1);
        }
    }

    const topTerminalCards = Array.from(terminalCards.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([choiceTitle, count]) => ({ choiceTitle, count }));

    const topDriveCategories = Array.from(driveCategories.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([category, count]) => ({ category, count }));

    const topEffectRolls = Array.from(effectRolls.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([effect, count]) => ({ effect, count }));

    return {
        totalRuns,
        withDrive,
        withTwoDrives,
        withCareer,
        careerEndedPrematurely,
        driveRate: totalRuns ? withDrive / totalRuns : 0,
        twoDriveRate: totalRuns ? withTwoDrives / totalRuns : 0,
        prematureCareerEndRate: withCareer ? careerEndedPrematurely / withCareer : 0,
        avgDrives,
        avgCareerCards,
        topTerminalCards,
        topDriveCategories,
        topEffectRolls
    };
}
