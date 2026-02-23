import type { CurrentUser, JamSession, JamUser, TrackInfo } from "../protocol/types";
import type { ConnectionState, JamStateUpdate } from "../messaging/types";

const STORAGE_KEY = "jam_state";

export interface JamStateSnapshot {
  session: JamSession | null;
  userId: string | null;
  currentUser: CurrentUser | null;
  connectionState: ConnectionState;
}

/**
 * In-memory jam state with persistence to chrome.storage.session
 * so the service worker can restore after restart.
 */
export class JamState {
  private session: JamSession | null = null;
  private userId: string | null = null;
  private currentUser: CurrentUser | null = null;
  private connectionState: ConnectionState = "disconnected";

  private onChange: ((snapshot: JamStateSnapshot) => void) | null = null;

  /** Register a callback that fires on every state change. */
  setChangeHandler(handler: (snapshot: JamStateSnapshot) => void) {
    this.onChange = handler;
  }

  /** Get a read-only snapshot of the current state. */
  getSnapshot(): JamStateSnapshot {
    return {
      session: this.session,
      userId: this.userId,
      currentUser: this.currentUser,
      connectionState: this.connectionState,
    };
  }

  /** Build the outbound state-update message for popup/content. */
  toUpdateMessage(): JamStateUpdate {
    return {
      type: "JAM_STATE_UPDATE",
      ...this.getSnapshot(),
    };
  }

  // ── Mutators ─────────────────────────────────────────────────────

  setSession(session: JamSession | null, userId: string | null) {
    this.session = session;
    this.userId = userId;
    this.notify();
  }

  setCurrentUser(user: CurrentUser | null) {
    this.currentUser = user;
    this.notify();
  }

  setConnectionState(state: ConnectionState) {
    this.connectionState = state;
    this.notify();
  }

  updateUser(userId: string, updater: (u: JamUser) => JamUser) {
    if (!this.session) return;
    this.session = {
      ...this.session,
      users: this.session.users.map((u) =>
        u.id === userId ? updater(u) : u,
      ),
    };
    this.notify();
  }

  addUser(user: JamUser) {
    if (!this.session) return;
    // Prevent duplicates
    if (this.session.users.some((u) => u.id === user.id)) return;
    this.session = {
      ...this.session,
      users: [...this.session.users, user],
    };
    this.notify();
  }

  removeUser(userId: string) {
    if (!this.session) return;
    this.session = {
      ...this.session,
      users: this.session.users.filter((u) => u.id !== userId),
    };
    this.notify();
  }

  clearSession() {
    this.session = null;
    this.userId = null;
    this.notify();
  }

  // ── Persistence ──────────────────────────────────────────────────

  async persist() {
    try {
      await chrome.storage.session.set({
        [STORAGE_KEY]: this.getSnapshot(),
      });
    } catch {
      // storage.session may not be available in all contexts
    }
  }

  async restore(): Promise<boolean> {
    try {
      const result = await chrome.storage.session.get(STORAGE_KEY);
      const saved = result[STORAGE_KEY] as JamStateSnapshot | undefined;
      if (saved?.session) {
        this.session = saved.session;
        this.userId = saved.userId;
        this.currentUser = saved.currentUser;
        // connectionState is always reset — we reconnect fresh
        this.connectionState = "disconnected";
        return true;
      }
    } catch {
      // ignore
    }
    return false;
  }

  // ── Internal ─────────────────────────────────────────────────────

  private notify() {
    this.onChange?.(this.getSnapshot());
    this.persist();
  }
}
