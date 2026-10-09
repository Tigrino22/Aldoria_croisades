import {
  ENEMY_BY_ID,
  FACTION_INFO,
  JOB_BY_ID,
  MIN_HP_TO_FIGHT,
  MIN_TARGET_LEVEL_RATIO,
  OUTLAW_BOUNTY_PER_LEVEL,
  PATROL_MINUTES,
  PILLAGE_DEFEAT_SHARE,
  PILLAGE_LOOT_SHARE,
  PILLAGE_MARCH_MINUTES,
  PILLAGE_PROTECTION_MINUTES,
  WORK_DURATIONS,
  duel,
  emptySkills,
  exposedGold,
  honorChange,
  hospitalCost,
  isOutlaw,
  jobPoints,
  randomSeed,
  ratings,
  rng,
  workReward,
  type DuelResult,
  type Fighter,
  type SkillSet,
} from '@aldoria/shared';
import type { Db } from '../db';
import { env, gameMs } from '../env';
import { GameError } from '../errors';
import type { Outbox } from '../notify';
import { fighterOf, loadChar, ownedTerritories, saveVitals, type Char, type StoredAction } from './character';
import { addReport, giveItem, grant } from './progress';

function requireIdle(ch: Char) {
  if (ch.row.action) throw new GameError(`Votre personnage est occupé : ${ch.row.action.label}`);
}

function requireFit(ch: Char) {
  if (ch.hp < ch.hpMax * MIN_HP_TO_FIGHT) throw new GameError("Vous êtes trop blessé pour combattre. Reposez-vous ou passez à l'hôpital.");
}

function spendEnergy(ch: Char) {
  if (ch.energy < 1) throw new GameError("Vous n'avez plus d'énergie. Elle revient avec le temps.");
  ch.energy -= 1;
}

async function startAction(c: Db, ch: Char, now: Date, type: StoredAction['type'], ref: string, label: string, minutes: number, data: object) {
  const endsAt = new Date(now.getTime() + gameMs(minutes));
  const { rows } = await c.query('INSERT INTO events (player_id, type, due_at, data) VALUES ($1, $2, $3, $4) RETURNING id', [
    ch.row.player_id,
    type,
    endsAt,
    JSON.stringify({ ref, minutes, ...data }),
  ]);
  const action: StoredAction = { type, ref, label, startedAt: now.toISOString(), endsAt: endsAt.toISOString(), eventId: rows[0].id };
  await c.query('UPDATE characters SET action = $2 WHERE player_id = $1', [ch.row.player_id, JSON.stringify(action)]);
  ch.row.action = action;
  return action;
}

// ---------- Travail ----------

export async function startWork(c: Db, playerId: number, jobId: string, minutes: number, now: Date) {
  const job = JOB_BY_ID[jobId];
  if (!job) throw new GameError('Travail inconnu');
  if (!WORK_DURATIONS.includes(minutes)) throw new GameError('Durée de travail invalide');
  const ch = await loadChar(c, playerId, now);
  requireIdle(ch);
  if (jobPoints(job, ch.effective) < job.required) throw new GameError(`Il vous faut ${job.required} points de travail pour : ${job.name}`);
  return startAction(c, ch, now, 'work', job.id, job.name, minutes, {});
}

async function finishWork(c: Db, playerId: number, jobId: string, minutes: number, outbox: Outbox, partial = false) {
  const job = JOB_BY_ID[jobId]!;
  const ch = await loadChar(c, playerId, new Date());
  const reward = workReward(job, ch.effective, minutes, await ownedTerritories(c, ch.row.faction));
  await grant(c, playerId, reward, outbox);
  await addReport(
    c,
    playerId,
    'work',
    `${partial ? 'Travail interrompu' : 'Travail terminé'} : ${job.name}`,
    { jobId, minutes: Math.round(minutes), gold: reward.gold, xp: reward.xp, honor: reward.honor },
    outbox,
  );
}

export async function cancelAction(c: Db, playerId: number, now: Date, outbox: Outbox) {
  const ch = await loadChar(c, playerId, now);
  const a = ch.row.action;
  if (!a) throw new GameError('Aucune action en cours');
  if (a.type !== 'work') throw new GameError('Impossible de faire demi-tour : vos hommes sont déjà en route.');
  const elapsed = ((now.getTime() - new Date(a.startedAt).getTime()) * env.worldSpeed) / 60_000;
  await c.query('DELETE FROM events WHERE id = $1', [a.eventId]);
  await c.query('UPDATE characters SET action = NULL WHERE player_id = $1', [playerId]);
  if (elapsed >= 1) await finishWork(c, playerId, a.ref, elapsed, outbox, true);
}

