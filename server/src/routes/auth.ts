import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  BEGINNER_PROTECTION_HOURS,
  ENERGY_MAX,
  FACTIONS,
  PORTRAITS_PER_FACTION,
  START_ATTRIBUTE_POINTS,
  START_SKILL_POINTS,
  STARTING_ITEMS,
  effectiveSkills,
  emptyAttributes,
  emptySkills,
  hpMax,
} from '@aldoria/shared';
import { act } from '../act';
import { bearer, createSession, hashPassword, verifyPassword } from '../auth';
import { pool } from '../db';
import { env } from '../env';
import { GameError } from '../errors';
import { giveItem } from '../game/progress';
import { getWorld } from '../game/world';

const username = z
  .string()
  .trim()
  .min(3, 'Le nom doit faire au moins 3 caractères')
  .max(20, 'Le nom doit faire au plus 20 caractères')
  .regex(/^[\p{L}0-9_' -]+$/u, 'Le nom ne peut contenir que des lettres, chiffres, espaces, apostrophes, _ et -');
const password = z.string().min(6, 'Le mot de passe doit faire au moins 6 caractères').max(200);

const registerBody = z.object({
  username,
  password,
  faction: z.enum(FACTIONS, { errorMap: () => ({ message: 'Choisissez une faction' }) }),
  portrait: z.number().int().min(1).max(PORTRAITS_PER_FACTION),
});

export default async function authRoutes(app: FastifyInstance) {
  app.get('/api/world', async () => {
    const c = await pool.connect();
    try {
      const w = await getWorld(c);
      const counts = (await c.query('SELECT faction, count(*)::int AS n FROM characters GROUP BY faction')).rows;
      return {
        speed: env.worldSpeed,
        serverTime: new Date().toISOString(),
        week: w.week,
        nextBattleAt: w.nextBattleAt.toISOString(),
        population: Object.fromEntries(FACTIONS.map((f) => [f, counts.find((r) => r.faction === f)?.n ?? 0])),
      };
    } finally {
      c.release();
    }
  });

  app.post('/api/auth/register', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req) => {
    const body = registerBody.parse(req.body);
    const hash = await hashPassword(body.password);
    return act(async (c, _outbox, now) => {
      const exists = await c.query('SELECT 1 FROM players WHERE lower(username) = lower($1)', [body.username]);
      if (exists.rows.length) throw new GameError('Ce nom est déjà pris');
      const { rows } = await c.query('INSERT INTO players (username, password_hash) VALUES ($1, $2) RETURNING id', [body.username, hash]);
      const playerId = rows[0].id as number;
      const attributes = { ...emptyAttributes(), force: 1, agilite: 1, vigueur: 1, esprit: 1 };
      const skills = emptySkills();
      const max = hpMax(1, attributes, effectiveSkills(attributes, skills, {}));
      // La faction la moins peuplée reçoit un bonus d'arrivée en or.
      const pop = (await c.query('SELECT faction, count(*)::int AS n FROM characters GROUP BY faction')).rows;
      const count = (f: string) => pop.find((p) => p.faction === f)?.n ?? 0;
      const smallest = Math.min(...FACTIONS.map(count));
      const gold = 100 + (count(body.faction) === smallest && pop.length > 0 ? 100 : 0);
      await c.query(
        `INSERT INTO characters (player_id, name, faction, portrait, gold, hp, hp_at, energy, energy_at, attributes, skills,
           free_attribute_points, free_skill_points, protected_until)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $7, $9, $10, $11, $12, $13)`,
        [
          playerId,
          body.username,
          body.faction,
          body.portrait,
          gold,
          max,
          now,
          ENERGY_MAX,
          JSON.stringify(attributes),
          JSON.stringify(skills),
          START_ATTRIBUTE_POINTS,
          START_SKILL_POINTS,
          new Date(now.getTime() + (BEGINNER_PROTECTION_HOURS * 3_600_000) / env.worldSpeed),
        ],
      );
      for (const item of STARTING_ITEMS) await giveItem(c, playerId, item, true);
      return { token: await createSession(c, playerId) };
    });
  });

  app.post('/api/auth/login', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req) => {
    const body = z.object({ username: z.string().trim(), password: z.string() }).parse(req.body);
    const { rows } = await pool.query('SELECT id, password_hash FROM players WHERE lower(username) = lower($1)', [body.username]);
    if (!rows[0] || !(await verifyPassword(body.password, rows[0].password_hash))) throw new GameError('Nom ou mot de passe incorrect', 401);
    const client = await pool.connect();
    try {
      return { token: await createSession(client, rows[0].id) };
    } finally {
      client.release();
    }
  });

  app.post('/api/auth/logout', async (req) => {
    await pool.query('DELETE FROM sessions WHERE token = $1', [bearer(req) ?? '']);
    return { ok: true };
  });
}
