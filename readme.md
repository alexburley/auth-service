# Auth Service

This is a proof of concept of how a jwt based authorisation/identity layer might be based around a microservice backend. All identity for both users and backend services will be managed by a stateful JWT based system.

The first proof will be stateful management of the JWTS, the main benefit of JWT is being able to verify authenticity and integrity without a centralised service. However, if we support mulitple products using the same user system we need the ability to deregister tokens. This example service shows how we can use a DynamoDB table in conjunction with an SQL DB (and optional redis instance) in order to manage the keys with a very small overhead.

The second proof will be that we can have a system whereby the secrets involved are easily rotatable, for example. We can automatically rotate the root key pairs used by the auth service every few weeks and this will propagate to the other services without issue.