// ---------- Patrouille (combat contre le jeu) ----------

export function enemyFighter(id: string): Fighter {
  const e = ENEMY_BY_ID[id]!;
  const skills: SkillSet = { ...emptySkills(), ...e.skills };
  return { id: e.id, name: e.name, level: e.level, hp: e.hp, hpMax: e.hp, damage: e.damage, ratings: ratings('defense', skills, e.armor) };
}

export async function startPatrol(c: Db, playerId: number, enemyId: string, now: Date) {
  const enemy = ENEMY_BY_ID[enemyId];
  if (!enemy) throw new GameError('Ennemi inconnu');
  const ch = await loadChar(c, playerId, now);
  requireIdle(ch);
  requireFit(ch);
  if (enemy.level > ch.row.level + 3) throw new GameError(`Cet ennemi est trop redoutable pour vous (niveau ${enemy.level}).`);
  spendEnergy(ch);
  await saveVitals(c, ch, now);
  return startAction(c, ch, now, 'patrol', enemy.id, `Patrouille : ${enemy.name}`, PATROL_MINUTES, {});
}

async function finishPatrol(c: Db, playerId: number, enemyId: string, now: Date, outbox: Outbox) {
  const enemy = ENEMY_BY_ID[enemyId]!;
  const ch = await loadChar(c, playerId, now);
  const seed = randomSeed();
  const r = rng(seed);
  const me = fighterOf(ch, 'attaque');
  const res = duel(me, enemyFighter(enemyId), r);
  ch.hp = res.hpA;
  await saveVitals(c, ch, now);
  const won = res.winner === 'a';
  let gold = 0;
  let xp = Math.round(enemy.xp / 4);
  let drop: string | null = null;
  if (won) {
    gold = r.int(enemy.gold[0], enemy.gold[1]);
    xp = enemy.xp;
    for (const d of enemy.drops) if (!drop && r.chance(d.chance)) drop = d.item;
    if (drop) await giveItem(c, playerId, drop);
  }
  await c.query(`UPDATE characters SET ${won ? 'wins = wins + 1' : 'losses = losses + 1'} WHERE player_id = $1`, [playerId]);
  await grant(c, playerId, { xp, gold }, outbox);
  await addReport(
    c,
    playerId,
    'patrol',
    won ? `Victoire contre : ${enemy.name}` : `Défaite contre : ${enemy.name}`,
    { enemyId, won, gold, xp, drop, combat: combatLog(res, me, enemyFighter(enemyId)) },
    outbox,
  );
}

// ---------- Combats entre joueurs ----------

function combatLog(res: DuelResult, a: Fighter, b: Fighter) {
  return {
    a: { id: a.id, name: a.name, level: a.level, hpStart: Math.round(a.hp), hpMax: a.hpMax, faction: a.faction ?? null },
    b: { id: b.id, name: b.name, level: b.level, hpStart: Math.round(b.hp), hpMax: b.hpMax, faction: b.faction ?? null },
    winner: res.winner,
    ko: res.ko,
    hpA: Math.round(res.hpA),
    hpB: Math.round(res.hpB),
    rounds: res.rounds,
  };
}

/** Vérifie qu'un joueur peut en attaquer un autre, et renvoie la raison sinon. */
export function attackBlocker(att: Char, def: Char, now: Date, kind: 'pillage' | 'duel'): string | null {
  if (att.row.player_id === def.row.player_id) return 'Vous ne pouvez pas vous attaquer vous-même.';
  if (att.row.faction === def.row.faction && !isOutlaw(def.row.honor)) return 'On ne lève pas l’épée contre les siens, sauf contre un hors-la-loi.';
  if (def.row.level < Math.ceil(att.row.level * MIN_TARGET_LEVEL_RATIO)) return 'Cet adversaire est bien trop faible pour vous.';
  const prot = def.row.protected_until ? new Date(def.row.protected_until) : null;
  if (prot && prot > now) return kind === 'pillage' ? 'Cette cible est sous protection.' : 'Ce joueur est sous protection de débutant.';
  return null;
}

