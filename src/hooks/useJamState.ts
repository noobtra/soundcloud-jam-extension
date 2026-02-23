import { useEffect, useState } from "react";
import type { JamStateUpdate, ConnectionState } from "@/lib/messaging/types";
import type { CurrentUser, JamSession } from "@/lib/protocol/types";

export interface JamStateHook {
  session: JamSession | null;
  userId: string | null;
  currentUser: CurrentUser | null;
  connectionState: ConnectionState;
  loading: boolean;
}

export function useJamState(): JamStateHook {
  const [session, setSession] = useState<JamSession | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("disconnected");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch initial state from background
    browser.runtime
      .sendMessage({ type: "GET_JAM_STATE" })
      .then((response: JamStateUpdate) => {
        if (response?.type === "JAM_STATE_UPDATE") {
          setSession(response.session);
          setUserId(response.userId);
          setCurrentUser(response.currentUser);
          setConnectionState(response.connectionState);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Subscribe to state updates
    const listener = (message: JamStateUpdate) => {
      if (message?.type === "JAM_STATE_UPDATE") {
        setSession(message.session);
        setUserId(message.userId);
        setCurrentUser(message.currentUser);
        setConnectionState(message.connectionState);
      }
    };

    browser.runtime.onMessage.addListener(listener);
    return () => browser.runtime.onMessage.removeListener(listener);
  }, []);

  return { session, userId, currentUser, connectionState, loading };
}
