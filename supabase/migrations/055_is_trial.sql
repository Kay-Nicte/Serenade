-- Track whether current premium was granted as a free trial (vs real payment)
-- so the upsell banner can still show during trial periods.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_trial BOOLEAN NOT NULL DEFAULT FALSE;

-- Mark as trial when activate_premium_trial is called
CREATE OR REPLACE FUNCTION activate_premium_trial()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_premium_until TIMESTAMPTZ;
BEGIN
  -- Only grant if user has never had premium
  SELECT premium_until INTO v_premium_until
  FROM profiles
  WHERE id = v_user_id;

  IF v_premium_until IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_used');
  END IF;

  UPDATE profiles
  SET
    is_premium = true,
    premium_until = NOW() + INTERVAL '7 days',
    is_trial = true
  WHERE id = v_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Clear trial flag when a real purchase is activated
CREATE OR REPLACE FUNCTION activate_premium_purchase(premium_until_ts TIMESTAMPTZ)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET
    is_premium = true,
    premium_until = premium_until_ts,
    is_trial = false
  WHERE id = auth.uid();
END;
$$;
