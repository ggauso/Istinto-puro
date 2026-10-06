-- =====================================================================
-- 13_achievements_expansion.sql
--
-- Espansione del catalogo achievement (12_achievements.sql) da 7 a 26
-- voci, su richiesta dell'utente dopo il primo giro di test: "7 sono
-- pochi, cerchiamo una profondità maggiore, magari anche qualcosa legato
-- ai tornei". Due aggiunte strutturali:
-- 1) Colonna `tier` (bronze/silver/gold/platinum) sul catalogo — stessa
--    terminologia del tier giocatore ma concetto indipendente: qui indica
--    la "rarità"/difficoltà dell'achievement all'interno della sua
--    famiglia (es. win_10 è bronze, win_500 è platinum), usata solo per
--    la UI (colore badge).
-- 2) Categoria 'tournament' (nuova famiglia, 4 achievement) oltre a
--    riorganizzare le categorie esistenti in famiglie più granulari
--    (wins/streak/tier/skill/social/dedication/tournament al posto di
--    progress/skill/social).
--
-- 'champion50' (50 vittorie) viene sostituito da 'win_50' nella nuova
-- famiglia "wins" a più livelli — sicuro da rimuovere perché la feature
-- non è ancora stata verificata end-to-end in app (nessun utente reale ha
-- ancora sbloccato achievement, vedi nota di verifica in ROADMAP_FEATURES.md).
-- =====================================================================

ALTER TABLE public.achievements ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'bronze';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'achievements_tier_check') THEN
    ALTER TABLE public.achievements
      ADD CONSTRAINT achievements_tier_check
      CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum'));
  END IF;
END $$;

-- Il vincolo nuovo va aggiunto DOPO l'upsert sotto, non prima: le righe
-- esistenti hanno ancora le vecchie categorie ('progress') finché l'UPSERT
-- non le aggiorna, e il vincolo vecchio a sua volta rifiuterebbe le nuove
-- categorie ('wins', 'tier', ...) se provassimo ad inserirle prima.
ALTER TABLE public.achievements DROP CONSTRAINT IF EXISTS achievements_category_check;

-- Sostituito da win_50 nella nuova famiglia "wins" — nessun utente ha
-- ancora sbloccato achievement in app (vedi nota sopra), rimozione sicura.
DELETE FROM public.achievements WHERE code = 'champion50';

