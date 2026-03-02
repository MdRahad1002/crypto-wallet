/**
 * Supabase Client — Frontend (browser-side, anon key)
 *
 * Exposes a singleton `supabase` client for use in React components.
 * The client is null if env vars are not set, so imports never throw.
 *
 * Required env vars in frontend/.env (or set in Vercel project settings):
 *   REACT_APP_SUPABASE_URL=https://vwbijbycnqobdlvnyisw.supabase.co
 *   REACT_APP_SUPABASE_ANON_KEY=<anon_key>
 *
 * Note: CRA uses REACT_APP_ prefix, not NEXT_PUBLIC_.
 *
 * Usage:
 *   import { supabase } from '../lib/supabaseClient';
 *   if (supabase) {
 *     const { data } = await supabase.from('kyc_submissions').select();
 *   }
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Only warn in browser, not during SSR/build
  if (typeof window !== 'undefined') {
    console.warn(
      '[Supabase] REACT_APP_SUPABASE_URL or REACT_APP_SUPABASE_ANON_KEY is not set.\n' +
      'Add them to frontend/.env to enable Supabase features.'
    );
  }
}

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export default supabase;
