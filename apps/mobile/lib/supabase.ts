import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ghjkfwhrzxrjihpjrrxo.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_uhBYZVDtkIspMKWaAT0h8Q_Z5XNzE5L';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
