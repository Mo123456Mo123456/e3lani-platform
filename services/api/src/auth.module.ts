import {
  Body,
  CanActivate,
  ConflictException,
  Controller,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Module,
  Post,
  SetMetadata,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { SignJWT, jwtVerify } from "jose";
import { IsEmail, IsIn, IsString, Length } from "class-validator";
import type { Request } from "express";
import { DatabaseService } from "./database.service.js";

const scrypt = promisify(scryptCallback);

type AuthUser = {
  id: string;
  email: string;
  role: string;
  preferredLocale: "ar" | "en";
};

type AuthenticatedRequest = Request & { user?: AuthUser };

class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(12, 128)
  password!: string;

  @IsString()
  @Length(2, 80)
  displayName!: string;

  @IsIn(["ar", "en"])
  locale: "ar" | "en" = "ar";
}

class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(12, 128)
  password!: string;
}

class RefreshDto {
  @IsString()
  @Length(32, 512)
  refreshToken!: string;
}

@Injectable()
export class AuthService {
  private readonly secret: Uint8Array;
  private readonly accessTtl = Number(
    process.env.ACCESS_TOKEN_TTL_SECONDS ?? 900,
  );
  private readonly refreshTtl = Number(
    process.env.REFRESH_TOKEN_TTL_SECONDS ?? 2_592_000,
  );

  constructor(private readonly database: DatabaseService) {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32)
      throw new Error("JWT_SECRET must contain at least 32 characters");
    this.secret = new TextEncoder().encode(secret);
  }

  async register(input: RegisterDto) {
    const email = input.email.trim().toLowerCase();
    const passwordHash = await this.hashPassword(input.password);
    try {
      const rows = await this.database.query<AuthUser>(
        `WITH created AS (
           INSERT INTO users(email,password_hash,preferred_locale)
           VALUES($1,$2,$3)
           RETURNING id,email,role,preferred_locale AS "preferredLocale"
         ), profile AS (
           INSERT INTO profiles(user_id,display_name)
           SELECT id,$4 FROM created
         )
         SELECT * FROM created`,
        [email, passwordHash, input.locale, input.displayName.trim()],
      );
      return this.issueSession(rows[0]!);
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        throw new ConflictException("EMAIL_ALREADY_REGISTERED");
      }
      throw error;
    }
  }

  async login(input: LoginDto) {
    const rows = await this.database.query<
      AuthUser & { passwordHash: string; status: string }
    >(
      `SELECT id,email,role,preferred_locale AS "preferredLocale",
              password_hash AS "passwordHash",status
       FROM users WHERE email=$1`,
      [input.email.trim().toLowerCase()],
    );
    const user = rows[0];
    if (
      !user ||
      user.status !== "active" ||
      !(await this.verifyPassword(input.password, user.passwordHash))
    ) {
      throw new UnauthorizedException("INVALID_CREDENTIALS");
    }
    return this.issueSession(user);
  }

  async refresh(rawToken: string) {
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const rows = await this.database.query<AuthUser>(
      `WITH consumed AS (
         UPDATE refresh_tokens
         SET rotated_at=now()
         WHERE token_hash=$1 AND revoked_at IS NULL AND rotated_at IS NULL
           AND expires_at > now()
         RETURNING user_id
       )
       SELECT u.id,u.email,u.role,u.preferred_locale AS "preferredLocale"
       FROM consumed
       JOIN users u ON u.id=consumed.user_id
       WHERE u.status='active'`,
      [tokenHash],
    );
    const user = rows[0];
    if (!user) throw new UnauthorizedException("INVALID_REFRESH_TOKEN");
    return this.issueSession(user);
  }

  async verifyAccessToken(token: string): Promise<AuthUser> {
    try {
      const { payload } = await jwtVerify(token, this.secret, {
        issuer: "planet-born-api",
        audience: "planet-born-web",
      });
      if (
        !payload.sub ||
        typeof payload.email !== "string" ||
        typeof payload.role !== "string"
      ) {
        throw new Error("Invalid token claims");
      }
      return {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        preferredLocale: payload.locale === "en" ? "en" : "ar",
      };
    } catch {
      throw new UnauthorizedException("INVALID_ACCESS_TOKEN");
    }
  }

  private async issueSession(user: AuthUser) {
    const accessToken = await new SignJWT({
      email: user.email,
      role: user.role,
      locale: user.preferredLocale,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(user.id)
      .setIssuer("planet-born-api")
      .setAudience("planet-born-web")
      .setIssuedAt()
      .setExpirationTime(`${this.accessTtl}s`)
      .sign(this.secret);
    const refreshToken = randomBytes(48).toString("base64url");
    const tokenHash = createHash("sha256").update(refreshToken).digest("hex");
    await this.database.query(
      `INSERT INTO refresh_tokens(user_id,token_hash,expires_at)
       VALUES($1,$2,now()+($3::text || ' seconds')::interval)`,
      [user.id, tokenHash, this.refreshTtl],
    );
    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessTtl,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        preferredLocale: user.preferredLocale,
      },
    };
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16);
    const key = (await scrypt(password, salt, 64)) as Buffer;
    return `scrypt:${salt.toString("hex")}:${key.toString("hex")}`;
  }

  private async verifyPassword(
    password: string,
    encoded: string,
  ): Promise<boolean> {
    const [algorithm, saltHex, keyHex] = encoded.split(":");
    if (algorithm !== "scrypt" || !saltHex || !keyHex) return false;
    const expected = Buffer.from(keyHex, "hex");
    const actual = (await scrypt(
      password,
      Buffer.from(saltHex, "hex"),
      expected.length,
    )) as Buffer;
    return (
      expected.length === actual.length && timingSafeEqual(expected, actual)
    );
  }
}

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = request.headers.authorization?.split(" ") ?? [];
    if (scheme !== "Bearer" || !token)
      throw new UnauthorizedException("ACCESS_TOKEN_REQUIRED");
    request.user = await this.auth.verifyAccessToken(token);
    return true;
  }
}

export const Roles = (...roles: string[]) => SetMetadata("roles", roles);

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowed = this.reflector.getAllAndOverride<string[]>("roles", [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!allowed?.length) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const role = request.user?.role;
    if (role === "super_admin" || (role && allowed.includes(role))) return true;
    throw new ForbiddenException("ROLE_NOT_ALLOWED");
  }
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) throw new UnauthorizedException("ACCESS_TOKEN_REQUIRED");
    return request.user;
  },
);

@ApiTags("auth")
@Controller("auth")
class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  register(@Body() input: RegisterDto) {
    return this.auth.register(input);
  }

  @Post("login")
  login(@Body() input: LoginDto) {
    return this.auth.login(input);
  }

  @Post("refresh")
  refresh(@Body() input: RefreshDto) {
    return this.auth.refresh(input.refreshToken);
  }

  @Post("me")
  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  me(@CurrentUser() user: AuthUser) {
    return user;
  }
}

@Module({
  controllers: [AuthController],
  providers: [AuthService, AccessTokenGuard, RoleGuard],
  exports: [AuthService, AccessTokenGuard, RoleGuard],
})
export class AuthModule {}
