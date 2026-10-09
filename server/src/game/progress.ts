import { LEVEL_ATTRIBUTE_POINTS, LEVEL_SKILL_POINTS, addXp } from '@aldoria/shared';
import type { Db } from '../db';
import type { Outbox } from '../notify';

export interface Gains {
  xp?: number;
  gold?: number;
  honor?: number;
}

/** Ajoute expérience, or et honneur à un personnage, et gère les montées de niveau. Renvoie les niveaux gagnés. */
export async function grant(c: Db, playerId: number, g: Gains, outbox?: Outbox): Promise<number> {
  const { rows } = await c.query('SELECT level, xp FROM characters WHERE player_id = $1', [playerId]);
  const { level, xp, levelsGained } = addXp(rows[0].level, rows[0].xp, Math.max(0, Math.round(g.xp ?? 0)));
  await c.query(
    `UPDATE characters SET level = $2, xp = $3, gold = GREATEST(0, gold + $4), honor = honor + $5,
       free_attribute_points = free_attribute_points + $6, free_skill_points = free_skill_points + $7
     WHERE player_id = $1`,
    [playerId, level, xp, Math.round(g.gold ?? 0), Math.round(g.honor ?? 0), levelsGained * LEVEL_ATTRIBUTE_POINTS, levelsGained * LEVEL_SKILL_POINTS],
  );
  if (levelsGained > 0) outbox?.push(playerId, { type: 'levelup', level });
  return levelsGained;
}

export async function addReport(c: Db, playerId: number, kind: string, title: string, data: unknown, outbox?: Outbox) {
  const { rows } = await c.query('INSERT INTO reports (player_id, kind, title, data) VALUES ($1, $2, $3, $4) RETURNING id', [
    playerId,
    kind,
    title,
    JSON.stringify(data),
  ]);
  outbox?.push(playerId, { type: 'report', title });
  return rows[0].id as number;
}

export async function giveItem(c: Db, playerId: number, itemId: string, equipped = false) {
  await c.query('INSERT INTO inventory (player_id, item_id, equipped) VALUES ($1, $2, $3)', [playerId, itemId, equipped]);
}
