/**
 * Standalone DataSource-Instanz fuer die TypeORM-CLI (Version 0.3).
 *
 * Die CLI (migration:generate/run/revert) braucht eine *Instanz* von DataSource
 * via `-d`-Flag - das blosse Options-Objekt aus data-source-options.ts reicht
 * nicht. Wir bauen die Optionen mit derselben Funktion wie der laufende Server,
 * damit die CLI exakt dieselbe Entity-Liste (alle 25 Entities) und dieselbe
 * DB-Konfiguration sieht.
 *
 * WICHTIG fuer das Generieren der Baseline: Migrationen MUESSEN gegen Postgres
 * generiert werden, nicht gegen SQLite (das Dialekt-SQL weicht ab). Beispiel:
 *   DB_TYPE=postgres NODE_ENV=development DB_HOST=... DB_USER=... DB_PASS=... \
 *   DB_NAME=... npm run migration:generate
 *
 * dotenv.config() laedt die .env, weil die CLI das nicht automatisch tut.
 */
import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from './data-source-options';

dotenv.config();

export default new DataSource(buildDataSourceOptions());
