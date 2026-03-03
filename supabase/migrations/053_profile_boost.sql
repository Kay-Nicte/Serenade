-- Profile Boost: appear first in candidates for 30 minutes
-- Columns: profiles.boosted_until, user_streaks.available_boosts, user_streaks.last_boost_granted_at

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS boosted_until TIMESTAMPTZ;

ALTER TABLE user_streaks
  ADD COLUMN IF NOT EXISTS available_boosts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_boost_granted_at TIMESTAMPTZ;

-- Grant weekly boost to premium users (call on app open)
CREATE OR REPLACE FUNCTION maybe_grant_weekly_boost()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF NOT is_user_premium(v_user_id) THEN
    RETURN;
  END IF;

  UPDATE user_streaks
  SET
    available_boosts = available_boosts + 1,
    last_boost_granted_at = NOW()
  WHERE user_id = v_user_id
    AND (last_boost_granted_at IS NULL OR last_boost_granted_at < NOW() - INTERVAL '7 days');
END;
$$;

-- Activate a boost (costs 1 available_boost)
CREATE OR REPLACE FUNCTION activate_boost()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_boosts INT;
  v_boosted_until TIMESTAMPTZ;
BEGIN
  SELECT available_boosts INTO v_boosts
  FROM user_streaks WHERE user_id = v_user_id;

  IF v_boosts IS NULL OR v_boosts < 1 THEN
    RETURN jsonb_build_object('error', 'no_boosts_available');
  END IF;

  v_boosted_until := NOW() + INTERVAL '30 minutes';

  UPDATE user_streaks
  SET available_boosts = available_boosts - 1
  WHERE user_id = v_user_id;

  UPDATE profiles
  SET boosted_until = v_boosted_until
  WHERE id = v_user_id;

  RETURN jsonb_build_object('success', true, 'boosted_until', v_boosted_until);
END;
$$;

-- Add boosts after purchase (call from app after RevenueCat purchase)
CREATE OR REPLACE FUNCTION add_boosts(count INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  UPDATE user_streaks
  SET available_boosts = available_boosts + count
  WHERE user_id = v_user_id;
END;
$$;

-- Update get_daily_candidates to prioritize boosted profiles
-- (runs after superlikes, before distance)
DROP FUNCTION IF EXISTS get_daily_candidates(integer);
CREATE OR REPLACE FUNCTION get_daily_candidates(candidate_limit INT DEFAULT 10)
RETURNS SETOF profiles
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
  SELECT p.*
  FROM profiles p
  WHERE p.id != current_user_id
    AND p.name IS NOT NULL AND p.name != ''
    AND p.banned_at IS NULL
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

GRANT EXECUTE ON FUNCTION maybe_grant_weekly_boost() TO authenticated;
GRANT EXECUTE ON FUNCTION activate_boost() TO authenticated;
GRANT EXECUTE ON FUNCTION add_boosts(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_daily_candidates(integer) TO authenticated;

NOTIFY pgrst, 'reload schema';
