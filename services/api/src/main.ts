import './env';
import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

export function configure(app: INestApplication) {
  app.setGlobalPrefix('v1');
  app.use(helmet());
  app.enableCors({ origin: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(','), credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configure(app);
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('CineMind API').setVersion('1.0').addBearerAuth().build()));
  await app.listen(process.env.PORT || 4000);
}
if (require.main === module) bootstrap();
