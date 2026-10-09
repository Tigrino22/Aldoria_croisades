import { describe, expect, it } from 'vitest';
import {
  ENERGY_MAX,
  ITEMS,
  JOBS,
  TERRITORIES,
  addXp,
  battle,
  currentEnergy,
  duel,
  effectiveSkills,
  emptySkills,
  honorChange,
  hpMax,
  ratings,
  rng,
  workReward,
  xpToNext,
  type Fighter,
} from '../src';

const attrs = { force: 1, agilite: 1, vigueur: 1, esprit: 1 };

function fighter(id: string, level: number, skill: number): Fighter {
  const s = Object.fromEntries(Object.keys(emptySkills()).map((k) => [k, skill])) as ReturnType<typeof emptySkills>;
  return { id, name: id, level, hp: 100 + level * 10, hpMax: 100 + level * 10, damage: [4, 9], ratings: ratings('attaque', s, 4) };
}

describe('progression', () => {
  it('monte de niveau et garde le surplus d’expérience', () => {
    const r = addXp(1, 0, xpToNext(1) + 5);
    expect(r).toEqual({ level: 2, xp: 5, levelsGained: 1 });
  });

  it('additionne compétence, attribut et équipement', () => {
    const eff = effectiveSkills({ ...attrs, agilite: 3 }, { ...emptySkills(), precision: 2 }, { arme: 'lance' });
    expect(eff.precision).toBe(2 + 3 + 1);
    expect(eff.fortification).toBe(1 + 1);
  });

  it("calcule l'énergie à la lecture, plafonnée", () => {
    const start = new Date('2026-01-01T00:00:00Z');
    expect(currentEnergy(0, start, new Date('2026-01-01T01:12:00Z'), 1)).toBeCloseTo(1);
    expect(currentEnergy(9, start, new Date('2026-01-02T00:00:00Z'), 1)).toBe(ENERGY_MAX);
  });

  it('paie mieux un travailleur plus doué', () => {
    const job = JOBS.find((j) => j.id === 'forge')!;
    const weak = { ...emptySkills(), arme: 5, endurance: 5 };
    const strong = { ...emptySkills(), arme: 20, endurance: 20 };
    expect(workReward(job, strong, 60, 0).gold).toBeGreaterThan(workReward(job, weak, 60, 0).gold);
    expect(workReward(job, weak, 60, 2).gold).toBeGreaterThan(workReward(job, weak, 60, 0).gold);
  });

  it('a des PV qui grandissent avec la vigueur', () => {
    const eff = emptySkills();
    expect(hpMax(1, { ...attrs, vigueur: 3 }, eff)).toBeGreaterThan(hpMax(1, attrs, eff));
  });
});

describe('profils de combat', () => {
  it('ne se bat pas avec les mêmes compétences en attaque et en défense', () => {
    const charger = { ...emptySkills(), charge: 10, embuscade: 10 };
    const wall = { ...emptySkills(), fortification: 10, tactique: 10 };
    expect(ratings('attaque', charger, 0).hit).toBeGreaterThan(ratings('attaque', wall, 0).hit);
    expect(ratings('defense', wall, 0).dodge).toBeGreaterThan(ratings('defense', charger, 0).dodge);
    expect(ratings('bataille', { ...emptySkills(), commandement: 10 }, 0).hit).toBeGreaterThan(0);
  });

  it('rejoue un duel à l’identique avec la même graine', () => {
    const a = fighter('a', 5, 5);
    const b = fighter('b', 5, 5);
    expect(duel(a, b, rng(42))).toEqual(duel(a, b, rng(42)));
  });

  it('donne l’avantage au plus fort', () => {
    let wins = 0;
    for (let s = 0; s < 200; s++) if (duel(fighter('fort', 10, 12), fighter('faible', 10, 3), rng(s)).winner === 'a') wins++;
    expect(wins).toBeGreaterThan(160);
  });

  it('mène une bataille jusqu’à la dernière équipe debout', () => {
    const res = battle(
      [
        { key: 'aube', faction: 'aube', defender: true, fighters: [fighter('a1', 5, 5), fighter('a2', 5, 5)] },
        { key: 'sables', faction: 'sables', defender: false, fighters: [fighter('s1', 5, 5), fighter('s2', 5, 5), fighter('s3', 5, 5)] },
        { key: 'givre', faction: 'givre', defender: false, fighters: [fighter('g1', 5, 5)] },
      ],
      rng(7),
    );
    expect(res.winnerTeam).not.toBeNull();
    const alive = Object.values(res.survivors).filter((n) => n > 0);
    expect(alive).toHaveLength(1);
    // Chaque duel élimine exactement un combattant : 6 combattants, 1 équipe restante.
    expect(res.duels.length).toBe(6 - (res.survivors[res.winnerTeam!] ?? 0));
  });
});

describe('honneur', () => {
  const base = { kind: 'pillage' as const, attackerWon: true, defenderHpRatio: 1, defenderOutlaw: false };
  it('récompense une victoire contre plus fort', () => {
    expect(honorChange({ ...base, attackerLevel: 5, defenderLevel: 8 }).attacker).toBeGreaterThan(honorChange({ ...base, attackerLevel: 5, defenderLevel: 5 }).attacker);
  });
  it('punit le pillage des faibles et des blessés', () => {
    expect(honorChange({ ...base, attackerLevel: 20, defenderLevel: 12 }).attacker).toBeLessThan(0);
    expect(honorChange({ ...base, attackerLevel: 5, defenderLevel: 5, defenderHpRatio: 0.2 }).attacker).toBeLessThan(0);
  });
  it('honore toujours celui qui abat un hors-la-loi', () => {
    expect(honorChange({ ...base, attackerLevel: 20, defenderLevel: 12, defenderOutlaw: true }).attacker).toBeGreaterThan(0);
  });
  it('donne de l’honneur au défenseur qui tient bon', () => {
    expect(honorChange({ ...base, attackerWon: false, attackerLevel: 5, defenderLevel: 5 }).defender).toBeGreaterThan(0);
  });
});

describe('données', () => {
  it('a des voisinages symétriques et des objets cohérents', () => {
    for (const t of Object.values(TERRITORIES)) for (const n of t.neighbors) expect(TERRITORIES[n]!.neighbors).toContain(t.id);
    for (const i of Object.values(ITEMS)) expect(i.slot === 'arme' ? i.damage : true).toBeTruthy();
  });
});
