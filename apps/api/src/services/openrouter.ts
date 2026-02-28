import { redis } from '../lib/redis.js';

interface OpenRouterConfig {
  apiKey: string;
  limitCents: number;
  usageCents: number;
}

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
}

interface OpenRouterResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
}

interface TokenCost {
  promptCostPerMillion: number;
  completionCostPerMillion: number;
}

// OpenRouter pricing (base cost, we charge 1.5X)
const MODEL_PRICING: Record<string, TokenCost> = {
  'minimax/minimax-m2.5': {
    promptCostPerMillion: 30,
    completionCostPerMillion: 110,
  },
  'anthropic/claude-3.5-haiku': {
    promptCostPerMillion: 25,
    completionCostPerMillion: 125,
  },
  'anthropic/claude-sonnet-4': {
    promptCostPerMillion: 300,
    completionCostPerMillion: 1500,
  },
  'openai/gpt-4o': {
    promptCostPerMillion: 200,
    completionCostPerMillion: 800,
  },
  'google/gemini-2.0-flash-exp': {
    promptCostPerMillion: 10,
    completionCostPerMillion: 10,
  },
};

export class OpenRouterService {
  private baseUrl = 'https://openrouter.ai/api/v1';
  private masterKey: string;

  constructor() {
    this.masterKey = process.env.OPENROUTER_API_KEY || '';
    if (!this.masterKey) {
      console.warn('[OpenRouter] No OPENROUTER_API_KEY configured');
    }
  }

  /**
   * Create a unique OpenRouter API key for a droplet
   * Format: "or-mini-{dropletId}-{uuid}"
   */
  async createDropletKey(dropletId: number): Promise<string> {
    const keyId = crypto.randomUUID().split('-')[0];
    const dropletKey = `or-mini-${dropletId}-${keyId}`;

    // Store key metadata in Redis
    const config: OpenRouterConfig = {
      apiKey: dropletKey,
      limitCents: 2500, // $25.00 default limit
      usageCents: 0,
    };

    await redis.hset(`openrouter:keys`, dropletKey, JSON.stringify(config));
    await redis.set(`openrouter:droplet:${dropletId}`, dropletKey);

    console.log(`[OpenRouter] Created key for droplet ${dropletId}: ${dropletKey}`);
    return dropletKey;
  }

  /**
   * Get the OpenRouter key for a droplet
   */
  async getDropletKey(dropletId: number): Promise<string | null> {
    const key = await redis.get(`openrouter:droplet:${dropletId}`);
    return key;
  }

  /**
   * Get usage stats for a droplet's OpenRouter key
   */
  async getDropletUsage(dropletId: number): Promise<{ limitCents: number; usageCents: number; percentage: number } | null> {
    const key = await this.getDropletKey(dropletId);
    if (!key) return null;

    const configStr = await redis.hget(`openrouter:keys`, key);
    if (!configStr) return null;

    const config: OpenRouterConfig = JSON.parse(configStr);
    const percentage = (config.usageCents / config.limitCents) * 100;

    return {
      limitCents: config.limitCents,
      usageCents: config.usageCents,
      percentage: Math.min(percentage, 100),
    };
  }

  /**
   * Update usage for a droplet's OpenRouter key
   */
  private async updateUsage(key: string, additionalCents: number): Promise<void> {
    const configStr = await redis.hget(`openrouter:keys`, key);
    if (!configStr) return;

    const config: OpenRouterConfig = JSON.parse(configStr);
    config.usageCents += additionalCents;

    await redis.hset(`openrouter:keys`, key, JSON.stringify(config));

    // Check if we need to send warnings
    const percentage = (config.usageCents / config.limitCents) * 100;

    if (percentage >= 80 && percentage < 82) {
      // 80% warning - send once
      console.warn(`[OpenRouter] Key ${key} at 80% usage ($${config.usageCents / 100} / $${config.limitCents / 100})`);
      // TODO: Send notification to user
    } else if (percentage >= 100) {
      // 100% - pause usage
      console.error(`[OpenRouter] Key ${key} exceeded limit ($${config.usageCents / 100} / $${config.limitCents / 100})`);
      // TODO: Pause droplet API access
    }
  }

  /**
   * Calculate token cost in cents
   */
  private calculateCost(model: string, promptTokens: number, completionTokens: number): number {
    const pricing = MODEL_PRICING[model];
    if (!pricing) {
      console.warn(`[OpenRouter] No pricing found for model ${model}, using default`);
      return 0;
    }

    const promptCost = (promptTokens / 1_000_000) * pricing.promptCostPerMillion;
    const completionCost = (completionTokens / 1_000_000) * pricing.completionCostPerMillion;

    // We charge 1.5X OpenRouter's base pricing
    const totalCost = (promptCost + completionCost) * 1.5;

    return Math.ceil(totalCost * 100); // Convert to cents
  }

