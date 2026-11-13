import nodemailer from 'nodemailer';
import { BadRequestException, Body, ConflictException, Controller, Post, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
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
      const transport = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: { user, pass: password.replace(/\s/g, '') },
        connectionTimeout: 5000,
        greetingTimeout: 5000,
        socketTimeout: 10000,
      });
      await transport.sendMail({ from, to: email, subject, text: subject + ': ' + url.href });
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
    await database.$transaction(async tx => {
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
    });
    return { status: purpose === 'verify' ? 'verified' : 'password_updated' };
  }

  @Post('login')
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
    throw new ServiceUnavailableException('Authenticator verification is being configured.');
  }
}
