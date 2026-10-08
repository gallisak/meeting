import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/app.setup.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const PASSWORD = 'secret123';
const FLOOR = 150;
const UPPER_FLOOR = 151;
const PATCH_FLOOR = 152;

type RoomBody = {
  id: string;
  name: string;
  capacity: number;
  floor: number;
  isActive: boolean;
  equipments: { id: string; name: string }[];
};

describe('Rooms and equipment (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let memberToken: string;
  let projectorId: string;
  let boardId: string;

  const rooms: Record<string, RoomBody> = {};

  const api = (token: string) => ({
    get: (url: string) =>
      request(app.getHttpServer())
        .get(url)
        .set('Authorization', `Bearer ${token}`),
    post: (url: string, body: Record<string, unknown>) =>
      request(app.getHttpServer())
        .post(url)
        .set('Authorization', `Bearer ${token}`)
        .send(body),
    patch: (url: string, body: Record<string, unknown>) =>
      request(app.getHttpServer())
        .patch(url)
        .set('Authorization', `Bearer ${token}`)
        .send(body),
  });

  const register = async (email: string) => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: PASSWORD, name: 'Rooms User' })
      .expect(201);

    return res.body.accessToken as string;
  };

  const createRoom = async (body: Record<string, unknown>) => {
    const res = await api(adminToken).post('/rooms', body).expect(201);

    return res.body as RoomBody;
  };

  const names = (res: { body: { items: RoomBody[] } }) =>
    res.body.items.map((room) => room.name);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ logger: ['error'] });
    setupApp(app);
    await app.init();

    memberToken = await register('member@rooms.local');
    await register('admin@rooms.local');
    await app.get(PrismaService).user.update({
      where: { email: 'admin@rooms.local' },
      data: { role: 'ADMIN' },
    });

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@rooms.local', password: PASSWORD })
      .expect(200);
    adminToken = login.body.accessToken;

    const projector = await api(adminToken)
      .post('/equipment', { name: 'Rooms projector' })
      .expect(201);
    const board = await api(adminToken)
      .post('/equipment', { name: 'Rooms board' })
      .expect(201);
    projectorId = projector.body.id;
    boardId = board.body.id;

    rooms.small = await createRoom({
      name: 'Rooms small',
      capacity: 2,
      floor: FLOOR,
      equipmentIds: [projectorId],
    });
    rooms.medium = await createRoom({
      name: 'Rooms medium',
      capacity: 6,
      floor: FLOOR,
      equipmentIds: [projectorId, boardId],
    });
    rooms.large = await createRoom({
      name: 'Rooms large',
      capacity: 10,
      floor: UPPER_FLOOR,
      equipmentIds: [boardId],
    });
    rooms.hall = await createRoom({
      name: 'Rooms hall',
      capacity: 20,
      floor: UPPER_FLOOR,
    });
    rooms.unused = await createRoom({
      name: 'Rooms unused',
      capacity: 8,
      floor: FLOOR,
      isActive: false,
      equipmentIds: [projectorId],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /rooms', () => {
    it('filters by floor', async () => {
      const res = await api(memberToken)
        .get(`/rooms?floor=${FLOOR}`)
        .expect(200);

      expect(names(res).sort()).toEqual([
        'Rooms medium',
        'Rooms small',
        'Rooms unused',
      ]);
      expect(res.body.total).toBe(3);
    });

    it('filters by minimum capacity, the limit itself included', async () => {
      const from10 = await api(memberToken)
        .get(`/rooms?floor=${UPPER_FLOOR}&minCapacity=10`)
        .expect(200);
      const from11 = await api(memberToken)
        .get(`/rooms?floor=${UPPER_FLOOR}&minCapacity=11`)
        .expect(200);

      expect(names(from10).sort()).toEqual(['Rooms hall', 'Rooms large']);
      expect(names(from11)).toEqual(['Rooms hall']);
    });

    it('filters by equipment', async () => {
      const withProjector = await api(memberToken)
        .get(`/rooms?equipmentId=${projectorId}`)
        .expect(200);
      const withBoard = await api(memberToken)
        .get(`/rooms?equipmentId=${boardId}&minCapacity=7`)
        .expect(200);
      const withUnknown = await api(memberToken)
        .get(`/rooms?equipmentId=${randomUUID()}`)
        .expect(200);

      expect(names(withProjector).sort()).toEqual([
        'Rooms medium',
        'Rooms small',
        'Rooms unused',
      ]);
      expect(names(withBoard)).toEqual(['Rooms large']);
      expect(withUnknown.body.items).toEqual([]);
      expect(withUnknown.body.total).toBe(0);
    });

    it('filters by activity status', async () => {
      const inactive = await api(memberToken)
        .get(`/rooms?floor=${FLOOR}&isActive=false`)
        .expect(200);
      const active = await api(memberToken)
        .get(`/rooms?floor=${FLOOR}&isActive=true`)
        .expect(200);

      expect(names(inactive)).toEqual(['Rooms unused']);
      expect(inactive.body.items[0].isActive).toBe(false);
      expect(names(active).sort()).toEqual(['Rooms medium', 'Rooms small']);
    });

    it('combines all filters', async () => {
      const res = await api(memberToken)
        .get(
          `/rooms?floor=${FLOOR}&minCapacity=6&equipmentId=${projectorId}&isActive=true`,
        )
        .expect(200);

      expect(names(res)).toEqual(['Rooms medium']);
      expect(res.body.items[0].equipments).toHaveLength(2);
    });

    it('paginates without repeating rooms, newest first', async () => {
      const first = await api(memberToken)
        .get(`/rooms?floor=${FLOOR}&limit=2&page=1`)
        .expect(200);
      const second = await api(memberToken)
        .get(`/rooms?floor=${FLOOR}&limit=2&page=2`)
        .expect(200);
      const third = await api(memberToken)
        .get(`/rooms?floor=${FLOOR}&limit=2&page=3`)
        .expect(200);

      expect(Object.keys(first.body).sort()).toEqual([
        'items',
        'limit',
        'page',
        'total',
      ]);
      expect(first.body).toMatchObject({ total: 3, page: 1, limit: 2 });
      expect(second.body).toMatchObject({ total: 3, page: 2, limit: 2 });
      expect(names(first)).toEqual(['Rooms unused', 'Rooms medium']);
      expect(names(second)).toEqual(['Rooms small']);
      expect(third.body.items).toEqual([]);
    });

    it('rejects invalid filters and pagination', async () => {
      for (const query of [
        'floor=abc',
        'floor=0',
        'minCapacity=0',
        'minCapacity=1.5',
        'equipmentId=not-a-uuid',
        'isActive=maybe',
        'limit=101',
        'limit=0',
        'page=0',
        'unknown=1',
      ]) {
        await api(memberToken).get(`/rooms?${query}`).expect(400);
      }
    });
  });

  describe('GET /rooms/:id', () => {
    it('returns the room with its equipment', async () => {
      const res = await api(memberToken)
        .get(`/rooms/${rooms.medium.id}`)
        .expect(200);

      expect(res.body.name).toBe('Rooms medium');
      expect(
        res.body.equipments.map((item: { name: string }) => item.name).sort(),
      ).toEqual(['Rooms board', 'Rooms projector']);
    });

    it('answers 404 for an unknown room and 400 for a bad id', async () => {
      await api(memberToken).get(`/rooms/${randomUUID()}`).expect(404);
      await api(memberToken).get('/rooms/not-a-uuid').expect(400);
    });
  });

  describe('POST /rooms', () => {
    const body = { name: 'Rooms new', capacity: 4, floor: PATCH_FLOOR };

    it('rejects a duplicate name', async () => {
      await api(adminToken)
        .post('/rooms', { ...body, name: 'Rooms small' })
        .expect(409);
    });

    it('rejects equipment that does not exist', async () => {
      await api(adminToken)
        .post('/rooms', { ...body, equipmentIds: [projectorId, randomUUID()] })
        .expect(404);

      const list = await api(adminToken)
        .get(`/rooms?floor=${PATCH_FLOOR}`)
        .expect(200);
      expect(names(list)).not.toContain('Rooms new');
    });

    it('rejects invalid data', async () => {
      for (const invalid of [
        { ...body, capacity: 0 },
        { ...body, floor: 201 },
        { ...body, name: ' ' },
        { ...body, equipmentIds: [projectorId, projectorId] },
        { ...body, equipmentIds: ['not-a-uuid'] },
        { ...body, owner: 'someone' },
        { name: 'Rooms incomplete' },
      ]) {
        await api(adminToken).post('/rooms', invalid).expect(400);
      }
    });

    it('is closed for a member', async () => {
      await api(memberToken).post('/rooms', body).expect(403);
    });
  });

  describe('PATCH /rooms/:id', () => {
    let roomId: string;

    beforeAll(async () => {
      const room = await createRoom({
        name: 'Rooms editable',
        capacity: 4,
        floor: PATCH_FLOOR,
        equipmentIds: [projectorId],
      });
      roomId = room.id;
    });

    it('changes only the fields that were sent', async () => {
      const res = await api(adminToken)
        .patch(`/rooms/${roomId}`, { capacity: 12 })
        .expect(200);

      expect(res.body).toMatchObject({
        name: 'Rooms editable',
        capacity: 12,
        floor: PATCH_FLOOR,
        isActive: true,
      });
      expect(res.body.equipments).toHaveLength(1);
    });

    it('replaces and clears the equipment list', async () => {
      const replaced = await api(adminToken)
        .patch(`/rooms/${roomId}`, { equipmentIds: [boardId] })
        .expect(200);
      const cleared = await api(adminToken)
        .patch(`/rooms/${roomId}`, { equipmentIds: [] })
        .expect(200);

      expect(
        replaced.body.equipments.map((item: { id: string }) => item.id),
      ).toEqual([boardId]);
      expect(cleared.body.equipments).toEqual([]);
    });

    it('deactivates and activates the room', async () => {
      const deactivated = await api(adminToken)
        .patch(`/rooms/${roomId}`, { isActive: false })
        .expect(200);
      const inactive = await api(memberToken)
        .get(`/rooms?floor=${PATCH_FLOOR}&isActive=false`)
        .expect(200);

      expect(deactivated.body.isActive).toBe(false);
      expect(names(inactive)).toEqual(['Rooms editable']);

      await api(adminToken)
        .patch(`/rooms/${roomId}`, { isActive: true })
        .expect(200);
    });

    it('rejects equipment that does not exist and keeps the room as it was', async () => {
      await api(adminToken)
        .patch(`/rooms/${roomId}`, {
          capacity: 99,
          equipmentIds: [randomUUID()],
        })
        .expect(404);

      const room = await api(memberToken).get(`/rooms/${roomId}`).expect(200);
      expect(room.body.capacity).toBe(12);
    });

    it('rejects a duplicate name, invalid data and an unknown room', async () => {
      await api(adminToken)
        .patch(`/rooms/${roomId}`, { name: 'Rooms small' })
        .expect(409);
      await api(adminToken)
        .patch(`/rooms/${roomId}`, { capacity: 0 })
        .expect(400);
      await api(adminToken)
        .patch(`/rooms/${roomId}`, { name: null })
        .expect(400);
      await api(adminToken)
        .patch(`/rooms/${roomId}`, { id: randomUUID() })
        .expect(400);
      await api(adminToken)
        .patch(`/rooms/${randomUUID()}`, { capacity: 5 })
        .expect(404);
    });

    it('is closed for a member', async () => {
      await api(memberToken)
        .patch(`/rooms/${roomId}`, { isActive: false })
        .expect(403);
    });
  });

  describe('equipment', () => {
    it('lists equipment sorted by name', async () => {
      const res = await api(memberToken)
        .get('/equipment?limit=100')
        .expect(200);
      const listed = res.body.items.map((item: { name: string }) => item.name);

      expect(Object.keys(res.body).sort()).toEqual([
        'items',
        'limit',
        'page',
        'total',
      ]);
      expect(listed.indexOf('Rooms board')).toBeLessThan(
        listed.indexOf('Rooms projector'),
      );
      expect(listed).toEqual(
        expect.arrayContaining(['Rooms board', 'Rooms projector']),
      );
    });

    it('paginates the list', async () => {
      const res = await api(memberToken)
        .get('/equipment?limit=1&page=2')
        .expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(res.body).toMatchObject({ page: 2, limit: 1 });
      expect(res.body.total).toBeGreaterThanOrEqual(2);

      await api(memberToken).get('/equipment?limit=101').expect(400);
    });

    it('rejects a duplicate and an invalid name', async () => {
      await api(adminToken)
        .post('/equipment', { name: 'Rooms projector' })
        .expect(409);
      await api(adminToken).post('/equipment', { name: 'x' }).expect(400);
      await api(adminToken).post('/equipment', {}).expect(400);
    });

    it('lets only an admin add equipment', async () => {
      await api(memberToken)
        .post('/equipment', { name: 'Rooms camera' })
        .expect(403);
    });
  });
});
