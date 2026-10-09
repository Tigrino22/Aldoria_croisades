import type { Skill } from './skills';

export interface EnemyInfo {
  id: string;
  name: string;
  description: string;
  level: number;
  hp: number;
  skills: Partial<Record<Skill, number>>;
  damage: [number, number];
  armor: number;
  gold: [number, number];
  xp: number;
  /** Objets que l'ennemi peut laisser tomber, avec leur probabilité. */
  drops: { item: string; chance: number }[];
}

export const ENEMIES: EnemyInfo[] = [
  { id: 'loup', name: 'Loup affamé', description: 'Il rôde autour des campements la nuit.', level: 1, hp: 40, skills: { precision: 2, esquive: 2, embuscade: 2 }, damage: [2, 5], armor: 0, gold: [0, 4], xp: 12, drops: [{ item: 'chausses-de-laine', chance: 0.05 }] },
  { id: 'brigand', name: 'Brigand de grand chemin', description: 'Détrousse les pèlerins isolés.', level: 3, hp: 70, skills: { precision: 4, esquive: 3, charge: 3, arme: 2 }, damage: [3, 7], armor: 2, gold: [8, 20], xp: 22, drops: [{ item: 'dague', chance: 0.08 }, { item: 'bonnet-de-cuir', chance: 0.08 }] },
  { id: 'deserteur', name: 'Déserteur', description: 'Un soldat qui a jeté sa bannière, mais pas son épée.', level: 6, hp: 110, skills: { precision: 7, esquive: 5, charge: 6, arme: 6, resistance: 4 }, damage: [5, 10], armor: 4, gold: [20, 45], xp: 40, drops: [{ item: 'spangenhelm', chance: 0.07 }, { item: 'broigne', chance: 0.05 }] },
  { id: 'pillard', name: 'Pillard du désert', description: 'Surgit des dunes au galop.', level: 9, hp: 150, skills: { precision: 10, esquive: 10, embuscade: 10, charge: 7, arme: 8 }, damage: [6, 13], armor: 5, gold: [35, 70], xp: 62, drops: [{ item: 'bottes-de-cavalier', chance: 0.06 }, { item: 'anneau-d-argent', chance: 0.05 }] },
  { id: 'mercenaire', name: 'Mercenaire sans maître', description: 'Il se bat pour qui paie le mieux.', level: 12, hp: 200, skills: { precision: 13, esquive: 10, charge: 12, arme: 12, resistance: 9, intimidation: 6 }, damage: [8, 15], armor: 7, gold: [55, 110], xp: 90, drops: [{ item: 'camail', chance: 0.05 }, { item: 'masse-d-armes', chance: 0.03 }] },
  { id: 'chevalier-noir', name: 'Chevalier noir', description: 'Un seigneur déchu qui défie les voyageurs au pont.', level: 16, hp: 270, skills: { precision: 17, esquive: 12, charge: 16, arme: 16, resistance: 14, intimidation: 12 }, damage: [10, 19], armor: 10, gold: [90, 170], xp: 130, drops: [{ item: 'haubert', chance: 0.04 }, { item: 'epee-du-maitre', chance: 0.015 }] },
  { id: 'champion', name: 'Champion des ruines', description: 'Le gardien légendaire des ruines de l’ancien royaume.', level: 22, hp: 380, skills: { precision: 24, esquive: 18, charge: 22, arme: 22, resistance: 20, intimidation: 18, embuscade: 15 }, damage: [13, 24], armor: 13, gold: [150, 280], xp: 200, drops: [{ item: 'anneau-de-saphir', chance: 0.03 }, { item: 'epee-du-maitre', chance: 0.03 }] },
];

export const ENEMY_BY_ID: Record<string, EnemyInfo> = Object.fromEntries(ENEMIES.map((e) => [e.id, e]));
