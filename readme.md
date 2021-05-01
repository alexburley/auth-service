# Auth Service

This is a proof of concept of how a jwt based authorisation/identity layer might be based around a microservice backend. All identity for both users and backend services will be managed by a stateful JWT based system.

The first proof will be stateful management of the JWTS, the main benefit of JWT is being able to verify authenticity and integrity without a centralised service. However, if we support mulitple products using the same user system we need the ability to deregister tokens. This example service shows how we can use a DynamoDB table in conjunction with an SQL DB (and optional redis instance) in order to manage the keys with a very small overhead.
