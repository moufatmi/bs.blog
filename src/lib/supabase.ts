import { createClient } from '@supabase/supabase-js';

export interface Program {
  id: string;
  title: string;
  description: string | null;
  price: string | null;
  image_url: string | null;
  created_at: string;
}

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials are missing in environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
