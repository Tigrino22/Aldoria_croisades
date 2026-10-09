/** Avance la prochaine bataille de territoires à maintenant (pratique pour tester en local) : npm run battle:now */
import { pool } from './db';

const { rowCount } = await pool.query('UPDATE world SET next_battle_at = now() WHERE id = 1');
console.log(rowCount ? 'La bataille aura lieu dans la seconde (le serveur doit tourner).' : "Le monde n'existe pas encore : lancez d'abord le serveur.");
await pool.end();
