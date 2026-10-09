import { useEffect, useState } from 'react';
import { ITEMS, SELL_RATIO, SLOTS, SLOT_NAMES, type ItemInfo, type Slot } from '@aldoria/shared';
import { api } from '../api';
import { useGame } from '../game';
import { Gold, ItemIcon, ItemStats, Panel, Tabs } from '../ui';

export default function ShopPage() {
  const { me, run } = useGame();
  const [items, setItems] = useState<(ItemInfo & { finalPrice: number })[]>([]);
  const [factor, setFactor] = useState(1);
  const [slot, setSlot] = useState<Slot | 'vendre'>('arme');

  useEffect(() => {
    api('/api/shop')
      .then((d) => {
        setItems(d.items);
        setFactor(d.priceFactor);
      })
      .catch(() => undefined);
  }, [me?.honor]);

  if (!me) return null;
  const owned = new Set(me.inventory.map((i) => i.itemId));

  return (
    <div className="page">
      <Panel title="Le marchand de la capitale">
        <p className="muted">
          {factor < 1 && `Votre réputation vous vaut une remise de ${Math.round((1 - factor) * 100)} %. `}
          {factor > 1 && `Votre mauvaise réputation fait grimper les prix de ${Math.round((factor - 1) * 100)} %. `}
          Certains objets ne se vendent que dans votre faction, d'autres ne se trouvent qu'en patrouille.
        </p>
        <Tabs value={slot} onChange={setSlot} tabs={[...SLOTS.map((s) => [s, SLOT_NAMES[s]] as [Slot, string]), ['vendre', 'Vendre']]} />
        {slot !== 'vendre' && (
          <div className="shop-grid">
            {items
              .filter((i) => i.slot === slot)
              .sort((a, b) => a.level - b.level)
              .map((i) => (
                <article key={i.id} className={`shop-item ${i.level > me.level ? 'locked' : ''}`}>
                  <ItemIcon id={i.id} size="lg" />
                  <div>
                    <h3>{i.name}</h3>
                    <p className="muted small">{i.description}</p>
                    <ItemStats id={i.id} />
                    <div className="row spread">
                      <Gold n={i.finalPrice} />
                      <button
                        className="btn btn-primary"
                        disabled={me.gold < i.finalPrice}
                        onClick={() => run(() => api('/api/shop/buy', { body: { itemId: i.id } }), `${i.name} acheté`)}
                      >
                        {owned.has(i.id) ? 'En racheter' : 'Acheter'}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
          </div>
        )}
        {slot === 'vendre' && (
          <div className="shop-grid">
            {me.inventory.filter((i) => !i.equipped).length === 0 && <p className="muted">Rien à vendre : retirez d'abord un objet pour le vendre.</p>}
            {me.inventory
              .filter((i) => !i.equipped)
              .map((i) => {
                const item = ITEMS[i.itemId]!;
                const value = Math.max(item.dropOnly ? Math.round(item.price * 0.6) : 0, Math.round(item.price * SELL_RATIO));
                return (
                  <article key={i.id} className="shop-item">
                    <ItemIcon id={i.itemId} size="lg" />
                    <div>
                      <h3>{item.name}</h3>
                      <ItemStats id={i.itemId} />
                      <div className="row spread">
                        <Gold n={value} />
                        <button className="btn" onClick={() => run(() => api('/api/shop/sell', { body: { inventoryId: i.id } }), `${item.name} vendu`)}>
                          Vendre
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
          </div>
        )}
      </Panel>
    </div>
  );
}
