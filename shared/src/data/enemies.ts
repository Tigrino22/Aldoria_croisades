import { patrolGold, patrolXp, slotArmor, weaponDamage } from '../balance';
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

/**
 * Les ennemis sont construits comme un guerrier équilibré de leur niveau, un peu plus faible qu'un joueur
 * bien équipé, puis modulés : plus de PV, de meilleurs coups ou une meilleure garde selon leur nature.
 */
interface EnemyDef {
  id: string;
  name: string;
  description: string;
  level: number;
  /** Multiplicateurs : PV, dégâts, compétences de combat. */
  hp?: number;
  dmg?: number;
  skill?: number;
  /** Compétences favorites (+30 %). */
  strong?: Skill[];
  drops: [string, number][];
}

const DEFS: EnemyDef[] = [
  { id: 'loup', name: 'Loup affamé', description: 'Il rôde autour des campements la nuit.', level: 1, hp: 0.7, dmg: 0.8, skill: 0.7, drops: [['chausses-de-laine', 0.05]] },
  { id: 'brigand', name: 'Brigand de grand chemin', description: 'Détrousse les pèlerins isolés.', level: 3, drops: [['dague', 0.08], ['bonnet-de-cuir', 0.08]] },
  { id: 'deserteur', name: 'Déserteur', description: 'Un soldat qui a jeté sa bannière, mais pas son épée.', level: 6, strong: ['arme'], drops: [['spangenhelm', 0.07], ['broigne', 0.05]] },
  { id: 'pillard', name: 'Pillard du désert', description: 'Surgit des dunes au galop.', level: 9, strong: ['esquive', 'precision'], drops: [['bottes-de-cavalier', 0.06], ['anneau-d-argent', 0.05]] },
  { id: 'mercenaire', name: 'Mercenaire sans maître', description: 'Il se bat pour qui paie le mieux.', level: 12, dmg: 1.05, drops: [['camail', 0.05], ['masse-d-armes', 0.03]] },
  { id: 'chevalier-noir', name: 'Chevalier noir', description: 'Un seigneur déchu qui défie les voyageurs au pont.', level: 16, hp: 1.1, strong: ['fortification'], drops: [['haubert', 0.04], ['anneau-de-saphir', 0.015]] },
  { id: 'champion', name: 'Champion des ruines', description: 'Le gardien des ruines de l’ancien royaume, à l’entrée des salles basses.', level: 21, hp: 1.15, skill: 1.05, drops: [['epee-du-maitre', 0.025], ['anneau-de-saphir', 0.02]] },
  { id: 'ours', name: 'Ours des montagnes', description: 'Une bête énorme, réveillée trop tôt de son hiver.', level: 26, hp: 1.35, dmg: 1.1, skill: 0.85, drops: [['cotte-des-clans', 0.04], ['anneau-de-jade', 0.04]] },
  { id: 'chef-brigand', name: 'Chef de bande', description: 'Il commande une vingtaine de coupe-jarrets depuis une tour en ruine.', level: 31, strong: ['tactique'], drops: [['fleau-d-armes', 0.03], ['anneau-du-veteran', 0.04]] },
  { id: 'assassin', name: 'Assassin des collines', description: 'Payé pour tuer, il frappe toujours le premier.', level: 36, hp: 0.85, dmg: 1.15, strong: ['esquive', 'precision'], drops: [['jaque-de-cuir', 0.05], ['anneau-d-emeraude', 0.02]] },
  { id: 'chevalier-renegat', name: 'Chevalier renégat', description: 'Chassé de son ordre, il vend son épée au plus offrant.', level: 41, hp: 1.1, strong: ['fortification', 'arme'], drops: [['epee-batarde', 0.03], ['cotte-de-plates', 0.03]] },
  { id: 'fou-de-guerre', name: 'Fou-de-guerre du Nord', description: 'Il se jette dans la mêlée sans bouclier, en hurlant.', level: 47, hp: 1.2, dmg: 1.2, skill: 0.9, drops: [['hache-barbue', 0.04], ['manteau-de-loup', 0.02]] },
  { id: 'garde-du-tyran', name: 'Garde du tyran', description: 'Un colosse en armure qui garde un seigneur cruel.', level: 53, hp: 1.15, strong: ['fortification'], drops: [['grand-pavois', 0.04], ['casque-a-masque', 0.03]] },
  { id: 'seigneur-pillard', name: 'Seigneur pillard', description: 'Il rançonne toute une vallée depuis son château.', level: 59, strong: ['tactique', 'arme'], drops: [['brigandine', 0.03], ['sceau-du-capitaine', 0.03]] },
  { id: 'capitaine-mercenaire', name: 'Capitaine mercenaire', description: 'Sa compagnie a servi les trois bannières, et les a toutes trahies.', level: 65, skill: 1.05, drops: [['lance-du-connetable', 0.025], ['anneau-du-loup', 0.03]] },
  { id: 'seigneur-dechu', name: 'Seigneur de guerre déchu', description: 'Il a perdu son royaume mais pas son art de la guerre.', level: 71, hp: 1.1, drops: [['haubert-de-maitre', 0.025], ['anneau-du-chancelier', 0.025]] },
  { id: 'gardien-des-tombeaux', name: 'Gardien des tombeaux', description: 'Il veille depuis des siècles sur les rois enterrés.', level: 78, hp: 1.2, strong: ['fortification', 'resistance'], drops: [['bouclier-de-la-garde', 0.025], ['anneau-des-ruines', 0.012]] },
  { id: 'general-renegat', name: 'Général renégat', description: 'Il a levé sa propre armée contre les trois bannières.', level: 85, skill: 1.05, strong: ['tactique'], drops: [['bottes-de-l-errant', 0.012], ['cotte-des-rois', 0.012], ['couronne-de-fer', 0.01]] },
  { id: 'roi-sans-couronne', name: 'Roi sans couronne', description: 'Le dernier prétendant au trône d’Aldoria, et le plus dangereux.', level: 92, hp: 1.15, dmg: 1.05, drops: [['lame-de-l-aurore', 0.012], ['egide-des-ruines', 0.012], ['hache-du-dernier-hiver', 0.01]] },
  { id: 'seigneur-des-ruines', name: 'Seigneur des ruines', description: 'Ce qui reste du dernier roi d’Aldoria, assis sur son trône brisé.', level: 100, hp: 1.25, skill: 1.05, drops: [['epee-d-aldoria', 0.008], ['bouclier-d-aldoria', 0.008], ['heaume-d-aldoria', 0.008], ['armure-d-aldoria', 0.008], ['solerets-d-aldoria', 0.008], ['anneau-d-aldoria', 0.008]] },
];

