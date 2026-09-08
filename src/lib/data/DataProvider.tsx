import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CollectionKey, CollectionTypes, COLLECTION_KEYS } from './schema';
import { BatchOperation, DataStore } from './store';

type Collections = { [K in CollectionKey]: CollectionTypes[K][] };

interface DataContextValue extends Collections {
  /** False until every collection has delivered its first snapshot. */
  ready: boolean;
  create: DataStore['create'];
  update: DataStore['update'];
  remove: DataStore['remove'];
  batch: (operations: BatchOperation[]) => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

const EMPTY = Object.fromEntries(COLLECTION_KEYS.map((k) => [k, []])) as Collections;

/**
 * Subscribes to every collection once, high in the tree, and hands the results
 * down through context.
 *
 * One subscription per collection rather than one per component: with Firestore
 * each listener is a billed, open channel, and twenty-five components each
 * opening their own would be both slow and expensive. Components read from
 * context and stay unaware of where the data came from.
 */
export const DataProvider: React.FC<{ store: DataStore; children: React.ReactNode }> = ({
  store, children,
}) => {
  const [collections, setCollections] = useState<Collections>(EMPTY);
  const [readyKeys, setReadyKeys] = useState<Set<CollectionKey>>(new Set());

  // Held in a ref so the mutation callbacks below keep a stable identity even
  // if the store is ever swapped at runtime.
  const storeRef = useRef(store);
  storeRef.current = store;

  useEffect(() => {
    const unsubscribes = COLLECTION_KEYS.map((key) =>
      store.subscribe(key, (items) => {
        setCollections((prev) => ({ ...prev, [key]: items }));
        setReadyKeys((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
      }),
    );
    return () => { for (const off of unsubscribes) off(); };
  }, [store]);

  const value = useMemo<DataContextValue>(() => ({
    ...collections,
    ready: readyKeys.size === COLLECTION_KEYS.length,
    create: (key, item) => storeRef.current.create(key, item),
    update: (key, id, patch) => storeRef.current.update(key, id, patch),
    remove: (key, id) => storeRef.current.remove(key, id),
    batch: (operations) => storeRef.current.batch(operations),
  }), [collections, readyKeys]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside a <DataProvider>');
  return ctx;
}

/** Convenience for a component that only needs one collection. */
export function useCollection<K extends CollectionKey>(key: K): CollectionTypes[K][] {
  // TypeScript cannot narrow an index into a mapped type through a generic
  // parameter, so the cast states what the mapping already guarantees.
  return useData()[key] as CollectionTypes[K][];
}
