-- Launch promotion: grant 30 days of premium when verification is approved
-- during the first month after launch (until 2026-04-10).
-- Stacks with the 7-day profile completion trial.

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
  promo_end TIMESTAMPTZ := '2026-05-10T23:59:59Z';
  promo_days INT := 30;
  v_profile RECORD;
  new_premium_until TIMESTAMPTZ;
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

    -- Launch promo: grant 30 days premium if within promo window
    IF NOW() <= promo_end THEN
      SELECT premium_until INTO v_profile FROM profiles WHERE id = req.user_id;

      -- Stack on top of existing premium (trial or purchase)
      IF v_profile.premium_until IS NOT NULL AND v_profile.premium_until > NOW() THEN
        new_premium_until := v_profile.premium_until + (promo_days || ' days')::INTERVAL;
      ELSE
        new_premium_until := NOW() + (promo_days || ' days')::INTERVAL;
      END IF;

      UPDATE profiles
      SET is_premium = TRUE, premium_until = new_premium_until
      WHERE id = req.user_id;
    END IF;

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
        'matches_created', matches_created,
        'promo_premium_granted', NOW() <= promo_end
      )
    );

    RETURN jsonb_build_object(
      'success', true,
      'action', 'approved',
      'matches_created', matches_created,
      'promo_premium_granted', NOW() <= promo_end
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

NOTIFY pgrst, 'reload schema';
