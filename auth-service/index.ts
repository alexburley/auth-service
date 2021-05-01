import fastify from "fastify";
import { Knex, knex } from "knex";
import { v4 as uuid } from "uuid";
import jwt = require("jsonwebtoken");
import { readFileSync } from "fs";
import { join } from "path";
import { Table, Entity } from "dynamodb-toolbox";
import { DynamoDB } from "aws-sdk";
import { promisify } from "util";
import { resolve } from "node:path";

interface User {
  iid: string;
  email: string;
  authcode: string;
}
const redis = require("redis").createClient({
  host: "127.0.0.1",
  port: 6379,
});

const rGet = promisify(redis.get).bind(redis);
const rSet = promisify(redis.set).bind(redis);
const rDelete = promisify(redis.del).bind(redis);

const UserDB = knex({
  client: "pg",
  connection: {
    host: "127.0.0.1",
    user: "postgres",
    password: "postgres",
    database: "postgres",
  },
});

const DocumentClient = new DynamoDB.DocumentClient({
  region: "eu-west-2",
});

const KeysTable = new Table({
  name: "user-keys",
  partitionKey: "PK",
  sortKey: "SK",
  indexes: {
    GSI1: { partitionKey: "val", sortKey: "expires" },
  },
  DocumentClient,
});

const KeyEntity = new Entity({
  table: KeysTable,
  name: "key",
  attributes: {
    keyIid: { partitionKey: true },
    expires: { sortKey: true },
    val: { alias: "ownerIid" },
  },
});
const server = fastify({ logger: true });
const publickey = readFileSync(join(__dirname, "..", "jwtRS256.key.pub"));
const privatekey = readFileSync(join(__dirname, "..", "jwtRS256.key"));

server.post("/user/login", async (request: any, reply) => {
  const email = request.body?.email;

  const [exists] = await UserDB<User>("users").select("*").where({ email });

  if (exists) {
    const [code, timestamp] = exists.authcode.split("#");
    if (!exists.authcode || Date.now() - parseInt(timestamp) > 1000 * 60 * 20) {
      const newCode = Math.floor(Math.random() * 999999);
      const authcode = `${newCode}#${Date.now()}`;
      await UserDB<User>("users").where({ email: exists.email }).update({
        authcode,
      });
      return {
        iid: exists.iid,
        email: exists.email,
        authcode: newCode,
      };
    }
    return {
      iid: exists.iid,
      email,
      authcode: parseInt(exists.authcode.split("#")[0]),
    };
  } else {
    const iid = uuid();
    const authcode = `${Math.floor(Math.random() * 999999)}#${Date.now()}`;
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
      aud: ["authorized"],
      iat: Math.floor(issuedAtInSeconds / 1000),
      exp: expiresInSeconds, // expire in 7 days
    },
    privatekey,
    { algorithm: "RS256" }
  );

  await KeyEntity.put({
    keyIid,
    expires: new Date(expiresInSeconds * 1000),
    ownerIid: exists.iid,
  });
  await rSet(keyIid, `${expiresInSeconds * 1000}`);
  return { key, keyIid };
});

server.delete("/user/:iid", async (request: any) => {
  //TODO: Create index
  await UserDB<User>("users").where("iid", request.params.iid).del();
  const res = await KeysTable.scan({
    filters: { attr: "val", eq: request.params.iid },
  });
  await Promise.all(
    res.Items.map((item: any) => {
      return KeyEntity.delete({
        keyIid: item.keyIid,
        expires: item.expires,
      }).then(() => rDelete(item.keyIid));
    })
  );
  return { success: true };
});

server.post("/user/key/renew", async (request: any, reply) => {
  const key = request.headers.authorization; // Candidate for rate limiting
  // Validate, create new key, return new key
  return { key: "world" };
});

server.head("/key/:keyIid", (request: any, reply) => {
  const key = request.params?.keyIid;
  rGet(key)
    .then((res: any) => reply.status(res ? 204 : 404).send())
    .catch((err: any) => reply.status(500).send(err));
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