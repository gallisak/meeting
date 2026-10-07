# Meeting Room Booking API

REST API for booking meeting rooms built with NestJS, Prisma, and PostgreSQL.

## Getting Started

### Environment Variables

```bash
cp .env.example .env
```

| Variable | Description |
| --- | --- |
| `NODE_ENV` | `development`, `production` or `test` |
| `PORT` | API port (default: `3000`) |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_ACCESS_SECRET`, `JWT_ACCESS_EXPIRES_IN` | Access token secret and lifetime |
| `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN` | Refresh token secret and lifetime |
| `RUN_SEED` | Set to `true` to run seed on container startup (default: `false`) |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | Administrator credentials for seed |

### Running the App

```bash
# Docker, first run (applies migrations and runs the seed)
RUN_SEED=true docker compose up --build

# Docker, later runs (applies migrations, no seed)
docker compose up

# Run seed manually
docker compose exec api npx prisma db seed

# Local
npm ci
docker compose up postgres -d
npx prisma migrate dev
npx prisma db seed
npm run start:dev
```

The seed creates the administrator from `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`, the equipment list and two rooms.

## Documentation & Auth

- **Swagger**: `http://localhost:3000/api/docs`
- **Authentication**: JWT Bearer token required globally. Public endpoints (`@Public()`): `/auth/register`, `/auth/login`, `/auth/refresh`, and `/health`.

## Project Structure

| Path | Responsibility |
| --- | --- |
| `src/auth` | Registration, login, refresh token rotation, logout, JWT strategy, guards and decorators |
| `src/users` | User lookups and `GET /users/me` |
| `src/rooms` | Room creation, update, filters and pagination |
| `src/equipment` | Equipment list and creation |
| `src/bookings` | Booking creation, list, details and cancellation |
| `src/health` | `GET /health` with a database check |
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

## Room Filter Indexes

Filters in `GET /rooms` (`floor` and `minCapacity`) are optional and independent. We use two separate single-column indexes: `@@index([floor])` and `@@index([capacity])`.

### EXPLAIN ANALYZE (PostgreSQL 16, 100k generated rows)

1. **Filter by floor** (`rooms_floor_idx`):

```text
EXPLAIN ANALYZE
SELECT * FROM rooms WHERE floor = 7 ORDER BY "createdAt" DESC, id DESC LIMIT 10;

 Limit  (cost=1491.55..1491.57 rows=10 width=72) (actual time=2.125..2.127 rows=10 loops=1)
   ->  Sort  (cost=1491.55..1496.82 rows=2107 width=72) (actual time=2.124..2.125 rows=10 loops=1)
         Sort Key: "createdAt" DESC, id DESC
         Sort Method: top-N heapsort  Memory: 26kB
         ->  Bitmap Heap Scan on rooms  (cost=28.62..1446.02 rows=2107 width=72) (actual time=0.274..1.899 rows=2038 loops=1)
               Recheck Cond: (floor = 7)
               Heap Blocks: exact=1044
               ->  Bitmap Index Scan on rooms_floor_idx  (cost=0.00..28.09 rows=2107 width=0) (actual time=0.178..0.178 rows=2038 loops=1)
                     Index Cond: (floor = 7)
 Planning Time: 0.571 ms
 Execution Time: 2.168 ms
```

2. **Filter by capacity** (`rooms_capacity_idx`):

```text
EXPLAIN ANALYZE
SELECT * FROM rooms WHERE capacity >= 90 ORDER BY "createdAt" DESC, id DESC LIMIT 10;

 Limit  (cost=1520.35..1520.37 rows=10 width=72) (actual time=1.605..1.607 rows=10 loops=1)
   ->  Sort  (cost=1520.35..1530.27 rows=3967 width=72) (actual time=1.605..1.606 rows=10 loops=1)
         Sort Key: "createdAt" DESC, id DESC
         Sort Method: top-N heapsort  Memory: 26kB
         ->  Bitmap Heap Scan on rooms  (cost=51.04..1434.62 rows=3967 width=72) (actual time=0.364..1.297 rows=3876 loops=1)
               Recheck Cond: (capacity >= 90)
               Heap Blocks: exact=1263
               ->  Bitmap Index Scan on rooms_capacity_idx  (cost=0.00..50.04 rows=3967 width=0) (actual time=0.254..0.254 rows=3876 loops=1)
                     Index Cond: (capacity >= 90)
 Planning Time: 0.038 ms
 Execution Time: 1.626 ms
```

3. **Both filters** (the two indexes are combined with `BitmapAnd`):

```text
EXPLAIN ANALYZE
SELECT * FROM rooms WHERE capacity >= 90 AND floor = 7 ORDER BY "createdAt" DESC, id DESC LIMIT 10;

 Limit  (cost=348.52..348.54 rows=10 width=72) (actual time=0.441..0.442 rows=10 loops=1)
   ->  Sort  (cost=348.52..348.73 rows=84 width=72) (actual time=0.441..0.441 rows=10 loops=1)
         Sort Key: "createdAt" DESC, id DESC
         Sort Method: top-N heapsort  Memory: 26kB
         ->  Bitmap Heap Scan on rooms  (cost=78.43..346.70 rows=84 width=72) (actual time=0.403..0.431 rows=71 loops=1)
               Recheck Cond: ((floor = 7) AND (capacity >= 90))
               Heap Blocks: exact=70
               ->  BitmapAnd  (cost=78.43..78.43 rows=84 width=0) (actual time=0.395..0.395 rows=0 loops=1)
                     ->  Bitmap Index Scan on rooms_floor_idx  (cost=0.00..28.09 rows=2107 width=0) (actual time=0.150..0.150 rows=2038 loops=1)
                           Index Cond: (floor = 7)
                     ->  Bitmap Index Scan on rooms_capacity_idx  (cost=0.00..50.04 rows=3967 width=0) (actual time=0.206..0.206 rows=3876 loops=1)
                           Index Cond: (capacity >= 90)
 Planning Time: 0.038 ms
 Execution Time: 0.467 ms
```

### Why two separate indexes instead of a composite index?

- **Filters are optional**: users can query by `floor` only, `capacity` only, or both together.
- **Composite index limitations**: a composite index only works well when its first column is filtered. With a composite `(capacity, floor)` index on the same data, the floor-only query fell back to a full table scan (`Seq Scan`, 6.1 ms instead of 2.2 ms).
- **PostgreSQL BitmapAnd**: two separate indexes cover each filter on its own, and PostgreSQL combines them with `BitmapAnd` when both filters are set.
