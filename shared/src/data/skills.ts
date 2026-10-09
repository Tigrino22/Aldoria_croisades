/** Les 4 attributs et les 12 compétences du personnage. Chaque compétence dépend d'un attribut. */
export const ATTRIBUTES = ['force', 'agilite', 'vigueur', 'esprit'] as const;
export type Attribute = (typeof ATTRIBUTES)[number];

export const ATTRIBUTE_NAMES: Record<Attribute, string> = {
  force: 'Force',
  agilite: 'Agilité',
  vigueur: 'Vigueur',
  esprit: 'Esprit',
};

export const SKILLS = [
  'arme', 'charge', 'endurance',
  'precision', 'esquive', 'embuscade',
  'resistance', 'fortification', 'recuperation',
  'tactique', 'commandement', 'intimidation',
] as const;
export type Skill = (typeof SKILLS)[number];

export const SKILL_INFO: Record<Skill, { name: string; attribute: Attribute; help: string }> = {
  arme: { name: 'Maniement des armes', attribute: 'force', help: 'Augmente les dégâts de votre arme.' },
  charge: { name: 'Charge', attribute: 'force', help: "Force de l'assaut quand vous attaquez." },
  endurance: { name: 'Endurance', attribute: 'force', help: 'Encaisse mieux les coups, sert au travail physique.' },
  precision: { name: 'Précision', attribute: 'agilite', help: 'Chance de toucher, en attaque comme en défense.' },
  esquive: { name: 'Esquive', attribute: 'agilite', help: 'Chance d’éviter les coups.' },
  embuscade: { name: 'Embuscade', attribute: 'agilite', help: 'Frapper le premier quand vous attaquez.' },
  resistance: { name: 'Résistance', attribute: 'vigueur', help: 'Points de vie supplémentaires.' },
  fortification: { name: 'Fortification', attribute: 'vigueur', help: 'Tenir sa position quand on vous attaque.' },
  recuperation: { name: 'Récupération', attribute: 'vigueur', help: 'Regagne plus vite ses points de vie.' },
  tactique: { name: 'Tactique', attribute: 'esprit', help: 'Lire le combat : frapper le premier en défense.' },
  commandement: { name: 'Commandement', attribute: 'esprit', help: 'Mener les hommes dans les batailles de territoire.' },
  intimidation: { name: 'Intimidation', attribute: 'esprit', help: 'Ébranle l’adversaire quand vous attaquez.' },
};

export type SkillSet = Record<Skill, number>;
export type AttributeSet = Record<Attribute, number>;

export const emptySkills = (): SkillSet => Object.fromEntries(SKILLS.map((s) => [s, 0])) as SkillSet;
export const emptyAttributes = (): AttributeSet => Object.fromEntries(ATTRIBUTES.map((a) => [a, 0])) as AttributeSet;
