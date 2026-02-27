import 'dotenv/config';
import { NodeSSH } from 'node-ssh';
import { nanobotService } from '../src/services/nanobot.js';

async function testNewPoolDroplet() {
  const dropletIP = '64.227.30.109'; // pool-nanobot-nyc1-5003-mm5d2y6j-n67z

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Testing Nanobot Installation on New Pool Droplet');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Droplet IP: ${dropletIP}`);
  console.log('');

  try {
    const result = await nanobotService.install({
      ipAddress: dropletIP,
      version: '0.1.3.post7',
    });

    if (result.success) {
      console.log('✅ Installation successful!');

      // Verify
      const verifyResult = await nanobotService.verify(dropletIP);
      console.log(`  ┌─ Installed: ${verifyResult.installed ? 'Yes' : 'No'}`);
      console.log(`  ├─ Gateway Running: ${verifyResult.gatewayRunning ? 'Yes' : 'No'}`);
      console.log(`  └─ Version: ${verifyResult.version || 'Unknown'}`);

      // Configure with test bot token
      console.log('');
      console.log('Configuring Telegram with test bot...');
      const ssh = new NodeSSH();
      await ssh.connect({
        host: dropletIP,
        username: 'root',
        privateKey: require('fs').readFileSync(process.env.SSH_PRIVATE_KEY_PATH!, 'utf8'),
        readyTimeout: 30000,
      });

      const config = {
        providers: {
          openrouter: {
            apiKey: process.env.OPENROUTER_API_KEY!
          }
        },
        agents: {
          defaults: {
            model: 'anthropic/claude-opus-4-5',
            provider: 'openrouter',
            maxTokens: 8192,
            temperature: 0.1
          }
        },
        channels: {
          telegram: {
            enabled: true,
            token: '8246746597:AAF9nukaHujNrC48Tj95I0jTF44MnSfIKbg',
            allowFrom: []
          }
        },
        tools: {
          restrictToWorkspace: false
        }
      };

      await ssh.writeFile('/root/.nanobot/config.json', JSON.stringify(config, null, 2));
      await ssh.executeCommand('pkill -f "nanobot gateway" || true');
      await ssh.executeCommand('sleep 2');
      await ssh.executeCommand('nohup nanobot gateway > /tmp/nanobot-gateway.log 2>&1 &');
      await ssh.executeCommand('sleep 4');

      const ps = await ssh.executeCommand('ps aux | grep "[n]anobot gateway"');
      if (ps.trim()) {
        console.log('✅ Gateway restarted successfully!');
      } else {
        console.log('❌ Gateway failed to start');
        const logs = await ssh.executeCommand('tail -30 /tmp/nanobot-gateway.log');
        console.log('Logs:', logs);
      }

      ssh.dispose();
    } else {
      console.log(`❌ Installation failed: ${result.error}`);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testNewPoolDroplet().catch(console.error);
