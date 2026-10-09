import { BATTLE_HEAL_BETWEEN_DUELS, MAX_ROUNDS } from './config';
import type { Faction } from './data/factions';
import type { SkillSet } from './data/skills';
import type { Rng } from './rng';

/**
 * Trois profils de combat, comme dans les jeux de duel : on ne se bat pas avec les mêmes qualités
 * selon qu'on attaque, qu'on défend sa position ou qu'on combat dans une bataille rangée.
 */
export type Role = 'attaque' | 'defense' | 'bataille';

export const ROLE_NAMES: Record<Role, string> = { attaque: 'Attaque', defense: 'Défense', bataille: 'Bataille' };

export interface Ratings {
  /** Toucher l'adversaire. */
  hit: number;
  /** Éviter ses coups. */
  dodge: number;
  /** Frapper le premier. */
  initiative: number;
  /** Multiplicateur des dégâts de l'arme. */
  damageMult: number;
  /** Réduction des dégâts reçus. */
  armor: number;
}

export function ratings(role: Role, eff: SkillSet, armor: number, faction?: Faction | null): Ratings {
  let r: Ratings;
  if (role === 'attaque') {
    r = {
      hit: eff.precision + eff.charge * 0.5 + eff.intimidation * 0.5,
      dodge: eff.esquive + eff.embuscade * 0.5,
      initiative: eff.embuscade + eff.precision * 0.25,
      damageMult: 1 + eff.arme * 0.05 + eff.charge * 0.02,
      armor: armor + eff.endurance * 0.3,
    };
  } else if (role === 'defense') {
    r = {
      hit: eff.precision + eff.tactique * 0.5 + eff.fortification * 0.5,
      dodge: eff.esquive * 0.5 + eff.fortification + eff.tactique * 0.5,
      initiative: eff.tactique + eff.precision * 0.25,
      damageMult: 1 + eff.arme * 0.05,
      armor: armor + eff.endurance * 0.3 + eff.fortification * 0.3,
    };
  } else {
    r = {
      hit: eff.precision + eff.commandement * 0.5 + eff.tactique * 0.5,
      dodge: eff.esquive * 0.5 + eff.fortification * 0.5 + eff.commandement * 0.5,
      initiative: eff.tactique + eff.commandement * 0.5,
      damageMult: 1 + eff.arme * 0.05 + eff.commandement * 0.02,
      armor: armor + eff.endurance * 0.3,
    };
  }
  if (faction === 'aube' && role !== 'attaque') r.dodge *= 1.05;
  if (faction === 'sables') r.initiative *= 1.05;
  return r;
}

/** Note de puissance affichée au joueur pour un profil (indicative). */
export const powerScore = (r: Ratings, hpMax: number, damage: [number, number]) =>
  Math.round(r.hit + r.dodge + r.initiative * 0.5 + r.armor * 0.8 + ((damage[0] + damage[1]) / 2) * r.damageMult * 1.5 + hpMax / 10);

export interface Fighter {
  id: number | string;
  name: string;
  level: number;
  faction?: Faction | null;
  hp: number;
  hpMax: number;
  damage: [number, number];
  ratings: Ratings;
}

export interface Strike {
  by: 'a' | 'b';
  hit: boolean;
  crit: boolean;
  damage: number;
  hpLeft: number;
}

export interface DuelResult {
  winner: 'a' | 'b';
  ko: boolean;
  rounds: Strike[][];
  hpA: number;
  hpB: number;
  damageA: number;
  damageB: number;
}

export function hitChance(hit: number, dodge: number) {
  return Math.min(0.92, Math.max(0.1, (hit + 5) / (hit + dodge + 10)));
}

function strike(att: Fighter, def: Fighter, r: Rng) {
  if (!r.chance(hitChance(att.ratings.hit, def.ratings.dodge))) return { hit: false, crit: false, damage: 0 };
  const crit = r.chance(0.06 + Math.min(0.1, att.ratings.hit * 0.001));
  const raw = r.int(att.damage[0], att.damage[1]) * att.ratings.damageMult * (crit ? 1.6 : 1);
  const damage = Math.max(1, Math.round(raw * (100 / (100 + def.ratings.armor * 4))));
  return { hit: true, crit, damage };
}

