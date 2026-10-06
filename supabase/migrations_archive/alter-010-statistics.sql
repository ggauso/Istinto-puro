-- =====================================================
-- Statistiche Avanzate (Milestone 7)
-- =====================================================

-- Aggiungi colonne per statistiche avanzate al profilo
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS matches_lost INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS matches_abandoned INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS streak_type TEXT DEFAULT 'none' CHECK (streak_type IN ('win', 'loss', 'none')),
ADD COLUMN IF NOT EXISTS longest_win_streak INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS longest_loss_streak INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS best_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_time_played INTEGER DEFAULT 0;

-- Aggiorna la funzione update_profile_stats per gestire le nuove statistiche
DROP FUNCTION IF EXISTS public.update_profile_stats(UUID, BOOLEAN, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION public.update_profile_stats(
  p_user_id UUID,
  p_is_win BOOLEAN,
  p_score INTEGER DEFAULT 0,
  p_is_abandoned BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_streak INTEGER;
  v_current_streak_type TEXT;
  v_longest_win_streak INTEGER;
  v_longest_loss_streak INTEGER;
  v_new_streak INTEGER;
  v_new_streak_type TEXT;
BEGIN
  -- Ottieni statistiche attuali
  SELECT COALESCE(current_streak, 0), COALESCE(streak_type, 'none'),
         COALESCE(longest_win_streak, 0), COALESCE(longest_loss_streak, 0)
  INTO v_current_streak, v_current_streak_type, v_longest_win_streak, v_longest_loss_streak
  FROM public.profiles
  WHERE id = p_user_id;

  -- Calcola nuova streak
  IF p_is_abandoned THEN
    -- Abbandono: resetta streak a 0, conta come sconfitta
    v_new_streak := 0;
    v_new_streak_type := 'none';
  ELSIF p_is_win THEN
    -- Vittoria
    IF v_current_streak_type = 'win' THEN
      v_new_streak := v_current_streak + 1;
      v_new_streak_type := 'win';
    ELSE
      v_new_streak := 1;
      v_new_streak_type := 'win';
    END IF;
  ELSE
    -- Sconfitta
    IF v_current_streak_type = 'loss' THEN
      v_new_streak := v_current_streak + 1;
      v_new_streak_type := 'loss';
    ELSE
      v_new_streak := 1;
      v_new_streak_type := 'loss';
    END IF;
  END IF;

  -- Aggiorna record
  UPDATE public.profiles
  SET
    matches_played = COALESCE(matches_played, 0) + 1,
    matches_won = COALESCE(matches_won, 0) + CASE WHEN p_is_win THEN 1 ELSE 0 END,
    matches_lost = COALESCE(matches_lost, 0) + CASE WHEN NOT p_is_win AND NOT p_is_abandoned THEN 1 ELSE 0 END,
    matches_abandoned = COALESCE(matches_abandoned, 0) + CASE WHEN p_is_abandoned THEN 1 ELSE 0 END,
    total_score = COALESCE(total_score, 0) + GREATEST(p_score, 0),
    best_score = GREATEST(COALESCE(best_score, 0), p_score),
    current_streak = v_new_streak,
    streak_type = v_new_streak_type,
    longest_win_streak = GREATEST(COALESCE(longest_win_streak, 0),
      CASE WHEN v_new_streak_type = 'win' THEN v_new_streak ELSE 0 END),
    longest_loss_streak = GREATEST(COALESCE(longest_loss_streak, 0),
      CASE WHEN v_new_streak_type = 'loss' THEN v_new_streak ELSE 0 END),
    updated_at = NOW()
  WHERE id = p_user_id;
END;
$$;

-- Funzione per ottenere statistiche utente
DROP FUNCTION IF EXISTS public.get_user_stats(UUID);

CREATE OR REPLACE FUNCTION public.get_user_stats(p_user_id UUID)
RETURNS TABLE (
  matches_played INTEGER,
  matches_won INTEGER,
  matches_lost INTEGER,
  matches_abandoned INTEGER,
  win_rate DECIMAL(5,2),
  average_score DECIMAL(10,2),
  current_streak INTEGER,
  streak_type TEXT,
  longest_win_streak INTEGER,
  longest_loss_streak INTEGER,
  best_score INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(p.matches_played, 0) AS matches_played,
    COALESCE(p.matches_won, 0) AS matches_won,
    COALESCE(p.matches_lost, 0) AS matches_lost,
    COALESCE(p.matches_abandoned, 0) AS matches_abandoned,
    CASE
      WHEN COALESCE(p.matches_played, 0) > 0
      THEN ROUND((COALESCE(p.matches_won, 0)::DECIMAL / p.matches_played::DECIMAL) * 100, 2)
      ELSE 0
    END AS win_rate,
    CASE
      WHEN COALESCE(p.matches_played, 0) > 0
      THEN ROUND(p.total_score::DECIMAL / p.matches_played::DECIMAL, 2)
      ELSE 0
    END AS average_score,
    COALESCE(p.current_streak, 0) AS current_streak,
    COALESCE(p.streak_type, 'none')::TEXT AS streak_type,
    COALESCE(p.longest_win_streak, 0) AS longest_win_streak,
    COALESCE(p.longest_loss_streak, 0) AS longest_loss_streak,
    COALESCE(p.best_score, 0) AS best_score
  FROM public.profiles p
  WHERE p.id = p_user_id;
END;
$$;

-- Query di utilità
-- SELECT * FROM public.get_user_stats('user-uuid-here');