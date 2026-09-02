class Cache {
  constructor() {
    this._store = new Map();
    this._timers = new Map();
  }

  async get(key) {
    const entry = this._store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this._store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key, value, ttlMs = 0) {
    if (this._timers.has(key)) {
      clearTimeout(this._timers.get(key));
      this._timers.delete(key);
    }
    const entry = { value, expiresAt: ttlMs > 0 ? Date.now() + ttlMs : null };
    this._store.set(key, entry);
    if (ttlMs > 0) {
      const timer = setTimeout(() => this._store.delete(key), ttlMs);
      this._timers.set(key, timer);
    }
    return true;
  }

  async delete(key) {
    if (this._timers.has(key)) {
      clearTimeout(this._timers.get(key));
      this._timers.delete(key);
    }
    return this._store.delete(key);
  }

  async invalidatePattern(pattern) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    const keys = [...this._store.keys()].filter(k => regex.test(k));
    keys.forEach(k => this._store.delete(k));
    return keys.length;
  }

  async increment(key) {
    const current = (await this.get(key)) || 0;
    const next = Number(current) + 1;
    await this.set(key, next);
    return next;
  }

  async expire(key, seconds) {
    const entry = this._store.get(key);
    if (!entry) return false;
    const ttlMs = seconds * 1000;
    entry.expiresAt = Date.now() + ttlMs;
    if (this._timers.has(key)) clearTimeout(this._timers.get(key));
    const timer = setTimeout(() => this._store.delete(key), ttlMs);
    this._timers.set(key, timer);
    return true;
  }

  async clear() {
    this._timers.forEach(t => clearTimeout(t));
    this._timers.clear();
    this._store.clear();
  }
}

export const cache = new Cache();
export default cache;
