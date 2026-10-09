import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { pool, tx } from '../src/db';
import { processDueEvents } from '../src/game/events';
import { ensureWorld } from '../src/game/world';
import { migrate } from '../src/migrate';

let app: FastifyInstance;

async function call(method: 'GET' | 'POST' | 'DELETE', url: string, token?: string, payload?: object) {
  const res = await app.inject({ method, url, payload, headers: token ? { authorization: `Bearer ${token}` } : {} });
  const body = res.body ? res.json() : null;
  if (res.statusCode >= 400) throw Object.assign(new Error(body?.error ?? `HTTP ${res.statusCode}`), { status: res.statusCode });
  return body;
}

async function register(username: string, faction: string) {
  const { token } = await call('POST', '/api/auth/register', undefined, { username, password: 'secret123', faction, portrait: 1 });
  const me = await call('GET', '/api/me', token);
  return { token, id: me.id as number };
}

/** Fait passer le temps : tous les événements arrivent à échéance. */
async function skipTime(minutes: number) {
  await pool.query(`UPDATE events SET due_at = due_at - make_interval(mins => $1)`, [minutes]);
  await pool.query(`UPDATE characters SET hp_at = hp_at - make_interval(mins => $1), energy_at = energy_at - make_interval(mins => $1)`, [minutes]);
  await processDueEvents(new Date());
}

async function setChar(id: number, fields: Record<string, unknown>) {
  const keys = Object.keys(fields);
  await pool.query(`UPDATE characters SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE player_id = $1`, [id, ...Object.values(fields)]);
}

beforeAll(async () => {
  await migrate(true);
  app = await buildApp({ rateLimit: false });
});

