/**
 * Auth Service - User authentication and JWT management
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import type { PlanType } from '@miniclaw/shared';
import { users } from '../db/schema.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';

export interface SignupInput {
  email: string;
  password: string;
  name?: string;
  stack?: 'openclaw' | 'nanobot';
}

export interface SignupResult {
  success: boolean;
  user?: {
    id: string;
    email: string;
    name: string;
    plan: PlanType;
    createdAt: Date;
  };
  token?: string;
  error?: string;
}

export interface SigninInput {
  email: string;
  password: string;
}

export interface SigninResult {
  success: boolean;
  user?: {
    id: string;
    email: string;
    name: string;
    plan: PlanType;
  };
  token?: string;
  error?: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  name: string;
  plan: PlanType;
  iat: number;
  exp: number;
}

/**
 * Hash password
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * Verify password
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate JWT token
 */
export function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  const now = Math.floor(Date.now() / 1000);
  const tokenPayload: JWTPayload = {
    ...payload,
    iat: now,
    exp: now + (7 * 24 * 60 * 60), // 7 days
  };

  return jwt.sign(tokenPayload, JWT_SECRET);
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
}

/**
 * Sign up new user
 */
export async function signup(input: SignupInput, db: any): Promise<SignupResult> {
  const { email, password, name, stack } = input;

  try {
    // Check if user already exists
    const existingUsers = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (existingUsers.length > 0) {
      return {
        success: false,
        error: 'User already exists with this email',
      };
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const newUsers = await db.insert(users).values({
      email,
      passwordHash: hashedPassword,
      name: name || email.split('@')[0],
      plan: 'free',
      planStatus: 'trial',
      status: 'active',
      lastLoginAt: new Date(),
    }).returning();

    const user = newUsers[0];

    // Generate JWT
    const token = generateToken({
      userId: user.id,
      email: user.email,
      name: user.name || '',
      plan: user.plan,
    });

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name || '',
        plan: user.plan,
        createdAt: user.createdAt?.toISOString() || new Date().toISOString(),
      },
      token,
    };

  } catch (error) {
    console.error('Signup error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Signup failed',
    };
  }
}

/**
 * Sign in user
 */
export async function signin(input: SigninInput, db: any): Promise<SigninResult> {
  const { email, password } = input;

  try {
    // Find user
    const foundUsers = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (foundUsers.length === 0) {
      return {
        success: false,
        error: 'Invalid email or password',
      };
    }

    const user = foundUsers[0];

    // Verify password
    const isValid = await verifyPassword(password, user.passwordHash || '');

    if (!isValid) {
      return {
        success: false,
        error: 'Invalid email or password',
      };
    }

    // Update last login
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

    // Generate JWT
    const token = generateToken({
      userId: user.id,
      email: user.email,
      name: user.name || '',
      plan: user.plan,
    });

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name || '',
        plan: user.plan,
      },
      token,
    };

  } catch (error) {
    console.error('Signin error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Signin failed',
    };
  }
}