const COMBAT_SKILLS: Skill[] = ['precision', 'esquive', 'tactique', 'fortification', 'arme', 'endurance', 'resistance'];

function build(d: EnemyDef): EnemyInfo {
  const L = d.level;
  const base = (0.55 * L + 1.5) * (d.skill ?? 1);
  const skills = Object.fromEntries(COMBAT_SKILLS.map((s) => [s, Math.max(1, Math.round(base * (d.strong?.includes(s) ? 1.3 : 1)))]));
  const armor = Math.round((slotArmor('corps', L, 'commun') + slotArmor('bouclier', L, 'commun') + slotArmor('tete', L, 'commun')) * 0.9);
  const dmg = weaponDamage(L, 'solide', d.dmg ?? 1);
  return {
    id: d.id,
    name: d.name,
    description: d.description,
    level: L,
    hp: Math.round((40 + 10 * L) * (d.hp ?? 1)),
    skills,
    damage: dmg,
    armor,
    gold: patrolGold(L),
    xp: patrolXp(L),
    drops: d.drops.map(([item, chance]) => ({ item, chance })),
  };
}

export const ENEMIES: EnemyInfo[] = DEFS.map(build);

export const ENEMY_BY_ID: Record<string, EnemyInfo> = Object.fromEntries(ENEMIES.map((e) => [e.id, e]));
