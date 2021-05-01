import { FastifyInstance } from "fastify";
import jwt from "jsonwebtoken";
import { readFileSync } from "fs";
import { join } from "path";
import fp from "fastify-plugin";
import axios from "axios";
const publickey = readFileSync(join(__dirname, "..", "jwtRS256.key.pub"));

export default fp(
  async (server: FastifyInstance, options: { aud?: string[] }) => {
    server.addHook("onRequest", (request: any, reply, done) => {
      const auth = request.headers?.authorization?.split(" ")[1] || "";
      try {
        const payload: any = jwt.verify(auth, publickey);
        if (payload.exp < Math.floor(Date.now() / 1000)) {
          throw new Error("Expired");
        }
        if (
          !payload.aud ||
          (options.aud && !payload.aud.includes(options.aud[0]))
        ) {
          throw new Error("Not authed");
        }
        if (!payload.keyIid) {
          throw new Error("Malformed key, no key iid");
        }
        axios
          .head(`http://localhost:3000/key/${payload.keyIid}`)
          .then(() => {
            request.keyPayload = payload;
            done();
          })
          .catch((err) => {
            reply.status(403).send(err);
          });
      } catch (err) {
        reply.status(401).send(err);
      }
    });
  }
);
