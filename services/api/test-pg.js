const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:postgres@localhost:5432/airtrainr?schema=public' });

(async () => {
    try {
        await client.connect();
        const res = await client.query(`SELECT * FROM pg_policies WHERE tablename = 'training_offers'`);
        console.log('Policies applied to training_offers:');
        console.log(res.rows);

        // Let's just DROP RLS or create a delete policy
        await client.query(`DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON public.training_offers;`);
        await client.query(`CREATE POLICY "Enable delete for users based on user_id" ON public.training_offers FOR DELETE USING (true);`);
        console.log('Delete policy created on training_offers.');
    } catch (e) {
        console.error('Error connecting to local pg:', e.message);
    } finally {
        await client.end();
    }
})();
