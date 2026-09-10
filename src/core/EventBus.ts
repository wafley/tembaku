import { EventMap } from '../types/events';

type Callback<T> = (data: T) => void;

class TypedEventBus {
  private listeners: Map<keyof EventMap, Set<Callback<any>>> = new Map();

  on<K extends keyof EventMap>(event: K, callback: Callback<EventMap[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => this.off(event, callback);
  }

  off<K extends keyof EventMap>(event: K, callback: Callback<EventMap[K]>): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(callback);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  emit<K extends keyof EventMap>(
    event: K,
    ...args: EventMap[K] extends void ? [] : [EventMap[K]]
  ): void {
    const set = this.listeners.get(event);
    if (set) {
      const data = args[0];
      for (const cb of set) {
        cb(data);
      }
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}

export const events = new TypedEventBus();
