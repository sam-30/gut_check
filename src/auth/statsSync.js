import { supabase } from './supabase.js';

export async function loadStats(userId) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('user_stats')
    .select('decisions, correct')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) { console.error('loadStats:', error.message); return null; }
  return data ?? { decisions: 0, correct: 0 };
}

export async function saveStats(userId, decisions, correct) {
  if (!supabase) return;
  const { error } = await supabase
    .from('user_stats')
    .upsert(
      { user_id: userId, decisions, correct, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  if (error) console.error('saveStats:', error.message);
}
