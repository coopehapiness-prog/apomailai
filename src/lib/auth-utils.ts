import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-min-32-chars';
const JWT_EXPIRES_IN = '7d';

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

export function verifyToken(token: string): { userId: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    return decoded;
  } catch (error) {
    return null;
  }
}

export async function authenticateRequest(request: NextRequest): Promise<string | null> {
  try {
    // Try Bearer token first (for API clients)
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyToken(token);
      if (decoded?.userId) return decoded.userId;
    }

    // Fall back to NextAuth session (for browser/cookie-based auth)
    const nextAuthToken = await getToken({ req: request });
    if (nextAuthToken?.userId) {
      return nextAuthToken.userId as string;
    }

    return null;
  } catch (error) {
    return null;
  }
}
