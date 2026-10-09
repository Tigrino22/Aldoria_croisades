# Aldoria Croisades

RPG médiéval multijoueur par navigateur et mobile. Chaque joueur incarne un guerrier de l'une des trois bannières qui se disputent le royaume d'Aldoria : l'Ordre de l'Aube, le Califat des Sables et les Clans du Givre. On le fait progresser en travaillant, en patrouillant, en pillant ou en défiant les joueurs adverses, en gagnant de l'honneur (ou du déshonneur), et chaque semaine les armées s'affrontent pour la possession des territoires.

## Lancer le jeu en local

Prérequis : Node.js 22 (voir `.nvmrc`) et Docker (pour PostgreSQL).

```bash
cp .env.example .env
docker compose up -d        # PostgreSQL sur le port 5433
npm install
npm run seed                # facultatif : 21 guerriers fictifs pour avoir des adversaires (mot de passe : aldoria)
npm run dev                 # API sur 3002, jeu sur 5174
```

Ouvrez ensuite http://localhost:5174. Les ports sont choisis pour ne pas gêner Aldoria War (5432, 3001, 5173) : les deux jeux peuvent tourner en même temps.

Le monde tourne en vitesse x10 par défaut (`WORLD_SPEED` dans `.env`) : un travail d'une heure dure 6 minutes, et la bataille de territoires a lieu toutes les 16 h 48. Pour déclencher la bataille tout de suite pendant un test : `npm run battle:now` (le serveur doit tourner).

Depuis un téléphone sur le même réseau Wi-Fi, ouvrez `http://<adresse-du-mac>:5174`. Le jeu s'installe comme une application (« Ajouter à l'écran d'accueil »).

## Commandes utiles

| Commande | Effet |
| --- | --- |
| `npm run dev` | Serveur et client avec rechargement automatique |
| `npm test` | Tests des règles et du serveur (base `aldoria_test` à créer une fois : `docker compose exec postgres createdb -U aldoria aldoria_test`) |
| `npm run typecheck` | Vérification TypeScript des trois paquets |
| `npm run db:reset` | Remet la base à zéro |
| `npm run seed` | Ajoute des guerriers fictifs |
| `npm run battle:now` | Avance la prochaine bataille de territoires à maintenant |
| `npm run build` | Construit le client pour la production |

## Ce qui est en place

- **Comptes et personnage** : choix de la faction (bonus d'or pour la moins peuplée), du portrait, protection de débutant de 72 h.
- **Caractéristiques** : 4 attributs (Force, Agilité, Vigueur, Esprit) et 12 compétences. Chaque attribut s'ajoute aux trois compétences qui en dépendent. Points à répartir à chaque niveau, plus un maître d'armes qui vend des points contre de l'or (de plus en plus cher).
- **Trois profils de combat** calculés à partir des compétences et de l'équipement, comme dans les jeux de duel : on ne se bat pas avec les mêmes qualités en **attaque** (précision, charge, intimidation, embuscade), en **défense** (fortification, tactique, esquive) et en **bataille** rangée (commandement, tactique).
- **Énergie** : 10 points, 1 point toutes les 72 minutes de jeu. Patrouilles, pillages et duels en coûtent un.
- **Travail** : 10 métiers débloqués par les compétences, de 15 min à 8 h, payés davantage quand on dépasse le minimum requis et quand sa faction tient des territoires.
- **Patrouilles** : 7 ennemis du loup affamé au champion des ruines, avec butin possible.
- **Pillage** : marche de 10 minutes, combat attaque contre défense, jusqu'à 10 % de l'or exposé (le coffre protège 50 or par niveau), protection d'une heure pour la victime. L'assaillant vaincu paie 5 % de son or.
- **Duels** : combat immédiat, sans vol, pour l'honneur et l'expérience.
- **Honneur** : vaincre plus fort que soi est glorieux, s'en prendre aux faibles ou aux blessés est déshonorant, tenir bon en défense rapporte de l'honneur. Sous -100, on devient **hors-la-loi** : n'importe qui, même de sa faction, peut vous attaquer, votre tête est mise à prix et les marchands vous font payer plus cher. Les gens honorables ont des remises.
- **Équipement** : 6 emplacements, 31 objets en 4 raretés, objets propres à chaque faction, objets légendaires trouvés uniquement en patrouille.
- **Guerre des territoires** : 12 territoires sur la carte d'Aldoria. Chaque semaine (dimanche 20 h, heure de Paris l'été, en vitesse normale), les joueurs enrôlés s'affrontent un contre un, avec leur profil de bataille et leur équipement, dans l'ordre de leur ligne (avant-garde, corps, arrière-garde). Le vainqueur d'un duel reste en lice avec les PV qui lui restent, jusqu'à ce qu'il ne reste qu'une armée debout : elle prend le territoire. On ne peut attaquer qu'un territoire voisin des siens, et les capitales sont imprenables.
- **Rapports** de combat détaillés round par round, rapports de bataille, classements des joueurs et des factions, notifications en direct.
- **Mobile** : interface adaptée au téléphone avec barre de navigation en bas, installable (PWA).

## Organisation du code

| Dossier | Contenu |
| --- | --- |
| `shared/` | Règles du jeu partagées par le serveur et le client : données (factions, territoires, compétences, objets, métiers, ennemis), formules, combat, honneur |
| `server/` | API Fastify + PostgreSQL, événements datés (fins de travail, patrouilles, pillages) et batailles hebdomadaires |
| `client/` | Interface React + Vite |
| `client/public/assets/` | Graphismes générés (voir `tools/art/README.md`) |
| `tools/` | Générateurs de la carte et des graphismes |

Le socle est le même que celui d'Aldoria War : pas de « tick » global, les valeurs qui évoluent avec le temps (PV, énergie) sont calculées à la lecture, et un worker exécute les événements datés quand leur heure arrive. Toutes les règles sont réglables dans `shared/src/config.ts` et `shared/src/data/`.

## Branches

- `main` : version de production.
- `dev` : développement en cours.
