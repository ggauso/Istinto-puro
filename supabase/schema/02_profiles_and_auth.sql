-- =====================================================================
-- 02_profiles_and_auth.sql
--
-- Profilo utente collegato a auth.users, RLS, trigger di creazione
-- automatica. Stato consolidato di: setup-auth.sql (unica fonte per RLS
-- e trigger, mai più ridefiniti), alter_features.sql/alter-002 (tier),
-- alter-003-nickname.sql (nickname), alter-010-statistics.sql (colonne
-- statistiche avanzate).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
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
  updated_at TIMESTAMPTZ DEFAULT now(),
  tier TEXT DEFAULT 'bronze',
  nickname TEXT,
  matches_lost INTEGER DEFAULT 0,
  matches_abandoned INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  streak_type TEXT DEFAULT 'none' CHECK (streak_type IN ('win', 'loss', 'none')),
  longest_win_streak INTEGER DEFAULT 0,
  longest_loss_streak INTEGER DEFAULT 0,
  best_score INTEGER DEFAULT 0,
  -- Non utilizzata da nessuna funzione o dal client: mantenuta per non
  -- rompere eventuali dipendenze non ancora scoperte, candidata a rimozione.
  total_time_played INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS profiles_tier_idx ON public.profiles (tier);
CREATE INDEX IF NOT EXISTS profiles_total_score_idx ON public.profiles (total_score DESC);
CREATE INDEX IF NOT EXISTS profiles_nickname_idx ON public.profiles (nickname);

-- =====================================================================
-- RLS (unica definizione esistente in tutta la cronologia, da setup-auth.sql)
-- =====================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
CREATE POLICY "Users can insert their own profile." ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
CREATE POLICY "Users can update own profile." ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- =====================================================================
-- Trigger: crea automaticamente il profilo alla registrazione
-- =====================================================================
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- =====================================================================
-- get_user_info: usata per mostrare nickname/tier dell'avversario
-- (invariata dal 2026-03-25, alter-003-nickname.sql)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_user_info(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  nickname TEXT,
  first_name TEXT,
  last_name TEXT,
  tier TEXT,
  total_score INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id::UUID,
    p.nickname::TEXT,
    p.first_name::TEXT,
    p.last_name::TEXT,
    p.tier::TEXT,
    p.total_score::INTEGER
  FROM public.profiles p
  WHERE p.id = p_user_id;
END;
$$;
