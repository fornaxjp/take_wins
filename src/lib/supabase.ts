import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// No automatic session persistence — we control it manually via "remember me"
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: true },
});

const SESSION_KEY = 'tw_session';
const REMEMBER_KEY = 'tw_remember';

export const saveRememberedSession = async () => {
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    }));
    localStorage.setItem(REMEMBER_KEY, '1');
  }
};

export const loadRememberedSession = async () => {
  if (!localStorage.getItem(REMEMBER_KEY)) return null;
  const stored = localStorage.getItem(SESSION_KEY);
  if (!stored) return null;
  try {
    const tokens = JSON.parse(stored);
    const { data, error } = await supabase.auth.setSession(tokens);
    if (error || !data.session) { clearRememberedSession(); return null; }
    return data.session;
  } catch { clearRememberedSession(); return null; }
};

export const clearRememberedSession = () => {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(REMEMBER_KEY);
};

// App Lock settings (device-local, not cloud)
const APP_LOCK_KEY = 'tw_app_lock';
export interface AppLockSettings {
  enabled: boolean;
  pin: string; // hashed
  biometric: boolean;
}
export const getAppLockSettings = (): AppLockSettings => {
  try { return JSON.parse(localStorage.getItem(APP_LOCK_KEY) || '{}'); } catch { return { enabled: false, pin: '', biometric: false }; }
};
export const saveAppLockSettings = (s: AppLockSettings) => localStorage.setItem(APP_LOCK_KEY, JSON.stringify(s));
export const clearAppLockSettings = () => localStorage.removeItem(APP_LOCK_KEY);
