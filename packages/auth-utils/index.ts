import bcrypt from 'bcrypt';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { JwtPayload } from '@hellodownloader/shared-types';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signAccessToken(payload: JwtPayload, secret: string, expiresIn: string): string {
  return jwt.sign(payload, secret, { expiresIn } as SignOptions);
}

export function signRefreshToken(userId: string, secret: string, expiresIn: string): string {
  return jwt.sign({ sub: userId, type: 'refresh' }, secret, { expiresIn } as SignOptions);
}

export function verifyToken<T = JwtPayload>(token: string, secret: string): T {
  return jwt.verify(token, secret) as T;
}
