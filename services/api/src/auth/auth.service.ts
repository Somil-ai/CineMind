import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { Store, User } from '../store';

const REFRESH_TTL_MS = 30 * 24 * 3600 * 1000;
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

@Injectable()
export class AuthService {
  private dummyHash: Promise<string>;
  constructor(private store: Store, private jwt: JwtService) { this.dummyHash = argon2.hash('timing-equalizer'); }

  async register(email: string, password: string, displayName: string) {
    email = email.toLowerCase().trim();
    if (await this.store.findUserByEmail(email)) throw new ConflictException('An account with this email already exists');
    const admins = (process.env.ADMIN_EMAILS || '').split(',').map((s) => s.trim().toLowerCase());
    const user: User = { id: randomUUID(), email, passwordHash: await argon2.hash(password, { type: argon2.argon2id }), role: admins.includes(email) ? 'admin' : 'user', displayName, createdAt: Date.now() };
    await this.store.createUser(user);
    return this.issue(user, randomUUID());
  }

  async login(email: string, password: string) {
    const user = await this.store.findUserByEmail(email.toLowerCase().trim());
    const ok = await argon2.verify(user?.passwordHash ?? (await this.dummyHash), password); // constant-ish time whether or not user exists
    if (!user || !ok) throw new UnauthorizedException('Invalid email or password');
    return this.issue(user, randomUUID());
  }

  /** Rotation with reuse detection: presenting an already-used refresh token revokes the entire token family. */
  async refresh(token: string) {
    const [sid, secret] = (token || '').split('.');
    const s = sid ? await this.store.findSession(sid) : undefined;
    if (!s || !secret) throw new UnauthorizedException('Invalid refresh token');
    if (s.revoked) { await this.store.revokeFamily(s.familyId); throw new UnauthorizedException('Refresh token reuse detected; please sign in again'); }
    if (s.tokenHash !== sha(secret) || s.expiresAt < Date.now()) throw new UnauthorizedException('Invalid refresh token');
    s.revoked = true; await this.store.saveSession(s);
    const user = await this.store.findUserById(s.userId);
    if (!user) throw new UnauthorizedException();
    return this.issue(user, s.familyId);
  }

  async logout(token: string) {
    const s = await this.store.findSession((token || '').split('.')[0]);
    if (s) await this.store.revokeFamily(s.familyId);
  }

  async me(id: string) {
    const u = await this.store.findUserById(id);
    if (!u) throw new UnauthorizedException();
    return this.publicUser(u);
  }
  publicUser(u: User) { return { id: u.id, email: u.email, displayName: u.displayName, role: u.role }; }

  private async issue(user: User, familyId: string) {
    const id = randomUUID(), secret = randomBytes(32).toString('base64url');
    await this.store.saveSession({ id, userId: user.id, familyId, tokenHash: sha(secret), revoked: false, expiresAt: Date.now() + REFRESH_TTL_MS });
    return { accessToken: this.jwt.sign({ sub: user.id, role: user.role }), refreshToken: `${id}.${secret}`, expiresIn: 900, user: this.publicUser(user) };
  }
}