INSERT INTO public.achievements (code, label, description, icon, category, tier, sort_order) VALUES
  -- Vittorie totali
  ('first_win',          'Prima vittoria',        'Vinci la tua prima partita',                  'Trophy',  'wins',       'bronze',   1),
  ('win_10',              'Esordiente',            'Vinci 10 partite',                            'Trophy',  'wins',       'bronze',   2),
  ('win_50',              'Veterano',              'Vinci 50 partite',                            'Trophy',  'wins',       'silver',   3),
  ('win_150',             'Maestro',               'Vinci 150 partite',                           'Trophy',  'wins',       'gold',     4),
  ('win_500',             'Leggenda',              'Vinci 500 partite',                           'Trophy',  'wins',       'platinum', 5),
  -- Serie vincenti consecutive
  ('streak5',             'Serie vincente',        'Vinci 5 partite consecutive',                 'Flame',   'streak',     'bronze',   6),
  ('streak10',            'Inarrestabile',         'Vinci 10 partite consecutive',                'Flame',   'streak',     'silver',   7),
  ('streak25',            'Imbattibile',           'Vinci 25 partite consecutive',                'Flame',   'streak',     'gold',     8),
  -- Tier giocatore raggiunto
  ('tier_silver',         'Argento',               'Raggiungi il tier Silver',                    'Gem',     'tier',       'bronze',   9),
  ('tier_gold',           'Oro',                   'Raggiungi il tier Gold',                      'Gem',     'tier',       'silver',   10),
  ('tier_platinum',       'Platino',               'Raggiungi il tier Platinum',                  'Gem',     'tier',       'gold',     11),
  ('tier_diamond',        'Diamante',              'Raggiungi il tier Diamond',                   'Gem',     'tier',       'platinum', 12),
  -- Abilità (eventi client-side, vedi unlock_achievement)
  ('speed',               'Fulmine',               'Rispondi correttamente in meno di 3 secondi', 'Zap',     'skill',      'bronze',   13),
  ('speed_flash',         'Lampo',                 'Rispondi correttamente in meno di 1,5 secondi','Zap',    'skill',      'gold',     14),
  ('perfect',             'Perfetto',              'Rispondi corretto 10 volte di fila',          'Star',    'skill',      'bronze',   15),
  ('perfect25',           'Imperturbabile',        'Rispondi corretto 25 volte di fila',          'Star',    'skill',      'gold',     16),
  -- Partite PvP
  ('social10',            'Socievole',             'Gioca 10 partite PvP',                        'Users',   'social',     'bronze',   17),
  ('social50',            'Rivale',                'Gioca 50 partite PvP',                        'Users',   'social',     'silver',   18),
  ('social200',           'Gladiatore',            'Gioca 200 partite PvP',                        'Users',   'social',     'gold',     19),
  -- Partite totali (qualunque modalità)
  ('play50',              'Appassionato',          'Gioca 50 partite',                            'Gamepad2','dedication', 'bronze',   20),
  ('play250',             'Dedizione',             'Gioca 250 partite',                           'Gamepad2','dedication', 'silver',   21),
  ('play1000',            'Instancabile',          'Gioca 1000 partite',                          'Gamepad2','dedication', 'gold',     22),
  -- Tornei
  ('tournament_join',     'Debuttante',            'Partecipa al tuo primo torneo',               'Swords',  'tournament', 'bronze',   23),
  ('tournament_win',      'Campione del torneo',   'Vinci un torneo',                              'Swords',  'tournament', 'silver',   24),
  ('tournament_win5',     'Dominatore',            'Vinci 5 tornei',                               'Swords',  'tournament', 'gold',     25),
  ('tournament_big_win',  'Gran maestro',          'Vinci un torneo da 16 giocatori',             'Swords',  'tournament', 'platinum', 26)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  category = EXCLUDED.category,
  tier = EXCLUDED.tier,
  sort_order = EXCLUDED.sort_order;

-- Ora che tutte le righe hanno una categoria valida nel nuovo schema, il
-- vincolo può essere aggiunto.
ALTER TABLE public.achievements ADD CONSTRAINT achievements_category_check
  CHECK (category IN ('wins', 'streak', 'tier', 'skill', 'social', 'dedication', 'tournament'));

-- =====================================================================
-- get_user_achievements — aggiunta colonna `tier` al return type. Una
-- TABLE function non può aggiungere colonne di ritorno con CREATE OR
-- REPLACE (serve DROP prima, vedi DOCKER.md), a differenza del semplice
-- cambio di corpo delle altre funzioni in questo file.
-- =====================================================================
DROP FUNCTION IF EXISTS public.get_user_achievements(UUID);

