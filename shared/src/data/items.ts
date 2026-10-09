import type { Faction } from './factions';
import type { Skill } from './skills';
import { itemBonusBudget, itemPrice, slotArmor, spreadPoints, weaponDamage } from '../balance';

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


/** Une ligne du catalogue : les chiffres (prix, dégâts, protection, bonus) sont calculés à partir du niveau et de la rareté. */
interface ItemDef {
  id: string;
  name: string;
  slot: Slot;
  level: number;
  rarity: Rarity;
  /** Poids des compétences : le budget de bonus de l'objet est réparti selon ces poids. */
  w: Partial<Record<Skill, number>>;
  /** Puissance relative : dégâts pour une arme, protection pour une pièce d'armure (1 = normal). */
  power?: number;
  /** Écart entre dégâts minimum et maximum (armes). */
  spread?: number;
  faction?: Faction;
  dropOnly?: boolean;
  price?: number;
  description: string;
}

const C: Rarity = 'commun';
const S: Rarity = 'solide';
const R: Rarity = 'rare';
const L: Rarity = 'legendaire';

const weapons: Omit<ItemDef, 'slot'>[] = [
  { id: 'baton-ferre', name: 'Bâton ferré', level: 1, rarity: C, w: {}, spread: 0.4, price: 0, description: 'Un bâton de marche cerclé de fer. Mieux que rien.' },
  { id: 'dague', name: 'Dague', level: 2, rarity: C, w: { embuscade: 1 }, spread: 0.3, description: 'Courte lame à double tranchant.' },
  { id: 'massue-cloutee', name: 'Massue cloutée', level: 3, rarity: C, w: { charge: 1 }, spread: 0.45, description: 'Un gourdin de chêne hérissé de clous de charpentier.' },
  { id: 'lance', name: 'Lance de fantassin', level: 4, rarity: C, w: { precision: 1, fortification: 1 }, description: 'Hampe de frêne et fer en feuille de laurier.' },
  { id: 'francisque', name: 'Hache de jet', level: 6, rarity: C, w: { charge: 1, embuscade: 1 }, spread: 0.4, description: 'Petite hache équilibrée, qu’on lance avant le choc.' },
  { id: 'hache-danoise', name: 'Hache danoise', level: 7, rarity: S, w: { charge: 2, intimidation: 1 }, spread: 0.45, faction: 'givre', description: 'Large hache à long manche des guerriers du Nord.' },
  { id: 'epee-normande', name: 'Épée à pommeau de noix', level: 8, rarity: S, w: { arme: 2, precision: 1 }, faction: 'aube', description: 'Lame droite et garde en croix, forgée outre-mer.' },
  { id: 'epee-damasquinee', name: 'Épée damasquinée', level: 8, rarity: S, w: { precision: 2, esquive: 1 }, faction: 'sables', description: 'Acier moiré des forges orientales, léger et tranchant.' },
  { id: 'masse-d-armes', name: "Masse d'armes à ailettes", level: 12, rarity: R, w: { charge: 1, intimidation: 1 }, description: 'Brise les heaumes comme les os.' },
  { id: 'arc-composite', name: 'Arc composite', level: 15, rarity: S, w: { precision: 3, embuscade: 1 }, power: 0.95, spread: 0.25, faction: 'sables', description: 'Corne, bois et tendon collés : il tire loin et fort.' },
  { id: 'epee-du-maitre', name: 'Épée du maître-forgeron', level: 18, rarity: L, w: { arme: 3, precision: 2, commandement: 1 }, dropOnly: true, description: 'Une lame dont on raconte qu’elle n’a jamais été brisée.' },
  { id: 'fauchon', name: 'Fauchon', level: 20, rarity: S, w: { charge: 1, arme: 1 }, spread: 0.4, description: 'Lame courte et lourde, élargie vers la pointe.' },
  { id: 'lance-de-cavalerie', name: 'Lance de cavalerie', level: 24, rarity: S, w: { charge: 2, commandement: 1 }, spread: 0.4, faction: 'aube', description: 'Longue lance couchée sous le bras pour la charge.' },
  { id: 'cimeterre', name: 'Cimeterre', level: 26, rarity: S, w: { precision: 1, esquive: 1, arme: 1 }, spread: 0.3, faction: 'sables', description: 'Lame courbe qui tranche en glissant.' },
  { id: 'hache-barbue', name: 'Hache barbue', level: 28, rarity: S, w: { intimidation: 1, charge: 1 }, spread: 0.45, faction: 'givre', description: 'Son fer recourbé accroche les boucliers et les arrache.' },
  { id: 'epieu-de-chasse', name: 'Épieu de chasse', level: 30, rarity: C, w: { precision: 1, embuscade: 1 }, description: 'Arrêté par sa traverse, il tient le sanglier à distance.' },
  { id: 'fleau-d-armes', name: "Fléau d'armes", level: 33, rarity: R, w: { intimidation: 2, charge: 1 }, spread: 0.5, description: 'Une boule de fer au bout d’une chaîne : imprévisible.' },
  { id: 'epee-batarde', name: 'Épée bâtarde', level: 38, rarity: R, w: { arme: 2, precision: 1 }, description: 'Se manie à une ou deux mains.' },
  { id: 'guisarme', name: 'Guisarme', level: 44, rarity: S, w: { fortification: 1, precision: 1, tactique: 1 }, description: 'Arme d’hast à crochet, idéale pour tenir une brèche.' },
  { id: 'marteau-de-guerre', name: 'Marteau de guerre', level: 50, rarity: R, w: { charge: 1, intimidation: 1, arme: 1 }, spread: 0.4, description: 'Un bec d’un côté, une tête de frappe de l’autre.' },
  { id: 'sabre-de-l-emir', name: "Sabre de l'émir", level: 56, rarity: R, w: { precision: 2, esquive: 1, commandement: 1 }, spread: 0.3, faction: 'sables', description: 'Fourreau d’argent et lame gravée de versets de poètes.' },
  { id: 'epee-de-l-aube', name: "Épée de l'Aube", level: 56, rarity: R, w: { arme: 1, commandement: 1, fortification: 1 }, faction: 'aube', description: 'Remise aux chevaliers qui ont prêté le grand serment.' },
  { id: 'hache-du-jarl', name: 'Hache du jarl', level: 56, rarity: R, w: { charge: 2, intimidation: 1, endurance: 1 }, spread: 0.45, faction: 'givre', description: 'Le fer est incrusté de fils d’argent tressés.' },
  { id: 'lance-du-connetable', name: 'Lance du connétable', level: 64, rarity: R, w: { commandement: 2, tactique: 1, precision: 1 }, description: 'On la lève pour lancer l’armée entière à l’assaut.' },
  { id: 'epee-longue-trempee', name: 'Épée longue trempée', level: 72, rarity: R, w: { arme: 2, precision: 2 }, description: 'Acier trempé trois fois, souple et dur à la fois.' },
  { id: 'masse-de-l-ost', name: "Masse de l'ost", level: 80, rarity: R, w: { charge: 1, commandement: 1, intimidation: 1 }, spread: 0.4, description: 'Arme de capitaine, autant bâton de commandement que masse.' },
  { id: 'epee-de-guerre', name: 'Épée de guerre', level: 86, rarity: S, w: { arme: 1, precision: 1, charge: 1 }, description: 'Longue lame à deux mains des grandes batailles.' },
  { id: 'lame-de-l-aurore', name: "Lame de l'aurore", level: 88, rarity: L, w: { arme: 2, precision: 1, commandement: 1 }, dropOnly: true, description: 'Son acier rosit au lever du jour.' },
  { id: 'hache-du-dernier-hiver', name: 'Hache du dernier hiver', level: 92, rarity: L, w: { charge: 2, intimidation: 1, endurance: 1 }, spread: 0.45, dropOnly: true, description: 'Le givre ne fond jamais sur son tranchant.' },
  { id: 'hache-de-bataille', name: 'Hache de bataille', level: 95, rarity: R, w: { charge: 2, arme: 1, intimidation: 1 }, spread: 0.45, description: 'Forgée pour fendre les rangs, fer et hommes ensemble.' },
  { id: 'epee-d-aldoria', name: "Épée d'Aldoria", level: 100, rarity: L, w: { arme: 2, precision: 1, commandement: 1, tactique: 1 }, dropOnly: true, description: 'L’épée des anciens rois, perdue dans les ruines du royaume.' },
];

