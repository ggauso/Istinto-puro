-- =====================================================
-- alter-003-nickname.sql
-- Aggiunta campo nickname per sfide PvP
-- Da eseguire su Supabase
-- =====================================================

-- =====================================================
-- 1. AGGIUNGERE COLONNA NICKNAME A PROFILES
-- =====================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS nickname TEXT;

-- Indice per ricerca nickname
CREATE INDEX IF NOT EXISTS profiles_nickname_idx ON profiles(nickname);

-- =====================================================
-- 2. FUNZIONE RPC: GET_USER_BY_ID (per ottenere nickname avversario)
-- =====================================================

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

-- =====================================================
-- 3. VERIFICA
-- =====================================================

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'nickname';