-- Abilita l'estensione per la fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Crea la tabella delle squadre
CREATE TABLE IF NOT EXISTS teams (
  id BIGINT PRIMARY KEY, -- ID da API-Football
  name TEXT NOT NULL,
  logo_url TEXT NOT NULL
);

-- Crea la tabella dei giocatori
CREATE TABLE IF NOT EXISTS players (
  id BIGINT PRIMARY KEY, -- ID da API-Football
  name TEXT NOT NULL
);

-- Crea la tabella di giunzione (militanza)
CREATE TABLE IF NOT EXISTS player_teams (
  player_id BIGINT REFERENCES players(id) ON DELETE CASCADE,
  team_id BIGINT REFERENCES teams(id) ON DELETE CASCADE,
  PRIMARY KEY (player_id, team_id)
);

-- Indice per velocizzare la fuzzy search sui nomi dei giocatori
CREATE INDEX IF NOT EXISTS players_name_trgm_idx ON players USING GIN (name gin_trgm_ops);

-- =====================================================
-- TABELLA AUDIT LOG PER SECURITY E MONITORAGGIO
-- =====================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  table_name TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indice per velocizzare ricerche per data
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON audit_log(created_at DESC);

-- Indice per velocizzare ricerche per utente
CREATE INDEX IF NOT EXISTS audit_log_user_id_idx ON audit_log(user_id);

-- Indice per velocizzare ricerche per action
CREATE INDEX IF NOT EXISTS audit_log_action_idx ON audit_log(action);

-- RLS per audit_log
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Policy: solo service_role può leggere tutti i log
CREATE POLICY "Service role can read audit logs" ON audit_log
  FOR SELECT USING (auth.jwt()->>'role' = 'service_role');

-- Policy: chiunque può inserire (il client logga errori)
CREATE POLICY "Anyone can insert audit logs" ON audit_log
  FOR INSERT WITH CHECK (true);

-- Policy: solo service_role può eliminare
CREATE POLICY "Service role can delete audit logs" ON audit_log
  FOR DELETE USING (auth.jwt()->>'role' = 'service_role');