const shields: Omit<ItemDef, 'slot'>[] = [
  { id: 'bouclier-rond', name: 'Bouclier rond en bois', level: 1, rarity: C, w: { fortification: 1 }, description: 'Planches de tilleul et umbo de fer.' },
  { id: 'targe-de-cuir', name: 'Targe de cuir', level: 4, rarity: C, w: { esquive: 1, fortification: 1 }, power: 0.85, faction: 'sables', description: 'Bouclier en cuir épais en forme de cœur, léger à la course.' },
  { id: 'bouclier-cercle', name: 'Bouclier cerclé de fer', level: 5, rarity: C, w: { fortification: 1 }, power: 1.15, faction: 'givre', description: 'Grand bouclier rond renforcé de fer sur le pourtour.' },
  { id: 'ecu-en-amande', name: 'Écu en amande', level: 6, rarity: S, w: { fortification: 2, resistance: 1 }, faction: 'aube', description: 'Long bouclier qui protège le cavalier de l’épaule au genou.' },
  { id: 'rondache', name: 'Rondache', level: 10, rarity: C, w: { esquive: 1, fortification: 1 }, description: 'Petit bouclier rond qu’on porte au poing.' },
  { id: 'ecu-au-lion', name: 'Écu peint au lion', level: 14, rarity: R, w: { fortification: 3, commandement: 2 }, description: 'Un écu de seigneur, que les hommes suivent dans la mêlée.' },
  { id: 'pavois', name: 'Pavois', level: 18, rarity: S, w: { fortification: 2, resistance: 1 }, power: 1.2, description: 'Grand bouclier rectangulaire derrière lequel on s’abrite.' },
  { id: 'bouclier-de-fer', name: 'Bouclier de fer', level: 23, rarity: S, w: { fortification: 1, endurance: 1 }, power: 1.1, description: 'Tôle de fer rivetée sur un cœur de chêne.' },
  { id: 'targe-a-pointe', name: 'Targe à pointe', level: 28, rarity: S, w: { esquive: 1, intimidation: 1 }, power: 0.9, faction: 'sables', description: 'Une pointe d’acier jaillit de son centre.' },
  { id: 'bouclier-au-corbeau', name: 'Bouclier au corbeau', level: 28, rarity: S, w: { fortification: 1, intimidation: 1 }, faction: 'givre', description: 'Le corbeau noir des clans peint sur fond bleu.' },
  { id: 'ecu-blasonne', name: 'Écu blasonné', level: 28, rarity: S, w: { fortification: 1, commandement: 1 }, faction: 'aube', description: 'Porte le soleil d’or de l’Ordre.' },
  { id: 'bouclier-de-cavalier', name: 'Bouclier de cavalier', level: 34, rarity: R, w: { esquive: 1, charge: 1, fortification: 1 }, description: 'Plus court, pour combattre en selle.' },
  { id: 'grand-pavois', name: 'Grand pavois', level: 42, rarity: S, w: { fortification: 3, endurance: 1 }, power: 1.25, description: 'Un mur de bois et de cuir qu’on plante dans le sol.' },
  { id: 'bouclier-d-acier', name: "Bouclier d'acier", level: 50, rarity: R, w: { fortification: 2, resistance: 1 }, description: 'Une seule pièce d’acier battu, rare et coûteuse.' },
  { id: 'targe-damasquinee', name: 'Targe damasquinée', level: 58, rarity: R, w: { esquive: 2, tactique: 1 }, power: 0.9, faction: 'sables', description: 'Acier moiré et fils d’or, un bouclier de prince.' },
  { id: 'bouclier-du-jarl', name: 'Bouclier du jarl', level: 58, rarity: R, w: { fortification: 2, intimidation: 1 }, power: 1.1, faction: 'givre', description: 'Cerclé d’argent, il a vu cent batailles.' },
  { id: 'ecu-du-seneschal', name: 'Écu du sénéchal', level: 58, rarity: R, w: { fortification: 2, commandement: 1 }, faction: 'aube', description: 'Celui qui le porte parle au nom du grand maître.' },
  { id: 'pavois-de-siege', name: 'Pavois de siège', level: 68, rarity: R, w: { fortification: 3, tactique: 1, resistance: 1 }, power: 1.2, description: 'Conçu pour approcher des murailles sous les flèches.' },
  { id: 'bouclier-de-la-garde', name: 'Bouclier de la garde', level: 78, rarity: R, w: { fortification: 2, commandement: 1, resistance: 1 }, description: 'Celui des gardes du corps des seigneurs.' },
  { id: 'bouclier-de-bataille', name: 'Bouclier de bataille', level: 86, rarity: S, w: { fortification: 2, endurance: 1 }, description: 'Lourd, cabossé, mille fois réparé.' },
  { id: 'egide-des-ruines', name: 'Égide des ruines', level: 88, rarity: L, w: { fortification: 2, resistance: 1, tactique: 1 }, dropOnly: true, description: 'Un bouclier si ancien que nul ne sait qui l’a forgé.' },
  { id: 'ecu-de-l-ost', name: "Écu de l'ost", level: 95, rarity: R, w: { fortification: 2, commandement: 1, tactique: 1 }, description: 'Les capitaines s’en servent pour rallier les leurs.' },
  { id: 'bouclier-d-aldoria', name: "Bouclier d'Aldoria", level: 100, rarity: L, w: { fortification: 2, commandement: 1, resistance: 1, esquive: 1 }, dropOnly: true, description: 'Le bouclier des anciens rois, aux armes du royaume perdu.' },
];

