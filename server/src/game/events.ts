import { tx } from '../db';
import { Outbox } from '../notify';
import { runEvent } from './actions';
import { resolveBattles } from './battles';

/** Exécute tous les événements arrivés à échéance (fins d'action, batailles hebdomadaires). */
export async function processDueEvents(now: Date) {
  for (;;) {
    const outbox = new Outbox();
    const done = await tx(async (c) => {
      const { rows } = await c.query('SELECT id, player_id, type, data FROM events WHERE due_at <= $1 ORDER BY due_at, id LIMIT 1 FOR UPDATE SKIP LOCKED', [now]);
      if (!rows[0]) return false;
      await runEvent(c, rows[0], now, outbox);
      return true;
    });
    outbox.flush();
    if (!done) break;
  }
  const outbox = new Outbox();
  await tx(async (c) => {
    const { rows } = await c.query('SELECT next_battle_at FROM world WHERE id = 1 FOR UPDATE');
    if (rows[0] && new Date(rows[0].next_battle_at) <= now) await resolveBattles(c, now, outbox);
  });
  outbox.flush();
}
