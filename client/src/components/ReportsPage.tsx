import { useEffect, useState } from 'react';
import { ENEMY_BY_ID, ITEMS, JOB_BY_ID, TERRITORIES, type Faction, type Strike } from '@aldoria/shared';
import { api } from '../api';
import { art } from '../assets';
import { ago } from '../format';
import { useGame } from '../game';
import { Crest, Gold, Img, ItemIcon, Panel } from '../ui';
import BattleView from './BattleView';

interface ReportSummary {
  id: number;
  kind: string;
  title: string;
  read: boolean;
  createdAt: string;
}

interface Combat {
  a: { name: string; level: number; hpStart: number; hpMax: number; faction: Faction | null };
  b: { name: string; level: number; hpStart: number; hpMax: number; faction: Faction | null };
  winner: 'a' | 'b';
  ko: boolean;
  hpA: number;
  hpB: number;
  rounds: Strike[][];
}

const KIND_IMG: Record<string, Parameters<typeof art.action>[0]> = {
  work: 'travail',
  patrol: 'patrouille',
  pillage: 'pillage',
  defense: 'pillage',
  duel: 'duel',
  battle: 'bataille',
};

function CombatLog({ c }: { c: Combat }) {
  return (
    <div className="combat">
      <div className="combatants">
        <div className={c.winner === 'a' ? 'winner' : ''}>
          {c.a.faction && <Crest faction={c.a.faction} size={18} />} <b>{c.a.name}</b> niv. {c.a.level}
          <small>
            {c.a.hpStart} → {c.hpA} PV
          </small>
        </div>
        <span className="vs">contre</span>
        <div className={c.winner === 'b' ? 'winner' : ''}>
          {c.b.faction && <Crest faction={c.b.faction} size={18} />} <b>{c.b.name}</b> niv. {c.b.level}
          <small>
            {c.b.hpStart} → {c.hpB} PV
          </small>
        </div>
      </div>
      <ol className="rounds">
        {c.rounds.map((round, i) => (
          <li key={i}>
            <span className="round-n">Round {i + 1}</span>
            {round.map((s, j) => {
              const who = s.by === 'a' ? c.a.name : c.b.name;
              return (
                <span key={j} className={s.hit ? (s.crit ? 'crit' : 'hit') : 'miss'}>
                  {s.hit ? `${who} frappe${s.crit ? ' violemment' : ''} : −${s.damage} PV` : `${who} manque son coup`}
                </span>
              );
            })}
          </li>
        ))}
      </ol>
      <p className="combat-end">
        {c.winner === 'a' ? c.a.name : c.b.name} l'emporte{c.ko ? ' : son adversaire est à terre.' : ' aux points.'}
      </p>
    </div>
  );
}

function ReportDetail({ id, onBattle }: { id: number; onBattle: (id: number) => void }) {
  const [r, setR] = useState<{ kind: string; title: string; data: any; createdAt: string } | null>(null);
  const { refresh } = useGame();
  useEffect(() => {
    api(`/api/reports/${id}`)
      .then((x) => {
        setR(x);
        refresh();
      })
      .catch(() => undefined);
  }, [id, refresh]);
  if (!r) return null;
  const d = r.data;
  const img =
    r.kind === 'patrol' ? art.enemy(d.enemyId) : r.kind === 'work' ? art.job(d.jobId) : art.action(KIND_IMG[r.kind] ?? 'duel');
  return (
    <div className="report-detail">
      <Img src={img} alt="" className="banner-img" />
      <h2>{r.title}</h2>
      {r.kind === 'work' && (
        <p>
          {JOB_BY_ID[d.jobId]?.name} pendant {d.minutes} minutes de jeu : <Gold n={d.gold} />, {d.xp} XP{d.honor > 0 && `, +${d.honor} honneur`}.
        </p>
      )}
      {r.kind === 'patrol' && (
        <>
          <p>
            {d.won ? 'Victoire' : 'Défaite'} contre {ENEMY_BY_ID[d.enemyId]?.name} : <Gold n={d.gold} />, {d.xp} XP.
          </p>
          {d.drop && (
            <p className="loot">
              <ItemIcon id={d.drop} size="sm" /> Butin : <b>{ITEMS[d.drop]?.name}</b>
            </p>
          )}
        </>
      )}
      {(r.kind === 'pillage' || r.kind === 'defense' || r.kind === 'duel') && d.aborted && <p>{d.aborted}</p>}
      {(r.kind === 'pillage' || r.kind === 'defense') && !d.aborted && (
        <p>
          {d.loot > 0 && (
            <>
              Or emporté : <Gold n={d.loot} />.{' '}
            </>
          )}
          {d.lost > 0 && (
            <>
              Rançon payée par l'assaillant vaincu : <Gold n={d.lost} />.{' '}
            </>
          )}
          {d.bounty > 0 && (
            <>
              Prime pour un hors-la-loi : <Gold n={d.bounty} />.
            </>
          )}
        </p>
      )}
      {d.honor && (
        <div className="honor-box">
          <b>
            Honneur : {d.side === 'a' ? (d.honor.attacker >= 0 ? '+' : '') + d.honor.attacker : (d.honor.defender >= 0 ? '+' : '') + d.honor.defender}
          </b>
          <ul>
            {d.honor.reasons.map((x: string) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      )}
      {d.combat && <CombatLog c={d.combat} />}
      {r.kind === 'battle' && (
        <>
          <p>
            Bataille de {TERRITORIES[d.territoryId]?.name} : {d.kills} adversaire{d.kills > 1 ? 's' : ''} abattu{d.kills > 1 ? 's' : ''}, +{d.honor} honneur
            {d.best && ', meilleur combattant de la bataille !'}
          </p>
          <button className="btn btn-primary" onClick={() => onBattle(d.battleId)}>
            Voir toute la bataille
          </button>
        </>
      )}
    </div>
  );
}

export default function ReportsPage() {
  const { tick, refresh } = useGame();
  const [list, setList] = useState<ReportSummary[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [battle, setBattle] = useState<number | null>(null);

  useEffect(() => {
    api<ReportSummary[]>('/api/reports').then(setList).catch(() => undefined);
  }, [tick, open]);

  return (
    <div className="page reports-page">
      <Panel
        title="Rapports"
        actions={
          <button
            className="btn"
            onClick={async () => {
              await api('/api/reports/read-all', { body: {} });
              setList((l) => l.map((r) => ({ ...r, read: true })));
              refresh();
            }}
          >
            Tout marquer comme lu
          </button>
        }
      >
        <div className="reports">
          <ul className="report-list">
            {list.length === 0 && <li className="muted">Aucun rapport pour l'instant.</li>}
            {list.map((r) => (
              <li key={r.id} className={`${r.read ? '' : 'unread'} ${open === r.id ? 'active' : ''} kind-${r.kind}`} onClick={() => setOpen(r.id)}>
                <span>{r.title}</span>
                <small>{ago(r.createdAt)}</small>
              </li>
            ))}
          </ul>
          <div className="report-pane">{open ? <ReportDetail id={open} onBattle={setBattle} /> : <p className="muted">Choisissez un rapport.</p>}</div>
        </div>
      </Panel>
      {battle && <BattleView id={battle} onClose={() => setBattle(null)} />}
    </div>
  );
}
