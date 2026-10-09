import type { Faction } from '@aldoria/shared';

/** Chemins des images générées dans public/assets (voir tools/art). */
export const art = {
  title: '/assets/bg/title.jpg',
  camp: '/assets/bg/camp.jpg',
  logo: '/assets/logo.png',
  map: '/assets/map/aldoria.jpg',
  parchment: '/assets/ui/parchment.jpg',
  leather: '/assets/ui/leather.jpg',
  stone: '/assets/ui/stone.jpg',
  wood: '/assets/ui/wood.jpg',
  crest: (f: Faction) => `/assets/factions/${f}.png`,
  portrait: (f: Faction, n: number) => `/assets/portraits/${f}-${n}.jpg`,
  item: (id: string) => `/assets/items/${id}.png`,
  enemy: (id: string) => `/assets/enemies/${id}.jpg`,
  job: (id: string) => `/assets/jobs/${id}.jpg`,
  action: (id: 'patrouille' | 'pillage' | 'duel' | 'bataille' | 'travail' | 'hopital') => `/assets/actions/${id}.jpg`,
};
