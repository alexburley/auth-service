import fastify from "fastify";
import { Knex, knex } from "knex";
import { v4 as uuid } from "uuid";
import jwt = require("jsonwebtoken");
import { readFileSync } from "fs";
import { join } from "path";
import { Table, Entity } from "dynamodb-toolbox";
import { DynamoDB } from "aws-sdk";

interface User {
  iid: string;
  email: string;
  authcode: string;
}

const UserDB = knex({
  client: "pg",
  connection: {
    host: "127.0.0.1",
    user: "postgres",
    password: "postgres",
    database: "postgres",
  },
});

const KeysTable = new Table({
  // Specify table name (used by DynamoDB)
  name: "user-keys",

  // Define partition and sort keys
  partitionKey: "PK",
  sortKey: "SK",

  // Add the DocumentClient
  DocumentClient: new DynamoDB.DocumentClient({
    region: "eu-west-2",
  }),
});

const KeyEntity = new Entity({
  table: KeysTable,
  name: "key",
  attributes: {
    keyIid: { partitionKey: true },
    expires: { hidden: true, sortKey: true },
    data: { alias: "ownerIid" },
  },
});
const server = fastify({ logger: true });
const publickey = readFileSync(join(__dirname, "..", "jwtRS256.key.pub"));
const privatekey = readFileSync(join(__dirname, "..", "jwtRS256.key"));
// Declare a route
server.post("/user/login", async (request: any, reply) => {
  const email = request.body?.email;

  const [exists] = await UserDB<User>("users").select("*").where({ email });

  if (exists) {
    const [code, timestamp] = exists.authcode.split("#");
    if (!exists.authcode || Date.now() - parseInt(timestamp) > 1000 * 60 * 20) {
      const authcode = `${Math.floor(Math.random() * 999999)}#${Date.now()}`;
      await UserDB<User>("users").where({ email: exists.email }).update({
        authcode,
      });
      /* SEND EMAIL */
      return { iid: exists.iid, email: exists.email, authcode: parseInt(code) };
    }
    return {
      iid: exists.iid,
      email,
      authcode: parseInt(exists.authcode.split("#")[0]),
    };
  } else {
    const iid = uuid();
    const authcode = `${Math.floor(Math.random() * 999999)}#${Date.now()}`;
    /* SEND EMAIL */
    await UserDB<User>("users").insert({
      iid,
      email,
      authcode,
    });
    return { iid, email, authcode: parseInt(authcode.split("#")[0]) };
  }
});

server.post("/user/authorize", async (request: any, reply) => {
  const authcode = request.body?.authcode;
  const email = request.body?.email;

  const [exists] = await UserDB<User>("users").select("*").where({ email });
  if (!exists) throw new Error("User does not exist");
  const storedCode = parseInt(exists.authcode.split("#")[0]);
  if (storedCode && storedCode !== authcode) throw new Error("Code invalid");
  await UserDB<User>("users").where({ email: exists.email }).update({
    authcode: "",
  });

  const keyIid = uuid();
  const issuedAtInSeconds = Date.now();
  const expiresInSeconds =
    Math.floor(issuedAtInSeconds / 1000) + 60 * 60 * 24 * 7;
  const key = jwt.sign(
    {
      ownerIid: exists.iid,
      keyIid,
      jwk: publickey.toString("utf8"),
      iat: Math.floor(issuedAtInSeconds / 1000),
      exp: expiresInSeconds, // expire in 7 days
    },
    privatekey,
    { algorithm: "RS256" }
  );

  // Would ideally encrypt this
  // Need to store against userIid for key revocation / indexing also platforms/
  await KeyEntity.put({
    keyIid,
    expires: new Date(expiresInSeconds * 1000),
    ownerIid: exists.iid,
  });

  return { key };
});

// server.delete

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
