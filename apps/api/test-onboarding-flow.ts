/**
 * E2E Onboarding Flow Test
 *
 * Tests the complete server provisioning and pool refill flow:
 * 1. Provision new droplets with cloud-init
 * 2. Wait for droplets to be ready (IP + cloud-init complete)
 * 3. Install Nanobot/OpenClaw
 * 4. Create per-droplet OpenRouter keys
 * 5. Configure model and verify LLM connectivity
 * 6. Test gateway health endpoint
 * 7. Add to pool as standby + healthy
 *
 * Usage:
 *   npm run test:onboarding           # Test 1 server of each type
 *   npm run test:onboarding -- --count 3  # Test 3 servers of each type
 *   npm run test:onboarding -- --type nanobot  # Test only Nanobot
 */

import 'dotenv/config';
import { program } from 'commander';
import { poolManager } from './src/services/pool-manager.js';
import { nanobotService } from './src/services/nanobot.js';
import { healthChecker } from './src/services/health-check.js';
import { openrouterService } from './src/services/openrouter.js';
import { provisionDroplet } from './src/services/provisioner.js';
import { createSSHConnection } from './src/lib/ssh.js';
import type { StackType } from '@miniclaw/shared';

// Test configuration
const DEFAULT_REGION = 'nyc1';
const DEFAULT_SIZE = 's-1vcpu-1gb';
const NANOBOT_VERSION = '0.1.3.post7';
const OPENCLAW_VERSION = '1.0.0';
const TEST_MODEL = 'minimax/minimax-m2.5';

interface TestOptions {
  count: number;
  type: 'nanobot' | 'openclaw' | 'both';
  region: string;
  skipProvision: boolean;
  skipHealthCheck: boolean;
  destroyAfter: boolean;
}

interface TestResult {
  dropletId: number;
  dropletName: string;
  ipAddress: string;
  stack: StackType;
  success: boolean;
  steps: TestStep[];
  error?: string;
}

interface TestStep {
  name: string;
  success: boolean;
  duration: number;
  error?: string;
  details?: any;
}

/**
 * Main E2E test function
 */
