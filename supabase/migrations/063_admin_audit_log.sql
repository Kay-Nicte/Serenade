-- Admin audit log: track verification approvals/rejections and bans/unbans
-- Records which admin/moderator performed the action

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  target_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'verification_approved', 'verification_rejected', 'ban', 'unban'
  details JSONB DEFAULT '{}'::jsonb, -- e.g. rejection_reason, selfie_path, matches_created
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_created_at ON admin_audit_log(created_at DESC);
CREATE INDEX idx_audit_log_action ON admin_audit_log(action);
CREATE INDEX idx_audit_log_target ON admin_audit_log(target_user_id);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins/moderators can read audit log
CREATE POLICY "Admins and moderators can read audit log"
  ON admin_audit_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin = TRUE OR p.is_moderator = TRUE)
    )
  );

-- Only service role / security definer RPCs can insert
CREATE POLICY "Service role inserts audit log"
  ON admin_audit_log
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ============================================================
-- Update admin_review_verification to log the action
-- ============================================================
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
  admin_user_id UUID := auth.uid();
  req RECORD;
  is_admin_user BOOLEAN;
  is_mod_user BOOLEAN;
  mutual_target UUID;
  canonical_a UUID;
  canonical_b UUID;
  new_match_id UUID;
  matches_created INT := 0;
BEGIN
  SELECT is_admin, is_moderator INTO is_admin_user, is_mod_user
  FROM profiles WHERE id = admin_user_id;

  IF NOT (COALESCE(is_admin_user, FALSE) OR COALESCE(is_mod_user, FALSE)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO req FROM verification_requests WHERE id = request_id AND status = 'pending';
  IF req IS NULL THEN
    RETURN jsonb_build_object('error', 'request_not_found');
  END IF;

  IF approve THEN
    UPDATE verification_requests
    SET status = 'approved', admin_id = admin_user_id, reviewed_at = NOW()
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
      ON CONFLICT (user_a_id, user_b_id) DO NOTHING
      RETURNING id INTO new_match_id;

      IF new_match_id IS NOT NULL THEN
        matches_created := matches_created + 1;
      END IF;
    END LOOP;

    -- Log to audit
    INSERT INTO admin_audit_log (admin_id, target_user_id, action, details)
    VALUES (admin_user_id, req.user_id, 'verification_approved',
      jsonb_build_object(
        'selfie_path', req.selfie_storage_path,
        'gesture', req.gesture,
        'matches_created', matches_created
      )
    );

    RETURN jsonb_build_object(
      'success', true,
      'action', 'approved',
      'matches_created', matches_created
    );
  ELSE
    UPDATE verification_requests
    SET status = 'rejected', admin_id = admin_user_id, reviewed_at = NOW(),
        rejection_reason = reject_reason
    WHERE id = request_id;

    UPDATE profiles
    SET verification_status = 'rejected'
    WHERE id = req.user_id;

    -- Log to audit
    INSERT INTO admin_audit_log (admin_id, target_user_id, action, details)
    VALUES (admin_user_id, req.user_id, 'verification_rejected',
      jsonb_build_object(
        'selfie_path', req.selfie_storage_path,
        'gesture', req.gesture,
        'rejection_reason', COALESCE(reject_reason, '')
      )
    );

    RETURN jsonb_build_object('success', true, 'action', 'rejected');
  END IF;
END;
$$;

-- ============================================================
-- Update ban_user to log the action
-- ============================================================
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

  -- Log to audit
  INSERT INTO admin_audit_log (admin_id, target_user_id, action, details)
  VALUES (current_user_id, target_user_id, 'ban', '{}'::jsonb);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================
-- Update unban_user to log the action
-- ============================================================
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

  -- Log to audit
  INSERT INTO admin_audit_log (admin_id, target_user_id, action, details)
  VALUES (current_user_id, target_user_id, 'unban', '{}'::jsonb);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================
-- RPC to get audit log with admin and target names
-- ============================================================
CREATE OR REPLACE FUNCTION get_admin_audit_log(
  page_limit INT DEFAULT 50,
  page_offset INT DEFAULT 0,
  action_filter TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  caller RECORD;
  result JSON;
BEGIN
  SELECT is_admin, is_moderator INTO caller
  FROM profiles WHERE id = current_user_id;

  IF NOT (COALESCE(caller.is_admin, FALSE) OR COALESCE(caller.is_moderator, FALSE)) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT json_agg(row_data)
  INTO result
  FROM (
    SELECT
      al.id,
      al.action,
      al.details,
      al.created_at,
      json_build_object('id', admin_p.id, 'name', admin_p.name, 'avatar_url', admin_p.avatar_url) AS admin,
      json_build_object('id', target_p.id, 'name', target_p.name, 'avatar_url', target_p.avatar_url) AS target
    FROM admin_audit_log al
    INNER JOIN profiles admin_p ON admin_p.id = al.admin_id
    INNER JOIN profiles target_p ON target_p.id = al.target_user_id
    WHERE (action_filter IS NULL OR al.action = action_filter)
    ORDER BY al.created_at DESC
    LIMIT page_limit
    OFFSET page_offset
  ) row_data;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION get_admin_audit_log(integer, integer, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
