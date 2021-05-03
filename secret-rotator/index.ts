import { SecretsManager } from "aws-sdk";
import { generateKeyPair } from "crypto";
const genKey = async (): Promise<{ publicKey: string; privateKey: string }> =>
  new Promise((resolve, reject) => {
    generateKeyPair(
      "rsa",
      {
        modulusLength: 4096,
        publicKeyEncoding: {
          type: "spki",
          format: "pem",
        },
        privateKeyEncoding: {
          type: "pkcs8",
          format: "pem",
        },
      },
      (err, publicKey, privateKey) =>
        err ? reject(err) : resolve({ publicKey, privateKey })
    );
  });

export const handler = async (event: any) => {
  const { publicKey, privateKey } = await genKey();
  const client = new SecretsManager({
    region: "eu-west-2",
  });
  var params = {
    SecretId: "auth-service/keys",
    SecretString: JSON.stringify({
      "auth-service/public-key": publicKey,
      "auth-service/private-key": privateKey,
    }),
  };
  await client.putSecretValue(params).promise();
};
if (require.main) {
  handler({}).then(console.log);
}
