import { decryptSecret, encryptSecret, generateSecret, matchingCounter } from '../security/totp';
import nodemailer from 'nodemailer';
import { BadRequestException, ForbiddenException, Body, ConflictException, Controller, Post, Get, Header, Headers, Res, UnauthorizedException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const database = new PrismaClient();
const derive = promisify(scrypt);
const consentVersion = 'draft-2026-11-13';
const dummySalt = randomBytes(16).toString('hex');
type Payload = Record<string, unknown>;

function field(body: Payload, key: string) {
  const value = body?.[key];
  return typeof value === 'string' ? value : '';
}

const disclosure = {
  version: '2026-11-14',
  introduction: 'Trading in Futures & Options involves significant financial risk. You may lose some or all of your invested capital.',
  points: [
    'Understand the risks associated with algorithmic trading.',
    'AI predictions and trading signals do not guarantee profits.',
    'Past performance does not guarantee future results.',
    'Always use appropriate risk management.',
    'Trade responsibly and within your financial capacity.',
  ],
};

async function sendAccountMail(to: string, subject: string, text: string) {
  const { GNK_SMTP_USERNAME: user, GNK_SMTP_PASSWORD: password, GNK_EMAIL_FROM: from } = process.env;
  if (!user || !password || !from) throw new Error('SMTP unavailable');
  const transport = nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 587, secure: false, requireTLS: true,
    auth: { user, pass: password.replace(/\s/g, '') },
    connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 10000,
  });
  await transport.sendMail({ from, to, subject, text });
}

type TokenPurpose = 'verify' | 'reset';

