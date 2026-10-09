/** Réglages d'équilibrage. Toutes les durées sont en temps de jeu : le serveur les divise par la vitesse du monde. */
export const MAX_LEVEL = 50;
export const ENERGY_MAX = 10;
/** Minutes pour regagner 1 point d'énergie. */
export const ENERGY_REGEN_MINUTES = 72;
/** Durée d'une patrouille, en minutes. */
export const PATROL_MINUTES = 10;
/** Temps de marche vers la cible d'un pillage, en minutes. */
export const PILLAGE_MARCH_MINUTES = 10;
/** Protection d'un joueur pillé contre de nouveaux pillages, en minutes. */
export const PILLAGE_PROTECTION_MINUTES = 60;
/** Protection des nouveaux joueurs, en heures. */
export const BEGINNER_PROTECTION_HOURS = 72;
/** En dessous de ce pourcentage de PV, on ne peut plus combattre. */
export const MIN_HP_TO_FIGHT = 0.2;
/** On ne peut pas attaquer un joueur dont le niveau est inférieur à la moitié du sien. */
export const MIN_TARGET_LEVEL_RATIO = 0.5;
/** Sous ce ratio de niveau, attaquer est déshonorant. */
export const DISHONOR_LEVEL_RATIO = 0.8;
/** Part maximale de l'or exposé (hors coffre) qu'un pillage emporte. */
export const PILLAGE_LOOT_SHARE = 0.1;
/** Si l'assaillant perd, le défenseur lui prend cette part de son or exposé. */
export const PILLAGE_DEFEAT_SHARE = 0.05;
/** L'or à l'abri dans le coffre, par niveau. */
export const SAFE_GOLD_PER_LEVEL = 50;
/** Honneur à partir duquel un joueur devient hors-la-loi. */
export const OUTLAW_HONOR = -100;
/** Prime versée à celui qui bat un hors-la-loi, par niveau du hors-la-loi. */
export const OUTLAW_BOUNTY_PER_LEVEL = 20;
/** Les batailles de territoire ont lieu tous les 7 jours de jeu. */
export const BATTLE_INTERVAL_DAYS = 7;
/** Niveau minimal pour s'enrôler dans une bataille de territoire. */
export const BATTLE_MIN_LEVEL = 3;
/** Entre deux duels d'une bataille, le vainqueur récupère cette part de ses PV manquants. */
export const BATTLE_HEAL_BETWEEN_DUELS = 0.2;
/** Bonus d'or au travail par territoire possédé (hors capitale). */
export const TERRITORY_WORK_BONUS = 0.03;
/** Points de départ à répartir. */
export const START_ATTRIBUTE_POINTS = 2;
export const START_SKILL_POINTS = 6;
/** Gagnés à chaque niveau. */
export const LEVEL_ATTRIBUTE_POINTS = 1;
export const LEVEL_SKILL_POINTS = 3;
/** Prix de revente au marchand. */
export const SELL_RATIO = 0.4;
/** Nombre de portraits par faction. */
export const PORTRAITS_PER_FACTION = 4;
/** Nombre maximal de rounds dans un duel. */
export const MAX_ROUNDS = 10;
