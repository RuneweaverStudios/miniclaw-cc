import axios, { type AxiosInstance } from 'axios';

export interface DigitalOceanDroplet {
  id: number;
  name: string;
  status: string;
  region: {
    slug: string;
    name: string;
  };
  size: {
    slug: string;
    memory: number;
    vcpus: number;
    disk: number;
  };
  image: {
    slug: string;
    name: string;
  };
  networks: {
    v4: Array<{
      ip_address: string;
      type: string;
    }>;
  };
  features: string[];
  tags: string[];
  created_at: string;
}

export interface CreateDropletOptions {
  name: string;
  region: string;
  size: string;
  image: string;
  ssh_keys?: number[];
  tags?: string[];
  backups?: boolean;
  monitoring?: boolean;
}

export class DigitalOceanClient {
  private client: AxiosInstance;

  constructor(apiToken: string) {
    this.client = axios.create({
      baseURL: 'https://api.digitalocean.com/v2',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async listDroplets(tag?: string): Promise<DigitalOceanDroplet[]> {
    const params = tag ? { tag_name: tag } : {};
    const response = await this.client.get('/droplets', { params });
    return response.data.droplets;
  }

  async getDroplet(dropletId: number): Promise<DigitalOceanDroplet> {
    const response = await this.client.get(`/droplets/${dropletId}`);
    return response.data.droplet;
  }

  async createDroplet(options: CreateDropletOptions): Promise<DigitalOceanDroplet> {
    const response = await this.client.post('/droplets', options);
    return response.data.droplet;
  }

  async deleteDroplet(dropletId: number): Promise<void> {
    await this.client.delete(`/droplets/${dropletId}`);
  }

  async rebootDroplet(dropletId: number): Promise<void> {
    await this.client.post(`/droplets/${dropletId}/actions`, {
      type: 'reboot',
    });
  }

  async powerOffDroplet(dropletId: number): Promise<void> {
    await this.client.post(`/droplets/${dropletId}/actions`, {
      type: 'power_off',
    });
  }

  async powerOnDroplet(dropletId: number): Promise<void> {
    await this.client.post(`/droplets/${dropletId}/actions`, {
      type: 'power_on',
    });
  }

  async getDropletSnapshots(dropletId: number): Promise<any[]> {
    const response = await this.client.get(`/droplets/${dropletId}/snapshots`);
    return response.data.snapshots;
  }

  async createSnapshot(dropletId: number, name: string): Promise<void> {
    await this.client.post(`/droplets/${dropletId}/snapshots`, { name });
  }

  async getDropletBackups(dropletId: number): Promise<any[]> {
    const response = await this.client.get(`/droplets/${dropletId}/backups`);
    return response.data.backups;
 }

  async getRegions(): Promise<any[]> {
    const response = await this.client.get('/regions');
    return response.data.regions;
  }

  async getSizes(): Promise<any[]> {
    const response = await this.client.get('/sizes');
    return response.data.sizes;
  }

  async getImages(type?: string): Promise<any[]> {
    const params = type ? { type } : {};
    const response = await this.client.get('/images', { params });
    return response.data.images;
  }
}

let doClient: DigitalOceanClient | null = null;

export function getDOClient(): DigitalOceanClient {
  if (!doClient) {
    const apiToken = process.env.DIGITALOCEAN_TOKEN;
    if (!apiToken) {
      throw new Error('DIGITALOCEAN_TOKEN environment variable is not set');
    }
    doClient = new DigitalOceanClient(apiToken);
  }
  return doClient;
}
