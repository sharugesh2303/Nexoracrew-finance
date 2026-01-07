import { createClient } from '@supabase/supabase-js';

// ------------------------------------------------------------------
// ⚠️ ACTION REQUIRED: PASTE YOUR SUPABASE CREDENTIALS HERE
// ------------------------------------------------------------------

const SUPABASE_URL = ''; // e.g. https://xyz.supabase.co
const SUPABASE_KEY = ''; // e.g. eyJhbGciOiJIUzI1NiIsInR5c...

// Helper to check if properly configured
export const isSupabaseConfigured = () => {
    return SUPABASE_URL.length > 0 && SUPABASE_KEY.length > 0 && !SUPABASE_URL.includes('YOUR_PROJECT_ID');
};

// Create client with Realtime enabled
export const supabase = createClient(SUPABASE_URL || 'https://placeholder.supabase.co', SUPABASE_KEY || 'placeholder', {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
    },
    realtime: {
        params: {
            eventsPerSecond: 10,
        },
    },
});