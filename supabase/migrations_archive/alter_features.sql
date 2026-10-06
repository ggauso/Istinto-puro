-- =====================================================
-- ALTER TABLE per Feature di Gioco
-- Esegui questo file sul database Supabase
-- =====================================================

-- =====================================================
-- 1. AGGIUNGERE CAMPO TIER AL PROFILO
-- =====================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'bronze';

-- Aggiornare il tier esistente in base al punteggio
UPDATE public.profiles
SET tier = CASE
  WHEN total_score >= 5001 THEN 'diamond'
  WHEN total_score >= 3001 THEN 'platinum'
  WHEN total_score >= 1501 THEN 'gold'
  WHEN total_score >= 501 THEN 'silver'
  ELSE 'bronze'
END;

-- Creare indice per velocizzare le query sulla classifica
CREATE INDEX IF NOT EXISTS profiles_tier_idx ON profiles(tier);
CREATE INDEX IF NOT EXISTS profiles_total_score_idx ON profiles(total_score DESC);

-- =====================================================
-- 2. CREARE TABELLA MATCHES (partite in corso)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  opponent_name TEXT NOT NULL,
  opponent_tier TEXT DEFAULT 'bronze',
  difficulty INTEGER DEFAULT 1,
  status TEXT DEFAULT 'in_progress',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS per matches
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- Policy: utente può vedere solo le proprie partite
CREATE POLICY "Users can view own matches" ON public.matches
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own matches" ON public.matches
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own matches" ON public.matches
  FOR UPDATE USING (auth.uid() = user_id);

-- Indici
CREATE INDEX IF NOT EXISTS matches_user_id_idx ON matches(user_id);
CREATE INDEX IF NOT EXISTS matches_status_idx ON matches(status);

-- =====================================================
-- 3. CREARE TABELLA MATCHES_HISTORY (storico partite)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.matches_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  opponent_name TEXT NOT NULL,
  player_tier TEXT NOT NULL,
  opponent_tier TEXT NOT NULL,
  player_score INTEGER NOT NULL,
  opponent_score INTEGER NOT NULL,
  is_win BOOLEAN NOT NULL,
  difficulty INTEGER DEFAULT 1,
  played_at TIMESTAMPTZ DEFAULT now()
);

-- RLS per matches_history
ALTER TABLE public.matches_history ENABLE ROW LEVEL SECURITY;

-- Policy: utente può vedere solo il proprio storico
CREATE POLICY "Users can view own history" ON public.matches_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own history" ON public.matches_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Indici
CREATE INDEX IF NOT EXISTS matches_history_user_id_idx ON matches_history(user_id);
CREATE INDEX IF NOT EXISTS matches_history_played_at_idx ON matches_history(played_at DESC);
CREATE INDEX IF NOT EXISTS matches_history_is_win_idx ON matches_history(is_win);

-- =====================================================
-- 4. CREARE TABELLA PER CLASSIFICHE TEMPORALI
-- =====================================================

