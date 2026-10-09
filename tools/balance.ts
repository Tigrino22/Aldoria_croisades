/**
 * Simulation d'équilibrage : npx tsx tools/balance.ts [--json fichier.json]
 *
 * Construit à chaque niveau un guerrier de référence (points répartis également, meilleur équipement
 * en boutique de son niveau), puis mesure ce que rapportent un travail, une patrouille, un pillage et
 * une journée de jeu, et en déduit le temps nécessaire pour monter de niveau.
 */
import { writeFileSync } from 'node:fs';
import {
  ATTRIBUTES,
  ENEMIES,
  ENERGY_MAX,
  ENERGY_REGEN_MINUTES,
  ITEM_LIST,
  JOBS,
  MAX_LEVEL,
  PILLAGE_LOOT_SHARE,
  SKILLS,
  SLOTS,
  armorOf,
  battleXp,
  duel,
  effectiveSkills,
  emptySkills,
  exposedGold,
  hpMax,
  jobPoints,
  patrolXp,
  pillageXp,
  ratings,
  rng,
  weaponOf,
  workReward,
  xpToNext,
  type AttributeSet,
  type Fighter,
  type Role,
  type Slot,
} from '../shared/src';

const SAMPLES = 400;

function reference(level: number, gearLevel = level) {
  const attributes = Object.fromEntries(ATTRIBUTES.map((a) => [a, 1])) as AttributeSet;
  const attrPoints = 2 + (level - 1);
  ATTRIBUTES.forEach((a, i) => (attributes[a] += Math.floor(attrPoints / 4) + (i < attrPoints % 4 ? 1 : 0)));
  const skills = emptySkills();
  const skillPoints = 6 + 3 * (level - 1);
  SKILLS.forEach((s, i) => (skills[s] = Math.floor(skillPoints / 12) + (i < skillPoints % 12 ? 1 : 0)));
  // Meilleur objet de boutique (hors objets de faction) pour chaque emplacement.
  const equipped: Partial<Record<Slot, string>> = {};
  for (const slot of SLOTS) {
    const best = ITEM_LIST.filter((i) => i.slot === slot && i.level <= gearLevel && !i.dropOnly && !i.faction).at(-1);
    if (best) equipped[slot] = best.id;
  }
  const eff = effectiveSkills(attributes, skills, equipped);
  const max = hpMax(level, attributes, eff);
  const fighter = (role: Role, id: string): Fighter => ({
    id,
    name: id,
    level,
    hp: max,
    hpMax: max,
    damage: weaponOf(equipped).damage!,
    ratings: ratings(role, eff, armorOf(equipped)),
  });
  return { level, attributes, skills, equipped, eff, hpMax: max, fighter };
}

function winRate(a: Fighter, b: Fighter) {
  let wins = 0;
  let rounds = 0;
  let ko = 0;
  let hpLostA = 0;
  for (let s = 0; s < SAMPLES; s++) {
    const r = duel(a, b, rng(s * 7919 + a.level * 31 + b.level));
    if (r.winner === 'a') wins++;
    if (r.ko) ko++;
    rounds += r.rounds.length;
    hpLostA += (a.hp - r.hpA) / a.hpMax;
  }
  return { win: wins / SAMPLES, rounds: rounds / SAMPLES, ko: ko / SAMPLES, hpLost: hpLostA / SAMPLES };
}

function enemyFighter(e: (typeof ENEMIES)[number]): Fighter {
  return { id: e.id, name: e.name, level: e.level, hp: e.hp, hpMax: e.hp, damage: e.damage, ratings: ratings('defense', { ...emptySkills(), ...e.skills }, e.armor) };
}

/** Profils de joueurs : heures de travail par jour et points d'énergie dépensés (patrouilles / pillages). */
const PROFILES = {
  regulier: { label: 'Joueur régulier (3 connexions par jour)', workHours: 12, patrols: 8, pillages: 4 },
  assidu: { label: 'Joueur assidu (connexions fréquentes)', workHours: 18, patrols: 12, pillages: 8 },
} as const;

const energyPerDay = (24 * 60) / ENERGY_REGEN_MINUTES;

