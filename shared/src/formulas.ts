import {
  ENERGY_MAX,
  ENERGY_REGEN_MINUTES,
  MAX_LEVEL,
  OUTLAW_HONOR,
  SAFE_GOLD_PER_LEVEL,
  TERRITORY_WORK_BONUS,
} from './config';
import { FACTION_INFO, type Faction } from './data/factions';
import { ITEMS, type ItemInfo, type Slot } from './data/items';
import type { JobInfo } from './data/jobs';
import { SKILLS, SKILL_INFO, emptySkills, type AttributeSet, type Skill, type SkillSet } from './data/skills';

/** Expérience nécessaire pour passer du niveau `level` au suivant. */
export const xpToNext = (level: number) => (level >= MAX_LEVEL ? Infinity : Math.round(40 * level ** 1.6));

/** Applique l'expérience gagnée : renvoie le nouveau niveau, l'expérience restante et le nombre de niveaux gagnés. */
export function addXp(level: number, xp: number, gained: number) {
  let l = level;
  let x = xp + gained;
  while (l < MAX_LEVEL && x >= xpToNext(l)) {
    x -= xpToNext(l);
    l++;
  }
  return { level: l, xp: l >= MAX_LEVEL ? 0 : x, levelsGained: l - level };
}

/** Prix d'un point de compétence acheté à l'entraînement (de plus en plus cher). */
export const trainingCost = (alreadyTrained: number) => Math.round(60 * (alreadyTrained + 1) ** 1.5);

export function equipmentBonuses(equipped: Partial<Record<Slot, string>>): SkillSet {
  const out = emptySkills();
  for (const id of Object.values(equipped)) {
    const item = id ? ITEMS[id] : undefined;
    if (!item) continue;
    for (const [s, v] of Object.entries(item.bonuses)) out[s as Skill] += v ?? 0;
  }
  return out;
}

/** Valeur réelle d'une compétence : points investis + attribut lié + équipement. */
export function effectiveSkills(attributes: AttributeSet, skills: SkillSet, equipped: Partial<Record<Slot, string>>): SkillSet {
  const bonus = equipmentBonuses(equipped);
  const out = emptySkills();
  for (const s of SKILLS) out[s] = skills[s] + attributes[SKILL_INFO[s].attribute] + bonus[s];
  return out;
}

export const hpMax = (level: number, attributes: AttributeSet, eff: SkillSet) => 60 + level * 6 + attributes.vigueur * 8 + eff.resistance * 6;

/** Pourcentage des PV max regagnés par heure de jeu. */
export const hpRegenPerHour = (eff: SkillSet) => 0.08 + eff.recuperation * 0.004;

export function armorOf(equipped: Partial<Record<Slot, string>>) {
  return Object.values(equipped).reduce((s, id) => s + ((id && ITEMS[id]?.armor) || 0), 0);
}

export function weaponOf(equipped: Partial<Record<Slot, string>>): ItemInfo {
  return (equipped.arme && ITEMS[equipped.arme]) || ITEMS['baton-ferre']!;
}

/** Énergie actuelle, calculée à la lecture (pas de tick global). */
export function currentEnergy(stored: number, storedAt: Date, now: Date, speed: number) {
  const gained = ((now.getTime() - storedAt.getTime()) * speed) / (ENERGY_REGEN_MINUTES * 60_000);
  return Math.min(ENERGY_MAX, stored + Math.max(0, gained));
}

export function currentHp(stored: number, storedAt: Date, now: Date, speed: number, max: number, regenPerHour: number) {
  const hours = ((now.getTime() - storedAt.getTime()) * speed) / 3_600_000;
  return Math.min(max, stored + Math.max(0, hours) * regenPerHour * max);
}

export const safeGold = (level: number) => level * SAFE_GOLD_PER_LEVEL;
export const exposedGold = (gold: number, level: number) => Math.max(0, gold - safeGold(level));

export function factionRank(faction: Faction, level: number) {
  const ranks = FACTION_INFO[faction].ranks;
  return ranks[Math.min(ranks.length - 1, Math.floor(level / 7))]!;
}

export function honorTitle(honor: number) {
  if (honor <= OUTLAW_HONOR) return 'Hors-la-loi';
  if (honor < -25) return 'Déshonoré';
  if (honor < 50) return 'Sans renom';
  if (honor < 200) return 'Respecté';
  if (honor < 600) return 'Honorable';
  if (honor < 1500) return 'Illustre';
  return 'Légendaire';
}

export const isOutlaw = (honor: number) => honor <= OUTLAW_HONOR;

/** Les marchands font payer l'honneur : moins cher pour les gens honorables, plus cher pour les autres. */
export function priceFactor(honor: number) {
  if (isOutlaw(honor)) return 1.25;
  if (honor < 0) return 1.1;
  if (honor >= 600) return 0.9;
  if (honor >= 200) return 0.95;
  return 1;
}

export const jobPoints = (job: JobInfo, eff: SkillSet) => job.skills.reduce((s, k) => s + eff[k], 0);

/** Gains d'un travail : plus on dépasse le minimum requis, mieux on est payé (jusqu'à x2). */
export function workReward(job: JobInfo, eff: SkillSet, minutes: number, ownedTerritories: number) {
  const points = jobPoints(job, eff);
  const mastery = 1 + Math.min(1, Math.max(0, points - job.required) / (job.required + 10));
  const hours = minutes / 60;
  return {
    gold: Math.round(job.goldPerHour * hours * mastery * (1 + ownedTerritories * TERRITORY_WORK_BONUS)),
    xp: Math.round(job.xpPerHour * hours * mastery),
    honor: Math.floor(job.honorPerHour * hours),
    mastery,
  };
}

/** Soins à l'hôpital : 1 pièce d'or par PV manquant, un peu plus cher avec le niveau. */
export const hospitalCost = (missingHp: number, level: number) => Math.ceil(missingHp * (1 + level / 10));
