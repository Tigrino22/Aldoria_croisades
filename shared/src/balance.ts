/**
 * Courbes d'équilibrage du niveau 1 au niveau 100.
 * Les objets, les ennemis et les gains sont tous dérivés de ces formules, ce qui garde la progression cohérente :
 * à chaque niveau, l'équipement, les adversaires et les récompenses grandissent au même rythme.
 * Le rapport d'équilibrage (tools/balance.ts) les simule pour vérifier les temps de progression.
 */
import type { Rarity, Slot } from './data/items';

const round5 = (n: number) => (n < 100 ? Math.round(n) : Math.round(n / 5) * 5);

// ---------- Objets ----------

export const RARITY_PRICE: Record<Rarity, number> = { commun: 0.7, solide: 1, rare: 1.6, legendaire: 2.6 };
/** Points de compétence apportés par un objet, selon sa rareté. */
export const RARITY_BONUS: Record<Rarity, number> = { commun: 1, solide: 1.35, rare: 1.75, legendaire: 2.3 };
const RARITY_POWER: Record<Rarity, number> = { commun: 0.9, solide: 1, rare: 1.1, legendaire: 1.22 };

/** Prix d'un objet chez le marchand. */
export const itemPrice = (level: number, rarity: Rarity) => round5((12 * level ** 1.5 + 30) * RARITY_PRICE[rarity]);

/** Nombre de points de compétence que porte un objet. */
export const itemBonusBudget = (level: number, rarity: Rarity) => Math.max(1, Math.round((1 + level / 10) * RARITY_BONUS[rarity]));

/** Dégâts moyens d'une arme ordinaire de ce niveau. */
export const weaponAverage = (level: number) => 12 + 1.6 * level;

export function weaponDamage(level: number, rarity: Rarity, power = 1, spread = 0.35): [number, number] {
  const avg = weaponAverage(level) * RARITY_POWER[rarity] * power;
  return [Math.max(1, Math.round(avg * (1 - spread))), Math.max(2, Math.round(avg * (1 + spread)))];
}

/** Protection de base de chaque emplacement : environ 4 + 0,8 par niveau pour une tenue complète. */
const SLOT_ARMOR: Partial<Record<Slot, [number, number]>> = {
  corps: [2, 0.3],
  bouclier: [1.5, 0.25],
  tete: [1, 0.16],
  pieds: [0.5, 0.09],
};

export function slotArmor(slot: Slot, level: number, rarity: Rarity, power = 1) {
  const base = SLOT_ARMOR[slot];
  if (!base) return 0;
  return Math.max(slot === 'pieds' ? 0 : 1, Math.round((base[0] + base[1] * level) * RARITY_POWER[rarity] * power));
}

/** Répartit `budget` points selon des poids (méthode du plus fort reste). */
export function spreadPoints<K extends string>(budget: number, weights: Partial<Record<K, number>>): Partial<Record<K, number>> {
  const entries = Object.entries(weights) as [K, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  const raw = entries.map(([k, w]) => [k, (budget * w) / total] as const);
  const out = Object.fromEntries(raw.map(([k, v]) => [k, Math.floor(v)])) as Record<K, number>;
  let left = budget - Object.values<number>(out).reduce((s, v) => s + v, 0);
  for (const [k] of [...raw].sort((a, b) => (b[1] % 1) - (a[1] % 1))) {
    if (left <= 0) break;
    out[k]++;
    left--;
  }
  for (const k of Object.keys(out) as K[]) if (out[k] === 0) delete out[k];
  return out;
}

// ---------- Récompenses ----------

/** Expérience d'une victoire en patrouille contre un ennemi de ce niveau (un quart en cas de défaite). */
export const patrolXp = (enemyLevel: number) => Math.round(8 + 1.2 * enemyLevel);
export const patrolGold = (enemyLevel: number): [number, number] => [Math.round(1 + 1.6 * enemyLevel), Math.round(6 + 3.2 * enemyLevel)];

export const pillageXp = {
  win: (defenderLevel: number) => Math.round(10 + 2 * defenderLevel),
  loss: (defenderLevel: number) => Math.round(3 + 0.5 * defenderLevel),
  defenderWin: (attackerLevel: number) => Math.round(5 + 0.6 * attackerLevel),
  defenderLoss: 2,
};

export const duelXp = {
  win: (defenderLevel: number) => Math.round(6 + 1.2 * defenderLevel),
  loss: (defenderLevel: number) => Math.round(2 + 0.3 * defenderLevel),
  defenderWin: (attackerLevel: number) => Math.round(4 + 0.5 * attackerLevel),
  defenderLoss: 2,
};

/** Bataille de territoire hebdomadaire : expérience pour chaque participant, or pour l'armée victorieuse. */
export const battleXp = (level: number) => Math.round(30 + 8 * level);
export const battleGold = (level: number) => Math.round(50 + 20 * level);

/** Récompenses d'un travail débloqué vers ce niveau, par heure, avant le bonus de maîtrise. */
export const jobXpPerHour = (unlockLevel: number) => 6 + 0.55 * unlockLevel;
export const jobGoldPerHour = (unlockLevel: number) => 10 + 1.7 * unlockLevel;
