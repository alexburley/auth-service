import fastify from "fastify";
import { Knex, knex } from "knex";
import { v4 as uuid } from "uuid";
import jwt = require("jsonwebtoken");
import { readFileSync } from "fs";
import { join } from "path";
import { Table, Entity } from "dynamodb-toolbox";
import { DynamoDB } from "aws-sdk";
import { promisify } from "util";
import * as crypto from "crypto";
import authorizer from "../shared/authorizer";

interface User {
  iid: string;
  email: string;
  authcode: string;
}

interface Service {
  iid: string;
  clientSecret: string;
  password: string;
  name: string;
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
    "val-PK-index": { partitionKey: "val", sortKey: "PK" },
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

const generateKey = async (ownerIid, payload = {}) => {
  const keyIid = uuid();
  const issuedAtInSeconds = Date.now();
  const refreshToken = uuid();
  const expiresInSeconds = Math.floor(issuedAtInSeconds / 1000) + 60 * 60; // One hour

  const key = jwt.sign(
    {
      ownerIid,
      keyIid,
      iat: Math.floor(issuedAtInSeconds / 1000),
      exp: expiresInSeconds, // expire in 7 days
      jwk: publickey.toString("utf8"),
      ...payload,
    },
    privatekey,
    { algorithm: "RS256" }
  );

  await KeyEntity.put({
    keyIid,
    expires: new Date(expiresInSeconds * 1000),
    ownerIid,
  });

  await rSet(keyIid, `${expiresInSeconds * 1000}`);

  await KeyEntity.put({
    keyIid: refreshToken,
    expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    ownerIid,
  });

  return { key, keyIid, refreshToken };
};

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
  const storedCode = exists.authcode && parseInt(exists.authcode.split("#")[0]);
  if (!storedCode || storedCode !== authcode) throw new Error("Code invalid");
  const res = await UserDB<User>("users")
    .where({ email: exists.email })
    .update({
      authcode: "",
    });

  return generateKey(exists.iid, {
    groups: ["users"],
    aud: ["authorized"],
  });
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

server.register((authorized) => {
  return authorized
    .register(authorizer, { aud: ["authorized"] })
    .post("/user/key", async (request: any, reply) => {
      const { ownerIid: userIid } = request.keyPayload;
      const [exists] = await UserDB<User>("users")
        .select("*")
        .where({ iid: userIid });
      if (!exists) throw new Error("User does not exist");
      return generateKey(exists.iid, {
        groups: ["users"],
        aud: ["authorized"],
      });
    });
});

server.head("/key/:keyIid", (request: any, reply) => {
  const key = request.params?.keyIid;
  rGet(key)
    .then((res) => {
      return res;
    })
    .then((res: any) => reply.status(res ? 204 : 404).send())
    .catch((err: any) => reply.status(500).send(err));
});

server.post(`/service/:clientIid/key`, async (request: any) => {
  const secret = request?.headers?.authorization;
  const [exists] = await UserDB<Service>("services")
    .select("*")
    .where({ iid: request.params.clientIid });
  if (!exists) throw new Error("Service does note exists");
  const password = exists.password;
  const hash = crypto
    .createHmac("SHA1", password)
    .update(exists.clientSecret)
    .digest("hex");
  if (hash !== secret) throw new Error("Invalid signature");
  return generateKey(exists.iid, {
    aud: [exists.name, "services"],
  });
});

server.register(async (authorized) => {
  return authorized
    .register(authorizer, { aud: ["services"] })
    .post("/service/key", async (request: any, reply) => {
      const { ownerIid, aud } = request.keyPayload;
      return generateKey(ownerIid, {
        aud,
      });
    });
});

server.register(async (authorized) => {
  return authorized
    .register(authorizer, { ignoreExpiry: true })
    .post("/key/:keyIid/refresh", async (request: any, reply) => {
      const key = request.params?.keyIid;
      const ownerIid = request.keyPayload.ownerIid;
      const res = await KeyEntity.query(ownerIid, {
        index: "val-PK-index",
        limit: 1,
        eq: key,
        filters: { attr: "expires", gt: new Date().toString() },
      });

      if (!res.Items.length) throw new Error("Key not found or expired");

      await KeyEntity.delete({ keyIid: key, expires: res.Items[0].expires });
      return generateKey(ownerIid, { aud: request.keyPayload.aud });
    });
});

server.ready(() => {
  console.log(server.printRoutes());
});

const start = async () => {
  try {
    await server.listen(3000);
  } catch (err) {
    server.log.error(err);
  }
};

start();
