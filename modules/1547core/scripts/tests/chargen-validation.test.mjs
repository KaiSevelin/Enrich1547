import assert from "assert";

/**
 * Behavioural test for the chargen schema-validation core extracted from
 * chargen.js into chargen-validation.js. Locks in the throw/accept behaviour of
 * the change + parsed-result validators so the extraction (and future edits)
 * preserve it — coverage the original 5,600-line class never had.
 */

const V = await import("../chargen/chargen-validation.js");

function throws(fn) {
    try { fn(); return false; } catch { return true; }
}

console.log("chargen-validation: primitives...");
{
    assert.strictEqual(V._isObject({}), true);
    assert.strictEqual(V._isObject([]), false);
    assert.ok(!V._isObject(null)); // returns falsy (null via && short-circuit)
    assert.strictEqual(V._isFiniteNumber("3"), true);
    assert.strictEqual(V._isFiniteNumber("x"), false);
    assert.ok(throws(() => V._requireString("", "msg")), "empty string rejected");
    assert.ok(!throws(() => V._requireString("ok", "msg")), "non-empty accepted");
    assert.strictEqual(
        V._sourceLabel({ tableIdx: 0, rowIdx: 2 }), "effectTables[0].rows[2]");
    assert.strictEqual(
        V._sourceLabel({ rewardIdx: 1, changeIdx: 0 }), "rewards[1].changes[0]");
    assert.strictEqual(V._sourceLabel(), "result");
    console.log("  ✓ _isObject / _isFiniteNumber / _requireString / _sourceLabel");
}

console.log("\nchargen-validation: _validateChangeSchema...");
{
    const ok = (ch) => assert.ok(!throws(() => V._validateChangeSchema(ch, "T", 0, 0)), JSON.stringify(ch));
    const bad = (ch) => assert.ok(throws(() => V._validateChangeSchema(ch, "T", 0, 0)), JSON.stringify(ch));

    ok({ type: "stat", characteristic: "Strength", steps: 1 });
    bad({ type: "stat", characteristic: "Nonsense", steps: 1 }); // invalid stat
    bad({ type: "stat", characteristic: "Strength" });           // missing steps
    bad({ type: "totally-unknown" });                            // unknown type
    ok({ type: "skill", targetKey: "perform", targetLevel: 2 });
    bad({ type: "skill" });                                      // missing targetKey
    ok({ type: "money", amount: 5 });
    ok({ type: "money", formula: "1d6" });
    bad({ type: "money" });                                      // needs amount or formula
    ok({ type: "luck", on: true });
    bad({ type: "luck", on: "yes" });                            // must be boolean
    ok({ type: "body" });
    console.log("  ✓ stat / skill / money / luck / body accept+reject paths");
}

console.log("\nchargen-validation: _validateParsedResultSchema...");
{
    const base = {
        choice: { title: "X", text: "t", icon: "i", tags: ["a"] },
        rewards: [{ weight: 1, changes: [{ type: "money", amount: 3 }] }],
    };
    assert.ok(!throws(() => V._validateParsedResultSchema(base, "T")), "valid parsed accepted");

    assert.ok(throws(() => V._validateParsedResultSchema(
        { choice: { text: "t" }, rewards: base.rewards }, "T")), "missing choice.title rejected");

    assert.ok(throws(() => V._validateParsedResultSchema(
        { choice: { title: "X" } }, "T")), "missing rewards+effectTables rejected");

    assert.ok(throws(() => V._validateParsedResultSchema(
        { choice: { title: "X" }, rewards: [{ changes: [{ type: "stat", characteristic: "Nope", steps: 1 }] }] }, "T")),
        "invalid nested change rejected");

    const fx = {
        choice: { title: "X" },
        effectTables: [{ rows: [{ weight: 1, change: { type: "money", amount: 1 } }] }],
    };
    assert.ok(!throws(() => V._validateParsedResultSchema(fx, "T")), "valid effectTables accepted");
    console.log("  ✓ accept valid; reject missing title / empty / bad nested change");
}

console.log("\nAll chargen-validation tests passed.");
