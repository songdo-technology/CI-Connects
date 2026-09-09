import {
  UserProfile, EventConfig, Session, Track, Room, Sponsor, MealService,
  BroadcastAnnouncement, CommunityTopic, AttendanceRecord, DirectMessage,
  FeedbackEntry, Prize, CostEntry, Invite, Certificate,
} from '../../types';

/**
 * The collections the application reads and writes.
 *
 * Keys are the Firestore collection names, so this file is the single place
 * where the storage layout is stated. Everything downstream — the store
 * interface, the provider, the hooks — is generic over these keys, which means
 * adding a collection is one entry here rather than a new method on four
 * interfaces.
 */
export interface CollectionTypes {
  users: UserProfile;
  events: EventConfig;
  sessions: Session;
  tracks: Track;
  rooms: Room;
  sponsors: Sponsor;
  mealServices: MealService;
  announcements: BroadcastAnnouncement;
  communityTopics: CommunityTopic;
  attendance: AttendanceRecord;
  messages: DirectMessage;
  feedback: FeedbackEntry;
  prizes: Prize;
  costs: CostEntry;
  invites: Invite;
  certificates: Certificate;
}

export type CollectionKey = keyof CollectionTypes;

export const COLLECTION_KEYS: CollectionKey[] = [
  'users', 'events', 'sessions', 'tracks', 'rooms', 'sponsors',
  'mealServices', 'announcements', 'communityTopics', 'attendance',
  'messages', 'feedback', 'prizes', 'costs', 'invites', 'certificates',
];

/** Every stored entity carries a string id, which the store relies on. */
export type Identified = { id: string };
