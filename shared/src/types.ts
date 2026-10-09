import type { Ratings, Role } from './combat';
import type { Faction } from './data/factions';
import type { Slot } from './data/items';
import type { AttributeSet, SkillSet } from './data/skills';

export type ActionType = 'work' | 'patrol' | 'pillage';

export interface CurrentAction {
  type: ActionType;
  startedAt: string;
  endsAt: string;
  label: string;
  /** Identifiant du travail, de l'ennemi ou nom de la cible. */
  ref: string;
}

export interface InventoryEntry {
  id: number;
  itemId: string;
  equipped: boolean;
}

export interface CharacterView {
  id: number;
  name: string;
  faction: Faction;
  portrait: number;
  level: number;
  xp: number;
  xpToNext: number;
  gold: number;
  safeGold: number;
  honor: number;
  honorTitle: string;
  rank: string;
  outlaw: boolean;
  hp: number;
  hpMax: number;
  hpRegenPerHour: number;
  energy: number;
  energyMax: number;
  nextEnergyAt: string | null;
  attributes: AttributeSet;
  skills: SkillSet;
  effective: SkillSet;
  freeAttributePoints: number;
  freeSkillPoints: number;
  trainingCost: number;
  equipped: Partial<Record<Slot, string>>;
  inventory: InventoryEntry[];
  armor: number;
  damage: [number, number];
  ratings: Record<Role, Ratings & { power: number }>;
  action: CurrentAction | null;
  protectedUntil: string | null;
  priceFactor: number;
  stats: { wins: number; losses: number; pillages: number; goldLooted: number; battles: number };
  enlistment: { territoryId: string; line: BattleLine } | null;
  unreadReports: number;
}

export type BattleLine = 'avant-garde' | 'corps' | 'arriere-garde';
export const BATTLE_LINES: Record<BattleLine, string> = {
  'avant-garde': 'Avant-garde',
  corps: 'Corps de bataille',
  'arriere-garde': 'Arrière-garde',
};

export interface WorldInfo {
  speed: number;
  serverTime: string;
  week: number;
  nextBattleAt: string;
}
