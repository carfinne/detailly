import { checkProductionEnv, assertProductionBoot } from './production-preflight';

/**
 * Vollstaendige, gueltige Prod-Umgebung als Ausgangspunkt. Einzelne Tests
 * kippen gezielt EIN Feld, um genau dessen Fehler zu provozieren.
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
    // empfohlene ENVs gesetzt -> keine Warnungen
    FRONTEND_URL: 'https://app.example.de',
    SMTP_HOST: 'smtp.example.de',
    STRIPE_SECRET_KEY: 'sk_live_x',
    STRIPE_WEBHOOK_SECRET: 'whsec_x',
    SEED_ADMIN_PASSWORD: 'irrelevant-hier',
    TRUST_PROXY_HOPS: '1',
    SECURITY_ALERT_EMAIL: 'security@example.de',
  };
}

describe('checkProductionEnv – Dev/Test No-op', () => {
  it('development: keinerlei Fehler/Warnungen, auch bei kaputten Werten', () => {
    const res = checkProductionEnv(
      { NODE_ENV: 'development', DB_TYPE: 'sqlite', JWT_SECRET: 'secret' },
      { synchronize: true },
    );
    expect(res.errors).toEqual([]);
    expect(res.warnings).toEqual([]);
  });

  it('test: ebenfalls kompletter No-op', () => {
    const res = checkProductionEnv({ NODE_ENV: 'test' }, { synchronize: true });
    expect(res.errors).toEqual([]);
    expect(res.warnings).toEqual([]);
  });

  it('ohne NODE_ENV (undefined): No-op (nicht production)', () => {
    const res = checkProductionEnv({}, { synchronize: true });
    expect(res.errors).toEqual([]);
    expect(res.warnings).toEqual([]);
  });
});

describe('checkProductionEnv – gueltige Produktion', () => {
  it('vollstaendig gesetzt: keine Fehler, keine Warnungen', () => {
    const res = checkProductionEnv(validProdEnv(), { synchronize: false });
    expect(res.errors).toEqual([]);
    expect(res.warnings).toEqual([]);
  });
});

describe('checkProductionEnv – harte Abbruchfaelle (Produktion)', () => {
  it('fehlendes JWT_SECRET', () => {
    const env = validProdEnv();
    delete env.JWT_SECRET;
    const res = checkProductionEnv(env, { synchronize: false });
    expect(res.errors.some((e) => e.includes('JWT_SECRET fehlt'))).toBe(true);
  });

  it('bekanntes Dev-Default-JWT_SECRET (local-dev-secret-not-for-production)', () => {
    const env = validProdEnv();
    env.JWT_SECRET = 'local-dev-secret-not-for-production';
    const res = checkProductionEnv(env, { synchronize: false });
    expect(res.errors.some((e) => e.includes('bekannter Dev-'))).toBe(true);
  });

  it('zu kurzes JWT_SECRET (< 16)', () => {
    const env = validProdEnv();
    env.JWT_SECRET = 'kurz';
    const res = checkProductionEnv(env, { synchronize: false });
    expect(res.errors.some((e) => e.includes('zu kurz'))).toBe(true);
  });

  it('DB_TYPE != postgres (sqlite) -> Fehler', () => {
    const env = validProdEnv();
    env.DB_TYPE = 'sqlite';
    const res = checkProductionEnv(env, { synchronize: false });
    expect(res.errors.some((e) => e.includes('DB_TYPE="sqlite"'))).toBe(true);
  });

  it('DB_TYPE nicht gesetzt -> Default sqlite -> Fehler', () => {
    const env = validProdEnv();
    delete env.DB_TYPE;
    const res = checkProductionEnv(env, { synchronize: false });
    expect(res.errors.some((e) => e.includes('nicht erlaubt'))).toBe(true);
  });

  it('synchronize aktiv -> Fehler', () => {
    const res = checkProductionEnv(validProdEnv(), { synchronize: true });
    expect(res.errors.some((e) => e.includes('synchronize ist aktiv'))).toBe(true);
  });

  it('fehlende Postgres-Pflichtfelder', () => {
    const env = validProdEnv();
    delete env.DB_HOST;
    delete env.DB_USER;
    delete env.DB_PASS;
    delete env.DB_NAME;
    const res = checkProductionEnv(env, { synchronize: false });
    expect(res.errors.some((e) => e.includes('DB_HOST fehlt'))).toBe(true);
    expect(res.errors.some((e) => e.includes('DB_USER fehlt'))).toBe(true);
    expect(res.errors.some((e) => e.includes('DB_PASS fehlt'))).toBe(true);
    expect(res.errors.some((e) => e.includes('DB_NAME fehlt'))).toBe(true);
  });

  it('unsicheres Default-DB_PASS "detailly"', () => {
    const env = validProdEnv();
    env.DB_PASS = 'detailly';
    const res = checkProductionEnv(env, { synchronize: false });
    expect(res.errors.some((e) => e.includes('unsichere Default'))).toBe(true);
  });

  it('fehlender DATA_ENC_KEY', () => {
    const env = validProdEnv();
    delete env.DATA_ENC_KEY;
    const res = checkProductionEnv(env, { synchronize: false });
    expect(res.errors.some((e) => e.includes('DATA_ENC_KEY'))).toBe(true);
  });

  it('zu kurzer DATA_ENC_KEY (< 32)', () => {
    const env = validProdEnv();
    env.DATA_ENC_KEY = 'zu-kurz';
    const res = checkProductionEnv(env, { synchronize: false });
    expect(res.errors.some((e) => e.includes('DATA_ENC_KEY'))).toBe(true);
  });
});

describe('checkProductionEnv – Warnungen (kein Abbruch)', () => {
  it('empfohlene ENVs fehlen -> Warnungen, aber KEINE Fehler', () => {
    const env = validProdEnv();
    delete env.FRONTEND_URL;
    delete env.SMTP_HOST;
    delete env.STRIPE_SECRET_KEY;
    delete env.STRIPE_WEBHOOK_SECRET;
    delete env.SEED_ADMIN_PASSWORD;
    delete env.TRUST_PROXY_HOPS;
    delete env.SECURITY_ALERT_EMAIL;
    const res = checkProductionEnv(env, { synchronize: false });
    expect(res.errors).toEqual([]);
    expect(res.warnings.length).toBeGreaterThanOrEqual(6);
    expect(res.warnings.some((w) => w.includes('SMTP_HOST'))).toBe(true);
    expect(res.warnings.some((w) => w.includes('TRUST_PROXY_HOPS'))).toBe(true);
  });
});

describe('assertProductionBoot – Wrapper', () => {
  it('wirft in Produktion bei Fehlern (gesammelte Meldung)', () => {
    const env = validProdEnv();
    delete env.JWT_SECRET;
    const logger = { warn: jest.fn(), log: jest.fn() };
    expect(() => assertProductionBoot(env, false, logger)).toThrow(/Produktions-Start abgebrochen/);
  });

  it('loggt Warnungen, wirft aber nicht, wenn nur empfohlene ENVs fehlen', () => {
    const env = validProdEnv();
    delete env.SMTP_HOST;
    const logger = { warn: jest.fn(), log: jest.fn() };
    expect(() => assertProductionBoot(env, false, logger)).not.toThrow();
    expect(logger.warn).toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('bestanden'));
  });

  it('dev: kein Wurf, keine Warnung, kein "bestanden"-Log (echter No-op)', () => {
    const logger = { warn: jest.fn(), log: jest.fn() };
    expect(() =>
      assertProductionBoot({ NODE_ENV: 'development' }, true, logger),
    ).not.toThrow();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.log).not.toHaveBeenCalled();
  });
});
