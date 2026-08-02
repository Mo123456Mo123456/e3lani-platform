import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { sdk, type AuthenticatedUser } from "./sdk";
import {
  resolveVisitorToken,
  visitorTokenFromHeader,
  type AuthenticatedVisitor,
} from "../visitor-token";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: AuthenticatedUser | null;
  visitor: AuthenticatedVisitor | null;
};

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  let user: AuthenticatedUser | null = null;
  let visitor: AuthenticatedVisitor | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }
  if (!user) {
    visitor = await resolveVisitorToken(
      visitorTokenFromHeader(opts.req.headers["x-visitor-token"]),
    ).catch(() => null);
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    visitor,
  };
}
