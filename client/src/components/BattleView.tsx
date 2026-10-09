import { useEffect, useState } from 'react';
import { FACTION_INFO, TERRITORIES, type Faction } from '@aldoria/shared';
import { api } from '../api';
import { art } from '../assets';
import { Crest, Img, Modal } from '../ui';

interface Battle {
  id: number;
  week: number;
  territoryId: string;
  previousOwner: Faction | null;
  newOwner: Faction | null;
  teams: { key: string; faction: Faction; defender: boolean; fighters: { id: number; name: string; level: number }[] }[];
  duels: { a: { team: string; name: string; hpStart: number }; b: { team: string; name: string; hpStart: number }; winner: 'a' | 'b'; rounds: number }[];
  kills: Record<string, number>;
  survivors: Record<string, number>;
  winner: string | null;
}

export default function BattleView({ id, onClose }: { id: number; onClose: () => void }) {
  const [b, setB] = useState<Battle | null>(null);
  useEffect(() => {
    api<Battle>(`/api/battles/${id}`).then(setB).catch(onClose);
  }, [id, onClose]);
  if (!b) return null;
  const names = Object.fromEntries(b.teams.flatMap((t) => t.fighters.map((f) => [String(f.id), f.name])));
  const best = Object.entries(b.kills).sort((x, y) => y[1] - x[1])[0];
  return (
    <Modal title={`Bataille de ${TERRITORIES[b.territoryId]?.name} · semaine ${b.week}`} onClose={onClose}>
      <Img src={art.action('bataille')} alt="" className="banner-img" />
      <p className="battle-result">
        {b.newOwner && b.newOwner !== b.previousOwner ? (
          <>
            <Crest faction={b.newOwner} size={20} /> {FACTION_INFO[b.newOwner].name} s'empare du territoire.
          </>
        ) : b.newOwner ? (
          <>
            <Crest faction={b.newOwner} size={20} /> {FACTION_INFO[b.newOwner].name} tient bon.
          </>
        ) : (
          'Personne ne reste maître du terrain.'
        )}
        {best && ` Meilleur combattant : ${names[best[0]]} (${best[1]} adversaire${best[1] > 1 ? 's' : ''} abattu${best[1] > 1 ? 's' : ''}).`}
      </p>
      <div className="battle-teams">
        {b.teams.map((t) => (
          <div key={t.key} className={`battle-team ${b.winner === t.key ? 'winner' : ''}`}>
            <h3>
              <Crest faction={t.faction} size={18} /> {FACTION_INFO[t.faction].short} {t.defender && <small>(défenseurs)</small>}
            </h3>
            <ol>
              {t.fighters.map((f) => (
                <li key={f.id}>
                  {f.name} <span className="muted">niv. {f.level}</span>
                  {b.kills[String(f.id)] ? <b> · {b.kills[String(f.id)]} ⚔</b> : null}
                </li>
              ))}
            </ol>
            <small className="muted">{b.survivors[t.key] ?? 0} encore debout</small>
          </div>
        ))}
      </div>
      <h3>Déroulé des duels</h3>
      <ol className="duel-list">
        {b.duels.map((d, i) => {
          const w = d.winner === 'a' ? d.a : d.b;
          const l = d.winner === 'a' ? d.b : d.a;
          return (
            <li key={i}>
              <Crest faction={w.team as Faction} size={14} /> <b>{w.name}</b> ({w.hpStart} PV) abat <Crest faction={l.team as Faction} size={14} /> {l.name} en {d.rounds} round
              {d.rounds > 1 ? 's' : ''}
            </li>
          );
        })}
      </ol>
    </Modal>
  );
}
