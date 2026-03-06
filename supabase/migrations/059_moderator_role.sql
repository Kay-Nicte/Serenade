-- =============================================================
-- Moderator role: is_moderator column + update RLS/RPCs to
-- allow moderators the same access as admins (except role mgmt)
-- =============================================================

-- 1. Add is_moderator column
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_moderator BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Update RLS policies to allow moderators
-- Drop and recreate policies that check is_admin

DROP POLICY IF EXISTS "Admins can view all reports" ON reports;
CREATE POLICY "Admins and moderators can view all reports"
  ON reports FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND (profiles.is_admin = true OR profiles.is_moderator = true)
    )
  );

DROP POLICY IF EXISTS "Admins can update reports" ON reports;
CREATE POLICY "Admins and moderators can update reports"
  ON reports FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND (profiles.is_admin = true OR profiles.is_moderator = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND (profiles.is_admin = true OR profiles.is_moderator = true)
    )
  );

DROP POLICY IF EXISTS "Admins can view all blocks" ON user_blocks;
CREATE POLICY "Admins and moderators can view all blocks"
  ON user_blocks FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND (profiles.is_admin = true OR profiles.is_moderator = true)
    )
  );

DROP POLICY IF EXISTS "Admins can view all messages" ON messages;
CREATE POLICY "Admins and moderators can view all messages"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND (profiles.is_admin = true OR profiles.is_moderator = true)
    )
  );

DROP POLICY IF EXISTS "Admins can view all matches" ON matches;
CREATE POLICY "Admins and moderators can view all matches"
  ON matches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND (profiles.is_admin = true OR profiles.is_moderator = true)
    )
  );

DROP POLICY IF EXISTS "Admins read all verification selfies" ON storage.objects;
CREATE POLICY "Admins and moderators read all verification selfies"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'verification-selfies'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND (is_admin = TRUE OR is_moderator = TRUE)
    )
  );

-- 3. Update RPCs to allow moderators