const helmets: Omit<ItemDef, 'slot'>[] = [
  { id: 'bonnet-de-cuir', name: 'Bonnet de cuir', level: 1, rarity: C, w: { resistance: 1 }, description: 'Cuir bouilli rembourré de laine.' },
  { id: 'spangenhelm', name: 'Casque à bandes', level: 3, rarity: C, w: { resistance: 1 }, description: 'Plaques de fer rivetées sur une armature.' },
  { id: 'casque-a-nasal', name: 'Casque à nasal', level: 6, rarity: S, w: { resistance: 1, tactique: 1 }, description: 'Casque conique d’une seule pièce, avec sa barre nasale.' },
  { id: 'camail', name: 'Camail de mailles', level: 9, rarity: S, w: { resistance: 2 }, description: 'Capuche de mailles qui protège la nuque et la gorge.' },
  { id: 'heaume-a-lunettes', name: 'Casque à lunettes', level: 13, rarity: R, w: { resistance: 1, intimidation: 1 }, description: 'Masque de fer autour des yeux, terrifiant dans la mêlée.' },
  { id: 'chapel-de-fer', name: 'Chapel de fer', level: 16, rarity: C, w: { resistance: 1, tactique: 1 }, description: 'Large bord qui protège des coups venus d’en haut.' },
  { id: 'casque-a-turban', name: 'Casque à turban', level: 18, rarity: S, w: { esquive: 1, resistance: 1 }, faction: 'sables', description: 'Casque pointu enroulé d’un turban contre le soleil.' },
  { id: 'casque-du-nord', name: 'Casque du Nord', level: 18, rarity: S, w: { intimidation: 1, endurance: 1 }, faction: 'givre', description: 'Fer noirci et garde-joues de cuir.' },
  { id: 'casque-de-sergent', name: 'Casque de sergent', level: 18, rarity: S, w: { commandement: 1, resistance: 1 }, faction: 'aube', description: 'Le casque des sous-officiers de l’Ordre, peint d’un liseré d’or.' },
  { id: 'casque-a-aventail', name: 'Casque à aventail', level: 24, rarity: S, w: { resistance: 2, fortification: 1 }, description: 'Un rideau de mailles tombe du casque sur les épaules.' },
  { id: 'heaume-cylindrique', name: 'Heaume cylindrique', level: 30, rarity: R, w: { resistance: 2, fortification: 1 }, power: 1.15, description: 'Fermé de toutes parts, percé de deux fentes.' },
  { id: 'casque-a-masque', name: 'Casque à masque', level: 36, rarity: R, w: { intimidation: 2, resistance: 1 }, description: 'Un visage de fer impassible.' },
  { id: 'camail-double', name: 'Camail double', level: 42, rarity: S, w: { resistance: 2, endurance: 1 }, description: 'Deux épaisseurs de mailles, lourdes mais sûres.' },
  { id: 'casque-de-l-emir', name: "Casque de l'émir", level: 52, rarity: R, w: { commandement: 1, esquive: 1, tactique: 1 }, faction: 'sables', description: 'Ciselé d’arabesques et surmonté d’un plumet.' },
  { id: 'casque-du-jarl', name: 'Casque du jarl', level: 52, rarity: R, w: { intimidation: 2, commandement: 1 }, faction: 'givre', description: 'Garni d’une crinière de cheval noire.' },
  { id: 'heaume-du-commandeur', name: 'Heaume du commandeur', level: 52, rarity: R, w: { commandement: 2, resistance: 1 }, faction: 'aube', description: 'Une couronne de lauriers d’or ceint le timbre.' },
  { id: 'casque-de-guet', name: 'Casque de guet', level: 60, rarity: S, w: { tactique: 1, precision: 1 }, description: 'Ouvert sur le visage pour bien voir venir l’ennemi.' },
  { id: 'bassinet', name: 'Bassinet', level: 66, rarity: R, w: { resistance: 2, esquive: 1 }, description: 'Casque arrondi qui épouse le crâne et fait glisser les coups.' },
  { id: 'heaume-a-cimier', name: 'Heaume à cimier', level: 76, rarity: R, w: { commandement: 1, intimidation: 1, resistance: 1 }, description: 'Son cimier se voit de loin sur le champ de bataille.' },
  { id: 'casque-de-veteran', name: 'Casque de vétéran', level: 84, rarity: S, w: { resistance: 1, tactique: 1, endurance: 1 }, description: 'Couvert de bosses, chacune avec son histoire.' },
  { id: 'couronne-de-fer', name: 'Couronne de fer', level: 86, rarity: L, w: { commandement: 2, tactique: 1, resistance: 1 }, dropOnly: true, description: 'Un casque-couronne forgé pour un roi de guerre.' },
  { id: 'grand-heaume', name: 'Grand heaume', level: 95, rarity: R, w: { resistance: 2, intimidation: 1, fortification: 1 }, power: 1.1, description: 'Un heaume de tournoi renforcé pour la guerre.' },
  { id: 'heaume-d-aldoria', name: "Heaume d'Aldoria", level: 100, rarity: L, w: { resistance: 2, commandement: 1, intimidation: 1 }, dropOnly: true, description: 'Le heaume des anciens rois, frappé de l’étoile du royaume.' },
];

