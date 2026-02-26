import { Context, Next } from 'hono';
import { verify } from 'jsonwebtoken';

export interface JWTPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}

declare module 'hono' {
  interface ContextVariableMap {
    user: JWTPayload;
  }
}

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({
      error: {
        message: 'Unauthorized: No token provided',
        status: 401,
      },
    }, 401);
  }

  const token = authHeader.substring(7);

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }

    const payload = verify(token, secret) as JWTPayload;

    if (!payload.userId || !payload.email) {
      throw new Error('Invalid token payload');
    }

    c.set('user', payload);
    await next();
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'TokenExpiredError') {
        return c.json({
          error: {
            message: 'Unauthorized: Token has expired',
            status: 401,
          },
        }, 401);
      }
      if (error.name === 'JsonWebTokenError') {
        return c.json({
          error: {
            message: 'Unauthorized: Invalid token',
            status: 401,
          },
        }, 401);
      }
    }

    return c.json({
      error: {
        message: 'Unauthorized: Authentication failed',
        status: 401,
      },
    }, 401);
  }
}

export function requireAuth(...roles: string[]) {
  return async (c: Context, next: Next) => {
    await authMiddleware(c, async () => {});

    const user = c.get('user');

    if (roles.length > 0) {
      // Add role checking logic here if needed
      // For now, just checking if user is authenticated
    }

    await next();
  };
}

export function requireAdmin(c: Context, next: Next) {
  // Implement admin check logic
  // This could check against a database or JWT claim
  return authMiddleware(c, next);
}
