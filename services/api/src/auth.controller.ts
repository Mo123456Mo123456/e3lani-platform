import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";

import { AuthService } from "./auth.service";

@ApiTags("authentication")
@Controller("v1/auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  @ApiOperation({ summary: "Create an account and issue an access session" })
  async register(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.withRefreshCookie(await this.auth.register(body), response);
  }

  @Post("login")
  @HttpCode(200)
  @ApiOperation({ summary: "Authenticate with email and password" })
  async login(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.withRefreshCookie(await this.auth.login(body), response);
  }

  @Post("refresh")
  @HttpCode(200)
  @ApiOperation({ summary: "Rotate the refresh token and renew access" })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = parseCookies(request.headers.cookie ?? "").planet_refresh;
    return this.withRefreshCookie(
      await this.auth.rotate(refreshToken ?? ""),
      response,
    );
  }

  private withRefreshCookie<
    T extends { refreshToken: string; accessToken: string },
  >(session: T, response: Response): Omit<T, "refreshToken"> {
    response.cookie("planet_refresh", session.refreshToken, {
      httpOnly: true,
      secure: (process.env.APP_ENV ?? "sandbox") === "production",
      sameSite: "strict",
      path: "/api/v1/auth/refresh",
      maxAge: 30 * 24 * 60 * 60 * 1_000,
    });
    const { refreshToken: _, ...publicSession } = session;
    return publicSession;
  }
}

function parseCookies(header: string): Record<string, string> {
  return Object.fromEntries(
    header
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const separator = item.indexOf("=");
        const key = separator >= 0 ? item.slice(0, separator) : item;
        const value = separator >= 0 ? item.slice(separator + 1) : "";
        return [decodeURIComponent(key), decodeURIComponent(value)];
      }),
  );
}
