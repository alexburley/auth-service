import fastify from "fastify";
import jwt = require("jsonwebtoken");
import { readFileSync } from "fs";
import { join } from "path";
import axios from "axios";

const server = fastify({ logger: true });
const publickey = readFileSync(join(__dirname, "..", "jwtRS256.key.pub"));

server.get("/resource", (request, reply) => {
  const auth = request.headers?.authorization?.split(" ")[1] || "";
  try {
    // This logic could easily be a library distributed by the auth service with a specific set of error codes
    // This would also probably be a middleware
    const payload: any = jwt.verify(auth, publickey);
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error("Expired");
    }
    console.log(payload);
    if (!payload.aud || !payload.aud.includes("authorized")) {
      throw new Error("Not authed");
    }
    if (!payload.keyIid) {
      throw new Error("Malformed key, no key iid");
    }
    axios
      .head(`http://localhost:3000/key/${payload.keyIid}`)
      .then(() => {
        reply.status(200).send({ some: "data" });
      })
      .catch((err) => {
        reply.status(403).send(err);
      });
  } catch (err) {
    reply.status(401).send(err);
  }
});

// Run the server!
const start = async () => {
  try {
    await server.listen(3001);
  } catch (err) {
    server.log.error(err);
  }
};

start();
