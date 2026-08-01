import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { join, sep } from 'path';
import { existsSync, readFileSync } from 'fs';
import type { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { User } from './users/entities/user.entity';
import { seedDatabase } from './database/seed';
import helmet from 'helmet';
import { gzipMiddleware } from './common/http/gzip.middleware';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { requestMemoMiddleware } from './common/request-memo';
import { createRequestLoggingMiddleware } from './common/logging/request-logging.middleware';
import { registerBodyParsers } from './common/http/body-limits';
import { IpBlockService } from './security/ip-block.service';
import { SecurityEventService } from './security/security-event.service';
import { createIpBlockMiddleware } from './security/ip-block.middleware';
import { shouldCountScan } from './security/security.constants';
import { assertProductionBoot } from './config/production-preflight';
import { buildDataSourceOptions } from './database/data-source-options';
import { APP_VERSION } from './health/health.constants';
import { BetriebPageService } from './public-members/betrieb-page.service';
import { resolveSiteUrl } from './public-members/betrieb-page.render';
import { createRateLimitMiddleware } from './common/http/fixed-window-rate-limiter';

async function bootstrap() {
  // Produktions-Preflight GANZ ZUERST (reine process.env-Pruefung, kein DI-/
  // Import-Risiko): bricht in Produktion mit gesammelter, klarer Meldung ab, wenn
  // boot-kritische ENVs fehlen/unsicher sind (JWT_SECRET, DB_TYPE!=postgres,
  // synchronize an, Postgres-Verbindungs-/Enc-Key-Pflichtfelder) und warnt bei
  // fehlenden empfohlenen ENVs (SMTP, TRUST_PROXY_HOPS ...). In Dev/Test No-op.
  // synchronize wird aus der ECHTEN DataSource-Konfig abgeleitet (kein Drift).
  assertProductionBoot(
    process.env,
    Boolean(buildDataSourceOptions(process.env).synchronize),
  );

  // D1 (Sicherheitsaudit Welle 1): bodyParser:false schaltet Nests eingebaute
  // Parser ab - wir registrieren sie selbst (registerBodyParsers, s.u.) mit
  // ZWEISTUFIGEN Limits: global 256kb, Upload-Routen 12mb/25mb. Der rohe Body
  // fuer die Stripe-Webhook-Signaturpruefung (req.rawBody) wird dort ueber
  // denselben verify-Mechanismus gesetzt, den Nests rawBody:true nutzen wuerde.
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // H4: Hinter dem Reverse-Proxy (Prod) genau die ersten N Proxy-Hop-Adressen
  // vertrauen. Ohne 'trust proxy' faellt req.ip auf die Proxy-IP zusammen -> der
  // globale Rate-Limiter (ThrottlerGuard, IP-basiert) UND der Sentinel-Login-
  // Guard wuerden alle Nutzer als einen Client zaehlen. Mit N nimmt Express die
  // N-letzte X-Forwarded-For-Adresse als Client-IP (nur den direkten Proxy-Hops
  // wird vertraut, kein Spoofing tiefer). Die Hop-Zahl ist ueber ENV
  // TRUST_PROXY_HOPS konfigurierbar (Default 1) – muss der realen Zahl
  // vertrauenswuerdiger Proxies (CDN/LB/Ingress) entsprechen; ein zu hoher Wert
  // liesse Clients ihre IP per gefaelschtem X-Forwarded-For spoofen.
  const trustProxyHops = (() => {
    const raw = Number(process.env.TRUST_PROXY_HOPS);
    return Number.isInteger(raw) && raw >= 0 ? raw : 1;
  })();
  app.getHttpAdapter().getInstance().set('trust proxy', trustProxyHops);
  // Deployment-Hinweis (ehrliche Grenze): Die Client-IP-basierte Abwehr
  // (ThrottlerGuard + Sentinel-Login-Guard) ist nur so verlaesslich wie diese
  // Hop-Zahl korrekt gesetzt ist. Sie MUSS exakt der Anzahl vorgelagerter,
  // vertrauenswuerdiger Proxies (CDN/LB/Ingress) entsprechen:
  //  - zu HOCH -> Clients koennen ihre IP per gefaelschtem X-Forwarded-For
  //    spoofen (IP-Zaehler/Throttle umgehbar);
  //  - zu NIEDRIG -> alle Nutzer teilen die Proxy-IP (kollektive Sperren).
  // Die Loopback-AUSNAHME des Login-Guards haengt bewusst NICHT an req.ip,
  // sondern am echten Socket-Peer -> ein gespoofter XFF hebelt sie nicht aus.
  console.log(
    `[bootstrap] trust proxy hops = ${trustProxyHops} (ENV TRUST_PROXY_HOPS). ` +
      `Muss der Anzahl vorgelagerter Proxies entsprechen (zu hoch = IP-Spoofing via X-Forwarded-For).`,
  );

  // FIX 4: Security-Header GANZ OBEN setzen (vor allem anderen), damit sie auch
  // auf den statisch ausgelieferten HTML-Seiten landen. HSTS & Co. bleiben (Helmet-
  // Defaults). COEP aus, damit die authentifizierten Foto-Streams laden.
  //
  // CSP (Pilot-Haertung): jetzt ENFORCING (kein reportOnly mehr) -> XSS-Injektionen
  // werden tatsaechlich geblockt. Die Direktiven wurden am ECHTEN statischen Next-
  // Export (out/) verifiziert; Begruendung je Direktive:
  //  - scriptSrc 'self' 'unsafe-inline': der statische Next-Export (output:'export')
  //    injiziert pro Seite eigene Inline-Hydrations-Scripts (self.__next_f.push...)
  //    mit SEITENSPEZIFISCHEM Inhalt -> ihre Hashes unterscheiden sich je Seite und
  //    lassen sich NICHT global als Header setzen; ein Request-Nonce ist im
  //    vorgebauten HTML ebenfalls unmoeglich. Daher 'unsafe-inline' (WICHTIG: OHNE
  //    zusaetzlichen Hash/Nonce – sonst ignorieren Browser 'unsafe-inline' und die
  //    Next-Hydration bricht -> weisse Seite). Ehrliche Grenze: Skript-XSS ist damit
  //    nicht vollstaendig unterbunden; externe Skripte bleiben aber auf 'self'
  //    beschraenkt. Staerkere Script-CSP erfordert einen Server-Render mit Nonces.
  //  - styleSrc 'self' 'unsafe-inline': React rendert dynamische style={{...}} als
  //    style-Attribute (im Export verifiziert) -> Attribut-Styles sind nicht
  //    hashbar; 'unsafe-inline' noetig (Style-XSS ist ungefaehrlich ggue. Skript).
  //  - imgSrc 'self' data: blob:: Logo-/Icon-Data-URIs + Foto-Vorschauen und
  //    gerenderte Bild-/Render-Streams (Blob).
  //  - fontSrc 'self': next/font hostet Inter/Sora selbst (woff2 unter /_next) –
  //    KEINE externe Font-Domain noetig.
  //  - connectSrc 'self': die API laeuft auf derselben Origin; keine Fremd-Fetches
  //    im Frontend gefunden.
  //  - workerSrc 'self' blob:: three.js/react-three koennen Blob-Worker nutzen.
  //  - frameAncestors 'none' + objectSrc 'none' + baseUri 'self': Clickjacking-/
  //    Objekt-/base-Tag-Haertung (teils schon Helmet-Default, hier explizit).
  //  - upgradeInsecureRequests: NUR in Produktion (dort laeuft alles ueber HTTPS).
  //    In Dev (http://localhost) wuerde die Direktive gleich-Origin-Requests auf
  //    https hochstufen und den lokalen Start/Boot-Beweis zerschiessen -> aus.
  const isProdBoot = process.env.NODE_ENV === 'production';
  app.getHttpAdapter().getInstance().use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          // data:/blob: fuer Logo-Data-URIs, Foto-Vorschauen + gerenderte Bild-Streams.
          imgSrc: ["'self'", 'data:', 'blob:'],
          // next/font self-hosted -> keine externe Font-Domain.
          fontSrc: ["'self'"],
          // API laeuft auf derselben Origin -> 'self' genuegt.
          connectSrc: ["'self'"],
          // three.js/react-three nutzen ggf. Blob-Worker.
          workerSrc: ["'self'", 'blob:'],
          // Clickjacking-Schutz (zusaetzlich zu X-Frame-Options der Defaults).
          frameAncestors: ["'none'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          // Nur in Prod (HTTPS) hochstufen; in Dev (http-localhost) wuerde das den
          // lokalen Start zerschiessen. null = Direktive weglassen (Dev).
          upgradeInsecureRequests: isProdBoot ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  // PERF: Response-Kompression (gzip) mit Node-Bordmitteln (zlib) - siehe
  // common/http/gzip.middleware.ts. Bewusst OHNE das npm-Paket `compression`
  // (waere in dieser Umgebung nicht installiert -> Startabbruch). FRUEH
  // registriert, damit jede spaetere Antwort - auch die des SPA-Fallbacks weiter
  // unten - durch den Kompressor laeuft. Arbeitet ausschliesslich auf der
  // ANTWORT; Body-Limits (D1) und der rohe Stripe-Webhook-Body bleiben unberuehrt.
  // Bereits komprimierte Typen (image/*), Downloads (Content-Disposition) und
  // Antworten < 1 KB werden automatisch uebersprungen.
  app.getHttpAdapter().getInstance().use(gzipMiddleware);

  // Rest-Haertung (Sentinel Teil 2): Permissions-Policy verweigert Browser-
  // Funktionen, die diese App nie braucht (Kamera-Zugriff meint die HARDWARE-
  // Kamera-API, NICHT die Foto-Uploads). Helmet setzt diesen Header nicht als
  // Default -> hier explizit, direkt nach dem Helmet-Block, damit er auch auf
  // den statischen HTML-Seiten landet.
  app.getHttpAdapter().getInstance().use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  // Betriebsfaehigkeit (Pilot): Request-ID + strukturiertes Access-Log. FRUEH
  // registriert (nach Helmet/Permissions-Policy, VOR der Sentinel-IP-Sperre und
  // den Body-Parsern), damit die Request-ID + der X-Request-Id-Header fuer JEDE
  // Antwort gesetzt sind – auch fuer eine vom IP-Block/Throttler kurzgeschlossene
  // 429 oder einen 500. Das `res.on('finish')`-Access-Log erfasst dadurch den
  // FINALEN Status jeder API-Route. DSGVO: es werden nur IDs + der maskierte Pfad
  // geloggt (kein Body/Query, keine PII); Health-Pings + statische Assets werden
  // bewusst NICHT geloggt (kein Log-Spam). In Prod JSON-Zeilen, in Dev lesbar.
  app.use(createRequestLoggingMiddleware());

  // Sentinel Teil 2: IP-Sperr-Middleware FRUEH (nach `trust proxy`, VOR Body-
  // Parsing) -> geblockte IPs erhalten sofort 429, bevor ein Body geparst oder ein
  // Controller erreicht wird (billig). Der IpBlockService cached aktive Sperren
  // (eine DB-Query pro Fenster). Allowlist-Invariante: der echte Socket-Peer
  // (nicht die XFF-faelschbare req.ip) entscheidet die Loopback-Ausnahme.
  //
  // FIX B (Review-Gate): der Betreiber-Bereich `platform/security/*` ist von der
  // Middleware AUSGENOMMEN -> ein PLATFORM_ADMIN, dessen (Buero-NAT-)IP gesperrt
  // ist, erreicht die Entsperr-Route weiterhin und sperrt sich nicht selbst aus
  // (Deadlock-Schutz). Die Route bleibt durch JwtAuthGuard+RolesGuard(ADMIN)
  // geschuetzt -> kein neues Loch fuer den geblockten Angreifer.
  //
  // Health-Ausnahme: die Health-/Readiness-Pfade (/api/v1/health[/ready] und der
  // konventionelle bare /health) sind AUSGENOMMEN – ein Load-Balancer-Ping darf
  // eine Instanz nie versehentlich in eine IP-Sperre laufen lassen (Selbst-DoS).
  const ipBlockService = app.get(IpBlockService);
  app.getHttpAdapter().getInstance().use(
    createIpBlockMiddleware(ipBlockService, {
      exemptPrefixes: ['/api/v1/platform/security', '/api/v1/health', '/health'],
    }),
  );

  // D1: Body-Groessen-Limits (Details + gewaehlte Werte in common/http/body-limits.ts).
  // Vorher galt still der body-parser-Default (100kb) fuer ALLE Routen - jetzt:
  // 256kb global (DoS-Schutz fuer anonyme /public/*-Endpunkte), 12mb fuer
  // Inspektions-Einzelbild/Signatur, 25mb fuer den Auftrags-Foto-Batch.
  registerBodyParsers(app.getHttpAdapter().getInstance());

  // Request-Memo (P3-5b): oeffnet pro Request einen AsyncLocalStorage-Store,
  // ueber den Subscription/Tarif-Loads dedupliziert werden (Guards + Services).
  app.use(requestMemoMiddleware);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // FIX 6: Globaler Exception-Filter - vereinheitlicht unbehandelte Fehler zu
  // generischer 500 (kein Stacktrace-Leak), reicht HttpException unveraendert durch.
  //
  // Sentinel Teil 2: nur UNAUTHENTIFIZIERTE 401/404 ausserhalb des Auth-Bereichs
  // werden fire-and-forget als `scan_4xx`-Security-Event protokolliert (Scan/
  // Probing-Signal fuer die Auto-IP-Sperre). Die Zaehl-Policy (FIX A) steckt in
  // shouldCountScan: ein eingeloggter Nutzer (req.user) ist NIE ein Scanner, 403
  // (RBAC/Tarif) zaehlt nicht, Fehl-Logins haben ihr eigenes login_fail-Signal.
  // DATENSPARSAM: nur Status + Methode + IP, NIE Body/Query/Pfad (PII/Tokens).
  const securityEvents = app.get(SecurityEventService);
  app.useGlobalFilters(
    new AllExceptionsFilter((info) => {
      if (!shouldCountScan(info)) return;
      securityEvents.record({
        type: 'scan_4xx',
        severity: 'info',
        ip: info.ip ?? null,
        details: { status: info.status, method: info.method },
      });
    }),
  );

  // Frontend laeuft auf der gleichen Origin (vom Backend ausgeliefert). Zusaetzlich
  // optional eine separate Frontend-URL erlauben (getrennte Entwicklung).
  // FIX 6: Kein Fail-open mehr. Dev (NODE_ENV != production): origin:true fuer
  // lokalen Login + getrennte Frontend-Entwicklung. Prod: nur FRONTEND_URL; ohne
  // gesetzte FRONTEND_URL restriktiver Default (origin:false), NICHT mehr 'true'.
  const isProd = process.env.NODE_ENV === 'production';
  app.enableCors({
    origin: process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : (isProd ? false : true),
    credentials: true,
  });

  // API (inkl. Health) unter /api/v1. Der HealthController liefert
  // /api/v1/health (Liveness) + /api/v1/health/ready (Readiness) – daher KEIN
  // Prefix-Exclude mehr (das wuerde die Basis-Route auf bare /health umbiegen).
  // Der konventionelle bare /health (manche Hoster/LB pingen ihn) wird weiter
  // unten als schlanke Roh-Route bedient. Der SPA-Fallback (Auslieferung des
  // Frontends) liegt bewusst ausserhalb des Praefixes und faengt alle uebrigen
  // GET-Routen ab (z.B. /login, /dashboard) – ohne Redirect, damit beim
  // pplx.app-Hosting das /port/3001-Praefix nicht verloren geht.
  app.setGlobalPrefix('api/v1');

  // Swagger-Doku NUR ausserhalb Production: in Prod wuerde /api/docs sonst die
  // vollstaendige API-Oberflaeche (alle Endpunkte/DTOs) ohne Auth offenlegen und
  // Angreifer-Recon erleichtern. In Dev bleibt sie unter /api/docs erreichbar.
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Detailly API')
      .setDescription('Detailly Backend API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  // Betriebsreife: In Prod mit Postgres baut synchronize NICHT mehr das Schema.
  // Ohne committete Migrationen bliebe die DB leer -> LAUT abbrechen statt eine
  // App mit leerem Schema zu starten (sonst wuerde jede Query fehlschlagen).
  if (process.env.NODE_ENV === 'production' && (process.env.DB_TYPE || 'sqlite') === 'postgres') {
    const ds = app.get(DataSource);
    if (!ds.migrations || ds.migrations.length === 0) {
      throw new Error(
        'Production + PostgreSQL ohne Migrationen: synchronize ist aus, es wuerde KEIN Schema erzeugt. ' +
          'Bitte zuerst eine Baseline-Migration generieren (npm run migration:generate gegen die leere Prod-DB) und committen.',
      );
    }
  }

  // Auto-Seed: Wenn die Datenbank noch keine Benutzer hat, automatisch die
  // Demo-Daten anlegen. So ist die gehostete App sofort mit Login testbar.
  // FIX 3: Auto-Seed NUR ausserhalb Production. In Prod bleibt eine frische DB
  // leer (kein Default-Demo-Konto); der erste Admin wird ueber ein separates
  // Skript/Migration mit SEED_ADMIN_PASSWORD angelegt.
  if (process.env.NODE_ENV !== 'production') {
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
  }

  // SPA-Fallback OHNE Redirect.
  //
  // Hintergrund: Beim pplx.app-Hosting verlieren HTTP-Redirects (z.B. der
  // automatische Trailing-Slash-Redirect /login -> /login/) das Proxy-Praefix
  // /port/3001 und landen auf einer 404-Route. Diese Middleware liefert daher
  // fuer unbekannte GET-Routen direkt das passende index.html aus, ohne jemals
  // weiterzuleiten. So funktionieren sowohl der direkte Aufruf von /login oder
  // /dashboard als auch das Neuladen (F5) auf Unterseiten.
  // Cache-Header (AP-P2): Dauer fuer statisch auslieferbare Dateien. Content-
  // gehashte Next.js-Assets (/_next/...) sind unveraenderlich -> 1 Jahr immutable;
  // uebrige statische Dateien konservativ 1 Stunde. Die Auslieferung laeuft
  // zusaetzlich durch die oben registrierte gzip-Kompression.
  const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
  const ONE_HOUR_MS = 1000 * 60 * 60;

  const clientRoot = join(process.cwd(), 'client');
  const expressApp = app.getHttpAdapter().getInstance();

  // Bare /health (Liveness) OHNE API-Prefix: manche Hoster/LB pingen konventionell
  // /health. Liefert dieselbe minimale Antwort wie /api/v1/health (nur
  // status+version, keine Interna). Als Roh-Route VOR dem SPA-Fallback registriert,
  // damit sie nicht im index.html-Fallback landet. Die kanonische, versionierte
  // Variante bleibt /api/v1/health (+ /ready mit DB-Ping) im HealthController.
  expressApp.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', version: APP_VERSION });
  });

  // ---------------------------------------------------------------------------
  // Oeffentliche, request-time serverseitig gerenderte Betriebs-Einzelseiten
  // (/betrieb/<slug>) + die dynamische Betriebs-Sitemap. Als Roh-Routen VOR dem
  // SPA-Fallback registriert (wie /health), damit sie NICHT im index.html-Fallback
  // landen und an einer Wurzel-URL (nicht unter api/v1) crawlbar sind.
  //
  // main.ts ist Bootstrap-Code -> hier bewusst nur ein DUENNER Adapter: die ganze
  // Logik (DB-Lookup, Whitelist, Escaping, Cache, JSON-LD, Sitemap-XML) liegt in
  // BetriebPageService/betrieb-page.render (voll unit-getestet). Die Basis-URL fuer
  // canonical/OG kommt aus PUBLIC_SITE_URL (Fallback FRONTEND_URL, sonst Platzhalter).
  const betriebPage = app.get(BetriebPageService);
  const siteUrl = resolveSiteUrl(process.env);

  // Leichtgewichtige, selbst gebaute IP-Drosselung fuer die ungegateten Roh-Routen
  // (der Nest-ThrottlerGuard greift hier NICHT). /betrieb: 60/min pro IP (ein Besucher
  // klickt ggf. mehrere Betriebe), Sitemap knapper: 20/min pro IP (Crawler holen sie
  // selten). Der Limiter-Speicher ist selbst hart begrenzt (kein zweiter Vektor).
  const betriebLimiter = createRateLimitMiddleware({ limit: 60, windowMs: 60_000 });
  const sitemapLimiter = createRateLimitMiddleware({ limit: 20, windowMs: 60_000 });

  expressApp.get('/betrieb/:slug', betriebLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Trailing-Slash-Variante (/betrieb/<slug>/) mit abfangen; Slug defensiv trimmen.
      const slug = String(req.params.slug ?? '').replace(/\/+$/, '');
      const { status, html } = await betriebPage.renderSlug(slug, siteUrl);
      res.status(status);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      // 200: 5-min-Public-Cache wie die Liste; 404: kuerzer (frueher wieder frisch).
      res.setHeader('Cache-Control', status === 200 ? 'public, max-age=300' : 'public, max-age=60');
      return res.send(html);
    } catch (err) {
      return next(err);
    }
  });

  expressApp.get('/sitemap-betriebe.xml', sitemapLimiter, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const xml = await betriebPage.renderSitemap(siteUrl);
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=300');
      return res.send(xml);
    } catch (err) {
      return next(err);
    }
  });

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
      // Trenner-sicher (wie die Tenant-Foto-Resolver): Sibling-Prefix wie
      // "client-public" darf nicht als innerhalb "client" durchrutschen.
      return full === clientRoot || full.startsWith(clientRoot + sep) ? full : null;
    };

    // 1) Existierende Datei (z.B. /_next/...-Assets, Bilder) direkt ausliefern.
    const hasExtension = /\.[a-zA-Z0-9]+$/.test(decoded);
    if (hasExtension) {
      const file = safeJoin(decoded);
      if (file && existsSync(file)) {
        // Cache-Header (AP-P2): gehashte /_next/-Assets lange + immutable, uebrige
        // statische Dateien konservativ 1h. sendFile setzt zusaetzlich ETag/
        // Last-Modified -> unveraenderte Dateien werden per 304 revalidiert.
        const hashed = decoded.startsWith('/_next/');
        return res.sendFile(file, {
          maxAge: hashed ? ONE_YEAR_MS : ONE_HOUR_MS,
          immutable: hashed,
        });
      }
      // Asset nicht gefunden -> normale 404 (kein HTML-Fallback fuer Dateien).
      return next();
    }

    // 2) Verzeichnis-Route -> zugehoeriges index.html (z.B. /login/index.html).
    const indexCandidate = safeJoin(join(decoded, 'index.html'));
    if (indexCandidate && existsSync(indexCandidate)) {
      const html = readFileSync(indexCandidate, 'utf8');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      // HTML-Shell nie hart cachen: immer revalidieren (send setzt ETag -> 304).
      res.setHeader('Cache-Control', 'no-cache');
      return res.send(html);
    }

    // 3) Letzter Fallback: Wurzel-index.html (Client-Router uebernimmt die Route).
    const rootIndex = join(clientRoot, 'index.html');
    if (existsSync(rootIndex)) {
      const html = readFileSync(rootIndex, 'utf8');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      // HTML-Shell nie hart cachen: immer revalidieren (send setzt ETag -> 304).
      res.setHeader('Cache-Control', 'no-cache');
      return res.send(html);
    }

    return next();
  });

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`[bootstrap] Detailly laeuft auf Port ${port}`);
}

bootstrap();
