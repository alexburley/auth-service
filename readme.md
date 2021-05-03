# Auth Service

This is a proof of concept of how a jwt based authorisation/identity layer might be based around a microservice backend. All identity for both users and backend services will be managed by a stateful JWT based system.

## Features

- Offers customizable user authentication and service authentication
- Fast with simple state storage
- Decoupled user and key databases
- JWT revocation
- Rotatable secrets
- Flexible - if the engineering team wants to migrate to another system it should be easy.
- Microservices can choose which consumers they respect.

## Use Cases

- A user authorizes/logs in using a 6 digit 'authcode' that is emailed to them, by providing this auth code they can recieve a JWT access token and a UUID representing a refresh token (de-coupled from the key used to sign the JWT). The access token has an expiry of one hour, but can be refreshed by providing the expired access token and the refresh token to the auth service. This way we can implement an easy method or re-authenticating and don't need to log a user out, unless they have been inactive. In this sense, the refresh token represents the maximum amount of time the user can stay "logged in" to the application.

- A backend service has triggered a batch process, an access token is requested by sending the client secret which is hashed using a client password to the auth service. The access token and refresh token pair are provided back to the backend service which can then cache the token for 10 minutes less than the token expiry (as noted inside the JWT).

- The orchestration API which communicates with client app receives a token, it is decoded and checked as to whether it belongs to a user, this can be compared to the resource requested in addition to checking any other permissions encoded within the JWT. The API can then choose to pass this token on to one of the backend services, or it can generates its own token.

- On recieving a key, a microservice will decode the JWT using a public key that has been encoded within the JWT. If the key matches all the service specifications it is then checked against the auth service. If the key is valid, we get a 204 response and we can continue the request. The key check is an extremely fast operation that checks the key against the cache.

- Key rotation. The private key used to sign the JWT's can be rotated at any time and we can use our secrets provider to automatically do this perhaps once a week. Since the public key is encoded in the JWT, there will be no impact on downstream services. All keys stored by the auth service will be automically cleaned out the database every hour/day and the cache time set on the cache instance will be the same as the token expiry.

- Private key compromised. In the case that a private key has been compromised or a cyber attack is underway, we can invalidate all keys by invalidating the cache and triggering deletes on the key table. We can also purge offending services from the database and remove any registered keys from the keys table.

- If a user can register in more than one way, either by registering specific scopes or by registering on a new platform then these scopes will need to be recorded within the keys table. That way, we can implement listeners that can automatically update the table and cache by deleting keys which contain the invalid scopes.
