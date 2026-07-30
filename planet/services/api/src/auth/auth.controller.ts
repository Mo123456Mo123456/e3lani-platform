import { Body, Controller, HttpCode, Ip, Post, Req, Res, UnauthorizedException } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { loginSchema, registerSchema } from "@planet/validation";
import { AuthService } from "./auth.service.js";
import { globalRateLimiter } from "../common/rate-limit.js";

const REFRESH_COOKIE = "planet_refresh";

@Controller("auth")
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post("register")
  async register(@Body() body: unknown, @Ip() ip: string, @Res({ passthrough: true }) res: FastifyReply) {
    this.rate(`register:${ip}`, 10);
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message };
    const { user, tokens } = await this.auth.register(parsed.data, ip);
    this.setRefreshCookie(res, tokens.refreshToken);
    return { user, accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
  }

  @Post("login")
  @HttpCode(200)
  async login(@Body() body: unknown, @Ip() ip: string, @Res({ passthrough: true }) res: FastifyReply) {
    this.rate(`login:${ip}`, 10);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message };
    const tokens = await this.auth.login(parsed.data, ip);
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
  }

  @Post("refresh")
  @HttpCode(200)
  async refresh(@Req() req: FastifyRequest, @Ip() ip: string, @Res({ passthrough: true }) res: FastifyReply) {
    const token = (req.cookies?.[REFRESH_COOKIE] as string) ?? (req.body as { refreshToken?: string })?.refreshToken;
    if (!token) throw new UnauthorizedException("refresh_token_missing");
    const tokens = await this.auth.refresh(token, ip);
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
  }

  @Post("logout")
  @HttpCode(204)
  async logout(@Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    const token = req.cookies?.[REFRESH_COOKIE] as string;
    if (token) await this.auth.logout(token);
    res.clearCookie(REFRESH_COOKIE, { path: "/auth" });
  }

  private rate(key: string, perMinute: number): void {
    if (!globalRateLimiter.allow(key, perMinute, 60_000)) {
      throw new UnauthorizedException("rate_limit_exceeded");
    }
  }

  private setRefreshCookie(res: FastifyReply, token: string): void {
    res.setCookie(REFRESH_COOKIE, token, {
      path: "/auth",
      httpOnly: true,
      sameSite: "strict",
      secure: process.env["NODE_ENV"] === "production",
      maxAge: 7 * 24 * 3600,
    });
  }
}
