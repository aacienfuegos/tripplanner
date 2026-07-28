// Map con cota de tamaño y evicción del entry más antiguo al superar el
// límite. `Map` preserva orden de inserción, así que `keys().next()` siempre
// da la entrada más vieja — no hace falta una librería LRU para esto.
export class BoundedCache<K, V> {
  private readonly map = new Map<K, V>();

  constructor(private readonly maxSize: number) {}

  get(key: K): V | undefined {
    return this.map.get(key);
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  set(key: K, value: V): void {
    this.map.delete(key);
    if (this.map.size >= this.maxSize) {
      const oldestKey = this.map.keys().next().value as K | undefined;
      if (oldestKey !== undefined) this.map.delete(oldestKey);
    }
    this.map.set(key, value);
  }

  get size(): number {
    return this.map.size;
  }
}
