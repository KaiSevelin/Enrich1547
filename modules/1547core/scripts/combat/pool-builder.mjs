export const MAPPING = {
  Balanced: 'b',
  Grace: 'g',
  Heavy: 'h',
  Penetration: 'p',
  Lethality: 'l',
  Control: 'c',
  Armor: 'a',
  Evade: 'e',
  Risk: 'r',
  Multiplier: 'x'
};

export function buildAttackPool(baseDice, {
  advantageCount = 0,
  addMainDice = 0,
  addMultiplierDice = 0,
  addRiskDice = 0,
  extraDice = [],
  ammoAddDice = []
} = {}) {
  const pool = Array.isArray(baseDice) ? baseDice.slice() : [];
  const firstDie = pool[0] ?? "";

  for (let index = 0; index < Math.max(0, Number(advantageCount) || 0); index += 1) {
    if (firstDie) pool.unshift(firstDie);
  }

  for (let index = 0; index < Math.max(0, Number(addMainDice) || 0); index += 1) {
    if (firstDie) pool.push(firstDie);
  }

  for (let index = 0; index < Math.max(0, Number(addMultiplierDice) || 0); index += 1) {
    pool.push('Multiplier');
  }

  for (const die of Array.isArray(extraDice) ? extraDice : []) {
    if (typeof die === 'string' && die.trim()) pool.push(die);
  }

  for (let index = 0; index < Math.max(0, Number(addRiskDice) || 0); index += 1) {
    pool.push('Risk');
  }

  return pool.concat(Array.isArray(ammoAddDice) ? ammoAddDice.slice() : []);
}

export function buildAttackerPool(attackDice, advantage = false, ammoAddDice = []) {
  return buildAttackPool(attackDice, {
    advantageCount: advantage ? 1 : 0,
    ammoAddDice
  });
}

export function buildDefenderPool(defenseDice) {
  if (!Array.isArray(defenseDice) || defenseDice.length === 0) {
    return ['Evade', 'Evade', 'Evade'];
  }
  return defenseDice.slice();
}

export function toFoundryFormula(diceArray) {
  if (!Array.isArray(diceArray)) return '';
  return diceArray
    .map(d => {
      const k = MAPPING[d];
      return k ? `1d${k}` : '';
    })
    .filter(Boolean)
    .join(' + ');
}

export default {
  MAPPING,
  buildAttackPool,
  buildDefenderPool,
  toFoundryFormula
};
