import fastify from "fastify";
import jwt = require("jsonwebtoken");
import { readFileSync } from "fs";
import { join } from "path";
import authorizer from "../shared/authorizer";
import axios from "axios";

const server = fastify({ logger: true });
const publickey = readFileSync(join(__dirname, "..", "jwtRS256.key.pub"));

server
  .register(authorizer, { aud: "authorized" })
  .get("/resource", (request, reply) => {
    reply.status(200).send({ some: "data" });
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