beforeEach(async () => {
  await pool.query('TRUNCATE players, territories, world, battles RESTART IDENTITY CASCADE');
  await tx((c) => ensureWorld(c, new Date()));
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

describe('personnage', () => {
  it('crée un personnage équipé avec des points à répartir', async () => {
    const { token } = await register('Godefroy', 'aube');
    const me = await call('GET', '/api/me', token);
    expect(me.faction).toBe('aube');
    expect(me.equipped.arme).toBe('baton-ferre');
    expect(me.freeSkillPoints).toBe(6);
    const after = await call('POST', '/api/character/points', token, { attributes: { force: 2 }, skills: { arme: 3, precision: 3 } });
    expect(after.attributes.force).toBe(3);
    expect(after.effective.arme).toBe(3 + 3);
    expect(after.freeSkillPoints).toBe(0);
    await expect(call('POST', '/api/character/points', token, { skills: { arme: 1 } })).rejects.toThrow(/points/);
  });

  it('refuse un nom déjà pris', async () => {
    await register('Tancrède', 'aube');
    await expect(register('tancrède', 'givre')).rejects.toThrow(/déjà pris/);
  });

  it('achète, équipe et revend au marchand', async () => {
    const { token } = await register('Bohémond', 'aube');
    const shop = await call('GET', '/api/shop', token);
    expect(shop.items.some((i: { id: string }) => i.id === 'epee-damasquinee')).toBe(false); // objet des Sables
    let me = await call('POST', '/api/shop/buy', token, { itemId: 'bouclier-rond' });
    const shield = me.inventory.find((i: { itemId: string }) => i.itemId === 'bouclier-rond');
    me = await call('POST', '/api/character/equip', token, { inventoryId: shield.id });
    expect(me.equipped.bouclier).toBe('bouclier-rond');
    expect(me.armor).toBeGreaterThan(2);
    await expect(call('POST', '/api/shop/buy', token, { itemId: 'haubert' })).rejects.toThrow(/or/);
  });
});

describe('travail et patrouille', () => {
  it('termine un travail et paie le personnage', async () => {
    const { token } = await register('Raymond', 'aube');
    const before = await call('GET', '/api/me', token);
    const me = await call('POST', '/api/action/work', token, { jobId: 'troupeaux', minutes: 60 });
    expect(me.action.type).toBe('work');
    await expect(call('POST', '/api/action/work', token, { jobId: 'troupeaux', minutes: 60 })).rejects.toThrow(/occupé/);
    await skipTime(61);
    const after = await call('GET', '/api/me', token);
    expect(after.action).toBeNull();
    expect(after.gold).toBeGreaterThan(before.gold);
    expect(after.xp).toBeGreaterThan(0);
    const reports = await call('GET', '/api/reports', token);
    expect(reports[0].title).toMatch(/Travail terminé/);
  });

  it('refuse un travail trop difficile', async () => {
    const { token } = await register('Adhémar', 'aube');
    await expect(call('POST', '/api/action/work', token, { jobId: 'ambassade', minutes: 60 })).rejects.toThrow(/points de travail/);
  });

  it('part en patrouille et en revient avec un rapport de combat', async () => {
    const { token } = await register('Saladin', 'sables');
    const me = await call('POST', '/api/action/patrol', token, { enemyId: 'loup' });
    expect(me.energy).toBe(9);
    await skipTime(11);
    const reports = await call('GET', '/api/reports', token);
    const report = await call('GET', `/api/reports/${reports[0].id}`, token);
    expect(report.kind).toBe('patrol');
    expect(report.data.combat.rounds.length).toBeGreaterThan(0);
  });
});

describe('combats entre joueurs et honneur', () => {
  it('pille un joueur adverse, prend son or et le protège ensuite', async () => {
    const a = await register('Harald', 'givre');
    const d = await register('Baudouin', 'aube');
    await setChar(a.id, { level: 5, skills: JSON.stringify({ arme: 15, charge: 15, precision: 15, intimidation: 10, esquive: 10, embuscade: 10, endurance: 5, resistance: 5, fortification: 0, recuperation: 0, tactique: 0, commandement: 0 }) });
    await setChar(d.id, { level: 5, gold: 2000, protected_until: null });
    await call('POST', '/api/action/pillage', a.token, { targetId: d.id });
    await skipTime(11);
    const report = await call('GET', `/api/reports/${(await call('GET', '/api/reports', a.token))[0].id}`, a.token);
    expect(report.kind).toBe('pillage');
    if (report.data.combat.winner === 'a') {
      expect(report.data.loot).toBeGreaterThan(0);
      const victim = await call('GET', '/api/me', d.token);
      expect(victim.gold).toBe(2000 - report.data.loot);
      expect(victim.protectedUntil).not.toBeNull();
    }
    const defenderReports = await call('GET', '/api/reports', d.token);
    expect(defenderReports[0].title).toMatch(/Harald/);
  });

  it('interdit d’attaquer les siens, sauf un hors-la-loi', async () => {
    const a = await register('Roland', 'aube');
    const b = await register('Ganelon', 'aube');
    await setChar(b.id, { protected_until: null });
    await expect(call('POST', '/api/action/duel', a.token, { targetId: b.id })).rejects.toThrow(/siens/);
    await setChar(b.id, { honor: -150 });
    const res = await call('POST', '/api/action/duel', a.token, { targetId: b.id });
    const me = await call('GET', '/api/me', a.token);
    if (res.won) expect(me.honor).toBeGreaterThan(0);
  });

  it('déshonore celui qui s’en prend aux faibles', async () => {
    const a = await register('Brute', 'givre');
    const d = await register('Novice', 'sables');
    await setChar(a.id, { level: 10 });
    await setChar(d.id, { level: 7, protected_until: null });
    const targets = await call('GET', '/api/targets', a.token);
    expect(targets.find((t: { id: number }) => t.id === d.id).dishonorable).toBe(true);
    await call('POST', '/api/action/duel', a.token, { targetId: d.id });
    const me = await call('GET', '/api/me', a.token);
    expect(me.honor).toBeLessThan(5);
  });

  it('respecte la protection des débutants', async () => {
    const a = await register('Impatient', 'givre');
    const d = await register('Nouveau', 'aube');
    await expect(call('POST', '/api/action/pillage', a.token, { targetId: d.id })).rejects.toThrow(/protection/);
  });
});

describe('bataille de territoires', () => {
  it('fait s’affronter les armées et donne le territoire aux survivants', async () => {
    const tokens = [];
    for (const [name, faction] of [['Aube1', 'aube'], ['Aube2', 'aube'], ['Givre1', 'givre'], ['Givre2', 'givre'], ['Givre3', 'givre']] as const) {
      const p = await register(name, faction);
      await setChar(p.id, { level: faction === 'givre' ? 12 : 3 });
      tokens.push({ ...p, faction });
    }
    // Bérénice est libre et voisine des deux factions.
    for (const p of tokens) await call('POST', '/api/map/enlist', p.token, { territoryId: 'berenice', line: 'corps' });
    // Une capitale ne s'attaque pas.
    await expect(call('POST', '/api/map/enlist', tokens[2]!.token, { territoryId: 'clairval', line: 'corps' })).rejects.toThrow(/capitale/);
    const map = await call('GET', '/api/map', tokens[0]!.token);
    expect(map.territories.find((t: { id: string }) => t.id === 'berenice').enlisted).toEqual({ aube: 2, sables: 0, givre: 3 });

    await pool.query('UPDATE world SET next_battle_at = now() - interval \'1 second\'');
    await processDueEvents(new Date());

    const after = await call('GET', '/api/map', tokens[0]!.token);
    const berenice = after.territories.find((t: { id: string }) => t.id === 'berenice');
    expect(after.week).toBe(2);
    expect(['aube', 'givre']).toContain(berenice.owner);
    const battle = await call('GET', `/api/battles/${berenice.lastBattle.id}`, tokens[0]!.token);
    expect(battle.duels.length).toBeGreaterThan(0);
    const report = (await call('GET', '/api/reports', tokens[2]!.token))[0];
    expect(report.title).toMatch(/Victoire|Défaite/);
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM enlistments');
    expect(rows[0].n).toBe(0);
  });

  it('juge les voisinages sur la carte du début de la bataille', async () => {
    const s = await register('Sarrasin', 'sables');
    const a = await register('Croise', 'aube');
    await setChar(s.id, { level: 5 });
    await setChar(a.id, { level: 5 });
    // Les Sables prennent Saint-Aubin sans combat (personne ne le défend)…
    await call('POST', '/api/map/enlist', s.token, { territoryId: 'saint-aubin', line: 'corps' });
    // …mais l'Aube, voisine de Sélénar par Saint-Aubin au début de la bataille, attaque quand même Sélénar.
    await call('POST', '/api/map/enlist', a.token, { territoryId: 'selenar', line: 'corps' });
    await pool.query("UPDATE world SET next_battle_at = now() - interval '1 second'");
    await processDueEvents(new Date());
    const owners = Object.fromEntries((await pool.query('SELECT id, owner FROM territories')).rows.map((r) => [r.id, r.owner]));
    expect(owners['saint-aubin']).toBe('sables');
    expect(owners.selenar).toBe('aube');
  });
});