  /**
   * Verify a droplet key is valid
   */
  async verifyKey(key: string): Promise<boolean> {
    const configStr = await redis.hget(`openrouter:keys`, key);
    return !!configStr;
  }

  /**
   * Check if a droplet key has exceeded its limit
   */
  async isKeyLimited(key: string): Promise<boolean> {
    const configStr = await redis.hget(`openrouter:keys`, key);
    if (!configStr) return true; // Unknown keys are rejected

    const config: OpenRouterConfig = JSON.parse(configStr);
    return config.usageCents >= config.limitCents;
  }

  /**
   * Proxy chat completion request to OpenRouter
   * Extracts droplet key from Authorization header, forwards to OpenRouter with master key
   */
  async chatCompletion(
    request: OpenRouterRequest,
    dropletKey: string
  ): Promise<OpenRouterResponse> {
    // Verify key exists
    const configStr = await redis.hget(`openrouter:keys`, dropletKey);
    if (!configStr) {
      throw new Error('Invalid API key');
    }

    const config: OpenRouterConfig = JSON.parse(configStr);

    // Check if key has exceeded limit
    if (config.usageCents >= config.limitCents) {
      throw new Error('API key limit exceeded. Please top up your tokens.');
    }

    try {
      // Forward request to OpenRouter with master key
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.masterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://miniclaw.cc',
          'X-Title': 'MiniClaw-CC',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenRouter error: ${error}`);
      }

      const data: OpenRouterResponse = await response.json();

      // Calculate and update usage
      if (data.usage) {
        const costCents = this.calculateCost(
          request.model,
          data.usage.prompt_tokens,
          data.usage.completion_tokens
        );

        await this.updateUsage(dropletKey, costCents);

        console.log(`[OpenRouter] Model: ${request.model}, Tokens: ${data.usage.total_tokens}, Cost: $${costCents / 100}`);
      }

      return data;
    } catch (error) {
      console.error('[OpenRouter] Chat completion error:', error);
      throw error;
    }
  }

  /**
   * Add token credit to a droplet's key
   */
  async addCredit(dropletId: number, creditCents: number): Promise<void> {
    const key = await this.getDropletKey(dropletId);
    if (!key) {
      throw new Error('Droplet key not found');
    }

    const configStr = await redis.hget(`openrouter:keys`, key);
    if (!configStr) {
      throw new Error('Key config not found');
    }

    const config: OpenRouterConfig = JSON.parse(configStr);
    config.limitCents += creditCents;

    await redis.hset(`openrouter:keys`, key, JSON.stringify(config));

    console.log(`[OpenRouter] Added $${creditCents / 100} credit to droplet ${dropletId}, new limit: $${config.limitCents / 100}`);
  }

  /**
   * Reset droplet usage (for monthly resets)
   */
  async resetUsage(dropletId: number): Promise<void> {
    const key = await this.getDropletKey(dropletId);
    if (!key) return;

    const configStr = await redis.hget(`openrouter:keys`, key);
    if (!configStr) return;

    const config: OpenRouterConfig = JSON.parse(configStr);
    config.usageCents = 0;

    await redis.hset(`openrouter:keys`, key, JSON.stringify(config));

    console.log(`[OpenRouter] Reset usage for droplet ${dropletId}`);
  }

  /**
   * Get all keys for monitoring
   */
  async getAllKeys(): Promise<Array<{ key: string; config: OpenRouterConfig }>> {
    const keys = await redis.hgetall(`openrouter:keys`);
    return Object.entries(keys).map(([key, configStr]) => ({
      key,
      config: JSON.parse(configStr) as OpenRouterConfig,
    }));
  }

  /**
   * Revoke a droplet's OpenRouter key (for deallocation)
   * Removes the key from Redis, making it invalid
   */
  async revokeDropletKey(dropletId: number): Promise<boolean> {
    try {
      // Get the key for this droplet
      const key = await this.getDropletKey(dropletId);
      if (!key) {
        console.log(`[OpenRouter] No key found for droplet ${dropletId}, skipping revocation`);
        return false;
      }

      // Remove from both storage locations
      await redis.del(`openrouter:droplet:${dropletId}`);
      await redis.hdel(`openrouter:keys`, key);

      console.log(`[OpenRouter] Revoked key ${key} for droplet ${dropletId}`);
      return true;
    } catch (error) {
      console.error(`[OpenRouter] Failed to revoke key for droplet ${dropletId}:`, error);
      return false;
    }
  }
}

export const openrouterService = new OpenRouterService();
