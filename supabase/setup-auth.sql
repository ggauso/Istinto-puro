-- 1. Create the profiles table
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  birth_date DATE,
  favorite_team TEXT,
  privacy_accepted BOOLEAN DEFAULT false,
  avatar_url TEXT,
  total_score INTEGER DEFAULT 0,
  matches_played INTEGER DEFAULT 0,
  matches_won INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable Row Level Security (RLS) per profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Create policies per profiles
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile." ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile." ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- 4. Create a trigger to automatically create a profile for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    first_name,
    last_name,
    birth_date,
    favorite_team,
    privacy_accepted,
    avatar_url
  )
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'first_name', new.raw_user_meta_data->>'full_name', ''),
    COALESCE(new.raw_user_meta_data->>'last_name', ''),
    NULLIF(new.raw_user_meta_data->>'birth_date', '')::DATE,
    new.raw_user_meta_data->>'favorite_team',
    COALESCE((new.raw_user_meta_data->>'privacy_accepted')::BOOLEAN, false),
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- =====================================================
-- ROW LEVEL SECURITY PER teams, players, player_teams
-- =====================================================

-- Teams tables RLS
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- Policy per teams: chiunque può leggere i team (pubblico dominio)
DROP POLICY IF EXISTS "Public teams are viewable by everyone" ON teams;
CREATE POLICY "Public teams are viewable by everyone" ON teams
  FOR SELECT USING (true);

-- Policy: solo service role può modificare teams
DROP POLICY IF EXISTS "Only service role can modify teams" ON teams;
CREATE POLICY "Only service role can modify teams" ON teams
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Players tables RLS
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- Policy per players: chiunque può leggere i giocatori (pubblico dominio)
DROP POLICY IF EXISTS "Public players are viewable by everyone" ON players;
CREATE POLICY "Public players are viewable by everyone" ON players
  FOR SELECT USING (true);

-- Policy: solo service role può modificare players
DROP POLICY IF EXISTS "Only service role can modify players" ON players;
CREATE POLICY "Only service role can modify players" ON players
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Player teams junction table RLS
ALTER TABLE player_teams ENABLE ROW LEVEL SECURITY;

-- Policy per player_teams: chiunque può leggere (storia pubblica)
DROP POLICY IF EXISTS "Public player_teams are viewable by everyone" ON player_teams;
CREATE POLICY "Public player_teams are viewable by everyone" ON player_teams
  FOR SELECT USING (true);

-- Policy: solo service role può modificare player_teams
DROP POLICY IF EXISTS "Only service role can modify player_teams" ON player_teams;
CREATE POLICY "Only service role can modify player_teams" ON player_teams
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- Secure RPC Functions
-- =====================================================

-- validate_player_intersection - SECURE version
CREATE OR REPLACE FUNCTION validate_player_intersection(
  team_a_id BIGINT,
  team_b_id BIGINT,
  input_name TEXT
) RETURNS TABLE (
  valid BOOLEAN,
  player_id BIGINT,
  player_name TEXT,
  similarity_score REAL,
  team_a_seasons INTEGER[],
  team_b_seasons INTEGER[]
) AS $$
BEGIN
  -- Input validation
  IF team_a_id IS NULL OR team_b_id IS NULL THEN
    RETURN QUERY
    SELECT FALSE, NULL, NULL, NULL, NULL::INTEGER[], NULL::INTEGER[];
    RETURN;
  END IF;

  -- Sanitize input: max length
  IF character_length(input_name) > 100 THEN
    input_name = LEFT(input_name, 100);
  END IF;

  -- Check for SQL injection attempts
  IF input_name LIKE '%--%' OR input_name LIKE '%/*%' OR input_name LIKE '%\x27%' THEN
    RETURN QUERY
    SELECT FALSE, NULL, NULL, NULL, NULL::INTEGER[], NULL::INTEGER[];
    RETURN;
  END IF;

  -- Main query
  RETURN QUERY
  WITH MatchedPlayer AS (
    SELECT DISTINCT
      p.id AS pid,
      p.name AS pname,
      similarity(p.name, input_name) AS sim
    FROM players p
    JOIN player_teams pt1 ON p.id = pt1.player_id
    JOIN player_teams pt2 ON p.id = pt2.player_id
    WHERE pt1.team_id = team_a_id
      AND pt2.team_id = team_b_id
      AND p.name % input_name
    ORDER BY sim DESC
    LIMIT 1
  )
  SELECT
    TRUE AS valid,
    m.pid AS player_id,
    m.pname AS player_name,
    m.sim AS similarity_score,
    ARRAY(SELECT season FROM player_teams WHERE player_teams.player_id = m.pid AND team_id = team_a_id ORDER BY season) AS team_a_seasons,
    ARRAY(SELECT season FROM player_teams WHERE player_teams.player_id = m.pid AND team_id = team_b_id ORDER BY season) AS team_b_seasons
  FROM MatchedPlayer m;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- get_random_match - SECURE version
