-- =====================================================================
-- 11_tournaments.sql
--
-- Tornei a eliminazione diretta (Milestone 5). Iscrizione libera a un
-- torneo aperto; quando si riempie (max_players, potenza di 2), il
-- bracket del round 1 viene generato automaticamente con accoppiamento
-- casuale. Ogni match assegna una "stanza" (room_id) realtime, riusando
-- lo stesso meccanismo di join già usato per le sfide dirette tra amici
-- (vedi 09_friend_challenges.sql / src/store/matchmakingSlice.ts).
--
-- Principio di sicurezza (lezione diretta dell'audit 2026-09-19, vedi
-- ROADMAP_SECURITY.md): nessuna policy RLS INSERT/UPDATE diretta —
-- ogni scrittura passa esclusivamente dalle funzioni SECURITY DEFINER
-- sotto, che verificano sempre auth.uid() prima di modificare dati.
-- =====================================================================

-- =====================================================================
-- Tabelle
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  max_players INTEGER NOT NULL CHECK (max_players IN (2, 4, 8, 16)),
  current_players INTEGER NOT NULL DEFAULT 0,
  league TEXT DEFAULT 'seria_a' CHECK (league IN ('seria_a', 'premier', 'la_liga', 'bundesliga', 'ligue_1')),
  difficulty INTEGER NOT NULL DEFAULT 1 CHECK (difficulty IN (1, 2, 3)),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
  creator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  winner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Avvio: 'fill' (default, parte al raggiungimento di max_players, come prima)
-- oppure 'scheduled' (parte a data/ora fissata anche se non al completo, vedi
-- start_due_tournaments sotto). total_rounds viene calcolato e fissato quando
-- il torneo parte effettivamente (può essere minore di log2(max_players) se
-- lo scheduling lo avvia con meno iscritti del massimo, vedi _start_tournament).
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS start_mode TEXT NOT NULL DEFAULT 'fill' CHECK (start_mode IN ('fill', 'scheduled'));
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS total_rounds INTEGER;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournaments_scheduled_at_check') THEN
    ALTER TABLE public.tournaments
      ADD CONSTRAINT tournaments_scheduled_at_check
      CHECK (start_mode = 'fill' OR scheduled_at IS NOT NULL);
  END IF;
END $$;

-- Backfill per tornei già avviati prima dell'introduzione di total_rounds.
UPDATE public.tournaments
SET total_rounds = CASE max_players WHEN 2 THEN 1 WHEN 4 THEN 2 WHEN 8 THEN 3 WHEN 16 THEN 4 END
WHERE total_rounds IS NULL AND status IN ('in_progress', 'completed');

-- Permette 'all' (Tutti i Campionati, come nella modalità singola/PvP
-- principale) oltre ai singoli campionati già previsti. Ri-crea il CHECK
-- esplicitamente così l'ALTER è idempotente sia su DB nuovi che esistenti.
ALTER TABLE public.tournaments DROP CONSTRAINT IF EXISTS tournaments_league_check;
ALTER TABLE public.tournaments ADD CONSTRAINT tournaments_league_check
  CHECK (league IN ('all', 'seria_a', 'premier', 'la_liga', 'bundesliga', 'ligue_1'));

CREATE INDEX IF NOT EXISTS idx_tournaments_status ON public.tournaments (status) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_tournaments_scheduled_due ON public.tournaments (scheduled_at) WHERE status = 'open' AND start_mode = 'scheduled';

