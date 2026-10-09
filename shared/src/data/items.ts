import type { Faction } from './factions';
import type { Skill } from './skills';

export const SLOTS = ['tete', 'corps', 'arme', 'bouclier', 'pieds', 'anneau'] as const;
export type Slot = (typeof SLOTS)[number];

export const SLOT_NAMES: Record<Slot, string> = {
  tete: 'Tête',
  corps: 'Corps',
  arme: 'Arme',
  bouclier: 'Bouclier',
  pieds: 'Pieds',
  anneau: 'Anneau',
};

export type Rarity = 'commun' | 'solide' | 'rare' | 'legendaire';
export const RARITY_NAMES: Record<Rarity, string> = { commun: 'Commun', solide: 'Solide', rare: 'Rare', legendaire: 'Légendaire' };

export interface ItemInfo {
  id: string;
  name: string;
  slot: Slot;
  level: number;
  price: number;
  rarity: Rarity;
  /** Dégâts min-max (armes uniquement). */
  damage?: [number, number];
  /** Protection : réduit les dégâts reçus. */
  armor?: number;
  bonuses: Partial<Record<Skill, number>>;
  /** Vendu uniquement dans la capitale de cette faction. */
  faction?: Faction;
  /** Ne s'achète pas : on le trouve en patrouille. */
  dropOnly?: boolean;
  description: string;
}

