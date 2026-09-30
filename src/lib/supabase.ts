import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://thoqrtiscrdyupbnxgbt.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRob3FydGlzY3JkeXVwYm54Z2J0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3NjUyNjgsImV4cCI6MjEwNjM0MTI2OH0.2f8aecaNRVBh0AtLuxN2yvho-cZuN43jHhqqg-Kdfvg';

export const PROJECT_DETAILS = {
  name: 'Google_Login-Coral_AI',
  ref: 'thoqrtiscrdyupbnxgbt',
  region: 'ap-south-1',
  url: supabaseUrl,
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
