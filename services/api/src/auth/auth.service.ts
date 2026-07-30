import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Prisma, User, UserRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto, RefreshDto, RegisterDto } from "./dto/auth.dto";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: string;
  refreshTokenExpiresIn: string;
}

export interface AuthResponse extends AuthTokens {
  user: SafeUser;
}

export type SafeUser = Pick<
  User,
  "id" | "email" | "displayName" | "role" | "level" | "xp" | "locale" | "avatarUrl"
>;

interface RefreshTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  jti: string;
  type: "refresh";
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const passwordHash = await bcrypt.hash(dto.password, 12);

    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email.toLowerCase(),
          passwordHash,
          displayName: dto.displayName,
          locale: dto.locale ?? "ar",
          role: "explorer",
          profile: { create: {} },
        },
      });

      return this.buildAuthResponse(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("Email is already registered");
      }
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid email or password");
    }

    return this.buildAuthResponse(user);
  }

  async refresh(dto: RefreshDto): Promise<AuthResponse> {
    let payload: RefreshTokenPayload;

    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(dto.refreshToken, {
        secret: this.config.getOrThrow<string>("jwtRefreshSecret"),
      });
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }

    if (payload.type !== "refresh") {
      throw new UnauthorizedException("Invalid token type");
    }

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { id: payload.jti },
      include: { user: true },
    });

    if (
      !storedToken ||
      storedToken.revokedAt ||
      storedToken.expiresAt.getTime() <= Date.now() ||
      !(await bcrypt.compare(dto.refreshToken, storedToken.tokenHash))
    ) {
      throw new UnauthorizedException("Refresh token has expired or was revoked");
    }

    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    return this.buildAuthResponse(storedToken.user);
  }

  async revokeRefreshToken(refreshToken: string): Promise<{ revoked: boolean }> {
    try {
      const payload = await this.jwt.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>("jwtRefreshSecret"),
      });

      await this.prisma.refreshToken.updateMany({
        where: { id: payload.jti, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      return { revoked: true };
    } catch {
      return { revoked: false };
    }
  }

  private async buildAuthResponse(user: User): Promise<AuthResponse> {
    const tokens = await this.issueTokens(user);
    return {
      user: this.toSafeUser(user),
      ...tokens,
    };
  }

  private async issueTokens(user: User): Promise<AuthTokens> {
    const accessTokenExpiresIn = this.config.get<string>("jwtAccessTtl") ?? "15m";
    const refreshTokenExpiresIn = this.config.get<string>("jwtRefreshTtl") ?? "30d";
    const refreshTokenId = randomUUID();

    const accessToken = await this.jwt.signAsync(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        type: "access",
      },
      {
        secret: this.config.getOrThrow<string>("jwtAccessSecret"),
        expiresIn: accessTokenExpiresIn as never,
      },
    );

    const refreshToken = await this.jwt.signAsync(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        jti: refreshTokenId,
        type: "refresh",
      },
      {
        secret: this.config.getOrThrow<string>("jwtRefreshSecret"),
        expiresIn: refreshTokenExpiresIn as never,
      },
    );

    await this.prisma.refreshToken.create({
      data: {
        id: refreshTokenId,
        userId: user.id,
        tokenHash: await bcrypt.hash(refreshToken, 12),
        expiresAt: new Date(Date.now() + parseDurationMs(refreshTokenExpiresIn)),
      },
    });

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresIn,
      refreshTokenExpiresIn,
    };
  }

  private toSafeUser(user: User): SafeUser {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      level: user.level,
      xp: user.xp,
      locale: user.locale,
      avatarUrl: user.avatarUrl,
    };
  }
}

function parseDurationMs(value: string): number {
  const match = /^(\d+)(ms|s|m|h|d)?$/.exec(value.trim());
  if (!match) {
    return 30 * 24 * 60 * 60 * 1000;
  }

  const amount = Number(match[1]);
  const unit = match[2] ?? "ms";

  switch (unit) {
    case "ms":
      return amount;
    case "s":
      return amount * 1000;
    case "m":
      return amount * 60 * 1000;
    case "h":
      return amount * 60 * 60 * 1000;
    case "d":
      return amount * 24 * 60 * 60 * 1000;
    default:
      return 30 * 24 * 60 * 60 * 1000;
  }
}