const armors: Omit<ItemDef, 'slot'>[] = [
  { id: 'gambison', name: 'Gambison matelassé', level: 1, rarity: C, w: { endurance: 1 }, price: 50, description: 'Plusieurs couches de lin piquées ensemble.' },
  { id: 'broigne', name: 'Broigne', level: 4, rarity: C, w: { resistance: 1 }, description: 'Cuir épais semé d’anneaux de fer.' },
  { id: 'cotte-courte', name: 'Cotte de mailles courte', level: 7, rarity: S, w: { resistance: 2 }, description: 'Mailles rivetées jusqu’à la taille.' },
  { id: 'jaseran', name: 'Jaseran', level: 10, rarity: R, w: { resistance: 2, esquive: 1 }, power: 0.85, faction: 'sables', description: 'Fine maille cachée entre deux étoffes de soie.' },
  { id: 'haubert', name: 'Haubert long', level: 11, rarity: R, w: { resistance: 3, fortification: 1 }, power: 1.1, description: 'Maille jusqu’aux genoux, fendue pour monter à cheval.' },
  { id: 'jaque-de-cuir', name: 'Jaque de cuir', level: 14, rarity: C, w: { esquive: 1, embuscade: 1 }, power: 0.8, description: 'Léger et silencieux, pour ceux qui frappent les premiers.' },
  { id: 'lamellaire', name: 'Cuirasse lamellaire', level: 18, rarity: S, w: { resistance: 1, esquive: 1 }, faction: 'sables', description: 'Des centaines de lamelles lacées de soie.' },
  { id: 'broigne-a-ecailles', name: 'Broigne à écailles', level: 20, rarity: S, w: { resistance: 1, endurance: 1 }, description: 'Écailles de fer cousues comme une peau de poisson.' },
  { id: 'cotte-des-clans', name: 'Cotte des clans', level: 20, rarity: S, w: { endurance: 1, intimidation: 1 }, faction: 'givre', description: 'Maille épaisse sous une peau d’ours.' },
  { id: 'haubert-blasonne', name: "Haubert sous cotte d'armes", level: 20, rarity: S, w: { resistance: 1, commandement: 1 }, faction: 'aube', description: 'Le soleil d’or brodé sur la poitrine.' },
  { id: 'cotte-de-plates', name: 'Cotte de plates', level: 30, rarity: R, w: { resistance: 2, fortification: 1 }, power: 1.15, description: 'Plaques de fer rivetées sous une toile.' },
  { id: 'haubert-double', name: 'Haubert double', level: 36, rarity: R, w: { resistance: 2, endurance: 1 }, power: 1.1, description: 'Deux couches de mailles : on ne passe pas.' },
  { id: 'kazaghand', name: 'Kazaghand', level: 44, rarity: R, w: { esquive: 1, resistance: 1, embuscade: 1 }, power: 0.95, faction: 'sables', description: 'Maille cachée entre deux étoffes matelassées et brodées.' },
  { id: 'manteau-de-loup', name: 'Manteau de loup', level: 44, rarity: R, w: { intimidation: 1, endurance: 1, recuperation: 1 }, faction: 'givre', description: 'Haubert couvert d’une peau de grand loup blanc.' },
  { id: 'surcot-de-l-ordre', name: "Surcot de l'Ordre", level: 44, rarity: R, w: { commandement: 1, resistance: 1, fortification: 1 }, faction: 'aube', description: 'Maille fine sous un surcot blanc et or.' },
  { id: 'brigandine', name: 'Brigandine', level: 55, rarity: R, w: { resistance: 1, esquive: 1, endurance: 1 }, description: 'Plaques cachées dans un pourpoint de velours.' },
  { id: 'lamellaire-lourde', name: 'Armure lamellaire lourde', level: 64, rarity: R, w: { resistance: 2, fortification: 1 }, power: 1.15, description: 'Lamelles d’acier du cou jusqu’aux cuisses.' },
  { id: 'haubert-de-maitre', name: 'Haubert de maître', level: 72, rarity: R, w: { resistance: 2, recuperation: 1, tactique: 1 }, description: 'Chaque anneau est riveté à la main, sans une faute.' },
  { id: 'haubert-de-bataille', name: 'Haubert de bataille', level: 80, rarity: S, w: { resistance: 1, endurance: 1, fortification: 1 }, power: 1.05, description: 'Maille épaisse renforcée de plaques aux épaules.' },
  { id: 'cotte-des-rois', name: 'Cotte des rois', level: 85, rarity: L, w: { resistance: 2, commandement: 1, endurance: 1 }, dropOnly: true, description: 'Mailles d’argent et plaques d’or, dignes d’un souverain.' },
  { id: 'armure-de-plates', name: 'Armure de plates', level: 94, rarity: R, w: { resistance: 2, fortification: 1, endurance: 1 }, power: 1.15, description: 'Des plaques d’acier articulées couvrent tout le corps.' },
  { id: 'armure-d-aldoria', name: "Armure d'Aldoria", level: 100, rarity: L, w: { resistance: 2, fortification: 1, endurance: 1, recuperation: 1 }, dropOnly: true, description: 'L’armure des anciens rois, qu’aucune lame n’a percée.' },
];

