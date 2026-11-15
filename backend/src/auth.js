import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Session, User } from './models.js';
import { validateRegistration } from './accountRules.js';
export { validateRegistration } from './accountRules.js';

const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
export const COOKIE_NAME = 'teamchat_session';

export async function register(body) {
  const { name, location, age, email, password } = validateRegistration(body);
  const passwordHash = await bcrypt.hash(password, 12);
  return User.create({ name, location, age, email, passwordHash });
}

export async function login(emailInput, password, secret) {
  const email = typeof emailInput === 'string' ? emailInput.trim().toLowerCase() : '';
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user || typeof password !== 'string' || Buffer.byteLength(password, 'utf8') > 72 || !(await bcrypt.compare(password, user.passwordHash))) throw new Error('Invalid email or password.');
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_MS);
  await Session.create({ _id: sessionId, user: user._id, expiresAt });
  const token = jwt.sign({ sub: String(user._id), sid: sessionId }, secret, { algorithm: 'HS256', expiresIn: '7d' });
  return { user, token, sessionId };
}

export async function authenticate(token, secret) {
  if (!token) throw new Error('Authentication required.');
  let claims;
  try { claims = jwt.verify(token, secret, { algorithms: ['HS256'] }); }
  catch { throw new Error('Authentication required.'); }
  const session = await Session.findOne({ _id: claims.sid, user: claims.sub, expiresAt: { $gt: new Date() } });
  if (!session) throw new Error('Authentication required.');
  const user = await User.findById(claims.sub);
  if (!user) throw new Error('Authentication required.');
  return { user, sessionId: claims.sid, expiresAt: claims.exp * 1000 };
}

export function cookieOptions() {
  const secure = process.env.COOKIE_SECURE === 'true';
  const sameSite = (process.env.COOKIE_SAME_SITE || 'lax').toLowerCase();
  if (!['lax', 'strict', 'none'].includes(sameSite) || (sameSite === 'none' && !secure)) throw new Error('Invalid cookie settings: SameSite=None requires COOKIE_SECURE=true.');
  return { httpOnly: true, secure, sameSite, path: '/', maxAge: SESSION_MS };
}
