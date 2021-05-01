import fastify = require("fastify");
declare module "fastify" {
  interface FastifyRequest {
    keyPayload: any;
  }
}
