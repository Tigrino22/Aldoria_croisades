import { useState, type ReactNode } from 'react';
import { FACTION_INFO, ITEMS, RARITY_NAMES, SKILL_INFO, type Faction, type Skill } from '@aldoria/shared';
import { art } from './assets';
import { duration } from './format';
import { useNow } from './game';

/** Image qui disparaît proprement si le fichier n'existe pas encore. */
export function Img({ src, alt, className, fallback }: { src: string; alt: string; className?: string; fallback?: ReactNode }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback ?? <div className={`img-missing ${className ?? ''}`} aria-label={alt} />}</>;
  return <img src={src} alt={alt} className={className} loading="lazy" onError={() => setFailed(true)} />;
}

export function Panel({ title, children, className, actions }: { title?: ReactNode; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={`panel ${className ?? ''}`}>
      {(title || actions) && (
        <header className="panel-head">
          {title && <h2>{title}</h2>}
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function Bar({ value, max, kind, label }: { value: number; max: number; kind: 'hp' | 'xp' | 'energy' | 'neutral'; label?: ReactNode }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={`bar bar-${kind}`} role="progressbar" aria-valuenow={value} aria-valuemax={max}>
      <div className="bar-fill" style={{ width: `${pct}%` }} />
      {label !== undefined && <span className="bar-label">{label}</span>}
    </div>
  );
}

export function Countdown({ until, done = 'Terminé' }: { until: string; done?: string }) {
  const now = useNow();
  const ms = new Date(until).getTime() - now;
  return <span className="countdown">{ms <= 0 ? done : duration(ms)}</span>;
}

export function Crest({ faction, size = 28 }: { faction: Faction; size?: number }) {
  return (
    <Img
      src={art.crest(faction)}
      alt={FACTION_INFO[faction].name}
      className="crest"
      fallback={<span className="crest crest-fallback" style={{ background: FACTION_INFO[faction].color, width: size, height: size }} />}
    />
  );
}

export function Portrait({ faction, n, className }: { faction: Faction; n: number; className?: string }) {
  return <Img src={art.portrait(faction, n)} alt="Portrait" className={`portrait ${className ?? ''}`} fallback={<div className={`portrait portrait-fallback ${className ?? ''}`} style={{ background: FACTION_INFO[faction].color }} />} />;
}

export function ItemIcon({ id, size = 'md' }: { id: string; size?: 'sm' | 'md' | 'lg' }) {
  const item = ITEMS[id];
  return (
    <div className={`item-icon item-${size} rarity-${item?.rarity ?? 'commun'}`} title={item?.name}>
      <Img src={art.item(id)} alt={item?.name ?? id} fallback={<span className="item-letter">{item?.name[0] ?? '?'}</span>} />
    </div>
  );
}

export function ItemStats({ id }: { id: string }) {
  const item = ITEMS[id];
  if (!item) return null;
  return (
    <div className="item-stats">
      <div className={`rarity-label rarity-text-${item.rarity}`}>
        {RARITY_NAMES[item.rarity]} · niveau {item.level}
      </div>
      {item.damage && (
        <div>
          Dégâts <b>{item.damage[0]}–{item.damage[1]}</b>
        </div>
      )}
      {!!item.armor && (
        <div>
          Protection <b>{item.armor}</b>
        </div>
      )}
      {Object.entries(item.bonuses).map(([s, v]) => (
        <div key={s}>
          {SKILL_INFO[s as Skill].name} <b>+{v}</b>
        </div>
      ))}
    </div>
  );
}

export function Gold({ n }: { n: number }) {
  return (
    <span className="gold">
      <span className="coin" aria-hidden />
      {n.toLocaleString('fr-FR')}
    </span>
  );
}

export function Honor({ n, title }: { n: number; title?: string }) {
  return (
    <span className={`honor ${n < 0 ? 'honor-neg' : ''}`} title={title}>
      <span className="laurel" aria-hidden />
      {n}
    </span>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: [T, string][] }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map(([k, label]) => (
        <button key={k} role="tab" aria-selected={value === k} className={value === k ? 'active' : ''} onClick={() => onChange(k)}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function Modal({ onClose, children, title }: { onClose: () => void; children: ReactNode; title: ReactNode }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
        <header className="panel-head">
          <h2>{title}</h2>
          <button className="btn-ghost" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
