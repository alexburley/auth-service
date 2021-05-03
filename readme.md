# Auth Service

This is a proof of concept of how a jwt based authorisation/identity layer might be based around a microservice backend. All identity for both users and backend services will be managed by a stateful JWT based system.

## Features

- Offers customizable user authentication and service authentication
- Fast with simple state storage
- Decoupled user and key databases
- JWT revocation
- Rotatable secrets
- Flexible - if the engineering team wants to migrate to another system it should be easy.
