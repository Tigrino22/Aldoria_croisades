/**
 * Peuple le monde local avec des guerriers fictifs pour tester (pillages, duels, batailles) : npm run seed
 * Mot de passe de tous les comptes créés : aldoria
 */
import {
  ENERGY_MAX,
  FACTIONS,
  ITEM_LIST,
  SKILLS,
  TERRITORIES,
  effectiveSkills,
  hpMax,
  type Faction,
  type SkillSet,
} from '@aldoria/shared';
import { hashPassword } from './auth';
import { pool, tx } from './db';
import { canAttack } from './game/battles';
import { ensureWorld } from './game/world';
import { migrate } from './migrate';

const NAMES: Record<Faction, string[]> = {
  aube: ['Godefroy', 'Baudouin', 'Tancrède', 'Raymond', 'Adhémar', 'Eustache', 'Hugues'],
  sables: ['Yusuf', 'Karim', 'Rashid', 'Zayd', 'Tariq', 'Nasir', 'Farid'],
  givre: ['Harald', 'Sigurd', 'Ragnhild', 'Eirik', 'Ulfric', 'Astrid', 'Bjorn'],
};

await migrate();
const hash = await hashPassword('aldoria');
const now = new Date();
await tx(async (c) => {
  await ensureWorld(c, now);
  for (const faction of FACTIONS) {
    for (const [i, name] of NAMES[faction].entries()) {
      const exists = await c.query('SELECT 1 FROM players WHERE lower(username) = lower($1)', [name]);
      if (exists.rows.length) continue;
      const level = 1 + ((i * 11 + faction.length * 3) % 45);
      const { rows } = await c.query('INSERT INTO players (username, password_hash) VALUES ($1, $2) RETURNING id', [name, hash]);
      const id = rows[0].id;
      const attributes = { force: 1 + (level >> 2), agilite: 1 + (level >> 2), vigueur: 1 + (level >> 2), esprit: 1 + (level >> 3) };
      const skills = Object.fromEntries(SKILLS.map((s, k) => [s, Math.floor((level * 3 + 6) / 12) + ((k + i) % 3)])) as SkillSet;
      const gear = ['arme', 'bouclier', 'tete', 'corps', 'pieds', 'anneau']
        .map((slot) => ITEM_LIST.filter((it) => it.slot === slot && it.level <= level && (!it.faction || it.faction === faction)).at(-1))
        .filter((it) => !!it);
      const equipped = Object.fromEntries(gear.map((g) => [g!.slot, g!.id]));
      const max = hpMax(level, attributes, effectiveSkills(attributes, skills, equipped));
      await c.query(
        `INSERT INTO characters (player_id, name, faction, portrait, level, gold, honor, hp, hp_at, energy, energy_at, attributes, skills)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $9, $11, $12)`,
        [id, name, faction, 1 + (i % 4), level, 150 + level * 120, (i * 37) % 160 - 30, max, now, ENERGY_MAX, JSON.stringify(attributes), JSON.stringify(skills)],
      );
      for (const g of gear) await c.query('INSERT INTO inventory (player_id, item_id, equipped) VALUES ($1, $2, true)', [id, g!.id]);
      // Les guerriers de niveau 3 et plus s'enrôlent pour la prochaine bataille.
      if (level >= 3) {
        const targets = [];
        for (const t of Object.values(TERRITORIES)) if (await canAttack(c, faction, t.id)) targets.push(t.id);
        const territory = i % 2 === 0 && targets.length ? targets[i % targets.length]! : TERRITORIES[['clairval', 'al-rimal', 'hrafnborg'][FACTIONS.indexOf(faction)]!]!.neighbors.find((n) => !TERRITORIES[n]!.capital)!;
        const lines = ['avant-garde', 'corps', 'arriere-garde'];
        const { rows: own } = await c.query('SELECT owner FROM territories WHERE id = $1', [territory]);
        if (own[0].owner === faction || (await canAttack(c, faction, territory)))
          await c.query('INSERT INTO enlistments (player_id, territory_id, line) VALUES ($1, $2, $3)', [id, territory, lines[i % 3]]);
      }
    }
  }
});
console.log('Monde peuplé : 21 guerriers (mot de passe : aldoria).');
await pool.end();
