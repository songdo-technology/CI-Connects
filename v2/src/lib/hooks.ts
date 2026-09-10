import { useEffect, useMemo, useState } from 'react';
import { Collections, CollectionName } from './types';
import { Filter, store } from './store';

/**
 * Live view of a collection, narrowed by filters.
 *
 * `ready` turns true on the first delivery, including an empty one, so a
 * screen can tell "nothing here" from "not answered yet". Filters are
 * compared by value, so callers may build them inline.
 */
export function useWatch<K extends CollectionName>(name: K, filters: Filter[] = [], enabled = true) {
  const [items, setItems] = useState<Collections[K][]>([]);
  const [ready, setReady] = useState(false);
  const key = JSON.stringify(filters);
  useEffect(() => {
    if (!enabled) { setItems([]); setReady(true); return; }
    setReady(false);
    const off = store.watch(name, JSON.parse(key) as Filter[], (list) => { setItems(list); setReady(true); });
    return off;
  }, [name, key, enabled]);
  return useMemo(() => ({ items, ready }), [items, ready]);
}

export function useDoc<K extends CollectionName>(name: K, id: string | null | undefined) {
  const { items, ready } = useWatch(name, id ? [{ field: 'id', op: '==', value: id }] : [], Boolean(id));
  return { doc: items[0] ?? null, ready };
}