const rows = [];
for (let level = 1; level <= MAX_LEVEL; level++) {
  const me = reference(level);
  // Meilleur travail accessible (en expérience).
  const jobs = JOBS.filter((j) => jobPoints(j, me.eff) >= j.required).map((j) => ({ job: j, ...workReward(j, me.eff, 60, 0) }));
  const bestJob = jobs.sort((a, b) => b.xp - a.xp)[0]!;
  // Meilleure patrouille (espérance d'expérience) parmi les ennemis autorisés.
  const patrols = ENEMIES.filter((e) => e.level <= level + 3).map((e) => {
    const w = winRate(me.fighter('attaque', 'moi'), enemyFighter(e));
    const xp = w.win * e.xp + (1 - w.win) * Math.round(e.xp / 4);
    const gold = w.win * (e.gold[0] + e.gold[1]) / 2;
    return { enemy: e, ...w, xp, gold };
  });
  const sameLevelEnemy = patrols.filter((p) => p.enemy.level <= level).sort((a, b) => b.enemy.level - a.enemy.level)[0]!;
  const bestPatrol = patrols.sort((a, b) => b.xp - a.xp)[0]!;
  // Pillage d'un joueur de même niveau (attaque contre défense).
  const target = reference(level);
  const pil = winRate(me.fighter('attaque', 'moi'), target.fighter('defense', 'cible'));
  // Or exposé supposé de la cible : une demi-journée de gains d'un joueur régulier, au-delà du coffre.
  const targetGold = bestJob.gold * 6 + level * 50;
  const loot = Math.floor(exposedGold(targetGold, level) * PILLAGE_LOOT_SHARE);
  const pillage = {
    ...pil,
    xp: pil.win * pillageXp.win(level) + (1 - pil.win) * pillageXp.loss(level),
    xpWin: pillageXp.win(level),
    gold: pil.win * loot,
  };
  const duelSame = winRate(me.fighter('attaque', 'a'), reference(level).fighter('attaque', 'b'));
  const stronger = level <= MAX_LEVEL - 5 ? winRate(me.fighter('attaque', 'a'), reference(level + 5).fighter('defense', 'b')).win : null;
  const need = xpToNext(level);
  const day = Object.fromEntries(
    Object.entries(PROFILES).map(([k, p]) => {
      const xp = p.workHours * bestJob.xp + p.patrols * bestPatrol.xp + p.pillages * pillage.xp + battleXp(level) / 7;
      const gold = p.workHours * bestJob.gold + p.patrols * bestPatrol.gold + p.pillages * pillage.gold;
      return [k, { xp, gold, days: Number.isFinite(need) ? need / xp : 0 }];
    }),
  ) as Record<keyof typeof PROFILES, { xp: number; gold: number; days: number }>;
  rows.push({
    level,
    xpToNext: Number.isFinite(need) ? need : null,
    hpMax: me.hpMax,
    job: { id: bestJob.job.id, name: bestJob.job.name, xpPerHour: bestJob.xp, goldPerHour: bestJob.gold, mastery: bestJob.mastery },
    patrol: { enemy: bestPatrol.enemy.name, enemyLevel: bestPatrol.enemy.level, win: bestPatrol.win, xp: bestPatrol.xp, xpWin: patrolXp(bestPatrol.enemy.level), gold: bestPatrol.gold, rounds: bestPatrol.rounds, hpLost: bestPatrol.hpLost },
    nearestEnemy: { enemy: sameLevelEnemy.enemy.name, level: sameLevelEnemy.enemy.level, win: sameLevelEnemy.win },
    pillage,
    duel: { sameLevelWin: duelSame.win, rounds: duelSame.rounds, ko: duelSame.ko, vsPlus5Win: stronger },
    day,
  });
}

// Temps cumulés.
const cumul: Record<string, number[]> = { regulier: [0], assidu: [0] };
for (const r of rows) for (const k of Object.keys(cumul)) cumul[k]!.push(cumul[k]!.at(-1)! + r.day[k as keyof typeof PROFILES].days);
const milestones = [5, 10, 20, 25, 30, 40, 50, 60, 75, 90, 100].map((l) => ({
  level: l,
  regulier: cumul.regulier![l - 1]!,
  assidu: cumul.assidu![l - 1]!,
  totalXp: rows.slice(0, l - 1).reduce((s, r) => s + (r.xpToNext ?? 0), 0),
}));

const pct = (n: number) => `${Math.round(n * 100)} %`;
console.log('niv | XP pour monter | travail XP/h (métier) | patrouille XP (ennemi, victoire) | pillage XP (victoire) | XP/jour régulier | jours/niveau | duel égal: rounds, KO');
for (const r of rows) {
  if (r.level % 5 !== 0 && r.level !== 1 && r.level !== 99) continue;
  console.log(
    [
      r.level,
      r.xpToNext ?? '-',
      `${r.job.xpPerHour} (${r.job.id} x${r.job.mastery.toFixed(2)})`,
      `${r.patrol.xp.toFixed(0)} (${r.patrol.enemy} N${r.patrol.enemyLevel}, ${pct(r.patrol.win)})`,
      `${r.pillage.xp.toFixed(0)} (${pct(r.pillage.win)})`,
      r.day.regulier.xp.toFixed(0),
      r.day.regulier.days.toFixed(2),
      `N${r.nearestEnemy.level} ${pct(r.nearestEnemy.win)}`,
      `${r.duel.rounds.toFixed(1)}, ${pct(r.duel.ko)}, +5: ${r.duel.vsPlus5Win === null ? '-' : pct(r.duel.vsPlus5Win)}`,
    ].join(' | '),
  );
}
console.log('\nJours cumulés pour atteindre le niveau :');
for (const m of milestones) console.log(`  niveau ${m.level}: régulier ${m.regulier.toFixed(1)} j, assidu ${m.assidu.toFixed(1)} j, XP totale ${m.totalXp}`);
console.log(`Énergie par jour : ${energyPerDay.toFixed(1)} (max ${ENERGY_MAX})`);

const out = process.argv.indexOf('--json');
if (out > 0) writeFileSync(process.argv[out + 1]!, JSON.stringify({ profiles: PROFILES, rows, milestones }, null, 1));
