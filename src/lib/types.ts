export type Role = "STREAMER" | "MODERATOR" | "VIEWER";
export type PollStatus = "collecting" | "voting" | "paused" | "completed";
export type PaidMode = "accumulated_value" | "fixed_ticket" | "hybrid";
export type MediaType = "movie" | "tv" | "game";

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
  slug?: string | null; // slug do canal Kick do usuário (obtido no login, p/ onboarding)
}
