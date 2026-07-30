import type { FastifyInstance } from "fastify";
import {
  accountSchema,
  roleSchema,
  sessionSchema,
} from "../domain/contracts.js";
import { AppError } from "../domain/errors.js";
import { hashPassword, verifyPassword } from "../domain/security.js";
import { clearSessionCookie, issueSession } from "../plugins/auth.js";

export async function authRoutes(app: FastifyInstance) {
  app.post(
    "/auth/sandbox",
    {
      schema: {
        tags: ["auth"],
        summary: "Create a sandbox account and authenticated session",
        body: {
          type: "object",
          required: ["email", "displayName", "password"],
          additionalProperties: false,
          properties: {
            email: { type: "string", format: "email" },
            displayName: { type: "string", minLength: 2, maxLength: 80 },
            password: { type: "string", minLength: 12, maxLength: 128 },
            requestedRole: { type: "string", enum: roleSchema.options },
          },
        },
      },
    },
    async (request, reply) => {
      if (!app.config.sandboxMode) {
        throw new AppError(404, "NOT_FOUND", "Sandbox account creation is disabled");
      }
      const input = accountSchema.parse(request.body);
      let role = input.requestedRole;
      if (role !== "user") {
        const suppliedKey = request.headers["x-sandbox-admin-key"];
        if (
          typeof suppliedKey !== "string" ||
          !app.config.sandboxAdminKey ||
          suppliedKey !== app.config.sandboxAdminKey
        ) {
          throw new AppError(403, "SANDBOX_ADMIN_KEY_REQUIRED", "Elevated sandbox role denied");
        }
      }
      try {
        const user = await app.repository.createAccount({
          email: input.email,
          displayName: input.displayName,
          passwordHash: await hashPassword(input.password),
          role,
        });
        const session = await issueSession(app, reply, user);
        return reply.code(201).send({ user, session: { expiresAt: session.expiresAt } });
      } catch (error) {
        if (
          error instanceof Error &&
          (error.message === "EMAIL_ALREADY_EXISTS" ||
            (error as { code?: string }).code === "23505")
        ) {
          throw new AppError(409, "EMAIL_ALREADY_EXISTS", "An account already uses this email");
        }
        throw error;
      }
    },
  );

  app.post(
    "/auth/session",
    {
      schema: {
        tags: ["auth"],
        summary: "Create an authenticated session",
        body: {
          type: "object",
          required: ["email", "password"],
          additionalProperties: false,
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 1, maxLength: 128 },
          },
        },
      },
    },
    async (request, reply) => {
      const input = sessionSchema.parse(request.body);
      const user = await app.repository.findUserByEmail(input.email);
      if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
        throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
      }
      const { passwordHash: _, ...identity } = user;
      const session = await issueSession(app, reply, identity);
      return { user: identity, session: { expiresAt: session.expiresAt } };
    },
  );

  app.get(
    "/auth/me",
    {
      preHandler: app.authenticate,
      schema: { tags: ["auth"], summary: "Get the current authenticated user" },
    },
    async (request) => {
      const user = await app.repository.findUserById(request.user.sub);
      if (!user) {
        throw new AppError(401, "SESSION_USER_NOT_FOUND", "The session user no longer exists");
      }
      return { user };
    },
  );

  app.delete(
    "/auth/session",
    {
      preHandler: app.authenticate,
      schema: { tags: ["auth"], summary: "Revoke the current session" },
    },
    async (request, reply) => {
      await app.repository.revokeSession(request.user.sid);
      clearSessionCookie(reply);
      return reply.code(204).send();
    },
  );
}
