import { useEffect, useState } from 'react';
import { ITEMS, SKILL_INFO, hospitalCost, type EnemyInfo, type JobInfo } from '@aldoria/shared';
import { api } from '../api';
import { art } from '../assets';
import { gameMinutes } from '../format';
import { useGame } from '../game';
import { Bar, Countdown, Gold, Img, Panel, Tabs } from '../ui';

interface JobsResponse {
  durations: number[];
  jobs: (JobInfo & { points: number; available: boolean; rewards: { gold: number; xp: number; honor: number }[] })[];
  enemies: (EnemyInfo & { available: boolean })[];
}

export default function ActionsPage() {
  const { me, world, run, tick } = useGame();
  const [data, setData] = useState<JobsResponse | null>(null);
  const [tab, setTab] = useState<'travail' | 'patrouille'>('travail');
  const [duration, setDuration] = useState(60);

  useEffect(() => {
    api<JobsResponse>('/api/jobs').then(setData).catch(() => undefined);
  }, [tick, me?.level, me?.equipped]);

  if (!me || !data) return <div className="loading">Chargement…</div>;
  const speed = world?.speed ?? 1;
  const busy = !!me.action;
  const missing = me.hpMax - me.hp;
  const durIndex = data.durations.indexOf(duration);

  return (
    <div className="page">
      {me.action && (
        <Panel className="current-action">
          <Img src={art.action(me.action.type === 'work' ? 'travail' : me.action.type === 'patrol' ? 'patrouille' : 'pillage')} alt="" className="banner-img" />
          <div className="current-body">
            <h2>{me.action.label}</h2>
            <Bar
              kind="neutral"
              value={Date.now() - new Date(me.action.startedAt).getTime()}
              max={new Date(me.action.endsAt).getTime() - new Date(me.action.startedAt).getTime()}
              label={<Countdown until={me.action.endsAt} done="Retour imminent…" />}
            />
            {me.action.type === 'work' && (
              <button className="btn" onClick={() => run(() => api('/api/action/cancel', { body: {} }), 'Travail interrompu, vous êtes payé au prorata.')}>
                Arrêter et toucher sa paie
              </button>
            )}
          </div>
        </Panel>
      )}

      <Panel className="hospital">
        <div className="row spread">
          <div>
            <h3>Santé</h3>
            <Bar kind="hp" value={me.hp} max={me.hpMax} label={`${me.hp} / ${me.hpMax} PV`} />
            <small className="muted">Vous regagnez {me.hpRegenPerHour} PV par heure. Sous 20 % de vos PV, vous ne pouvez plus combattre.</small>
          </div>
          <button className="btn" disabled={missing <= 0} onClick={() => run(() => api('/api/action/hospital', { body: {} }), 'Vous voilà soigné.')}>
            Hôpital : <Gold n={hospitalCost(missing, me.level)} />
          </button>
        </div>
      </Panel>

      <Tabs value={tab} onChange={setTab} tabs={[['travail', 'Travailler'], ['patrouille', 'Patrouiller']]} />

      {tab === 'travail' && (
        <Panel>
          <div className="row spread">
            <p className="muted">Le travail rapporte de l'or sans risque. Plus vos compétences dépassent le minimum, mieux vous êtes payé.</p>
            <div className="durations">
              {data.durations.map((d) => (
                <button key={d} className={d === duration ? 'chip active' : 'chip'} onClick={() => setDuration(d)}>
                  {gameMinutes(d, speed)}
                </button>
              ))}
            </div>
          </div>
          <div className="cards">
            {data.jobs.map((j) => {
              const r = j.rewards[durIndex]!;
              return (
                <article key={j.id} className={`card job ${j.available ? '' : 'locked'}`}>
                  <Img src={art.job(j.id)} alt="" className="card-img" />
                  <div className="card-body">
                    <h3>{j.name}</h3>
                    <p className="muted">{j.description}</p>
                    <p className="small">
                      {j.skills.map((s) => SKILL_INFO[s].name).join(' + ')} : <b className={j.available ? 'ok' : 'ko'}>{j.points}</b> / {j.required}
                    </p>
                    <div className="rewards">
                      <Gold n={r.gold} /> <span>{r.xp} XP</span> {r.honor > 0 && <span className="honor">+{r.honor} honneur</span>}
                    </div>
                    <button
                      className="btn btn-primary"
                      disabled={!j.available || busy}
                      onClick={() => run(() => api('/api/action/work', { body: { jobId: j.id, minutes: duration } }), `Au travail : ${j.name}`)}
                    >
                      {j.available ? 'Travailler' : 'Pas assez doué'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </Panel>
      )}

      {tab === 'patrouille' && (
        <Panel>
          <p className="muted">
            Une patrouille coûte 1 point d'énergie ({me.energy} / {me.energyMax}) et dure {gameMinutes(10, speed)}. Vous combattez avec votre profil
            d'attaque. Les ennemis laissent parfois tomber de l'équipement.
          </p>
          <div className="cards">
            {data.enemies.map((e) => (
              <article key={e.id} className={`card enemy ${e.available ? '' : 'locked'}`}>
                <Img src={art.enemy(e.id)} alt="" className="card-img" />
                <div className="card-body">
                  <h3>
                    {e.name} <span className="level">niv. {e.level}</span>
                  </h3>
                  <p className="muted">{e.description}</p>
                  <div className="rewards">
                    <Gold n={e.gold[1]} /> <span>{e.xp} XP</span>
                  </div>
                  {e.drops.length > 0 && <p className="small muted">Butin possible : {e.drops.map((d) => ITEMS[d.item]?.name).join(', ')}</p>}
                  <button
                    className="btn btn-primary"
                    disabled={!e.available || busy || me.energy < 1}
                    onClick={() => run(() => api('/api/action/patrol', { body: { enemyId: e.id } }), `En patrouille contre : ${e.name}`)}
                  >
                    {e.available ? 'Partir en patrouille' : 'Trop redoutable'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
