export type Role = "ADMIN" | "STREAMER" | "MODERATOR" | "VIEWER";
export type PollStatus = "collecting" | "voting" | "paused" | "completed";
export type PaidMode = "accumulated_value" | "fixed_ticket" | "hybrid";
export type MediaType = "movie" | "tv" | "game";
export type LibraryStatus = "up_next" | "in_progress" | "completed";
export type ActivityType = "poll_created" | "poll_status" | "library_status";

export interface PollInfo {
  id: string;
  title: string;
  category_type: "movie" | "game" | "mixed";
  status: PollStatus;
  poll_mode: "multiple_choice" | "bracket";
  is_paid_voting: boolean;
  paid_mode: PaidMode;
  min_donation_amount: number;
  ends_at: string | null;
  paused_remaining_seconds: number | null;
  created_at: string;
}

export interface RankingRow {
  suggestion_id: string;
  poll_id: string;
  title: string;
  poster_url: string | null;
  media_type: MediaType;
  vote_tag: string;
  release_year: string | null;
  free_votes_count: number;
  total_amount_raised: number;
  total_donations_count: number;
  total_score: number;
}

export interface SnapshotData {
  poll: PollInfo;
  ranking: RankingRow[];
  pending_count: number;
  free_votes_total: number;
  paid_total: number;
  paid_count: number;
  whale: { name: string; amount: number } | null;
  server_time: string;
}

export interface SnapshotRow {
  poll_id: string;
  channel_id: string;
  poll_created_at: string;
  updated_at: string;
  data: SnapshotData;
}

export interface SessionPayload {
  uid: string;
  kid: string;
  name: string;
  avatar?: string | null;
  slug?: string | null;
}

export interface PublicUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  kick_verified: boolean;
}

export interface LibraryItem {
  id: string;
  channel_id: string;
  source_poll_id: string;
  external_media_id: string;
  media_type: MediaType;
  title: string;
  poster_url: string | null;
  release_year: string | null;
  status: LibraryStatus;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StreamActivity {
  id: string;
  channel_id: string;
  poll_id: string | null;
  library_id: string | null;
  activity_type: ActivityType;
  title: string;
  body: string;
  category_type: "movie" | "game" | "mixed" | null;
  media_type: MediaType | null;
  poster_url: string | null;
  status: string | null;
  created_at: string;
}


export interface SearchUserResult {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  kick_verified: boolean;
}

export interface SearchChannelResult {
  id: string;
  kick_channel_slug: string;
  owner_id: string;
  is_active: boolean;
  owner: SearchUserResult;
}

export interface SearchResults {
  query: string;
  users: SearchUserResult[];
  channels: SearchChannelResult[];
}
