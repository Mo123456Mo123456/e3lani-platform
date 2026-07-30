import { createHash, randomBytes, randomUUID } from "node:crypto";
import { compare, hash } from "bcryptjs";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import type { Config } from "./config.js";

export interface AuthClaims {
  sub: string;
  email: string;
  roles: string[];
}

const credentialsSchema = z.object({
  email: z
    .string()
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
  password: z
    .string()
    .min(12)
    .max(128)
    .regex(/[a-z]/)
    .regex(/[A-Z]/)
    .regex(/[0-9]/),
});

const registerSchema = credentialsSchema.extend({
  displayName: z.string().trim().min(2).max(80),
  locale: z.enum(["ar", "en"]).default("ar"),
});

const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const agentHash = (agent: string | undefined) =>
  agent ? createHash("sha256").update(agent).digest("hex") : null;

async function rolesFor(
  pool: Pool | PoolClient,
  userId: string,
): Promise<string[]> {
  const result = await pool.query<{ name: string }>(
    `SELECT roles.name FROM roles
     JOIN user_roles ON user_roles.role_id=roles.id
     WHERE user_roles.user_id=$1`,
    [userId],
  );
  return result.rows.map((row) => row.name);
}

export function registerAuthRoutes(
  app: FastifyInstance,
  pool: Pool,
  config: Config,
): {
  authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  claims: (request: FastifyRequest) => AuthClaims;
} {
  const cookieOptions = {
    path: "/v1/auth",
    httpOnly: true,
    secure: config.NODE_ENV === "production",
    sameSite: "strict" as const,
    maxAge: config.REFRESH_TOKEN_DAYS * 86_400,
  };

  const issueSession = async (
    reply: FastifyReply,
    user: { id: string; email: string },
    userAgent: string | undefined,
    familyId: string = randomUUID(),
  ) => {
    const roles = await rolesFor(pool, user.id);
    const refreshToken = randomBytes(48).toString("base64url");
    const sessionId = randomUUID();
    await pool.query(
      `INSERT INTO refresh_sessions(
         id,user_id,family_id,token_hash,expires_at,user_agent_hash
       ) VALUES ($1,$2,$3,$4,now()+($5 || ' days')::interval,$6)`,
      [
        sessionId,
        user.id,
        familyId,
        tokenHash(refreshToken),
        config.REFRESH_TOKEN_DAYS,
        agentHash(userAgent),
      ],
    );
    reply.setCookie("planet_refresh", refreshToken, cookieOptions);
    return {
      accessToken: app.jwt.sign(
        { sub: user.id, email: user.email, roles },
        { expiresIn: config.ACCESS_TOKEN_TTL },
      ),
      user: { id: user.id, email: user.email, roles },
    };
  };

  app.post("/v1/auth/register", {
    config: { rateLimit: { max: 8, timeWindow: "15 minutes" } },
    handler: async (request, reply) => {
      const input = registerSchema.parse(request.body);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const user = await client.query<{ id: string; email: string }>(
          `INSERT INTO users(email,password_hash) VALUES ($1,$2) RETURNING id,email`,
          [input.email, await hash(input.password, 12)],
        );
        await client.query(
          `INSERT INTO profiles(user_id,display_name,locale) VALUES ($1,$2,$3)`,
          [user.rows[0]!.id, input.displayName, input.locale],
        );
        await client.query(
          `INSERT INTO user_roles(user_id,role_id)
           SELECT $1,id FROM roles WHERE name='user'`,
          [user.rows[0]!.id],
        );
        await client.query("COMMIT");
        const session = await issueSession(
          reply,
          user.rows[0]!,
          request.headers["user-agent"],
        );
        return reply.code(201).send(session);
      } catch (error) {
        await client.query("ROLLBACK");
        if ((error as { code?: string }).code === "23505") {
          return reply.code(409).send({ code: "EMAIL_EXISTS" });
        }
        throw error;
      } finally {
        client.release();
      }
    },
  });

  app.post("/v1/auth/login", {
    config: { rateLimit: { max: 10, timeWindow: "15 minutes" } },
    handler: async (request, reply) => {
      const input = credentialsSchema.parse(request.body);
      const result = await pool.query<{
        id: string;
        email: string;
        password_hash: string;
      }>(
        `SELECT id,email,password_hash FROM users WHERE email=$1 AND status='active'`,
        [input.email],
      );
      const user = result.rows[0];
      if (!user || !(await compare(input.password, user.password_hash))) {
        return reply.code(401).send({ code: "INVALID_CREDENTIALS" });
      }
      return issueSession(reply, user, request.headers["user-agent"]);
    },
  });

  app.post("/v1/auth/refresh", async (request, reply) => {
    const refreshToken = request.cookies.planet_refresh;
    if (!refreshToken)
      return reply.code(401).send({ code: "REFRESH_REQUIRED" });
    const result = await pool.query<{
      id: string;
      user_id: string;
      family_id: string;
      email: string;
      revoked_at: Date | null;
    }>(
      `SELECT session.id,session.user_id,session.family_id,session.revoked_at,users.email
       FROM refresh_sessions session JOIN users ON users.id=session.user_id
       WHERE session.token_hash=$1 AND session.expires_at>now()`,
      [tokenHash(refreshToken)],
    );
    const session = result.rows[0];
    if (!session) return reply.code(401).send({ code: "INVALID_REFRESH" });
    if (session.revoked_at) {
      await pool.query(
        "UPDATE refresh_sessions SET revoked_at=coalesce(revoked_at,now()) WHERE family_id=$1",
        [session.family_id],
      );
      reply.clearCookie("planet_refresh", cookieOptions);
      return reply.code(401).send({ code: "REFRESH_REUSE_DETECTED" });
    }
    await pool.query(
      "UPDATE refresh_sessions SET revoked_at=now() WHERE id=$1",
      [session.id],
    );
    const next = await issueSession(
      reply,
      { id: session.user_id, email: session.email },
      request.headers["user-agent"],
      session.family_id,
    );
    return next;
  });

  app.post("/v1/auth/logout", async (request, reply) => {
    const refreshToken = request.cookies.planet_refresh;
    if (refreshToken) {
      await pool.query(
        "UPDATE refresh_sessions SET revoked_at=coalesce(revoked_at,now()) WHERE token_hash=$1",
        [tokenHash(refreshToken)],
      );
    }
    reply.clearCookie("planet_refresh", cookieOptions);
    return reply.code(204).send();
  });

  const authenticate = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      await reply.code(401).send({ code: "AUTH_REQUIRED" });
      return;
    }
    try {
      const claims = await app.jwt.verify<AuthClaims>(header.slice(7));
      (request as FastifyRequest & { authClaims: AuthClaims }).authClaims =
        claims;
    } catch {
      await reply.code(401).send({ code: "INVALID_ACCESS_TOKEN" });
    }
  };

  return {
    authenticate,
    claims: (request) =>
      (request as FastifyRequest & { authClaims: AuthClaims }).authClaims,
  };
}
