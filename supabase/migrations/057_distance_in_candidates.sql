-- Return distance_km in get_daily_candidates
-- Changes return type from SETOF profiles to SETOF jsonb so we can append
-- the computed distance without listing every profile column explicitly.

DROP FUNCTION IF EXISTS get_daily_candidates(integer);

CREATE OR REPLACE FUNCTION get_daily_candidates(candidate_limit INT DEFAULT 10)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  today DATE := CURRENT_DATE;
  pref RECORD;
  user_location GEOGRAPHY;
BEGIN
  SELECT p.location INTO user_location FROM profiles p WHERE p.id = current_user_id;
  SELECT dp.min_age, dp.max_age, dp.orientations, dp.looking_for, dp.max_distance
    INTO pref FROM discovery_preferences dp WHERE dp.user_id = current_user_id;

  RETURN QUERY
  SELECT
    to_jsonb(p) || jsonb_build_object(
      'distance_km',
      CASE
        WHEN user_location IS NOT NULL AND p.location IS NOT NULL
        THEN ROUND((ST_Distance(user_location, p.location) / 1000.0)::numeric, 1)::float
        ELSE NULL
      END
    )
  FROM profiles p
  WHERE p.id != current_user_id
    AND p.name IS NOT NULL AND p.name != ''
    AND p.banned_at IS NULL
    AND NOT p.is_paused
    AND NOT EXISTS (SELECT 1 FROM daily_profiles d WHERE d.user_id = current_user_id AND d.target_id = p.id AND d.action_date = today)
    AND NOT EXISTS (SELECT 1 FROM matches m WHERE (m.user_a_id = current_user_id AND m.user_b_id = p.id) OR (m.user_a_id = p.id AND m.user_b_id = current_user_id))
    AND NOT EXISTS (SELECT 1 FROM user_blocks ub WHERE (ub.blocker_id = current_user_id AND ub.blocked_id = p.id) OR (ub.blocker_id = p.id AND ub.blocked_id = current_user_id))
    AND (pref IS NULL OR p.birth_date IS NULL OR EXTRACT(YEAR FROM AGE(p.birth_date)) BETWEEN pref.min_age AND pref.max_age)
    AND (pref IS NULL OR pref.orientations IS NULL OR p.orientation && pref.orientations)
    AND (pref IS NULL OR pref.looking_for IS NULL OR p.looking_for && pref.looking_for)
    AND (user_location IS NULL OR pref IS NULL OR pref.max_distance IS NULL OR p.location IS NULL OR ST_DWithin(user_location, p.location, pref.max_distance * 1000))
  ORDER BY
    CASE WHEN EXISTS (
      SELECT 1 FROM daily_profiles sl WHERE sl.user_id = p.id AND sl.target_id = current_user_id AND sl.action = 'superlike'
    ) THEN 0 ELSE 1 END,
    CASE WHEN p.boosted_until IS NOT NULL AND p.boosted_until > NOW() THEN 0 ELSE 1 END,
    CASE WHEN user_location IS NOT NULL AND p.location IS NOT NULL THEN ST_Distance(user_location, p.location) ELSE random() * 1e12 END
  LIMIT candidate_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION get_daily_candidates(integer) TO authenticated;

NOTIFY pgrst, 'reload schema';
