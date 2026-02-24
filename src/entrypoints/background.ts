import { JamWebSocketClient } from "@/lib/websocket/JamWebSocketClient";
import { JamState } from "@/lib/state/JamState";
import * as msg from "@/lib/protocol/messages";
import type { ServerMessage, TrackInfo } from "@/lib/protocol/types";
import type {
  InboundMessage,
  JamStateUpdate,
  PlayTrackCmd,
} from "@/lib/messaging/types";
import {
  KEEP_ALIVE_ALARM,
  KEEP_ALIVE_PERIOD_MIN,
} from "@/lib/protocol/constants";

export default defineBackground(() => {
  const ws = new JamWebSocketClient();
  const state = new JamState();

  // The single SoundCloud tab that owns this jam session.
  let jamTabId: number | null = null;

  // ── Broadcast state to popup + content tabs ─────────────────────
  function broadcastState() {
    const update: JamStateUpdate = state.toUpdateMessage();

    // To popup (if open)
    browser.runtime.sendMessage(update).catch(() => {});

    // To SoundCloud content scripts
    browser.tabs
      .query({ url: "*://soundcloud.com/*" })
      .then((tabs) => {
        for (const tab of tabs) {
          if (tab.id != null) {
            browser.tabs.sendMessage(tab.id, update).catch(() => {});
          }
        }
      })
      .catch(() => {});
  }

  // Broadcast whenever state changes
  state.setChangeHandler(() => broadcastState());

  // ── WebSocket connection state → JamState ───────────────────────
  ws.setStateChangeHandler((connState) => {
    state.setConnectionState(connState);
  });

  // ── Server messages → state updates ─────────────────────────────
  ws.setMessageHandler((serverMsg: ServerMessage) => {
    switch (serverMsg.type) {
      case "JAM_CREATED":
        state.setSession(serverMsg.session, serverMsg.userId);
        startKeepAlive();
        break;

      case "JAM_JOINED":
        state.setSession(serverMsg.session, serverMsg.userId);
        startKeepAlive();
        break;

      case "USER_JOINED":
        state.addUser(serverMsg.user);
        break;

      case "USER_LEFT":
        state.removeUser(serverMsg.userId);
        break;

      case "USER_TRACK_UPDATED":
        state.updateUser(serverMsg.userId, (u) => ({
          ...u,
          currentTrack: serverMsg.track,
        }));
        break;

      case "PLAY_TRACK":
        // Forward play command to the jam tab only
        sendPlayTrackToJamTab(serverMsg.track);
        break;

      case "MODE_CHANGED":
        state.setMode(serverMsg.mode);
        break;

      case "QUEUE_UPDATED":
        state.setQueue(serverMsg.queue);
        break;

      case "ERROR":
        console.warn("[Jam] Server error:", serverMsg.code, serverMsg.message);
        break;
    }
  });

  /** Tell the jam tab's MAIN world content script to play a track. */
  function sendPlayTrackToJamTab(track: TrackInfo) {
    if (jamTabId == null) return;
    const cmd: PlayTrackCmd = {
      type: "WS_PLAY_TRACK",
      data: { trackUrl: track.trackUrl },
    };
    browser.tabs.sendMessage(jamTabId, cmd).catch(() => {});
  }

  /** Focus a tab and its window. */
  async function focusTab(tabId: number) {
    const tab = await browser.tabs.get(tabId);
    await browser.tabs.update(tabId, { active: true });
    if (tab.windowId != null) {
      await browser.windows.update(tab.windowId, { focused: true });
    }
  }

  /** Resolve which tab to pin as the jam tab. */
  async function resolveJamTab(senderTabId?: number): Promise<number | null> {
    // If the message came from a content script tab, use that
    if (senderTabId != null) return senderTabId;

    // Otherwise (from popup), find the active SoundCloud tab
    const tabs = await browser.tabs.query({
      url: "*://soundcloud.com/*",
      active: true,
      currentWindow: true,
    });
    if (tabs[0]?.id != null) return tabs[0].id;

    // Fallback: any SoundCloud tab
    const allTabs = await browser.tabs.query({ url: "*://soundcloud.com/*" });
    return allTabs[0]?.id ?? null;
  }

  // ── Inbound messages from popup + content ───────────────────────
  browser.runtime.onMessage.addListener(
    (message: InboundMessage, _sender, sendResponse) => {
      const senderTabId = _sender.tab?.id ?? undefined;

      switch (message.type) {
        case "GET_JAM_STATE":
          sendResponse(state.toUpdateMessage());
          return false; // synchronous

        case "CREATE_JAM": {
          const user = state.getSnapshot().currentUser;
          if (!user) break;
          const mode = message.mode;
          resolveJamTab(senderTabId).then((tabId) => {
            jamTabId = tabId;
            console.log("[Jam] Jam tab pinned:", jamTabId);
            ws.connect();
            ws.send(msg.createJam(user, mode));
          });
          break;
        }

        case "JOIN_JAM": {
          const user = state.getSnapshot().currentUser;
          if (!user) break;
          resolveJamTab(senderTabId).then((tabId) => {
            jamTabId = tabId;
            console.log("[Jam] Jam tab pinned:", jamTabId);
            ws.connect();
            ws.send(msg.joinJam(message.inviteCode, user));
          });
          break;
        }

        case "AUTO_JOIN": {
          const snap = state.getSnapshot();
          if (snap.session) break; // already in a jam
          const user = snap.currentUser;
          if (!user) break;
          // AUTO_JOIN always comes from a content script tab
          jamTabId = senderTabId ?? null;
          console.log("[Jam] Jam tab pinned (auto-join):", jamTabId);
          ws.connect();
          ws.send(msg.joinJam(message.inviteCode, user));
          break;
        }

        case "LEAVE_JAM":
          ws.send(msg.leaveJam());
          state.clearSession();
          jamTabId = null;
          stopKeepAlive();
          break;

        case "WS_SEND_TRACK": {
          // Only accept track updates from the jam tab
          if (senderTabId != null && senderTabId !== jamTabId) break;

          const d = message.data;
          const track: TrackInfo = {
            title: d.title,
            artist: d.artist,
            artworkUrl: d.artwork_url,
            trackUrl: d.track_url,
            startTime: d.start_time,
            endTime: d.end_time,
          };

          // Update own user in state
          const snap = state.getSnapshot();
          if (snap.userId) {
            state.updateUser(snap.userId, (u) => ({
              ...u,
              currentTrack: track,
            }));
          }

          // Forward to server if in a jam
          if (snap.session) {
            ws.send(msg.trackUpdate(track));
          }
          break;
        }

        case "CURRENT_USER":
          state.setCurrentUser(message.data);
          break;

        case "FOCUS_SOUNDCLOUD":
          // Focus the jam tab specifically, or any SC tab, or open a new one
          {
            const targetId = jamTabId;
            if (targetId != null) {
              browser.tabs.get(targetId).then((tab) => {
                browser.tabs.update(targetId, { active: true });
                if (tab.windowId != null) {
                  browser.windows.update(tab.windowId, { focused: true });
                }
              }).catch(() => {
                // Jam tab no longer exists
                browser.tabs.create({ url: "https://soundcloud.com" });
              });
            } else {
              browser.tabs
                .query({ url: "*://soundcloud.com/*" })
                .then((tabs) => {
                  if (tabs[0]?.id != null) {
                    browser.tabs.update(tabs[0].id, { active: true });
                    if (tabs[0].windowId != null) {
                      browser.windows.update(tabs[0].windowId, { focused: true });
                    }
                  } else {
                    browser.tabs.create({ url: "https://soundcloud.com" });
                  }
                })
                .catch(() => {});
            }
          }
          break;

        case "NAVIGATE_SOUNDCLOUD":
          // Navigate the jam tab (or any SC tab) via SPA routing — no reload
          {
            const navUrl = message.url;
            const navTabId = jamTabId;
            if (navTabId != null) {
              focusTab(navTabId)
                .then(() => browser.tabs.sendMessage(navTabId, { type: "SC_NAVIGATE", url: navUrl }))
                .catch(() => {
                  // Jam tab gone — open the URL directly
                  browser.tabs.create({ url: navUrl });
                });
            } else {
              browser.tabs
                .query({ url: "*://soundcloud.com/*" })
                .then((tabs) => {
                  if (tabs[0]?.id != null) {
                    const tabId = tabs[0].id!;
                    focusTab(tabId)
                      .then(() => browser.tabs.sendMessage(tabId, { type: "SC_NAVIGATE", url: navUrl }))
                      .catch(() => {});
                  } else {
                    browser.tabs.create({ url: navUrl });
                  }
                })
                .catch(() => {});
            }
          }
          break;

        case "CHANGE_MODE":
          if (state.getSnapshot().session) {
            ws.send(msg.changeMode(message.mode));
          }
          break;

        case "QUEUE_ADD":
          if (state.getSnapshot().session) {
            ws.send(msg.queueAdd(message.track));
          }
          break;

        case "QUEUE_REMOVE":
          if (state.getSnapshot().session) {
            ws.send(msg.queueRemove(message.queueId));
          }
          break;

        case "CONTENT_QUEUE_ADD": {
          if (!state.getSnapshot().session) break;
          const d = message.data;
          const queueTrack: TrackInfo = {
            title: d.title,
            artist: d.artist,
            artworkUrl: d.artwork_url,
            trackUrl: d.track_url,
            startTime: 0,
            endTime: 0,
          };
          ws.send(msg.queueAdd(queueTrack));
          break;
        }
      }

      sendResponse({ status: "OK" });
      return false;
    },
  );

  // ── Intercept jam URLs (fallback for fresh page loads) ──────────
  // Handles both ?jam=CODE (query) and #jam=CODE (hash) on full
  // page loads. The content script handles hash-only changes without
  // reload via the hashchange event — this is just a background fallback.
  browser.webNavigation.onCompleted.addListener(
    (details) => {
      if (details.frameId !== 0) return; // only top frame
      const url = new URL(details.url);
      const jamCode =
        url.searchParams.get("jam") ||
        url.hash.match(/^#jam=([A-Za-z0-9]+)/)?.[1] ||
        null;
      if (!jamCode) return;

      const snap = state.getSnapshot();
      if (snap.session) return; // already in a jam
      const user = snap.currentUser;
      if (!user) return;

      jamTabId = details.tabId;
      console.log("[Jam] Intercepted jam URL navigation, joining:", jamCode);
      ws.connect();
      ws.send(msg.joinJam(jamCode, user));
    },
    { url: [{ hostEquals: "soundcloud.com" }] },
  );

  // ── Auto-leave when jam tab navigates away ────────────────────
  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (tabId !== jamTabId || !changeInfo.url) return;
    if (!changeInfo.url.startsWith("https://soundcloud.com")) {
      console.log("[Jam] Jam tab navigated away — leaving jam.");
      ws.send(msg.leaveJam());
      state.clearSession();
      jamTabId = null;
      stopKeepAlive();
    }
  });

  // ── Auto-leave when jam tab closes ────────────────────────────
  browser.tabs.onRemoved.addListener((tabId) => {
    if (tabId === jamTabId) {
      console.log("[Jam] Jam tab closed — leaving jam.");
      ws.send(msg.leaveJam());
      state.clearSession();
      jamTabId = null;
      stopKeepAlive();
    }
  });

  // ── Keep-alive alarm for active jam sessions ────────────────────
  function startKeepAlive() {
    browser.alarms.create(KEEP_ALIVE_ALARM, {
      periodInMinutes: KEEP_ALIVE_PERIOD_MIN,
    });
  }

  function stopKeepAlive() {
    browser.alarms.clear(KEEP_ALIVE_ALARM);
  }

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === KEEP_ALIVE_ALARM) {
      // Just waking up the SW is enough; ping is handled by the WS client
    }
  });

  // ── Reload SoundCloud tabs on install/update ────────────────────
  browser.runtime.onInstalled.addListener(() => {
    browser.tabs.query({ url: "*://soundcloud.com/*" }).then((tabs) => {
      for (const tab of tabs) {
        if (tab.id != null) {
          browser.tabs.reload(tab.id);
        }
      }
    });
  });

  // ── SW restart recovery ─────────────────────────────────────────
  (async () => {
    const restored = await state.restore();
    if (restored && state.getSnapshot().session) {
      ws.connect();
      startKeepAlive();
    }
    console.log("[Jam] Background service worker started.", restored ? "(session restored)" : "");
  })();
});
