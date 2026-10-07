import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/app.setup.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const PASSWORD = 'secret123';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const register = (email: string, body: Record<string, unknown> = {}) =>
    request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: PASSWORD, name: 'Auth User', ...body });

  const login = (email: string, password = PASSWORD) =>
    request(app.getHttpServer()).post('/auth/login').send({ email, password });

  const refresh = (refreshToken: string) =>
    request(app.getHttpServer()).post('/auth/refresh').send({ refreshToken });

  const me = (token: string) =>
    request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ logger: ['error'] });
    setupApp(app);
    await app.init();
    await app.listen(0);

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers a member and returns tokens without internal fields', async () => {
    const res = await register('  Register@Auth.Local ').expect(201);

    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toEqual(expect.any(String));
    expect(res.body.user.email).toBe('register@auth.local');
    expect(res.body.user.role).toBe('MEMBER');
    expect(JSON.stringify(res.body)).not.toMatch(
      /passwordHash|refresh_token_hash|refreshTokenHash/,
    );
  });

  it('rejects invalid registration data', async () => {
    await register('not-an-email').expect(400);
    await register('short@auth.local', { password: '123' }).expect(400);
    await register('noname@auth.local', { name: '   ' }).expect(400);
    await register('role@auth.local', { role: 'ADMIN' }).expect(400);
  });

  it('rejects a duplicate email', async () => {
    await register('duplicate@auth.local').expect(201);
    await register('DUPLICATE@auth.local').expect(409);
  });

  it('logs in and rejects wrong credentials', async () => {
    await register('login@auth.local').expect(201);

    const res = await login('login@auth.local').expect(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toEqual(expect.any(String));

    const wrongPassword = await login('login@auth.local', 'wrong-password');
    const unknownEmail = await login('nobody@auth.local');

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.body.message).toBe(wrongPassword.body.message);
  });

  it('returns the profile only for a valid access token', async () => {
    const registered = await register('profile@auth.local').expect(201);
    const { accessToken, refreshToken } = registered.body;

    const res = await me(accessToken).expect(200);
    expect(res.body.email).toBe('profile@auth.local');
    expect(res.body.passwordHash).toBeUndefined();

    await request(app.getHttpServer()).get('/users/me').expect(401);
    await me('not-a-token').expect(401);
    await me(refreshToken).expect(401);
  });

  it('rotates the refresh token', async () => {
    const registered = await register('rotation@auth.local').expect(201);
    const oldRefreshToken = registered.body.refreshToken as string;

    const rotated = await refresh(oldRefreshToken).expect(200);
    expect(rotated.body.refreshToken).not.toBe(oldRefreshToken);

    await me(rotated.body.accessToken).expect(200);
    await refresh(oldRefreshToken).expect(401);
    await refresh(rotated.body.refreshToken).expect(200);
    await refresh('not-a-token').expect(401);
  });

  it('lets only one of two parallel refreshes succeed', async () => {
    const registered = await register('parallel@auth.local').expect(201);
    const refreshToken = registered.body.refreshToken as string;

    const responses = await Promise.all([
      refresh(refreshToken),
      refresh(refreshToken),
    ]);
    const statuses = responses.map((res) => res.status).sort((a, b) => a - b);

    expect(statuses).toEqual([200, 401]);
  });

  it('revokes the refresh token on logout', async () => {
    const registered = await register('logout@auth.local').expect(201);
    const { accessToken, refreshToken } = registered.body;

    await request(app.getHttpServer()).post('/auth/logout').expect(401);
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    await refresh(refreshToken).expect(401);
    await login('logout@auth.local').expect(200);
  });

  it('lets only an admin manage rooms and equipment', async () => {
    const member = await register('member@auth.local').expect(201);
    await register('admin@auth.local').expect(201);
    await prisma.user.update({
      where: { email: 'admin@auth.local' },
      data: { role: 'ADMIN' },
    });
    const admin = await login('admin@auth.local').expect(200);

    const createRoom = (token: string) =>
      request(app.getHttpServer())
        .post('/rooms')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Auth test room', capacity: 4, floor: 1 });
    const createEquipment = (token: string) =>
      request(app.getHttpServer())
        .post('/equipment')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Auth test projector' });

    await createRoom(member.body.accessToken).expect(403);
    await createEquipment(member.body.accessToken).expect(403);

    const room = await createRoom(admin.body.accessToken).expect(201);
    await createEquipment(admin.body.accessToken).expect(201);

    await request(app.getHttpServer())
      .patch(`/rooms/${room.body.id}`)
      .set('Authorization', `Bearer ${member.body.accessToken}`)
      .send({ isActive: false })
      .expect(403);
    await request(app.getHttpServer())
      .get('/rooms')
      .set('Authorization', `Bearer ${member.body.accessToken}`)
      .expect(200);
  });
});