CREATE TABLE IF NOT EXISTS public.leaderboard_weekly (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_score INTEGER DEFAULT 0,
  matches_played INTEGER DEFAULT 0,
  matches_won INTEGER DEFAULT 0,
  week_start DATE NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.leaderboard_monthly (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_score INTEGER DEFAULT 0,
  matches_played INTEGER DEFAULT 0,
  matches_won INTEGER DEFAULT 0,
  month_start DATE NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS per classifiche
ALTER TABLE public.leaderboard_weekly ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_monthly ENABLE ROW LEVEL SECURITY;

-- Policy: tutti possono vedere la classifica, solo service_role può modificare
CREATE POLICY "Anyone can view weekly leaderboard" ON public.leaderboard_weekly
  FOR SELECT USING (true);

CREATE POLICY "Anyone can view monthly leaderboard" ON public.leaderboard_monthly
  FOR SELECT USING (true);

CREATE POLICY "Service role can update weekly leaderboard" ON public.leaderboard_weekly
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role can update monthly leaderboard" ON public.leaderboard_monthly
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- 5. CREARE FUNZIONI RPC
-- =====================================================

-- Get leaderboard (top 100)
CREATE OR REPLACE FUNCTION public.get_leaderboard(
  p_limit INTEGER DEFAULT 100,
  p_tier TEXT DEFAULT NULL
)
RETURNS TABLE (
  rank INTEGER,
  user_id UUID,
  display_name TEXT,
  total_score INTEGER,
  tier TEXT,
  matches_played INTEGER,
  matches_won INTEGER,
  win_rate INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (ORDER BY p.total_score DESC)::INTEGER AS rank,
    p.id::UUID,
    COALESCE(p.first_name, 'Anonimo')::TEXT AS display_name,
    p.total_score::INTEGER,
    p.tier::TEXT,
    p.matches_played::INTEGER,
    p.matches_won::INTEGER,
    CASE
      WHEN p.matches_played > 0 THEN ((p.matches_won::FLOAT / p.matches_played::FLOAT) * 100)::INTEGER
      ELSE 0
    END::INTEGER AS win_rate
  FROM public.profiles p
  WHERE p.tier = COALESCE(p_tier, p.tier)
  ORDER BY p.total_score DESC
  LIMIT p_limit;
END;
$$;

-- Save match result
CREATE OR REPLACE FUNCTION public.save_match_result(
  p_user_id UUID,
  p_player_name TEXT,
  p_opponent_name TEXT,
  p_player_tier TEXT,
  p_opponent_tier TEXT,
  p_player_score INTEGER,
  p_opponent_score INTEGER,
  p_is_win BOOLEAN,
  p_difficulty INTEGER DEFAULT 1
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_match_id UUID;
BEGIN
  -- Inserisci nello storico
  INSERT INTO public.matches_history (
    user_id,
    player_name,
    opponent_name,
    player_tier,
    opponent_tier,
    player_score,
    opponent_score,
    is_win,
    difficulty,
    played_at
  ) VALUES (
    p_user_id,
    p_player_name,
    p_opponent_name,
    p_player_tier,
    p_opponent_tier,
    p_player_score,
    p_opponent_score,
    p_is_win,
    p_difficulty,
    NOW()
  )
  RETURNING id INTO v_match_id;

  -- Aggiorna i punteggi dell'utente
  UPDATE public.profiles
  SET
    total_score = total_score + p_player_score,
    matches_played = matches_played + 1,
    matches_won = matches_won + CASE WHEN p_is_win THEN 1 ELSE 0 END,
    tier = CASE
      WHEN total_score + p_player_score >= 5001 THEN 'diamond'
      WHEN total_score + p_player_score >= 3001 THEN 'platinum'
      WHEN total_score + p_player_score >= 1501 THEN 'gold'
      WHEN total_score + p_player_score >= 501 THEN 'silver'
      ELSE 'bronze'
    END,
    updated_at = NOW()
  WHERE id = p_user_id;

  RETURN v_match_id;
END;
$$;

-- Get user rank
CREATE OR REPLACE FUNCTION public.get_user_rank(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rank INTEGER;
  v_total_score INTEGER;
BEGIN
  SELECT total_score INTO v_total_score FROM public.profiles WHERE id = p_user_id;

  SELECT COUNT(*)::INTEGER INTO v_rank
  FROM public.profiles
  WHERE total_score > v_total_score;

  RETURN v_rank + 1;
END;
$$;

-- =====================================================
-- 6. AGGIORNARE TRIGGER PER TIER AUTOMATICO
-- =====================================================

-- Il tier viene aggiornato automaticamente dalla funzione save_match_result
-- Non serve trigger aggiuntivo perché aggiorniamo direttamente

-- =====================================================
-- VERIFICA
-- =====================================================

-- Verifica che le tabelle siano state create
SELECT 'profiles' as table_name, tier, count(*) as count
FROM public.profiles
GROUP BY tier;

SELECT 'matches' as table_name, count(*) as count FROM public.matches;
SELECT 'matches_history' as table_name, count(*) as count FROM public.matches_history;
SELECT 'leaderboard_weekly' as table_name, count(*) as count FROM public.leaderboard_weekly;
SELECT 'leaderboard_monthly' as table_name, count(*) as count FROM public.leaderboard_monthly;

-- Test RPC
SELECT * FROM public.get_leaderboard(10);