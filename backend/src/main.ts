import { NestFactory } from '@nestjs/core';
import { ValidationPipe, RequestMethod } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import type { Request, Response, NextFunction } from 'express';
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

  // API unter /api/v1. Health unter /health. Der SPA-Fallback (Auslieferung des
  // Frontends) liegt bewusst ausserhalb des Praefixes und faengt alle uebrigen
  // GET-Routen ab (z.B. /login, /dashboard) – ohne Redirect, damit beim
  // pplx.app-Hosting das /port/3001-Praefix nicht verloren geht.
  app.setGlobalPrefix('api/v1', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });

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

  // SPA-Fallback OHNE Redirect.
  //
  // Hintergrund: Beim pplx.app-Hosting verlieren HTTP-Redirects (z.B. der
  // automatische Trailing-Slash-Redirect /login -> /login/) das Proxy-Praefix
  // /port/3001 und landen auf einer 404-Route. Diese Middleware liefert daher
  // fuer unbekannte GET-Routen direkt das passende index.html aus, ohne jemals
  // weiterzuleiten. So funktionieren sowohl der direkte Aufruf von /login oder
  // /dashboard als auch das Neuladen (F5) auf Unterseiten.
  const clientRoot = join(process.cwd(), 'client');
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.use((req: Request, res: Response, next: NextFunction) => {
    // Nur GET/HEAD; API-, Health- und Docs-Routen unberuehrt lassen.
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const urlPath = (req.path || '/').split('?')[0];
    if (
      urlPath.startsWith('/api') ||
      urlPath === '/health' ||
      urlPath.startsWith('/api/docs')
    ) {
      return next();
    }

    let decoded: string;
    try {
      decoded = decodeURIComponent(urlPath);
    } catch {
      decoded = urlPath;
    }

    // Path-Traversal verhindern: aufgeloeste Pfade muessen im client-Ordner liegen.
    const safeJoin = (p: string): string | null => {
      const full = join(clientRoot, p);
      return full.startsWith(clientRoot) ? full : null;
    };

    // 1) Existierende Datei (z.B. /_next/...-Assets, Bilder) direkt ausliefern.
    const hasExtension = /\.[a-zA-Z0-9]+$/.test(decoded);
    if (hasExtension) {
      const file = safeJoin(decoded);
      if (file && existsSync(file)) {
        return res.sendFile(file);
      }
      // Asset nicht gefunden -> normale 404 (kein HTML-Fallback fuer Dateien).
      return next();
    }

    // 2) Verzeichnis-Route -> zugehoeriges index.html (z.B. /login/index.html).
    const indexCandidate = safeJoin(join(decoded, 'index.html'));
    if (indexCandidate && existsSync(indexCandidate)) {
      const html = readFileSync(indexCandidate, 'utf8');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    }

    // 3) Letzter Fallback: Wurzel-index.html (Client-Router uebernimmt die Route).
    const rootIndex = join(clientRoot, 'index.html');
    if (existsSync(rootIndex)) {
      const html = readFileSync(rootIndex, 'utf8');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    }

    return next();
  });

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`[bootstrap] Detailly laeuft auf Port ${port}`);
}

bootstrap();
