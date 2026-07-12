// Social Battle pure rules math (social/social-math.mjs, ADR-0004 sweep).
import assert from "node:assert/strict";
import { numProp, skillDiceShift, marksFromExchange, socialPoolFormula } from "../social/social-math.mjs";

console.log("social-math.marksFromExchange...");
{
    assert.equal(marksFromExchange(5, 5), 0, "tie deals no mark");
    assert.equal(marksFromExchange(3, 7), 0, "loss deals no mark");
    assert.equal(marksFromExchange(8, 7), 1, "win deals one mark");
    assert.equal(marksFromExchange(14, 7), 1, "exactly double is NOT crushing (needs MORE than double)");
    assert.equal(marksFromExchange(15, 7), 2, "more than double deals two marks");
    console.log("  ✓ tie/loss 0, win 1, >2x 2, exactly 2x stays 1");
}

console.log("social-math.skillDiceShift...");
{
    assert.equal(skillDiceShift({ DiceShift: 2, CurrentLevel: 3, Level3DiceShift: 9 }), 2, "explicit DiceShift wins");
    assert.equal(skillDiceShift({ CurrentLevel: 2, Level2DiceShift: 1 }), 1, "level lookup");
    assert.equal(skillDiceShift({ CurrentLevel: 2 }), 0, "missing level entry defaults 0");
    assert.equal(skillDiceShift({}), 0, "empty props default 0 (level 0)");
    assert.equal(skillDiceShift({ DiceShift: "-1" }), -1, "string numbers coerce");
    console.log("  ✓ explicit wins, level fallback, 0 default");
}

console.log("social-math.socialPoolFormula...");
{
    assert.equal(socialPoolFormula(3, 2), "3d6 + 2");
    assert.equal(socialPoolFormula(3, 0), "3d6");
    assert.equal(socialPoolFormula(0, 5), "1d6", "zero pool floors at 1d6 (modifier dropped)");
    assert.equal(socialPoolFormula(-2, 0), "1d6", "negative pool floors at 1d6");
    console.log("  ✓ modifier appended, 1d6 floor");
}

console.log("social-math.numProp...");
{
    assert.equal(numProp({ A: "4" }, "A"), 4);
    assert.equal(numProp({ A: "" }, "A"), null, "empty string is null, not 0");
    assert.equal(numProp({ A: "x" }, "A"), null);
    assert.equal(numProp({}, "A"), null);
    assert.equal(numProp({ A: 0 }, "A"), 0, "explicit 0 is preserved");
    console.log("  ✓ coercion + null semantics");
}

console.log("\nAll social-math tests passed.");
