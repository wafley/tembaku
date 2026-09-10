export class ObjectPool<T> {
  private factory: () => T;
  private resetFn?: (item: T) => void;
  private pool: T[] = [];

  constructor(factory: () => T, resetFn?: (item: T) => void, initialSize = 20) {
    this.factory = factory;
    this.resetFn = resetFn;

    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.factory());
    }
  }

  get(): T {
    let item: T;
    if (this.pool.length > 0) {
      item = this.pool.pop()!;
    } else {
      item = this.factory();
    }

    if (this.resetFn) {
      this.resetFn(item);
    }
    return item;
  }

  release(item: T): void {
    if (this.resetFn) {
      this.resetFn(item);
    }
    this.pool.push(item);
  }

  clear(): void {
    this.pool.length = 0;
  }

  get available(): number {
    return this.pool.length;
  }
}
