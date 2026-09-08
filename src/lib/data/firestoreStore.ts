import {
  Firestore, collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc,
  writeBatch, getDocs,
} from 'firebase/firestore';
import { CollectionKey, CollectionTypes, Identified } from './schema';
import { BatchOperation, DataStore, Unsubscribe } from './store';

/**
 * Firestore implementation of DataStore.
 *
 * Deliberately a flat top-level collection per key rather than nesting the
 * programme under each event document. Nesting reads better in the console,
 * but every screen in this app filters by eventId anyway, and flat collections
 * keep the security rules and the offline cache simpler. Documents carry their
 * own eventId; queries narrow on it.
 *
 * `undefined` is stripped before every write. Firestore rejects undefined
 * fields outright, and the domain model uses optional properties freely —
 * `checkedInAt` is cleared by setting it undefined, which would throw if
 * passed through unmodified.
 */

/** Recursively drops undefined values, which Firestore will not accept. */
function clean<T>(value: T): T {
  if (Array.isArray(value)) return value.map(clean) as unknown as T;
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) out[k] = clean(v);
    }
    return out as T;
  }
  return value;
}

export class FirestoreStore implements DataStore {
  constructor(private readonly db: Firestore) {}

  subscribe<K extends CollectionKey>(
    key: K,
    onChange: (items: CollectionTypes[K][]) => void,
  ): Unsubscribe {
    return onSnapshot(
      collection(this.db, key),
      (snap) => {
        onChange(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as CollectionTypes[K]));
      },
      (error) => {
        // A denied read must still resolve as a snapshot. Readiness is "every
        // collection has reported", and a listener that only logs never
        // reports — which hung the whole app on its loading gate before anyone
        // had signed in, since five collections require auth to read.
        //
        // Empty is also the honest answer: permission-denied means nothing in
        // here is visible to this caller. It is logged rather than swallowed,
        // because an unexpected denial is a rules bug worth seeing.
        if ((error as { code?: string }).code === 'permission-denied') {
          console.info(
            `[firestore] "${key}" not readable by the current user; treating as empty.`,
          );
        } else {
          console.error(`[firestore] subscription to "${key}" failed:`, error);
        }
        onChange([]);
      },
    );
  }

  async create<K extends CollectionKey>(key: K, item: CollectionTypes[K]): Promise<void> {
    const id = (item as Identified).id;
    // setDoc with an explicit id rather than addDoc: ids are generated in the
    // domain layer and referenced across collections, so Firestore must not
    // invent its own.
    await setDoc(doc(this.db, key, id), clean(item));
  }

  async update<K extends CollectionKey>(
    key: K,
    id: string,
    patch: Partial<CollectionTypes[K]>,
  ): Promise<void> {
    await updateDoc(doc(this.db, key, id), clean(patch) as Record<string, unknown>);
  }

  async remove<K extends CollectionKey>(key: K, id: string): Promise<void> {
    await deleteDoc(doc(this.db, key, id));
  }

  async batch(operations: BatchOperation[]): Promise<void> {
    // Firestore caps a batch at 500 writes; a large spreadsheet import can
    // exceed that, so commit in chunks.
    const CHUNK = 450;
    for (let i = 0; i < operations.length; i += CHUNK) {
      const wb = writeBatch(this.db);
      for (const op of operations.slice(i, i + CHUNK)) {
        if (op.op === 'create') {
          const item = op.item as Identified;
          wb.set(doc(this.db, op.key, item.id), clean(item));
        } else if (op.op === 'update') {
          wb.update(doc(this.db, op.key, op.id), clean(op.patch) as Record<string, unknown>);
        } else {
          wb.delete(doc(this.db, op.key, op.id));
        }
      }
      await wb.commit();
    }
  }

  async seed<K extends CollectionKey>(key: K, items: CollectionTypes[K][]): Promise<void> {
    const existing = await getDocs(collection(this.db, key));
    if (!existing.empty) {
      console.warn(`[firestore] "${key}" already has ${existing.size} documents; skipping seed.`);
      return;
    }
    await this.batch(items.map((item) => ({ op: 'create' as const, key, item })));
  }
}