const boots: Omit<ItemDef, 'slot'>[] = [
  { id: 'chausses-de-laine', name: 'Chausses de laine', level: 1, rarity: C, w: { recuperation: 1 }, price: 20, description: 'Bandes molletières et chausses chaudes.' },
  { id: 'bottes-de-cuir', name: 'Bottes de cuir', level: 3, rarity: C, w: { esquive: 1 }, description: 'Cuir de bœuf cousu main.' },
  { id: 'sandales-de-marche', name: 'Sandales de marche', level: 5, rarity: C, w: { recuperation: 1, esquive: 1 }, power: 0.7, faction: 'sables', description: 'Semelles épaisses pour le sable brûlant.' },
  { id: 'bottes-fourrees', name: 'Bottes fourrées', level: 5, rarity: C, w: { endurance: 1, recuperation: 1 }, faction: 'givre', description: 'Peau de phoque doublée de laine.' },
  { id: 'bottes-de-cavalier', name: 'Bottes de cavalier', level: 7, rarity: S, w: { charge: 1, embuscade: 1 }, description: 'Hautes bottes à éperons de fer.' },
  { id: 'guetres-de-cuir', name: 'Guêtres de cuir', level: 10, rarity: C, w: { esquive: 1, endurance: 1 }, description: 'Lacées du genou à la cheville.' },
  { id: 'chausses-de-mailles', name: 'Chausses de mailles', level: 12, rarity: R, w: { resistance: 1, fortification: 2 }, description: 'Mailles lacées sur toute la jambe.' },
  { id: 'bottes-a-eperons', name: "Bottes à éperons d'or", level: 16, rarity: S, w: { charge: 1, commandement: 1 }, faction: 'aube', description: 'Les éperons dorés du chevalier adoubé.' },
  { id: 'bottes-renforcees', name: 'Bottes renforcées', level: 22, rarity: S, w: { resistance: 1, charge: 1 }, description: 'Bandes de fer cousues sur le cuir.' },
  { id: 'jambieres-de-fer', name: 'Jambières de fer', level: 30, rarity: S, w: { fortification: 1, resistance: 1 }, power: 1.15, description: 'Plaques de fer sur les tibias.' },
  { id: 'bottes-du-coureur', name: 'Bottes du coureur des sables', level: 34, rarity: R, w: { esquive: 2, embuscade: 1 }, power: 0.8, faction: 'sables', description: 'On dit qu’elles ne laissent pas de traces.' },
  { id: 'bottes-du-traqueur', name: 'Bottes du traqueur', level: 34, rarity: R, w: { embuscade: 2, endurance: 1 }, faction: 'givre', description: 'Pour suivre une proie trois jours dans la neige.' },
  { id: 'solerets', name: 'Solerets', level: 45, rarity: R, w: { resistance: 1, fortification: 1, charge: 1 }, power: 1.1, description: 'Chaussures articulées de lamelles d’acier.' },
  { id: 'chausses-doublees', name: 'Chausses doublées', level: 54, rarity: S, w: { resistance: 1, recuperation: 1 }, description: 'Mailles sur cuir sur laine : chaudes et sûres.' },
  { id: 'greves-d-acier', name: "Grèves d'acier", level: 64, rarity: R, w: { fortification: 2, resistance: 1 }, power: 1.15, description: 'Protègent toute la jambe sous le genou.' },
  { id: 'bottes-du-pelerin', name: 'Bottes du pèlerin', level: 74, rarity: R, w: { recuperation: 2, resistance: 1 }, description: 'Elles ont fait le tour du royaume, et plus encore.' },
  { id: 'bottes-de-campagne', name: 'Bottes de campagne', level: 82, rarity: S, w: { endurance: 1, recuperation: 1, esquive: 1 }, description: 'Elles ont traversé trois guerres sans prendre l’eau.' },
  { id: 'bottes-de-l-errant', name: "Bottes de l'errant", level: 84, rarity: L, w: { esquive: 2, embuscade: 1, recuperation: 1 }, dropOnly: true, description: 'Celui qui les chausse ne se perd jamais.' },
  { id: 'greves-de-maitre', name: 'Grèves de maître', level: 94, rarity: R, w: { fortification: 1, resistance: 1, charge: 1 }, power: 1.15, description: 'Acier poli, articulé au genou et à la cheville.' },
  { id: 'solerets-d-aldoria', name: "Solerets d'Aldoria", level: 100, rarity: L, w: { fortification: 1, resistance: 1, charge: 1, esquive: 1 }, dropOnly: true, description: 'Les solerets des anciens rois, légers comme le cuir.' },
];

