import assert from 'assert';
import {
  buildAttackerPool,
  buildDefenderPool,
  toFoundryFormula
} from '../combat/pool-builder.mjs';

// Test 1: Rapier thrust + Arrow with a bodkin-style modifier
{
  const attackDice = ['Grace', 'Grace', 'Balanced'];
  const advantage = true;
  const ammoAdd = ['Penetration'];
  const pool = buildAttackerPool(attackDice, advantage, ammoAdd);
  const expected = ['Grace', 'Grace', 'Grace', 'Balanced', 'Penetration'];
  assert.deepStrictEqual(pool, expected, 'Rapier pool mismatch');
}

// Test 2: Scatter-shot multiplier
{
  const attackDice = ['Balanced', 'Balanced'];
  const pool = buildAttackerPool(attackDice, false, ['Multiplier']);
  const expected = ['Balanced', 'Balanced', 'Multiplier'];
  assert.deepStrictEqual(pool, expected, 'Scatter-shot pool mismatch');
  const formula = toFoundryFormula(pool);
  assert.strictEqual(formula, '1db + 1db + 1dx', 'Scatter-shot formula mismatch');
}

// Test 3: Unknown family and unarmored fallback
{
  const attackDice = ['Balanced', 'UnknownDie'];
  const pool = buildAttackerPool(attackDice, false, []);
  const formula = toFoundryFormula(pool);
  assert.strictEqual(formula, '1db', 'Unknown die should be dropped in formula');
  const defender = buildDefenderPool(null);
  assert.deepStrictEqual(defender, ['Evade', 'Evade', 'Evade'], 'Defender fallback mismatch');
}

console.log('All pool-building tests passed');
