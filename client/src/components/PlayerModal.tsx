import { useEffect, useState } from 'react';
import { FACTION_INFO, SLOTS, SLOT_NAMES, type Faction, type Slot } from '@aldoria/shared';
import { api } from '../api';
import { Crest, ItemIcon, Modal, Portrait } from '../ui';

interface Profile {
  id: number;
  name: string;
  faction: Faction;
  portrait: number;
  level: number;
  rank: string;
  honor: number;
  honorTitle: string;
  outlaw: boolean;
  equipped: Partial<Record<Slot, string>>;
  stats: { wins: number; losses: number; pillages: number; goldLooted: number; battles: number };
}

export default function PlayerModal({ id, onClose }: { id: number; onClose: () => void }) {
  const [p, setP] = useState<Profile | null>(null);
  useEffect(() => {
    api<Profile>(`/api/players/${id}`).then(setP).catch(onClose);
  }, [id, onClose]);
  return (
    <Modal title={p?.name ?? '…'} onClose={onClose}>
      {p && (
        <div className="profile">
          <Portrait faction={p.faction} n={p.portrait} className="portrait-lg" />
          <div>
            <p>
              <Crest faction={p.faction} size={20} /> {p.rank} · {FACTION_INFO[p.faction].name} · niveau {p.level}
            </p>
            <p className={p.outlaw ? 'outlaw' : ''}>
              {p.honorTitle} ({p.honor} d'honneur)
            </p>
            <p className="muted">
              {p.stats.wins} victoires · {p.stats.losses} défaites · {p.stats.pillages} pillages · {p.stats.battles} batailles
            </p>
            <div className="mini-equip">
              {SLOTS.map((s) => (
                <div key={s} title={SLOT_NAMES[s]}>
                  {p.equipped[s] ? <ItemIcon id={p.equipped[s]!} size="sm" /> : <span className="slot-empty sm">{SLOT_NAMES[s]}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
