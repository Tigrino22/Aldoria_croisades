import { useEffect, useState } from 'react';
import { FACTION_INFO, type Faction } from '@aldoria/shared';
import { api } from '../api';
import { art } from '../assets';
import { gameMinutes } from '../format';
import { useGame } from '../game';
import { Countdown, Crest, Img, Panel, Portrait } from '../ui';
import PlayerModal from './PlayerModal';

interface Target {
  id: number;
  name: string;
  faction: Faction;
  portrait: number;
  level: number;
  rank: string;
  honor: number;
  honorTitle: string;
  outlaw: boolean;
  hpRatio: number;
  protectedUntil: string | null;
  blocker: string | null;
  dishonorable: boolean;
  wins: number;
  losses: number;
}

export default function WarPage() {
  const { me, world, run, tick, refresh } = useGame();
  const [targets, setTargets] = useState<Target[] | null>(null);
  const [search, setSearch] = useState('');
  const [profile, setProfile] = useState<number | null>(null);

  const load = () => api<Target[]>(`/api/targets${search ? `?search=${encodeURIComponent(search)}` : ''}`).then(setTargets).catch(() => undefined);
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  if (!me) return null;
  const busy = !!me.action;

  return (
    <div className="page">
      <Panel className="intro-panel">
        <Img src={art.action('pillage')} alt="" className="banner-img" />
        <div>
          <h2>Pillages et duels</h2>
          <p>
            <b>Piller</b> : vous marchez {gameMinutes(10, world?.speed ?? 1)} jusqu'à la cible, puis combattez avec votre profil d'attaque contre son profil de défense. La victoire
            emporte jusqu'à 10 % de son or exposé. <b>Défier</b> : un duel immédiat, sans vol, pour l'honneur et l'expérience.
          </p>
          <p className="muted">
            Défier plus fort que soi est glorieux. S'en prendre aux faibles ou aux blessés est déshonorant, et sous {-100} d'honneur vous deviendrez hors-la-loi.
          </p>
        </div>
      </Panel>

      <Panel
        title="Adversaires"
        actions={
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              load();
            }}
          >
            <input placeholder="Chercher un nom" value={search} onChange={(e) => setSearch(e.target.value)} />
            <button className="btn">Chercher</button>
          </form>
        }
      >
        {!targets && <p className="muted">Les éclaireurs reviennent…</p>}
        {targets?.length === 0 && <p className="muted">Aucun adversaire en vue. Les autres factions n'ont peut-être pas encore de guerriers.</p>}
        <div className="targets">
          {targets?.map((t) => (
            <div key={t.id} className={`target ${t.blocker ? 'blocked' : ''}`}>
              <button className="target-portrait" onClick={() => setProfile(t.id)}>
                <Portrait faction={t.faction} n={t.portrait} className="portrait-sm" />
              </button>
              <div className="target-info">
                <strong>
                  <Crest faction={t.faction} size={16} /> {t.name}
                </strong>
                <span className="muted">
                  {t.rank} · niv. {t.level} · {FACTION_INFO[t.faction].short}
                </span>
                <span className={t.outlaw ? 'outlaw' : 'muted'}>
                  {t.honorTitle} ({t.honor}) · {t.wins} V / {t.losses} D · {Math.round(t.hpRatio * 100)} % PV
                </span>
                {t.protectedUntil && (
                  <span className="muted">
                    Protégé encore <Countdown until={t.protectedUntil} />
                  </span>
                )}
                {t.dishonorable && <span className="warn">Bien plus faible que vous : l'attaquer vous coûtera de l'honneur.</span>}
                {t.hpRatio < 0.3 && <span className="warn">Blessé : le frapper serait une lâcheté.</span>}
                {t.outlaw && <span className="ok">Hors-la-loi : sa tête est mise à prix.</span>}
              </div>
              <div className="target-actions">
                <button
                  className="btn btn-primary"
                  disabled={!!t.blocker || busy || me.energy < 1}
                  title={t.blocker ?? undefined}
                  onClick={() => run(() => api('/api/action/pillage', { body: { targetId: t.id } }), `Vos hommes marchent sur ${t.name}`)}
                >
                  Piller
                </button>
                <button
                  className="btn"
                  disabled={!!t.blocker || busy || me.energy < 1}
                  onClick={async () => {
                    const res = await run(() => api<{ won: boolean }>('/api/action/duel', { body: { targetId: t.id } }));
                    if (res) {
                      await refresh();
                      load();
                    }
                  }}
                >
                  Défier
                </button>
              </div>
            </div>
          ))}
        </div>
      </Panel>
      {profile && <PlayerModal id={profile} onClose={() => setProfile(null)} />}
    </div>
  );
}
