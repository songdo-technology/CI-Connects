export type AttendeeType = 'internal_faculty' | 'internal_staff' | 'external_guest' | 'student';

export type UserRole = 'attendee' | 'speaker' | 'organizer' | 'admin';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  title: string;
  department: string;
  organization: string;
  userType: AttendeeType;
  role: UserRole;
  avatarUrl: string;
  bio: string;
  isDirectoryVisible: boolean;
  checkedIn: boolean;
  checkedInAt?: string;
  slackHandle?: string;
  interests?: string[];
}

export interface Track {
  id: string;
  name: string;
  colorHex: string;
  orderIndex: number;
}

export interface Room {
  id: string;
  name: string;
  capacity: number;
  floorLabel: string;
  building?: string;
}

export interface Sponsor {
  id: string;
  name: string;
  tier: 'Diamond' | 'Platinum' | 'Gold' | 'Institutional Partner';
  logoUrl: string;
  websiteUrl: string;
  description: string;
  tagline: string;
}

export interface Session {
  id: string;
  eventId: string;
  roomId: string;
  trackId: string;
  title: string;
  description: string;
  day: number; // 1 or 2
  dateStr: string;
  startTime: string; // e.g. "09:00 AM"
  endTime: string;   // e.g. "10:15 AM"
  startMinutes: number; // for sorting/timeline calculation
  endMinutes: number;
  maxAttendees: number;
  reservedUserIds: string[];
  waitlistUserIds: string[];
  speakerIds: string[];
  primarySponsorId?: string;
  slidesUrl?: string;
  slidesName?: string;
  isFeatured?: boolean;
  tags: string[];
}

export interface CommunityTopic {
  id: string;
  eventId: string;
  authorId: string;
  authorName: string;
  authorEmail: string;
  authorAvatar: string;
  authorDepartment: string;
  authorType: AttendeeType;
  title: string;
  content: string;
  category: 'General' | 'Informal Meetups' | 'Carpool & Dinners' | 'Ask Organizers';
  location?: string;
  meetupTime?: string;
  rsvpUserIds: string[];
  createdAt: string;
  likesCount: number;
  replies: {
    id: string;
    authorName: string;
    authorAvatar: string;
    authorDepartment: string;
    content: string;
    createdAt: string;
  }[];
}

export interface BroadcastAnnouncement {
  id: string;
  title: string;
  message: string;
  priority: 'normal' | 'urgent';
  timestamp: string;
  active: boolean;
}

export type ActiveTab = 'agenda' | 'badge' | 'community' | 'directory' | 'admin' | 'luckydraw';
