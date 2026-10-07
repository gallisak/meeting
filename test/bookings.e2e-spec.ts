import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/app.setup.js';
import {
  isBookingOverlapError,
  isDeadlockError,
} from '../src/bookings/booking-overlap.error.js';
import { isDatabaseBusyError } from '../src/common/database-busy.error.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Bookings (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let otherToken: string;
  let roomId: string;
  let inactiveRoomId: string;
  let ownerId: string;

  const emails = ['owner@test.local', 'other@test.local'];
  const baseDay = Math.floor(Date.now() / DAY) * DAY + 7 * DAY;

  const slot = (day: number, startHour: number, endHour: number) => ({
    startsAt: new Date(baseDay + day * DAY + startHour * HOUR).toISOString(),
    endsAt: new Date(baseDay + day * DAY + endHour * HOUR).toISOString(),
  });

  const book = (token: string, body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ roomId, title: 'Meeting', attendeesCount: 2, ...body });

  const register = async (email: string) => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'secret123', name: 'Test User' })
      .expect(201);

    return res.body.accessToken as string;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ logger: ['error'] });
    setupApp(app);
    await app.init();
    await app.listen(0);

    prisma = app.get(PrismaService);

    const room = await prisma.room.create({
      data: { name: 'Test room', capacity: 4, floor: 1 },
    });
    const inactiveRoom = await prisma.room.create({
      data: {
        name: 'Inactive test room',
        capacity: 4,
        floor: 1,
        isActive: false,
      },
    });
    roomId = room.id;
    inactiveRoomId = inactiveRoom.id;

    ownerToken = await register(emails[0]);
    otherToken = await register(emails[1]);

    const owner = await prisma.user.findUniqueOrThrow({
      where: { email: emails[0] },
    });
    ownerId = owner.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects a request without a token', () => {
    return request(app.getHttpServer()).get('/bookings').expect(401);
  });

  it('creates a booking with room and user data', async () => {
    const res = await book(ownerToken, slot(0, 10, 11)).expect(201);

    expect(res.body.status).toBe('CONFIRMED');
    expect(res.body.room.id).toBe(roomId);
    expect(res.body.user.email).toBe(emails[0]);
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('rejects an overlapping booking and allows an adjacent one', async () => {
    await book(ownerToken, slot(1, 10, 11)).expect(201);
    await book(otherToken, slot(1, 10.5, 11.5)).expect(409);
    await book(otherToken, slot(1, 11, 12)).expect(201);
  });

  it('validates the booking period', async () => {
    const past = {
      startsAt: new Date(Date.now() - 2 * HOUR).toISOString(),
      endsAt: new Date(Date.now() - HOUR).toISOString(),
    };

    await book(ownerToken, past).expect(400);
    await book(ownerToken, slot(2, 11, 10)).expect(400);
    await book(ownerToken, slot(2, 10, 10.1)).expect(400);
    await book(ownerToken, slot(2, 8, 17)).expect(400);
    await book(ownerToken, {
      startsAt: '2030-01-01T10:00:00',
      endsAt: '2030-01-01T11:00:00',
    }).expect(400);
    await book(ownerToken, {
      startsAt: '2030-W01-2T10:00:00Z',
      endsAt: '2030-W01-2T11:00:00Z',
    }).expect(400);
    await book(ownerToken, {
      startsAt: '9999-12-31T23:00:00-05:00',
      endsAt: '9999-12-31T23:30:00-05:00',
    }).expect(400);
  });

  it('rejects more attendees than the room capacity', () => {
    return book(ownerToken, { ...slot(3, 10, 11), attendeesCount: 5 }).expect(
      400,
    );
  });

  it('rejects an inactive or unknown room', async () => {
    await book(ownerToken, {
      ...slot(4, 10, 11),
      roomId: inactiveRoomId,
    }).expect(409);
    await book(ownerToken, {
      ...slot(4, 10, 11),
      roomId: randomUUID(),
    }).expect(404);
  });

  it('hides bookings of other members', async () => {
    const created = await book(ownerToken, slot(5, 10, 11)).expect(201);
    const id = created.body.id as string;

    await request(app.getHttpServer())
      .get(`/bookings/${id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .post(`/bookings/${id}/cancel`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(403);

    const list = await request(app.getHttpServer())
      .get('/bookings')
      .query({ roomId, limit: 100 })
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(200);

    expect(
      list.body.items.map((item: { id: string }) => item.id),
    ).not.toContain(id);
  });

  it('frees the slot after cancellation', async () => {
    const created = await book(ownerToken, slot(6, 10, 11)).expect(201);

    const cancelled = await request(app.getHttpServer())
      .post(`/bookings/${created.body.id}/cancel`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(cancelled.body.status).toBe('CANCELLED');

    await book(otherToken, slot(6, 10, 11)).expect(201);
  });

  it('updates a booking and rechecks the overlap', async () => {
    const first = await book(ownerToken, slot(8, 10, 11)).expect(201);
    await book(otherToken, slot(8, 12, 13)).expect(201);

    const patch = (token: string, body: Record<string, unknown>) =>
      request(app.getHttpServer())
        .patch(`/bookings/${first.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(body);

    const renamed = await patch(ownerToken, { title: 'Renamed' }).expect(200);
    expect(renamed.body.title).toBe('Renamed');
    expect(renamed.body.startsAt).toBe(first.body.startsAt);

    await patch(ownerToken, slot(8, 10.5, 11.5)).expect(200);
    await patch(ownerToken, slot(8, 11.5, 12.5)).expect(409);
    await patch(ownerToken, slot(8, 11, 20)).expect(400);
    await patch(ownerToken, { roomId }).expect(400);
    await patch(otherToken, { title: 'Stolen' }).expect(403);

    await request(app.getHttpServer())
      .post(`/bookings/${first.body.id}/cancel`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    await patch(ownerToken, { title: 'Too late' }).expect(409);
  });

  it('returns free slots of a room for a day', async () => {
    await book(ownerToken, slot(9, 10, 11)).expect(201);
    await book(ownerToken, slot(9, 13, 14)).expect(201);

    const date = slot(9, 0, 1).startsAt.slice(0, 10);
    const availability = (id: string, query: Record<string, string>) =>
      request(app.getHttpServer())
        .get(`/rooms/${id}/availability`)
        .query(query)
        .set('Authorization', `Bearer ${ownerToken}`);

    const res = await availability(roomId, { date }).expect(200);

    expect(res.body.slots).toEqual([
      slot(9, 0, 10),
      slot(9, 11, 13),
      slot(9, 14, 24),
    ]);

    const inactive = await availability(inactiveRoomId, { date }).expect(200);
    expect(inactive.body.slots).toEqual([]);

    await availability(roomId, { date: '2020-01-01' }).expect(200);
    await availability(roomId, { date: 'tomorrow' }).expect(400);
    await availability(roomId, { date: '9999-12-31' }).expect(400);
    await availability(roomId, {}).expect(400);
    await availability(randomUUID(), { date }).expect(404);
  });

  it('creates exactly one booking out of 20 parallel requests', async () => {
    const responses = await Promise.all(
      Array.from({ length: 20 }, () => book(ownerToken, slot(7, 10, 11))),
    );
    const statuses = responses.map((res) => res.status);

    expect(statuses.filter((status) => status === 201)).toHaveLength(1);
    expect(statuses.filter((status) => status === 409)).toHaveLength(19);
  });

  it('does not book a room deactivated while the request waits', async () => {
    const room = await prisma.room.create({
      data: { name: 'Locked test room', capacity: 4, floor: 1 },
    });

    let status: number | undefined;
    let message: string | undefined;
    let booking: Promise<void> | undefined;

    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id" FROM "rooms" WHERE "id" = ${room.id} FOR UPDATE
      `;

      booking = book(ownerToken, { ...slot(10, 10, 11), roomId: room.id }).then(
        (res) => {
          status = res.status;
          message = res.body.message;
        },
      );

      await wait(300);
      expect(status).toBeUndefined();

      await tx.room.update({
        where: { id: room.id },
        data: { isActive: false },
      });
    });

    await booking;

    expect(status).toBe(409);
    expect(message).toBe('Room is not active and cannot be booked');
  });

  it('recognises real overlap and deadlock errors from the database', async () => {
    const create = (
      client: Pick<PrismaService, 'booking'>,
      startHour: number,
      endHour: number,
    ) =>
      client.booking.create({
        data: {
          ...slot(11, startHour, endHour),
          title: 'Database error',
          attendeesCount: 1,
          userId: ownerId,
          roomId,
        },
      });

    await create(prisma, 8, 9);
    const overlapError = await create(prisma, 8.5, 9.5).catch(
      (error: unknown) => error,
    );

    expect(isBookingOverlapError(overlapError)).toBe(true);
    expect(isDeadlockError(overlapError)).toBe(false);

    const results = await Promise.allSettled([
      prisma.$transaction(async (tx) => {
        await create(tx, 10, 11);
        await wait(300);
        await create(tx, 12, 13);
      }),
      prisma.$transaction(async (tx) => {
        await create(tx, 12.5, 13.5);
        await wait(300);
        await create(tx, 10.5, 11.5);
      }),
    ]);
    const failures = results.filter((result) => result.status === 'rejected');

    expect(failures).toHaveLength(1);
    expect(isDeadlockError(failures[0].reason)).toBe(true);
    expect(isBookingOverlapError(failures[0].reason)).toBe(false);
  });

  it('recognises real transaction and pool timeouts', async () => {
    const url = new URL(process.env.DATABASE_URL ?? '');
    url.searchParams.set('connection_limit', '1');
    url.searchParams.set('pool_timeout', '1');

    const client = new PrismaClient({
      datasources: { db: { url: url.toString() } },
    });

    try {
      await client.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT 1`;

        const transactionError = await client
          .$transaction((second) => second.$queryRaw`SELECT 1`, {
            maxWait: 100,
          })
          .catch((error: unknown) => error);
        const poolError = await client.room
          .count()
          .catch((error: unknown) => error);

        expect(isDatabaseBusyError(transactionError)).toBe(true);
        expect(isDatabaseBusyError(poolError)).toBe(true);
      });
    } finally {
      await client.$disconnect();
    }
  });
});
