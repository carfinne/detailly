import { requestMemoMiddleware, memoize, invalidateMemo } from './request-memo';

/** Fuehrt `fn` innerhalb eines Memo-Stores aus (wie ein echter Request). */
function imRequest<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    requestMemoMiddleware({} as any, {} as any, () => {
      fn().then(resolve, reject);
    });
  });
}

describe('request-memo (P3-5b)', () => {
  it('ohne Store (Cron/Seeds/Tests): Loader laeuft jedes Mal (Fallback)', async () => {
    const loader = jest.fn().mockResolvedValue('wert');
    await memoize('k', loader);
    await memoize('k', loader);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('im Request: Loader laeuft nur einmal, auch bei parallelen Aufrufen', async () => {
    const loader = jest.fn().mockResolvedValue('wert');
    await imRequest(async () => {
      const [a, b] = await Promise.all([memoize('k', loader), memoize('k', loader)]);
      const c = await memoize('k', loader);
      expect(a).toBe('wert');
      expect(b).toBe('wert');
      expect(c).toBe('wert');
    });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('unterschiedliche Keys werden getrennt memoisiert', async () => {
    const loader = jest.fn().mockResolvedValue('x');
    await imRequest(async () => {
      await memoize('a', loader);
      await memoize('b', loader);
    });
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('invalidateMemo: naechster Aufruf laedt frisch (Abo-Mutation)', async () => {
    const loader = jest.fn().mockResolvedValueOnce('alt').mockResolvedValueOnce('neu');
    await imRequest(async () => {
      expect(await memoize('k', loader)).toBe('alt');
      invalidateMemo('k');
      expect(await memoize('k', loader)).toBe('neu');
    });
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('abgelehnte Promises werden nicht gecacht', async () => {
    const loader = jest
      .fn()
      .mockRejectedValueOnce(new Error('kaputt'))
      .mockResolvedValueOnce('ok');
    await imRequest(async () => {
      await expect(memoize('k', loader)).rejects.toThrow('kaputt');
      expect(await memoize('k', loader)).toBe('ok');
    });
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('Stores sind pro Request isoliert', async () => {
    const loader = jest.fn().mockResolvedValue('wert');
    await imRequest(async () => memoize('k', loader));
    await imRequest(async () => memoize('k', loader));
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
