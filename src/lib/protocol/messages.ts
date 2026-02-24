import type {
  ChangeModeMessage,
  ClientMessage,
  CreateJamMessage,
  CurrentUser,
  JamMode,
  JoinJamMessage,
  LeaveJamMessage,
  QueueAddMessage,
  QueueRemoveMessage,
  TrackInfo,
  TrackUpdateMessage,
  PingMessage,
} from "./types";

export function createJam(user: CurrentUser, mode: JamMode = "anyone"): CreateJamMessage {
  return {
    type: "CREATE_JAM",
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    profileUrl: user.profileUrl,
    username: user.username,
    mode,
  };
}

export function joinJam(inviteCode: string, user: CurrentUser): JoinJamMessage {
  return {
    type: "JOIN_JAM",
    inviteCode,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    profileUrl: user.profileUrl,
    username: user.username,
  };
}

export function leaveJam(): LeaveJamMessage {
  return { type: "LEAVE_JAM" };
}

export function trackUpdate(track: TrackInfo): TrackUpdateMessage {
  return { type: "TRACK_UPDATE", track };
}

export function changeMode(mode: JamMode): ChangeModeMessage {
  return { type: "CHANGE_MODE", mode };
}

export function queueAdd(track: TrackInfo): QueueAddMessage {
  return { type: "QUEUE_ADD", track };
}

export function queueRemove(queueId: string): QueueRemoveMessage {
  return { type: "QUEUE_REMOVE", queueId };
}

export function ping(): PingMessage {
  return { type: "PING" };
}

/** Serialize a client message for sending over the WebSocket. */
export function serialize(msg: ClientMessage): string {
  return JSON.stringify(msg);
}
