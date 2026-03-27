-- =====================================================
-- Fix Challenge: completeChallenge deve impostare status 'completed'
-- =====================================================

-- Aggiorna complete_challenge per impostare 'completed' invece di 'completed' (già corretto)
-- Verifica che imposti correttamente
CREATE OR REPLACE FUNCTION public.complete_challenge(p_challenge_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.challenges
  SET status = 'completed', updated_at = NOW()
  WHERE id = p_challenge_id AND status = 'accepted';

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_challenge TO authenticated;

-- Pulisci il DB - metti come completed tutte le sfide accepted da più di 10 minuti
-- (quelle giocate di recente)
UPDATE public.challenges
SET status = 'completed', updated_at = NOW()
WHERE status = 'accepted'
AND created_at < NOW() - INTERVAL '10 minutes';

-- Metti come expired quelle non mai accettate
UPDATE public.challenges
SET status = 'expired', updated_at = NOW()
WHERE status = 'pending'
AND expires_at < NOW();