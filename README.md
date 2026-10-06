# Meeting Room Booking API

REST API for booking meeting rooms built with NestJS, Prisma, and PostgreSQL.

## Getting Started

### Environment Variables

Copy the example file and replace the JWT secrets and the administrator password with your own values:

```bash
cp .env.example .env
```

| Variable | Description |
| --- | --- |
| `NODE_ENV` | `development`, `production` or `test` |
| `PORT` | API port |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_ACCESS_SECRET`, `JWT_ACCESS_EXPIRES_IN` | Access token secret and lifetime |
| `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN` | Refresh token secret and lifetime |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | Administrator account created by the seed |

### Run with Docker

```bash
docker compose up --build
```

This starts PostgreSQL and the API. On startup the API container applies migrations (`prisma migrate deploy`) and runs the seed. JWT settings and the administrator credentials are read from `.env`; `DATABASE_URL` is overridden inside the container to point at the `postgres` service.

The seed is idempotent: it only creates missing records and never deletes existing data. It adds the equipment list, two rooms and an administrator with the email and password from `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`. If either variable is missing, the administrator is skipped.

### Local Setup

```bash
npm ci
docker compose up postgres -d
npx prisma migrate dev
npx prisma db seed
npm run start:dev
```

## API Documentation

Swagger is available at `http://localhost:3000/api/docs`.

## Project Structure

| Path | Responsibility |
| --- | --- |
| `src/auth` | Registration, login, refresh token rotation, logout, JWT strategy, guards and decorators |
| `src/users` | User lookups and `GET /users/me` |
| `src/rooms` | Room creation, update, filters and pagination |
| `src/equipment` | Equipment list and creation |
| `src/health` | `GET /health` |
| `src/prisma` | Prisma client as a global Nest provider |
| `src/common` | Exception filter and shared DTOs |
| `src/config` | Environment validation |
| `src/app.setup.ts` | Global `ValidationPipe` and exception filter, shared by `main.ts` and e2e tests |
| `prisma` | Schema, migrations and seed |

## Tests

```bash
npm test
npm run test:e2e
```
