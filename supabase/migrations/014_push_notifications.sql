-- =============================================================
-- Push Notifications: tokens, function de envio, y triggers
-- =============================================================

-- 1. Habilitar pg_net (permite hacer HTTP requests desde PostgreSQL)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Tabla de tokens push
CREATE TABLE public.push_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT push_tokens_user_id_key UNIQUE (user_id)
);

CREATE INDEX idx_push_tokens_user_id ON public.push_tokens(user_id);

-- RLS
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own push token"
  ON public.push_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own push token"
  ON public.push_tokens FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own push token"
  ON public.push_tokens FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can read their own push token"
  ON public.push_tokens FOR SELECT
  USING (auth.uid() = user_id);

-- 3. Funcion para enviar push via Expo Push API
CREATE OR REPLACE FUNCTION public.send_push_notification(
  p_user_id uuid,
  p_title text,
  p_body text,
  p_data jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token text;
BEGIN
  SELECT token INTO v_token
  FROM public.push_tokens
  WHERE user_id = p_user_id;

  IF v_token IS NULL THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Accept', 'application/json'
    ),
    body := jsonb_build_object(
      'to', v_token,
      'title', p_title,
      'body', p_body,
      'data', p_data,
      'sound', 'default',
      'priority', 'high',
      'channelId', 'default'
    )
  );
END;
$$;

-- 4. Trigger: notificar nuevo match
CREATE OR REPLACE FUNCTION public.notify_new_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_name_a text;
  v_name_b text;
BEGIN
  SELECT name INTO v_name_a FROM public.profiles WHERE id = NEW.user_a_id;
  SELECT name INTO v_name_b FROM public.profiles WHERE id = NEW.user_b_id;

  -- Notificar a usuario A
  PERFORM public.send_push_notification(
    NEW.user_a_id,
    'Serena',
    COALESCE(v_name_b, 'Alguien') || ' y tu sois match! ',
    jsonb_build_object('type', 'new_match', 'match_id', NEW.id)
  );

  -- Notificar a usuario B
  PERFORM public.send_push_notification(
    NEW.user_b_id,
    'Serena',
    COALESCE(v_name_a, 'Alguien') || ' y tu sois match! ',
    jsonb_build_object('type', 'new_match', 'match_id', NEW.id)
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_new_match
  AFTER INSERT ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_match();

-- 5. Trigger: notificar nuevo mensaje
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_recipient_id uuid;
  v_sender_name text;
  v_preview text;
  v_user_a_id uuid;
  v_user_b_id uuid;
BEGIN
  SELECT user_a_id, user_b_id
  INTO v_user_a_id, v_user_b_id
  FROM public.matches
  WHERE id = NEW.match_id;

  IF NEW.sender_id = v_user_a_id THEN
    v_recipient_id := v_user_b_id;
  ELSE
    v_recipient_id := v_user_a_id;
  END IF;

  SELECT name INTO v_sender_name FROM public.profiles WHERE id = NEW.sender_id;

  v_preview := LEFT(NEW.content, 100);
  IF LENGTH(NEW.content) > 100 THEN
    v_preview := v_preview || '...';
  END IF;

  PERFORM public.send_push_notification(
    v_recipient_id,
    COALESCE(v_sender_name, 'Nuevo mensaje'),
    v_preview,
    jsonb_build_object(
      'type', 'new_message',
      'match_id', NEW.match_id,
      'message_id', NEW.id
    )
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_new_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_message();
