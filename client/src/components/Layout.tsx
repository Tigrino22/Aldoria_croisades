import { useState } from 'react';
import { FACTION_INFO } from '@aldoria/shared';
import { art } from '../assets';
import { useGame } from '../game';
import { Bar, Countdown, Crest, Gold, Honor, Img, Portrait } from '../ui';
import ActionsPage from './ActionsPage';
import CharacterPage from './CharacterPage';
import MapPage from './MapPage';
import RankingPage from './RankingPage';
import ReportsPage from './ReportsPage';
import ShopPage from './ShopPage';
import WarPage from './WarPage';

export type Page = 'personnage' | 'actions' | 'guerre' | 'carte' | 'marche' | 'rapports' | 'classement';

const NAV: { id: Page; label: string; short: string; icon: string }[] = [
  { id: 'personnage', label: 'Personnage', short: 'Perso', icon: '⚔' },
  { id: 'actions', label: 'Travail', short: 'Travail', icon: '⚒' },
  { id: 'guerre', label: 'Pillage', short: 'Pillage', icon: '⚑' },
  { id: 'carte', label: 'Territoires', short: 'Carte', icon: '⛨' },
  { id: 'marche', label: 'Marchand', short: 'Marché', icon: '⚖' },
  { id: 'rapports', label: 'Rapports', short: 'Rapports', icon: '✉' },
  { id: 'classement', label: 'Classement', short: 'Rangs', icon: '♛' },
];

export default function Layout() {
  const { me, toasts, logout } = useGame();
  const [page, setPage] = useState<Page>('personnage');

  if (!me) return <div className="loading">Le héraut prépare votre arrivée…</div>;

  return (
    <div className={`app faction-${me.faction}`} style={{ backgroundImage: `linear-gradient(rgba(12,9,6,.86), rgba(12,9,6,.94)), url(${art.camp})` }}>
      <header className="topbar">
        <div className="topbar-brand">
          <Img src={art.logo} alt="Aldoria" className="topbar-logo" fallback={<span className="brand-text">Aldoria</span>} />
        </div>
        <div className="topbar-hero" onClick={() => setPage('personnage')}>
          <Portrait faction={me.faction} n={me.portrait} className="portrait-sm" />
          <div className="hero-id">
            <strong>{me.name}</strong>
            <span>
              <Crest faction={me.faction} size={16} /> {me.rank} · niv. {me.level}
            </span>
          </div>
        </div>
        <div className="topbar-bars">
          <Bar kind="hp" value={me.hp} max={me.hpMax} label={`${me.hp} / ${me.hpMax} PV`} />
          <Bar kind="energy" value={me.energy} max={me.energyMax} label={`${me.energy} / ${me.energyMax} énergie`} />
          <Bar kind="xp" value={me.xp} max={me.xpToNext} label={`${me.xp} / ${me.xpToNext} XP`} />
        </div>
        <div className="topbar-wealth">
          <Gold n={me.gold} />
          <Honor n={me.honor} title={me.honorTitle} />
        </div>
        <button className="btn-ghost logout" onClick={logout} title="Se déconnecter">
          ⏻
        </button>
          {me.action && (
            <div className="action-strip" onClick={() => setPage('actions')}>
              <span>{me.action.label}</span>
              <Countdown until={me.action.endsAt} done="Retour imminent…" />
            </div>
          )}
      </header>


      <div className="main">
        <nav className="sidenav">
          {NAV.map((n) => (
            <button key={n.id} className={page === n.id ? 'active' : ''} onClick={() => setPage(n.id)}>
              <span className="nav-icon" aria-hidden>
                {n.icon}
              </span>
              <span className="nav-label">{n.label}</span>
              <span className="nav-short">{n.short}</span>
              {n.id === 'rapports' && me.unreadReports > 0 && <span className="pill">{me.unreadReports}</span>}
              {n.id === 'personnage' && me.freeAttributePoints + me.freeSkillPoints > 0 && <span className="pill">!</span>}
            </button>
          ))}
          <div className="nav-faction" style={{ borderColor: FACTION_INFO[me.faction].color }}>
            <Crest faction={me.faction} size={40} />
            <span>{FACTION_INFO[me.faction].name}</span>
          </div>
        </nav>
        <main className="content">
          {page === 'personnage' && <CharacterPage />}
          {page === 'actions' && <ActionsPage />}
          {page === 'guerre' && <WarPage />}
          {page === 'carte' && <MapPage />}
          {page === 'marche' && <ShopPage />}
          {page === 'rapports' && <ReportsPage />}
          {page === 'classement' && <RankingPage />}
        </main>
      </div>

      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