const rings: Omit<ItemDef, 'slot'>[] = [
  { id: 'anneau-de-cuivre', name: 'Anneau de cuivre', level: 2, rarity: C, w: { recuperation: 1 }, description: 'Un simple anneau, porte-bonheur du voyageur.' },
  { id: 'anneau-de-fer', name: 'Anneau de fer', level: 3, rarity: C, w: { endurance: 1 }, description: 'Forgé dans un clou de fer à cheval.' },
  { id: 'anneau-d-argent', name: "Anneau d'argent", level: 5, rarity: S, w: { tactique: 1, precision: 1 }, description: 'Gravé d’un serment oublié.' },
  { id: 'anneau-d-os', name: "Anneau d'os", level: 8, rarity: S, w: { intimidation: 1, recuperation: 1 }, faction: 'givre', description: 'Taillé dans un os de baleine et gravé de runes.' },
  { id: 'anneau-de-cornaline', name: 'Anneau de cornaline', level: 8, rarity: S, w: { precision: 1, esquive: 1 }, faction: 'sables', description: 'Une pierre rouge qui, dit-on, détourne les flèches.' },
  { id: 'anneau-solaire', name: 'Anneau solaire', level: 8, rarity: S, w: { fortification: 1, tactique: 1 }, faction: 'aube', description: 'Un petit soleil d’or ciselé.' },
  { id: 'chevaliere-d-or', name: "Chevalière d'or", level: 9, rarity: R, w: { commandement: 2, intimidation: 1 }, description: 'Le sceau d’une maison noble.' },
  { id: 'anneau-de-saphir', name: 'Anneau de saphir', level: 15, rarity: L, w: { tactique: 2, esquive: 2, recuperation: 1 }, dropOnly: true, description: 'Une pierre bleue comme la mer d’Aldoria.' },
  { id: 'anneau-de-jade', name: 'Anneau de jade', level: 20, rarity: S, w: { recuperation: 2 }, description: 'Venu de très loin à l’est, par les caravanes.' },
  { id: 'anneau-du-veteran', name: 'Anneau du vétéran', level: 26, rarity: S, w: { arme: 1, endurance: 1 }, description: 'Offert aux soldats après dix campagnes.' },
  { id: 'anneau-d-ambre', name: "Anneau d'ambre", level: 32, rarity: S, w: { resistance: 1, tactique: 1 }, description: 'Un insecte est pris dans la pierre depuis mille ans.' },
  { id: 'anneau-de-rubis', name: 'Anneau de rubis', level: 40, rarity: R, w: { charge: 1, arme: 1 }, description: 'Rouge sang, il échauffe le courage.' },
  { id: 'sceau-du-capitaine', name: 'Sceau du capitaine', level: 48, rarity: R, w: { commandement: 2, tactique: 1 }, description: 'Ses ordres scellés de cet anneau ne se discutent pas.' },
  { id: 'anneau-d-emeraude', name: "Anneau d'émeraude", level: 56, rarity: R, w: { embuscade: 1, esquive: 1, precision: 1 }, description: 'Vert comme la forêt où l’on attend sa proie.' },
  { id: 'anneau-du-loup', name: 'Anneau du loup', level: 64, rarity: R, w: { intimidation: 1, charge: 1, endurance: 1 }, description: 'Deux têtes de loup se mordent la queue.' },
  { id: 'anneau-du-chancelier', name: 'Anneau du chancelier', level: 72, rarity: R, w: { tactique: 1, commandement: 1, recuperation: 1 }, description: 'Celui qui le porte a l’oreille du souverain.' },
  { id: 'anneau-de-l-aigle', name: "Anneau de l'aigle", level: 82, rarity: S, w: { precision: 1, tactique: 1, embuscade: 1 }, description: 'Un aigle d’or aux yeux de grenat.' },
  { id: 'anneau-des-ruines', name: 'Anneau des ruines', level: 82, rarity: L, w: { precision: 1, esquive: 1, arme: 1, recuperation: 1 }, dropOnly: true, description: 'Trouvé au doigt d’un squelette, dans la salle du trône.' },
  { id: 'anneau-de-diamant', name: 'Anneau de diamant', level: 94, rarity: R, w: { arme: 1, commandement: 1, resistance: 1 }, description: 'La pierre la plus dure du monde, pour la main la plus ferme.' },
  { id: 'anneau-d-aldoria', name: "Anneau d'Aldoria", level: 100, rarity: L, w: { commandement: 1, tactique: 1, precision: 1, resistance: 1 }, dropOnly: true, description: 'L’anneau des anciens rois. Il est tiède au toucher.' },
];

