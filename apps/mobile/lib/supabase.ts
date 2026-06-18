import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://bweuuzqpcmhqosjsvjry.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3ZXV1enFwY21ocW9zanN2anJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDMwNDAwMDAsImV4cCI6MTg2MDgwODAwMH0.dummykey_replace_with_real_key';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
