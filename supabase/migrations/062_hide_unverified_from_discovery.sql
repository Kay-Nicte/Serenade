-- Hide unverified profiles from discovery, pending likes, superlike senders,
-- and pending ice breakers. Suppress push notifications from unverified senders.
-- Once a user verifies, their interactions become visible automatically.

-- ============================================================
-- 1. get_daily_candidates: only show verified profiles
-- ============================================================
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
    AND p.is_verified
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

-- ============================================================
-- 2. get_pending_likes: only show likes from verified senders
-- ============================================================
CREATE OR REPLACE FUNCTION get_pending_likes()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  result JSON;
BEGIN
  SELECT json_agg(row_data)
  INTO result
  FROM (
    SELECT
      p.id,
      p.name,
      p.avatar_url,
      p.is_verified,
      dp.action
    FROM daily_profiles dp
    INNER JOIN profiles p ON p.id = dp.user_id
    WHERE dp.target_id = current_user_id
      AND dp.action IN ('like', 'superlike')
      AND p.is_verified
      AND NOT EXISTS (
        SELECT 1 FROM matches m
        WHERE (m.user_a_id = current_user_id AND m.user_b_id = dp.user_id)
           OR (m.user_a_id = dp.user_id AND m.user_b_id = current_user_id)
      )
      AND NOT EXISTS (
        SELECT 1 FROM daily_profiles d2
        WHERE d2.user_id = current_user_id
          AND d2.target_id = dp.user_id
      )
    ORDER BY dp.created_at DESC
  ) row_data;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- ============================================================
-- 3. get_superlike_senders: only show verified senders
-- ============================================================
CREATE OR REPLACE FUNCTION get_superlike_senders()
RETURNS SETOF UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
BEGIN
  RETURN QUERY
  SELECT dp.user_id
  FROM daily_profiles dp
  INNER JOIN profiles p ON p.id = dp.user_id
  WHERE dp.target_id = current_user_id
    AND dp.action = 'superlike'
    AND p.is_verified
    AND NOT EXISTS (
      SELECT 1 FROM matches m
      WHERE (m.user_a_id = LEAST(dp.user_id, current_user_id)
        AND m.user_b_id = GREATEST(dp.user_id, current_user_id))
    );
END;
$$;

