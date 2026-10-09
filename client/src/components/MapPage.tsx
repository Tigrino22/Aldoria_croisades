import { useEffect, useState } from 'react';
import {
  BATTLE_LINES,
  BATTLE_MIN_LEVEL,
  FACTIONS,
  FACTION_INFO,
  MAP_COAST,
  MAP_HEIGHT,
  MAP_WIDTH,
  TERRITORIES,
  type BattleLine,
  type Faction,
} from '@aldoria/shared';
import { api } from '../api';
import { art } from '../assets';
import { dateTime } from '../format';
import { useGame } from '../game';
import { Countdown, Crest, Img, Panel } from '../ui';
import BattleView from './BattleView';

interface MapTerritory {
  id: string;
  owner: Faction | null;
  ownerSince: number;
  enlisted: Record<Faction, number>;
  canDefend: boolean;
  canAttack: boolean;
  capital: boolean;
  lastBattle: { id: number; previousOwner: Faction | null; newOwner: Faction | null } | null;
}

interface MapData {
  week: number;
  nextBattleAt: string;
  territories: MapTerritory[];
}

const path = (pts: [number, number][]) => `M${pts.map((p) => `${p[0]},${p[1]}`).join('L')}Z`;

export default function MapPage() {
  const { me, run, tick, refresh } = useGame();
  const [data, setData] = useState<MapData | null>(null);
  const [selected, setSelected] = useState<string>('selenar');
  const [line, setLine] = useState<BattleLine>('corps');
  const [roster, setRoster] = useState<{ id: number; name: string; faction: Faction; level: number; line: BattleLine }[]>([]);
  const [battleId, setBattleId] = useState<number | null>(null);

  const load = () => api<MapData>('/api/map').then(setData).catch(() => undefined);
  useEffect(() => {
    load();
  }, [tick]);
  useEffect(() => {
    api(`/api/map/enlisted/${selected}`).then(setRoster).catch(() => setRoster([]));
  }, [selected, tick, me?.enlistment]);

  if (!me || !data) return <div className="loading">Les cartographes déroulent la carte…</div>;
  const t = data.territories.find((x) => x.id === selected)!;
  const info = TERRITORIES[selected]!;
  const mine = me.enlistment?.territoryId === selected;

  async function enlist() {
    const ok = await run(() => api('/api/map/enlist', { body: { territoryId: selected, line } }), `Vous rejoignez l'armée à ${info.name}`);
    if (ok) {
      await refresh();
      load();
    }
  }

  return (
    <div className="page map-page">
      <Panel
        title={`Guerre des territoires · semaine ${data.week}`}
        actions={
          <span className="battle-clock">
            Prochaine bataille <Countdown until={data.nextBattleAt} done="en cours…" /> <small className="muted">({dateTime(data.nextBattleAt)})</small>
          </span>
        }
      >
        <div className="map-wrap">
          <Img src={art.map} alt="Carte d'Aldoria" className="map-img" fallback={<div className="map-img map-fallback" />} />
          <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} className="map-svg">
            <defs>
              <filter id="glow">
                <feGaussianBlur stdDeviation="6" />
              </filter>
            </defs>
            <path d={path(MAP_COAST)} className="coastline" />
            {data.territories.map((x) => {
              const ti = TERRITORIES[x.id]!;
              const color = x.owner ? FACTION_INFO[x.owner].color : '#9a9078';
              return (
                <g key={x.id} className={`territory ${selected === x.id ? 'selected' : ''}`} onClick={() => setSelected(x.id)}>
                  <path d={path(ti.polygon)} fill={color} fillOpacity={x.owner ? 0.28 : 0.1} stroke={color} />
                </g>
              );
            })}
            {data.territories.map((x) => {
              const ti = TERRITORIES[x.id]!;
              const total = FACTIONS.reduce((s, f) => s + x.enlisted[f], 0);
              return (
                <g key={`l-${x.id}`} className="territory-label" transform={`translate(${ti.center[0]},${ti.center[1]})`} onClick={() => setSelected(x.id)}>
                  {x.owner && <image href={art.crest(x.owner)} x={-26} y={-62} width={52} height={52} />}
                  {x.capital && <text y={-70} className="capital-mark">♛</text>}
                  <text className="t-name" y={8}>
                    {ti.label}
                  </text>
                  {total > 0 && (
                    <text className="t-army" y={36}>
                      ⚔ {total}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
        <div className="legend">
          {FACTIONS.map((f) => (
            <span key={f}>
              <Crest faction={f} size={16} /> {FACTION_INFO[f].name} : {data.territories.filter((x) => x.owner === f).length} territoires
            </span>
          ))}
          <span className="muted">Territoires libres : {data.territories.filter((x) => !x.owner).length}</span>
        </div>
      </Panel>

      <Panel title={info.name}>
        <p className="muted">{info.description}</p>
        <p>
          {t.owner ? (
            <>
              Tenu par <Crest faction={t.owner} size={16} /> <b>{FACTION_INFO[t.owner].name}</b> depuis la semaine {t.ownerSince}.
            </>
          ) : (
            <>Terre libre, que nul ne tient encore.</>
          )}
          {t.capital && ' Capitale : elle ne peut pas être prise.'}
        </p>
        <div className="enlisted">
          {FACTIONS.map((f) => (
            <span key={f}>
              <Crest faction={f} size={16} /> {t.enlisted[f]} combattant{t.enlisted[f] > 1 ? 's' : ''}
            </span>
          ))}
        </div>

        {mine ? (
          <div className="row">
            <p className="ok">Vous êtes enrôlé ici ({BATTLE_LINES[me.enlistment!.line]}).</p>
            <button
              className="btn"
              onClick={async () => {
                await run(() => api('/api/map/enlist', { method: 'DELETE' }), 'Vous quittez les rangs.');
                await refresh();
                load();
              }}
            >
              Quitter les rangs
            </button>
          </div>
        ) : t.canDefend || t.canAttack ? (
          <div className="enlist-form">
            <p>
              {t.canDefend ? 'Défendez ce territoire' : 'Attaquez ce territoire'} lors de la prochaine bataille. Les combattants s'affrontent un par un, avec leur
              profil de bataille, jusqu'à ce qu'il ne reste qu'une armée debout.
            </p>
            <div className="row">
              <select value={line} onChange={(e) => setLine(e.target.value as BattleLine)}>
                {(Object.keys(BATTLE_LINES) as BattleLine[]).map((l) => (
                  <option key={l} value={l}>
                    {BATTLE_LINES[l]}
                  </option>
                ))}
              </select>
              <button className="btn btn-primary" disabled={me.level < BATTLE_MIN_LEVEL || me.outlaw} onClick={enlist}>
                {me.level < BATTLE_MIN_LEVEL ? `Niveau ${BATTLE_MIN_LEVEL} requis` : me.outlaw ? 'Interdit aux hors-la-loi' : me.enlistment ? 'Changer pour ce territoire' : "S'enrôler"}
              </button>
            </div>
            <small className="muted">L'avant-garde combat en premier, l'arrière-garde en dernier. Un seul territoire par semaine.</small>
          </div>
        ) : (
          <p className="muted">Votre faction doit tenir un territoire voisin pour attaquer celui-ci.</p>
        )}

        {roster.length > 0 && (
          <div className="roster">
            <h3>Armées en présence</h3>
            <ul>
              {roster.map((r) => (
                <li key={r.id}>
                  <Crest faction={r.faction} size={14} /> {r.name} <span className="muted">niv. {r.level} · {BATTLE_LINES[r.line]}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {t.lastBattle && (
          <button className="btn" onClick={() => setBattleId(t.lastBattle!.id)}>
            Voir la dernière bataille
          </button>
        )}
      </Panel>
      {battleId && <BattleView id={battleId} onClose={() => setBattleId(null)} />}
    </div>
  );
}
