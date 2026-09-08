import { CollectionKey, CollectionTypes } from './schema';

export type Unsubscribe = () => void;

/**
 * The storage contract the application is written against.
 *
 * Deliberately subscription-based rather than request/response. Firestore
 * pushes changes, and a conference app wants that — a seat taken on someone
 * else's phone should disappear from yours without a refresh. Writing the
 * in-memory store to the same shape means switching to Firestore changes which
 * implementation is constructed and nothing else.
 *
 * Mutations return promises because the real one is a network call. Callers
 * do not await them for UI purposes: the subscription delivers the new state,
 * so the screen updates from the store rather than from the caller guessing
 * what the write did.
 */
export interface DataStore {
  /**
   * Watches a collection. Fires immediately with the current contents so a
   * component renders real data on first paint rather than flashing empty.
   */
  subscribe<K extends CollectionKey>(
    key: K,
    onChange: (items: CollectionTypes[K][]) => void,
  ): Unsubscribe;

  create<K extends CollectionKey>(key: K, item: CollectionTypes[K]): Promise<void>;

  /** Shallow field merge, matching Firestore's update semantics. */
  update<K extends CollectionKey>(
    key: K,
    id: string,
    patch: Partial<CollectionTypes[K]>,
  ): Promise<void>;

  remove<K extends CollectionKey>(key: K, id: string): Promise<void>;

  /**
   * Applies several writes as one unit. Used where a single user action must
   * not land half-applied — recording attendance both writes a record and
   * admits the person to the venue, and one without the other is wrong.
   */
  batch(operations: BatchOperation[]): Promise<void>;

  /** Replaces a collection wholesale. Seeding only. */
  seed<K extends CollectionKey>(key: K, items: CollectionTypes[K][]): Promise<void>;
}

export type BatchOperation =
  | { op: 'create'; key: CollectionKey; item: unknown }
  | { op: 'update'; key: CollectionKey; id: string; patch: unknown }
  | { op: 'remove'; key: CollectionKey; id: string };
