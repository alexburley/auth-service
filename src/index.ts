import fastify from "fastify";

const server = fastify({ logger: true });
// Declare a route
server.post("/user/login", async (request: any, reply) => {
  const email = request.body?.email;
  // store email and authcode
  return { iid: "someIid" };
});

server.post("/user/authorize", async (request: any, reply) => {
  const code = request.body?.code;
  // check code
  // create key
  return { key: "world" };
});

server.post("/user/key/renew", async (request: any, reply) => {
  const key = request.headers.authorization; // Candidate for rate limiting
  // Validate, create new key, return new key
  return { key: "world" };
});

server.head("/key/:key", (request: any, reply) => {
  const key = request.params?.key;
  // Check redis for key
  reply.status(204);
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

// Step 1
// User l
