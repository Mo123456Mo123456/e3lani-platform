import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  preHandlerHookHandler,
} from "fastify";
import type { Role, UserIdentity } from "../domain/contracts.js";
import { AppError } from "../domain/errors.js";
import type { JwtClaims } from "../types.js";

export const AUTH_COOKIE = "planet_session";
const SESSION_SECONDS = 60 * 60 * 24 * 7;

export async function registerAuth(app: FastifyInstance) {
  await app.register(cookie);
  await app.register(jwt, {
    secret: app.config.jwtSecret,
    cookie: { cookieName: AUTH_COOKIE, signed: false },
  });

  const authenticateRequest = async (request: FastifyRequest) => {
    let claims;
    try {
      claims = await request.jwtVerify<JwtClaims>();
    } catch {
      throw new AppError(401, "UNAUTHENTICATED", "A valid session is required");
    }
    if (
      !claims.sub ||
      !claims.sid ||
      !(await app.repository.sessionIsActive(claims.sid, claims.sub))
    ) {
      throw new AppError(401, "SESSION_EXPIRED", "The session is expired or revoked");
    }
  };
  const authenticate: preHandlerHookHandler = async (request) => {
    await authenticateRequest(request);
  };
  app.decorate("authenticate", authenticate);
  app.decorate("requireRole", (role: Role): preHandlerHookHandler => {
    return async (request) => {
      await authenticateRequest(request);
      const elevatedRoles: Role[] =
        role === "admin"
          ? ["admin", "simulation_manager", "system_admin", "super_admin"]
          : [role, "super_admin"];
      if (!elevatedRoles.some((candidate) => request.user.roles.includes(candidate))) {
        throw new AppError(403, "FORBIDDEN", `Role '${role}' is required`);
      }
    };
  });
}

export async function issueSession(
  app: FastifyInstance,
  reply: FastifyReply,
  user: UserIdentity,
) {
  const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1_000);
  const session = await app.repository.createSession(user.id, expiresAt);
  const token = await reply.jwtSign(
    {
      sub: user.id,
      sid: session.id,
      email: user.email,
      roles: user.roles,
    },
    { expiresIn: SESSION_SECONDS },
  );
  reply.setCookie(AUTH_COOKIE, token, {
    path: "/",
    httpOnly: true,
    secure: app.config.nodeEnv === "production",
    sameSite: "strict",
    maxAge: SESSION_SECONDS,
  });
  return session;
}

export function clearSessionCookie(reply: FastifyReply) {
  reply.clearCookie(AUTH_COOKIE, {
    path: "/",
    httpOnly: true,
    sameSite: "strict",
  });
}

export async function getOptionalClaims(request: FastifyRequest) {
  try {
    return await request.jwtVerify();
  } catch {
    return undefined;
  }
}
