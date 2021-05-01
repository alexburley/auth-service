import fastify from "fastify";
import jwt = require("jsonwebtoken");
import { readFileSync } from "fs";
import { join } from "path";
import authorizer from "../shared/authorizer";
import axios from "axios";

const server = fastify({ logger: true });

const clientId = "cf55daaa-89d4-4889-a1a7-86657f979c1a";
const secret = "orcServiceSecret";
const password = "orcServicePassword";
const name = "orchestration-service";

let serviceToken;

// Consumers can cache their tokens, and either add a retry mechanism on 401 or check the expiry in the jwt
const getServiceToken = async () => {
  if (serviceToken) {
    return serviceToken;
  } else {
    const { data } = await axios.post(
      `http://localhost:3000/service/${clientId}/key`,
      {},
      {
        headers: {
          Authorization: secret,
        },
      }
    );
    serviceToken = data.key;
    return data.key;
  }
};

server
  .register(authorizer, { aud: ["authorized"] })
  .get("/resource", (request, reply) => {
    reply.status(200).send({ some: "data" });
  })
  .get("/user/microservice1", async (request, reply) => {
    const key = await getServiceToken();
    request.log.info(Date.now());
    return axios
      .get("http://localhost:3002/resource", {
        headers: {
          Authorization: `Bearer ${key}`,
        },
      })
      .then(({ data }) => data);
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
