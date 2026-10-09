CREATE TABLE players (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX players_username_idx ON players (lower(username));

CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  player_id INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Un joueur = un personnage.
CREATE TABLE characters (
  player_id INT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  faction TEXT NOT NULL CHECK (faction IN ('aube', 'sables', 'givre')),
  portrait INT NOT NULL DEFAULT 1,
  level INT NOT NULL DEFAULT 1,
  xp INT NOT NULL DEFAULT 0,
  gold INT NOT NULL DEFAULT 0,
  honor INT NOT NULL DEFAULT 0,
  -- PV et énergie stockés avec leur date : la valeur actuelle est calculée à la lecture.
  hp DOUBLE PRECISION NOT NULL,
  hp_at TIMESTAMPTZ NOT NULL,
  energy DOUBLE PRECISION NOT NULL,
  energy_at TIMESTAMPTZ NOT NULL,
  attributes JSONB NOT NULL,
  skills JSONB NOT NULL,
  free_attribute_points INT NOT NULL DEFAULT 0,
  free_skill_points INT NOT NULL DEFAULT 0,
  trained INT NOT NULL DEFAULT 0,
  protected_until TIMESTAMPTZ,
  -- Action en cours (travail, patrouille, marche de pillage) : {type, ref, label, startedAt, endsAt, data}
  action JSONB,
  wins INT NOT NULL DEFAULT 0,
  losses INT NOT NULL DEFAULT 0,
  pillages INT NOT NULL DEFAULT 0,
  gold_looted INT NOT NULL DEFAULT 0,
  battles INT NOT NULL DEFAULT 0
);
CREATE INDEX characters_faction_idx ON characters (faction);
CREATE INDEX characters_level_idx ON characters (level);

CREATE TABLE inventory (
  id SERIAL PRIMARY KEY,
  player_id INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  equipped BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX inventory_player_idx ON inventory (player_id);

-- Événements datés : fin de travail, fin de patrouille, arrivée d'un pillage.
CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  player_id INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  due_at TIMESTAMPTZ NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX events_due_idx ON events (due_at);

CREATE TABLE reports (
  id SERIAL PRIMARY KEY,
  player_id INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  data JSONB NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX reports_player_idx ON reports (player_id, created_at DESC);

CREATE TABLE world (
  id INT PRIMARY KEY CHECK (id = 1),
  week INT NOT NULL DEFAULT 1,
  next_battle_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE territories (
  id TEXT PRIMARY KEY,
  owner TEXT CHECK (owner IN ('aube', 'sables', 'givre')),
  owner_since INT NOT NULL DEFAULT 1
);

CREATE TABLE enlistments (
  player_id INT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  territory_id TEXT NOT NULL REFERENCES territories(id),
  line TEXT NOT NULL CHECK (line IN ('avant-garde', 'corps', 'arriere-garde')),
  enlisted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE battles (
  id SERIAL PRIMARY KEY,
  week INT NOT NULL,
  territory_id TEXT NOT NULL REFERENCES territories(id),
  previous_owner TEXT,
  new_owner TEXT,
  data JSONB NOT NULL,
  fought_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX battles_week_idx ON battles (week DESC);
