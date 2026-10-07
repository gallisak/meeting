import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/app.setup.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe('Bookings (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let otherToken: string;
  let roomId: string;
  let inactiveRoomId: string;

  const suffix = randomUUID();
  const emails = [`owner-${suffix}@test.local`, `other-${suffix}@test.local`];
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

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();
    await app.listen(0);

    prisma = app.get(PrismaService);

    const room = await prisma.room.create({
      data: { name: `Room ${suffix}`, capacity: 4, floor: 1 },
    });
    const inactiveRoom = await prisma.room.create({
      data: {
        name: `Inactive room ${suffix}`,
        capacity: 4,
        floor: 1,
        isActive: false,
      },
    });
    roomId = room.id;
    inactiveRoomId = inactiveRoom.id;

    ownerToken = await register(emails[0]);
    otherToken = await register(emails[1]);
  });

  afterAll(async () => {
    const roomIds = [roomId, inactiveRoomId];

    await prisma.booking.deleteMany({ where: { roomId: { in: roomIds } } });
    await prisma.room.deleteMany({ where: { id: { in: roomIds } } });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
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
});
