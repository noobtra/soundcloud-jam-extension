// ── Internal Extension Messages ───────────────────────────────────
// Messages sent between popup ↔ background ↔ content scripts
// via chrome.runtime messaging.

import type { CurrentUser, JamSession, TrackInfo } from "../protocol/types";

// ── Popup / Content → Background ──────────────────────────────────

export interface GetJamStateMsg {
  type: "GET_JAM_STATE";
}

export interface CreateJamMsg {
  type: "CREATE_JAM";
  displayName: string;
}

export interface JoinJamMsg {
  type: "JOIN_JAM";
  inviteCode: string;
  displayName: string;
}

export interface LeaveJamMsg {
  type: "LEAVE_JAM";
}

/** Track info forwarded from the MAIN world content script via the bridge. */
export interface ContentTrackUpdateMsg {
  type: "WS_SEND_TRACK";
  data: {
    artist: string;
    title: string;
    start_time: number;
    end_time: number;
    artwork_url: string | null;
    track_url: string;
  };
}

/** Current user info scraped from SoundCloud by the content script. */
export interface ContentCurrentUserMsg {
  type: "CURRENT_USER";
  data: CurrentUser;
}

/** Auto-join triggered by ?jam=CODE URL param on SoundCloud. */
export interface AutoJoinMsg {
  type: "AUTO_JOIN";
  inviteCode: string;
}

/** Focus or open the SoundCloud tab. */
export interface FocusSoundCloudMsg {
  type: "FOCUS_SOUNDCLOUD";
}

export type InboundMessage =
  | GetJamStateMsg
  | CreateJamMsg
  | JoinJamMsg
  | LeaveJamMsg
  | ContentTrackUpdateMsg
  | ContentCurrentUserMsg
  | AutoJoinMsg
  | FocusSoundCloudMsg;

// ── Background → Popup / Content (broadcast) ─────────────────────

export type ConnectionState = "disconnected" | "connecting" | "connected";

export interface JamStateUpdate {
  type: "JAM_STATE_UPDATE";
  session: JamSession | null;
  userId: string | null;
  currentUser: CurrentUser | null;
  connectionState: ConnectionState;
}

/** Command sent to the MAIN world (via bridge) to play a track. */
export interface PlayTrackCmd {
  type: "WS_PLAY_TRACK";
  data: { trackUrl: string };
}

export type OutboundMessage = JamStateUpdate | PlayTrackCmd;