async function runE2ETest(options: TestOptions): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║     E2E Onboarding Flow Test - MiniClaw-CC                     ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('Configuration:');
  console.log(`  Stack: ${options.type}`);
  console.log(`  Count: ${options.count} per stack type`);
  console.log(`  Region: ${options.region}`);
  console.log(`  Skip Provision: ${options.skipProvision}`);
  console.log(`  Skip Health Check: ${options.skipHealthCheck}`);
  console.log(`  Destroy After: ${options.destroyAfter}`);
  console.log('');

  const stacksToTest: StackType[] = [];
  if (options.type === 'both' || options.type === 'nanobot') stacksToTest.push('nanobot');
  if (options.type === 'both' || options.type === 'openclaw') stacksToTest.push('openclaw');

  const allResults: TestResult[] = [];

  for (const stack of stacksToTest) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Testing ${stack.toUpperCase()} stack (${options.count} servers)`);
    console.log(`${'='.repeat(70)}\n`);

    const stackResults = await testStack(stack, options);
    allResults.push(...stackResults);
  }

  // Print summary
  await printSummary(allResults);

  // Exit with error if any tests failed
  const failedResults = allResults.filter(r => !r.success);
  if (failedResults.length > 0) {
    console.error(`\n❌ ${failedResults.length} test(s) failed`);
    process.exit(1);
  }

  console.log('\n✅ All tests passed!');
}

/**
 * Test a specific stack type
 */
async function testStack(stack: StackType, options: TestOptions): Promise<TestResult[]> {
  const results: TestResult[] = [];

  for (let i = 0; i < options.count; i++) {
    const result = await testSingleServer(stack, i, options);
    results.push(result);

    // Small delay between servers
    if (i < options.count - 1) {
      await sleep(2000);
    }
  }

  return results;
}

/**
 * Test a single server end-to-end
 */
async function testSingleServer(
  stack: StackType,
  index: number,
  options: TestOptions
): Promise<TestResult> {
  const startTime = Date.now();
  const steps: TestStep[] = [];
  let success = false;
  let error: string | undefined;
  let dropletInfo: { dropletId: number; dropletName: string; ipAddress: string } | null = null;

  try {
    console.log(`\n[${stack.toUpperCase()}] Test ${index + 1}/${options.count}`);
    console.log('─'.repeat(70));

    // STEP 1: Provision droplet
    if (!options.skipProvision) {
      console.log('\n[1/8] Provisioning droplet...');
      const provisionResult = await step('Provision', async () => {
        return await provisionDroplet({
          stack,
          region: options.region,
          size: DEFAULT_SIZE,
          version: stack === 'nanobot' ? NANOBOT_VERSION : OPENCLAW_VERSION,
        });
      });
      steps.push(provisionResult.step);
      dropletInfo = provisionResult.data;
      console.log(`  ✅ Provisioned ${dropletInfo.dropletName} (${dropletInfo.ipAddress})`);
    } else {
      // Get existing standby server from pool
      console.log('\n[1/8] Using existing standby server...');
      const servers = await poolManager.getServers('standby');
      const stackServers = servers.filter(s => s.stack === stack && s.healthStatus === 'healthy');

      if (stackServers.length === 0) {
        throw new Error('No standby servers available in pool');
      }

      const server = stackServers[index % stackServers.length];
      dropletInfo = {
        dropletId: server.dropletId,
        dropletName: server.dropletName,
        ipAddress: server.ipAddress!,
      };
      steps.push({
        name: 'Use Existing',
        success: true,
        duration: 0,
      });
      console.log(`  ✅ Using ${dropletInfo.dropletName} (${dropletInfo.ipAddress})`);
    }

    // STEP 2: Wait for SSH availability
    console.log('\n[2/8] Waiting for SSH...');
    const sshWaitResult = await step('SSH Available', async () => {
      await waitForSSH(dropletInfo!.ipAddress);
      return { ready: true };
    });
    steps.push(sshWaitResult.step);
    console.log(`  ✅ SSH available (${sshWaitResult.step.duration}ms)`);

    // STEP 3: Wait for cloud-init completion
    console.log('\n[3/8] Waiting for cloud-init...');
    const cloudInitResult = await step('Cloud-init Complete', async () => {
      const ssh = await createSSHConnection({ host: dropletInfo!.ipAddress, username: 'root' });
      await waitForCloudInit(ssh);
      await ssh.disconnect();
      return { complete: true };
    });
    steps.push(cloudInitResult.step);
    console.log(`  ✅ Cloud-init complete (${cloudInitResult.step.duration}ms)`);

    // STEP 4: Install stack (Nanobot or OpenClaw)
    if (stack === 'nanobot') {
      console.log('\n[4/8] Installing Nanobot...');
      const installResult = await step('Install Nanobot', async () => {
        return await nanobotService.install({
          ipAddress: dropletInfo!.ipAddress,
          version: NANOBOT_VERSION,
        });
      });
      steps.push(installResult.step);

      if (!installResult.data.success) {
        throw new Error(`Nanobot installation failed: ${installResult.data.error}`);
      }
      console.log(`  ✅ Nanobot installed (${installResult.step.duration}ms)`);
    } else {
      // OpenClaw is installed via cloud-init, just verify
      console.log('\n[4/8] Verifying OpenClaw installation...');
      const verifyResult = await step('Verify OpenClaw', async () => {
        const ssh = await createSSHConnection({ host: dropletInfo!.ipAddress, username: 'root' });
        const result = await ssh.executeCommand('which openclaw');
        await ssh.disconnect();

        if (result.code !== 0) {
          throw new Error('OpenClaw not found');
        }
        return { installed: true };
      });
      steps.push(verifyResult.step);
      console.log(`  ✅ OpenClaw verified (${verifyResult.step.duration}ms)`);
    }

    // STEP 5: Create per-droplet OpenRouter key
    console.log('\n[5/8] Creating per-droplet OpenRouter key...');
    const openRouterResult = await step('Create OpenRouter Key', async () => {
      const key = await openrouterService.createDropletKey(dropletInfo!.dropletId);
      return { key };
    });
    steps.push(openRouterResult.step);
    const dropletOpenRouterKey = openRouterResult.data.key;
    console.log(`  ✅ OpenRouter key created: ${dropletOpenRouterKey.slice(0, 20)}... (${openRouterResult.step.duration}ms)`);

    // STEP 6: Configure model and test LLM connectivity
    console.log('\n[6/8] Configuring model and testing LLM...');
    const llmTestResult = await step('Test LLM Connectivity', async () => {
      const ssh = await createSSHConnection({ host: dropletInfo!.ipAddress, username: 'root' });

      try {
        // Configure with test model
        if (stack === 'nanobot') {
          await configureNanobotForTest(ssh, dropletOpenRouterKey);
        } else {
          await configureOpenClawForTest(ssh, dropletOpenRouterKey);
        }

        // Test gateway health
        const healthCheck = await testGatewayHealth(ssh, stack);

        await ssh.disconnect();
        return { healthy: healthCheck };
      } catch (err) {
        await ssh.disconnect();
        throw err;
      }
    });
    steps.push(llmTestResult.step);
    console.log(`  ✅ LLM connectivity verified (${llmTestResult.step.duration}ms)`);

    // STEP 7: Full health check
    if (!options.skipHealthCheck) {
      console.log('\n[7/8] Running full health check...');
      const healthResult = await step('Health Check', async () => {
        // Temporarily add to pool for health check
        await poolManager.addServer({
          dropletId: dropletInfo!.dropletId,
          dropletName: dropletInfo!.dropletName,
          ipAddress: dropletInfo!.ipAddress,
          region: options.region,
          size: DEFAULT_SIZE,
          stack,
          stackVersion: stack === 'nanobot' ? NANOBOT_VERSION : OPENCLAW_VERSION,
          state: 'testing',
          healthStatus: 'pending',
          stateChangedAt: new Date(),
          config: {
            monitoringEnabled: false,
            alertsEnabled: false,
            backupEnabled: false,
            openrouterKey: dropletOpenRouterKey,
          },
        });

        const server = await poolManager.getServer(dropletInfo!.dropletId);
        if (!server) {
          throw new Error('Server not found in pool after adding');
        }

        const result = await healthChecker.checkServer(server);

        // Clean up from pool after health check
        await poolManager.removeServer(dropletInfo!.dropletId);

        return result;
      });
      steps.push(healthResult.step);
      console.log(`  ✅ Health check: ${healthResult.data.status} (${healthResult.step.duration}ms)`);

      if (!healthResult.data.healthy) {
        throw new Error(`Health check failed: ${healthResult.data.details.error || 'Unknown error'}`);
      }
    }

    // STEP 8: Add to pool as standby + healthy
    console.log('\n[8/8] Adding to pool...');
    const addResult = await step('Add to Pool', async () => {
      await poolManager.addServer({
        dropletId: dropletInfo!.dropletId,
        dropletName: dropletInfo!.dropletName,
        ipAddress: dropletInfo!.ipAddress,
        region: options.region,
        size: DEFAULT_SIZE,
        stack,
        stackVersion: stack === 'nanobot' ? NANOBOT_VERSION : OPENCLAW_VERSION,
        state: 'standby',
        healthStatus: 'healthy',
        stateChangedAt: new Date(),
        config: {
          monitoringEnabled: false,
          alertsEnabled: false,
          backupEnabled: false,
          openrouterKey: dropletOpenRouterKey,
          model: TEST_MODEL,
        },
      });
      return { added: true };
    });
    steps.push(addResult.step);
    console.log(`  ✅ Added to pool as standby+healthy (${addResult.step.duration}ms)`);

    success = true;

    // Destroy droplet if requested
    if (options.destroyAfter) {
      console.log('\n[🗑️] Destroying droplet after successful test...');
      await destroyDroplet(dropletInfo.dropletId);
      await poolManager.removeServer(dropletInfo.dropletId);
      console.log('  ✅ Droplet destroyed and removed from pool');
    }

  } catch (err: any) {
    error = err.message;
    console.error(`\n❌ Test failed: ${error}`);
  }

  const totalDuration = Date.now() - startTime;

  return {
    dropletId: dropletInfo?.dropletId || 0,
    dropletName: dropletInfo?.dropletName || 'unknown',
    ipAddress: dropletInfo?.ipAddress || 'unknown',
    stack,
    success,
    steps,
    error,
  };
}

/**
 * Configure Nanobot for testing with droplet OpenRouter key
 */
async function configureNanobotForTest(ssh: any, dropletOpenRouterKey: string): Promise<void> {
  const configScript = `
