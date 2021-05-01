import fastify from "fastify";
import authorizer from "../shared/authorizer";

const server = fastify({ logger: true });

const clientId = "bfda7ef7-add6-43c3-b69f-885fd986bcb6";
const secret = "ms1secret";
const password = "ms1password";
const name = "microservice1";

server
  .register(authorizer, { aud: ["orchestration-service"] })
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