CREATE OR REPLACE FUNCTION get_random_match(
  p_league_id BIGINT DEFAULT NULL,
  p_recent_teams BIGINT[] DEFAULT ARRAY[]::BIGINT[],
  p_difficulty INT DEFAULT 1
) RETURNS TABLE (
  team1_id BIGINT,
  team1_name TEXT,
  team1_logo TEXT,
  team2_id BIGINT,
  team2_name TEXT,
  team2_logo TEXT,
  player_name TEXT,
  team1_seasons INTEGER[],
  team2_seasons INTEGER[]
) AS $$
DECLARE
  v_player_id BIGINT;
  v_team1_id BIGINT;
  v_team2_id BIGINT;
BEGIN
  -- Input validation
  IF p_league_id IS NOT NULL AND (character_length(p_league_id::TEXT) > 20 OR p_league_id < 0) THEN
    p_league_id = NULL;
  END IF;

  IF p_recent_teams IS NULL THEN
    p_recent_teams := ARRAY[]::BIGINT[];
  END IF;

  -- Difficulty validation
  IF p_difficulty < 1 OR p_difficulty > 3 THEN
    p_difficulty := 1;
  END IF;

  -- Sanitize p_recent_teams
  p_recent_teams := array_remove(p_recent_teams, NULL);
  p_recent_teams := array_filter(p_recent_teams, x -> x IS NOT NULL AND x > 0 AND x < 9223372036854775807);

  -- Main logic
  WITH ValidTeams AS (
    SELECT id
    FROM teams
    WHERE (p_league_id IS NULL OR league_id = p_league_id)
      AND NOT (id = ANY(p_recent_teams))
  ),
  PlayerWithMultipleTeams AS (
    SELECT pt.player_id
    FROM player_teams pt
    JOIN ValidTeams vt ON pt.team_id = vt.id
    GROUP BY pt.player_id
    HAVING COUNT(DISTINCT pt.team_id) >= 2
    ORDER BY random()
    LIMIT 1
  ),
  SelectedTeams AS (
    SELECT pt.team_id
    FROM player_teams pt
    JOIN ValidTeams vt ON pt.team_id = vt.id
    WHERE pt.player_id = (SELECT player_id FROM PlayerWithMultipleTeams)
    GROUP BY pt.team_id
    ORDER BY random()
    LIMIT 2
  )
  SELECT
    MAX(CASE WHEN rn = 1 THEN team_id END),
    MAX(CASE WHEN rn = 2 THEN team_id END),
    MAX(player_id)
  INTO v_team1_id, v_team2_id, v_player_id
  FROM (
    SELECT team_id, (SELECT player_id FROM PlayerWithMultipleTeams) as player_id, row_number() OVER () as rn
    FROM SelectedTeams
  ) sub;

  -- Fallback
  IF v_team1_id IS NULL OR v_team2_id IS NULL THEN
    WITH ValidTeams AS (
      SELECT id
      FROM teams
      WHERE (p_league_id IS NULL OR league_id = p_league_id)
    ),
    PlayerWithMultipleTeams AS (
      SELECT pt.player_id
      FROM player_teams pt
      JOIN ValidTeams vt ON pt.team_id = vt.id
      GROUP BY pt.player_id
      HAVING COUNT(DISTINCT pt.team_id) >= 2
      ORDER BY random()
      LIMIT 1
    ),
    SelectedTeams AS (
      SELECT pt.team_id
      FROM player_teams pt
      JOIN ValidTeams vt ON pt.team_id = vt.id
      WHERE pt.player_id = (SELECT player_id FROM PlayerWithMultipleTeams)
      GROUP BY pt.team_id
      ORDER BY random()
      LIMIT 2
    )
    SELECT
      MAX(CASE WHEN rn = 1 THEN team_id END),
      MAX(CASE WHEN rn = 2 THEN team_id END),
      MAX(player_id)
    INTO v_team1_id, v_team2_id, v_player_id
    FROM (
      SELECT team_id, (SELECT player_id FROM PlayerWithMultipleTeams) as player_id, row_number() OVER () as rn
      FROM SelectedTeams
    ) sub;
  END IF;

  IF v_team1_id IS NOT NULL AND v_team2_id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      t1.id, t1.name, t1.logo_url,
      t2.id, t2.name, t2.logo_url,
      p.name,
      ARRAY(SELECT season FROM player_teams WHERE player_teams.player_id = v_player_id AND team_id = v_team1_id ORDER BY season) AS team1_seasons,
      ARRAY(SELECT season FROM player_teams WHERE player_teams.player_id = v_player_id AND team_id = v_team2_id ORDER BY season) AS team2_seasons
    FROM teams t1
    CROSS JOIN teams t2
    CROSS JOIN players p
    WHERE t1.id = v_team1_id AND t2.id = v_team2_id AND p.id = v_player_id;
  END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Revoke execute da PUBLIC e concedi a authenticated
REVOKE ALL ON FUNCTION validate_player_intersection(BIGINT, BIGINT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_random_match(BIGINT, BIGINT[], INT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION validate_player_intersection(BIGINT, BIGINT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_random_match(BIGINT, BIGINT[], INT) TO authenticated;

-- =====================================================
-- AUDIT LOGS (opzionale)
-- =====================================================

-- Create audit_logs table (opzionale per tracking)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL, -- INSERT, UPDATE, DELETE
  record_id TEXT,
  user_id UUID REFERENCES auth.users(id),
  ip_address INET,
  user_agent TEXT,
  request_body JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- END of setup-auth.sql
-- =====================================================
