import { useEffect, useState } from 'react';
import { FACTION_INFO, type Faction } from '@aldoria/shared';
import { api } from '../api';
import { useGame } from '../game';
import { Crest, Gold, Panel, Portrait, Tabs } from '../ui';
import PlayerModal from './PlayerModal';

type By = 'level' | 'honor' | 'wins' | 'looted';
interface Row {
  position: number;
  id: number;
  name: string;
  faction: Faction;
  portrait: number;
  level: number;
  honor: number;
  honorTitle: string;
  wins: number;
  looted: number;
}

export default function RankingPage() {
  const { me } = useGame();
  const [by, setBy] = useState<By>('level');
  const [rows, setRows] = useState<Row[]>([]);
  const [factions, setFactions] = useState<{ faction: Faction; territories: number; members: number; honor: number }[]>([]);
  const [profile, setProfile] = useState<number | null>(null);

  useEffect(() => {
    api<Row[]>(`/api/ranking?by=${by}`).then(setRows).catch(() => undefined);
  }, [by]);
  useEffect(() => {
    api('/api/factions').then(setFactions).catch(() => undefined);
  }, []);

  return (
    <div className="page">
      <Panel title="Les trois bannières">
        <div className="faction-board">
          {[...factions]
            .sort((a, b) => b.territories - a.territories || b.honor - a.honor)
            .map((f) => (
              <div key={f.faction} className={`faction-score faction-${f.faction}`}>
                <Crest faction={f.faction} size={48} />
                <strong>{FACTION_INFO[f.faction].name}</strong>
                <span>
                  {f.territories} territoires · {f.members} guerriers · {f.honor} honneur
                </span>
              </div>
            ))}
        </div>
      </Panel>
      <Panel title="Classement des guerriers">
        <Tabs
          value={by}
          onChange={setBy}
          tabs={[
            ['level', 'Niveau'],
            ['honor', 'Honneur'],
            ['wins', 'Victoires'],
            ['looted', 'Butin'],
          ]}
        />
        <div className="table-wrap">
        <table className="ranking">
          <thead>
            <tr>
              <th>#</th>
              <th>Guerrier</th>
              <th>Niveau</th>
              <th>Honneur</th>
              <th>Victoires</th>
              <th>Butin</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={r.id === me?.id ? 'me' : ''} onClick={() => setProfile(r.id)}>
                <td>{r.position}</td>
                <td className="who">
                  <Portrait faction={r.faction} n={r.portrait} className="portrait-xs" />
                  <Crest faction={r.faction} size={14} /> {r.name}
                </td>
                <td>{r.level}</td>
                <td title={r.honorTitle}>{r.honor}</td>
                <td>{r.wins}</td>
                <td>
                  <Gold n={r.looted} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Panel>
      {profile && <PlayerModal id={profile} onClose={() => setProfile(null)} />}
    </div>
  );
}