async function clearOwnProtection(c: Db, ch: Char) {
  // Attaquer met fin à sa propre protection.
  await c.query('UPDATE characters SET protected_until = NULL WHERE player_id = $1', [ch.row.player_id]);
}

export async function startPillage(c: Db, playerId: number, targetId: number, now: Date, outbox: Outbox) {
  const ch = await loadChar(c, playerId, now);
  const target = await loadChar(c, targetId, now, false);
  requireIdle(ch);
  requireFit(ch);
  const blocker = attackBlocker(ch, target, now, 'pillage');
  if (blocker) throw new GameError(blocker);
  spendEnergy(ch);
  await saveVitals(c, ch, now);
  await clearOwnProtection(c, ch);
  const action = await startAction(c, ch, now, 'pillage', String(targetId), `Pillage chez ${target.row.name}`, PILLAGE_MARCH_MINUTES, { targetId });
  outbox.push(targetId, { type: 'attacked', by: ch.row.name, arriveAt: action.endsAt });
  return action;
}

async function resolvePillage(c: Db, playerId: number, targetId: number, now: Date, outbox: Outbox) {
  const att = await loadChar(c, playerId, now);
  const def = await loadChar(c, targetId, now);
  const blocker = attackBlocker(att, def, now, 'pillage');
  if (blocker) {
    await addReport(c, playerId, 'pillage', `Pillage annulé chez ${def.row.name}`, { aborted: blocker }, outbox);
    return;
  }
  const r = rng(randomSeed());
  const fa = fighterOf(att, 'attaque');
  const fd = fighterOf(def, 'defense');
  const res = duel(fa, fd, r);
  const won = res.winner === 'a';
  const honor = honorChange({
    kind: 'pillage',
    attackerLevel: att.row.level,
    defenderLevel: def.row.level,
    attackerWon: won,
    defenderHpRatio: def.hp / def.hpMax,
    defenderOutlaw: isOutlaw(def.row.honor),
  });
  att.hp = res.hpA;
  def.hp = res.hpB;
  await saveVitals(c, att, now);
  await saveVitals(c, def, now);

  let loot = 0;
  let bounty = 0;
  let lost = 0;
  if (won) {
    loot = Math.floor(exposedGold(def.row.gold, def.row.level) * PILLAGE_LOOT_SHARE * (att.row.faction === 'givre' ? 1.05 : 1));
    if (isOutlaw(def.row.honor)) bounty = def.row.level * OUTLAW_BOUNTY_PER_LEVEL;
    await c.query('UPDATE characters SET gold = gold - $2, protected_until = $3, losses = losses + 1 WHERE player_id = $1', [
      targetId,
      loot,
      new Date(now.getTime() + gameMs(PILLAGE_PROTECTION_MINUTES)),
    ]);
    await c.query('UPDATE characters SET wins = wins + 1, pillages = pillages + 1, gold_looted = gold_looted + $2 WHERE player_id = $1', [
      playerId,
      loot + bounty,
    ]);
    await grant(c, playerId, { xp: 10 + def.row.level * 4, gold: loot + bounty, honor: honor.attacker }, outbox);
    await grant(c, targetId, { xp: 2, honor: honor.defender }, outbox);
  } else {
    lost = Math.floor(exposedGold(att.row.gold, att.row.level) * PILLAGE_DEFEAT_SHARE);
    await c.query('UPDATE characters SET losses = losses + 1 WHERE player_id = $1', [playerId]);
    await c.query('UPDATE characters SET wins = wins + 1 WHERE player_id = $1', [targetId]);
    await grant(c, playerId, { xp: 3 + def.row.level, gold: -lost, honor: honor.attacker }, outbox);
    await grant(c, targetId, { xp: 5 + att.row.level * 2, gold: lost, honor: honor.defender }, outbox);
  }
  const log = combatLog(res, fa, fd);
  const common = { kind: 'pillage', combat: log, loot, bounty, lost, honor };
  await addReport(c, playerId, 'pillage', won ? `Pillage réussi chez ${def.row.name}` : `Pillage repoussé par ${def.row.name}`, { ...common, side: 'a' }, outbox);
  await addReport(c, targetId, 'defense', won ? `${att.row.name} vous a pillé` : `Vous avez repoussé ${att.row.name}`, { ...common, side: 'b' }, outbox);
}