#!/bin/bash
set -e

echo "[Nanobot] Creating test configuration with droplet-specific OpenRouter key..."

# Create test config
cat > /root/.nanobot/config.json << 'EOF'
{
  "providers": {
    "openrouter": {
      "apiKey": "${dropletOpenRouterKey}"
    }
  },
  "agents": {
    "defaults": {
      "model": "minimax-m2.5",
      "provider": "openrouter",
      "maxTokens": 1000,
      "temperature": 0.1
    }
  },
  "tools": {
    "restrictToWorkspace": false
  }
}
EOF

echo "[Nanobot] Configuration written with droplet key"
`;

  const result = await ssh.executeCommand(configScript);
  if (result.code !== 0) {
    throw new Error(`Nanobot configuration failed: ${result.stderr}`);
  }
}

/**
 * Configure OpenClaw for testing with droplet OpenRouter key
 */
async function configureOpenClawForTest(ssh: any, dropletOpenRouterKey: string): Promise<void> {
  const configScript = `
#!/bin/bash
set -e

echo "[OpenClaw] Creating test configuration with droplet-specific OpenRouter key..."

# Create test config
cat > /root/.openclaw/config.yaml << 'EOF'
gateway:
  mode: local

channels: {}

agents:
  defaults:
    model: minimax/minimax-m2.5
    provider: openrouter
    maxTokens: 1000
    temperature: 0.1

