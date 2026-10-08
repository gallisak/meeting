import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/app.setup.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('HealthController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ logger: false });
    setupApp(app);
    await app.init();
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('ok');
        expect(res.body.timestamp).toBeDefined();
      });
  });

  it('/health (GET) returns 503 when the database is unavailable', () => {
    vi.spyOn(app.get(PrismaService), '$queryRaw').mockRejectedValueOnce(
      new Error('connection refused'),
    );

    return request(app.getHttpServer())
      .get('/health')
      .expect(503)
      .expect((res) => {
        expect(res.body.message).toBe('Database is unavailable');
      });
  });

  it('rejects a request without a token on a non-public endpoint', () => {
    return request(app.getHttpServer()).get('/rooms').expect(401);
  });

  it('keeps public auth endpoints reachable without a token', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({})
      .expect(400);
  });

  it('marks every response with a request id', async () => {
    const generated = await request(app.getHttpServer()).get('/health');
    const passed = await request(app.getHttpServer())
      .get('/rooms')
      .set('x-request-id', 'client-id-123');
    const invalid = await request(app.getHttpServer())
      .get('/health')
      .set('x-request-id', 'bad id with spaces');

    expect(generated.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(passed.status).toBe(401);
    expect(passed.headers['x-request-id']).toBe('client-id-123');
    expect(invalid.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  afterEach(async () => {
    await app.close();
  });
});
