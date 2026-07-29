import { join, resolve } from 'path';
import { checkProductionEnv } from './production-preflight';

/**
 * Preflight-Warnung „Dateispeicher" (Go-Live-Blocker: Uploads muessen einen
 * Redeploy ueberleben). Ergaenzt die bestehende production-preflight.spec.ts
 * (unveraendert) um die STORAGE_LOCAL_PATH-Risikopruefung.
 */
function validProdEnv(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'production',
    DB_TYPE: 'postgres',
    DB_HOST: 'db.internal',
    DB_USER: 'detailly_app',
    DB_PASS: 'ein-sicheres-langes-passwort',
    DB_NAME: 'detailly_prod',
    JWT_SECRET: 'x'.repeat(64),
    DATA_ENC_KEY: 'a'.repeat(64),
    FRONTEND_URL: 'https://app.example.de',
    SMTP_HOST: 'smtp.example.de',
    STRIPE_SECRET_KEY: 'sk_live_x',
    STRIPE_WEBHOOK_SECRET: 'whsec_x',
    SEED_ADMIN_PASSWORD: 'irrelevant-hier',
    TRUST_PROXY_HOPS: '1',
    SECURITY_ALERT_EMAIL: 'security@example.de',
  };
}

const STORAGE_WARN = /STORAGE_LOCAL_PATH .* App-\/Container-Verzeichnis/;

describe('checkProductionEnv – Dateispeicher-Warnung (Redeploy-Verlustrisiko)', () => {
  it('WARNT, wenn STORAGE_LOCAL_PATH im App-Verzeichnis liegt', () => {
    const env = validProdEnv();
    env.STORAGE_LOCAL_PATH = join(process.cwd(), 'private-uploads');
    const res = checkProductionEnv(env, { synchronize: false });
    expect(res.errors).toEqual([]); // nur Warnung, KEIN Abbruch
    expect(res.warnings.some((w) => STORAGE_WARN.test(w))).toBe(true);
  });

  it('KEINE Warnung, wenn STORAGE_LOCAL_PATH auf ein externes Volume zeigt', () => {
    const env = validProdEnv();
    env.STORAGE_LOCAL_PATH = resolve(process.cwd(), '..', 'detailly-daten-persistent');
    const res = checkProductionEnv(env, { synchronize: false });
    expect(res.warnings.some((w) => STORAGE_WARN.test(w))).toBe(false);
  });

  it('WARNT, wenn STORAGE_LOCAL_PATH ungesetzt ist (Default = App-Verzeichnis = Redeploy-Verlustrisiko)', () => {
    const env = validProdEnv();
    delete env.STORAGE_LOCAL_PATH; // wahrscheinlichster Fehler beim ersten Prod-Deploy
    const res = checkProductionEnv(env, { synchronize: false });
    expect(res.errors).toEqual([]); // nur Warnung, KEIN Abbruch
    expect(res.warnings.some((w) => STORAGE_WARN.test(w))).toBe(true);
    // Der Hinweistext nennt „nicht gesetzt" + den Fix (persistentes Volume).
    expect(res.warnings.some((w) => /nicht gesetzt/.test(w) && /persistente/i.test(w))).toBe(true);
  });

  it('WARNT auch bei leerem/Whitespace STORAGE_LOCAL_PATH (faellt auf App-Verzeichnis zurueck)', () => {
    const env = validProdEnv();
    env.STORAGE_LOCAL_PATH = '   ';
    const res = checkProductionEnv(env, { synchronize: false });
    expect(res.warnings.some((w) => STORAGE_WARN.test(w))).toBe(true);
  });

  it('Dev: kein Wurf, keine Storage-Warnung (No-op), auch bei riskantem Pfad', () => {
    const res = checkProductionEnv(
      { NODE_ENV: 'development', STORAGE_LOCAL_PATH: join(process.cwd(), 'private-uploads') },
      { synchronize: false },
    );
    expect(res.warnings).toEqual([]);
  });
});
