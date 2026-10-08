export type CoinReason =
  | "signup_bonus"
  | "daily_bonus"
  | "invite_bonus"
  | "admin_grant"
  | "event_grant"
  | "roll_purchase";

export type Profile = {
  id: string;
  username: string;
  avatar_url: string | null;
  rank: string;
  coins: number;
  is_admin: boolean;
  machine_code: string;
  invited_by: string | null;
  last_daily_bonus_at: string | null;
  created_at: string;
};

export type CoinTransaction = {
  id: string;
  user_id: string;
  amount: number;
  reason: CoinReason;
  note: string | null;
  created_by: string | null;
  created_at: string;
};

export type DailyRoll = {
  id: string;
  user_id: string;
  roll_date: string;
  free_roll_used: boolean;
  extra_rolls: number;
};

export type RngSession = {
  id: string;
  user_id: string;
  score: number | null;
  payload: Record<string, unknown> | null;
  source: string;
  played_at: string;
};

export type MachineSession = {
  id: string;
  code: string;
  user_id: string | null;
  created_at: string;
  expires_at: string;
  claimed_at: string | null;
  used_at: string | null;
};

export type Friendship = {
  id: string;
  user_id: string;
  friend_id: string;
  status: "pending" | "accepted";
  created_at: string;
};

export type LeaderboardRow = {
  user_id: string;
  username: string;
  avatar_url: string | null;
  rank: string;
  best_score: number | null;
  plays: number;
};

export type AdminCitizen = {
  id: string;
  username: string;
  avatar_url: string | null;
  rank: string;
  coins: number;
  is_admin: boolean;
  machine_code: string;
  created_at: string;
  last_daily_bonus_at: string | null;
  email: string | null;
  email_confirmed: boolean;
  last_sign_in_at: string | null;
  invited_by_username: string | null;
  invited_count: number;
  friend_count: number;
  plays: number;
  best_score: number | null;
  last_played_at: string | null;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string; username: string; machine_code: string };
        Update: Partial<Profile>;
        Relationships: [];
      };
      coin_transactions: {
        Row: CoinTransaction;
        Insert: Partial<CoinTransaction> & { user_id: string; amount: number; reason: CoinReason };
        Update: Partial<CoinTransaction>;
        Relationships: [];
      };
      daily_rolls: {
        Row: DailyRoll;
        Insert: Partial<DailyRoll> & { user_id: string };
        Update: Partial<DailyRoll>;
        Relationships: [];
      };
      rng_sessions: {
        Row: RngSession;
        Insert: Partial<RngSession> & { user_id: string };
        Update: Partial<RngSession>;
        Relationships: [];
      };
      machine_sessions: {
        Row: MachineSession;
        Insert: Partial<MachineSession> & { code: string; expires_at: string };
        Update: Partial<MachineSession>;
        Relationships: [];
      };
      friendships: {
        Row: Friendship;
        Insert: Partial<Friendship> & { user_id: string; friend_id: string };
        Update: Partial<Friendship>;
        Relationships: [];
      };
    };
    Views: {
      leaderboard: {
        Row: LeaderboardRow;
        Relationships: [];
      };
    };
    Functions: {
      grant_coins: {
        Args: {
          target_user: string;
          amount: number;
          grant_reason: "admin_grant" | "event_grant";
          grant_note?: string | null;
        };
        Returns: undefined;
      };
      set_rank: {
        Args: { target_user: string; new_rank: string };
        Returns: undefined;
      };
      admin_citizens: {
        Args: Record<string, never>;
        Returns: AdminCitizen[];
      };
      create_machine_session: {
        Args: Record<string, never>;
        Returns: { code: string; expires_at: string }[];
      };
      claim_machine_session: {
        Args: { session_code: string };
        Returns: undefined;
      };
      claim_daily_bonus: {
        Args: Record<string, never>;
        Returns: number;
      };
      redeem_invite: {
        Args: { inviter_username: string };
        Returns: undefined;
      };
      buy_roll: {
        Args: Record<string, never>;
        Returns: undefined;
      };
    };
  };
};
