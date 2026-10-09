import { jobGoldPerHour, jobXpPerHour } from '../balance';
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

/**
 * Chaque travail est pensé pour un niveau : un personnage équilibré de ce niveau, correctement équipé,
 * a tout juste les points requis. Les gains de base suivent jobXpPerHour / jobGoldPerHour (balance.ts),
 * légèrement modulés selon le métier (plus d'or, plus d'expérience ou plus d'honneur).
 */
interface JobDef {
  id: string;
  name: string;
  description: string;
  skills: Skill[];
  level: number;
  gold?: number;
  xp?: number;
  honor?: number;
}

const DEFS: JobDef[] = [
  { id: 'troupeaux', name: 'Garder les troupeaux', description: 'Mener les bêtes aux pâturages et les ramener avant la nuit.', skills: ['recuperation', 'tactique'], level: 1 },
  { id: 'bucheron', name: 'Bûcheronner', description: 'Abattre du bois pour les palissades et les feux du camp.', skills: ['charge', 'endurance'], level: 3, gold: 1.1 },
  { id: 'pelerins', name: 'Escorter des pèlerins', description: 'Protéger les voyageurs sur la route de Sélénar.', skills: ['precision', 'tactique', 'intimidation'], level: 6, honor: 1 },
  { id: 'forge', name: 'Aider le forgeron', description: 'Tirer le soufflet et battre le fer rouge.', skills: ['arme', 'endurance'], level: 9, gold: 1.15, xp: 0.95 },
  { id: 'remparts', name: 'Garder les remparts', description: 'Veiller sur les murailles de la capitale.', skills: ['fortification', 'tactique'], level: 12, honor: 1 },
  { id: 'caravane', name: 'Escorter une caravane', description: 'Accompagner épices et soieries à travers le désert.', skills: ['precision', 'embuscade', 'resistance'], level: 16, gold: 1.2, xp: 0.9 },
  { id: 'eclaireur', name: "Éclairer l'armée", description: 'Partir en avant pour repérer les troupes ennemies.', skills: ['embuscade', 'esquive'], level: 20, xp: 1.1, honor: 1 },
  { id: 'recrues', name: 'Entraîner les recrues', description: 'Apprendre aux jeunes à tenir le bouclier et la lance.', skills: ['commandement', 'arme'], level: 25, xp: 1.1, honor: 2 },
  { id: 'brigands', name: 'Traquer les brigands', description: 'Débarrasser les routes des coupe-jarrets.', skills: ['precision', 'charge', 'intimidation'], level: 30, honor: 2 },
  { id: 'ambassade', name: 'Mener une ambassade', description: 'Négocier une trêve ou un passage avec un seigneur voisin.', skills: ['commandement', 'tactique', 'intimidation'], level: 35, gold: 1.1, honor: 3 },
  { id: 'chantier', name: 'Diriger un chantier de fortification', description: 'Faire creuser les fossés et dresser les tours d’un nouveau fort.', skills: ['fortification', 'commandement'], level: 40, gold: 1.15 },
  { id: 'percepteur', name: 'Lever les impôts', description: 'Faire rentrer le tribut des villages, sans se faire détrousser.', skills: ['intimidation', 'tactique', 'resistance'], level: 46, gold: 1.3, xp: 0.85 },
  { id: 'frontiere', name: 'Tenir un poste-frontière', description: 'Surveiller les gués et les cols face aux autres bannières.', skills: ['fortification', 'precision', 'endurance'], level: 52, honor: 3 },
  { id: 'cavalerie', name: 'Mener une patrouille de cavalerie', description: 'Battre la campagne à la tête d’une dizaine de cavaliers.', skills: ['charge', 'commandement'], level: 58, xp: 1.1 },
  { id: 'espion', name: 'Espionner les camps ennemis', description: 'Se glisser la nuit parmi les tentes adverses.', skills: ['embuscade', 'esquive', 'tactique'], level: 64, xp: 1.15, gold: 0.9 },
  { id: 'convoi', name: 'Protéger le trésor de guerre', description: 'Escorter les coffres de la bannière jusqu’à la capitale.', skills: ['resistance', 'fortification', 'precision'], level: 70, gold: 1.25, honor: 2 },
  { id: 'maitre-d-armes', name: "Être maître d'armes", description: 'Former les chevaliers et les champions de la bannière.', skills: ['arme', 'precision', 'commandement'], level: 77, xp: 1.1, honor: 3 },
  { id: 'siege', name: 'Conduire un siège', description: 'Faire monter les tours et battre les murailles au bélier.', skills: ['tactique', 'commandement', 'endurance'], level: 84, honor: 4 },
  { id: 'conseil', name: 'Siéger au conseil de guerre', description: 'Décider avec les seigneurs de la prochaine campagne.', skills: ['tactique', 'commandement'], level: 92, gold: 1.2, honor: 5 },
  { id: 'ruines', name: 'Explorer les ruines du royaume', description: 'Descendre dans les salles oubliées des anciens rois.', skills: ['esquive', 'resistance', 'embuscade', 'recuperation'], level: 100, xp: 1.2, gold: 1.2 },
];

/** Points de travail d'un personnage équilibré et équipé de ce niveau, par compétence. */
const pointsPerSkill = (level: number) => 0.55 * level + 1;

export const JOBS: JobInfo[] = DEFS.map((d) => ({
  id: d.id,
  name: d.name,
  description: d.description,
  skills: d.skills,
  required: d.level <= 1 ? 0 : Math.round(d.skills.length * pointsPerSkill(d.level)),
  goldPerHour: Math.round(jobGoldPerHour(d.level) * (d.gold ?? 1)),
  xpPerHour: Math.round(jobXpPerHour(d.level) * (d.xp ?? 1)),
  honorPerHour: d.honor ?? 0,
}));

export const JOB_BY_ID: Record<string, JobInfo> = Object.fromEntries(JOBS.map((j) => [j.id, j]));

/** Durées de travail proposées, en minutes de jeu (divisées par la vitesse du monde). */
export const WORK_DURATIONS = [15, 60, 240, 480];
