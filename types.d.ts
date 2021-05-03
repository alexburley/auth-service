import fastify = require("fastify");
declare module "fastify" {
  interface FastifyRequest {
    keyPayload: any;
  }
  interface FastifyInstance {
    publicKey?: string;
    privateKey?: string;
  }
}