function digest(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

@Controller('api/auth')
export class AccountController {
  @Post('register')
  async register(@Body() body: Payload) {
    const email = field(body, 'email').trim().toLowerCase();
    const firstName = field(body, 'firstName').trim();
    const lastName = field(body, 'lastName').trim();
    const mobile = field(body, 'mobile').trim();
    const password = field(body, 'password');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 ||
        !firstName || firstName.length > 100 || !lastName || lastName.length > 100 ||
        !/^\+[1-9]\d{7,14}$/.test(mobile) || password.length < 15 || password.length > 128 ||
        password !== field(body, 'confirmPassword') || body.acceptTerms !== true || body.acknowledgePrivacy !== true ||
        body.consentVersion !== consentVersion) {
      throw new BadRequestException('Check your details, password and consent selections.');
    }
    const salt = randomBytes(16).toString('hex');
    const hash = (await derive(password, salt, 64)) as Buffer;
    try {
      const account = await database.user.create({
        data: {
          email, firstName, lastName, mobile,
          passwordHash: salt + ':' + hash.toString('hex'),
          acceptances: { create: { termsVersion: consentVersion, privacyVersion: consentVersion } },
        },
      });
      await this.issue(account.id, email, 'verify');
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Unable to create an account with these details.');
      }
      throw error;
    }
    return { status: 'verification_required' };
  }

  @Post('resend-verification')
  resend(@Body() body: Payload) {
    return this.requestLink(body, 'verify');
  }

  @Post('forgot-password')
  forgot(@Body() body: Payload) {
    return this.requestLink(body, 'reset');
  }

  private async requestLink(body: Payload, purpose: TokenPurpose) {
    const email = field(body, 'email').trim().toLowerCase();
    if (email.length <= 254) {
      const user = await database.user.findUnique({ where: { email } });
      if (user && !user.disabledAt && (purpose === 'verify' ? !user.emailVerifiedAt : user.emailVerifiedAt)) {
        await this.issue(user.id, email, purpose);
      }
    }
    return { status: 'request_received' };
  }

  private async issue(userId: string, email: string, purpose: TokenPurpose) {
    const { GNK_SMTP_USERNAME: user, GNK_SMTP_PASSWORD: password, GNK_EMAIL_FROM: from, GNK_PUBLIC_ORIGIN: origin } = process.env;
    if (!user || !password || !from || !origin) return;
    const token = randomBytes(32).toString('hex');
    const lifetime = (purpose === 'verify' ? 30 : 15) * 60_000;
    const url = new URL(purpose === 'verify' ? '/verify-email' : '/reset-password', origin);
    url.hash = token;
    const now = Date.now();
    const rows = await database.$executeRaw`
      INSERT INTO "AccountToken" ("digest", "userId", "purpose", "expiresAt")
      VALUES (${digest(token)}, ${userId}::uuid, ${purpose}, ${new Date(now + lifetime)})
      ON CONFLICT ("userId", "purpose") DO UPDATE
        SET "digest" = EXCLUDED."digest", "expiresAt" = EXCLUDED."expiresAt"
        WHERE "AccountToken"."expiresAt" <= ${new Date(now + lifetime - 60_000)}
    `;
    if (rows !== 1) return;
    const subject = purpose === 'verify' ? 'Verify your GNK Algo email' : 'Reset your GNK Algo password';
    try {
      await sendAccountMail(email, subject, subject + ': ' + url.href);
    } catch {
      await database.accountToken.deleteMany({ where: { digest: digest(token) } });
      console.error('GNK Algo account email delivery failed.');
    }
  }

  @Post('verify-email')
  verifyEmail(@Body() body: Payload) {
    return this.redeem(body, 'verify');
  }

  @Post('reset-password')
  resetPassword(@Body() body: Payload) {
    return this.redeem(body, 'reset');
  }

  private async redeem(body: Payload, purpose: TokenPurpose) {
    const token = field(body, 'token');
    if (!/^[a-f0-9]{64}$/.test(token)) throw new BadRequestException('Invalid or expired link.');
    const password = field(body, 'password');
    if (purpose === 'reset' && (password.length < 15 || password.length > 128 ||
        password !== field(body, 'confirmPassword'))) {
      throw new BadRequestException('Enter matching passwords of 15 to 128 characters.');
    }
    const salt = randomBytes(16).toString('hex');
    const passwordHash = purpose === 'reset'
      ? salt + ':' + ((await derive(password, salt, 64)) as Buffer).toString('hex')
      : undefined;
    const confirmed = await database.$transaction(async tx => {
      const key = digest(token);
      const record = await tx.accountToken.findUnique({ where: { digest: key } });
      if (!record || record.purpose !== purpose) throw new BadRequestException('Invalid or expired link.');
      const consumed = await tx.accountToken.deleteMany({
        where: { digest: key, purpose, expiresAt: { gt: new Date() } },
      });
      if (consumed.count !== 1) throw new BadRequestException('Invalid or expired link.');
      const result = await tx.user.updateMany({
        where: { id: record.userId, disabledAt: null },
        data: purpose === 'verify' ? { emailVerifiedAt: new Date() } : { passwordHash },
      });
      if (result.count !== 1) throw new BadRequestException('Invalid or expired link.');
      if (purpose === 'reset') {
        await tx.session.deleteMany({ where: { userId: record.userId } });
        await tx.loginChallenge.deleteMany({ where: { userId: record.userId } });
        return null;
      }
      return tx.user.findUnique({ where: { id: record.userId }, select: { id: true, firstName: true, lastName: true, email: true, createdAt: true } });
    });
    if (confirmed) {
      const name = confirmed.firstName + ' ' + confirmed.lastName;
      try {
        await sendAccountMail(confirmed.email, 'Welcome to GNK ALGO!', [
          'Dear ' + name + ',', '', 'Your account has been successfully created.', '',
          'Name: ' + name, 'User ID: ' + confirmed.id, 'Email: ' + confirmed.email,
          'Registration Date (UTC): ' + confirmed.createdAt.toISOString().slice(0, 10),
          'Account Status: Active', '',
          'Keep your login credentials secure. GNK ALGO will never ask you to share your password or OTP.',
          '', 'Team GNK ALGO',
        ].join('\n'));
      } catch {
        console.error('GNK Algo account confirmation email failed.');
      }
    }
    return { status: purpose === 'verify' ? 'verified' : 'password_updated' };
  }

  @Post('login')
  @Header('Cache-Control', 'no-store')
  async login(@Body() body: Payload) {
    const email = field(body, 'email').trim().toLowerCase();
    const password = field(body, 'password');
    if (!email || email.length > 254 || !password || password.length > 128) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    const account = await database.user.findUnique({ where: { email } });
    const [salt, hash] = account?.passwordHash.split(':') ?? [dummySalt, '00'.repeat(64)];
    const candidate = (await derive(password, salt, 64)) as Buffer;
    if (!timingSafeEqual(candidate, Buffer.from(hash, 'hex')) || !account || account.disabledAt) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    if (!account.emailVerifiedAt) return { status: 'verification_required' };
    return database.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${account.id}::uuid FOR UPDATE`;
      const current = await tx.user.findUnique({
        where: { id: account.id }, include: { authenticator: true },
      });
      if (!current || current.disabledAt || !current.emailVerifiedAt || current.passwordHash !== account.passwordHash) {
        throw new UnauthorizedException('Invalid email or password.');
      }
      const challenge = randomBytes(32).toString('hex');
      const secret = current.authenticator ? null : generateSecret();
      await tx.loginChallenge.deleteMany({ where: { userId: account.id } });
      await tx.loginChallenge.create({
        data: {
          digest: digest(challenge), userId: account.id,
          pendingSecret: secret ? encryptSecret(secret, account.id) : null,
          expiresAt: new Date(Date.now() + 300_000),
        },
      });
      return { status: 'mfa_required', challenge, secret };
    });
  }

  @Post('mfa')
  @Header('Cache-Control', 'no-store')
  async mfa(@Body() body: Payload, @Res({ passthrough: true }) res: CookieResponse) {
    const challenge = field(body, 'challenge');
    const code = field(body, 'code').trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(challenge)) throw new UnauthorizedException('Invalid challenge.');
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + sessionAge * 1000);
    const result = await database.$transaction(async tx => {
      const key = digest(challenge);
      const initial = await tx.loginChallenge.findUnique({ where: { digest: key } });
      if (!initial) return null;
      const userId = initial.userId;
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId}::uuid FOR UPDATE`;
      const record = await tx.loginChallenge.findUnique({
        where: { digest: key }, include: { user: { include: { authenticator: true } } },
      });
      if (!record || record.attempts >= 5 || record.expiresAt <= new Date() || record.user.disabledAt ||
          !record.user.emailVerifiedAt) return null;
      await tx.loginChallenge.update({ where: { digest: key }, data: { attempts: { increment: 1 } } });
      const authenticator = record.user.authenticator;
      const encrypted = authenticator?.secret ?? record.pendingSecret;
      if (!encrypted) return null;
      const counter = matchingCounter(decryptSecret(encrypted, userId), code);
      let recovery: string[] = [];
      if (counter !== null && (!authenticator || counter > authenticator.lastCounter)) {
        if (authenticator) {
          await tx.authenticator.update({ where: { userId }, data: { lastCounter: counter } });
        } else {
          await tx.authenticator.create({ data: { userId, secret: encrypted, lastCounter: counter } });
          recovery = Array.from({ length: 10 }, () => randomBytes(16).toString('hex'));
          await tx.recoveryCode.createMany({ data: recovery.map(value => ({ userId, digest: digest(value) })) });
        }
      } else {
        if (!authenticator || !/^[a-f0-9]{32}$/.test(code)) return null;
        const used = await tx.recoveryCode.deleteMany({ where: { userId, digest: digest(code) } });
        if (used.count !== 1) return null;
      }
      await tx.loginChallenge.delete({ where: { digest: key } });
      await tx.session.create({ data: { userId, digest: digest(token), expiresAt } });
      return { recovery };
    });
    if (!result) throw new UnauthorizedException('Incorrect code or expired challenge. Please sign in again if needed.');
    res.setHeader('Set-Cookie', sessionCookie(token, sessionAge));
    return { status: 'signed_in', recovery: result.recovery };
  }

  @Get('risk-disclosure')
  @Header('Cache-Control', 'no-store')
  async riskDisclosure(@Headers('cookie') cookie?: string) {
    await this.requireSession(cookie);
    return disclosure;
  }

  @Post('risk-disclosure')
  @Header('Cache-Control', 'no-store')
  async acceptRisk(@Body() body: Payload, @Headers('cookie') cookie?: string) {
    const session = await this.requireSession(cookie);
    if (body?.accepted !== true || body.version !== disclosure.version) {
      throw new BadRequestException('Read and acknowledge the current disclosure.');
    }
    const key = { userId: session.user.id, version: disclosure.version };
    await database.riskAcceptance.upsert({ where: { userId_version: key }, create: key, update: {} });
    return { status: 'accepted' };
  }

  @Get('session')
  @Header('Cache-Control', 'no-store')
  async session(@Headers('cookie') cookie?: string) {
    const active = await this.requireSession(cookie);
    const acknowledgment = await database.riskAcceptance.findUnique({
      where: { userId_version: { userId: active.user.id, version: disclosure.version } },
    });
    if (!acknowledgment) throw new ForbiddenException('Risk disclosure acknowledgment required.');
    return active.user;
  }

  private async requireSession(cookie?: string) {
    const token = readSession(cookie);
    const active = token && await database.session.findFirst({
      where: { digest: digest(token), expiresAt: { gt: new Date() }, user: { disabledAt: null } },
      select: { user: { select: { id: true, firstName: true, lastName: true, email: true, mobile: true, createdAt: true, emailVerifiedAt: true } } },
    });
    if (!active) throw new UnauthorizedException('Sign in required.');
    return active;
  }

  @Post('logout')
  async logout(@Headers('cookie') cookie: string | undefined, @Res({ passthrough: true }) res: CookieResponse) {
    const token = readSession(cookie);
    if (token) await database.session.deleteMany({ where: { digest: digest(token) } });
    res.setHeader('Set-Cookie', sessionCookie('', 0));
    return { status: 'signed_out' };
  }
}

type CookieResponse = { setHeader(name: string, value: string): void };
const sessionAge = 8 * 60 * 60;
const secure = process.env.NODE_ENV === 'production';
const cookieName = secure ? '__Host-gnk_session' : 'gnk_session';

function sessionCookie(value: string, age: number) {
  return cookieName + '=' + value + '; Path=/; HttpOnly; SameSite=Strict; Max-Age=' + age + (secure ? '; Secure' : '');
}

function readSession(cookie = '') {
  const value = cookie.split(';').map(part => part.trim()).find(part => part.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}
