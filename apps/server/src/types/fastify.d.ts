import "fastify";

declare module "fastify" {
  interface FastifyRequest {
    accessIdentity: {
      sub: string;
      email?: string;
    } | null;
  }
}

export {};
