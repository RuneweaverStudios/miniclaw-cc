import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb } from '../lib/db/index.js';
import { users } from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';
import * as authService from '../services/auth.js';

const userRoutes = new Hono();

userRoutes.use('*', authMiddleware);

const profileSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

// PATCH /api/user/profile - Update profile (name, email)
userRoutes.patch('/profile', zValidator('json', profileSchema), async (c) => {
  const { userId } = c.get('user');
  const body = c.req.valid('json');

  const db = getDb();

  // If email is being changed, check it's not taken
  if (body.email) {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, body.email))
      .limit(1);
    if (existing.length > 0 && existing[0].id !== userId) {
      return c.json({ error: { message: 'Email already in use' } }, 409);
    }
  }

  const update: { name?: string; email?: string } = {};
  if (body.name !== undefined) update.name = body.name;
  if (body.email !== undefined) update.email = body.email;

  if (Object.keys(update).length === 0) {
    return c.json({ message: 'No changes', user: null }, 200);
  }

  const result = await db
    .update(users)
    .set(update)
    .where(eq(users.id, userId))
    .returning();

  if (result.length === 0) {
    return c.json({ error: { message: 'User not found' } }, 404);
  }

  const user = result[0];
  return c.json({
    message: 'Profile updated',
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
    },
  });
});

// POST /api/user/password - Change password
userRoutes.post('/password', zValidator('json', passwordSchema), async (c) => {
  const { userId } = c.get('user');
  const { currentPassword, newPassword } = c.req.valid('json');

  const db = getDb();
  const found = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (found.length === 0) {
    return c.json({ error: { message: 'User not found' } }, 404);
  }

  const user = found[0];
  if (!user.passwordHash) {
    return c.json(
      { error: { message: 'Account uses social login; set a password in your provider settings' } },
      400
    );
  }

  const valid = await authService.verifyPassword(currentPassword, user.passwordHash);
  if (!valid) {
    return c.json({ error: { message: 'Current password is incorrect' } }, 401);
  }

  const passwordHash = await authService.hashPassword(newPassword);
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));

  return c.json({ message: 'Password updated successfully' });
});

export { userRoutes };
