import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Use Supabase's built-in session management (stable & reliable)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// App Lock settings (device-local)
export interface AppLockSettings {
  enabled: boolean;
  pin: string;
  biometric: boolean;
}
const APP_LOCK_KEY = 'tw_app_lock';
export const getAppLockSettings = (): AppLockSettings => {
  try { return { enabled: false, pin: '', biometric: false, ...JSON.parse(localStorage.getItem(APP_LOCK_KEY) || '{}') }; }
  catch { return { enabled: false, pin: '', biometric: false }; }
};
export const saveAppLockSettings = (s: AppLockSettings) =>
  localStorage.setItem(APP_LOCK_KEY, JSON.stringify(s));
export const clearAppLockSettings = () => localStorage.removeItem(APP_LOCK_KEY);
