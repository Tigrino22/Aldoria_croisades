export const FACTIONS = ['aube', 'sables', 'givre'] as const;
export type Faction = (typeof FACTIONS)[number];

export interface FactionInfo {
  id: Faction;
  name: string;
  short: string;
  inspiration: string;
  color: string;
  capital: string;
  /** Territoire de départ de la capitale, qui ne peut pas être pris. */
  capitalTerritory: string;
  bonus: string;
  /** Rangs de faction, du niveau 1 au niveau maximum. */
  ranks: string[];
  lore: string;
}

export const FACTION_INFO: Record<Faction, FactionInfo> = {
  aube: {
    id: 'aube',
    name: "L'Ordre de l'Aube",
    short: 'Aube',
    inspiration: 'chevaliers croisés',
    color: '#d8b453',
    capital: 'Fort-Lumière',
    capitalTerritory: 'clairval',
    bonus: '+5 % de défense',
    ranks: ['Pèlerin', 'Écuyer', 'Sergent', 'Chevalier', 'Chevalier banneret', 'Commandeur', 'Grand-maître'],
    lore: "Venus d'outre-mer sous la bannière du soleil levant, les chevaliers de l'Aube ont juré de reprendre Sélénar, la Cité Sainte.",
  },
  sables: {
    id: 'sables',
    name: 'Le Califat des Sables',
    short: 'Sables',
    inspiration: 'armées sarrasines',
    color: '#3f8f5a',
    capital: 'Qasr al-Nour',
    capitalTerritory: 'al-rimal',
    bonus: '+5 % d’initiative',
    ranks: ['Recrue', 'Cavalier', 'Faris', 'Naqib', 'Qa’id', 'Atabeg', 'Émir'],
    lore: 'Maîtres des oasis et des routes caravanières, les cavaliers du Califat défendent la terre de leurs pères contre les envahisseurs.',
  },
  givre: {
    id: 'givre',
    name: 'Les Clans du Givre',
    short: 'Givre',
    inspiration: 'tribus païennes du Nord',
    color: '#5b7fb0',
    capital: 'Hrafnborg',
    capitalTerritory: 'hrafnborg',
    bonus: '+5 % de butin de pillage',
    ranks: ['Thrall', 'Karl', 'Drengr', 'Huscarl', 'Hersir', 'Jarl', 'Roi des clans'],
    lore: 'Descendus des fjords sur leurs longs navires, les Clans du Givre ne servent que leurs anciens dieux et le butin.',
  },
};
