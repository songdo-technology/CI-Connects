import {
  collection, doc, onSnapshot, query, where, getDoc, setDoc, updateDoc, deleteDoc,
  QueryConstraint, Firestore, UpdateData,
} from 'firebase/firestore';
import { Collections, CollectionName } from './types';
import { db, isDemo } from './firebase';
import seed from '../../seed/data.json';

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

// ------------------------------------------------------------------ Memory
type Listener = { name: CollectionName; filters: Filter[]; cb: (items: unknown[]) => void };

const matches = (item: Record<string, unknown>, f: Filter): boolean => {
  const v = item[f.field];
  if (f.op === '==') return v === f.value;
  if (f.op === 'array-contains') return Array.isArray(v) && v.includes(f.value);
  if (f.op === 'in') return Array.isArray(f.value) && (f.value as unknown[]).includes(v);
  return false;
};

/** The demo store: seed data in memory, nothing persisted, no rules. */
export class MemoryStore implements Store {
  private data: Record<CollectionName, Map<string, unknown>>;
  private listeners = new Set<Listener>();

  constructor(initial: Partial<Record<CollectionName, { id: string }[]>>) {
    const names: CollectionName[] = ['users', 'invites', 'events', 'sessions', 'rooms', 'tracks', 'attendance', 'announcements', 'feedback', 'settings'];
    this.data = Object.fromEntries(names.map((n) => [n, new Map((initial[n] ?? []).map((x) => [x.id, x]))])) as Record<CollectionName, Map<string, unknown>>;
  }
  private itemsFor(name: CollectionName, filters: Filter[]) {
    return [...this.data[name].values()].filter((it) => filters.every((f) => matches(it as Record<string, unknown>, f)));
  }
  private notify(name: CollectionName) {
    for (const l of this.listeners) if (l.name === name) l.cb(this.itemsFor(name, l.filters));
  }
  watch<K extends CollectionName>(name: K, filters: Filter[], onChange: (items: Collections[K][]) => void): Unsubscribe {
    const l: Listener = { name, filters, cb: onChange as (items: unknown[]) => void };
    this.listeners.add(l);
    queueMicrotask(() => l.cb(this.itemsFor(name, filters)));
    return () => { this.listeners.delete(l); };
  }
  async get<K extends CollectionName>(name: K, id: string) {
    return (this.data[name].get(id) as Collections[K] | undefined) ?? null;
  }
  async set<K extends CollectionName>(name: K, id: string, data: Collections[K]) {
    this.data[name].set(id, { ...data, id }); this.notify(name);
  }
  async update<K extends CollectionName>(name: K, id: string, patch: Partial<Collections[K]>) {
    const current = this.data[name].get(id);
    if (!current) throw new Error(`${name}/${id} does not exist`);
    this.data[name].set(id, { ...(current as object), ...patch }); this.notify(name);
  }
  async remove(name: CollectionName, id: string) {
    this.data[name].delete(id); this.notify(name);
  }
}

/** Personas for the demo build only. Not in the seed: the seed is what
 *  production starts from, and these people do not exist. */
export const DEMO_MEMBERS = [
  { id: 'demo-listed', email: 'listed.member@example.com', name: 'Listed Member', org: 'Dwight School Seoul', title: 'Teacher', role: 'user' as const, eventAccess: ['korcos-2026'], createdAt: '2026-09-10T00:00:00.000Z' },
  { id: 'demo-unlisted', email: 'new.member@example.com', name: 'New Member', org: 'Seoul Foreign School', title: 'Teacher', role: 'user' as const, eventAccess: [], createdAt: '2026-09-10T00:00:00.000Z' },
  { id: 'demo-schedule', email: 'schedule.admin@chadwickschool.org', name: 'Sam Scheduler', org: 'Chadwick International', title: 'Conference office', role: 'schedule_admin' as const, eventAccess: ['korcos-2026'], createdAt: '2026-09-10T00:00:00.000Z' },
];

function buildStore(): Store {
  if (!isDemo && db) return new FirestoreStore(db);
  const s = seed as unknown as Partial<Record<CollectionName, { id: string }[]>>;
  return new MemoryStore({ ...s, users: [...(s.users ?? []), ...DEMO_MEMBERS] });
}

export const store: Store = buildStore();
