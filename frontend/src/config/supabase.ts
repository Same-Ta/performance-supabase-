import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Edge Functions 기본 URL
export const EDGE_FUNCTIONS_URL = import.meta.env.DEV
  ? 'http://localhost:54321/functions/v1'
  : `${supabaseUrl}/functions/v1`;