CREATE TABLE IF NOT EXISTS public.tournament_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'eliminated', 'winner')),
  eliminated_round INTEGER,
  final_position INTEGER,
  UNIQUE (tournament_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tournament_participants_tournament ON public.tournament_participants (tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_participants_user ON public.tournament_participants (user_id);

CREATE TABLE IF NOT EXISTS public.tournament_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  match_number INTEGER NOT NULL,
  player1_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  player2_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  winner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  room_id TEXT NOT NULL DEFAULT ('tournament_' || gen_random_uuid()::TEXT),
  player1_score INTEGER DEFAULT 0,
  player2_score INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE (tournament_id, round, match_number)
);

CREATE INDEX IF NOT EXISTS idx_tournament_matches_tournament ON public.tournament_matches (tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_player1 ON public.tournament_matches (player1_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_player2 ON public.tournament_matches (player2_id);

-- =====================================================================
-- RLS — solo lettura per authenticated, nessuna scrittura diretta
-- =====================================================================
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tournaments are viewable by authenticated users" ON public.tournaments;
CREATE POLICY "Tournaments are viewable by authenticated users"
ON public.tournaments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Tournament participants are viewable by authenticated users" ON public.tournament_participants;
CREATE POLICY "Tournament participants are viewable by authenticated users"
ON public.tournament_participants FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Tournament matches are viewable by authenticated users" ON public.tournament_matches;
CREATE POLICY "Tournament matches are viewable by authenticated users"
ON public.tournament_matches FOR SELECT TO authenticated USING (true);

-- =====================================================================
-- Helper interno: avvia il torneo generando il bracket del round 1
-- (non esposta via GRANT — chiamata solo da join_tournament)
-- =====================================================================
CREATE OR REPLACE FUNCTION public._start_tournament(p_tournament_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_player_ids UUID[];
  v_player_count INTEGER;
  v_total_rounds INTEGER;
  v_bracket_size INTEGER;
  v_byes INTEGER;
  v_slot INTEGER;
  v_next_match_number INTEGER;
  v_player_idx INTEGER := 1;
BEGIN
  SELECT array_agg(user_id ORDER BY random()) INTO v_player_ids
  FROM public.tournament_participants
  WHERE tournament_id = p_tournament_id;

  v_player_count := COALESCE(array_length(v_player_ids, 1), 0);
  IF v_player_count < 2 THEN
    RETURN; -- non ci sono abbastanza iscritti per avviare un bracket
  END IF;

  -- Il torneo può partire con meno iscritti di max_players (avvio
  -- schedulato prima del riempimento, vedi start_due_tournaments): il
  -- bracket si adatta al numero reale di giocatori, assegnando un "bye"
  -- (passaggio diretto al round 2 senza giocare) a chi non trova un
  -- avversario nel round 1.
  v_total_rounds := CEIL(LN(v_player_count) / LN(2))::INTEGER;
  v_bracket_size := POWER(2, v_total_rounds)::INTEGER;
  v_byes := v_bracket_size - v_player_count;

  UPDATE public.tournaments
  SET status = 'in_progress', started_at = NOW(), updated_at = NOW(), total_rounds = v_total_rounds
  WHERE id = p_tournament_id;

  -- Slot 1..v_byes: bye, il giocatore passa direttamente al round 2.
  FOR v_slot IN 1..v_byes LOOP
    v_next_match_number := CEIL(v_slot / 2.0)::INTEGER;
    IF v_slot % 2 = 1 THEN
      INSERT INTO public.tournament_matches (tournament_id, round, match_number, player1_id, status)
      VALUES (p_tournament_id, 2, v_next_match_number, v_player_ids[v_player_idx], 'pending')
      ON CONFLICT (tournament_id, round, match_number) DO UPDATE SET player1_id = EXCLUDED.player1_id;
    ELSE
      INSERT INTO public.tournament_matches (tournament_id, round, match_number, player2_id, status)
      VALUES (p_tournament_id, 2, v_next_match_number, v_player_ids[v_player_idx], 'pending')
      ON CONFLICT (tournament_id, round, match_number) DO UPDATE SET player2_id = EXCLUDED.player2_id;
    END IF;
    v_player_idx := v_player_idx + 1;
  END LOOP;

  -- Slot restanti: match veri del round 1, una coppia di giocatori ciascuno.
  FOR v_slot IN (v_byes + 1)..v_bracket_size / 2 LOOP
    INSERT INTO public.tournament_matches (tournament_id, round, match_number, player1_id, player2_id, status)
    VALUES (p_tournament_id, 1, v_slot, v_player_ids[v_player_idx], v_player_ids[v_player_idx + 1], 'pending');
    v_player_idx := v_player_idx + 2;
  END LOOP;
END;
$$;

-- =====================================================================
-- Helper interno: completa un match (per vittoria normale o abbandono)
-- e fa avanzare il bracket / chiude il torneo. Non esposta via GRANT.
-- =====================================================================
CREATE OR REPLACE FUNCTION public._finalize_tournament_match(
  p_match_id UUID,
  p_winner_id UUID,
  p_player1_score INTEGER,
  p_player2_score INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_match RECORD;
  v_tournament RECORD;
  v_loser_id UUID;
  v_remaining_in_round INTEGER;
  v_total_rounds INTEGER;
  v_bracket_size INTEGER;
  v_prev_match RECORD;
  v_next_match_number INTEGER;
BEGIN
  SELECT * INTO v_match FROM public.tournament_matches WHERE id = p_match_id FOR UPDATE;

  IF v_match IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Idempotente: se già completato, non rieseguire l'avanzamento
  -- (host e guest possono chiamare entrambi a fine partita)
  IF v_match.status = 'completed' THEN
    RETURN TRUE;
  END IF;

  IF auth.uid() IS NULL OR (auth.uid() <> v_match.player1_id AND auth.uid() <> v_match.player2_id) THEN
    RETURN FALSE;
  END IF;

  IF p_winner_id <> v_match.player1_id AND p_winner_id <> v_match.player2_id THEN
    RETURN FALSE;
  END IF;

  UPDATE public.tournament_matches
  SET status = 'completed', winner_id = p_winner_id,
      player1_score = p_player1_score, player2_score = p_player2_score,
      completed_at = NOW()
  WHERE id = p_match_id;

  v_loser_id := CASE WHEN v_match.player1_id = p_winner_id THEN v_match.player2_id ELSE v_match.player1_id END;

  SELECT * INTO v_tournament FROM public.tournaments WHERE id = v_match.tournament_id;
  -- total_rounds riflette il bracket reale con cui il torneo è partito
  -- (può essere minore di log2(max_players) per un avvio schedulato
  -- anticipato, vedi _start_tournament); fallback per righe storiche.
  v_total_rounds := COALESCE(v_tournament.total_rounds, CASE v_tournament.max_players WHEN 2 THEN 1 WHEN 4 THEN 2 WHEN 8 THEN 3 WHEN 16 THEN 4 END);
  v_bracket_size := POWER(2, v_total_rounds)::INTEGER;

  -- Il perdente è eliminato subito; la posizione finale dipende solo dal
  -- round in cui è uscito (es. bracket da 8: eliminato al round 1 -> 5°,
  -- round 2 -> 3°, round 3/finale -> 2°), indipendentemente da quando il
  -- torneo nel suo complesso si concluderà.
  UPDATE public.tournament_participants
  SET status = 'eliminated', eliminated_round = v_match.round,
      final_position = (v_bracket_size / POWER(2, v_match.round))::INTEGER + 1
  WHERE tournament_id = v_match.tournament_id AND user_id = v_loser_id;

  SELECT COUNT(*) INTO v_remaining_in_round
  FROM public.tournament_matches
  WHERE tournament_id = v_match.tournament_id AND round = v_match.round AND status = 'pending';

  IF v_remaining_in_round > 0 THEN
    RETURN TRUE; -- il round non è ancora finito, nessun avanzamento da fare
  END IF;

  IF v_match.round >= v_total_rounds THEN
    -- Era la finale: chiudi il torneo
    UPDATE public.tournaments
    SET status = 'completed', winner_id = p_winner_id, completed_at = NOW(), updated_at = NOW()
    WHERE id = v_match.tournament_id;

    UPDATE public.tournament_participants
    SET status = 'winner', final_position = 1
    WHERE tournament_id = v_match.tournament_id AND user_id = p_winner_id;

    RETURN TRUE;
  END IF;

  -- Genera il round successivo: il vincitore del match dispari diventa
  -- player1, il vincitore del match pari successivo diventa player2 dello
  -- stesso match del round+1 (match_number = ceil(match_number/2)).
  FOR v_prev_match IN
    SELECT * FROM public.tournament_matches
    WHERE tournament_id = v_match.tournament_id AND round = v_match.round
    ORDER BY match_number
  LOOP
    v_next_match_number := CEIL(v_prev_match.match_number / 2.0)::INTEGER;
    IF v_prev_match.match_number % 2 = 1 THEN
      INSERT INTO public.tournament_matches (tournament_id, round, match_number, player1_id, status)
      VALUES (v_match.tournament_id, v_match.round + 1, v_next_match_number, v_prev_match.winner_id, 'pending')
      ON CONFLICT (tournament_id, round, match_number) DO UPDATE SET player1_id = v_prev_match.winner_id;
    ELSE
      UPDATE public.tournament_matches
      SET player2_id = v_prev_match.winner_id
      WHERE tournament_id = v_match.tournament_id AND round = v_match.round + 1 AND match_number = v_next_match_number;
    END IF;
  END LOOP;

  RETURN TRUE;
END;
$$;

-- =====================================================================
-- Funzioni RPC pubbliche
-- =====================================================================

CREATE OR REPLACE FUNCTION public.create_tournament(
  p_name TEXT,
  p_max_players INTEGER,
  p_league TEXT DEFAULT 'seria_a',
  p_difficulty INTEGER DEFAULT 1,
  p_start_mode TEXT DEFAULT 'fill',
  p_scheduled_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tournament_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Devi essere autenticato per creare un torneo';
  END IF;

  IF p_max_players NOT IN (2, 4, 8, 16) THEN
    RAISE EXCEPTION 'Numero di giocatori non valido (ammessi: 2, 4, 8, 16)';
  END IF;

  IF p_start_mode NOT IN ('fill', 'scheduled') THEN
    RAISE EXCEPTION 'Modalità di avvio non valida';
  END IF;

  IF p_start_mode = 'scheduled' THEN
    IF p_scheduled_at IS NULL THEN
      RAISE EXCEPTION 'Specificare data e ora per un torneo schedulato';
    END IF;
    IF p_scheduled_at <= NOW() THEN
      RAISE EXCEPTION 'La data/ora schedulata deve essere nel futuro';
    END IF;
  END IF;

  INSERT INTO public.tournaments (name, max_players, league, difficulty, creator_id, start_mode, scheduled_at)
  VALUES (
    p_name, p_max_players, p_league, p_difficulty, auth.uid(),
    p_start_mode, CASE WHEN p_start_mode = 'scheduled' THEN p_scheduled_at ELSE NULL END
  )
  RETURNING id INTO v_tournament_id;

  RETURN v_tournament_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_open_tournaments()
RETURNS TABLE (
  id UUID, name TEXT, max_players INTEGER, current_players INTEGER,
  league TEXT, difficulty INTEGER, creator_nickname TEXT, created_at TIMESTAMPTZ,
  start_mode TEXT, scheduled_at TIMESTAMPTZ, creator_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id, t.name, t.max_players, t.current_players, t.league, t.difficulty,
    COALESCE(NULLIF(p.nickname, ''), NULLIF(p.first_name, ''), 'Giocatore')::TEXT,
    t.created_at, t.start_mode, t.scheduled_at, t.creator_id
  FROM public.tournaments t
  LEFT JOIN public.profiles p ON t.creator_id = p.id
  WHERE t.status = 'open'
  ORDER BY t.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_tournament_details(p_tournament_id UUID)
RETURNS TABLE (
  tournament JSON,
  participants JSON,
  matches JSON
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT row_to_json(t) FROM (
      SELECT tt.id, tt.name, tt.max_players, tt.current_players, tt.league, tt.difficulty,
             tt.status, tt.creator_id, tt.winner_id, tt.created_at, tt.started_at, tt.completed_at,
             tt.start_mode, tt.scheduled_at
      FROM public.tournaments tt WHERE tt.id = p_tournament_id
    ) t),
    (SELECT json_agg(row_to_json(pp)) FROM (
      SELECT tp.user_id, COALESCE(NULLIF(pr.nickname, ''), NULLIF(pr.first_name, ''), 'Giocatore') AS nickname,
             COALESCE(pr.tier, 'bronze') AS tier, tp.status, tp.eliminated_round, tp.final_position
      FROM public.tournament_participants tp
      LEFT JOIN public.profiles pr ON tp.user_id = pr.id
      WHERE tp.tournament_id = p_tournament_id
      ORDER BY tp.joined_at
    ) pp),
    (SELECT json_agg(row_to_json(mm)) FROM (
      SELECT tm.id, tm.round, tm.match_number, tm.player1_id,
             COALESCE(NULLIF(p1.nickname, ''), NULLIF(p1.first_name, ''), 'Giocatore') AS player1_nickname,
             tm.player2_id,
             COALESCE(NULLIF(p2.nickname, ''), NULLIF(p2.first_name, ''), 'Giocatore') AS player2_nickname,
             tm.winner_id, tm.status, tm.player1_score, tm.player2_score
      FROM public.tournament_matches tm
      LEFT JOIN public.profiles p1 ON tm.player1_id = p1.id
      LEFT JOIN public.profiles p2 ON tm.player2_id = p2.id
      WHERE tm.tournament_id = p_tournament_id
      ORDER BY tm.round, tm.match_number
    ) mm);
END;
$$;

CREATE OR REPLACE FUNCTION public.join_tournament(p_tournament_id UUID)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  current_players INTEGER,
  max_players INTEGER,
  started BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_current_players INTEGER;
  v_max_players INTEGER;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Devi essere autenticato'::TEXT, 0, 0, FALSE;
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.tournament_participants WHERE tournament_id = p_tournament_id AND user_id = v_user_id) THEN
    RETURN QUERY SELECT FALSE, 'Sei già iscritto a questo torneo'::TEXT, 0, 0, FALSE;
    RETURN;
  END IF;

  UPDATE public.tournaments t
  SET current_players = t.current_players + 1, updated_at = NOW()
  WHERE t.id = p_tournament_id AND t.status = 'open' AND t.current_players < t.max_players
  RETURNING t.current_players, t.max_players INTO v_current_players, v_max_players;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Torneo non disponibile o già al completo'::TEXT, 0, 0, FALSE;
    RETURN;
  END IF;

  INSERT INTO public.tournament_participants (tournament_id, user_id, status)
  VALUES (p_tournament_id, v_user_id, 'active');

  IF v_current_players = v_max_players THEN
    PERFORM public._start_tournament(p_tournament_id);
    RETURN QUERY SELECT TRUE, 'Iscrizione riuscita: il torneo è iniziato!'::TEXT, v_current_players, v_max_players, TRUE;
  ELSE
    RETURN QUERY SELECT TRUE, 'Iscrizione riuscita, in attesa di altri giocatori'::TEXT, v_current_players, v_max_players, FALSE;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_tournament(p_tournament_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  DELETE FROM public.tournament_participants
  WHERE tournament_id = p_tournament_id AND user_id = v_user_id
    AND EXISTS (SELECT 1 FROM public.tournaments WHERE id = p_tournament_id AND status = 'open');

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  UPDATE public.tournaments
  SET current_players = GREATEST(current_players - 1, 0), updated_at = NOW()
  WHERE id = p_tournament_id AND status = 'open';

  RETURN TRUE;
END;
$$;

-- =====================================================================
-- Cancella (soft-delete) un torneo non ancora iniziato. Solo il creatore
-- può cancellarlo, e solo finché è 'open' (nessun match in corso da
-- interrompere). Riusa l'enum 'cancelled' già previsto dal CHECK su status.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.cancel_tournament(p_tournament_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE public.tournaments
  SET status = 'cancelled', updated_at = NOW()
  WHERE id = p_tournament_id AND status = 'open' AND creator_id = v_user_id;

  RETURN FOUND;
END;
$$;

-- =====================================================================
-- Avvia i tornei schedulati la cui data/ora è arrivata, anche se non
-- ancora al completo (richiede almeno 2 iscritti). Nessun pg_cron in
-- questo progetto: va invocata da un polling client-side periodico
-- (vedi pollFriendChallenges in App.tsx per il pattern già in uso).
-- =====================================================================
CREATE OR REPLACE FUNCTION public.start_due_tournaments()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tournament RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR v_tournament IN
    SELECT id FROM public.tournaments
    WHERE status = 'open' AND start_mode = 'scheduled'
      AND scheduled_at IS NOT NULL AND scheduled_at <= NOW()
      AND current_players >= 2
    FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM public._start_tournament(v_tournament.id);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_active_tournament_matches()
RETURNS TABLE (
  match_id UUID,
  tournament_id UUID,
  tournament_name TEXT,
  room_id TEXT,
  round INTEGER,
  opponent_id UUID,
  opponent_nickname TEXT,
  opponent_tier TEXT,
  is_player1 BOOLEAN,
  league TEXT,
  difficulty INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  RETURN QUERY
  SELECT
    tm.id, tm.tournament_id, t.name, tm.room_id, tm.round,
    CASE WHEN tm.player1_id = v_user_id THEN tm.player2_id ELSE tm.player1_id END,
    COALESCE(NULLIF(po.nickname, ''), NULLIF(po.first_name, ''), 'Avversario')::TEXT,
    COALESCE(po.tier, 'bronze')::TEXT,
    (tm.player1_id = v_user_id),
    t.league, t.difficulty
  FROM public.tournament_matches tm
  JOIN public.tournaments t ON tm.tournament_id = t.id
  LEFT JOIN public.profiles po ON po.id = CASE WHEN tm.player1_id = v_user_id THEN tm.player2_id ELSE tm.player1_id END
  WHERE tm.status = 'pending'
    AND (tm.player1_id = v_user_id OR tm.player2_id = v_user_id)
    AND tm.player1_id IS NOT NULL AND tm.player2_id IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_tournament_match(
  p_match_id UUID,
  p_winner_id UUID,
  p_player1_score INTEGER,
  p_player2_score INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN public._finalize_tournament_match(p_match_id, p_winner_id, p_player1_score, p_player2_score);
END;
$$;

CREATE OR REPLACE FUNCTION public.abandon_tournament_match(p_match_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_match RECORD;
  v_current_user UUID;
  v_winner_id UUID;
BEGIN
  v_current_user := auth.uid();

  SELECT * INTO v_match FROM public.tournament_matches WHERE id = p_match_id AND status = 'pending';

  IF v_match IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_current_user IS NULL OR (v_current_user <> v_match.player1_id AND v_current_user <> v_match.player2_id) THEN
    RETURN FALSE;
  END IF;

  -- Vittoria per forfeit all'avversario di chi abbandona
  v_winner_id := CASE WHEN v_match.player1_id = v_current_user THEN v_match.player2_id ELSE v_match.player1_id END;

  RETURN public._finalize_tournament_match(
    p_match_id, v_winner_id,
    CASE WHEN v_match.player1_id = v_winner_id THEN 2 ELSE 0 END,
    CASE WHEN v_match.player2_id = v_winner_id THEN 2 ELSE 0 END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_tournament_history()
RETURNS TABLE (
  tournament_id UUID,
  name TEXT,
  status TEXT,
  final_position INTEGER,
  max_players INTEGER,
  completed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  RETURN QUERY
  SELECT t.id, t.name, t.status, tp.final_position, t.max_players, t.completed_at
  FROM public.tournament_participants tp
  JOIN public.tournaments t ON tp.tournament_id = t.id
  WHERE tp.user_id = v_user_id AND t.status = 'completed'
  ORDER BY t.completed_at DESC
  LIMIT 50;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_tournament TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_open_tournaments TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tournament_details TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_tournament TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_tournament TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_tournament TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_due_tournaments TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_active_tournament_matches TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_tournament_match TO authenticated;
GRANT EXECUTE ON FUNCTION public.abandon_tournament_match TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_tournament_history TO authenticated;

-- Helper interni: nessun GRANT esplicito, ma per sicurezza in profondità
-- (defense in depth) revochiamo comunque l'esecuzione diretta da client.
REVOKE EXECUTE ON FUNCTION public._start_tournament(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._finalize_tournament_match(UUID, UUID, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
