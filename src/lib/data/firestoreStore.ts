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
  /**
   * @param currentUid Who is asking, at the moment a subscription opens.
   *
   * The directory is readable by the community — Chadwick accounts,
   * organisers, guests with a place — while one's own profile is readable by
   * its owner (`allow get` versus `allow list` in firestore.rules). A person
   * whose account is not yet part of the community therefore gets an empty
   * directory, and would never see themselves in it; every signed-in surface
   * renders against that one profile. So `users` is two subscriptions merged.
   */
  constructor(
    private readonly db: Firestore,
    private readonly currentUid: () => string | undefined = () => undefined,
  ) {}

  subscribe<K extends CollectionKey>(
    key: K,
    onChange: (items: CollectionTypes[K][]) => void,
  ): Unsubscribe {
    if (key !== 'users') return this.watchCollection(key, onChange);
    const uid = this.currentUid();
    if (!uid) return this.watchCollection(key, onChange);

    // Both answers are needed before the first report: readiness means "the
    // directory has answered and so has my own profile", not whichever
    // happened to land first.
    let directory: CollectionTypes['users'][] | undefined;
    let own: CollectionTypes['users'] | null | undefined;
    const report = () => {
      if (directory === undefined || own === undefined) return;
      const mine = own;
      const items = mine && !directory.some((u) => u.id === mine.id)
        ? [mine, ...directory]
        : directory;
      onChange(items as CollectionTypes[K][]);
    };
    const offDirectory = this.watchCollection('users', (items) => {
      directory = items;
      report();
    });
    const offOwn = onSnapshot(
      doc(this.db, 'users', uid),
      (snap) => {
        // Not existing yet is normal for a beat after first sign-in: the
        // profile is written just after, and this listener sees it land.
        own = snap.exists()
          ? ({ ...snap.data(), id: snap.id } as CollectionTypes['users'])
          : null;
        report();
      },
      (error) => {
        console.error('[firestore] own profile not readable:', error);
        own = null;
        report();
      },
    );
    return () => { offDirectory(); offOwn(); };
  }

  private watchCollection<K extends CollectionKey>(
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
