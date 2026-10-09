import {
  ENERGY_MAX,
  ENERGY_REGEN_MINUTES,
  ITEMS,
  ROLE_NAMES,
  armorOf,
  currentEnergy,
  currentHp,
  effectiveSkills,
  factionRank,
  honorTitle,
  hpMax,
  hpRegenPerHour,
  isOutlaw,
  powerScore,
  priceFactor,
  ratings,
  safeGold,
  trainingCost,
  weaponOf,
  xpToNext,
  type AttributeSet,
  type BattleLine,
  type CharacterView,
  type Faction,
  type Fighter,
  type Role,
  type SkillSet,
  type Slot,
} from '@aldoria/shared';
import type { Db } from '../db';
import { env } from '../env';
import { GameError } from '../errors';

export interface CharRow {
  player_id: number;
  name: string;
  faction: Faction;
  portrait: number;
  level: number;
  xp: number;
  gold: number;
  honor: number;
  hp: number;
  hp_at: Date;
  energy: number;
  energy_at: Date;
  attributes: AttributeSet;
  skills: SkillSet;
  free_attribute_points: number;
  free_skill_points: number;
  trained: number;
  protected_until: Date | null;
  action: StoredAction | null;
  wins: number;
  losses: number;
  pillages: number;
  gold_looted: number;
  battles: number;
}

export interface StoredAction {
  type: 'work' | 'patrol' | 'pillage';
  ref: string;
  label: string;
  startedAt: string;
  endsAt: string;
  eventId: number;
}

/** Personnage chargé avec ses valeurs calculées (PV et énergie à l'instant `now`). */
export interface Char {
  row: CharRow;
  equipped: Partial<Record<Slot, string>>;
  inventory: { id: number; item_id: string; equipped: boolean }[];
  effective: SkillSet;
  hpMax: number;
  hp: number;
  energy: number;
}

export async function loadChar(c: Db, playerId: number, now: Date, forUpdate = true): Promise<Char> {
  const { rows } = await c.query(`SELECT * FROM characters WHERE player_id = $1 ${forUpdate ? 'FOR UPDATE' : ''}`, [playerId]);
  const row = rows[0] as CharRow | undefined;
  if (!row) throw new GameError('Personnage introuvable', 404);
  const inv = (await c.query('SELECT id, item_id, equipped FROM inventory WHERE player_id = $1 ORDER BY id', [playerId])).rows;
  const equipped: Partial<Record<Slot, string>> = {};
  for (const i of inv) if (i.equipped && ITEMS[i.item_id]) equipped[ITEMS[i.item_id]!.slot] = i.item_id;
  const effective = effectiveSkills(row.attributes, row.skills, equipped);
  const max = hpMax(row.level, row.attributes, effective);
  return {
    row,
    equipped,
    inventory: inv,
    effective,
    hpMax: max,
    hp: currentHp(row.hp, new Date(row.hp_at), now, env.worldSpeed, max, hpRegenPerHour(effective)),
    energy: currentEnergy(row.energy, new Date(row.energy_at), now, env.worldSpeed),
  };
}

/** Enregistre les PV et l'énergie (valeurs actuelles, datées de maintenant). */
export async function saveVitals(c: Db, ch: Char, now: Date) {
  await c.query('UPDATE characters SET hp = $2, hp_at = $3, energy = $4, energy_at = $3 WHERE player_id = $1', [
    ch.row.player_id,
    Math.min(ch.hp, ch.hpMax),
    now,
    Math.min(ch.energy, ENERGY_MAX),
  ]);
}

export function fighterOf(ch: Char, role: Role, hp = ch.hp): Fighter {
  return {
    id: ch.row.player_id,
    name: ch.row.name,
    level: ch.row.level,
    faction: ch.row.faction,
    hp,
    hpMax: ch.hpMax,
    damage: weaponOf(ch.equipped).damage ?? [2, 5],
    ratings: ratings(role, ch.effective, armorOf(ch.equipped), ch.row.faction),
  };
}

export async function ownedTerritories(c: Db, faction: Faction) {
  const { rows } = await c.query(
    `SELECT count(*)::int AS n FROM territories WHERE owner = $1 AND id NOT IN ('clairval', 'al-rimal', 'hrafnborg')`,
    [faction],
  );
  return rows[0].n as number;
}

export async function viewChar(c: Db, ch: Char, now: Date): Promise<CharacterView> {
  const r = ch.row;
  const enl = (await c.query('SELECT territory_id, line FROM enlistments WHERE player_id = $1', [r.player_id])).rows[0];
  const unread = (await c.query('SELECT count(*)::int AS n FROM reports WHERE player_id = $1 AND NOT read', [r.player_id])).rows[0].n;
  const armor = armorOf(ch.equipped);
  const damage = weaponOf(ch.equipped).damage ?? [2, 5];
  const roles = Object.keys(ROLE_NAMES) as Role[];
  const ratingViews = Object.fromEntries(
    roles.map((role) => {
      const rt = ratings(role, ch.effective, armor, r.faction);
      return [role, { ...rt, power: powerScore(rt, ch.hpMax, damage) }];
    }),
  ) as CharacterView['ratings'];
  const energyMissing = ENERGY_MAX - ch.energy;
  const nextEnergyAt =
    energyMissing <= 0
      ? null
      : new Date(now.getTime() + ((1 - (ch.energy % 1)) * ENERGY_REGEN_MINUTES * 60_000) / env.worldSpeed).toISOString();
  return {
    id: r.player_id,
    name: r.name,
    faction: r.faction,
    portrait: r.portrait,
    level: r.level,
    xp: r.xp,
    xpToNext: xpToNext(r.level),
    gold: r.gold,
    safeGold: safeGold(r.level),
    honor: r.honor,
    honorTitle: honorTitle(r.honor),
    rank: factionRank(r.faction, r.level),
    outlaw: isOutlaw(r.honor),
    hp: Math.floor(ch.hp),
    hpMax: ch.hpMax,
    hpRegenPerHour: Math.round(hpRegenPerHour(ch.effective) * ch.hpMax * env.worldSpeed),
    energy: Math.floor(ch.energy),
    energyMax: ENERGY_MAX,
    nextEnergyAt,
    attributes: r.attributes,
    skills: r.skills,
    effective: ch.effective,
    freeAttributePoints: r.free_attribute_points,
    freeSkillPoints: r.free_skill_points,
    trainingCost: trainingCost(r.trained),
    equipped: ch.equipped,
    inventory: ch.inventory.map((i) => ({ id: i.id, itemId: i.item_id, equipped: i.equipped })),
    armor,
    damage,
    ratings: ratingViews,
    action: r.action
      ? { type: r.action.type, ref: r.action.ref, label: r.action.label, startedAt: r.action.startedAt, endsAt: r.action.endsAt }
      : null,
    protectedUntil: r.protected_until && new Date(r.protected_until) > now ? new Date(r.protected_until).toISOString() : null,
    priceFactor: priceFactor(r.honor),
    stats: { wins: r.wins, losses: r.losses, pillages: r.pillages, goldLooted: r.gold_looted, battles: r.battles },
    enlistment: enl ? { territoryId: enl.territory_id, line: enl.line as BattleLine } : null,
    unreadReports: unread,
  };
}
