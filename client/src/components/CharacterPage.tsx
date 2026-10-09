import { useState } from 'react';
import {
  ATTRIBUTES,
  ATTRIBUTE_NAMES,
  FACTION_INFO,
  ITEMS,
  ROLE_NAMES,
  SKILLS,
  SKILL_INFO,
  SLOTS,
  SLOT_NAMES,
  hitChance,
  type Attribute,
  type Role,
  type Skill,
} from '@aldoria/shared';
import { api } from '../api';
import { useGame } from '../game';
import { Crest, Gold, ItemIcon, ItemStats, Panel, Portrait } from '../ui';

const ROLE_HELP: Record<Role, string> = {
  attaque: 'Quand vous pillez ou défiez quelqu’un : précision, charge, intimidation, embuscade.',
  defense: 'Quand on vient vous piller : fortification, tactique, esquive, précision.',
  bataille: 'Dans les batailles de territoire : commandement, tactique, précision.',
};

export default function CharacterPage() {
  const { me, run } = useGame();
  const [attr, setAttr] = useState<Partial<Record<Attribute, number>>>({});
  const [skills, setSkills] = useState<Partial<Record<Skill, number>>>({});
  const [selected, setSelected] = useState<number | null>(null);
  if (!me) return null;

  const usedAttr = Object.values(attr).reduce((s, v) => s + (v ?? 0), 0);
  const usedSkills = Object.values(skills).reduce((s, v) => s + (v ?? 0), 0);
  const leftAttr = me.freeAttributePoints - usedAttr;
  const leftSkills = me.freeSkillPoints - usedSkills;
  const pending = usedAttr + usedSkills > 0;

  async function save() {
    const res = await run(() => api('/api/character/points', { body: { attributes: attr, skills } }), 'Points répartis');
    if (res) {
      setAttr({});
      setSkills({});
    }
  }

  const selectedEntry = me.inventory.find((i) => i.id === selected);

  return (
    <div className="page character-page">
      <Panel className="hero-panel">
        <div className="hero-sheet">
          <div className="paperdoll">
            <Portrait faction={me.faction} n={me.portrait} className="portrait-lg" />
            {SLOTS.map((slot) => {
              const id = me.equipped[slot];
              const entry = me.inventory.find((i) => i.equipped && i.itemId === id);
              return (
                <button key={slot} className={`slot slot-${slot}`} onClick={() => entry && setSelected(entry.id)} title={SLOT_NAMES[slot]}>
                  {id ? <ItemIcon id={id} /> : <span className="slot-empty">{SLOT_NAMES[slot]}</span>}
                </button>
              );
            })}
          </div>
          <div className="hero-info">
            <h1>{me.name}</h1>
            <p className="subtitle">
              <Crest faction={me.faction} size={20} /> {me.rank} · {FACTION_INFO[me.faction].name} · niveau {me.level}
            </p>
            <p className={`honor-line ${me.outlaw ? 'outlaw' : ''}`}>
              Honneur : <b>{me.honor}</b> · {me.honorTitle}
              {me.outlaw && " — vous êtes hors-la-loi : n'importe qui peut vous attaquer, et votre tête est mise à prix."}
            </p>
            <div className="stat-grid">
              <div>
                <span>Dégâts</span>
                <b>
                  {me.damage[0]}–{me.damage[1]}
                </b>
              </div>
              <div>
                <span>Protection</span>
                <b>{me.armor}</b>
              </div>
              <div>
                <span>Victoires</span>
                <b>{me.stats.wins}</b>
              </div>
              <div>
                <span>Défaites</span>
                <b>{me.stats.losses}</b>
              </div>
              <div>
                <span>Pillages</span>
                <b>{me.stats.pillages}</b>
              </div>
              <div>
                <span>Batailles</span>
                <b>{me.stats.battles}</b>
              </div>
              <div>
                <span>Or à l'abri</span>
                <b>{me.safeGold}</b>
              </div>
              <div>
                <span>Soins</span>
                <b>{me.hpRegenPerHour} PV/h</b>
              </div>
            </div>
          </div>
        </div>
      </Panel>

      <Panel title="Profils de combat">
        <p className="muted">On ne se bat pas de la même façon selon qu'on attaque, qu'on défend sa position ou qu'on charge avec son armée.</p>
        <div className="roles">
          {(Object.keys(ROLE_NAMES) as Role[]).map((role) => {
            const r = me.ratings[role];
            return (
              <div key={role} className={`role-card role-${role}`}>
                <h3>
                  {ROLE_NAMES[role]} <span className="power">{r.power}</span>
                </h3>
                <small>{ROLE_HELP[role]}</small>
                <dl>
                  <dt>Toucher</dt>
                  <dd>{r.hit.toFixed(1)}</dd>
                  <dt>Esquive</dt>
                  <dd>{r.dodge.toFixed(1)}</dd>
                  <dt>Initiative</dt>
                  <dd>{r.initiative.toFixed(1)}</dd>
                  <dt>Dégâts</dt>
                  <dd>×{r.damageMult.toFixed(2)}</dd>
                  <dt>Armure</dt>
                  <dd>{r.armor.toFixed(1)}</dd>
                  <dt>Toucher un égal</dt>
                  <dd>{Math.round(hitChance(r.hit, r.dodge) * 100)} %</dd>
                </dl>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel
        title="Attributs et compétences"
        actions={
          pending && (
            <div className="row">
              <button className="btn" onClick={() => (setAttr({}), setSkills({}))}>
                Annuler
              </button>
              <button className="btn btn-primary" onClick={save}>
                Valider
              </button>
            </div>
          )
        }
      >
        <p className="muted">
          Points libres : <b>{leftAttr}</b> d'attribut, <b>{leftSkills}</b> de compétence. Chaque attribut s'ajoute aux trois compétences qui en dépendent.
        </p>
        <div className="attributes">
          {ATTRIBUTES.map((a) => (
            <div key={a} className="attribute">
              <div className="attribute-head">
                <h3>{ATTRIBUTE_NAMES[a]}</h3>
                <span className="value">
                  {me.attributes[a] + (attr[a] ?? 0)}
                  {leftAttr > 0 && (
                    <button className="plus" onClick={() => setAttr({ ...attr, [a]: (attr[a] ?? 0) + 1 })} aria-label={`+1 ${ATTRIBUTE_NAMES[a]}`}>
                      +
                    </button>
                  )}
                </span>
              </div>
              {SKILLS.filter((s) => SKILL_INFO[s].attribute === a).map((s) => {
                const add = (skills[s] ?? 0) + (attr[a] ?? 0);
                return (
                  <div key={s} className="skill" title={SKILL_INFO[s].help}>
                    <span>{SKILL_INFO[s].name}</span>
                    <span className="skill-value">
                      <small className="muted">{me.skills[s] + (skills[s] ?? 0)} pts</small>
                      <b>{me.effective[s] + add}</b>
                      {leftSkills > 0 && (
                        <button className="plus" onClick={() => setSkills({ ...skills, [s]: (skills[s] ?? 0) + 1 })} aria-label={`+1 ${SKILL_INFO[s].name}`}>
                          +
                        </button>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="training">
          <span>
            Maître d'armes : un point de compétence supplémentaire pour <Gold n={me.trainingCost} />
          </span>
          <select
            defaultValue=""
            onChange={(e) => {
              const skill = e.target.value;
              e.target.value = '';
              if (skill) run(() => api('/api/character/train', { body: { skill } }), `Entraînement terminé : ${SKILL_INFO[skill as Skill].name} +1`);
            }}
            disabled={me.gold < me.trainingCost}
          >
            <option value="">{me.gold < me.trainingCost ? 'Pas assez d’or' : 'S’entraîner en…'}</option>
            {SKILLS.map((s) => (
              <option key={s} value={s}>
                {SKILL_INFO[s].name}
              </option>
            ))}
          </select>
        </div>
      </Panel>

      <Panel title="Besace">
        {me.inventory.filter((i) => !i.equipped).length === 0 && <p className="muted">Votre besace est vide. Le marchand et les patrouilles vous fourniront de quoi la remplir.</p>}
        <div className="inventory">
          {me.inventory
            .filter((i) => !i.equipped)
            .map((i) => (
              <button key={i.id} className={`inv-cell ${selected === i.id ? 'selected' : ''}`} onClick={() => setSelected(i.id)}>
                <ItemIcon id={i.itemId} />
              </button>
            ))}
        </div>
        {selectedEntry && (
          <div className="item-detail">
            <ItemIcon id={selectedEntry.itemId} size="lg" />
            <div>
              <h3>{ITEMS[selectedEntry.itemId]?.name}</h3>
              <p className="muted">
                {SLOT_NAMES[ITEMS[selectedEntry.itemId]!.slot]} · {ITEMS[selectedEntry.itemId]?.description}
              </p>
              <ItemStats id={selectedEntry.itemId} />
              <div className="row">
                {selectedEntry.equipped ? (
                  <button className="btn" onClick={() => run(() => api('/api/character/unequip', { body: { inventoryId: selectedEntry.id } }))}>
                    Retirer
                  </button>
                ) : (
                  <button
                    className="btn btn-primary"
                    disabled={ITEMS[selectedEntry.itemId]!.level > me.level}
                    onClick={() => run(() => api('/api/character/equip', { body: { inventoryId: selectedEntry.id } }), 'Équipé')}
                  >
                    {ITEMS[selectedEntry.itemId]!.level > me.level ? `Niveau ${ITEMS[selectedEntry.itemId]!.level} requis` : 'Équiper'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
