const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://duaqkmptxsnonvtfdohp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1YXFrbXB0eHNub252dGZkb2hwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1NjUwOTAsImV4cCI6MjA4NzE0MTA5MH0.5glBvL0FsyhWvtasjvmfOQwMOP8LFQf-Jq2e5ji92XE';
const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
    // Attempt delete
    const { data: offers } = await supabase.from('training_offers').select('id').limit(1);
    if (offers.length) {
        const { data, error } = await supabase.rpc('delete_training_offer_test', { offer_id: offers[0].id }).catch(() => ({}));
        console.log('RPC?', data, error);
    }

    // Attempt normal delete logging the raw network response or similar?
    // Usually if RLS blocks delete, error is NULL and data is []
    const res = await supabase.from('training_offers').delete().eq('id', offers[0].id).select();
    console.log('Delete res:', res);
})();
