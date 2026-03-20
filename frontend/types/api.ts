// ── Race types ──────────────────────────────────────────────────────────────
export interface Race {
  name: string;
  raceUrl: string;
  year: number;
  startDate: string | null;
  endDate: string | null;
  uciClass: string | null;
  gender: string | null;
  nation: string | null;
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
  authorName?: string;   // populated by /community/feed endpoint
  createdAt: string;
  updatedAt: string | null;
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
  raceDate: string | null;
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
