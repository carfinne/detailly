import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { User } from './users/entities/user.entity';
import { seedDatabase } from './database/seed';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Frontend laeuft auf der gleichen Origin (vom Backend ausgeliefert). Zusaetzlich
  // optional eine separate Frontend-URL erlauben (getrennte Entwicklung).
  app.enableCors({
    origin: process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : true,
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');

  const config = new DocumentBuilder()
    .setTitle('Detailly API')
    .setDescription('Detailly Backend API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Auto-Seed: Wenn die Datenbank noch keine Benutzer hat, automatisch die
  // Demo-Daten anlegen. So ist die gehostete App sofort mit Login testbar.
  try {
    const dataSource = app.get(DataSource);
    const userCount = await dataSource.getRepository(User).count();
    if (userCount === 0) {
      console.log('[bootstrap] Leere Datenbank erkannt – lege Demo-Daten an ...');
      await seedDatabase(dataSource);
    }
  } catch (err) {
    console.error('[bootstrap] Auto-Seed uebersprungen:', err?.message ?? err);
  }

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`[bootstrap] Detailly laeuft auf Port ${port}`);
}

bootstrap();
