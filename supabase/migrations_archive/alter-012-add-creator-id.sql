-- =====================================================
-- Fix Challenge: aggiungi creator_id alla funzione get_challenge_by_token
-- =====================================================

-- Aggiorna get_challenge_by_token per includere creator_id
DROP FUNCTION IF EXISTS public.get_challenge_by_token(TEXT);

CREATE FUNCTION public.get_challenge_by_token(p_token TEXT)
RETURNS TABLE (
  id UUID,
  creator_id UUID,
  creator_name TEXT,
  status TEXT,
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
    c.created_at,
    c.expires_at
  FROM public.challenges c
  WHERE c.token = p_token AND c.expires_at > NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_challenge_by_token TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_challenge_by_token TO anon;