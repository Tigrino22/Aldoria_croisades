import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { BATTLE_MIN_LEVEL, FACTIONS, TERRITORIES, isOutlaw, type BattleLine, type Faction } from '@aldoria/shared';
import { act } from '../act';
import { requirePlayer } from '../auth';
import { pool } from '../db';
import { GameError } from '../errors';
import { canAttack } from '../game/battles';
import { loadChar } from '../game/character';
import { getWorld } from '../game/world';

export default async function mapRoutes(app: FastifyInstance) {
  app.get('/api/map', async (req) => {
    const playerId = await requirePlayer(req);
    return act(async (c, _o, now) => {
      const me = await loadChar(c, playerId, now, false);
      const world = await getWorld(c);
      const owners = (await c.query('SELECT id, owner, owner_since FROM territories')).rows;
      const counts = (
        await c.query(
          `SELECT e.territory_id, ch.faction, count(*)::int AS n FROM enlistments e
           JOIN characters ch ON ch.player_id = e.player_id GROUP BY e.territory_id, ch.faction`,
        )
      ).rows;
      const lastWeek = (await c.query('SELECT max(week) AS w FROM battles')).rows[0].w;
      const last = lastWeek
        ? (await c.query('SELECT id, territory_id, previous_owner, new_owner FROM battles WHERE week = $1', [lastWeek])).rows
        : [];
      const territories = [];
      for (const o of owners) {
        const t = TERRITORIES[o.id]!;
        const enlisted = Object.fromEntries(FACTIONS.map((f) => [f, counts.find((k) => k.territory_id === o.id && k.faction === f)?.n ?? 0]));
        const lastBattle = last.find((b) => b.territory_id === o.id);
        territories.push({
          id: o.id,
          owner: o.owner as Faction | null,
          ownerSince: o.owner_since,
          enlisted,
          canDefend: o.owner === me.row.faction,
          canAttack: o.owner !== me.row.faction && (await canAttack(c, me.row.faction, o.id)),
          capital: t.capital,
          lastBattle: lastBattle
            ? { id: lastBattle.id, previousOwner: lastBattle.previous_owner, newOwner: lastBattle.new_owner }
            : null,
        });
      }
      return { week: world.week, nextBattleAt: world.nextBattleAt.toISOString(), territories };
    });
  });

  app.post('/api/map/enlist', async (req) => {
    const playerId = await requirePlayer(req);
    const body = z
      .object({ territoryId: z.string(), line: z.enum(['avant-garde', 'corps', 'arriere-garde'] as [BattleLine, ...BattleLine[]]) })
      .parse(req.body);
    return act(async (c, _o, now) => {
      const me = await loadChar(c, playerId, now, false);
      const t = TERRITORIES[body.territoryId];
      if (!t) throw new GameError('Territoire inconnu', 404);
      if (me.row.level < BATTLE_MIN_LEVEL) throw new GameError(`Il faut être niveau ${BATTLE_MIN_LEVEL} pour rejoindre une bataille`);
      if (isOutlaw(me.row.honor)) throw new GameError("Un hors-la-loi n'a pas sa place dans l'armée de sa faction");
      const { rows } = await c.query('SELECT owner FROM territories WHERE id = $1', [t.id]);
      const owner = rows[0].owner;
      if (owner !== me.row.faction && !(await canAttack(c, me.row.faction, t.id)))
        throw new GameError(
          t.capital ? 'Une capitale ne peut pas être attaquée' : "Votre faction doit posséder un territoire voisin pour attaquer celui-ci",
        );
      await c.query(
        `INSERT INTO enlistments (player_id, territory_id, line) VALUES ($1, $2, $3)
         ON CONFLICT (player_id) DO UPDATE SET territory_id = $2, line = $3, enlisted_at = now()`,
        [playerId, t.id, body.line],
      );
      return { ok: true };
    });
  });

  app.delete('/api/map/enlist', async (req) => {
    const playerId = await requirePlayer(req);
    await pool.query('DELETE FROM enlistments WHERE player_id = $1', [playerId]);
    return { ok: true };
  });

  app.get('/api/map/enlisted/:territoryId', async (req) => {
    await requirePlayer(req);
    const { territoryId } = req.params as { territoryId: string };
    const { rows } = await pool.query(
      `SELECT ch.player_id, ch.name, ch.faction, ch.level, e.line FROM enlistments e
       JOIN characters ch ON ch.player_id = e.player_id WHERE e.territory_id = $1 ORDER BY ch.faction, e.line, e.enlisted_at`,
      [territoryId],
    );
    return rows.map((r) => ({ id: r.player_id, name: r.name, faction: r.faction, level: r.level, line: r.line }));
  });

  app.get('/api/battles/:id', async (req) => {
    await requirePlayer(req);
    const battleId = z.coerce.number().int().parse((req.params as { id: string }).id);
    const { rows } = await pool.query('SELECT * FROM battles WHERE id = $1', [battleId]);
    if (!rows[0]) throw new GameError('Bataille introuvable', 404);
    const b = rows[0];
    return { id: b.id, week: b.week, territoryId: b.territory_id, previousOwner: b.previous_owner, newOwner: b.new_owner, foughtAt: b.fought_at, ...b.data };
  });

  app.get('/api/factions', async (req) => {
    await requirePlayer(req);
    const { rows } = await pool.query(
      `SELECT f.faction,
         (SELECT count(*)::int FROM territories t WHERE t.owner = f.faction) AS territories,
         (SELECT count(*)::int FROM characters ch WHERE ch.faction = f.faction) AS members,
         (SELECT coalesce(sum(honor), 0)::int FROM characters ch WHERE ch.faction = f.faction AND honor > 0) AS honor
       FROM unnest($1::text[]) AS f(faction)`,
      [FACTIONS],
    );
    return rows;
  });
}
