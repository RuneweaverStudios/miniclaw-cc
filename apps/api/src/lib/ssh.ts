import { NodeSSH } from 'node-ssh';

export interface SSHConfig {
  host: string;
  port?: number;
  username?: string;
  privateKey?: string;
  password?: string;
  readyTimeout?: number; // Connection timeout in milliseconds
}

export class SSHClient {
  private ssh: NodeSSH;

  constructor() {
    this.ssh = new NodeSSH();
  }

  async connect(config: SSHConfig): Promise<void> {
    // Load SSH key from file if not provided directly
    let privateKey = config.privateKey;

    if (!privateKey && process.env.SSH_PRIVATE_KEY) {
      privateKey = process.env.SSH_PRIVATE_KEY;
    } else if (!privateKey && process.env.SSH_PRIVATE_KEY_PATH) {
      try {
        const fs = await import('fs');
        privateKey = fs.readFileSync(process.env.SSH_PRIVATE_KEY_PATH, 'utf8');
      } catch (err) {
        console.error('[SSH] Failed to read SSH key from file:', err);
      }
    }

    await this.ssh.connect({
      host: config.host,
      port: config.port || 22,
      username: config.username || 'root',
      privateKey,
      password: config.password,
      readyTimeout: config.readyTimeout || 30000,
    });
  }

  async executeCommand(command: string): Promise<string> {
    const result = await this.ssh.execCommand(command);
    if (result.stderr && !result.stdout) {
      throw new Error(result.stderr);
    }
    return result.stdout;
  }

  async executeCommandWithOutput(command: string): Promise<{
    stdout: string;
    stderr: string;
    code: number | null;
  }> {
    const result = await this.ssh.execCommand(command);
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      code: result.code || null,
    };
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      const result = await this.executeCommand(`test -f ${filePath} && echo "exists"`);
      return result.trim() === 'exists';
    } catch {
      return false;
    }
  }

  async readFile(filePath: string): Promise<string> {
    return this.executeCommand(`cat ${filePath}`);
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    const escapedContent = content.replace(/'/g, "'\\''");
    await this.executeCommand(`cat > ${filePath} << 'EOF'\n${escapedContent}\nEOF`);
  }

  async mkdir(dirPath: string, recursive = true): Promise<void> {
    const flag = recursive ? '-p' : '';
    await this.executeCommand(`mkdir ${flag} ${dirPath}`);
  }

  async downloadFile(remotePath: string, localPath: string): Promise<void> {
    await this.ssh.getFile(localPath, remotePath);
  }

  async uploadFile(localPath: string, remotePath: string): Promise<void> {
    await this.ssh.putFile(localPath, remotePath);
  }

  async getSystemInfo(): Promise<{
    hostname: string;
    os: string;
    kernel: string;
    uptime: string;
    memory: {
      total: string;
      used: string;
      free: string;
    };
    disk: {
      total: string;
      used: string;
      available: string;
    };
  }> {
    const [hostname, os, kernel, uptime, memory, disk] = await Promise.all([
      this.executeCommand('hostname'),
      this.executeCommand('cat /etc/os-release | grep PRETTY_NAME | cut -d= -f2 | tr -d \'"\''),
      this.executeCommand('uname -r'),
      this.executeCommand('uptime -p'),
      this.executeCommand('free -h | grep Mem'),
      this.executeCommand('df -h / | tail -1'),
    ]);

    return {
      hostname: hostname.trim(),
      os: os.trim(),
      kernel: kernel.trim(),
      uptime: uptime.trim(),
      memory: this.parseMemory(memory),
      disk: this.parseDisk(disk),
    };
  }

  async getServiceStatus(serviceName: string): Promise<{
    active: boolean;
    enabled: boolean;
    status: string;
  }> {
    try {
      const isActive = await this.executeCommand(`systemctl is-active ${serviceName}`);
      const isEnabled = await this.executeCommand(`systemctl is-enabled ${serviceName}`);
      const status = await this.executeCommand(`systemctl status ${serviceName} --no-pager`);

      return {
        active: isActive.trim() === 'active',
        enabled: isEnabled.trim() === 'enabled',
        status: status.trim(),
      };
    } catch (error) {
      return {
        active: false,
        enabled: false,
        status: 'unknown',
      };
    }
  }

  async restartService(serviceName: string): Promise<void> {
    await this.executeCommand(`systemctl restart ${serviceName}`);
  }

  async stopService(serviceName: string): Promise<void> {
    await this.executeCommand(`systemctl stop ${serviceName}`);
  }

  async startService(serviceName: string): Promise<void> {
    await this.executeCommand(`systemctl start ${serviceName}`);
  }

  async getDockerContainers(): Promise<Array<{
    id: string;
    name: string;
    status: string;
    image: string;
  }>> {
    const output = await this.executeCommand(
      'docker ps --format "{{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Image}}"'
    );

    return output.split('\n')
      .filter(Boolean)
      .map(line => {
        const [id, name, status, image] = line.split('\t');
        return { id, name, status, image };
      });
  }

  async getDockerLogs(containerName: string, tail = 100): Promise<string> {
    return this.executeCommand(`docker logs --tail ${tail} ${containerName}`);
  }

  async disconnect(): Promise<void> {
    await this.ssh.dispose();
  }

  private parseMemory(output: string): { total: string; used: string; free: string } {
    const parts = output.split(/\s+/);
    return {
      total: parts[1],
      used: parts[2],
      free: parts[3],
    };
  }

  private parseDisk(output: string): { total: string; used: string; available: string } {
    const parts = output.split(/\s+/);
    return {
      total: parts[1],
      used: parts[2],
      available: parts[3],
    };
  }
}

export async function createSSHConnection(config: SSHConfig): Promise<SSHClient> {
  const client = new SSHClient();
  await client.connect(config);
  return client;
}
