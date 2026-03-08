import { supabase } from './supabase';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';

export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function changePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function reauthenticate(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function deleteAccount() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Clean up storage files client-side (Supabase doesn't allow direct SQL on storage.objects)
  try {
    // Clean up profile photos
    const { data: photos } = await supabase
      .from('photos')
      .select('storage_path')
      .eq('user_id', user.id);

    if (photos && photos.length > 0) {
      const paths = photos.map((p) => p.storage_path);
      await supabase.storage.from('profile-photos').remove(paths);
    }

    // Clean up chat images
    const { data: matches } = await supabase
      .from('matches')
      .select('id')
      .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`);

    if (matches && matches.length > 0) {
      for (const match of matches) {
        const { data: files } = await supabase.storage
          .from('chat-images')
          .list(match.id);

        if (files && files.length > 0) {
          const filePaths = files.map((file) => `${match.id}/${file.name}`);
          await supabase.storage.from('chat-images').remove(filePaths);
        }
      }
    }
  } catch {
    // Storage cleanup is best-effort; don't block account deletion
  }

  // Call the server-side RPC to delete all account data
  const { error } = await supabase.rpc('delete_own_account');
  if (error) {
    console.error('[DeleteAccount] RPC error:', JSON.stringify(error));
    throw error;
  }
}

export async function signInWithGoogle() {
  const redirectTo = makeRedirectUri({ scheme: 'serenade', path: 'google-auth' });
  console.log('[GoogleAuth] redirectTo:', redirectTo);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) throw error;
  if (!data.url) throw new Error('No OAuth URL returned');

  console.log('[GoogleAuth] Opening browser with URL:', data.url.substring(0, 120));
  console.log('[GoogleAuth] Expected redirectTo:', redirectTo);
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  console.log('[GoogleAuth] Browser result type:', result.type);
  if (result.type === 'success') {
    console.log('[GoogleAuth] Result URL (full):', (result as any).url);
  } else {
    console.log('[GoogleAuth] Browser result (non-success):', JSON.stringify(result));
  }

  // Path 1: openAuthSessionAsync returned the redirect URL with tokens
  if (result.type === 'success' && result.url) {
    const url = new URL(result.url);
    const fragment = url.hash.substring(1);
    console.log('[GoogleAuth] Hash fragment:', fragment.substring(0, 200));
    console.log('[GoogleAuth] Search params:', url.search);
    const params = new URLSearchParams(fragment);
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');

    if (access_token && refresh_token) {
      console.log('[GoogleAuth] Path 1: tokens found, setting session...');
      const { data: sessionResult, error: sessionError } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });
      if (sessionError) {
        console.log('[GoogleAuth] setSession error:', sessionError.message);
        throw sessionError;
      }
      console.log('[GoogleAuth] Session set successfully, user:', sessionResult.user?.id);
      return;
    }
    console.log('[GoogleAuth] Path 1: no tokens found. access_token?', !!access_token, 'refresh_token?', !!refresh_token);
  }

  // Path 2: Browser was dismissed but the deep link handler or
  // google-auth screen may have already set the session.
  console.log('[GoogleAuth] Path 2: waiting 2s then checking session...');
  await new Promise((r) => setTimeout(r, 2000));
  const { data: sessionData } = await supabase.auth.getSession();
  console.log('[GoogleAuth] Path 2: session exists?', !!sessionData.session, 'user?', sessionData.session?.user?.id);
  if (sessionData.session) return;

  // Path 3: Check store directly (deep link handler might have set it)
  const storeSession = (await import('@/stores/authStore')).useAuthStore.getState().session;
  console.log('[GoogleAuth] Path 3: store session exists?', !!storeSession);
  if (storeSession) return;

  throw new Error('Google sign-in was cancelled');
}

export async function sendPasswordResetEmail(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'serenade://reset-password',
  });
  if (error) throw error;
}

export async function updatePasswordFromReset(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}
