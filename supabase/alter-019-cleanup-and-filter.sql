-- =====================================================
-- Fix Challenge: cleanup e filter finale
-- =====================================================

-- Pulisci il DB - metti come expired tutte le sfide accepted da più di 10 minuti
UPDATE public.challenges
SET status = 'expired', updated_at = NOW()
WHERE status = 'accepted'
AND created_at < NOW() - INTERVAL '10 minutes';

-- Aggiorna anche get_challenge_by_token per filtrare solo sfide recenti
DROP FUNCTION IF EXISTS public.get_challenge_by_token(TEXT);

CREATE FUNCTION public.get_challenge_by_token(p_token TEXT)
RETURNS TABLE (
  id UUID,
  creator_id UUID,
  creator_name TEXT,
  status TEXT,
  room_id TEXT,
  opponent_id UUID,
  opponent_name TEXT,
  opponent_tier TEXT,
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.creator_id,
    c.creator_name,
    c.status,
    c.room_id,
    c.opponent_id,
    COALESCE(p.nickname, p.first_name, 'Sfidante') AS opponent_name,
    COALESCE(p.tier, 'bronze') AS opponent_tier,
    c.created_at,
    c.expires_at
  FROM public.challenges c
  LEFT JOIN public.profiles p ON c.opponent_id = p.id
  WHERE c.token = p_token
    AND c.expires_at > NOW()
    AND c.status IN ('pending', 'accepted')
    AND c.created_at > NOW() - INTERVAL '10 minutes';  -- Only recent challenges!
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_challenge_by_token TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_challenge_by_token TO anon;