-- ============================================================
-- 4. superlike_profile: suppress push if sender is unverified
-- ============================================================
CREATE OR REPLACE FUNCTION superlike_profile(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  today DATE := CURRENT_DATE;
  available INT;
  mutual BOOLEAN := FALSE;
  new_match_id UUID;
  canonical_a UUID;
  canonical_b UUID;
  target_is_premium BOOLEAN;
  sender_name TEXT;
  sender_verified BOOLEAN;
  push_body TEXT;
BEGIN
  IF current_user_id = target_user_id THEN
    RAISE EXCEPTION 'Cannot superlike yourself';
  END IF;

  IF are_users_blocked(current_user_id, target_user_id) THEN
    RETURN jsonb_build_object('error', 'user_blocked');
  END IF;

  SELECT available_superlikes INTO available
  FROM user_streaks WHERE user_id = current_user_id;

  IF COALESCE(available, 0) <= 0 THEN
    RETURN jsonb_build_object('error', 'no_superlikes_available');
  END IF;

  IF EXISTS (
    SELECT 1 FROM daily_profiles
    WHERE user_id = current_user_id AND target_id = target_user_id AND action_date = today
  ) THEN
    RETURN jsonb_build_object('error', 'already_swiped');
  END IF;

  INSERT INTO daily_profiles (user_id, target_id, action, action_date)
  VALUES (current_user_id, target_user_id, 'superlike', today);

  UPDATE user_streaks SET available_superlikes = available_superlikes - 1
  WHERE user_id = current_user_id;

  SELECT EXISTS (
    SELECT 1 FROM daily_profiles
    WHERE user_id = target_user_id AND target_id = current_user_id
      AND action IN ('like', 'superlike')
  ) INTO mutual;

  IF mutual THEN
    canonical_a := LEAST(current_user_id, target_user_id);
    canonical_b := GREATEST(current_user_id, target_user_id);

    INSERT INTO matches (user_a_id, user_b_id)
    VALUES (canonical_a, canonical_b)
    ON CONFLICT (user_a_id, user_b_id) DO NOTHING
    RETURNING id INTO new_match_id;

    IF new_match_id IS NULL THEN
      SELECT id INTO new_match_id FROM matches
      WHERE user_a_id = canonical_a AND user_b_id = canonical_b;
    END IF;

    RETURN jsonb_build_object('matched', true, 'match_id', new_match_id);
  END IF;

  -- Only send push notification if sender is verified
  SELECT COALESCE(p.is_verified, FALSE) INTO sender_verified
  FROM profiles p WHERE p.id = current_user_id;

  IF sender_verified THEN
    SELECT COALESCE(p.is_premium, FALSE) INTO target_is_premium
    FROM profiles p WHERE p.id = target_user_id;

    IF target_is_premium THEN
      SELECT p.name INTO sender_name FROM profiles p WHERE p.id = current_user_id;
      push_body := COALESCE(sender_name, 'Alguien') || ' te ha dado un superlike!';
    ELSE
      push_body := '¡Alguien te ha dado un superlike!';
    END IF;

    PERFORM send_push_notification(
      target_user_id,
      '⭐ Superlike!',
      push_body,
      jsonb_build_object('type', 'superlike', 'sender_id', current_user_id)
    );
  END IF;

  RETURN jsonb_build_object('matched', false);
END;
$$;

-- ============================================================
-- 5. send_ice_breaker: suppress push if sender is unverified
-- ============================================================
CREATE OR REPLACE FUNCTION send_ice_breaker(target_user_id UUID, ice_breaker_message TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  available INT;
  sender_verified BOOLEAN;
BEGIN
  IF current_user_id = target_user_id THEN
    RAISE EXCEPTION 'Cannot send ice breaker to yourself';
  END IF;

  SELECT available_ice_breakers INTO available FROM user_streaks WHERE user_id = current_user_id;
  IF COALESCE(available, 0) <= 0 THEN
    RETURN jsonb_build_object('error', 'no_ice_breakers_available');
  END IF;

  IF EXISTS (SELECT 1 FROM matches m WHERE (m.user_a_id = current_user_id AND m.user_b_id = target_user_id) OR (m.user_a_id = target_user_id AND m.user_b_id = current_user_id)) THEN
    RETURN jsonb_build_object('error', 'already_matched');
  END IF;

  IF EXISTS (SELECT 1 FROM user_blocks WHERE (blocker_id = current_user_id AND blocked_id = target_user_id) OR (blocker_id = target_user_id AND blocked_id = current_user_id)) THEN
    RETURN jsonb_build_object('error', 'blocked');
  END IF;

  INSERT INTO ice_breakers (sender_id, recipient_id, message)
  VALUES (current_user_id, target_user_id, ice_breaker_message)
  ON CONFLICT (sender_id, recipient_id) DO NOTHING;

  UPDATE user_streaks SET available_ice_breakers = available_ice_breakers - 1 WHERE user_id = current_user_id;

  -- Only send push notification if sender is verified
  SELECT COALESCE(p.is_verified, FALSE) INTO sender_verified
  FROM profiles p WHERE p.id = current_user_id;

  IF sender_verified THEN
    PERFORM send_push_notification(target_user_id, 'Ice Breaker!', 'Someone sent you a message!', jsonb_build_object('type', 'ice_breaker', 'sender_id', current_user_id));
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================
-- 6. get_pending_ice_breakers: only show from verified senders
-- ============================================================
CREATE OR REPLACE FUNCTION get_pending_ice_breakers()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb)
    FROM (
      SELECT ib.id, ib.message, ib.created_at,
             jsonb_build_object(
               'id', p.id, 'name', p.name, 'avatar_url', p.avatar_url,
               'bio', p.bio, 'birth_date', p.birth_date
             ) as sender
      FROM ice_breakers ib
      JOIN profiles p ON p.id = ib.sender_id
      WHERE ib.recipient_id = current_user_id AND ib.status = 'pending'
        AND p.is_verified
      ORDER BY ib.created_at DESC
    ) r
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
