import { Context, Hono } from 'hono';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb } from '../lib/db/index.js';
import * as auth from '../services/auth.js';
import { users } from '../db/schema.js';

const authRoutes = new Hono();

// Validation schemas
const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2).optional(),
  stack: z.enum(['openclaw', 'nanobot']).optional(),
});

// Shared handler for GET current user (used by both / and /me)
async function getCurrentUser(c: Context) {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return c.json({
      user: null,
      message: 'No token provided',
    });
  }

  try {
    const payload = auth.verifyToken(token);

    // Get fresh user data from database
    const db = getDb();
    const foundUsers = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);

    if (foundUsers.length === 0) {
      return c.json({
        user: null,
        message: 'User not found',
      });
    }

    const user = foundUsers[0];

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        emailVerified: user.emailVerified,
        avatar: user.avatar,
        status: user.status,
      },
    });
  } catch (error) {
    return c.json({
      user: null,
      message: 'Invalid token',
    }, 401);
  }
}

// GET /api/auth - Get current user
authRoutes.get('/', getCurrentUser);

// GET /api/auth/me - Get current user (alias for frontend compatibility)
authRoutes.get('/me', getCurrentUser);

// POST /api/auth/signin - Sign in
authRoutes.post('/signin', async (c) => {
  try {
    const body = await c.req.json();
    const { email, password } = signInSchema.parse(body);

    const db = getDb();
    const result = await auth.signin({ email, password }, db);

    if (result.success) {
      return c.json({
        user: result.user,
        token: result.token,
      });
    }

    return c.json({
      error: {
        message: result.error || 'Sign in failed',
      },
    }, 401);
  } catch (error) {
    return c.json({
      error: {
        message: 'Invalid request format',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 400);
  }
});

// POST /api/auth/signup - Sign up
authRoutes.post('/signup', async (c) => {
  try {
    const body = await c.req.json();
    const { email, password, name, stack } = signUpSchema.parse(body);

    const db = getDb();
    const result = await auth.signup({ email, password, name, stack }, db);

    if (result.success) {
      return c.json({
        user: result.user,
        token: result.token,
        message: 'Account created successfully',
      });
    }

    const statusCode = result.error?.includes('already exists') ? 409 : 400;

    return c.json({
      error: {
        message: result.error || 'Sign up failed',
      },
    }, statusCode);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({
        error: {
          message: 'Invalid input',
          details: error.errors,
        },
      }, 400);
    }

    return c.json({
      error: {
        message: 'Invalid request format',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 400);
  }
});

// POST /api/auth/signout - Sign out
authRoutes.post('/signout', async (c) => {
  // TODO: Implement token invalidation (blacklist)
  return c.json({
    message: 'Signed out successfully',
  });
});

// POST /api/auth/refresh - Refresh token
authRoutes.post('/refresh', async (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return c.json({
      error: {
        message: 'No token provided',
      },
    }, 401);
  }

  try {
    const payload = auth.verifyToken(token);

    // Get fresh user data
    const db = getDb();
    const foundUsers = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);

    if (foundUsers.length === 0) {
      return c.json({
        error: {
          message: 'User not found',
        },
      }, 404);
    }

    const user = foundUsers[0];

    // Generate new token
    const newToken = auth.generateToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
    });

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
      },
      token: newToken,
    });

  } catch (error) {
    return c.json({
      error: {
        message: 'Invalid token',
      },
    }, 401);
  }
});

// POST /api/auth/verify - Verify email
authRoutes.post('/verify', async (c) => {
  // TODO: Implement email verification logic
  return c.json({
    message: 'Email verification not yet implemented',
  });
});

// POST /api/auth/forgot-password - Forgot password
authRoutes.post('/forgot-password', async (c) => {
  // TODO: Implement forgot password logic
  return c.json({
    message: 'Forgot password not yet implemented',
  });
});

// POST /api/auth/reset-password - Reset password
authRoutes.post('/reset-password', async (c) => {
  // TODO: Implement reset password logic
  return c.json({
    message: 'Reset password not yet implemented',
  });
});

// POST /api/auth/sync - Sync user from OAuth provider (Supabase)
authRoutes.post('/sync', async (c) => {
  try {
    const body = await c.req.json();
    const { email, name, avatar, provider, providerId } = body;

    const db = getDb();
    const now = new Date();

    // Use upsert to handle race conditions from double-invoked useEffect
    const result = await db.insert(users)
      .values({
        email,
        name: name || email.split('@')[0],
        avatar,
        provider,
        providerId,
        plan: 'free',
        planStatus: 'trial',
        status: 'active',
        lastLoginAt: now,
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          lastLoginAt: now,
          ...(avatar && { avatar: (avatar as any) }),
          ...(provider && { provider: (provider as any) }),
          ...(providerId && { providerId: (providerId as any) }),
          name: name || email.split('@')[0], // Update name if provided
        },
      })
      .returning();

    const user = result[0];

    // Generate JWT token for our API
    const token = auth.generateToken({
      userId: user.id,
      email: user.email,
      name: user.name || '',
      plan: user.plan,
    });

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        avatar: user.avatar,
        status: user.status,
      },
      token,
    });
  } catch (error) {
    console.error('Auth sync error:', error);
    return c.json({
      error: {
        message: error instanceof Error ? error.message : 'Sync failed',
      },
    }, 500);
  }
});

// Export routes
export { authRoutes };