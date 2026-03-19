// ── Race types ──────────────────────────────────────────────────────────────
export interface Race {
  name: string;
  url: string;
  startDate: string;
  endDate: string | null;
  nation: string;
  raceLevel: number;
  gender: "ME" | "WE";
  startlistUrl: string | null;
  isFuture: boolean;
}

// ── Diary types ──────────────────────────────────────────────────────────────
export interface DiaryEntry {
  id: string;
  userId: string;
  raceUrl: string;
  raceName: string;
  raceYear: number;
  raceBaseSlug: string;
  isStage: boolean;
  stageNumber: number | null;
  rating: number | null;
  body: string;
  keyMoment: string | null;
  protagonist: string | null;
  dominantEmotion: string | null;
  isPublic: boolean;
  shareToken: string | null;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DiaryEntryCreate {
  raceUrl: string;
  raceName: string;
  raceYear: number;
  raceBaseSlug: string;
  isStage?: boolean;
  stageNumber?: number | null;
  rating?: number | null;
  body: string;
  keyMoment?: string | null;
  protagonist?: string | null;
  dominantEmotion?: string | null;
  isPublic?: boolean;
}

// ── Mention types ────────────────────────────────────────────────────────────
export interface Mention {
  id: string;
  diaryEntryId: string;
  entityType: "rider" | "location" | "team";
  entityName: string;
  entitySlug: string;
  mentionText: string | null;
  confidence: number;
  detectionMethod: "fuzzy" | "spacy" | "llm" | "manual";
  confirmedByUser: boolean;
}

// ── Community types ──────────────────────────────────────────────────────────
export interface Comment {
  id: string;
  diaryEntryId: string;
  parentId: string | null;
  userId: string;
  userDisplayName: string;
  body: string;
  isRemoved: boolean;
  likeCount: number;
  createdAt: string;
}

// ── Watchlist types ──────────────────────────────────────────────────────────
export interface WatchlistItem {
  id: string;
  raceUrl: string;
  raceName: string;
  raceDate: string;
  createdAt: string;
}

// ── Calendar types ────────────────────────────────────────────────────────────
export interface CalendarFilter {
  id: string;
  label: string;
  subscriptionToken: string;
  filterParams: Record<string, unknown>;
  createdAt: string;
}

// ── User types ───────────────────────────────────────────────────────────────
export interface UserProfile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
  totalReviews: number;
  publicReviews: number;
  racesFollowed: number;
}

// ── API error ────────────────────────────────────────────────────────────────
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}