function build(slot: Slot, d: Omit<ItemDef, 'slot'>): ItemInfo {
  const item: ItemInfo = {
    id: d.id,
    name: d.name,
    slot,
    level: d.level,
    price: d.price ?? itemPrice(d.level, d.rarity),
    rarity: d.rarity,
    bonuses: Object.keys(d.w).length ? spreadPoints(itemBonusBudget(d.level, d.rarity), d.w) : {},
    description: d.description,
  };
  if (slot === 'arme') item.damage = weaponDamage(d.level, d.rarity, d.power, d.spread);
  else if (slot !== 'anneau') item.armor = slotArmor(slot, d.level, d.rarity, d.power);
  if (d.faction) item.faction = d.faction;
  if (d.dropOnly) item.dropOnly = true;
  return item;
}

const items: ItemInfo[] = [
  ...weapons.map((d) => build('arme', d)),
  ...shields.map((d) => build('bouclier', d)),
  ...helmets.map((d) => build('tete', d)),
  ...armors.map((d) => build('corps', d)),
  ...boots.map((d) => build('pieds', d)),
  ...rings.map((d) => build('anneau', d)),
];

export const ITEMS: Record<string, ItemInfo> = Object.fromEntries(items.map((i) => [i.id, i]));
export const ITEM_LIST = items;
export const STARTING_ITEMS = ['baton-ferre', 'gambison', 'chausses-de-laine'];
