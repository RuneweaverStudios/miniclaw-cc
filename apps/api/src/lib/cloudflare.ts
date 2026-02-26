import axios, { type AxiosInstance } from 'axios';

export interface DNSRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied: boolean;
  ttl: number;
  created_on: string;
  modified_on: string;
}

export interface CreateDNSRecordOptions {
  type: 'A' | 'CNAME' | 'TXT' | 'MX';
  name: string;
  content: string;
  ttl?: number;
  proxied?: boolean;
  priority?: number;
}

export class CloudflareClient {
  private client: AxiosInstance;
  private zoneId: string;

  constructor(apiToken: string, zoneId: string) {
    this.zoneId = zoneId;
    this.client = axios.create({
      baseURL: 'https://api.cloudflare.com/client/v4',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async listDNSRecords(type?: string, name?: string): Promise<DNSRecord[]> {
    const params: Record<string, string> = {};
    if (type) params.type = type;
    if (name) params.name = name;

    const response = await this.client.get(
      `/zones/${this.zoneId}/dns_records`,
      { params }
    );
    return response.data.result;
  }

  async getDNSRecord(recordId: string): Promise<DNSRecord> {
    const response = await this.client.get(
      `/zones/${this.zoneId}/dns_records/${recordId}`
    );
    return response.data.result;
  }

  async createDNSRecord(options: CreateDNSRecordOptions): Promise<DNSRecord> {
    const response = await this.client.post(
      `/zones/${this.zoneId}/dns_records`,
      options
    );
    return response.data.result;
  }

  async updateDNSRecord(
    recordId: string,
    options: Partial<CreateDNSRecordOptions>
  ): Promise<DNSRecord> {
    const response = await this.client.put(
      `/zones/${this.zoneId}/dns_records/${recordId}`,
      options
    );
    return response.data.result;
  }

  async deleteDNSRecord(recordId: string): Promise<void> {
    await this.client.delete(
      `/zones/${this.zoneId}/dns_records/${recordId}`
    );
  }

  async createSubdomain(subdomain: string, ipAddress: string): Promise<DNSRecord> {
    return this.createDNSRecord({
      type: 'A',
      name: subdomain,
      content: ipAddress,
      ttl: 300,
      proxied: true,
    });
  }

  async deleteSubdomain(subdomain: string): Promise<void> {
    const records = await this.listDNSRecords('A', subdomain);
    for (const record of records) {
      await this.deleteDNSRecord(record.id);
    }
  }
}

let cfClient: CloudflareClient | null = null;

export function getCFClient(): CloudflareClient {
  if (!cfClient) {
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;
    const zoneId = process.env.CLOUDFLARE_ZONE_ID;

    if (!apiToken || !zoneId) {
      throw new Error(
        'CLOUDFLARE_API_TOKEN or CLOUDFLARE_ZONE_ID environment variable is not set'
      );
    }

    cfClient = new CloudflareClient(apiToken, zoneId);
  }

  return cfClient;
}
