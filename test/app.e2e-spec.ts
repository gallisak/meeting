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

    app = moduleFixture.createNestApplication();
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

  afterEach(async () => {
    await app.close();
  });
});
