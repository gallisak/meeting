import { ConsoleLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { setupApp } from './app.setup.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const configService = app.get(ConfigService);

  app.useLogger(
    new ConsoleLogger({
      json: configService.get<string>('NODE_ENV') === 'production',
      compact: true,
    }),
  );

  setupApp(app);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Meeting API')
    .setDescription('REST API for booking meeting rooms')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('/api/docs', app, document);

  const port = configService.get<number>('PORT', 3000);

  await app.listen(port);
}
await bootstrap();
