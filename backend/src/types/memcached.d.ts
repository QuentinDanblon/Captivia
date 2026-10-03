/**
 * Typage minimal du paquet `memcached` (pas de @types officiel) : uniquement
 * les méthodes utilisées par MemcachedCacheService.
 */
declare module 'memcached' {
  type Callback<T = unknown> = (err: Error | undefined, data: T) => void;

  class Memcached {
    constructor(servers: string | string[]);
    on(event: 'error', listener: (err: Error) => void): this;
    get(key: string, cb: Callback<unknown>): void;
    set(key: string, value: unknown, lifetime: number, cb: Callback): void;
    del(key: string, cb: Callback): void;
    flush(cb: Callback): void;
    end(): void;
  }

  export = Memcached;
}
