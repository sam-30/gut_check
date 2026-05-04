import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.info('Gut Check: Supabase env vars not set — auth/cloud stats disabled. See .env.example.');
}

export const supabase = (url && key) ? createClient(url, key) : null;
