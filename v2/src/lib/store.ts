import {
  collection, doc, onSnapshot, query, where, getDoc, setDoc, updateDoc, deleteDoc,
  QueryConstraint, Firestore, UpdateData,
} from 'firebase/firestore';
import { Collections, CollectionName } from './types';
import { db } from './firebase';

/** Everything of v2 lives under /v2/data/<collection>, beside v1's data. */
export const V2_ROOT = ['v2', 'data'] as const;

export interface Filter {
  field: string;
  op: '==' | 'array-contains' | 'in';
  value: unknown;
}

export type Unsubscribe = () => void;

export interface Store {
  watch<K extends CollectionName>(
    name: K, filters: Filter[], onChange: (items: Collections[K][]) => void,
  ): Unsubscribe;
  get<K extends CollectionName>(name: K, id: string): Promise<Collections[K] | null>;
  set<K extends CollectionName>(name: K, id: string, data: Collections[K]): Promise<void>;
  update<K extends CollectionName>(name: K, id: string, patch: Partial<Collections[K]>): Promise<void>;
  remove(name: CollectionName, id: string): Promise<void>;
}

/** Drops undefined values, which Firestore refuses. */
function clean<T>(value: T): T {
  if (Array.isArray(value)) return value.map(clean) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) if (v !== undefined) out[k] = clean(v);
    return out as T;
  }
  return value;
}

// ------------------------------------------------------------------ Firestore
export class FirestoreStore implements Store {
  constructor(private readonly fs: Firestore) {}
  private col(name: string) { return collection(this.fs, V2_ROOT[0], V2_ROOT[1], name); }
  private ref(name: string, id: string) { return doc(this.fs, V2_ROOT[0], V2_ROOT[1], name, id); }

  watch<K extends CollectionName>(name: K, filters: Filter[], onChange: (items: Collections[K][]) => void): Unsubscribe {
    const constraints: QueryConstraint[] = filters.map((f) => where(f.field, f.op, f.value));
    return onSnapshot(
      query(this.col(name), ...constraints),
      (snap) => onChange(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Collections[K])),
      (error) => {
        // A denied read resolves as empty rather than hanging the screen.
        if ((error as { code?: string }).code !== 'permission-denied') console.error(`[store] ${name}`, error);
        onChange([]);
      },
    );
  }
  async get<K extends CollectionName>(name: K, id: string) {
    const snap = await getDoc(this.ref(name, id));
    return snap.exists() ? ({ ...snap.data(), id: snap.id } as Collections[K]) : null;
  }
  async set<K extends CollectionName>(name: K, id: string, data: Collections[K]) {
    await setDoc(this.ref(name, id), clean(data));
  }
  async update<K extends CollectionName>(name: K, id: string, patch: Partial<Collections[K]>) {
    await updateDoc(this.ref(name, id), clean(patch) as UpdateData<Collections[K]>);
  }
  async remove(name: CollectionName, id: string) {
    await deleteDoc(this.ref(name, id));
  }
}

/** The one store: Firestore, under /v2/data. A build without the
 *  VITE_FIREBASE_* variables has nothing to talk to, and says so instead of
 *  rendering an empty site. */
if (!db) throw new Error('Firebase is not configured: set the VITE_FIREBASE_* variables (see .env.example).');
export const store: Store = new FirestoreStore(db);
