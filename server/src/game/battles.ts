import {
  BATTLE_HONOR,
  FACTION_INFO,
  TERRITORIES,
  battle,
  isOutlaw,
  randomSeed,
  rng,
  type BattleLine,
  type BattleTeam,
  type Faction,
} from '@aldoria/shared';
import type { Db } from '../db';
import type { Outbox } from '../notify';
import { fighterOf, loadChar } from './character';
import { addReport, grant } from './progress';
import { getWorld, nextBattleDate } from './world';

const LINE_ORDER: Record<BattleLine, number> = { 'avant-garde': 0, corps: 1, 'arriere-garde': 2 };

/** Une faction peut attaquer un territoire si elle possède un territoire voisin et que ce n'est pas une capitale. */
export async function canAttack(c: Db, faction: Faction, territoryId: string, owners?: Record<string, Faction | null>) {
  const t = TERRITORIES[territoryId];
  if (!t || t.capital) return false;
  if (owners) return t.neighbors.some((n) => owners[n] === faction);
  const { rows } = await c.query('SELECT id FROM territories WHERE owner = $1', [faction]);
  const owned = new Set(rows.map((r) => r.id));
  return t.neighbors.some((n) => owned.has(n));
}

/** Résout toutes les batailles de la semaine. Appelé par le worker quand la date est passée. */
export async function resolveBattles(c: Db, now: Date, outbox: Outbox) {
  const { week } = await getWorld(c);
  // Les voisinages sont jugés sur la carte du début de la bataille : une conquête de la nuit ne coupe pas les autres armées.
  const owners = Object.fromEntries((await c.query('SELECT id, owner FROM territories')).rows.map((r) => [r.id, r.owner as Faction | null]));
  const results: { territoryId: string; battleId: number; newOwner: Faction | null }[] = [];

  for (const territoryId of Object.keys(TERRITORIES)) {
    const owner = owners[territoryId] ?? null;
    const enlisted = (
      await c.query(
        `SELECT e.player_id, e.line, e.enlisted_at, ch.faction, ch.honor FROM enlistments e
         JOIN characters ch ON ch.player_id = e.player_id WHERE e.territory_id = $1 ORDER BY e.enlisted_at`,
        [territoryId],
      )
    ).rows.filter((e) => !isOutlaw(e.honor));
    if (enlisted.length === 0) continue;

    const byFaction = new Map<Faction, typeof enlisted>();
    for (const e of enlisted) {
      if (e.faction !== owner && !(await canAttack(c, e.faction, territoryId, owners))) continue;
      byFaction.set(e.faction, [...(byFaction.get(e.faction) ?? []), e]);
    }
    const attackers = [...byFaction.keys()].filter((f) => f !== owner);
    if (attackers.length === 0) continue; // personne n'attaque : les défenseurs gardent le territoire sans combat

    const teams: BattleTeam[] = [];
    for (const [faction, list] of byFaction) {
      list.sort((x, y) => LINE_ORDER[x.line as BattleLine] - LINE_ORDER[y.line as BattleLine] || +x.enlisted_at - +y.enlisted_at);
      const fighters = [];
      for (const e of list) {
        const ch = await loadChar(c, e.player_id, now, false);
        fighters.push(fighterOf(ch, 'bataille', ch.hpMax));
      }
      teams.push({ key: faction, faction, defender: faction === owner, fighters });
    }
    // Les défenseurs ouvrent la bataille.
    teams.sort((a, b) => Number(b.defender) - Number(a.defender));

    const res = battle(teams, rng(randomSeed()));
    const winner = (res.winnerTeam as Faction | null) ?? owner;
    const newOwner = winner;
    if (newOwner !== owner) await c.query('UPDATE territories SET owner = $2, owner_since = $3 WHERE id = $1', [territoryId, newOwner, week]);

    const data = {
      territoryId,
      teams: teams.map((t) => ({ key: t.key, faction: t.faction, defender: t.defender, fighters: t.fighters.map((f) => ({ id: f.id, name: f.name, level: f.level })) })),
      duels: res.duels,
      kills: res.kills,
      survivors: res.survivors,
      winner: res.winnerTeam,
    };
    const { rows } = await c.query(
      'INSERT INTO battles (week, territory_id, previous_owner, new_owner, data) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [week, territoryId, owner, newOwner, JSON.stringify(data)],
    );
    const battleId = rows[0].id as number;
    results.push({ territoryId, battleId, newOwner });

    const best = Object.entries(res.kills).sort((a, b) => b[1] - a[1])[0]?.[0];
    const tName = TERRITORIES[territoryId]!.name;
    for (const team of teams) {
      const victorious = team.key === res.winnerTeam;
      for (const f of team.fighters) {
        const id = Number(f.id);
        const isBest = String(f.id) === best;
        const honor = BATTLE_HONOR.participation + (victorious ? BATTLE_HONOR.victory : 0) + (isBest ? BATTLE_HONOR.bestFighter : 0);
        await c.query('UPDATE characters SET battles = battles + 1 WHERE player_id = $1', [id]);
        await grant(c, id, { xp: 20 + f.level * 3, gold: victorious ? 50 + f.level * 10 : 0, honor }, outbox);
        const title = victorious
          ? newOwner !== owner
            ? `Victoire ! ${tName} tombe aux mains de ${FACTION_INFO[team.faction].name}`
            : `Victoire : ${tName} est tenu`
          : `Défaite à ${tName}`;
        await addReport(c, id, 'battle', title, { battleId, territoryId, victorious, kills: res.kills[String(f.id)] ?? 0, best: isBest, honor }, outbox);
      }
    }
  }

  await c.query('DELETE FROM enlistments');
  await c.query('UPDATE world SET week = week + 1, next_battle_at = $1 WHERE id = 1', [nextBattleDate(now)]);
  outbox.pushAll({ type: 'battle', week });
  return results;
}
