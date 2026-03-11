import { createClient } from '@supabase/supabase-js';
import { openDatabaseSync } from 'expo-sqlite';
import Constants from 'expo-constants';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl as string;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Copy .env.example to .env and fill in the values.'
  );
}

class SupabaseStorage {
  private db = openDatabaseSync('supabase-auth');

  constructor() {
    this.db.execSync(
      'CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT);'
    );
  }

  getItem(key: string): string | null {
    const row = this.db.getFirstSync<{ value: string }>(
      'SELECT value FROM kv WHERE key = ?;',
      [key]
    );
    return row?.value ?? null;
  }

  setItem(key: string, value: string): void {
    this.db.runSync(
      'INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?);',
      [key, value]
    );
  }

  removeItem(key: string): void {
    this.db.runSync('DELETE FROM kv WHERE key = ?;', [key]);
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: new SupabaseStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
