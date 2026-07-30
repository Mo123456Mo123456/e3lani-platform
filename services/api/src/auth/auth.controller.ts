import { Body, Controller, HttpCode, Post, Req, Res, UnauthorizedException, Get, NotImplementedException } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { loginSchema, registerSchema } from "@kawkab/validation";
import { CurrentUser, Public, type AuthUser } from "../common/decorators.js";
import { AuthService } from "./auth.service.js";

const COOKIE_SECURE = process.env.COOKIE_SECURE === "true";
const REFRESH_COOKIE = "refresh_token";

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: "strict",
    path: "/api/auth",
    maxAge: Number(process.env.REFRESH_TOKEN_TTL_SEC ?? 2592000) * 1000,
  });
}

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post("register")
  async register(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const input = registerSchema.parse(body);
    const { user, tokens } = await this.auth.register(input);
    setRefreshCookie(res, tokens.refreshToken);
    return { user, accessToken: tokens.accessToken, accessTokenExpiresInSec: tokens.accessTokenExpiresInSec };
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @HttpCode(200)
  @Post("login")
  async login(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const input = loginSchema.parse(body);
    const { user, tokens } = await this.auth.login(input);
    setRefreshCookie(res, tokens.refreshToken);
    return { user, accessToken: tokens.accessToken, accessTokenExpiresInSec: tokens.accessTokenExpiresInSec };
  }

  @Public()
  @HttpCode(200)
  @Post("refresh")
  async refresh(@Req() req: Request, @Body() body: { refreshToken?: string }, @Res({ passthrough: true }) res: Response) {
    const token = (req.cookies as Record<string, string | undefined>)[REFRESH_COOKIE] ?? body?.refreshToken;
    if (!token) throw new UnauthorizedException("no refresh token");
    const { user, tokens } = await this.auth.refresh(token);
    setRefreshCookie(res, tokens.refreshToken);
    return { user, accessToken: tokens.accessToken, accessTokenExpiresInSec: tokens.accessTokenExpiresInSec };
  }

  @HttpCode(204)
  @Post("logout")
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = (req.cookies as Record<string, string | undefined>)[REFRESH_COOKIE];
    await this.auth.logout(token);
    res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
  }

  @Get("me")
  me(@CurrentUser() user: AuthUser) {
    return { user };
  }

  /**
   * OAuth adapters (Google/Apple) are intentionally explicit about their state:
   * without configured client credentials they return 501 instead of pretending.
   */
  @Public()
  @Get("google")
  google() {
    if (!process.env.GOOGLE_CLIENT_ID) {
      throw new NotImplementedException({ code: "OAUTH_NOT_CONFIGURED", message: "Google sign-in is not configured in this environment." });
    }
    throw new NotImplementedException({ code: "OAUTH_FLOW_PENDING", message: "Google flow adapter registered; complete configuration to enable." });
  }

  @Public()
  @Get("apple")
  apple() {
    if (!process.env.APPLE_CLIENT_ID) {
      throw new NotImplementedException({ code: "OAUTH_NOT_CONFIGURED", message: "Apple sign-in is not configured in this environment." });
    }
    throw new NotImplementedException({ code: "OAUTH_FLOW_PENDING", message: "Apple flow adapter registered; complete configuration to enable." });
  }
}
