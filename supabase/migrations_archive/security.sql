-- Grant execute per funzioni SECURITY DEFINER
GRANT EXECUTE ON FUNCTION get_random_match(BIGINT, BIGINT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_random_match(BIGINT, BIGINT[]) TO anon;
GRANT EXECUTE ON FUNCTION validate_player_intersection(BIGINT, BIGINT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_player_intersection(BIGINT, BIGINT, TEXT) TO anon;

-- RLS semplificate
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public teams" ON teams;
CREATE POLICY "Public teams" ON teams FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public players" ON players;
CREATE POLICY "Public players" ON players FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public player_teams" ON player_teams;
CREATE POLICY "Public player_teams" ON player_teams FOR SELECT USING (true);