CREATE FUNCTION public.get_user_achievements(p_user_id UUID)
RETURNS TABLE (
  code TEXT, label TEXT, description TEXT, icon TEXT, category TEXT, tier TEXT,
  unlocked BOOLEAN, unlocked_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.code, a.label, a.description, a.icon, a.category, a.tier,
    (ua.user_id IS NOT NULL) AS unlocked,
    ua.unlocked_at
  FROM public.achievements a
  LEFT JOIN public.user_achievements ua
    ON ua.achievement_code = a.code AND ua.user_id = p_user_id
  ORDER BY a.sort_order;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_achievements(UUID) TO anon, authenticated;

-- =====================================================================
-- check_and_unlock_achievements — esteso con tutte le famiglie
-- server-truth (esclude speed/speed_flash/perfect/perfect25, che restano
-- eventi client-side via unlock_achievement). Stessa firma/tipo di ritorno
-- della versione in 12_achievements.sql: CREATE OR REPLACE sostituisce il
-- corpo senza bisogno di DROP.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.check_and_unlock_achievements(p_user_id UUID)
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_matches_won INTEGER;
  v_longest_win_streak INTEGER;
  v_matches_played INTEGER;
  v_tier_rank INTEGER;
  v_pvp_matches INTEGER;
  v_tournament_joins INTEGER;
  v_tournament_wins INTEGER;
  v_big_tournament_win BOOLEAN;
  v_unlocked TEXT[];
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Non autorizzato a verificare gli achievement di un altro utente';
  END IF;

  SELECT
    COALESCE(matches_won, 0),
    COALESCE(longest_win_streak, 0),
    COALESCE(matches_played, 0),
    CASE COALESCE(tier, 'bronze')
      WHEN 'silver' THEN 1 WHEN 'gold' THEN 2 WHEN 'platinum' THEN 3 WHEN 'diamond' THEN 4 ELSE 0
    END
  INTO v_matches_won, v_longest_win_streak, v_matches_played, v_tier_rank
  FROM public.profiles
  WHERE id = p_user_id;

  SELECT COUNT(*)::INTEGER INTO v_pvp_matches
  FROM public.matches_history
  WHERE user_id = p_user_id AND is_pvp = TRUE;

  SELECT COUNT(*)::INTEGER INTO v_tournament_joins
  FROM public.tournament_participants
  WHERE user_id = p_user_id;

  SELECT COUNT(*)::INTEGER INTO v_tournament_wins
  FROM public.tournament_participants
  WHERE user_id = p_user_id AND status = 'winner';

  SELECT EXISTS(
    SELECT 1 FROM public.tournament_participants tp
    JOIN public.tournaments t ON t.id = tp.tournament_id
    WHERE tp.user_id = p_user_id AND tp.status = 'winner' AND t.max_players = 16
  ) INTO v_big_tournament_win;

  WITH criteria(code, qualifies) AS (
    VALUES
      ('first_win',          v_matches_won >= 1),
      ('win_10',             v_matches_won >= 10),
      ('win_50',             v_matches_won >= 50),
      ('win_150',            v_matches_won >= 150),
      ('win_500',            v_matches_won >= 500),
      ('streak5',            v_longest_win_streak >= 5),
      ('streak10',           v_longest_win_streak >= 10),
      ('streak25',           v_longest_win_streak >= 25),
      ('tier_silver',        v_tier_rank >= 1),
      ('tier_gold',          v_tier_rank >= 2),
      ('tier_platinum',      v_tier_rank >= 3),
      ('tier_diamond',       v_tier_rank >= 4),
      ('social10',           v_pvp_matches >= 10),
      ('social50',           v_pvp_matches >= 50),
      ('social200',          v_pvp_matches >= 200),
      ('play50',             v_matches_played >= 50),
      ('play250',            v_matches_played >= 250),
      ('play1000',           v_matches_played >= 1000),
      ('tournament_join',    v_tournament_joins >= 1),
      ('tournament_win',     v_tournament_wins >= 1),
      ('tournament_win5',    v_tournament_wins >= 5),
      ('tournament_big_win', v_big_tournament_win)
  ),
  ins AS (
    INSERT INTO public.user_achievements (user_id, achievement_code)
    SELECT p_user_id, code FROM criteria WHERE qualifies
    ON CONFLICT DO NOTHING
    RETURNING achievement_code
  )
  SELECT array_agg(achievement_code) INTO v_unlocked FROM ins;

  RETURN COALESCE(v_unlocked, '{}');
END;
$$;

-- =====================================================================
-- unlock_achievement — whitelist estesa ai 4 eventi client-side
-- =====================================================================
CREATE OR REPLACE FUNCTION public.unlock_achievement(p_user_id UUID, p_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inserted TEXT;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Non autorizzato a sbloccare un achievement per un altro utente';
  END IF;

  IF p_code NOT IN ('speed', 'speed_flash', 'perfect', 'perfect25') THEN
    RAISE EXCEPTION 'Codice achievement non sbloccabile direttamente dal client: %', p_code;
  END IF;

  INSERT INTO public.user_achievements (user_id, achievement_code)
  VALUES (p_user_id, p_code)
  ON CONFLICT DO NOTHING
  RETURNING achievement_code INTO v_inserted;

  RETURN v_inserted IS NOT NULL;
END;
$$;
