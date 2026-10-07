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
| `src/bookings` | Booking creation, update, cancellation, list and room availability |
| `src/health` | `GET /health` with a database check |
| `src/prisma` | Prisma client as a global Nest provider |
| `src/common` | Exception filter and shared DTOs |
| `src/config` | Environment validation |
| `src/app.setup.ts` | Global `ValidationPipe` and exception filter, shared by `main.ts` and e2e tests |
| `prisma` | Schema, migrations and seed |

## Tests

```bash
# unit tests
npm test

# e2e tests, need a running database
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

## Bookings

### Double-booking protection

Two confirmed bookings of one room must never overlap, even when requests arrive at the same time. Three versions were tried, each checked by an e2e test that sends 20 parallel requests for the same slot:

| Version | Result of 20 parallel requests |
| --- | --- |
| `SELECT` for an overlap, then `INSERT` | 20 bookings created: every request passes the check before any of them inserts |
| Transaction with `SELECT ... FOR UPDATE` on the room row | 1 created, 19 rejected with 409 |
| Exclusion constraint in the database | 1 created, 19 rejected with 409 |

The row lock version is kept in the `stage-4-for-update-variant` branch. The final version uses the exclusion constraint:

```sql
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_overlap"
  EXCLUDE USING gist ("roomId" WITH =, tstzrange("startsAt", "endsAt", '[)') WITH &&)
  WHERE ("status" = 'CONFIRMED');
```

- The rule lives in the database, so it holds for every code path and for several API instances. The row lock only works while every write remembers to take it.
- The range is half-open (`[)`), so 10:00–11:00 and 11:00–12:00 do not overlap.
- The constraint covers only `CONFIRMED` rows, so a cancelled booking frees its slot.
- An update is checked by the same constraint, so `PATCH /bookings/:id` needs no separate overlap query.

Prisma cannot describe exclusion or `CHECK` constraints in `schema.prisma`, so they are written by hand in the migration SQL. `npx prisma migrate dev` does not see them: it reports `Already in sync` and does not generate a migration that drops them. `startsAt` and `endsAt` are `timestamptz`, and the API accepts only ISO 8601 values with an explicit timezone.

### Room lock

`POST /bookings` and a `PATCH /bookings/:id` that changes the time run in one transaction. It starts with `SELECT ... FOR UPDATE` on the room row, then checks the room and writes the booking.

- The room check (`isActive`, `capacity`) and the write cannot be split by an admin update. Either the deactivation waits until the booking is committed, or the booking waits and then sees the room as inactive.
- Requests for one room run one after another, so the constraint check never waits for a parallel insert. Without the lock, parallel inserts for the same slot wait for each other and PostgreSQL breaks the wait with deadlocks, one per `deadlock_timeout` (1 second). In a local run of 20 parallel requests the slowest answer took 19 seconds without the lock and 0.1 seconds with it.
- The lock does not replace the constraint. The constraint is the guarantee: a write that skips the lock still cannot create an overlap.

### Database errors

| Error | Answer |
| --- | --- |
| Exclusion constraint violation (`23P01`) | 409 |
| Deadlock (`40P01`) | The transaction is retried once, a second failure is answered with 409 |

Prisma has no error code for these two, so they are recognised by the text of the error. Unit tests check both functions, and an e2e test triggers both errors in a real database, so a Prisma upgrade that changes the text fails the tests.

### Booking indexes

Plans are from PostgreSQL 16 with 100,000 generated bookings (200 rooms, 1,000 users).

1. **My bookings** (`bookings_userId_startsAt_idx`). Without this index the same query is a sequential scan, 9.1 ms.

```text
EXPLAIN ANALYZE
SELECT * FROM bookings WHERE "userId" = 'u7' ORDER BY "startsAt", id LIMIT 10;

 Limit  (cost=4.80..44.55 rows=10 width=93) (actual time=0.094..0.095 rows=10 loops=1)
   ->  Incremental Sort  (cost=4.80..398.29 rows=99 width=93) (actual time=0.093..0.094 rows=10 loops=1)
         Sort Key: "startsAt", id
         Presorted Key: "startsAt"
         Full-sort Groups: 1  Sort Method: quicksort  Average Memory: 26kB  Peak Memory: 26kB
         ->  Index Scan using "bookings_userId_startsAt_idx" on bookings  (cost=0.42..394.15 rows=99 width=93) (actual time=0.025..0.055 rows=11 loops=1)
               Index Cond: ("userId" = 'u7'::text)
 Planning Time: 0.618 ms
 Execution Time: 0.130 ms
```

2. **Room and period filter, room availability** (`bookings_roomId_startsAt_endsAt_idx`):

```text
EXPLAIN ANALYZE
SELECT * FROM bookings
WHERE "roomId" = 'r7' AND "endsAt" > '2026-10-10 00:00+00' AND "startsAt" < '2026-10-11 00:00+00'
ORDER BY "startsAt", id LIMIT 10;

 Limit  (cost=4.64..41.57 rows=10 width=93) (actual time=0.071..0.072 rows=10 loops=1)
   ->  Incremental Sort  (cost=4.64..506.93 rows=136 width=93) (actual time=0.071..0.072 rows=10 loops=1)
         Sort Key: "startsAt", id
         Presorted Key: "startsAt"
         Full-sort Groups: 1  Sort Method: quicksort  Average Memory: 26kB  Peak Memory: 26kB
         ->  Index Scan using "bookings_roomId_startsAt_endsAt_idx" on bookings  (cost=0.42..501.41 rows=136 width=93) (actual time=0.035..0.037 rows=11 loops=1)
               Index Cond: (("roomId" = 'r7'::text) AND ("startsAt" < '2026-10-11 00:00:00+00'::timestamp with time zone) AND ("endsAt" > '2026-10-10 00:00:00+00'::timestamp with time zone))
 Planning Time: 0.063 ms
 Execution Time: 0.082 ms
```

The admin list without any filter has no matching index and runs as a sequential scan (9.2 ms on this data).

The list loads room and user data through Prisma `include`, which runs a fixed number of queries per page regardless of the page size.
