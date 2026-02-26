import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envText = readFileSync('.env', 'utf-8');
const env = Object.fromEntries(
    envText.split('\n')
        .filter(l => l.includes('='))
        .map(l => {
            const [k, ...v] = l.split('=');
            return [k.trim(), v.join('=').trim().replace(/^["']|["']$/g, '')];
        })
);
const supabase = createClient(env['VITE_SUPABASE_URL'], env['VITE_SUPABASE_ANON_KEY']);
async function run() {
    const { count, error } = await supabase.from('event_logs').select('*', { count: 'exact', head: true });
    console.log('Event Logs count:', count);
}
run();
