import fastify from "fastify";

const server = fastify({ logger: true });
// Declare a route
server.post("/user", async (request, reply) => {
  const email = request;
  return { hello: "world" };
});

// Run the server!
const start = async () => {
  try {
    await server.listen(3000);
  } catch (err) {
    server.log.error(err);
  }
};

start();
