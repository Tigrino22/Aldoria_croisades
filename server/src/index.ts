import { buildApp } from './app';
import { pool, tx } from './db';
import { env } from './env';
import { processDueEvents } from './game/events';
import { ensureWorld } from './game/world';
import { withGameLock } from './lock';
import { migrate } from './migrate';

async function main() {
  await migrate();
  await tx((c) => ensureWorld(c, new Date()));

  const app = await buildApp({ logger: true });
  await app.listen({ port: env.port, host: '0.0.0.0' });
  app.log.info(`Aldoria Croisades lancé : vitesse x${env.worldSpeed}`);

  // Le worker : toutes les 500 ms, il termine les travaux, patrouilles et pillages arrivés à échéance,
  // et lance les batailles de territoires quand leur heure est venue.
  const timer = setInterval(() => {
    withGameLock(() => processDueEvents(new Date())).catch((err) => app.log.error(err));
  }, 500);

  const stop = async () => {
    clearInterval(timer);
    await app.close();
    await pool.end();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
