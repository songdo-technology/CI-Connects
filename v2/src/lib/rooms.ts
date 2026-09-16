import { Facility, Room } from './types';

/** "B-201 · MS English" — the number on the door first, as people look for it. */
export const roomLabel = (r: Pick<Room, 'name' | 'number'>) => (r.number ? `${r.number} · ${r.name}` : r.name);
export const roomWhere = (r: Pick<Room, 'where' | 'location'>) => r.where ?? r.location;
export const facilityLabel = (f: Facility) => (f.number ? `${f.number} · ${f.name}` : f.name);
/** "Middle & Upper School (Building B) · 2nd floor" */
export const facilityWhere = (f: Facility) =>
  f.floor === 'Outdoor' ? [f.building, f.area].filter(Boolean).join(' · ') : `${f.building}${f.buildingCode ? ` (Building ${f.buildingCode})` : ''} · ${f.floor}`;

/** Loose form for matching: "b201", "mainthe". */
export const norm = (s: string) => s.toLowerCase().replace(/[\s\-–.]/g, '');

/** Rooms that match what someone typed — a number, part of a name, a
 *  building — best first: exact number, then number prefix, then name. */
export function searchFacilities(list: Facility[], q: string, limit = 12): Facility[] {
  const t = norm(q);
  if (!t) return [];
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const score = (f: Facility) => {
    const num = norm(f.number ?? ''); const name = f.name.toLowerCase();
    const hay = `${name} ${f.building.toLowerCase()} ${f.floor.toLowerCase()} ${(f.area ?? '').toLowerCase()}`;
    if (num && num === t) return 0;
    if (num && num.startsWith(t)) return 1;
    if (name.startsWith(q.trim().toLowerCase())) return 2;
    if (words.every((w) => hay.includes(w))) return 3;
    if (num && num.includes(t)) return 4;
    if (norm(name).includes(t)) return 5;
    return -1;
  };
  return list.map((f) => ({ f, s: score(f) })).filter((x) => x.s >= 0).sort((a, b) => a.s - b.s || a.f.order - b.f.order).slice(0, limit).map((x) => x.f);
}
