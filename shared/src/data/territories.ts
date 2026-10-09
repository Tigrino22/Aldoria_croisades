import type { Faction } from './factions';
import geometry from './map-geometry.json';

export interface TerritoryInfo {
  id: string;
  name: string;
  /** Nom court affiché sur la carte. */
  label: string;
  description: string;
  /** Faction qui possède le territoire au début du monde (null = libre). */
  startOwner: Faction | null;
  /** Une capitale ne peut jamais être prise. */
  capital: boolean;
  neighbors: string[];
  center: [number, number];
}

const META: Record<string, Omit<TerritoryInfo, 'id' | 'neighbors' | 'center'>> = {
  clairval: { name: 'Marche de Clairval', label: 'Clairval', description: 'Plaine fortifiée autour de Fort-Lumière.', startOwner: 'aube', capital: true },
  ostrevent: { name: "Comté d'Ostrevent", label: 'Ostrevent', description: 'Collines venteuses et abbayes.', startOwner: 'aube', capital: false },
  'saint-aubin': { name: 'Val-Saint-Aubin', label: 'Saint-Aubin', description: 'Vallée fertile au bord de la mer intérieure.', startOwner: 'aube', capital: false },
  'al-rimal': { name: 'Oasis d’Al-Rimal', label: 'Al-Rimal', description: 'Palmeraies et citadelle de Qasr al-Nour.', startOwner: 'sables', capital: true },
  zahran: { name: 'Émirat de Zahrân', label: 'Zahrân', description: 'Steppes sèches et routes caravanières.', startOwner: 'sables', capital: false },
  palmes: { name: 'Côte des Palmes', label: 'Côte des Palmes', description: 'Ports marchands sur la mer de l’Est.', startOwner: 'sables', capital: false },
  hrafnborg: { name: 'Jarldom de Hrafnborg', label: 'Hrafnborg', description: 'Halles de bois et fjords gelés.', startOwner: 'givre', capital: true },
  isvik: { name: "Fjords d'Isvik", label: 'Isvik', description: 'Falaises noires et longs navires.', startOwner: 'givre', capital: false },
  myrkvid: { name: 'Forêt de Myrkvid', label: 'Myrkvid', description: 'Forêt profonde des anciens dieux.', startOwner: 'givre', capital: false },
  selenar: { name: 'Sélénar, la Cité Sainte', label: 'Sélénar', description: 'Le cœur d’Aldoria, que tous revendiquent.', startOwner: null, capital: false },
  berenice: { name: 'Gué de Bérénice', label: 'Bérénice', description: 'Seul passage du fleuve à l’ouest.', startOwner: null, capital: false },
  corbeaux: { name: 'Défilé des Corbeaux', label: 'Les Corbeaux', description: 'Col étroit entre désert et montagnes.', startOwner: null, capital: false },
};

const geo = geometry as unknown as {
  width: number;
  height: number;
  coast: [number, number][];
  territories: Record<string, { polygon: [number, number][]; center: [number, number]; neighbors: string[] }>;
};

export const MAP_WIDTH = geo.width;
export const MAP_HEIGHT = geo.height;
export const MAP_COAST = geo.coast;

export const TERRITORIES: Record<string, TerritoryInfo & { polygon: [number, number][] }> = Object.fromEntries(
  Object.entries(META).map(([id, m]) => {
    const g = geo.territories[id]!;
    return [id, { id, ...m, neighbors: g.neighbors, center: g.center, polygon: g.polygon }];
  }),
);

export const TERRITORY_IDS = Object.keys(TERRITORIES);