CREATE OR REPLACE FUNCTION ban_user(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  caller RECORD;
BEGIN
  SELECT is_admin, is_moderator INTO caller
  FROM profiles WHERE id = current_user_id;

  IF NOT (COALESCE(caller.is_admin, FALSE) OR COALESCE(caller.is_moderator, FALSE)) THEN
    RAISE EXCEPTION 'Unauthorized: admin or moderator only';
  END IF;

  UPDATE profiles
  SET banned_at = NOW()
  WHERE id = target_user_id
    AND banned_at IS NULL;

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION unban_user(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  caller RECORD;
BEGIN
  SELECT is_admin, is_moderator INTO caller
  FROM profiles WHERE id = current_user_id;

  IF NOT (COALESCE(caller.is_admin, FALSE) OR COALESCE(caller.is_moderator, FALSE)) THEN
    RAISE EXCEPTION 'Unauthorized: admin or moderator only';
  END IF;

  UPDATE profiles
  SET banned_at = NULL
  WHERE id = target_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION resolve_report(report_id UUID, new_status report_status)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  caller RECORD;
BEGIN
  SELECT is_admin, is_moderator INTO caller
  FROM profiles WHERE id = current_user_id;

  IF NOT (COALESCE(caller.is_admin, FALSE) OR COALESCE(caller.is_moderator, FALSE)) THEN
    RAISE EXCEPTION 'Unauthorized: admin or moderator only';
  END IF;

  UPDATE reports
  SET status = new_status,
      resolved_at = CASE WHEN new_status IN ('resolved', 'dismissed') THEN NOW() ELSE resolved_at END
  WHERE id = report_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION admin_get_pending_verifications()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id UUID := auth.uid();
  caller RECORD;
BEGIN
  SELECT is_admin, is_moderator INTO caller FROM profiles WHERE id = caller_id;
  IF NOT (COALESCE(caller.is_admin, FALSE) OR COALESCE(caller.is_moderator, FALSE)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb)
    FROM (
      SELECT
        vr.id,
        vr.user_id,
        vr.gesture,
        vr.selfie_storage_path,
        vr.created_at,
        jsonb_build_object(
          'name', p.name,
          'avatar_url', p.avatar_url,
          'birth_date', p.birth_date,
          'bio', p.bio,
          'created_at', p.created_at
        ) as profile
      FROM verification_requests vr
      JOIN profiles p ON p.id = vr.user_id
      WHERE vr.status = 'pending'
      ORDER BY vr.created_at ASC
    ) r
  );
END;
$$;

CREATE OR REPLACE FUNCTION admin_review_verification(
  request_id UUID,
  approve BOOLEAN,
  reject_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id UUID := auth.uid();
  req RECORD;
  caller RECORD;
  mutual_target UUID;
  canonical_a UUID;
  canonical_b UUID;
  new_match_id UUID;
  matches_created INT := 0;
BEGIN
  SELECT is_admin, is_moderator INTO caller FROM profiles WHERE id = caller_id;
  IF NOT (COALESCE(caller.is_admin, FALSE) OR COALESCE(caller.is_moderator, FALSE)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO req FROM verification_requests WHERE id = request_id AND status = 'pending';
  IF req IS NULL THEN
    RETURN jsonb_build_object('error', 'request_not_found');
  END IF;

  IF approve THEN
    UPDATE verification_requests
    SET status = 'approved', admin_id = caller_id, reviewed_at = NOW()
    WHERE id = request_id;

    UPDATE profiles
    SET is_verified = TRUE, verification_status = 'approved'
    WHERE id = req.user_id;

    -- Release held likes: find mutual likes and create matches
    FOR mutual_target IN
      SELECT dp_out.target_id
      FROM daily_profiles dp_out
      WHERE dp_out.user_id = req.user_id
        AND dp_out.action IN ('like', 'superlike')
        AND EXISTS (
          SELECT 1 FROM daily_profiles dp_in
          WHERE dp_in.user_id = dp_out.target_id
            AND dp_in.target_id = req.user_id
            AND dp_in.action IN ('like', 'superlike')
        )
        AND NOT EXISTS (
          SELECT 1 FROM matches m
          WHERE m.user_a_id = LEAST(req.user_id, dp_out.target_id)
            AND m.user_b_id = GREATEST(req.user_id, dp_out.target_id)
        )
    LOOP
      canonical_a := LEAST(req.user_id, mutual_target);
      canonical_b := GREATEST(req.user_id, mutual_target);

      INSERT INTO matches (user_a_id, user_b_id)
      VALUES (canonical_a, canonical_b)
      ON CONFLICT DO NOTHING
      RETURNING id INTO new_match_id;

      IF new_match_id IS NOT NULL THEN
        matches_created := matches_created + 1;
      END IF;
    END LOOP;

    -- Push notification
    PERFORM public.send_push_notification(
      req.user_id,
      'Verificación aprobada',
      'Tu identidad ha sido verificada. ¡Bienvenida!',
      jsonb_build_object('type', 'verification_approved')
    );

    RETURN jsonb_build_object('success', true, 'matches_created', matches_created);
  ELSE
    UPDATE verification_requests
    SET status = 'rejected', admin_id = caller_id, reviewed_at = NOW(),
        rejection_reason = reject_reason
    WHERE id = request_id;

    UPDATE profiles
    SET verification_status = 'rejected'
    WHERE id = req.user_id;

    PERFORM public.send_push_notification(
      req.user_id,
      'Verificación rechazada',
      COALESCE(reject_reason, 'Tu solicitud de verificación no fue aprobada. Puedes intentarlo de nuevo.'),
      jsonb_build_object('type', 'verification_rejected')
    );

    RETURN jsonb_build_object('success', true);
  END IF;
END;
$$;

-- 4. Notify admins AND moderators on new reports
CREATE OR REPLACE FUNCTION notify_admins_new_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_staff RECORD;
  v_reporter_name text;
  v_reported_name text;
BEGIN
  SELECT name INTO v_reporter_name FROM profiles WHERE id = NEW.reporter_id;
  SELECT name INTO v_reported_name FROM profiles WHERE id = NEW.reported_id;

  FOR v_staff IN
    SELECT id FROM profiles WHERE is_admin = true OR is_moderator = true
  LOOP
    PERFORM public.send_push_notification(
      v_staff.id,
      'Nuevo reporte',
      COALESCE(v_reporter_name, 'Alguien') || ' ha reportado a ' || COALESCE(v_reported_name, 'una usuaria') || ' (' || NEW.reason::text || ')',
      jsonb_build_object('type', 'new_report', 'report_id', NEW.id)
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- 5. Admin-only RPCs for moderator management

CREATE OR REPLACE FUNCTION set_moderator(target_user_id UUID, make_moderator BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  is_caller_admin BOOLEAN;
BEGIN
  SELECT is_admin INTO is_caller_admin
  FROM profiles WHERE id = current_user_id;

  IF NOT COALESCE(is_caller_admin, FALSE) THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;

  UPDATE profiles
  SET is_moderator = make_moderator
  WHERE id = target_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Search users by name (admin only, for moderator assignment)
CREATE OR REPLACE FUNCTION admin_search_users(search_query TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  is_caller_admin BOOLEAN;
BEGIN
  SELECT is_admin INTO is_caller_admin
  FROM profiles WHERE id = current_user_id;

  IF NOT COALESCE(is_caller_admin, FALSE) THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb)
    FROM (
      SELECT id, name, avatar_url, is_moderator, is_admin
      FROM profiles
      WHERE name ILIKE '%' || search_query || '%'
        AND is_profile_complete = true
      ORDER BY name ASC
      LIMIT 20
    ) r
  );
END;
$$;
