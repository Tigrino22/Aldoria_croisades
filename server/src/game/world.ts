import { BATTLE_INTERVAL_DAYS, TERRITORIES } from '@aldoria/shared';
import type { Db } from '../db';
import { env } from '../env';

/**
 * Date de la prochaine bataille de territoires. À vitesse normale : chaque dimanche à 18 h UTC (20 h à Paris l'été).
 * En monde accéléré, simplement tous les 7 jours de jeu.
 */
export function nextBattleDate(after: Date): Date {
  if (env.worldSpeed !== 1) return new Date(after.getTime() + (BATTLE_INTERVAL_DAYS * 86_400_000) / env.worldSpeed);
  const d = new Date(after);
  d.setUTCHours(18, 0, 0, 0);
  const daysToSunday = (7 - d.getUTCDay()) % 7;
  d.setUTCDate(d.getUTCDate() + daysToSunday);
  if (d <= after) d.setUTCDate(d.getUTCDate() + 7);
  return d;
}

export async function ensureWorld(c: Db, now: Date) {
  await c.query('INSERT INTO world (id, next_battle_at) VALUES (1, $1) ON CONFLICT (id) DO NOTHING', [nextBattleDate(now)]);
  for (const t of Object.values(TERRITORIES)) {
    await c.query('INSERT INTO territories (id, owner) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING', [t.id, t.startOwner]);
  }
}

export async function getWorld(c: Db) {
  const { rows } = await c.query('SELECT week, next_battle_at FROM world WHERE id = 1');
  return { week: rows[0].week as number, nextBattleAt: new Date(rows[0].next_battle_at) };
}