const items: ItemInfo[] = [
  // Armes
  { id: 'baton-ferre', name: 'Bâton ferré', slot: 'arme', level: 1, price: 0, rarity: 'commun', damage: [2, 5], bonuses: {}, description: 'Un bâton de marche cerclé de fer. Mieux que rien.' },
  { id: 'dague', name: 'Dague', slot: 'arme', level: 2, price: 60, rarity: 'commun', damage: [3, 7], bonuses: { embuscade: 1 }, description: 'Courte lame à double tranchant.' },
  { id: 'lance', name: 'Lance de fantassin', slot: 'arme', level: 4, price: 180, rarity: 'commun', damage: [4, 9], bonuses: { precision: 1, fortification: 1 }, description: 'Hampe de frêne et fer en feuille de laurier.' },
  { id: 'hache-danoise', name: 'Hache danoise', slot: 'arme', level: 7, price: 420, rarity: 'solide', damage: [6, 14], bonuses: { charge: 2, intimidation: 1 }, faction: 'givre', description: 'Large hache à long manche des guerriers du Nord.' },
  { id: 'epee-normande', name: 'Épée à pommeau de noix', slot: 'arme', level: 8, price: 520, rarity: 'solide', damage: [7, 14], bonuses: { arme: 2, precision: 1 }, faction: 'aube', description: 'Lame droite et garde en croix, forgée outre-mer.' },
  { id: 'epee-damasquinee', name: 'Épée damasquinée', slot: 'arme', level: 8, price: 520, rarity: 'solide', damage: [6, 15], bonuses: { precision: 2, esquive: 1 }, faction: 'sables', description: 'Acier moiré des forges orientales, léger et tranchant.' },
  { id: 'masse-d-armes', name: "Masse d'armes à ailettes", slot: 'arme', level: 12, price: 980, rarity: 'rare', damage: [9, 17], bonuses: { charge: 2, intimidation: 2 }, description: 'Brise les heaumes comme les os.' },
  { id: 'epee-du-maitre', name: 'Épée du maître-forgeron', slot: 'arme', level: 18, price: 2600, rarity: 'legendaire', damage: [12, 22], bonuses: { arme: 3, precision: 2, commandement: 1 }, dropOnly: true, description: 'Une lame dont on raconte qu’elle n’a jamais été brisée.' },
  // Boucliers
  { id: 'bouclier-rond', name: 'Bouclier rond en bois', slot: 'bouclier', level: 1, price: 40, rarity: 'commun', armor: 2, bonuses: { fortification: 1 }, description: 'Planches de tilleul et umbo de fer.' },
  { id: 'targe-de-cuir', name: 'Targe de cuir', slot: 'bouclier', level: 4, price: 160, rarity: 'commun', armor: 3, bonuses: { esquive: 1, fortification: 1 }, faction: 'sables', description: 'Bouclier en cuir épais en forme de cœur, léger à la course.' },
  { id: 'bouclier-cercle', name: 'Bouclier cerclé de fer', slot: 'bouclier', level: 5, price: 220, rarity: 'commun', armor: 4, bonuses: { fortification: 2 }, faction: 'givre', description: 'Grand bouclier rond renforcé de fer sur le pourtour.' },
  { id: 'ecu-en-amande', name: 'Écu en amande', slot: 'bouclier', level: 6, price: 300, rarity: 'solide', armor: 5, bonuses: { fortification: 2, resistance: 1 }, faction: 'aube', description: 'Long bouclier qui protège le cavalier de l’épaule au genou.' },
  { id: 'ecu-au-lion', name: 'Écu peint au lion', slot: 'bouclier', level: 14, price: 1500, rarity: 'rare', armor: 8, bonuses: { fortification: 3, commandement: 2 }, description: 'Un écu de seigneur, que les hommes suivent dans la mêlée.' },
  // Tête
  { id: 'bonnet-de-cuir', name: 'Bonnet de cuir', slot: 'tete', level: 1, price: 30, rarity: 'commun', armor: 1, bonuses: {}, description: 'Cuir bouilli rembourré de laine.' },
  { id: 'spangenhelm', name: 'Casque à bandes', slot: 'tete', level: 3, price: 120, rarity: 'commun', armor: 2, bonuses: { resistance: 1 }, description: 'Plaques de fer rivetées sur une armature.' },
  { id: 'casque-a-nasal', name: 'Casque à nasal', slot: 'tete', level: 6, price: 320, rarity: 'solide', armor: 3, bonuses: { resistance: 1, tactique: 1 }, description: 'Casque conique d’une seule pièce, avec sa barre nasale.' },
  { id: 'camail', name: 'Camail de mailles', slot: 'tete', level: 9, price: 650, rarity: 'solide', armor: 4, bonuses: { resistance: 2 }, description: 'Capuche de mailles qui protège la nuque et la gorge.' },
  { id: 'heaume-a-lunettes', name: 'Casque à lunettes', slot: 'tete', level: 13, price: 1300, rarity: 'rare', armor: 5, bonuses: { resistance: 2, intimidation: 2 }, description: 'Masque de fer autour des yeux, terrifiant dans la mêlée.' },
  // Corps
  { id: 'gambison', name: 'Gambison matelassé', slot: 'corps', level: 1, price: 50, rarity: 'commun', armor: 2, bonuses: { endurance: 1 }, description: 'Plusieurs couches de lin piquées ensemble.' },
  { id: 'broigne', name: 'Broigne', slot: 'corps', level: 4, price: 200, rarity: 'commun', armor: 4, bonuses: { resistance: 1 }, description: 'Cuir épais semé d’anneaux de fer.' },
  { id: 'cotte-courte', name: 'Cotte de mailles courte', slot: 'corps', level: 7, price: 480, rarity: 'solide', armor: 6, bonuses: { resistance: 2 }, description: 'Mailles rivetées jusqu’à la taille.' },
  { id: 'jaseran', name: 'Jaseran', slot: 'corps', level: 10, price: 900, rarity: 'rare', armor: 7, bonuses: { resistance: 2, esquive: 1 }, faction: 'sables', description: 'Fine maille cachée entre deux étoffes de soie.' },
  { id: 'haubert', name: 'Haubert long', slot: 'corps', level: 11, price: 1100, rarity: 'rare', armor: 9, bonuses: { resistance: 3, fortification: 1 }, description: 'Maille jusqu’aux genoux, fendue pour monter à cheval.' },
  // Pieds
  { id: 'chausses-de-laine', name: 'Chausses de laine', slot: 'pieds', level: 1, price: 20, rarity: 'commun', armor: 0, bonuses: { recuperation: 1 }, description: 'Bandes molletières et chausses chaudes.' },
  { id: 'bottes-de-cuir', name: 'Bottes de cuir', slot: 'pieds', level: 3, price: 110, rarity: 'commun', armor: 1, bonuses: { esquive: 1 }, description: 'Cuir de bœuf cousu main.' },
  { id: 'bottes-de-cavalier', name: 'Bottes de cavalier', slot: 'pieds', level: 7, price: 420, rarity: 'solide', armor: 2, bonuses: { charge: 1, embuscade: 1 }, description: 'Hautes bottes à éperons de fer.' },
  { id: 'chausses-de-mailles', name: 'Chausses de mailles', slot: 'pieds', level: 12, price: 1000, rarity: 'rare', armor: 3, bonuses: { resistance: 1, fortification: 2 }, description: 'Mailles lacées sur toute la jambe.' },
  // Anneaux
  { id: 'anneau-de-cuivre', name: 'Anneau de cuivre', slot: 'anneau', level: 2, price: 80, rarity: 'commun', bonuses: { recuperation: 1 }, description: 'Un simple anneau, porte-bonheur du voyageur.' },
  { id: 'anneau-d-argent', name: "Anneau d'argent", slot: 'anneau', level: 5, price: 260, rarity: 'solide', bonuses: { tactique: 1, precision: 1 }, description: 'Gravé d’un serment oublié.' },
  { id: 'chevaliere-d-or', name: "Chevalière d'or", slot: 'anneau', level: 9, price: 750, rarity: 'rare', bonuses: { commandement: 2, intimidation: 1 }, description: 'Le sceau d’une maison noble.' },
  { id: 'anneau-de-saphir', name: 'Anneau de saphir', slot: 'anneau', level: 15, price: 1800, rarity: 'legendaire', bonuses: { tactique: 2, esquive: 2, recuperation: 1 }, dropOnly: true, description: 'Une pierre bleue comme la mer d’Aldoria.' },
];

export const ITEMS: Record<string, ItemInfo> = Object.fromEntries(items.map((i) => [i.id, i]));
export const ITEM_LIST = items;
export const STARTING_ITEMS = ['baton-ferre', 'gambison', 'chausses-de-laine'];
