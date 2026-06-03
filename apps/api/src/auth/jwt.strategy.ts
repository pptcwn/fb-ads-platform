import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AUTH_COOKIE_NAME } from '../common/auth-cookie.util';

function jwtFromCookieOrHeader(req: Request): string | null {
  const header = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
  if (header) return header;
  const cookieToken = req?.cookies?.[AUTH_COOKIE_NAME];
  return typeof cookieToken === 'string' ? cookieToken : null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: jwtFromCookieOrHeader,
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    });
  }

  async validate(payload: { sub: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException('User not found');
    return { id: user.id, email: user.email, name: user.name };
  }
}
