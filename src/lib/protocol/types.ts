// ── Jam Protocol Types ─────────────────────────────────────────────
// Shared between the extension client and the Rust server.

/** Info about the currently playing track. */
export interface TrackInfo {
  title: string;
  artist: string;
  artworkUrl: string | null;
  trackUrl: string;
  /** Unix ms when playback started (wall-clock). */
  startTime: number;
  /** Unix ms when the track will end (wall-clock). */
  endTime: number;
}

/** A user in a jam session. */
export interface JamUser {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  profileUrl: string | null;
  username: string | null;
  isHost: boolean;
  currentTrack: TrackInfo | null;
}

/** The current user's own profile (from SoundCloud). */
export interface CurrentUser {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  profileUrl: string;
}

/** Full jam session state. */
export interface JamSession {
  jamId: string;
  inviteCode: string;
  users: JamUser[];
  hostId: string;
  createdAt: number;
}

// ── Client → Server Messages ──────────────────────────────────────

export interface CreateJamMessage {
  type: "CREATE_JAM";
  displayName: string;
  avatarUrl: string | null;
  profileUrl: string | null;
  username: string | null;
}

export interface JoinJamMessage {
  type: "JOIN_JAM";
  inviteCode: string;
  displayName: string;
  avatarUrl: string | null;
  profileUrl: string | null;
  username: string | null;
}

export interface LeaveJamMessage {
  type: "LEAVE_JAM";
}

export interface TrackUpdateMessage {
  type: "TRACK_UPDATE";
  track: TrackInfo;
}

export interface PingMessage {
  type: "PING";
}

export type ClientMessage =
  | CreateJamMessage
  | JoinJamMessage
  | LeaveJamMessage
  | TrackUpdateMessage
  | PingMessage;

// ── Server → Client Messages ──────────────────────────────────────

export interface JamCreatedMessage {
  type: "JAM_CREATED";
  session: JamSession;
  userId: string;
}

export interface JamJoinedMessage {
  type: "JAM_JOINED";
  session: JamSession;
  userId: string;
}

export interface UserJoinedMessage {
  type: "USER_JOINED";
  user: JamUser;
}

export interface UserLeftMessage {
  type: "USER_LEFT";
  userId: string;
}

export interface UserTrackUpdatedMessage {
  type: "USER_TRACK_UPDATED";
  userId: string;
  track: TrackInfo;
}

export interface PlayTrackMessage {
  type: "PLAY_TRACK";
  track: TrackInfo;
}

export interface PongMessage {
  type: "PONG";
}

export interface ErrorMessage {
  type: "ERROR";
  code: string;
  message: string;
}

export type ServerMessage =
  | JamCreatedMessage
  | JamJoinedMessage
  | UserJoinedMessage
  | UserLeftMessage
  | UserTrackUpdatedMessage
  | PlayTrackMessage
  | PongMessage
  | ErrorMessage;
