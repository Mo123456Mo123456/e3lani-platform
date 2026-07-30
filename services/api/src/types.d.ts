import "fastify";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    user: {
      id: string;
      email: string;
      displayName: string;
      role: string;
      level: number;
      xp: number;
      locale: string;
    };
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      id: string;
      email: string;
      displayName: string;
      role: string;
      level: number;
      xp: number;
      locale: string;
    };
    user: {
      id: string;
      email: string;
      displayName: string;
      role: string;
      level: number;
      xp: number;
      locale: string;
    };
  }
}