/** Duel au tour par tour : à chaque round, chacun frappe une fois, le plus rapide d'abord. */
export function duel(a: Fighter, b: Fighter, r: Rng): DuelResult {
  let hpA = a.hp;
  let hpB = b.hp;
  let damageA = 0;
  let damageB = 0;
  const rounds: Strike[][] = [];
  for (let i = 0; i < MAX_ROUNDS && hpA > 0 && hpB > 0; i++) {
    const aFirst = a.ratings.initiative + r.next() * 10 >= b.ratings.initiative + r.next() * 10;
    const order: ('a' | 'b')[] = aFirst ? ['a', 'b'] : ['b', 'a'];
    const round: Strike[] = [];
    for (const who of order) {
      if (hpA <= 0 || hpB <= 0) break;
      if (who === 'a') {
        const s = strike(a, b, r);
        hpB = Math.max(0, hpB - s.damage);
        damageA += s.damage;
        round.push({ by: 'a', ...s, hpLeft: hpB });
      } else {
        const s = strike(b, a, r);
        hpA = Math.max(0, hpA - s.damage);
        damageB += s.damage;
        round.push({ by: 'b', ...s, hpLeft: hpA });
      }
    }
    rounds.push(round);
  }
  const ko = hpA <= 0 || hpB <= 0;
  let winner: 'a' | 'b';
  if (hpB <= 0) winner = 'a';
  else if (hpA <= 0) winner = 'b';
  // Aucun K.-O. : celui qui a infligé la plus grande part de dégâts l'emporte (égalité : le défenseur).
  else winner = damageA / b.hpMax > damageB / a.hpMax ? 'a' : 'b';
  return { winner, ko, rounds, hpA, hpB, damageA, damageB };
}

export interface BattleTeam {
  key: string;
  faction: Faction;
  defender: boolean;
  fighters: Fighter[];
}

export interface BattleDuelLog {
  a: { team: string; id: Fighter['id']; name: string; hpStart: number };
  b: { team: string; id: Fighter['id']; name: string; hpStart: number };
  winner: 'a' | 'b';
  rounds: number;
}

export interface BattleResult {
  winnerTeam: string | null;
  duels: BattleDuelLog[];
  kills: Record<string, number>;
  survivors: Record<string, number>;
}

/**
 * Bataille de territoire : les équipes envoient leurs combattants un par un, dans l'ordre de leur ligne.
 * Le vainqueur d'un duel reste en lice avec les PV qui lui restent (plus un peu de repos),
 * jusqu'à ce qu'il ne reste qu'une seule équipe debout.
 */
export function battle(teams: BattleTeam[], r: Rng): BattleResult {
  const queues = teams.map((t) => ({ key: t.key, list: t.fighters.map((f) => ({ ...f })) })).filter((q) => q.list.length > 0);
  const kills: Record<string, number> = {};
  const duels: BattleDuelLog[] = [];
  let turn = 0;
  while (queues.filter((q) => q.list.length > 0).length > 1 && duels.length < 2000) {
    const alive = queues.filter((q) => q.list.length > 0);
    const qa = alive[turn % alive.length]!;
    const qb = alive[(turn + 1) % alive.length]!;
    turn++;
    const fa = qa.list[0]!;
    const fb = qb.list[0]!;
    const res = duel(fa, fb, r);
    duels.push({
      a: { team: qa.key, id: fa.id, name: fa.name, hpStart: Math.round(fa.hp) },
      b: { team: qb.key, id: fb.id, name: fb.name, hpStart: Math.round(fb.hp) },
      winner: res.winner,
      rounds: res.rounds.length,
    });
    const [win, loseQ, hpLeft] = res.winner === 'a' ? [fa, qb, res.hpA] : [fb, qa, res.hpB];
    kills[String(win.id)] = (kills[String(win.id)] ?? 0) + 1;
    loseQ.list.shift();
    win.hp = Math.max(1, hpLeft + (win.hpMax - hpLeft) * BATTLE_HEAL_BETWEEN_DUELS);
  }
  const remaining = queues.filter((q) => q.list.length > 0);
  return {
    winnerTeam: remaining.length === 1 ? remaining[0]!.key : null,
    duels,
    kills,
    survivors: Object.fromEntries(queues.map((q) => [q.key, q.list.length])),
  };
}
