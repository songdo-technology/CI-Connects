import { MemoryStore } from './memoryStore';
import {
  INITIAL_PROFILES, INITIAL_SESSIONS, INITIAL_TRACKS, INITIAL_ROOMS,
  INITIAL_SPONSORS, INITIAL_MEAL_SERVICES, INITIAL_ANNOUNCEMENTS,
  INITIAL_COMMUNITY_TOPICS, INITIAL_ATTENDANCE, INITIAL_MESSAGES,
  INITIAL_FEEDBACK, EVENTS,
} from '../../data/initialData';

/**
 * Builds the store the app runs on today.
 *
 * The same seed data will be pushed into Firestore once the project exists —
 * see `scripts/seedFirestore.ts` when that lands — so this stays the single
 * definition of "what a fresh CI Connects contains".
 */
export function createSeededMemoryStore(): MemoryStore {
  return new MemoryStore({
    users: INITIAL_PROFILES,
    events: EVENTS,
    sessions: INITIAL_SESSIONS,
    tracks: INITIAL_TRACKS,
    rooms: INITIAL_ROOMS,
    sponsors: INITIAL_SPONSORS,
    mealServices: INITIAL_MEAL_SERVICES,
    announcements: INITIAL_ANNOUNCEMENTS,
    communityTopics: INITIAL_COMMUNITY_TOPICS,
    attendance: INITIAL_ATTENDANCE,
    messages: INITIAL_MESSAGES,
    feedback: INITIAL_FEEDBACK,
  });
}
