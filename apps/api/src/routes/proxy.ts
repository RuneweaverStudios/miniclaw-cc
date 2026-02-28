import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { openrouterService } from '../services/openrouter.js';

const proxyRoutes = new Hono();

// Schema for OpenRouter chat completion
const chatSchema = z.object({
  model: z.string(),
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string(),
  })),
  stream: z.boolean().optional(),
  temperature: z.number().optional(),
  max_tokens: z.number().optional(),
  top_p: z.number().optional(),
});

/**
 * POST /api/proxy/chat
 *
 * Proxy endpoint for OpenRouter chat completions.
 * Droplets use their per-droplet API key in the Authorization header.
 * We verify the key, track usage, and forward to OpenRouter with our master key.
 *
 * Headers:
 *   Authorization: Bearer or-mini-{dropletId}-{uuid}
 *
 * Body: OpenRouter chat completion request
 *
 * Response: OpenRouter chat completion response
 */
proxyRoutes.post('/chat', zValidator('json', chatSchema), async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) {
    return c.json({ error: 'Missing Authorization header' }, 401);
  }

  // Extract droplet key
  const dropletKey = authHeader.replace('Bearer ', '');

  // Verify key format
  if (!dropletKey.startsWith('or-mini-')) {
    return c.json({ error: 'Invalid API key format' }, 401);
  }

  // Check if key exists in our system
  const isValid = await openrouterService.verifyKey(dropletKey);
  if (!isValid) {
    return c.json({ error: 'Invalid API key' }, 401);
  }

  // Check if key has exceeded limit
  const isLimited = await openrouterService.isKeyLimited(dropletKey);
  if (isLimited) {
    return c.json({
      error: 'Token limit exceeded. Please top up your tokens.',
      usage: await openrouterService.getDropletUsage(
        parseInt(dropletKey.split('-')[2])
      ),
    }, 402);
  }

  const requestBody = c.req.valid('json');

  try {
    // Forward to OpenRouter with master key
    const response = await openrouterService.chatCompletion(requestBody, dropletKey);

    return c.json(response);
  } catch (error) {
    console.error('[Proxy] Chat completion error:', error);
    return c.json({
      error: error instanceof Error ? error.message : 'Failed to complete chat',
    }, 500);
  }
});

/**
 * GET /api/proxy/usage/:dropletId
 *
 * Get token usage stats for a droplet
 */
proxyRoutes.get('/usage/:dropletId', async (c) => {
  const dropletId = parseInt(c.req.param('dropletId'));
  if (isNaN(dropletId)) {
    return c.json({ error: 'Invalid droplet ID' }, 400);
  }

  const usage = await openrouterService.getDropletUsage(dropletId);

  if (!usage) {
    return c.json({ error: 'Droplet not found' }, 404);
  }

  return c.json({
    dropletId,
    usage: {
      limitCents: usage.limitCents,
      usageCents: usage.usageCents,
      limitDollars: usage.limitCents / 100,
      usageDollars: usage.usageCents / 100,
      percentage: usage.percentage,
      remainingCents: Math.max(0, usage.limitCents - usage.usageCents),
      remainingDollars: Math.max(0, usage.limitCents - usage.usageCents) / 100,
    },
  });
});

/**
 * POST /api/proxy/topup
 *
 * Purchase token top-up for a droplet
 */
const topupSchema = z.object({
  dropletId: z.number(),
  amount: z.enum(['10', '25', '50', '100']), // Dollar amounts
  stripePaymentId: z.string().optional(),
});

proxyRoutes.post('/topup', zValidator('json', topupSchema), async (c) => {
  const { dropletId, amount } = c.req.valid('json');

  // Convert dollars to cents
  const creditCents = parseInt(amount) * 100;

  try {
    await openrouterService.addCredit(dropletId, creditCents);

    return c.json({
      success: true,
      dropletId,
      creditDollars: amount,
      message: `Added $${amount} token credit to droplet ${dropletId}`,
    });
  } catch (error) {
    console.error('[Proxy] Top-up error:', error);
    return c.json({
      error: error instanceof Error ? error.message : 'Failed to add credit',
    }, 500);
  }
});

export { proxyRoutes };
