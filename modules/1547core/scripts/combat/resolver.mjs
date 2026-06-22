// ⚠ Standalone pure damage-math module (pre-carve-up), kept for resolution.test.mjs.
// It is NOT wired into the live attack lifecycle, which applies the face-driven
// `applyMultiplier` (base × multiplier) in combat/attack-lifecycle.mjs. This file
// uses a DIFFERENT model — base × (1 + multiplierCount). Do not import it into the
// lifecycle; the two multiplier semantics are intentionally separate.

export function sumRolls(rolls) {
  return Array.isArray(rolls) ? rolls.reduce((s, v) => s + Number(v || 0), 0) : 0;
}

// Multiplier semantics: each `Multiplier` die increases final damage by +1x
// Final damage = baseNetDamage * (1 + multiplierCount)
export function applyMultipliers(baseDamage, diceArray) {
  if (!Array.isArray(diceArray)) return baseDamage;
  const count = diceArray.filter(d => d === 'Multiplier').length;
  return baseDamage * (1 + count);
}

// Resolve two rolled pools into final damage.
// attackerRolls and defenderRolls are arrays of numeric die face results matching their pools.
// Pools are arrays of canonical family names; multiplier dice must be present in the attacker's pool when used.
export function resolvePools(attackerPool, attackerRolls, defenderPool, defenderRolls) {
  const atkTotal = sumRolls(attackerRolls);
  const defTotal = sumRolls(defenderRolls);
  const net = Math.max(0, atkTotal - defTotal);
  const final = applyMultipliers(net, attackerPool);
  return {
    attacker: { pool: attackerPool.slice(), rolls: attackerRolls.slice(), total: atkTotal },
    defender: { pool: defenderPool.slice(), rolls: defenderRolls.slice(), total: defTotal },
    netDamage: net,
    finalDamage: final
  };
}

export default {
  sumRolls,
  applyMultipliers,
  resolvePools
};