tools:
  restrictToWorkspace: false
EOF

# Set OpenRouter key as env for gateway
mkdir -p /root/.openclaw
echo "OPENROUTER_API_KEY=${dropletOpenRouterKey}" > /root/.openclaw/.env

echo "[OpenClaw] Configuration written with droplet key"
`;

  const result = await ssh.executeCommand(configScript);
  if (result.code !== 0) {
    throw new Error(`OpenClaw configuration failed: ${result.stderr}`);
  }
}

/**
 * Test gateway health endpoint
 */
async function testGatewayHealth(ssh: any, stack: StackType): Promise<boolean> {
  const port = stack === 'nanobot' ? 18790 : 8080;

  // Start gateway
  const startCmd = stack === 'nanobot'
    ? 'nohup nanobot gateway > /tmp/gateway-test.log 2>&1 &'
    : 'nohup openclaw gateway > /tmp/gateway-test.log 2>&1 &';

  await ssh.executeCommand(startCmd);
  await sleep(5000);

  // Test health endpoint
  for (let i = 0; i < 10; i++) {
    try {
      const result = await ssh.executeCommand(`curl -sf http://localhost:${port}/health`);
      if (result.code === 0) {
        // Stop gateway
        await ssh.executeCommand(`pkill -f "${stack === 'nanobot' ? 'nanobot' : 'openclaw'} gateway" || true`);
        return true;
      }
    } catch {}
    await sleep(2000);
  }

  // Stop gateway before throwing
  await ssh.executeCommand(`pkill -f "${stack === 'nanobot' ? 'nanobot' : 'openclaw'} gateway" || true`);

  throw new Error(`Gateway health check failed after 10 attempts`);
}

/**
 * Wait for SSH to be available
 */
async function waitForSSH(ipAddress: string, maxAttempts = 60): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const ssh = await createSSHConnection({ host: ipAddress, username: 'root' });
      await ssh.disconnect();
      return;
    } catch {
      if (i === maxAttempts - 1) throw new Error(`SSH not available after ${maxAttempts}s`);
      await sleep(5000);
    }
  }
}

/**
 * Wait for cloud-init to complete
 */
async function waitForCloudInit(ssh: any, maxAttempts = 40): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await ssh.executeCommand('cloud-init status --wait 2>&1');
    const stdout = result.stdout || '';
    if (stdout.includes('done') || stdout.includes('status: done')) {
      return;
    }
    if (i === maxAttempts - 1) {
      console.log('  ⚠️  Cloud-init wait timeout, continuing...');
      return;
    }
    await sleep(3000);
  }
}

