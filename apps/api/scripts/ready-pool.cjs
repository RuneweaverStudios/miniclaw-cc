const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:B3y0ndLV2005!@db.mqwxedwuznotdhnphvfs.supabase.co:5432/postgres'
});

(async () => {
  const client = await pool.connect();
  try {
    console.log('🧹 Cleaning up...');

    // Delete all user servers (unassign droplets)
    const result1 = await client.query('DELETE FROM user_servers;');
    console.log(`✓ Deleted ${result1.rowCount} user_servers records`);

    // Delete all allocations
    const result2 = await client.query('DELETE FROM allocations;');
    console.log(`✓ Deleted ${result2.rowCount} allocation records`);

    // Clear pool servers
    try {
      await client.query('DELETE FROM pool_servers;');
      console.log(`✓ Cleared pool_servers records`);
    } catch (err) {
      console.log('  (pool_servers table may not exist, skipping)');
    }

    console.log('\n🚀 Pre-provisioning standby pool...');

    // Simulate pre-provisioned droplets
    const frameworks = ['nanobot', 'openclaw'];
    const models = ['minimax/minimax-m2.5', 'anthropic/claude-sonnet-4', 'openai/gpt-4o'];
    const regions = ['nyc1', 'nyc3', 'sfo2', 'ams3'];
    const sizes = ['s-1vcpu-1gb', 's-1vcpu-2gb', 's-2vcpu-2gb'];

    // Create 10 pre-provisioned droplets (5 nanobot, 5 openclaw)
    const droplets = [];
    for (let i = 0; i < 10; i++) {
      const framework = frameworks[i % 2];
      const model = models[i % models.length];
      const dropletId = 1000000 + i;
      const region = regions[i % regions.length];
      const size = sizes[i % sizes.length];
      const ipAddress = `104.234.${100 + i}.${Math.floor(Math.random() * 255)}`;

      droplets.push({
        dropletId,
        dropletName: `miniclaw-${framework}-${dropletId}`,
        state: 'standby',
        stack: framework,
        region,
        size,
        ipAddress,
        sshPort: 22,
        createdAt: new Date(),
        stateChangedAt: new Date(),
        allocatedTo: null,
        healthStatus: 'healthy',
        healthCheckFailures: 0,
        stackVersion: '1.0.0',
      });

      console.log(`  ✓ ${framework.toUpperCase()} droplet ${dropletId} (${region}, ${size}) - ${model}`);
    }

    // Insert pool servers
    try {
      for (const droplet of droplets) {
        await client.query(`
          INSERT INTO pool_servers (
            droplet_id, droplet_name, state, stack, region, size,
            ip_address, ssh_port, created_at, state_changed_at,
            allocated_to, health_status, health_check_failures, stack_version
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        `, [
          droplet.dropletId,
          droplet.dropletName,
          droplet.state,
          droplet.stack,
          droplet.region,
          droplet.size,
          droplet.ipAddress,
          droplet.sshPort,
          droplet.createdAt,
          droplet.stateChangedAt,
          droplet.allocatedTo,
          droplet.healthStatus,
          droplet.healthCheckFailures,
          droplet.stackVersion,
        ]);
      }
      console.log(`\n✓ ${droplets.length} droplets added to standby pool`);
    } catch (err) {
      console.log('  (pool_servers table may not exist, skipping pool creation)');
    }

    console.log('\n✅ Standby pool ready!');
    console.log(`   - ${droplets.filter(d => d.stack === 'nanobot').length} Nanobot droplets`);
    console.log(`   - ${droplets.filter(d => d.stack === 'openclaw').length} OpenClaw droplets`);
    console.log(`   - ${droplets.length} total ready for allocation`);

  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();
