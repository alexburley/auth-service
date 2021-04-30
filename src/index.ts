import fastify from "fastify";
import { Knex, knex } from "knex";
import { v4 as uuid } from "uuid";

const UserDB = knex({
  client: "pg",
  connection: {
    host: "127.0.0.1",
    user: "postgres",
    password: "postgres",
    database: "postgres",
  },
});

interface User {
  iid: string;
  email: string;
  authcode: string;
}

const server = fastify({ logger: true });
// Declare a route
server.post("/user/login", async (request: any, reply) => {
  const email = request.body?.email;

  const [exists] = await UserDB<User>("users").select("*").where({ email });

  if (exists) {
    const [code, timestamp] = exists.authcode.split("#");
    if (Date.now() - parseInt(timestamp) > 1000 * 60 * 20) {
      const authcode = `${Math.floor(Math.random() * 999999)}#${Date.now()}`;
      await UserDB<User>("users").where({ email: exists.email }).update({
        authcode,
      });
      /* SEND EMAIL */
      return { iid: exists.iid, email: exists.email, authcode: code };
    }
    return { iid: exists.iid, email, authcode: exists.authcode.split("#")[0] };
  } else {
    const iid = uuid();
    const authcode = `${Math.floor(Math.random() * 999999)}#${Date.now()}`;
    /* SEND EMAIL */
    await UserDB<User>("users").insert({
      iid,
      email,
      authcode,
    });
    return { iid, email, authcode: authcode.split("#")[0] };
  }
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
