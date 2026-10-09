import { DISHONOR_LEVEL_RATIO, MIN_HP_TO_FIGHT } from './config';

export interface HonorContext {
  kind: 'pillage' | 'duel';
  attackerLevel: number;
  defenderLevel: number;
  attackerWon: boolean;
  /** PV du défenseur au début du combat, en part de ses PV max. */
  defenderHpRatio: number;
  defenderOutlaw: boolean;
}

export interface HonorChange {
  attacker: number;
  defender: number;
  reasons: string[];
}

/**
 * Règles d'honneur : défier plus fort que soi est glorieux, s'en prendre aux faibles ou aux blessés est
 * déshonorant, et abattre un hors-la-loi est toujours honorable.
 */
export function honorChange(c: HonorContext): HonorChange {
  const reasons: string[] = [];
  let attacker = 0;
  let defender = 0;
  const diff = c.defenderLevel - c.attackerLevel;

  if (c.defenderOutlaw) {
    if (c.attackerWon) {
      attacker += 8;
      reasons.push('Vous avez fait tomber un hors-la-loi (+8).');
    }
    return { attacker, defender, reasons };
  }

  if (c.defenderLevel < c.attackerLevel * DISHONOR_LEVEL_RATIO) {
    const malus = 5 + Math.round((c.attackerLevel - c.defenderLevel) * 1.5);
    attacker -= c.kind === 'pillage' ? malus : Math.ceil(malus / 2);
    reasons.push(`S'en prendre à un adversaire bien plus faible est déshonorant (${-malus}).`);
  }
  if (c.defenderHpRatio < MIN_HP_TO_FIGHT * 1.5) {
    attacker -= 12;
    reasons.push('Frapper un blessé est une lâcheté (-12).');
  }

  if (c.attackerWon) {
    const gain = c.kind === 'duel' ? 4 + Math.max(0, diff) * 1.5 : 3 + Math.max(0, diff);
    const g = Math.min(15, Math.round(gain));
    attacker += g;
    reasons.push(diff > 0 ? `Victoire contre plus fort que vous (+${g}).` : `Victoire (+${g}).`);
  } else {
    if (diff > 0 && c.kind === 'duel') {
      attacker += 1;
      reasons.push('Défaite honorable contre plus fort que vous (+1).');
    }
    defender += Math.min(10, 4 + Math.max(0, -diff));
    reasons.push(`Le défenseur a tenu bon (+${Math.min(10, 4 + Math.max(0, -diff))} pour lui).`);
  }
  return { attacker, defender, reasons };
}

/** Honneur gagné dans une bataille de territoire. */
export const BATTLE_HONOR = { participation: 5, victory: 10, bestFighter: 10 };