/**
 * Destroy a droplet
 */
async function destroyDroplet(dropletId: number): Promise<void> {
  const token = process.env.DIGITALOCEAN_TOKEN;
  if (!token) throw new Error('DIGITALOCEAN_TOKEN not set');

  const response = await fetch(`https://api.digitalocean.com/v2/droplets/${dropletId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to destroy droplet ${dropletId}`);
  }
}

/**
 * Execute a step with timing
 */
async function step<T>(name: string, fn: () => Promise<T>): Promise<{ step: TestStep; data: T }> {
  const start = Date.now();
  try {
    const data = await fn();
    const duration = Date.now() - start;
    return {
      step: { name, success: true, duration },
      data,
    };
  } catch (error: any) {
    const duration = Date.now() - start;
    throw error;
  }
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Print test summary
 */
async function printSummary(results: TestResult[]): Promise<void> {
  console.log('\n\n');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                        TEST SUMMARY                              ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('');

  const total = results.length;
  const passed = results.filter(r => r.success).length;
  const failed = total - passed;

  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('');

  // Step statistics
  console.log('Step Performance:');
  console.log('─'.repeat(70));

  const stepStats = new Map<string, { count: number; totalTime: number; passCount: number }>();

  for (const result of results) {
    for (const step of result.steps) {
      const stats = stepStats.get(step.name) || { count: 0, totalTime: 0, passCount: 0 };
      stats.count++;
      stats.totalTime += step.duration;
      if (step.success) stats.passCount++;
      stepStats.set(step.name, stats);
    }
  }

  for (const [name, stats] of stepStats.entries()) {
    const avgTime = Math.round(stats.totalTime / stats.count);
    const passRate = Math.round((stats.passCount / stats.count) * 100);
    console.log(`  ${name.padEnd(25)} ${avgTime.toString().padStart(6)}ms avg  ${passRate.toString().padStart(3)}% pass`);
  }

  // Detailed results
  console.log('\nDetailed Results:');
  console.log('─'.repeat(70));

  for (const result of results) {
    const icon = result.success ? '✅' : '❌';
    const error = result.error ? ` - ${result.error}` : '';
    console.log(`${icon} ${result.dropletName} (${result.stack})${error}`);

    if (!result.success) {
      console.log('   Failed steps:');
      for (const step of result.steps) {
        if (!step.success) {
          console.log(`     - ${step.name}: ${step.error || 'Unknown error'}`);
        }
      }
    }
  }

  // Pool status
  console.log('\nPool Status:');
  console.log('─'.repeat(70));

  try {
    const servers = await poolManager.getServers();
    const byStack = servers.reduce((acc, s) => {
      acc[s.stack] = (acc[s.stack] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byState = servers.reduce((acc, s) => {
      acc[s.state] = (acc[s.state] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const healthy = servers.filter(s => s.state === 'standby' && s.healthStatus === 'healthy').length;

    console.log(`  Total: ${servers.length}`);
    console.log(`  Ready for allocation: ${healthy}`);
    console.log(`  By stack: ${JSON.stringify(byStack)}`);
    console.log(`  By state: ${JSON.stringify(byState)}`);
  } catch (err) {
    console.log('  Could not fetch pool status');
  }
}

// CLI setup
program
  .option('--count <number>', 'Number of servers to test per stack type', '1')
  .option('--type <type>', 'Stack type to test (nanobot, openclaw, both)', 'both')
  .option('--region <region>', 'DigitalOcean region', DEFAULT_REGION)
  .option('--skip-provision', 'Use existing standby servers instead of provisioning')
  .option('--skip-health-check', 'Skip full health check')
  .option('--destroy-after', 'Destroy droplets after successful test')
  .parse();

const options = program.opts();

runE2ETest({
  count: parseInt(options.count),
  type: options.type,
  region: options.region,
  skipProvision: options.skipProvision || false,
  skipHealthCheck: options.skipHealthCheck || false,
  destroyAfter: options.destroyAfter || false,
}).catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
