import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true
  }))

  app.useGlobalFilters(new HttpExceptionFilter())

  const swaggerConfig = new DocumentBuilder()
  .setTitle('Meeting API')
  .setDescription('REST API for booking meeting rooms')
  .setVersion("1.0")
  .addBearerAuth()
  .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('/api/docs', app, document)

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000)

  await app.listen(port);
}
await bootstrap();
