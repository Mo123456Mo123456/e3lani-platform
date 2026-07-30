import { Body, Controller, Ip, Post, Req, UseGuards, UsePipes } from "@nestjs/common";
import type { Request } from "express";
import {
  loginSchema,
  oauthSchema,
  refreshSchema,
  registerSchema,
} from "@planet/validation";
import { Public } from "../common/auth.guard";
import { RateLimit, RateLimitGuard } from "../common/rate-limit.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { AuthService } from "./auth.service";
import { AuditService } from "../common/audit.service";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly audit: AuditService,
  ) {}

  @Public()
  @Post("register")
  @UseGuards(RateLimitGuard)
  @RateLimit(10, 300)
  @UsePipes(new ZodValidationPipe(registerSchema))
  async register(@Body() body: { email: string; password: string; displayName: string; locale?: string }, @Ip() ip: string) {
    const res = await this.auth.register({ ...body, ip });
    await this.audit.log({ actorId: res.user.id, actorEmail: res.user.email, action: "auth.register", ip });
    return res;
  }

  @Public()
  @Post("login")
  @UseGuards(RateLimitGuard)
  @RateLimit(10, 300)
  @UsePipes(new ZodValidationPipe(loginSchema))
  async login(@Body() body: { email: string; password: string }, @Ip() ip: string, @Req() req: Request) {
    const res = await this.auth.login({ ...body, ip, userAgent: req.headers["user-agent"] });
    await this.audit.log({ actorId: res.user.id, actorEmail: res.user.email, action: "auth.login", ip });
    return res;
  }

  @Public()
  @Post("oauth")
  @UseGuards(RateLimitGuard)
  @RateLimit(20, 300)
  @UsePipes(new ZodValidationPipe(oauthSchema))
  oauth(@Body() body: { provider: "google" | "apple"; idToken: string }, @Ip() ip: string) {
    return this.auth.oauth({ ...body, ip });
  }

  @Public()
  @Post("refresh")
  @UseGuards(RateLimitGuard)
  @RateLimit(30, 60)
  @UsePipes(new ZodValidationPipe(refreshSchema))
  refresh(@Body() body: { refreshToken: string }, @Ip() ip: string) {
    return this.auth.refresh(body.refreshToken, ip);
  }

  @Public()
  @Post("logout")
  logout(@Body() body: { refreshToken?: string }) {
    return this.auth.logout(body?.refreshToken);
  }
}
