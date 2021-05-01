import fastify from "fastify";
import authorizer from "../shared/authorizer";

const server = fastify({ logger: true });
server
  .register(authorizer, { aud: "microservice1" })
  .get("/resource", (request, reply) => {
    reply.status(200).send({ microservice1data: "foo" });
  });

const start = async () => {
  try {
    await server.listen(3002);
  } catch (err) {
    server.log.error(err);
  }
};

start();
