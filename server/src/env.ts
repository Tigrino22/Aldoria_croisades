function num(name: string, fallback: number): number {
  const raw = process.env[name];
  const value = raw === undefined || raw === '' ? fallback : Number(raw);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`Variable d'environnement invalide : ${name}`);
  return value;
}

export const env = {
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://aldoria:aldoria@localhost:5433/aldoria',
  port: num('PORT', 3002),
  worldSpeed: num('WORLD_SPEED', 1),
};

/** Convertit une durée de jeu (minutes) en millisecondes réelles selon la vitesse du monde. */
export const gameMs = (minutes: number) => (minutes * 60_000) / env.worldSpeed;
