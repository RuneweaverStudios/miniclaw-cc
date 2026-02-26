import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';

const billingRoutes = new Hono();

// Apply auth middleware to all routes
billingRoutes.use('*', authMiddleware);

// GET /api/billing/subscription - Get user's subscription
billingRoutes.get('/subscription', async (c) => {
  const user = c.get('user');

  // TODO: Implement getting subscription
  // - Fetch from database
  // - Include plan details, usage, limits

  return c.json({
    message: 'Subscription details not yet implemented',
    userId: user.userId,
    subscription: null,
  });
});

// POST /api/billing/checkout - Create checkout session
const checkoutSchema = z.object({
  plan: z.enum(['pro', 'enterprise']),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

billingRoutes.post('/checkout', zValidator('json', checkoutSchema), async (c) => {
  const user = c.get('user');
  const { plan, successUrl, cancelUrl } = c.req.valid('json');

  // TODO: Implement checkout session creation
  // - Create Stripe checkout session
  // - Set up success/cancel handlers
  // - Return checkout URL

  return c.json({
    message: 'Checkout session not yet implemented',
    userId: user.userId,
    plan,
  });
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
  newPlan: z.enum(['pro', 'enterprise']),
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
