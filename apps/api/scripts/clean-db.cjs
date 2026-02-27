const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:B3y0ndLV2005!@db.mqwxedwuznotdhnphvfs.supabase.co:5432/postgres'
});

(async () => {
  const client = await pool.connect();
  try {
    console.log('Clearing all instances...');

    // Delete all user servers (unassign droplets)
    const result1 = await client.query('DELETE FROM user_servers;');
    console.log(`✓ Deleted ${result1.rowCount} user_servers records`);

    // Delete all allocations
    const result2 = await client.query('DELETE FROM allocations;');
    console.log(`✓ Deleted ${result2.rowCount} allocation records`);

    // Optionally: clear pool_servers if they exist
    try {
      const result3 = await client.query('DELETE FROM pool_servers;');
      console.log(`✓ Deleted ${result3.rowCount} pool_servers records`);
    } catch (err) {
      console.log('  (pool_servers table may not exist, skipping)');
    }

    console.log('\n✓ All instances unassigned and returned to pool');
    console.log('✓ Database cleaned successfully');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();
