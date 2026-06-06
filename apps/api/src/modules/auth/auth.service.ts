import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../../database/prisma.service';
import { SiteSettingsService } from '../site-settings/site-settings.service';
import {
  hashPassword,
  verifyPassword,
  signRefreshToken,
} from '@hellodownloader/auth-utils';
import type { JwtPayload } from '@hellodownloader/shared-types';
import { RegisterDto, LoginDto } from './auth.dto';

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  plan: true,
  credits: true,
} as const;

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client | null = null;

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private siteSettings: SiteSettingsService,
  ) {}

  async isGoogleAuthEnabled(): Promise<boolean> {
    const config = await this.siteSettings.getGoogleOAuthConfig();
    return config.enabled;
  }

  async getGoogleAuthConfig(): Promise<{ enabled: boolean; clientId: string }> {
    return this.siteSettings.getGoogleOAuthConfig();
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await hashPassword(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        name: dto.name,
        credits: 0,
      },
      select: USER_SELECT,
    });

    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user?.passwordHash) {
      throw new UnauthorizedException(
        'This account uses Google sign-in. Continue with Google instead.',
      );
    }
    if (!(await verifyPassword(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.buildAuthResponse(user);
  }

  async googleAuth(idToken: string) {
    const { enabled, clientId } = await this.siteSettings.getGoogleOAuthConfig();
    if (!enabled || !clientId) {
      throw new BadRequestException('Google sign-in is not configured on the server');
    }

    const client = this.getGoogleClient(clientId);
    let payload;
    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: clientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Invalid Google sign-in token');
    }

    if (!payload?.email || !payload.sub) {
      throw new UnauthorizedException('Google account email is required');
    }

    const email = payload.email.toLowerCase();
    const googleId = payload.sub;
    const name = payload.name ?? null;
    const avatarUrl = payload.picture ?? null;

    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ googleId }, { email }] },
    });

    if (existing) {
      if (existing.googleId && existing.googleId !== googleId) {
        throw new ConflictException('This email is linked to a different Google account');
      }

      const user = await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          googleId: existing.googleId ?? googleId,
          emailVerified: true,
          name: existing.name ?? name,
          avatarUrl: avatarUrl ?? existing.avatarUrl,
        },
        select: USER_SELECT,
      });
      return this.buildAuthResponse(user);
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        googleId,
        name,
        avatarUrl,
        emailVerified: true,
        credits: 0,
      },
      select: USER_SELECT,
    });

    return this.buildAuthResponse(user);
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwt.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      }) as { sub: string };
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user) throw new UnauthorizedException();
      return this.buildAuthResponse(user);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private getGoogleClient(clientId: string): OAuth2Client {
    if (!this.googleClient || this.googleClientId !== clientId) {
      this.googleClient = new OAuth2Client(clientId);
      this.googleClientId = clientId;
    }
    return this.googleClient;
  }

  private googleClientId: string | null = null;

  private buildAuthResponse(user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    plan: string;
    credits: number;
  }) {
    const jwtPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as JwtPayload['role'],
      plan: user.plan as JwtPayload['plan'],
    };

    const accessToken = this.jwt.sign(jwtPayload);
    const refreshToken = signRefreshToken(
      user.id,
      process.env.JWT_REFRESH_SECRET!,
      process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        plan: user.plan,
        credits: user.credits,
      },
    };
  }
}
