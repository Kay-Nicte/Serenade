import { supabase } from './supabase';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';

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

  console.log('[GoogleAuth] Opening browser...');
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  console.log('[GoogleAuth] Browser result type:', result.type);

  // Check if the deep link handler already set the session (common on Android
  // where the redirect causes the deep link handler to fire before openAuthSessionAsync returns)
  const { data: existingSession } = await supabase.auth.getSession();
  if (existingSession.session) {
    console.log('[GoogleAuth] Session already set by deep link handler');
    return;
  }

  // Path 1: openAuthSessionAsync returned the redirect URL with tokens
  if (result.type === 'success' && result.url) {
    const fragment = result.url.split('#')[1] ?? '';
    const params = new URLSearchParams(fragment);
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');

    if (access_token && refresh_token) {
      console.log('[GoogleAuth] Path 1: tokens found, setting session...');
      const { error: sessionError } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });
      if (sessionError) throw sessionError;
      console.log('[GoogleAuth] Session set successfully');
      return;
    }
  }

  // Path 2: Wait briefly for deep link handler to set the session
  console.log('[GoogleAuth] Path 2: waiting for deep link handler...');
  await new Promise((r) => setTimeout(r, 2000));
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session) {
    console.log('[GoogleAuth] Path 2: session found');
    return;
  }

  throw new Error('Google sign-in was cancelled');
}

export async function signInWithApple() {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  if (!credential.identityToken) {
    throw new Error('No identity token returned from Apple');
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  });

  if (error) throw error;
}

export function isAppleAuthAvailable(): boolean {
  return Platform.OS === 'ios';
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
