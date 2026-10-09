import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  ATTRIBUTES,
  DISHONOR_LEVEL_RATIO,
  ENEMIES,
  ITEMS,
  ITEM_LIST,
  JOBS,
  SELL_RATIO,
  SKILLS,
  WORK_DURATIONS,
  factionRank,
  honorTitle,
  isOutlaw,
  jobPoints,
  priceFactor,
  trainingCost,
  workReward,
} from '@aldoria/shared';
import { act } from '../act';
import { requirePlayer } from '../auth';
import { pool } from '../db';
import { GameError } from '../errors';
import { attackBlocker, cancelAction, fightDuel, heal, startPatrol, startPillage, startWork } from '../game/actions';
import { loadChar, ownedTerritories, viewChar } from '../game/character';

const id = z.coerce.number().int().positive();

export default async function gameRoutes(app: FastifyInstance) {
  app.get('/api/me', async (req) => {
    const playerId = await requirePlayer(req);
    return act(async (c, _o, now) => viewChar(c, await loadChar(c, playerId, now, false), now));
  });

  /** Répartit les points libres d'attributs et de compétences. */
  app.post('/api/character/points', async (req) => {
    const playerId = await requirePlayer(req);
    const body = z
      .object({
        attributes: z.record(z.enum(ATTRIBUTES), z.number().int().min(0)).default({}),
        skills: z.record(z.enum(SKILLS), z.number().int().min(0)).default({}),
      })
      .parse(req.body);
    return act(async (c, _o, now) => {
      const ch = await loadChar(c, playerId, now);
      const a = Object.values(body.attributes).reduce((s, v) => s + (v ?? 0), 0);
      const s = Object.values(body.skills).reduce((s2, v) => s2 + (v ?? 0), 0);
      if (a > ch.row.free_attribute_points) throw new GameError("Pas assez de points d'attribut");
      if (s > ch.row.free_skill_points) throw new GameError('Pas assez de points de compétence');
      const attributes = { ...ch.row.attributes };
      for (const [k, v] of Object.entries(body.attributes)) attributes[k as keyof typeof attributes] += v ?? 0;
      const skills = { ...ch.row.skills };
      for (const [k, v] of Object.entries(body.skills)) skills[k as keyof typeof skills] += v ?? 0;
      await c.query(
        `UPDATE characters SET attributes = $2, skills = $3, free_attribute_points = free_attribute_points - $4,
           free_skill_points = free_skill_points - $5 WHERE player_id = $1`,
        [playerId, JSON.stringify(attributes), JSON.stringify(skills), a, s],
      );
      return viewChar(c, await loadChar(c, playerId, now), now);
    });
  });

  /** Achète un point de compétence auprès du maître d'armes. */
  app.post('/api/character/train', async (req) => {
    const playerId = await requirePlayer(req);
    const { skill } = z.object({ skill: z.enum(SKILLS) }).parse(req.body);
    return act(async (c, _o, now) => {
      const ch = await loadChar(c, playerId, now);
      const cost = trainingCost(ch.row.trained);
      if (ch.row.gold < cost) throw new GameError(`L'entraînement coûte ${cost} pièces d'or`);
      const skills = { ...ch.row.skills, [skill]: ch.row.skills[skill] + 1 };
      await c.query('UPDATE characters SET gold = gold - $2, trained = trained + 1, skills = $3 WHERE player_id = $1', [
        playerId,
        cost,
        JSON.stringify(skills),
      ]);
      return viewChar(c, await loadChar(c, playerId, now), now);
    });
  });

  app.post('/api/character/equip', async (req) => {
    const playerId = await requirePlayer(req);
    const { inventoryId } = z.object({ inventoryId: id }).parse(req.body);
    return act(async (c, _o, now) => {
      const ch = await loadChar(c, playerId, now);
      const entry = ch.inventory.find((i) => i.id === inventoryId);
      if (!entry) throw new GameError('Objet introuvable', 404);
      const item = ITEMS[entry.item_id]!;
      if (item.level > ch.row.level) throw new GameError(`Il faut être niveau ${item.level} pour porter cet objet`);
      const sameSlot = ch.inventory.filter((i) => i.equipped && ITEMS[i.item_id]?.slot === item.slot).map((i) => i.id);
      if (sameSlot.length) await c.query('UPDATE inventory SET equipped = false WHERE id = ANY($1)', [sameSlot]);
      await c.query('UPDATE inventory SET equipped = true WHERE id = $1', [inventoryId]);
      return viewChar(c, await loadChar(c, playerId, now), now);
    });
  });

  app.post('/api/character/unequip', async (req) => {
    const playerId = await requirePlayer(req);
    const { inventoryId } = z.object({ inventoryId: id }).parse(req.body);
    return act(async (c, _o, now) => {
      await c.query('UPDATE inventory SET equipped = false WHERE id = $1 AND player_id = $2', [inventoryId, playerId]);
      return viewChar(c, await loadChar(c, playerId, now), now);
    });
  });

  // ---------- Actions ----------

  app.get('/api/jobs', async (req) => {
    const playerId = await requirePlayer(req);
    return act(async (c, _o, now) => {
      const ch = await loadChar(c, playerId, now, false);
      const territories = await ownedTerritories(c, ch.row.faction);
      return {
        durations: WORK_DURATIONS,
        jobs: JOBS.map((j) => ({
          ...j,
          points: jobPoints(j, ch.effective),
          available: jobPoints(j, ch.effective) >= j.required,
          rewards: WORK_DURATIONS.map((m) => workReward(j, ch.effective, m, territories)),
        })),
        enemies: ENEMIES.map((e) => ({ ...e, available: e.level <= ch.row.level + 3 })),
      };
    });
  });

  app.post('/api/action/work', async (req) => {
    const playerId = await requirePlayer(req);
    const body = z.object({ jobId: z.string(), minutes: z.number().int() }).parse(req.body);
    return act(async (c, _o, now) => {
      await startWork(c, playerId, body.jobId, body.minutes, now);
      return viewChar(c, await loadChar(c, playerId, now), now);
    });
  });

  app.post('/api/action/patrol', async (req) => {
    const playerId = await requirePlayer(req);
    const body = z.object({ enemyId: z.string() }).parse(req.body);
    return act(async (c, _o, now) => {
      await startPatrol(c, playerId, body.enemyId, now);
      return viewChar(c, await loadChar(c, playerId, now), now);
    });
  });

  app.post('/api/action/cancel', async (req) => {
    const playerId = await requirePlayer(req);
    return act(async (c, outbox, now) => {
      await cancelAction(c, playerId, now, outbox);
      return viewChar(c, await loadChar(c, playerId, now), now);
    });
  });

  app.post('/api/action/hospital', async (req) => {
    const playerId = await requirePlayer(req);
    return act(async (c, _o, now) => {
      await heal(c, playerId, now);
      return viewChar(c, await loadChar(c, playerId, now), now);
    });
  });

  /** Liste des adversaires possibles, avec ce que l'attaque coûterait ou rapporterait en honneur. */
  app.get('/api/targets', async (req) => {
    const playerId = await requirePlayer(req);
    const q = z.object({ search: z.string().trim().max(20).optional() }).parse(req.query);
    return act(async (c, _o, now) => {
      const me = await loadChar(c, playerId, now, false);
      const { rows } = await c.query(
        `SELECT player_id FROM characters
         WHERE player_id <> $1 AND ($2::text IS NULL OR name ILIKE '%' || $2 || '%')
           AND (faction <> $3 OR honor <= -100)
         ORDER BY abs(level - $4), random() LIMIT 30`,
        [playerId, q.search || null, me.row.faction, me.row.level],
      );
      const out = [];
      for (const r of rows) {
        const t = await loadChar(c, r.player_id, now, false);
        out.push({
          id: t.row.player_id,
          name: t.row.name,
          faction: t.row.faction,
          portrait: t.row.portrait,
          level: t.row.level,
          rank: factionRank(t.row.faction, t.row.level),
          honor: t.row.honor,
          honorTitle: honorTitle(t.row.honor),
          outlaw: isOutlaw(t.row.honor),
          hpRatio: Math.round((t.hp / t.hpMax) * 100) / 100,
          protectedUntil: t.row.protected_until && new Date(t.row.protected_until) > now ? new Date(t.row.protected_until).toISOString() : null,
          blocker: attackBlocker(me, t, now, 'pillage'),
          dishonorable: t.row.level < me.row.level * DISHONOR_LEVEL_RATIO && !isOutlaw(t.row.honor),
          wins: t.row.wins,
          losses: t.row.losses,
        });
      }
      return out;
    });
  });

  app.post('/api/action/pillage', async (req) => {
    const playerId = await requirePlayer(req);
    const { targetId } = z.object({ targetId: id }).parse(req.body);
    return act(async (c, outbox, now) => {
      await startPillage(c, playerId, targetId, now, outbox);
      return viewChar(c, await loadChar(c, playerId, now), now);
    });
  });

  app.post('/api/action/duel', async (req) => {
    const playerId = await requirePlayer(req);
    const { targetId } = z.object({ targetId: id }).parse(req.body);
    return act(async (c, outbox, now) => fightDuel(c, playerId, targetId, now, outbox));
  });

  // ---------- Marchand ----------

  app.get('/api/shop', async (req) => {
    const playerId = await requirePlayer(req);
    return act(async (c, _o, now) => {
      const ch = await loadChar(c, playerId, now, false);
      const factor = priceFactor(ch.row.honor);
      return {
        priceFactor: factor,
        items: ITEM_LIST.filter((i) => !i.dropOnly && i.price > 0 && (!i.faction || i.faction === ch.row.faction)).map((i) => ({
          ...i,
          finalPrice: Math.round(i.price * factor),
        })),
      };
    });
  });

  app.post('/api/shop/buy', async (req) => {
    const playerId = await requirePlayer(req);
    const { itemId } = z.object({ itemId: z.string() }).parse(req.body);
    return act(async (c, _o, now) => {
      const ch = await loadChar(c, playerId, now);
      const item = ITEMS[itemId];
      if (!item || item.dropOnly || item.price <= 0) throw new GameError('Le marchand ne vend pas cet objet');
      if (item.faction && item.faction !== ch.row.faction) throw new GameError("Cet objet n'est vendu que dans une autre faction");
      const price = Math.round(item.price * priceFactor(ch.row.honor));
      if (ch.row.gold < price) throw new GameError(`Il vous faut ${price} pièces d'or`);
      await c.query('UPDATE characters SET gold = gold - $2 WHERE player_id = $1', [playerId, price]);
      await c.query('INSERT INTO inventory (player_id, item_id) VALUES ($1, $2)', [playerId, itemId]);
      return viewChar(c, await loadChar(c, playerId, now), now);
    });
  });

  app.post('/api/shop/sell', async (req) => {
    const playerId = await requirePlayer(req);
    const { inventoryId } = z.object({ inventoryId: id }).parse(req.body);
    return act(async (c, _o, now) => {
      const { rows } = await c.query('DELETE FROM inventory WHERE id = $1 AND player_id = $2 RETURNING item_id', [inventoryId, playerId]);
      if (!rows[0]) throw new GameError('Objet introuvable', 404);
      const item = ITEMS[rows[0].item_id]!;
      const value = Math.max(item.dropOnly ? Math.round(item.price * 0.6) : 0, Math.round(item.price * SELL_RATIO));
      await c.query('UPDATE characters SET gold = gold + $2 WHERE player_id = $1', [playerId, value]);
      return viewChar(c, await loadChar(c, playerId, now), now);
    });
  });

  // ---------- Rapports, profils, classements ----------

  app.get('/api/reports', async (req) => {
    const playerId = await requirePlayer(req);
    const { rows } = await pool.query(
      'SELECT id, kind, title, read, created_at FROM reports WHERE player_id = $1 ORDER BY created_at DESC, id DESC LIMIT 100',
      [playerId],
    );
    return rows.map((r) => ({ id: r.id, kind: r.kind, title: r.title, read: r.read, createdAt: new Date(r.created_at).toISOString() }));
  });

  app.get('/api/reports/:id', async (req) => {
    const playerId = await requirePlayer(req);
    const reportId = id.parse((req.params as { id: string }).id);
    const { rows } = await pool.query('UPDATE reports SET read = true WHERE id = $1 AND player_id = $2 RETURNING *', [reportId, playerId]);
    if (!rows[0]) throw new GameError('Rapport introuvable', 404);
    const r = rows[0];
    return { id: r.id, kind: r.kind, title: r.title, data: r.data, createdAt: new Date(r.created_at).toISOString() };
  });

  app.post('/api/reports/read-all', async (req) => {
    const playerId = await requirePlayer(req);
    await pool.query('UPDATE reports SET read = true WHERE player_id = $1', [playerId]);
    return { ok: true };
  });

  app.get('/api/players/:id', async (req) => {
    await requirePlayer(req);
    const pid = id.parse((req.params as { id: string }).id);
    return act(async (c, _o, now) => {
      const ch = await loadChar(c, pid, now, false);
      const v = await viewChar(c, ch, now);
      // Profil public : on ne montre ni l'or, ni les points libres, ni l'inventaire.
      return {
        id: v.id,
        name: v.name,
        faction: v.faction,
        portrait: v.portrait,
        level: v.level,
        rank: v.rank,
        honor: v.honor,
        honorTitle: v.honorTitle,
        outlaw: v.outlaw,
        equipped: v.equipped,
        stats: v.stats,
      };
    });
  });

  app.get('/api/ranking', async (req) => {
    await requirePlayer(req);
    const { by } = z.object({ by: z.enum(['level', 'honor', 'wins', 'looted']).default('level') }).parse(req.query);
    const order = { level: 'level DESC, xp DESC', honor: 'honor DESC', wins: 'wins DESC', looted: 'gold_looted DESC' }[by];
    const { rows } = await pool.query(
      `SELECT player_id, name, faction, portrait, level, honor, wins, gold_looted FROM characters ORDER BY ${order}, player_id LIMIT 100`,
    );
    return rows.map((r, i) => ({
      position: i + 1,
      id: r.player_id,
      name: r.name,
      faction: r.faction,
      portrait: r.portrait,
      level: r.level,
      honor: r.honor,
      honorTitle: honorTitle(r.honor),
      wins: r.wins,
      looted: r.gold_looted,
    }));
  });
}