export async function fightDuel(c: Db, playerId: number, targetId: number, now: Date, outbox: Outbox) {
  const att = await loadChar(c, playerId, now);
  const def = await loadChar(c, targetId, now);
  requireIdle(att);
  requireFit(att);
  const blocker = attackBlocker(att, def, now, 'duel');
  if (blocker) throw new GameError(blocker);
  if (def.hp < def.hpMax * MIN_HP_TO_FIGHT) throw new GameError('Ce joueur est trop blessé pour relever un défi.');
  spendEnergy(att);
  await clearOwnProtection(c, att);
  const fa = fighterOf(att, 'attaque');
  const fd = fighterOf(def, 'defense');
  const res = duel(fa, fd, rng(randomSeed()));
  const won = res.winner === 'a';
  const honor = honorChange({
    kind: 'duel',
    attackerLevel: att.row.level,
    defenderLevel: def.row.level,
    attackerWon: won,
    defenderHpRatio: def.hp / def.hpMax,
    defenderOutlaw: isOutlaw(def.row.honor),
  });
  att.hp = res.hpA;
  def.hp = res.hpB;
  await saveVitals(c, att, now);
  await saveVitals(c, def, now);
  await c.query(`UPDATE characters SET ${won ? 'wins = wins + 1' : 'losses = losses + 1'} WHERE player_id = $1`, [playerId]);
  await c.query(`UPDATE characters SET ${won ? 'losses = losses + 1' : 'wins = wins + 1'} WHERE player_id = $1`, [targetId]);
  const bounty = won && isOutlaw(def.row.honor) ? def.row.level * OUTLAW_BOUNTY_PER_LEVEL : 0;
  await grant(c, playerId, { xp: won ? 8 + def.row.level * 3 : 2 + def.row.level, gold: bounty, honor: honor.attacker }, outbox);
  await grant(c, targetId, { xp: won ? 2 : 4 + att.row.level * 2, honor: honor.defender }, outbox);
  const log = combatLog(res, fa, fd);
  const data = { kind: 'duel', combat: log, bounty, honor };
  const reportId = await addReport(c, playerId, 'duel', won ? `Duel gagné contre ${def.row.name}` : `Duel perdu contre ${def.row.name}`, { ...data, side: 'a' }, outbox);
  await addReport(c, targetId, 'duel', won ? `${att.row.name} vous a vaincu en duel` : `Vous avez gagné un duel contre ${att.row.name}`, { ...data, side: 'b' }, outbox);
  return { reportId, won };
}

// ---------- Hôpital ----------

export async function heal(c: Db, playerId: number, now: Date) {
  const ch = await loadChar(c, playerId, now);
  const missing = Math.ceil(ch.hpMax - ch.hp);
  if (missing <= 0) throw new GameError('Vous êtes déjà en pleine forme.');
  const cost = hospitalCost(missing, ch.row.level);
  if (ch.row.gold < cost) throw new GameError(`Les soins coûtent ${cost} pièces d'or.`);
  ch.hp = ch.hpMax;
  await saveVitals(c, ch, now);
  await c.query('UPDATE characters SET gold = gold - $2 WHERE player_id = $1', [playerId, cost]);
  return { cost };
}

// ---------- Événements datés ----------

export async function runEvent(c: Db, ev: { id: number; player_id: number; type: string; data: any }, now: Date, outbox: Outbox) {
  await c.query('DELETE FROM events WHERE id = $1', [ev.id]);
  await c.query(`UPDATE characters SET action = NULL WHERE player_id = $1 AND (action->>'eventId')::int = $2`, [ev.player_id, ev.id]);
  if (ev.type === 'work') await finishWork(c, ev.player_id, ev.data.ref, ev.data.minutes, outbox);
  else if (ev.type === 'patrol') await finishPatrol(c, ev.player_id, ev.data.ref, now, outbox);
  else if (ev.type === 'pillage') await resolvePillage(c, ev.player_id, ev.data.targetId, now, outbox);
  outbox.push(ev.player_id, { type: 'me' });
}

export const factionName = (f: keyof typeof FACTION_INFO) => FACTION_INFO[f].name;
