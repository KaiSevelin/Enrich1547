import assert from 'assert';
import { resolvePools } from '../combat/resolver.mjs';

// Scenario: Scatter-shot multiplier
// Attacker pool: ['Balanced','Balanced','Multiplier']
// Attacker rolls: [3,4,0] -> only first two are numeric damage contributors in this simple model
// Defender pool: ['Evade','Evade','Armor']
// Defender rolls: [2,2,1]

{
  const attackerPool = ['Balanced','Balanced','Multiplier'];
  const defenderPool = ['Evade','Evade','Armor'];
  const attackerRolls = [3,4,0];
  const defenderRolls = [2,2,1];

  const result = resolvePools(attackerPool, attackerRolls, defenderPool, defenderRolls);
  // attacker total = 7, defender total = 5, net = 2, multiplier count = 1 -> finalDamage = 2 * (1+1) = 4
  assert.strictEqual(result.attacker.total, 7, 'Attacker total mismatch');
  assert.strictEqual(result.defender.total, 5, 'Defender total mismatch');
  assert.strictEqual(result.netDamage, 2, 'Net damage mismatch');
  assert.strictEqual(result.finalDamage, 4, 'Final damage with multiplier mismatch');
}

// Scenario: No multiplier
{
  const attackerPool = ['Balanced','Balanced'];
  const defenderPool = ['Armor','Armor'];
  const attackerRolls = [4,3];
  const defenderRolls = [2,2];
  const result = resolvePools(attackerPool, attackerRolls, defenderPool, defenderRolls);
  // attacker 7 - defender 4 = 3, no multiplier -> final 3
  assert.strictEqual(result.netDamage, 3);
  assert.strictEqual(result.finalDamage, 3);
}

console.log('Resolution tests passed');
