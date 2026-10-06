-- =====================================================
-- Fix Challenge: get_my_active_challenge deve filtrare solo status 'accepted'
-- =====================================================

-- Aggiorna get_my_active_challenge per filtrare solo status 'accepted'
-- (non restituire sfide completate, expire o declined)
CREATE OR REPLACE FUNCTION public.get_my_active_challenge()
RETURNS TABLE (
  id UUID,
  room_id TEXT,
  status TEXT,
  opponent_name TEXT,
  opponent_tier TEXT,
  opponent_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  -- Return only the MOST RECENT accepted challenge (NOT completed, NOT expired)
  RETURN QUERY
  SELECT
    c.id,
    c.room_id,
    c.status,
    COALESCE(p.nickname, p.first_name, 'Sfidante') AS opponent_name,
    COALESCE(p.tier, 'bronze') AS opponent_tier,
    c.opponent_id
  FROM public.challenges c
  LEFT JOIN public.profiles p ON c.opponent_id = p.id
  WHERE c.creator_id = v_user_id
    AND c.status = 'accepted'  -- Only accepted, NOT completed/expired
    AND c.room_id IS NOT NULL
    AND c.created_at > NOW() - INTERVAL '1 hour'
  ORDER BY c.created_at DESC
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_active_challenge TO authenticated;