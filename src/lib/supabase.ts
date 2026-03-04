import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

// Create client lazily - don't throw at module load time during build
let _supabase: ReturnType<typeof createClient> | null = null;

export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(_target, prop) {
    if (!_supabase) {
      if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables');
      }
      _supabase = createClient(supabaseUrl, supabaseServiceKey);
    }
    return (_supabase as any)[prop];
  },
});
