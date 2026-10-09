import type { Skill } from './skills';

export interface JobInfo {
  id: string;
  name: string;
  description: string;
  /** Compétences additionnées pour savoir si le personnage sait faire ce travail. */
  skills: Skill[];
  /** Points de travail nécessaires (somme des compétences ci-dessus + équipement). */
  required: number;
  goldPerHour: number;
  xpPerHour: number;
  /** Honneur gagné par heure de travail (services rendus à la faction). */
  honorPerHour: number;
}

export const JOBS: JobInfo[] = [
  { id: 'troupeaux', name: 'Garder les troupeaux', description: 'Mener les bêtes aux pâturages et les ramener avant la nuit.', skills: ['recuperation', 'tactique'], required: 0, goldPerHour: 10, xpPerHour: 6, honorPerHour: 0 },
  { id: 'bucheron', name: 'Bûcheronner', description: 'Abattre du bois pour les palissades et les feux du camp.', skills: ['charge', 'endurance'], required: 3, goldPerHour: 14, xpPerHour: 8, honorPerHour: 0 },
  { id: 'pelerins', name: 'Escorter des pèlerins', description: 'Protéger les voyageurs sur la route de Sélénar.', skills: ['precision', 'tactique', 'intimidation'], required: 7, goldPerHour: 16, xpPerHour: 10, honorPerHour: 1 },
  { id: 'forge', name: 'Aider le forgeron', description: 'Tirer le soufflet et battre le fer rouge.', skills: ['arme', 'endurance'], required: 10, goldPerHour: 22, xpPerHour: 11, honorPerHour: 0 },
  { id: 'remparts', name: 'Garder les remparts', description: 'Veiller sur les murailles de la capitale.', skills: ['fortification', 'tactique'], required: 14, goldPerHour: 24, xpPerHour: 13, honorPerHour: 1 },
  { id: 'caravane', name: 'Escorter une caravane', description: 'Accompagner épices et soieries à travers le désert.', skills: ['precision', 'embuscade', 'resistance'], required: 20, goldPerHour: 34, xpPerHour: 15, honorPerHour: 0 },
  { id: 'eclaireur', name: "Éclairer l'armée", description: 'Partir en avant pour repérer les troupes ennemies.', skills: ['embuscade', 'esquive'], required: 26, goldPerHour: 38, xpPerHour: 19, honorPerHour: 1 },
  { id: 'recrues', name: 'Entraîner les recrues', description: 'Apprendre aux jeunes à tenir le bouclier et la lance.', skills: ['commandement', 'arme'], required: 34, goldPerHour: 44, xpPerHour: 22, honorPerHour: 2 },
  { id: 'brigands', name: 'Traquer les brigands', description: 'Débarrasser les routes des coupe-jarrets.', skills: ['precision', 'charge', 'intimidation'], required: 42, goldPerHour: 55, xpPerHour: 26, honorPerHour: 2 },
  { id: 'ambassade', name: 'Mener une ambassade', description: 'Négocier une trêve ou un passage avec un seigneur voisin.', skills: ['commandement', 'tactique', 'intimidation'], required: 55, goldPerHour: 70, xpPerHour: 32, honorPerHour: 3 },
];

export const JOB_BY_ID: Record<string, JobInfo> = Object.fromEntries(JOBS.map((j) => [j.id, j]));

/** Durées de travail proposées, en minutes de jeu (divisées par la vitesse du monde). */
export const WORK_DURATIONS = [15, 60, 240, 480];
