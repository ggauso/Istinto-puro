-- =====================================================
-- alter-002-gioco.sql
-- Feature di Gioco - Fase 2
-- Da eseguire su Supabase
-- =====================================================

-- =====================================================
-- 1. AGGIUNGERE COLONNA TIER A PROFILES SE NON ESISTE
-- =====================================================

-- Verifica se la colonna tier esiste già
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'tier'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN tier TEXT DEFAULT 'bronze';
    END IF;
END $$;

-- Aggiorna i tier esistenti basati sul punteggio
UPDATE public.profiles
SET tier = CASE
  WHEN total_score >= 5001 THEN 'diamond'
  WHEN total_score >= 3001 THEN 'platinum'
  WHEN total_score >= 1501 THEN 'gold'
  WHEN total_score >= 501 THEN 'silver'
  ELSE 'bronze'
END
WHERE tier IS NULL OR tier = 'bronze';

-- Indici per le query di classifica
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

-- Policy
DROP POLICY IF EXISTS "Users can view own matches" ON public.matches;
CREATE POLICY "Users can view own matches" ON public.matches
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own matches" ON public.matches;
CREATE POLICY "Users can insert own matches" ON public.matches
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own matches" ON public.matches;
CREATE POLICY "Users can update own matches" ON public.matches
  FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS matches_user_id_idx ON matches(user_id);
CREATE INDEX IF NOT EXISTS matches_status_idx ON matches(status);

-- =====================================================
-- 3. CREARE TABELLA MATCHES_HISTORY
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

-- RLS
ALTER TABLE public.matches_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own history" ON public.matches_history;
CREATE POLICY "Users can view own history" ON public.matches_history
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own history" ON public.matches_history;
CREATE POLICY "Users can insert own history" ON public.matches_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS matches_history_user_id_idx ON matches_history(user_id);
CREATE INDEX IF NOT EXISTS matches_history_played_at_idx ON matches_history(played_at DESC);

-- =====================================================
-- 4. FUNZIONE RPC: SAVE_MATCH_RESULT
-- =====================================================

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

-- =====================================================
-- 5. VERIFICA
-- =====================================================

-- Verifica struttura
SELECT 'profiles tier column' as check_name,
       column_name IS NOT NULL as exists
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'tier';

SELECT 'matches table' as check_name,
       (SELECT COUNT(*) FROM information_schema.tables
        WHERE table_name = 'matches') > 0 as exists;

SELECT 'matches_history table' as check_name,
       (SELECT COUNT(*) FROM information_schema.tables
        WHERE table_name = 'matches_history') > 0 as exists;

-- Test funzione RPC
-- SELECT public.save_match_result(...); -- Decommenta per testare