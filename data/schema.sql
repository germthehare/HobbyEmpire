-- ════════════════════════════════════════════════════════════════════
-- Hobby Empire / Speloosh — Schéma Postgres
-- À exécuter UNE FOIS dans Neon Console (Vercel Storage → Postgres → Query)
-- après provisionning de la DB. Idempotent grâce aux IF NOT EXISTS.
-- ════════════════════════════════════════════════════════════════════

-- ─── USERS ──────────────────────────────────────────────────────────
-- Comptes admin + vendeurs. L'admin est créé manuellement (seed plus bas).
CREATE TABLE IF NOT EXISTS users (
  id              SERIAL PRIMARY KEY,
  email           TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,                          -- prénom affiché
  role            TEXT NOT NULL CHECK (role IN ('admin', 'vendeur')),
  password_hash   TEXT,                                   -- bcrypt; NULL tant que pas accepté l'invitation
  permissions     JSONB NOT NULL DEFAULT '{}'::jsonb,     -- {tracker:true, hub:true, ...}
  vendeur_key     TEXT,                                   -- clé membre dans he_settings (pour mapper breaks)
  active          BOOLEAN NOT NULL DEFAULT true,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_role  ON users(role);

-- ─── SESSIONS ──────────────────────────────────────────────────────
-- Tokens de session. Expirent 30 jours après création.
CREATE TABLE IF NOT EXISTS sessions (
  token         TEXT PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at    TIMESTAMPTZ NOT NULL,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_exp  ON sessions(expires_at);

-- ─── INVITATIONS ───────────────────────────────────────────────────
-- Token unique envoyé par email, valide 7 jours, à usage unique.
CREATE TABLE IF NOT EXISTS invitations (
  token             TEXT PRIMARY KEY,
  email             TEXT NOT NULL,
  name              TEXT NOT NULL,            -- prénom du futur vendeur (rempli par admin)
  role              TEXT NOT NULL DEFAULT 'vendeur',
  permissions       JSONB NOT NULL DEFAULT '{}'::jsonb,
  vendeur_key       TEXT,
  expires_at        TIMESTAMPTZ NOT NULL,
  invited_by        INTEGER REFERENCES users(id),
  accepted_at       TIMESTAMPTZ,              -- NULL = pending
  revoked_at        TIMESTAMPTZ,              -- NULL = active
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_email ON invitations(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_inv_status ON invitations(accepted_at, revoked_at, expires_at);

-- ─── PERMISSIONS DÉFAUT (vendeur) ───────────────────────────────────
-- Pour reference, le shape de la colonne permissions:
-- {
--   "tracker":  true,    -- accès Break Tracker (filtré à ses breaks)
--   "hub":      true,    -- accès Hub (ses stats seulement)
--   "prep":     true,    -- accès Break Prep (lecture complète, c'est pas sensible)
--   "planner":  true,    -- accès Planificateur (ses events seulement)
--   "releases": true,    -- accès Sorties (lecture seule)
--   "playlist": true,    -- accès Playlist + Soundboard
--   "team":     false,   -- pas d'accès Équipe
--   "settings": false,   -- pas d'accès Settings (donc pas d'Inventaire)
--   "inventory": false   -- explicite, même si déjà dans Settings
-- }
-- L'admin a tout TRUE implicitement (vérifié par role='admin', pas par permissions).

-- ─── SEED ADMIN ────────────────────────────────────────────────────
-- Tu DOIS exécuter ceci manuellement APRÈS création des tables.
-- Remplace 'glelievre71@gmail.com' et 'Germain' par tes infos.
-- Le password_hash sera mis à jour à la première connexion via le flow normal,
-- OU tu peux générer un hash bcrypt et l'insérer directement.
--
-- INSERT INTO users (email, name, role, permissions)
-- VALUES ('glelievre71@gmail.com', 'Germain', 'admin', '{}'::jsonb)
-- ON CONFLICT (email) DO NOTHING;
--
-- Pour générer le hash bcrypt du password admin :
--   node -e "console.log(require('bcryptjs').hashSync('TON_MOT_DE_PASSE', 10))"
-- Puis :
--   UPDATE users SET password_hash = '$2a$10$...' WHERE email = 'glelievre71@gmail.com';
