/**
 * Leichtgewichtige ENV-Validierung beim Boot (ohne neue Dependency).
 *
 * Nutzt class-validator/class-transformer, die ohnehin schon im Projekt sind.
 * Wird in app.module.ts an ConfigModule.forRoot({ validate: validateEnv })
 * gehaengt -> der Boot bricht SOFORT mit gesammelter, klarer Meldung ab, statt
 * spaeter mit einem rohen getOrThrow-Fehler aus dem AuthModule.
 *
 * DEV-SICHER: Die lokale .env (NODE_ENV=development, DB_TYPE=sqlite, JWT_SECRET
 * gesetzt) erfuellt das Schema. Die Prod-Haertungen (Mindestlaenge, Verbot
 * bekannter Dev-Secrets, Default-DB-Pass) greifen NUR bei NODE_ENV=production.
 */
import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
  validateSync,
} from 'class-validator';

enum NodeEnv {
  development = 'development',
  production = 'production',
  test = 'test',
}

class EnvVars {
  @IsEnum(NodeEnv)
  @IsOptional()
  NODE_ENV: NodeEnv = NodeEnv.development;

  @IsOptional()
  @IsInt()
  PORT?: number;

  @IsIn(['sqlite', 'postgres'])
  @IsOptional()
  DB_TYPE?: string;

  // JWT_SECRET ist immer Pflicht. Die Prod-spezifische Mindestlaenge und das
  // Verbot bekannter Dev-Defaults macht der manuelle Zusatz-Check unten
  // (sauberer als ein Schein-Feld mit @MinLength).
  @IsString()
  @IsNotEmpty()
  JWT_SECRET!: string;

  // Postgres-Pflichtfelder NUR wenn DB_TYPE=postgres. Bei sqlite (Dev-Default)
  // bleiben sie optional -> kein Dev-Bruch.
  @ValidateIf((o) => o.DB_TYPE === 'postgres')
  @IsString()
  @IsNotEmpty()
  DB_HOST?: string;

  @ValidateIf((o) => o.DB_TYPE === 'postgres')
  @IsString()
  @IsNotEmpty()
  DB_USER?: string;

  @ValidateIf((o) => o.DB_TYPE === 'postgres')
  @IsString()
  @IsNotEmpty()
  DB_PASS?: string;

  @ValidateIf((o) => o.DB_TYPE === 'postgres')
  @IsString()
  @IsNotEmpty()
  DB_NAME?: string;
}

/** Bekannte Dev-/Beispiel-Secrets, die in Produktion verboten sind. */
const UNSAFE_SECRETS = [
  'detailly-dev-secret-change-in-production',
  'local-dev-secret-not-for-production',
  'your-super-secret-jwt-key-change-in-production',
  'changeme',
  'secret',
];

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvVars, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length) {
    const message = errors
      .map((e) => Object.values(e.constraints || {}).join(', '))
      .join('\n');
    throw new Error('ENV-Validierung fehlgeschlagen:\n' + message);
  }

  // Zusatz-Regeln, die Decorators schlecht abbilden (Prod-Haertung gegen
  // Fail-open). Greifen NUR in Produktion -> Dev bleibt unangetastet.
  const isProd = validated.NODE_ENV === NodeEnv.production;
  if (isProd) {
    if (!validated.JWT_SECRET || validated.JWT_SECRET.length < 16) {
      throw new Error('In Production muss JWT_SECRET >= 16 Zeichen lang sein.');
    }
    if (UNSAFE_SECRETS.includes(validated.JWT_SECRET)) {
      throw new Error(
        'JWT_SECRET ist ein bekannter Dev-Default - in Production verboten.',
      );
    }
    if ((validated.DB_TYPE || 'sqlite') === 'postgres') {
      if (validated.DB_PASS === 'detailly') {
        throw new Error(
          'Unsicheres Default-DB_PASS "detailly" in Production verboten.',
        );
      }
    }
  }

  return validated;
}
