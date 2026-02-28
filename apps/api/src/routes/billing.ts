import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import Stripe from 'stripe';
import { allocator } from '../services/allocator.js';

// Extend JWTPayload for user metadata
declare module 'hono' {
  interface ContextVariableMap {
    user: {
      userId: string;
      email: string;
      name?: string;
      metadata?: {
        stripeCustomerId?: string;
        plan?: string;
      };
    };
  }
}

const billingRoutes = new Hono();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-01-27.acacia',
});

// Stripe price IDs (you'll need to create these in Stripe Dashboard)
const STRIPE_PRICES = {
  free: 'price_free_trial', // Will create in Stripe
  basic: 'price_basic_monthly',
  pro: 'price_pro_monthly',
} as const;

// Apply auth middleware to all routes
billingRoutes.use('*', authMiddleware);

// GET /api/billing/subscription - Get user's subscription
billingRoutes.get('/subscription', async (c) => {
  const user = c.get('user');

  // TODO: Fetch from database
  return c.json({
    userId: user.userId,
    subscription: null,
  });
});

// POST /api/billing/checkout - Create checkout session
const checkoutSchema = z.object({
  plan: z.enum(['nanobot', 'openclaw']),
  framework: z.string(),
  model: z.string(),
  channel: z.string(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

billingRoutes.post('/checkout', zValidator('json', checkoutSchema), async (c) => {
  const user = c.get('user');
  const { plan, framework, model, channel, successUrl, cancelUrl } = c.req.valid('json');

  try {
    // Get or create Stripe customer
    let customerId = user.metadata?.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          userId: user.userId,
          framework,
          model,
          channel,
          plan,
        },
      });
      customerId = customer.id;
    }

    // Determine price
    let amount = 0;

    switch (plan) {
      case 'nanobot':
        amount = 3900; // $39.00
        break;
      case 'openclaw':
        amount = 5900; // $59.00
        break;
    }

    // Create checkout session
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      mode: 'payment',
      success_url: successUrl || `${process.env.PUBLIC_URL || 'http://localhost:5173'}/checkout/success`,
      cancel_url: cancelUrl || `${process.env.PUBLIC_URL || 'http://localhost:5173'}/checkout`,
      metadata: {
        userId: user.userId,
        plan,
        framework,
        model,
        channel,
      },
    };

    // Add line item for paid plans
    sessionParams.line_items = [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan - $${(amount / 100).toFixed(0)}/month`,
            description: `${plan === 'nanobot' ? 'Nanobot' : 'OpenClaw'} monthly subscription with $25 token credit - Miniclaw AI Assistant`,
          },
          unit_amount: amount,
        },
        quantity: 1,
      },
    ];

    const session = await stripe.checkout.sessions.create(sessionParams);

    return c.json({
      checkoutUrl: session.url,
    });
  } catch (error) {
    console.error('Checkout error:', error);
    return c.json({ error: 'Failed to create checkout session' }, 500);
  }
});

// POST /api/billing/checkout-success - Process successful checkout
const checkoutSuccessSchema = z.object({
  sessionId: z.string().optional(),
  plan: z.string().optional(),
  framework: z.string().optional(),
  model: z.string().optional(),
  channel: z.string().optional(),
});

billingRoutes.post('/checkout-success', zValidator('json', checkoutSuccessSchema), async (c) => {
  const user = c.get('user');
  const { sessionId, plan, framework, model, channel } = c.req.valid('json');

  try {
    // Get selections from request body (sent from frontend localStorage)
    const selectedFramework = framework || 'nanobot';
    const selectedModel = model || 'minimax/minimax-m2.5';
    const selectedChannel = channel || 'telegram';
    const selectedPlan = plan || 'nanobot';

    // Allocate server from pool
    const allocation = await allocator.allocate({
      stack: selectedFramework as 'nanobot' | 'openclaw',
      region: 'nyc1',
      userId: user.userId,
      model: selectedModel, // Pass selected model to allocator
    });

    if (!allocation.success) {
      return c.json({
        error: 'Failed to allocate server',
        reason: allocation.reason,
      }, 500);
    }

    // TODO: Store allocation in database
    // TODO: Store subscription in database
    // TODO: Send deployment confirmation

    // Format server response for frontend consumption
    const serverResponse = {
      dropletId: allocation.server.dropletId,
      dropletName: allocation.server.dropletName,
      name: allocation.server.dropletName,
      ipAddress: allocation.server.ipAddress,
      status: 'ready' as const,
      stack: allocation.server.stack,
      framework: allocation.server.stack,
      region: allocation.server.region,
      size: allocation.server.size,
      sshPort: allocation.server.sshPort || 22,
      state: allocation.server.state,
      healthStatus: allocation.server.healthStatus,
      allocatedTo: allocation.server.allocatedTo,
      openrouterKey: allocation.server.config?.openrouterKey || '',
      model: selectedModel,
      channel: selectedChannel,
    };

    return c.json({
      server: serverResponse,
      subscription: {
        plan: selectedPlan,
        framework: selectedFramework,
        model: selectedModel,
        channel: selectedChannel,
      },
    });
  } catch (error) {
    console.error('Checkout success error:', error);
    return c.json({ error: 'Failed to process checkout' }, 500);
  }
});

// POST /api/billing/portal - Create customer portal session
billingRoutes.post('/portal', async (c) => {
  const user = c.get('user');

  // TODO: Implement customer portal
  // - Create Stripe portal session
  // - Return portal URL

  return c.json({
    message: 'Customer portal not yet implemented',
    userId: user.userId,
  });
});

// GET /api/billing/invoices - List user's invoices
billingRoutes.get('/invoices', async (c) => {
  const user = c.get('user');

  // TODO: Implement invoice listing
  // - Fetch from database or Stripe
  // - Support pagination

  return c.json({
    message: 'Invoice listing not yet implemented',
    userId: user.userId,
    invoices: [],
  });
});

// GET /api/billing/invoices/:invoiceId - Get specific invoice
billingRoutes.get('/invoices/:invoiceId', async (c) => {
  const invoiceId = c.req.param('invoiceId');
  const user = c.get('user');

  // TODO: Implement getting invoice details
  // - Verify ownership
  // - Return invoice PDF URL

  return c.json({
    message: 'Invoice details not yet implemented',
    invoiceId,
    userId: user.userId,
  });
});

// POST /api/billing/subscription/cancel - Cancel subscription
billingRoutes.post('/subscription/cancel', async (c) => {
  const user = c.get('user');

  // TODO: Implement subscription cancellation
  // - Update in Stripe
  // - Set cancel_at_period_end
  // - Update database

  return c.json({
    message: 'Subscription cancellation not yet implemented',
    userId: user.userId,
  });
});

// POST /api/billing/subscription/renew - Renew cancelled subscription
billingRoutes.post('/subscription/renew', async (c) => {
  const user = c.get('user');

  // TODO: Implement subscription renewal
  // - Remove cancel_at_period_end flag
  // - Update Stripe

  return c.json({
    message: 'Subscription renewal not yet implemented',
    userId: user.userId,
  });
});

// PUT /api/billing/subscription/plan - Change plan
const changePlanSchema = z.object({
  newPlan: z.enum(['nanobot', 'openclaw']),
});

billingRoutes.put('/subscription/plan', zValidator('json', changePlanSchema), async (c) => {
  const user = c.get('user');
  const { newPlan } = c.req.valid('json');

  // TODO: Implement plan change
  // - Create Stripe subscription update
  // - Prorate if needed
  // - Update database

  return c.json({
    message: 'Plan change not yet implemented',
    userId: user.userId,
    newPlan,
  });
});

// GET /api/billing/usage - Get usage statistics
billingRoutes.get('/usage', async (c) => {
  const user = c.get('user');

  // TODO: Implement usage statistics
  // - Server allocations used/total
  // - Bandwidth usage
  // - Storage usage
  // - Other metrics

  return c.json({
    message: 'Usage statistics not yet implemented',
    userId: user.userId,
    usage: {},
  });
});

export { billingRoutes };
