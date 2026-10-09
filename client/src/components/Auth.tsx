import { useEffect, useState, type FormEvent } from 'react';
import { FACTIONS, FACTION_INFO, PORTRAITS_PER_FACTION, type Faction } from '@aldoria/shared';
import { api, setToken } from '../api';
import { art } from '../assets';
import { Crest, Img, Portrait } from '../ui';

export default function Auth({ onLogin }: { onLogin: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [faction, setFaction] = useState<Faction | null>(null);
  const [portrait, setPortrait] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [population, setPopulation] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    api('/api/world')
      .then((w) => setPopulation(w.population))
      .catch(() => undefined);
  }, []);

  const smallest = population ? Math.min(...FACTIONS.map((f) => population[f] ?? 0)) : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === 'register' && !faction) return setError('Choisissez votre faction');
    setBusy(true);
    try {
      const body = mode === 'register' ? { username, password, faction, portrait } : { username, password };
      const { token } = await api(`/api/auth/${mode}`, { body });
      setToken(token);
      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth" style={{ backgroundImage: `linear-gradient(90deg, rgba(10,7,4,.92) 0%, rgba(10,7,4,.75) 45%, rgba(10,7,4,.2) 100%), url(${art.title})` }}>
      <div className="auth-box">
        <Img src={art.logo} alt="Aldoria" className="auth-logo" fallback={<h1 className="auth-title">Aldoria</h1>} />
        <p className="auth-tagline">Croisades · L'an de grâce 1096 du royaume d'Aldoria</p>
        <p className="auth-intro">
          Trois bannières se disputent Sélénar, la Cité Sainte. Forgez votre guerrier, travaillez, pillez vos ennemis, gagnez l'honneur ou la honte, et
          marchez chaque semaine avec votre armée pour conquérir des terres.
        </p>

        <div className="tabs">
          <button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>
            Prendre les armes
          </button>
          <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>
            Reprendre la route
          </button>
        </div>

        <form onSubmit={submit} className="auth-form">
          {mode === 'register' && (
            <>
              <h3>Choisissez votre bannière</h3>
              <div className="faction-pick">
                {FACTIONS.map((f) => (
                  <button
                    type="button"
                    key={f}
                    className={`faction-card faction-${f} ${faction === f ? 'selected' : ''}`}
                    onClick={() => {
                      setFaction(f);
                      setPortrait(1);
                    }}
                  >
                    <Crest faction={f} size={56} />
                    <strong>{FACTION_INFO[f].name}</strong>
                    <small>{FACTION_INFO[f].bonus}</small>
                    {population && smallest !== null && (population[f] ?? 0) === smallest && <span className="badge">Bonus d'arrivée : +100 or</span>}
                  </button>
                ))}
              </div>
              {faction && <p className="lore">{FACTION_INFO[faction].lore}</p>}
              {faction && (
                <>
                  <h3>Votre visage</h3>
                  <div className="portrait-pick">
                    {Array.from({ length: PORTRAITS_PER_FACTION }, (_, i) => i + 1).map((n) => (
                      <button type="button" key={n} className={portrait === n ? 'selected' : ''} onClick={() => setPortrait(n)}>
                        <Portrait faction={faction} n={n} />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
          <label>
            Nom du personnage
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required minLength={3} maxLength={20} />
          </label>
          <label>
            Mot de passe
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={6}
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="btn btn-primary" disabled={busy}>
            {mode === 'register' ? 'Entrer en Aldoria' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}
