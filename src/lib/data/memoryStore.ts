import { CollectionKey, CollectionTypes, Identified } from './schema';
import { BatchOperation, DataStore, Unsubscribe } from './store';

/**
 * In-memory implementation of DataStore.
 *
 * This is what the app runs on until Firebase is connected, and it stays
 * useful afterwards: tests and the local dev loop can run against it without a
 * network or a project, and it is what the Firestore implementation gets
 * checked against.
 *
 * It deliberately behaves like a remote store rather than like useState —
 * writes are asynchronous and never mutate an array in place, and readers only
 * learn about changes through their subscription. Code written against this
 * cannot accidentally depend on synchronous local mutation and then break when
 * a real network arrives.
 */
export class MemoryStore implements DataStore {
  private data = new Map<CollectionKey, Identified[]>();
  private listeners = new Map<CollectionKey, Set<(items: never[]) => void>>();

  constructor(seed?: Partial<{ [K in CollectionKey]: CollectionTypes[K][] }>) {
    if (seed) {
      for (const [key, items] of Object.entries(seed)) {
        this.data.set(key as CollectionKey, [...(items as Identified[])]);
      }
    }
  }

  private rows<K extends CollectionKey>(key: K): CollectionTypes[K][] {
    return (this.data.get(key) ?? []) as CollectionTypes[K][];
  }

  /** Hands every listener a fresh array, so React sees a new reference. */
  private emit<K extends CollectionKey>(key: K): void {
    const snapshot = [...this.rows(key)];
    for (const listener of this.listeners.get(key) ?? []) {
      (listener as (items: CollectionTypes[K][]) => void)(snapshot);
    }
  }

  subscribe<K extends CollectionKey>(
    key: K,
    onChange: (items: CollectionTypes[K][]) => void,
  ): Unsubscribe {
    if (!this.listeners.has(key)) this.listeners.set(key, new Set());
    const set = this.listeners.get(key)!;
    set.add(onChange as (items: never[]) => void);
    // Fire immediately, matching Firestore's behaviour of delivering the
    // current snapshot on attach.
    onChange([...this.rows(key)]);
    return () => { set.delete(onChange as (items: never[]) => void); };
  }

  async create<K extends CollectionKey>(key: K, item: CollectionTypes[K]): Promise<void> {
    this.data.set(key, [...this.rows(key), item] as Identified[]);
    this.emit(key);
  }

  async update<K extends CollectionKey>(
    key: K,
    id: string,
    patch: Partial<CollectionTypes[K]>,
  ): Promise<void> {
    this.data.set(
      key,
      this.rows(key).map((row) =>
        (row as Identified).id === id ? { ...row, ...patch } : row,
      ) as Identified[],
    );
    this.emit(key);
  }

  async remove<K extends CollectionKey>(key: K, id: string): Promise<void> {
    this.data.set(
      key,
      this.rows(key).filter((row) => (row as Identified).id !== id) as Identified[],
    );
    this.emit(key);
  }

  async batch(operations: BatchOperation[]): Promise<void> {
    // Apply everything, then emit once per touched collection, so a batch
    // produces a single render rather than one per operation.
    const touched = new Set<CollectionKey>();
    for (const op of operations) {
      const rows = this.rows(op.key) as Identified[];
      if (op.op === 'create') {
        this.data.set(op.key, [...rows, op.item as Identified]);
      } else if (op.op === 'update') {
        this.data.set(op.key, rows.map((r) =>
          r.id === op.id ? { ...r, ...(op.patch as object) } : r));
      } else {
        this.data.set(op.key, rows.filter((r) => r.id !== op.id));
      }
      touched.add(op.key);
    }
    for (const key of touched) this.emit(key);
  }

  async seed<K extends CollectionKey>(key: K, items: CollectionTypes[K][]): Promise<void> {
    this.data.set(key, [...items] as Identified[]);
    this.emit(key);
  }
}
